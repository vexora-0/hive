#!/usr/bin/env python3
"""
Build the capstone report .docx from docs/capstone/REPORT.md.

Repeatable on purpose: the demonstration video link is the last thing to land,
and when it does the whole document should be regenerated in one command rather
than edited by hand in Word.

    python3 build/make-report.py

Output: docs/capstone/Hive-Capstone-Report.docx

What it does that pandoc alone will not:
  - swaps each *(Figure N)* anchor in the markdown for the real image, with the
    caption underneath, which is the order the institute template asks for
  - inserts the three figures the prose never anchored (3.1, 3.5, 4.1)
  - renders the 3.4 privacy comparison as a two-cell table so the pair sits
    side by side, because that comparison is the point of the figure
  - applies build/hive-reference.docx, whose styles are patched to the
    institute's stated rules: Times New Roman, 12pt body, 14pt headings,
    1.5 line spacing, 1 inch margins
"""

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "docs/capstone/REPORT.md"
FIGDIR = ROOT / "docs/capstone/screenshots/figures"
REF = ROOT / "build/hive-reference.docx"
OUT = ROOT / "docs/capstone/Hive-Capstone-Report.docx"
STAGE = ROOT / "build/report-staged.md"

# Figure number -> (file, caption). Captions match LIST OF FIGURES exactly;
# if you change one, change it there too or the list stops being a list.
FIGURES = {
    "2.1": ("fig-2.1-architecture.png", "High-level system architecture"),
    "2.2": ("fig-2.2-dataflow.png", "Data flow — photograph upload to parent notification"),
    "2.3": ("fig-2.3-er-diagram.png", "Entity-relationship diagram"),
    "2.4": ("fig-2.4-authz-pipeline.png", "Component interaction — authorization pipeline"),
    "2.5": ("fig-2.5-upload-tagger.png", "Teacher upload screen with student tagger"),
    "2.6": ("fig-2.6-feed-child-switcher.png", "Parent feed with child switcher"),
    "2.7": ("fig-2.7-order-confirm.png", "Order placement and confirmation"),
    "2.8": ("fig-2.8-admin-dashboard.png", "Administrator dashboard"),
    "3.1": ("fig-3.1-test-suite.png", "Test suite execution — 218 tests passing"),
    "3.2": ("fig-3.2-verify-security.png", "Security verification output — 27/0/2"),
    "3.3": ("fig-3.3-sabotage.png", "Sabotage exercise — targeted tests failing"),
    "3.5": ("fig-3.5-signed-url.png", "Signed URL 200 versus stripped-token 400"),
    "4.1": ("fig-4.1-health.png", "Health endpoint, healthy and degraded"),
    "5.1": ("fig-5.1-commit-history.png", "Commit history"),
}

# Portrait phone captures are 1240x2562. Left unconstrained they run over a
# page each. Widths are in inches and chosen per orientation.
WIDTH = {"portrait": "2.6in", "wide": "6.1in", "diagram": "5.6in"}
PORTRAIT = {"2.5", "2.6", "2.7", "2.8"}
DIAGRAM = {"2.1", "2.2", "2.3", "2.4"}


def fig_md(num: str) -> str:
    """One figure as a captioned pandoc image."""
    name, caption = FIGURES[num]
    path = FIGDIR / name
    if not path.exists():
        print(f"  !! missing {name} — figure {num} left as a placeholder")
        return f"*(Figure {num} — {caption} — IMAGE MISSING)*"
    kind = "portrait" if num in PORTRAIT else ("diagram" if num in DIAGRAM else "wide")
    rel = path.relative_to(ROOT)
    return f"![Figure {num} — {caption}]({rel}){{width={WIDTH[kind]}}}"


def main() -> int:
    if not REF.exists():
        print(f"error: reference doc missing at {REF}", file=sys.stderr)
        return 1

    md = SRC.read_text(encoding="utf8")

    # 3.4 first — its anchor is a plain *(Figure 3.4)* and the pair needs a table.
    a = (FIGDIR / "fig-3.4a-rajesh-feed.png").relative_to(ROOT)
    b = (FIGDIR / "fig-3.4b-vikram-feed.png").relative_to(ROOT)
    pair = (
        "| Rajesh — Bloom Preschool | Vikram — Little Stars Academy |\n"
        "|:---:|:---:|\n"
        f"| ![]({a}){{width=2.4in}} | ![]({b}){{width=2.4in}} |\n\n"
        "*Figure 3.4 — Privacy comparison: two parents, zero overlap.*\n"
    )
    md = md.replace("*(Figure 3.4)*", pair, 1)

    # Anchored single figures.
    for num in ["2.1", "2.2", "2.3", "2.4", "3.2", "3.3"]:
        for anchor in (f"*(Figure {num})*",
                       f"*(Figure {num} — entity-relationship diagram)*"):
            if anchor in md:
                md = md.replace(anchor, fig_md(num), 1)
                break
        else:
            print(f"  .. no anchor found for figure {num}")

    # 2.5-2.8 share one anchor covering the application screenshots.
    grouped = re.search(r"\*\(Figures 2\.5–2\.8[^)]*\)\*", md)
    if grouped:
        md = md.replace(grouped.group(0),
                        "\n\n".join(fig_md(n) for n in ["2.5", "2.6", "2.7", "2.8"]), 1)

    # 5.1 shares its anchor with 5.2, which has not been captured.
    md = md.replace(
        "*(Figure 5.1 — commit history. Figure 5.2 — continuous integration run.)*",
        fig_md("5.1") + "\n\n*(Figure 5.2 — continuous integration run — not yet captured.)*",
        1)

    # Three figures the prose never anchored. Place each after the heading of
    # the section that discusses it.
    for num, heading in [("3.1", "### 3.3.1 Automated suite"),
                         ("3.5", "### 3.3.3 Security verification"),
                         ("4.1", "## 4.1 Execution environment")]:
        if heading in md:
            md = md.replace(heading, heading + "\n\n" + fig_md(num), 1)
        else:
            print(f"  .. heading not found for figure {num}: {heading}")

    STAGE.write_text(md, encoding="utf8")

    cmd = [
        "pandoc", str(STAGE),
        "--from", "markdown+pipe_tables+implicit_figures+raw_attribute",
        "--to", "docx",
        "--reference-doc", str(REF),
        "--resource-path", f"{ROOT}:{FIGDIR}",
        "--toc", "--toc-depth=3",
        "--number-sections=false",
        "-o", str(OUT),
    ]
    print("  $ " + " ".join(cmd[:6]) + " ...")
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr, file=sys.stderr)
        return r.returncode
    if r.stderr.strip():
        print("  pandoc warnings:\n" + r.stderr.strip()[:1500])

    size = OUT.stat().st_size
    print(f"\n  wrote {OUT.relative_to(ROOT)}  ({size:,} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

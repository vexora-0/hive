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

# Figure number -> (file, caption). These captions ARE the List of Figures:
# each is emitted in Word's ImageCaption style and the list is a field Word
# builds from that style, so editing a caption here changes the list. The
# hand-written list in the markdown is replaced at staging and is no longer
# the source of truth for either the wording or the page numbers.
FIGURES = {
    "2.1": ("fig-2.1-architecture.png", "High-level system architecture"),
    "2.2": ("fig-2.2-dataflow.png", "Data flow — photograph upload to parent notification"),
    "2.3": ("fig-2.3-er-diagram.png", "Entity-relationship diagram"),
    "2.4": ("fig-2.4-authz-pipeline.png",
            "Component interaction — authentication and the authorization pipeline"),
    "2.5": ("fig-2.5-upload-tagger.png", "Teacher upload screen with student tagger"),
    "2.6": ("fig-2.6-feed-child-switcher.png", "Parent feed with child switcher"),
    "2.7": ("fig-2.7-order-confirm.png", "Order placement and confirmation"),
    "2.8": ("fig-2.8-admin-dashboard.png", "Administrator dashboard"),
    "3.1": ("fig-3.1-test-suite.png", "Test suite execution — 218 tests passing"),
    "3.2": ("fig-3.2-verify-security.png", "Security verification output — 29 passed, 0 failed, 1 skipped"),
    "3.3": ("fig-3.3-sabotage.png", "Sabotage exercise — targeted tests failing"),
    "3.5": ("fig-3.5-signed-url.png", "Signed URL 200 versus stripped-token 400"),
    "4.1": ("fig-4.1-health.png", "Health endpoint, healthy and degraded"),
    "5.1": ("fig-5.1-commit-history.png", "Commit history"),
    "5.2": ("fig-5.2-ci-run.png",
            "Continuous integration run — lint, typecheck, build and 218 tests, "
            "all blocking"),
}

# Portrait phone captures are 1240x2562. Left unconstrained they run over a
# page each. Widths are in inches and chosen per orientation.
WIDTH = {"portrait": "2.6in", "wide": "6.1in", "diagram": "5.6in"}
PORTRAIT = {"2.5", "2.6", "2.7", "2.8"}
DIAGRAM = {"2.1", "2.2", "2.3", "2.4"}

# Per-figure overrides, for the ones where the default width produces something
# taller than a page. 2.4 is a full sign-up-plus-authorization sequence at an
# aspect of 1.643: at the 5.6in diagram width it renders 9.20in tall against an
# A4 text area of 9.69in, so it fits but pushes its own caption to the next
# page. 4.9in brings it to 8.05in and the caption stays with the figure.
#
# 2.6 is no longer a full-length portrait capture. It was byte-identical to
# 3.4a — the same screenshot serving "parent feed with child switcher" and
# "Rajesh's feed" — so it is cropped to its own subject: the header, the child
# switcher and the day header. That makes the two figures visibly different and
# makes 2.6 a better illustration of what its caption promises. At 1240x1020 it
# is no longer portrait, so the 2.6in portrait width would render it tiny.
WIDTH_OVERRIDE = {"2.4": "4.9in", "2.6": "4.5in"}


def fig_md(num: str) -> str:
    """One figure as a captioned pandoc image."""
    name, caption = FIGURES[num]
    path = FIGDIR / name
    if not path.exists():
        print(f"  !! missing {name} — figure {num} left as a placeholder")
        return f"*(Figure {num} — {caption} — IMAGE MISSING)*"
    kind = "portrait" if num in PORTRAIT else ("diagram" if num in DIAGRAM else "wide")
    width = WIDTH_OVERRIDE.get(num, WIDTH[kind])
    rel = path.relative_to(ROOT)
    return f"![Figure {num} — {caption}]({rel}){{width={width}}}"


def check_commit_stats(md: str) -> None:
    """Warn when §5.1's prose has drifted away from the repository.

    This has now bitten twice. The commit count moves every time anyone commits
    — including the commit that fixes the count — so the prose and Figure 5.1
    silently disagree, and the figure sits directly beneath the number it
    contradicts. Nothing here edits the document; it prints a warning loudly
    enough that the last build before submission cannot miss it.
    """
    stated = re.search(r"^\| Commits \| (\d+) \|$", md, re.M)
    if not stated:
        return
    claimed = int(stated.group(1))

    # §5.1 anchors itself to a commit — "Counted at commit `abc1234`" — because
    # the count moves every time anyone commits, including the commit that
    # corrects it. So the thing to verify is not "does this equal HEAD" but
    # "was this true at the commit the document names", which stays true
    # forever. Figure 5.1 is a capture of that same commit.
    anchor = re.search(r"Counted at commit `([0-9a-f]{7,40})`", md)

    def count(rev: str) -> int | None:
        try:
            r = subprocess.run(["git", "rev-list", "--count", rev],
                               cwd=ROOT, capture_output=True, text=True, check=True)
            return int(r.stdout.strip())
        except Exception:
            return None

    head = count("HEAD")
    if anchor is None:
        if head is not None and claimed != head:
            print(f"  !! §5.1 claims {claimed} commits, HEAD has {head}, and §5.1 names")
            print(f"     no anchor commit. Either anchor it or update the number.")
        return

    sha = anchor.group(1)
    at_anchor = count(sha)
    if at_anchor is None:
        print(f"  !! §5.1 anchors to commit {sha}, which is not in this repository.")
    elif at_anchor != claimed:
        print(f"  !! §5.1 claims {claimed} commits at {sha}, but that commit has {at_anchor}.")
        print(f"     The anchor is what makes the figure and the prose agree — fix one.")
    else:
        drift = (head - at_anchor) if head is not None else 0
        note = f", {drift} commit(s) behind HEAD" if drift else ""
        print(f"  §5.1: {claimed} commits at {sha} — verified{note}")
        if drift:
            print(f"     That is fine — it is a dated snapshot, and Figure 5.1 shows the")
            print(f"     same commit. Re-snap both only if you want the latest number.")


def toc_field(style: str, placeholder: str) -> str:
    """A Word Table-of-Figures field, as raw OOXML.

    Word builds these itself from a paragraph style and fills in real page
    numbers, exactly as it does the contents page. That removes 27 «» page
    placeholders that could not otherwise be filled until the document was
    paginated — and pagination only happens once Word opens it, which is a
    chicken-and-egg the hand-written lists could never escape.

    `w:dirty="true"` makes Word offer to update the field on open. If someone
    dismisses that prompt the placeholder text below is what they see, so it
    says what to do rather than being blank.
    """
    return (
        "```{=openxml}\n"
        '<w:p><w:pPr><w:pStyle w:val="BodyText"/></w:pPr>'
        '<w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r>'
        f'<w:r><w:instrText xml:space="preserve"> TOC \\h \\z \\t "{style},1" </w:instrText></w:r>'
        '<w:r><w:fldChar w:fldCharType="separate"/></w:r>'
        f"<w:r><w:t>{placeholder}</w:t></w:r>"
        '<w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>\n'
        "```\n"
    )


def main() -> int:
    if not REF.exists():
        print(f"error: reference doc missing at {REF}", file=sys.stderr)
        return 1

    md = SRC.read_text(encoding="utf8")
    check_commit_stats(md)

    # Drop the hand-written TABLE OF CONTENTS. pandoc --toc emits a real one
    # with real page numbers; keeping both gave the document two, the second
    # of which was a table of «» placeholders. The LIST OF FIGURES and LIST OF
    # TABLES stay — pandoc does not generate those, the template requires them,
    # and their page column is filled once pagination is final.
    md = re.sub(r"\n# TABLE OF CONTENTS\n.*?(?=\n# LIST OF FIGURES\n)", "\n", md, flags=re.S)

    # Strip the working note under the title. It is guidance to whoever is
    # assembling the document — "«…» marks what I cannot supply" — and has no
    # business in a submitted report. Also strip the FORMATTING CHECKLIST at the
    # end, which is instructions to the typesetter, not content.
    # `>.*` not `> .*` — the blockquote contains bare `>` separator lines, and
    # requiring the space stops the match at the first one.
    md = re.sub(r"(^# Hive — Capstone Report\n)\n(>.*\n)+", r"\1", md, flags=re.M)
    md = re.sub(r"\n# FORMATTING CHECKLIST\n.*?(?=\n# |\Z)", "\n", md, flags=re.S)

    # Table captions -> a real Word caption style, so the LIST OF TABLES can be
    # generated from them. They are plain bold paragraphs in the markdown, which
    # Word cannot collect.
    md = re.sub(
        r"^\*\*(Table \d+\.\d+ —[^\n]*?)\*\*(\s*\*\([^\n]*\)\*)?$",
        lambda m: '::: {custom-style="TableCaption"}\n'
                  + m.group(1) + (m.group(2).strip() if m.group(2) else "")
                  + "\n:::",
        md, flags=re.M)

    # Replace the two hand-written lists with fields Word populates itself.
    md = re.sub(r"(# LIST OF FIGURES\n\n).*?(?=\n# LIST OF TABLES\n)",
                lambda m: m.group(1) + toc_field(
                    "ImageCaption",
                    "Update fields in Word (select all, then F9) to build this list."),
                md, flags=re.S)
    md = re.sub(r"(# LIST OF TABLES\n\n).*?(?=\n# LIST OF ABBREVIATIONS\n)",
                lambda m: m.group(1) + toc_field(
                    "TableCaption",
                    "Update fields in Word (select all, then F9) to build this list."),
                md, flags=re.S)

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

    # 5.1 and 5.2 share one anchor.
    md = md.replace(
        "*(Figure 5.1 — commit history. Figure 5.2 — continuous integration run.)*",
        fig_md("5.1") + "\n\n" + fig_md("5.2"),
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
        "--from", "markdown+pipe_tables+implicit_figures+raw_attribute+fenced_divs",
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

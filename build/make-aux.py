#!/usr/bin/env python3
"""
Render the two standalone capstone deliverables to .docx.

    python3 build/make-aux.py

  docs/capstone/SUMMARY.md      -> docs/capstone/Hive-Summary.docx
  docs/capstone/USER-MANUAL.md  -> docs/capstone/Hive-User-Manual.docx

Both are uploaded to a shared Drive folder on their own, away from the report,
so they are rendered rather than handed over as markdown: the summary is what a
viva supervisor reads before the viva, and the manual is read by someone who is
not going to clone a repository to see a screenshot.

They share build/hive-reference.docx with the report - Times New Roman, 12pt
body, 14pt headings, 1.5 line spacing, 1 inch margins - so the submission set
looks like one set of documents rather than three unrelated ones.
"""

import re
import subprocess
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from docx_tables import fit_tables

ROOT = Path(__file__).resolve().parent.parent
REF = ROOT / "build/hive-reference.docx"
FIGDIR = ROOT / "docs/capstone/screenshots/figures"

DOCS = [
    ("docs/capstone/SUMMARY.md", "Hive-Summary.docx", False),
    ("docs/capstone/USER-MANUAL.md", "Hive-User-Manual.docx", True),
]

def constrain_images(md: str) -> str:
    """Give every image an explicit width.

    The screenshots are 1240px wide phone captures. Unconstrained, pandoc sizes
    them from their pixel dimensions and a portrait capture takes more than a
    page each, which turns a fourteen-screenshot manual into forty pages of
    mostly white.
    """
    return re.sub(r"(!\[[^\]]*\]\([^)]+\))(?!\{)", r"\1{width=2.6in}", md)


def check(md: str, src: Path) -> None:
    """The house rules, checked rather than assumed.

    Image paths are resolved relative to the markdown file, which is how they
    are written and how they render on GitHub. pandoc is given the same
    directory on its resource path so the two agree.
    """
    for bad, name in [("\u2014", "em dash"), ("\u2013", "en dash"),
                      ("\u00a7", "section sign")]:
        n = md.count(bad)
        if n:
            print(f"  !! {src.name}: {n} {name}(s)")
    for m in re.finditer(r"!\[[^\]]*\]\(([^)]+)\)", md):
        if not (src.parent / m.group(1)).exists():
            print(f"  !! {src.name}: image not found - {m.group(1)}")


def main() -> int:
    if not REF.exists():
        print(f"error: reference doc missing at {REF}", file=sys.stderr)
        return 1

    built = 0
    for src_rel, out_name, wants_toc in DOCS:
        src = ROOT / src_rel
        if not src.exists():
            print(f"  .. {src_rel} not written yet, skipped")
            continue

        md = src.read_text(encoding="utf8")
        check(md, src)
        md = constrain_images(md)

        stage = ROOT / "build" / (src.stem.lower() + "-staged.md")
        stage.write_text(md, encoding="utf8")

        out = ROOT / "docs/capstone" / out_name
        cmd = [
            "pandoc", str(stage),
            # -smart, so a literal double hyphen in a command stays two hyphens
            "--from", "markdown-smart+pipe_tables+implicit_figures+raw_attribute",
            "--to", "docx",
            "--reference-doc", str(REF),
            "--resource-path", f"{src.parent}:{ROOT}:{FIGDIR}",
            "--number-sections=false",
            "-o", str(out),
        ]
        if wants_toc:
            cmd += ["--toc", "--toc-depth=2"]

        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode != 0:
            print(r.stderr, file=sys.stderr)
            return r.returncode
        if r.stderr.strip():
            print("  pandoc:", r.stderr.strip()[:400])

        n = fit_tables(out)
        z = zipfile.ZipFile(out)
        imgs = sum(1 for n_ in z.namelist() if n_.startswith("word/media/"))
        print(f"  {out.relative_to(ROOT)}  ({out.stat().st_size:,} bytes, "
              f"{imgs} image(s), {n} table(s) sized)")
        built += 1

    if not built:
        print("  nothing to build")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

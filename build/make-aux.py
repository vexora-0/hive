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

ROOT = Path(__file__).resolve().parent.parent
REF = ROOT / "build/hive-reference.docx"
FIGDIR = ROOT / "docs/capstone/screenshots/figures"

DOCS = [
    ("docs/capstone/SUMMARY.md", "Hive-Summary.docx", False),
    ("docs/capstone/USER-MANUAL.md", "Hive-User-Manual.docx", True),
]

# A4 with one inch margins, in twips. Same constant the report build uses.
PAGE = 9026


def fit_tables(docx_path: Path) -> int:
    """Rescale any table wider than the printable area.

    pandoc sizes columns from content length with no page constraint, so a
    table of prose cells lands well over the page width and Word then squeezes
    it into three words per line.
    """
    z = zipfile.ZipFile(docx_path)
    parts = {n: z.read(n) for n in z.namelist()}
    z.close()
    doc = parts["word/document.xml"].decode("utf8")
    fixed = 0

    def rescale(m):
        nonlocal fixed
        grid = m.group(0)
        widths = [int(w) for w in re.findall(r'w:w="(\d+)"', grid)]
        total = sum(widths)
        if not total or total <= PAGE:
            return grid
        scaled, run = [], 0
        for w in widths[:-1]:
            v = max(360, round(w * PAGE / total))
            scaled.append(v)
            run += v
        scaled.append(max(360, PAGE - run))
        fixed += 1
        out = grid
        for old, new in zip(widths, scaled):
            out = re.sub(r'w:w="%d"' % old, 'w:w="%d"' % new, out, count=1)
        return out

    doc = re.sub(r"<w:tblGrid>.*?</w:tblGrid>", rescale, doc, flags=re.S)
    doc = re.sub(r"<w:tblW[^/]*/>", '<w:tblW w:w="5000" w:type="pct"/>', doc)
    doc = re.sub(r"<w:tblLayout[^/]*/>", '<w:tblLayout w:type="autofit"/>', doc)
    parts["word/document.xml"] = doc.encode("utf8")

    import tempfile, shutil
    tmp = tempfile.mktemp(suffix=".docx")
    zo = zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED)
    for n, data in parts.items():
        zo.writestr(n, data)
    zo.close()
    shutil.move(tmp, docx_path)
    return fixed


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
              f"{imgs} image(s), {n} table(s) rescaled)")
        built += 1

    if not built:
        print("  nothing to build")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

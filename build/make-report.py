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
import sys as _sys
from pathlib import Path as _Path
_sys.path.insert(0, str(_Path(__file__).resolve().parent))
from docx_tables import fit_tables
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
    "2.2": ("fig-2.2-dataflow.png", "Data flow - photograph upload to parent notification"),
    "2.3": ("fig-2.3-er-diagram.png", "Entity-relationship diagram"),
    "2.4": ("fig-2.4-authz-pipeline.png",
            "Component interaction - authentication and the authorization pipeline"),
    "2.5": ("fig-2.5-upload-tagger.png", "Teacher upload screen with student tagger"),
    "2.6": ("fig-2.6-feed-child-switcher.png", "Parent feed with child switcher"),
    # The capture is the order *detail* sheet for a delivered order, not the
    # placement sheet - that is fig-2.7a. Table 4.2 always described it
    # correctly; only the caption said otherwise.
    "2.7": ("fig-2.7-order-confirm.png",
            "Print order - line items, fulfilment stage and total in rupees"),
    "2.8": ("fig-2.8-admin-dashboard.png", "Administrator dashboard"),
    "3.1": ("fig-3.1-test-suite.png",
            "Test suite execution - 247 tests across 9 files, with 117 mobile unit tests"),
    "3.2": ("fig-3.2-verify-security.png", "Security verification output - 29 passed, 0 failed, 1 skipped"),
    "3.3": ("fig-3.3-sabotage.png", "Sabotage exercise - targeted tests failing"),
    "3.5": ("fig-3.5-signed-url.png", "Signed URL 200 versus stripped-token 400"),
    "4.1": ("fig-4.1-health.png", "Health endpoint, healthy and degraded"),
    "5.1": ("fig-5.1-commit-history.png", "Commit history"),
    "5.2": ("fig-5.2-ci-run.png",
            "Continuous integration run - lint, typecheck, build and the 247-test "
            "suite, all blocking"),
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
        print(f"  !! missing {name} - figure {num} left as a placeholder")
        return f"*(Figure {num} - {caption} - IMAGE MISSING)*"
    kind = "portrait" if num in PORTRAIT else ("diagram" if num in DIAGRAM else "wide")
    width = WIDTH_OVERRIDE.get(num, WIDTH[kind])
    rel = path.relative_to(ROOT)
    return f"![Figure {num} - {caption}]({rel}){{width={width}}}"


def place_figure(md: str, num: str, anchor: str) -> tuple[str, bool]:
    """Swap an anchor for the figure, always as a paragraph of its own.

    pandoc's `implicit_figures` only fires for an image that is alone in its
    paragraph. Fold one into surrounding prose and it stays an inline run: no
    caption paragraph is emitted, and since the LIST OF FIGURES is a field that
    collects caption paragraphs, the figure disappears from the list while
    still sitting in the body. That is silent - the build succeeds, the image
    is there, and only the list is short.

    Two anchor shapes exist in the markdown and they need different handling:

      *(Figure 2.1)*                     - alone on its line; swap in place
      "...succeeding. *(Figure 3.1)*"    - trailing a sentence; strip it and
                                           emit the figure after the paragraph

    The second used to be handled by inserting after a hard-coded heading
    instead, which broke the moment the heading stopped being followed by a
    blank line.
    """
    fig = fig_md(num)
    esc = re.escape(anchor)

    m = re.search(rf"^[ \t]*{esc}[ \t]*$", md, re.M)
    if m:
        return md[:m.start()] + fig + md[m.end():], True

    m = re.search(rf"[ \t]*{esc}[ \t]*(?=\n|$)", md)
    if m:
        end = md.find("\n\n", m.end())
        end = len(md) if end == -1 else end
        return md[:m.start()] + md[m.end():end] + "\n\n" + fig + md[end:], True

    return md, False


def check_figures(docx_path: Path) -> None:
    """Confirm every figure really became a figure.

    Counting images is not enough - a folded-in image is still an image. What
    the LIST OF FIGURES needs is a caption paragraph in ImageCaption style, so
    that is what gets counted, and any figure whose caption is missing is named.
    """
    import zipfile
    z = zipfile.ZipFile(docx_path)
    doc = z.read("word/document.xml").decode("utf8")

    # A field asks for a style by name; the paragraphs carry a styleId. When
    # those disagree the list comes back empty in Word with nothing to see
    # here - no error, no warning, just a heading over blank space.
    styles = z.read("word/styles.xml").decode("utf8")
    by_id = {}
    for m in re.finditer(r'<w:style [^>]*w:styleId="([^"]*)"[^>]*>(.*?)</w:style>',
                         styles, re.S):
        nm = re.search(r'<w:name w:val="([^"]*)"', m.group(2))
        by_id[m.group(1)] = nm.group(1) if nm else None
    names = set(by_id.values())
    for asked in re.findall(r'TOC \\h \\z \\t &?q?u?o?t?;?"?([^",]+)', doc):
        if asked not in names:
            print(f"  !! no style is named {asked!r}, so that list will build empty")
            print(f"     styles present: {sorted(n for n in names if n and 'aption' in n)}")
    captions = [
        "".join(re.findall(r"<w:t[^>]*>(.*?)</w:t>", p, re.S))
        for p in re.findall(r"<w:p\b.*?</w:p>", doc, re.S)
        if 'w:pStyle w:val="ImageCaption"' in p
    ]
    drawings = len(re.findall(r"<w:drawing>", doc))
    expected = sorted(set(FIGURES) | {"3.4"}, key=lambda n: [int(x) for x in n.split(".")])
    missing = [n for n in expected
               if not any(c.startswith(f"Figure {n} ") for c in captions)]

    print(f"  {drawings} image(s), {len(captions)} of {len(expected)} in the LIST OF FIGURES")
    if missing:
        print(f"  !! not in the list: {', '.join(missing)}")
        print("     The image is on the page but carries no ImageCaption paragraph,")
        print("     so the field cannot collect it. Usually means the image ended up")
        print("     sharing a paragraph with prose or with another image.")



def check_commit_stats(md: str) -> None:
    """Warn when §5.1's prose has drifted away from the repository.

    This has now bitten twice. The commit count moves every time anyone commits
    — including the commit that fixes the count — so the prose and Figure 5.1
    silently disagree, and the figure sits directly beneath the number it
    contradicts. Nothing here edits the document; it prints a warning loudly
    enough that the last build before submission cannot miss it.
    """
    stated = re.search(r"^\|\s*Commits\s*\|\s*(\d+)\s*\|", md, re.M)
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
        print(f"     The anchor is what makes the figure and the prose agree - fix one.")
    else:
        drift = (head - at_anchor) if head is not None else 0
        note = f", {drift} commit(s) behind HEAD" if drift else ""
        print(f"  §5.1: {claimed} commits at {sha} - verified{note}")
        if drift:
            print(f"     That is fine - it is a dated snapshot, and Figure 5.1 shows the")
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

    The `\t` switch names a style by its **display name**, not its styleId, and
    the two differ in the reference doc: pandoc captions its figures in the
    style whose id is `ImageCaption` but whose name is `Image Caption`. Asking
    for "ImageCaption" therefore matches nothing at all, and the list comes back
    empty however many captions are on the page - which is what it did. Pass the
    name, and keep the fenced divs below passing the name too, so pandoc reuses
    that same style rather than minting a near-duplicate beside it.
    """
    return field(f'TOC \\h \\z \\t "{style},1"', placeholder)


def field(instr: str, placeholder: str) -> str:
    """One Word field, as raw OOXML, dirty so Word offers to update it."""
    return (
        "```{=openxml}\n"
        '<w:p><w:pPr><w:pStyle w:val="BodyText"/></w:pPr>'
        '<w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r>'
        f'<w:r><w:instrText xml:space="preserve"> {instr} </w:instrText></w:r>'
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

    # The contents page is built here rather than by `pandoc --toc`, which
    # always emits it as the first thing in the document - so the report opened
    # on a 73-entry contents page and the cover page came second. Review asked
    # for it to move inside, behind the cover page, the declaration and the
    # supervisor sign-off, which is where the markdown already has it.
    #
    # The heading is emitted in "TOC Heading" rather than Heading 1 for one
    # reason: that style carries outlineLvl 9, so the contents page does not
    # list itself. The reference doc's copy of it has been made to inherit
    # Heading 1 so it still looks like every other front-matter heading.
    md = re.sub(
        r"\n# TABLE OF CONTENTS\n.*?(?=\n# LIST OF FIGURES\n)",
        lambda m: "\n" + '::: {custom-style="TOC Heading"}\nTABLE OF CONTENTS\n:::\n\n'
                  + field('TOC \\o "1-3" \\h \\z \\u',
                          "Update fields in Word (select all, then F9) to build this list.")
                  + "\n",
        md, flags=re.S)

    # Strip the working note under the title. It is guidance to whoever is
    # assembling the document — "«…» marks what I cannot supply" — and has no
    # business in a submitted report. Also strip the FORMATTING CHECKLIST at the
    # end, which is instructions to the typesetter, not content.
    # `>.*` not `> .*` — the blockquote contains bare `>` separator lines, and
    # requiring the space stops the match at the first one.
    md = re.sub(r"(^# Hive - Capstone Report\n)\n(>.*\n)+", r"\1", md, flags=re.M)
    md = re.sub(r"\n# FORMATTING CHECKLIST\n.*?(?=\n# |\Z)", "\n", md, flags=re.S)

    # Table captions -> a real Word caption style, so the LIST OF TABLES can be
    # generated from them. They are plain bold paragraphs in the markdown, which
    # Word cannot collect.
    md = re.sub(
        r"^\*\*(Table \d+\.\d+ -[^\n]*?)\*\*(\s*\*\([^\n]*\)\*)?$",
        lambda m: '::: {custom-style="Table Caption"}\n'
                  # strip any residual bold markers: a caption that arrived from a
                  # Google Docs round-trip can carry split spans, and they render
                  # as literal asterisks in Word
                  + (m.group(1) + (m.group(2).strip() if m.group(2) else "")).replace("**", "")
                  + "\n:::",
        md, flags=re.M)

    # Replace the two hand-written lists with fields Word populates itself.
    md = re.sub(r"(# LIST OF FIGURES\n)\n*.*?(?=\n# LIST OF TABLES\n)",
                lambda m: m.group(1) + "\n" + toc_field(
                    "Image Caption",
                    "Update fields in Word (select all, then F9) to build this list."),
                md, flags=re.S)
    md = re.sub(r"(# LIST OF TABLES\n)\n*.*?(?=\n# LIST OF ABBREVIATIONS\n)",
                lambda m: m.group(1) + "\n" + toc_field(
                    "Table Caption",
                    "Update fields in Word (select all, then F9) to build this list."),
                md, flags=re.S)

    # 3.4 first - its anchor is a plain *(Figure 3.4)* and the pair needs a table.
    # The caption is emitted in ImageCaption explicitly. pandoc gives that style
    # to the captions it generates itself, and the LIST OF FIGURES is a field
    # collecting exactly that style, so a hand-written italic line here would
    # put 3.4 on the page and leave it out of the list.
    a = (FIGDIR / "fig-3.4a-rajesh-feed.png").relative_to(ROOT)
    b = (FIGDIR / "fig-3.4b-vikram-feed.png").relative_to(ROOT)
    pair = (
        "| Rajesh - Bloom Preschool | Vikram - Little Stars Academy |\n"
        "|:---:|:---:|\n"
        f"| ![]({a}){{width=2.4in}} | ![]({b}){{width=2.4in}} |\n\n"
        '::: {custom-style="Image Caption"}\n'
        "Figure 3.4 - Privacy comparison - two parents, zero overlap\n"
        ":::\n"
    )
    md = md.replace("*(Figure 3.4)*", pair, 1)

    # Anchored single figures.
    for num in ["2.1", "2.2", "2.3", "2.4", "3.1", "3.2", "3.3", "4.1"]:
        for anchor in (f"*(Figure {num})*",
                       f"*(Figure {num} - entity-relationship diagram)*"):
            md, placed = place_figure(md, num, anchor)
            if placed:
                break
        else:
            print(f"  .. no anchor found for figure {num}")

    # 2.5-2.8 share one anchor covering the application screenshots.
    grouped = re.search(r"\*\(Figures 2\.5-2\.8[^)]*\)\*", md)
    if grouped:
        md = md.replace(grouped.group(0),
                        "\n\n".join(fig_md(n) for n in ["2.5", "2.6", "2.7", "2.8"]), 1)

    # 5.1 and 5.2 share one anchor.
    md = md.replace(
        "*(Figure 5.1 - commit history. Figure 5.2 - continuous integration run.)*",
        fig_md("5.1") + "\n\n" + fig_md("5.2"),
        1)

    # 3.5 is the one figure the prose never anchors. It belongs with 3.2 - both
    # are security verification evidence - so hang it off 3.2 rather than off a
    # heading, which is the fragile thing: a heading gets renamed or loses its
    # trailing blank line and the figure silently stops being a figure.
    marker = fig_md("3.2")
    if marker in md:
        md = md.replace(marker, marker + "\n\n" + fig_md("3.5"), 1)
    else:
        print("  .. figure 3.2 not placed, so 3.5 has nothing to follow")

    STAGE.write_text(md, encoding="utf8")

    cmd = [
        "pandoc", str(STAGE),
        "--from", "markdown-smart+pipe_tables+implicit_figures+raw_attribute+fenced_divs",
        "--to", "docx",
        "--reference-doc", str(REF),
        "--resource-path", f"{ROOT}:{FIGDIR}",
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

    print(f"  {fit_tables(OUT)} table(s) given a computed, fixed grid")

    check_figures(OUT)

    size = OUT.stat().st_size
    print(f"\n  wrote {OUT.relative_to(ROOT)}  ({size:,} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

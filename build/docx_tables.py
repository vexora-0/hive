"""Table sizing for the generated .docx files.

Shared by make-report.py and make-aux.py so the two cannot drift.

Two things had to be understood before this worked.

**pandoc gives every column the same width.** A five-column table comes out
1584 twips across the board, so there is no content-derived proportion to
preserve; the widths have to be computed here from scratch.

**Word was throwing the grid away.** The tables were emitted with
`tblLayout=autofit`, which lets Word re-derive column widths from content when
it opens the document. That is what produced the review comments "T-1 is not
together, 1st col" and "first col data not aligned": Word decided a column of
short identifiers needed 530 twips, which is 0.37 inch, and since "T-1" has no
space in it to break at, it broke it mid-token. Setting a better grid under
autofit would have changed nothing, because Word was not reading it.

So the layout is fixed and the widths are computed from two measurements per
column: the longest run of characters with no break opportunity, which is the
width below which the column *cannot* work, and the average amount of content,
which is how the remaining space is shared out.
"""

import re

# A4, one inch margins.
PAGE = 9026

# 12pt Times New Roman. An em is 240 twips and the average glyph is a little
# under half of that; 130 is deliberately generous, because under-estimating
# re-creates the defect this exists to fix while over-estimating costs a column
# a few points it can spare.
PER_CHAR = 130

# Word's default cell margins, 108 twips a side, plus slack.
CELL_PADDING = 300

# No column below this. And no *text* column may demand more than the cap on
# the strength of one long token: a 70-character defect description would claim
# the whole page, and that column has plenty of spaces to break at. Images are
# exempt from the cap, since an image genuinely cannot wrap.
MIN_WIDTH = 620
MAX_TOKEN_CLAIM = 2400

_TEXT = re.compile(r"<w:t(?: [^>]*)?>(.*?)</w:t>", re.S)
_CELL = re.compile(r"<w:tc>.*?</w:tc>", re.S)
_ROW = re.compile(r"<w:tr\b.*?</w:tr>", re.S)

# `<w:t[^>]*>` looks right and is not: it also matches <w:tcPr>, <w:tblW> and
# every other w:t-prefixed tag, so cell text comes back as XML attribute soup
# and the longest "token" becomes something like w:rsidR="000358FA". The tag
# name has to be followed by a space or the closing bracket.


def _cell_demand(tc: str) -> tuple[int, int]:
    """(width the cell cannot go below, how much content it holds)."""
    text = " ".join(_TEXT.findall(tc))
    longest = max((len(t) for t in text.split()), default=0)
    floor = min(MAX_TOKEN_CLAIM, max(MIN_WIDTH, longest * PER_CHAR + CELL_PADDING))
    # An image cannot wrap at all, so its own width is a hard floor. EMU to
    # twips is a division by 635.
    for emu in re.findall(r'<wp:extent cx="(\d+)"', tc):
        floor = max(floor, int(emu) // 635 + CELL_PADDING)
    return floor, len(text)


def _measure(tbl: str, ncols: int) -> tuple[list[int], list[float]]:
    floors = [MIN_WIDTH] * ncols
    chars = [0] * ncols
    rows = 0
    for row in _ROW.findall(tbl):
        rows += 1
        for i, tc in enumerate(_CELL.findall(row)):
            if i >= ncols:
                break
            floor, n = _cell_demand(tc)
            floors[i] = max(floors[i], floor)
            chars[i] += n
    weights = [c / rows if rows else 1 for c in chars]
    if not any(weights):
        weights = [1.0] * ncols
    return floors, weights


def _fit(floors: list[int], weights: list[float]) -> list[int]:
    """Share the page out by content, but never below a column's floor."""
    if sum(floors) >= PAGE:
        # Every column is already at its limit and they still do not fit.
        # Scale them down together and let Word wrap what it must.
        scaled = [max(1, round(f * PAGE / sum(floors))) for f in floors]
        scaled[0] += PAGE - sum(scaled)
        return scaled

    total_w = sum(weights) or 1
    out = [max(f, round(PAGE * w / total_w)) for f, w in zip(floors, weights)]

    excess = sum(out) - PAGE
    if excess > 0:
        slack = [o - f for o, f in zip(out, floors)]
        pool = sum(slack)
        taken = 0
        for i in range(len(out) - 1):
            t = round(excess * slack[i] / pool) if pool else 0
            out[i] -= t
            taken += t
        out[-1] -= excess - taken
    elif excess < 0:
        # Spend what is left on the column holding the most content.
        out[weights.index(max(weights))] -= excess
    return out


def fit_tables(docx_path) -> int:
    """Give every table a computed, fixed grid. Returns the number changed."""
    import zipfile, shutil, tempfile

    z = zipfile.ZipFile(docx_path)
    parts = {n: z.read(n) for n in z.namelist()}
    z.close()
    doc = parts["word/document.xml"].decode("utf8")
    changed = 0

    def handle(m):
        nonlocal changed
        tbl = m.group(0)
        grid = re.search(r"<w:tblGrid>.*?</w:tblGrid>", tbl, re.S)
        if not grid:
            return tbl
        ncols = len(re.findall(r'w:w="(\d+)"', grid.group(0)))
        if not ncols:
            return tbl

        widths = _fit(*_measure(tbl, ncols))
        changed += 1

        new_grid = "<w:tblGrid>" + "".join(
            '<w:gridCol w:w="%d"/>' % w for w in widths) + "</w:tblGrid>"
        tbl = tbl.replace(grid.group(0), new_grid, 1)

        # Under a fixed layout Word reads the grid, but a cell carrying
        # `w:type="auto"` can still argue with it. State each cell's width too.
        def row(rm):
            i = [0]

            def cell(cm):
                tc = cm.group(0)
                w = widths[i[0]] if i[0] < ncols else widths[-1]
                i[0] += 1
                return re.sub(r'<w:tcW[^/]*/>',
                              '<w:tcW w:w="%d" w:type="dxa"/>' % w, tc, count=1)

            return _CELL.sub(cell, rm.group(0))

        return _ROW.sub(row, tbl)

    doc = re.sub(r"<w:tbl>.*?</w:tbl>", handle, doc, flags=re.S)
    # Four of the tables carry no <w:tblLayout> at all, and an absent one means
    # autofit - so replacing the element only where it already exists would
    # have left those four for Word to re-derive, which is the whole defect.
    # Rewrite tblW and tblLayout together: tblPr is an ordered sequence
    # (tblStyle, tblW, tblLayout, tblLook), so emitting the pair in place of
    # tblW puts a missing tblLayout exactly where the schema wants it.
    doc = re.sub(r'<w:tblW[^/]*/>\s*(?:<w:tblLayout[^/]*/>)?',
                 '<w:tblW w:w="%d" w:type="dxa"/><w:tblLayout w:type="fixed"/>' % PAGE,
                 doc)

    parts["word/document.xml"] = doc.encode("utf8")
    tmp = tempfile.mktemp(suffix=".docx")
    zo = zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED)
    for n, d in parts.items():
        zo.writestr(n, d)
    zo.close()
    shutil.move(tmp, docx_path)
    return changed

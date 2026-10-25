/** A piece of text as a PDF reader returns it: where it starts on the page and how wide it is. */
export interface TextFragment {
  page: number;
  /** Points from the left edge of the page. */
  x: number;
  /** Points from the bottom edge of the page: a higher y is higher on the page. */
  y: number;
  width: number;
  text: string;
}

export interface PdfCell {
  x: number;
  text: string;
}

/** One printed row: its cells left to right, and their text joined by tabs. */
export interface PdfLine {
  page: number;
  y: number;
  cells: PdfCell[];
  text: string;
}

/** Fragments within this many points of height are on the same row. */
const SAME_ROW = 3;
/** Fragments closer than this many points belong to the same cell; further apart is a column. */
const SAME_CELL = 3;

const normalise = (text: string) => text.replace(/\s+/g, " ").trim();

/**
 * Rebuilds the rows and columns of a printed page from the text fragments of a PDF. A PDF stores
 * text as pieces placed at coordinates, not as lines: this puts the pieces back in reading order
 * and keeps each column as its own cell, so a value can be read from the column it is printed in.
 */
export function groupIntoLines(fragments: TextFragment[]): PdfLine[] {
  const sorted = fragments
    .map((fragment) => ({ ...fragment, text: normalise(fragment.text) }))
    .filter((fragment) => fragment.text !== "")
    .sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);

  const rows: TextFragment[][] = [];
  for (const fragment of sorted) {
    const row = rows.at(-1);
    if (row && row[0].page === fragment.page && row[0].y - fragment.y <= SAME_ROW) {
      row.push(fragment);
    } else {
      rows.push([fragment]);
    }
  }

  return rows.map((row) => {
    const cells: (PdfCell & { end: number })[] = [];
    for (const fragment of row.sort((a, b) => a.x - b.x)) {
      const cell = cells.at(-1);
      const gap = cell ? fragment.x - cell.end : Infinity;
      if (cell && gap < SAME_CELL) {
        cell.text += gap > 0.5 ? ` ${fragment.text}` : fragment.text;
        cell.end = Math.max(cell.end, fragment.x + fragment.width);
      } else {
        cells.push({ x: fragment.x, text: fragment.text, end: fragment.x + fragment.width });
      }
    }
    const clean = cells.map(({ x, text }) => ({ x, text: normalise(text) }));
    return {
      page: row[0].page,
      y: row[0].y,
      cells: clean,
      text: clean.map((cell) => cell.text).join("\t"),
    };
  });
}

// Pure text-layout reconstruction, kept separate from the pdfjs-coupled rendering
// in pdf.ts so it can be unit-tested without a DOM, canvas, or worker.

export interface PositionedTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
}

const GARBLE_THRESHOLD = 0.3;
const Y_TOLERANCE = 2;
const SPACE_PER_UNIT = 4;

// True when a page's extracted text is mostly non-printable — a signal that text
// extraction failed and the page should fall back to image rendering. Counts
// ASCII, Latin-1, and common currency glyphs as printable.
export function isGarbled(text: string): boolean {
  const stripped = text.replace(/\s/g, '');
  if (stripped.length === 0) return true;
  const printable = stripped.replace(/[\x20-\x7E\xA0-\xFF\u20AC]/g, '');
  return printable.length / stripped.length > GARBLE_THRESHOLD;
}

// Reconstructs an approximate text layout from positioned PDF text items: groups
// items into rows by Y proximity, then lays each row out left-to-right with
// proportional whitespace so column alignment survives for the model to read.
export function reconstructLayout(items: PositionedTextItem[]): string {
  if (items.length === 0) return '';

  // Sort by Y descending (top of page first in PDF coordinate space)
  const sorted = [...items].sort((a, b) => b.y - a.y);

  // Group into rows: walk sorted list, start new row when Y gap > tolerance
  const rows: PositionedTextItem[][] = [];
  let currentRow: PositionedTextItem[] = [sorted[0]];
  let currentY = sorted[0].y;

  for (let i = 1; i < sorted.length; i++) {
    if (Math.abs(sorted[i].y - currentY) > Y_TOLERANCE) {
      rows.push(currentRow);
      currentRow = [sorted[i]];
      currentY = sorted[i].y;
    } else {
      currentRow.push(sorted[i]);
    }
  }
  rows.push(currentRow);

  // For each row: sort by X, reconstruct with proportional spacing
  const lines: string[] = [];
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);
    let line = '';
    for (let i = 0; i < row.length; i++) {
      if (i > 0) {
        const gap = row[i].x - (row[i - 1].x + row[i - 1].width);
        const spaces = Math.max(1, Math.round(gap / SPACE_PER_UNIT));
        line += ' '.repeat(spaces);
      }
      line += row[i].str;
    }
    lines.push(line);
  }

  return lines.join('\n');
}

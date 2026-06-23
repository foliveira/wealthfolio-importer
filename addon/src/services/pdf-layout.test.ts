import { describe, it, expect } from 'vitest';
import { isGarbled, reconstructLayout, type PositionedTextItem } from './pdf-layout';

// --- isGarbled ---

describe('isGarbled', () => {
  it('treats empty and whitespace-only text as garbled', () => {
    expect(isGarbled('')).toBe(true);
    expect(isGarbled('   ')).toBe(true);
    expect(isGarbled('\n\t  \r\n')).toBe(true);
  });

  it('treats clean ASCII as not garbled', () => {
    expect(isGarbled('AAPL 10 shares $1500')).toBe(false);
  });

  it('treats mostly non-printable text as garbled', () => {
    expect(isGarbled('\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00')).toBe(true);
    expect(isGarbled('����������')).toBe(true);
  });

  it('treats currency glyphs as printable', () => {
    // € (€) is explicitly allowed; £ and ¥ fall in the \xA0-\xFF range.
    expect(isGarbled('€ £ ¥ € £ ¥')).toBe(false);
  });

  it('uses a strict > 0.3 threshold (boundary is not garbled)', () => {
    // 10 non-whitespace chars, exactly 3 non-printable → 3/10 = 0.3, not > 0.3.
    expect(isGarbled('aaaaaaa\x00\x00\x00')).toBe(false);
    // One more non-printable → 4/10 = 0.4 > 0.3.
    expect(isGarbled('aaaaaa\x00\x00\x00\x00')).toBe(true);
  });
});

// --- reconstructLayout ---

function item(str: string, x: number, y: number, width: number): PositionedTextItem {
  return { str, x, y, width };
}

describe('reconstructLayout', () => {
  it('returns an empty string for no items', () => {
    expect(reconstructLayout([])).toBe('');
  });

  it('keeps items with the same y on one line, sorted by x', () => {
    const result = reconstructLayout([
      item('B', 100, 50, 10),
      item('A', 0, 50, 10),
    ]);
    expect(result).not.toContain('\n');
    expect(result.indexOf('A')).toBeLessThan(result.indexOf('B'));
  });

  it('keeps items within the y tolerance (2) on the same line', () => {
    const result = reconstructLayout([
      item('A', 0, 50, 10),
      item('B', 100, 52, 10), // 2 apart → within tolerance
    ]);
    expect(result).not.toContain('\n');
  });

  it('splits items whose y differs by more than the tolerance', () => {
    const result = reconstructLayout([
      item('A', 0, 50, 10),
      item('B', 0, 53, 10), // 3 apart → > tolerance
    ]);
    expect(result.split('\n')).toHaveLength(2);
  });

  it('orders rows top-of-page first (higher y first in PDF coords)', () => {
    const result = reconstructLayout([
      item('LOW', 0, 10, 10),
      item('HIGH', 0, 100, 10),
    ]);
    const lines = result.split('\n');
    expect(lines[0]).toBe('HIGH');
    expect(lines[1]).toBe('LOW');
  });

  it('emits more spaces for a larger x-gap', () => {
    // item at x=0 width=10 ends at 10; next at x=30 → gap 20 → round(20/4)=5 spaces.
    const result = reconstructLayout([
      item('A', 0, 50, 10),
      item('B', 30, 50, 10),
    ]);
    expect(result).toBe('A' + ' '.repeat(5) + 'B');
  });

  it('emits fewer spaces for a small x-gap', () => {
    // gap 4 → round(4/4)=1 space.
    const small = reconstructLayout([
      item('A', 0, 50, 10),
      item('B', 14, 50, 10),
    ]);
    // gap 20 → 5 spaces.
    const large = reconstructLayout([
      item('A', 0, 50, 10),
      item('B', 30, 50, 10),
    ]);
    const smallSpaces = small.length - 2;
    const largeSpaces = large.length - 2;
    expect(smallSpaces).toBeLessThan(largeSpaces);
    expect(smallSpaces).toBe(1);
  });

  it('uses exactly one space for overlapping/negative gaps', () => {
    // item A ends at 100; B starts at 5 → gap is negative → clamps to 1 space.
    const result = reconstructLayout([
      item('A', 0, 50, 100),
      item('B', 5, 50, 10),
    ]);
    // sorted by x: A first (x=0), then B (x=5)
    expect(result).toBe('A B');
  });
});

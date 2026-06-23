import { describe, it, expect } from 'vitest';
import {
  chunkPages,
  isPrivateOrLoopbackHost,
  normalizeBaseUrl,
  buildHeaders,
  buildConnectionError,
  findDuplicateIndices,
  evaluateConfidence,
  validateTransaction,
} from './ai';
import type { ExtractedTransaction } from './prompt';
import type { PageContent } from './pdf';

// --- Helpers ---

function textPage(pageNumber: number): PageContent {
  return { mode: 'text', text: 'x', pageNumber };
}

function imagePage(pageNumber: number): PageContent {
  return { mode: 'image', base64: 'x', mediaType: 'image/jpeg', pageNumber };
}

function makeTxn(overrides: Partial<ExtractedTransaction> = {}): ExtractedTransaction {
  return {
    date: '2025-03-15T00:00:00.000Z',
    symbol: 'AAPL',
    quantity: 10,
    activityType: 'BUY',
    unitPrice: 150,
    currency: 'USD',
    fee: 5,
    amount: 1500,
    ...overrides,
  };
}

// --- chunkPages ---

describe('chunkPages', () => {
  it('returns no chunks for an empty input', () => {
    expect(chunkPages([])).toEqual([]);
  });

  it('fits 10 text pages in one chunk', () => {
    const chunks = chunkPages(Array.from({ length: 10 }, (_, i) => textPage(i + 1)));
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toHaveLength(10);
  });

  it('splits 11 text pages into 10 + 1', () => {
    const chunks = chunkPages(Array.from({ length: 11 }, (_, i) => textPage(i + 1)));
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(10);
    expect(chunks[1]).toHaveLength(1);
  });

  it('fits 5 image pages in one chunk', () => {
    const chunks = chunkPages(Array.from({ length: 5 }, (_, i) => imagePage(i + 1)));
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toHaveLength(5);
  });

  it('splits 6 image pages into 5 + 1', () => {
    const chunks = chunkPages(Array.from({ length: 6 }, (_, i) => imagePage(i + 1)));
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(5);
    expect(chunks[1]).toHaveLength(1);
  });

  it('tracks text and image counts separately', () => {
    // 10 text + 5 image interleaved — each type at its own limit, so still one chunk.
    const pages: PageContent[] = [];
    for (let i = 0; i < 10; i++) {
      pages.push(textPage(i * 2 + 1));
      if (i < 5) pages.push(imagePage(i * 2 + 2));
    }
    const chunks = chunkPages(pages);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toHaveLength(15);
  });

  it('preserves page order and pageNumber', () => {
    const pages = Array.from({ length: 11 }, (_, i) => textPage(i + 1));
    const chunks = chunkPages(pages);
    const flattened = chunks.flat().map((p) => p.pageNumber);
    expect(flattened).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });
});

// --- isPrivateOrLoopbackHost ---

describe('isPrivateOrLoopbackHost', () => {
  it('returns true for loopback, private, and link-local hosts', () => {
    for (const h of [
      'localhost',
      'foo.localhost',
      '127.0.0.1',
      '10.1.2.3',
      '192.168.0.1',
      '172.16.0.1',
      '172.31.255.255',
      '169.254.1.1',
      '::1',
    ]) {
      expect(isPrivateOrLoopbackHost(h), h).toBe(true);
    }
  });

  it('returns false for public hosts and spoofed names', () => {
    for (const h of [
      '172.32.0.1',
      '8.8.8.8',
      'api.openai.com',
      '10.evil.com',
      '192.168.evil.com',
    ]) {
      expect(isPrivateOrLoopbackHost(h), h).toBe(false);
    }
  });
});

// --- normalizeBaseUrl ---

describe('normalizeBaseUrl', () => {
  it('strips trailing slashes', () => {
    expect(normalizeBaseUrl('https://api.openai.com/v1/')).toBe('https://api.openai.com/v1');
    expect(normalizeBaseUrl('https://api.openai.com/v1///')).toBe('https://api.openai.com/v1');
  });

  it('leaves URLs with a scheme unchanged', () => {
    expect(normalizeBaseUrl('http://x')).toBe('http://x');
    expect(normalizeBaseUrl('https://y')).toBe('https://y');
  });

  it('prefixes http:// for a scheme-less local host', () => {
    expect(normalizeBaseUrl('localhost:1234')).toBe('http://localhost:1234');
    expect(normalizeBaseUrl('127.0.0.1:11434')).toBe('http://127.0.0.1:11434');
  });

  it('prefixes https:// for a scheme-less public host', () => {
    expect(normalizeBaseUrl('api.openai.com/v1')).toBe('https://api.openai.com/v1');
    // Spoofed name must NOT be treated as local.
    expect(normalizeBaseUrl('10.evil.com')).toBe('https://10.evil.com');
  });
});

// --- buildHeaders ---

describe('buildHeaders', () => {
  it('omits Authorization when the key is empty', () => {
    expect(buildHeaders('https://api.openai.com/v1', '')).toEqual({
      'Content-Type': 'application/json',
    });
  });

  it('attaches Authorization for an https host', () => {
    const headers = buildHeaders('https://api.openai.com/v1', 'sk-test');
    expect(headers['Authorization']).toBe('Bearer sk-test');
  });

  it('attaches Authorization for a local http host', () => {
    const headers = buildHeaders('http://localhost:1234', 'sk-test');
    expect(headers['Authorization']).toBe('Bearer sk-test');
  });

  it('refuses to send the key over http to a public host', () => {
    expect(() => buildHeaders('http://evil.com', 'sk-test')).toThrow(/Refusing/);
  });
});

// --- buildConnectionError ---

describe('buildConnectionError', () => {
  it('returns a non-TypeError Error unchanged', () => {
    const err = new Error('boom');
    expect(buildConnectionError('https://api.openai.com/v1', err)).toBe(err);
  });

  it('reports an unreachable server for a public host', () => {
    const result = buildConnectionError('https://api.openai.com/v1', new TypeError('x'));
    expect(result.message).toContain('Cannot reach the server');
  });

  it('mentions Ollama for port 11434', () => {
    const result = buildConnectionError('http://localhost:11434', new TypeError('x'));
    expect(result.message).toMatch(/Ollama/);
  });

  it('mentions LM Studio for port 1234', () => {
    const result = buildConnectionError('http://localhost:1234', new TypeError('x'));
    expect(result.message).toMatch(/LM Studio/);
  });

  it('gives a generic CORS message for another local port', () => {
    const result = buildConnectionError('http://localhost:9999', new TypeError('x'));
    expect(result.message).toMatch(/CORS/);
  });
});

// --- findDuplicateIndices ---

describe('findDuplicateIndices', () => {
  it('returns an empty set for an empty input', () => {
    const result = findDuplicateIndices([]);
    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(0);
  });

  it('flags the second of two identical rows, not the first', () => {
    const result = findDuplicateIndices([makeTxn(), makeTxn()]);
    expect(result.has(0)).toBe(false);
    expect(result.has(1)).toBe(true);
  });

  it('compares the symbol case-insensitively', () => {
    const result = findDuplicateIndices([
      makeTxn({ symbol: 'aapl' }),
      makeTxn({ symbol: 'AAPL' }),
    ]);
    expect(result.has(1)).toBe(true);
  });

  it('does not flag rows that differ in amount', () => {
    const result = findDuplicateIndices([
      makeTxn({ amount: 1500 }),
      makeTxn({ amount: 1600 }),
    ]);
    expect(result.size).toBe(0);
  });
});

// --- evaluateConfidence: amount sign + fee magnitude ---

describe('evaluateConfidence (sign-aware checks)', () => {
  it('does not flag a SELL whose negative amount matches quantity × price', () => {
    const flags = evaluateConfidence(
      makeTxn({ activityType: 'SELL', quantity: 10, unitPrice: 150, amount: -1500 }),
    );
    expect(flags.find((f) => f.reason === "Amount doesn't match quantity × price")).toBeUndefined();
  });

  it('flags a SELL whose negative amount does not match magnitude', () => {
    const flags = evaluateConfidence(
      makeTxn({ activityType: 'SELL', quantity: 10, unitPrice: 150, amount: -2000 }),
    );
    expect(flags).toContainEqual({ field: 'amount', reason: "Amount doesn't match quantity × price" });
  });

  it('flags a fee that exceeds the magnitude of a negative amount', () => {
    const flags = evaluateConfidence(makeTxn({ fee: 2000, amount: -1500 }));
    expect(flags).toContainEqual({ field: 'fee', reason: 'Fee exceeds transaction amount' });
  });
});

// --- validateTransaction: fxRate ---

describe('validateTransaction (fxRate)', () => {
  it('passes through a plausible fxRate', () => {
    const result = validateTransaction({ ...makeTxn(), fxRate: 0.9182 });
    expect(result.fxRate).toBe(0.9182);
  });

  it('drops zero, negative, non-finite, and out-of-range fxRate', () => {
    for (const fxRate of [0, -1, NaN, Infinity, 2e9, 'x']) {
      const result = validateTransaction({ ...makeTxn(), fxRate });
      expect('fxRate' in result, String(fxRate)).toBe(false);
    }
  });

  it('omits fxRate when none is provided', () => {
    const result = validateTransaction(makeTxn());
    expect('fxRate' in result).toBe(false);
  });
});

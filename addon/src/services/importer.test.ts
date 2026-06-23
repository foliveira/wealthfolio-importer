import { describe, it, expect } from 'vitest';
import { toActivityImport, partitionChecked, isDuplicate } from './importer';
import type { ExtractedTransaction } from './prompt';
import type { ActivityImport } from '../types';

// --- Helpers ---

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

// --- toActivityImport ---

describe('toActivityImport', () => {
  it('tags a real-symbol BUY as Equity', () => {
    const draft = toActivityImport(makeTxn(), 'acct-1', 3);
    expect(draft.instrumentType).toBe('Equity');
  });

  it('does not tag a $CASH-* symbol as Equity', () => {
    const draft = toActivityImport(makeTxn({ symbol: '$CASH-USD' }), 'acct-1', 1);
    expect('instrumentType' in draft).toBe(false);
  });

  it('does not tag pure cash activity types as Equity', () => {
    for (const activityType of ['DEPOSIT', 'WITHDRAWAL', 'INTEREST', 'CREDIT', 'FEE', 'TAX'] as const) {
      const draft = toActivityImport(makeTxn({ symbol: '', activityType }), 'acct-1', 1);
      expect('instrumentType' in draft).toBe(false);
    }
  });

  it('sets accountId, lineNumber, and quoteCcy (= currency)', () => {
    const draft = toActivityImport(makeTxn({ currency: 'EUR' }), 'acct-42', 7);
    expect(draft.accountId).toBe('acct-42');
    expect(draft.lineNumber).toBe(7);
    expect(draft.currency).toBe('EUR');
    expect(draft.quoteCcy).toBe('EUR');
  });

  it('clamps negative quantity, unitPrice, and fee to 0', () => {
    const draft = toActivityImport(
      makeTxn({ quantity: -5, unitPrice: -10, fee: -3 }),
      'acct-1',
      1,
    );
    expect(draft.quantity).toBe(0);
    expect(draft.unitPrice).toBe(0);
    expect(draft.fee).toBe(0);
  });

  it('blanks an invalid symbol', () => {
    const draft = toActivityImport(makeTxn({ symbol: 'BAD SYMBOL!' }), 'acct-1', 1);
    expect(draft.symbol).toBe('');
  });

  it('falls back to USD for an invalid currency', () => {
    const draft = toActivityImport(makeTxn({ currency: 'us' as string }), 'acct-1', 1);
    expect(draft.currency).toBe('USD');
    expect(draft.quoteCcy).toBe('USD');
  });

  it('sets the draft/validity flags', () => {
    const draft = toActivityImport(makeTxn(), 'acct-1', 1);
    expect(draft.isDraft).toBe(false);
    expect(draft.isValid).toBe(true);
    expect(draft.forceImport).toBe(false);
  });

  it('falls back to a non-empty date for an invalid date', () => {
    const draft = toActivityImport(makeTxn({ date: 'not-a-date' }), 'acct-1', 1);
    expect(typeof draft.date).toBe('string');
    expect((draft.date as string).length).toBeGreaterThan(0);
  });

  it('passes through a positive fxRate', () => {
    const draft = toActivityImport(makeTxn({ fxRate: 0.9182 }), 'acct-1', 1);
    expect(draft.fxRate).toBe(0.9182);
  });

  it('omits fxRate when absent, zero, or negative', () => {
    expect('fxRate' in toActivityImport(makeTxn(), 'acct-1', 1)).toBe(false);
    expect('fxRate' in toActivityImport(makeTxn({ fxRate: 0 }), 'acct-1', 1)).toBe(false);
    expect('fxRate' in toActivityImport(makeTxn({ fxRate: -1 }), 'acct-1', 1)).toBe(false);
  });
});

// --- isDuplicate ---

describe('isDuplicate', () => {
  it('is true when duplicateOfId is truthy', () => {
    expect(isDuplicate({ duplicateOfId: 'abc' } as ActivityImport)).toBe(true);
  });

  it('is true when duplicateOfLineNumber is a number (including 0)', () => {
    expect(isDuplicate({ duplicateOfLineNumber: 5 } as ActivityImport)).toBe(true);
    expect(isDuplicate({ duplicateOfLineNumber: 0 } as ActivityImport)).toBe(true);
  });

  it('is false when neither is set', () => {
    expect(isDuplicate({} as ActivityImport)).toBe(false);
    expect(isDuplicate({ duplicateOfId: '' } as ActivityImport)).toBe(false);
  });
});

// --- partitionChecked ---

describe('partitionChecked', () => {
  function row(overrides: Partial<ActivityImport>): ActivityImport {
    return { accountId: 'a', activityType: 'BUY', isValid: true, isDraft: false, ...overrides } as ActivityImport;
  }

  it('routes rows with duplicateOfId to duplicates even when valid', () => {
    const dup = row({ duplicateOfId: 'x', isValid: true });
    const { valid, duplicates, unresolved } = partitionChecked([dup]);
    expect(duplicates).toContain(dup);
    expect(valid).toHaveLength(0);
    expect(unresolved).toHaveLength(0);
  });

  it('routes rows with duplicateOfLineNumber to duplicates even when valid', () => {
    const dup = row({ duplicateOfLineNumber: 0, isValid: true });
    const { duplicates } = partitionChecked([dup]);
    expect(duplicates).toContain(dup);
  });

  it('routes remaining valid rows to valid and invalid rows to unresolved', () => {
    const ok = row({ isValid: true });
    const bad = row({ isValid: false });
    const { valid, unresolved } = partitionChecked([ok, bad]);
    expect(valid).toEqual([ok]);
    expect(unresolved).toEqual([bad]);
  });

  it('partitions a mixed batch into all three groups', () => {
    const dup = row({ duplicateOfId: 'x' });
    const ok = row({ isValid: true });
    const bad = row({ isValid: false });
    const result = partitionChecked([dup, ok, bad]);
    expect(result.duplicates).toEqual([dup]);
    expect(result.valid).toEqual([ok]);
    expect(result.unresolved).toEqual([bad]);
  });
});

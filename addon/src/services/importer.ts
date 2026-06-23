// Maps reviewed/edited transactions to the host's ActivityImport shape and
// classifies the backend's check response. Kept out of the React component so the
// normalization rules live in one tested place (the table lets users edit values,
// so they must be re-normalized at import time, not just at extraction time).

import { ISO_DATE_RE, SYMBOL_RE, CURRENCY_RE } from './ai';
import type { ExtractedTransaction } from './prompt';
import type { ActivityImport } from '../types';

const CASH_SYMBOL_RE = /^\$CASH/i;
// Activity types that move cash rather than a security position.
const CASH_ACTIVITY_TYPES: ReadonlySet<string> = new Set([
  'DEPOSIT', 'WITHDRAWAL', 'INTEREST', 'CREDIT', 'FEE', 'TAX',
]);

export function toActivityImport(
  t: ExtractedTransaction,
  accountId: string,
  lineNumber: number,
): ActivityImport {
  const date = ISO_DATE_RE.test(t.date) ? t.date : new Date().toISOString();
  const symbol = SYMBOL_RE.test(t.symbol) ? t.symbol : '';
  const currency = CURRENCY_RE.test(t.currency) ? t.currency : 'USD';

  const draft: ActivityImport = {
    accountId,
    date,
    activityType: t.activityType,
    symbol,
    quantity: Math.max(0, Number(t.quantity) || 0),
    unitPrice: Math.max(0, Number(t.unitPrice) || 0),
    currency,
    fee: Math.max(0, Number(t.fee) || 0),
    amount: Number(t.amount) || 0,
    quoteCcy: currency,
    lineNumber,
    isValid: true,
    isDraft: false,
    forceImport: false,
  };

  // Only tag security positions as Equity. Cash movements ($CASH-* or pure cash
  // activity types) previously got mis-tagged 'Equity' for every row.
  const isCashLike = CASH_SYMBOL_RE.test(symbol) || CASH_ACTIVITY_TYPES.has(t.activityType);
  if (!isCashLike) draft.instrumentType = 'Equity';

  // Pass through a document-printed FX rate when present (cross-currency metadata).
  if (typeof t.fxRate === 'number' && isFinite(t.fxRate) && t.fxRate > 0) {
    draft.fxRate = t.fxRate;
  }

  return draft;
}

export function isDuplicate(a: ActivityImport): boolean {
  return Boolean(a.duplicateOfId) || a.duplicateOfLineNumber != null;
}

export interface CheckedPartition {
  /** Resolved and importable. */
  valid: ActivityImport[];
  /** Already present in the portfolio — skipped by default. */
  duplicates: ActivityImport[];
  /** Not a duplicate, but the backend couldn't resolve/validate it (e.g. unknown symbol). */
  unresolved: ActivityImport[];
}

// Splits the backend's check response into the three groups the import flow treats
// differently. Duplicates are separated first so they never get swept into the
// force-import path (the previous bug re-imported them).
export function partitionChecked(checked: ActivityImport[]): CheckedPartition {
  const valid: ActivityImport[] = [];
  const duplicates: ActivityImport[] = [];
  const unresolved: ActivityImport[] = [];

  for (const a of checked) {
    if (isDuplicate(a)) duplicates.push(a);
    else if (a.isValid) valid.push(a);
    else unresolved.push(a);
  }

  return { valid, duplicates, unresolved };
}

import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { ACTIVITY_TYPES, type ExtractedTransaction } from '../services/prompt';
import type { FieldFlag } from '../services/ai';

interface ReviewTableProps {
  transactions: ExtractedTransaction[];
  onChange: (transactions: ExtractedTransaction[]) => void;
  flagsByIndex: Map<number, FieldFlag[]>;
  duplicateIndices: Set<number>;
  warningCount: number;
}

const cellStyle: React.CSSProperties = {
  padding: '4px',
  borderBottom: '1px solid var(--border)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '4px 8px',
  borderRadius: '4px',
  border: '1px solid var(--border)',
  background: 'var(--background)',
  color: 'var(--foreground)',
  fontSize: '12px',
  boxSizing: 'border-box',
};

const flaggedBorder = '1px solid hsl(38 92% 50%)';

interface RowProps {
  row: ExtractedTransaction;
  index: number;
  flags: FieldFlag[];
  isDuplicate: boolean;
  onUpdate: (index: number, field: keyof ExtractedTransaction, value: string | number) => void;
  onDelete: (index: number) => void;
}

// Numeric cell that tolerates transient input ("", "-", "1.") without writing NaN
// or a premature 0 into transaction state. Commits a finite number as the user
// types; normalizes an empty/invalid field to 0 on blur.
const NumberCell = memo(function NumberCell({
  value, onCommit, label, flagged, describedBy,
}: {
  value: number;
  onCommit: (n: number) => void;
  label: string;
  flagged?: string;
  describedBy?: string;
}) {
  const [text, setText] = useState(() => String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(String(value));
  }, [value]);

  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={label}
      aria-invalid={flagged ? true : undefined}
      aria-describedby={flagged ? describedBy : undefined}
      title={flagged}
      style={flagged ? { ...inputStyle, minWidth: '70px', border: flaggedBorder } : { ...inputStyle, minWidth: '70px' }}
      value={text}
      onFocus={() => { focused.current = true; }}
      onChange={(e) => {
        const t = e.target.value;
        setText(t);
        const n = Number(t);
        if (t.trim() !== '' && Number.isFinite(n)) onCommit(n);
      }}
      onBlur={() => {
        focused.current = false;
        const n = Number(text);
        if (text.trim() === '' || !Number.isFinite(n)) { onCommit(0); setText('0'); }
        else setText(String(n));
      }}
    />
  );
});

function textFieldProps(flags: FieldFlag[], field: keyof ExtractedTransaction, warnId: string, base: React.CSSProperties) {
  const reason = flags.find((f) => f.field === field)?.reason;
  return {
    style: reason ? { ...base, border: flaggedBorder } : base,
    title: reason || undefined,
    'aria-invalid': reason ? true : undefined,
    'aria-describedby': reason ? warnId : undefined,
  };
}

const TransactionRow = memo(function TransactionRow({ row, index, flags, isDuplicate, onUpdate, onDelete }: RowProps) {
  const warnId = `row-warn-${index}`;
  const messages = [
    ...flags.map((f) => f.reason),
    ...(isDuplicate ? ['Possible duplicate of an earlier row'] : []),
  ];
  const rowBg = isDuplicate ? 'hsl(38 92% 50% / 0.06)' : undefined;

  return (
    <>
      <tr style={{ background: rowBg }}>
        <td style={cellStyle}>
          <input {...textFieldProps(flags, 'date', warnId, { ...inputStyle, minWidth: '160px' })} aria-label="Date" maxLength={30} value={row.date} onChange={(e) => onUpdate(index, 'date', e.target.value)} />
        </td>
        <td style={cellStyle}>
          <input {...textFieldProps(flags, 'symbol', warnId, { ...inputStyle, minWidth: '80px' })} aria-label="Symbol" maxLength={20} value={row.symbol} onChange={(e) => onUpdate(index, 'symbol', e.target.value)} />
        </td>
        <td style={cellStyle}>
          <NumberCell value={row.quantity} label="Quantity" flagged={flags.find((f) => f.field === 'quantity')?.reason} describedBy={warnId} onCommit={(n) => onUpdate(index, 'quantity', n)} />
        </td>
        <td style={cellStyle}>
          <select
            aria-label="Activity type"
            style={{ ...inputStyle, minWidth: '100px' }}
            value={row.activityType}
            onChange={(e) => onUpdate(index, 'activityType', e.target.value)}
          >
            {ACTIVITY_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </td>
        <td style={cellStyle}>
          <NumberCell value={row.unitPrice} label="Unit price" flagged={flags.find((f) => f.field === 'unitPrice')?.reason} describedBy={warnId} onCommit={(n) => onUpdate(index, 'unitPrice', n)} />
        </td>
        <td style={cellStyle}>
          <input {...textFieldProps(flags, 'currency', warnId, { ...inputStyle, minWidth: '50px' })} aria-label="Currency" maxLength={5} value={row.currency} onChange={(e) => onUpdate(index, 'currency', e.target.value)} />
        </td>
        <td style={cellStyle}>
          <NumberCell value={row.fee} label="Fee" flagged={flags.find((f) => f.field === 'fee')?.reason} describedBy={warnId} onCommit={(n) => onUpdate(index, 'fee', n)} />
        </td>
        <td style={cellStyle}>
          <NumberCell value={row.amount} label="Amount" flagged={flags.find((f) => f.field === 'amount')?.reason} describedBy={warnId} onCommit={(n) => onUpdate(index, 'amount', n)} />
        </td>
        <td style={cellStyle}>
          <button
            onClick={() => onDelete(index)}
            title="Delete row"
            aria-label={`Delete row ${index + 1}`}
            style={{ background: 'none', border: 'none', color: 'hsl(0 84% 60%)', cursor: 'pointer', fontSize: '16px', padding: '2px 6px' }}
          >
            ×
          </button>
        </td>
      </tr>
      {messages.length > 0 && (
        <tr style={{ background: rowBg }}>
          <td id={warnId} colSpan={9} style={{ padding: '0 4px 6px', fontSize: '11px', color: 'hsl(38 92% 40%)' }}>
            ⚠ {messages.join(' · ')}
          </td>
        </tr>
      )}
    </>
  );
});

export function ReviewTable({ transactions, onChange, flagsByIndex, duplicateIndices, warningCount }: ReviewTableProps) {
  const txRef = useRef(transactions);
  txRef.current = transactions;

  const updateRow = useCallback((index: number, field: keyof ExtractedTransaction, value: string | number) => {
    const updated = [...txRef.current];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  }, [onChange]);

  const deleteRow = useCallback((index: number) => {
    onChange(txRef.current.filter((_, i) => i !== index));
  }, [onChange]);

  function addRow() {
    onChange([
      ...transactions,
      {
        date: new Date().toISOString().split('T')[0] + 'T00:00:00.000Z',
        symbol: '',
        quantity: 0,
        activityType: 'BUY',
        unitPrice: 0,
        currency: 'USD',
        fee: 0,
        amount: 0,
      },
    ]);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '13px', color: 'var(--muted-foreground)' }}>
          {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
          {warningCount > 0 && (
            <span style={{ color: 'hsl(38 92% 50%)', marginLeft: '8px' }}>
              ({warningCount} warning{warningCount !== 1 ? 's' : ''})
            </span>
          )}
        </span>
        <button
          onClick={addRow}
          style={{ padding: '4px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--foreground)', cursor: 'pointer', fontSize: '12px' }}
        >
          + Add Row
        </button>
      </div>

      {transactions.length === 0 ? (
        <p style={{ textAlign: 'center', padding: '20px', color: 'var(--muted-foreground)', fontSize: '13px' }}>
          No transactions extracted. Try a different document or add rows manually.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr>
                {['Date', 'Symbol', 'Qty', 'Type', 'Price', 'CCY', 'Fee', 'Amount', 'Actions'].map((h) => (
                  <th key={h} scope="col" style={{ ...cellStyle, textAlign: 'left', fontWeight: 600, borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap', ...(h === 'Actions' ? { position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 } : {}) }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.map((row, i) => (
                <TransactionRow key={`${row.date}-${row.symbol}-${i}`} row={row} index={i} flags={flagsByIndex.get(i) ?? []} isDuplicate={duplicateIndices.has(i)} onUpdate={updateRow} onDelete={deleteRow} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

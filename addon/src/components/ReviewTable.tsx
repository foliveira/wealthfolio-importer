import { ACTIVITY_TYPES, type ExtractedTransaction } from '../services/prompt';

interface ReviewTableProps {
  transactions: ExtractedTransaction[];
  onChange: (transactions: ExtractedTransaction[]) => void;
}

export function ReviewTable({ transactions, onChange }: ReviewTableProps) {
  function updateRow(index: number, field: keyof ExtractedTransaction, value: string | number) {
    const updated = [...transactions];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  }

  function deleteRow(index: number) {
    onChange(transactions.filter((_, i) => i !== index));
  }

  function addRow() {
    onChange([
      ...transactions,
      {
        date: new Date().toISOString(),
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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '13px', color: 'var(--muted-foreground)' }}>
          {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
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
                {['Date', 'Symbol', 'Qty', 'Type', 'Price', 'CCY', 'Fee', 'Amount', ''].map((h) => (
                  <th key={h} style={{ ...cellStyle, textAlign: 'left', fontWeight: 600, borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.map((row, i) => (
                <tr key={i}>
                  <td style={cellStyle}>
                    <input style={{ ...inputStyle, minWidth: '160px' }} value={row.date} onChange={(e) => updateRow(i, 'date', e.target.value)} />
                  </td>
                  <td style={cellStyle}>
                    <input style={{ ...inputStyle, minWidth: '80px' }} value={row.symbol} onChange={(e) => updateRow(i, 'symbol', e.target.value)} />
                  </td>
                  <td style={cellStyle}>
                    <input style={{ ...inputStyle, minWidth: '70px' }} type="number" step="any" value={row.quantity} onChange={(e) => updateRow(i, 'quantity', +e.target.value)} />
                  </td>
                  <td style={cellStyle}>
                    <select
                      style={{ ...inputStyle, minWidth: '100px' }}
                      value={row.activityType}
                      onChange={(e) => updateRow(i, 'activityType', e.target.value)}
                    >
                      {ACTIVITY_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </td>
                  <td style={cellStyle}>
                    <input style={{ ...inputStyle, minWidth: '80px' }} type="number" step="any" value={row.unitPrice} onChange={(e) => updateRow(i, 'unitPrice', +e.target.value)} />
                  </td>
                  <td style={cellStyle}>
                    <input style={{ ...inputStyle, minWidth: '50px' }} value={row.currency} onChange={(e) => updateRow(i, 'currency', e.target.value)} />
                  </td>
                  <td style={cellStyle}>
                    <input style={{ ...inputStyle, minWidth: '60px' }} type="number" step="any" value={row.fee} onChange={(e) => updateRow(i, 'fee', +e.target.value)} />
                  </td>
                  <td style={cellStyle}>
                    <input style={{ ...inputStyle, minWidth: '80px' }} type="number" step="any" value={row.amount} onChange={(e) => updateRow(i, 'amount', +e.target.value)} />
                  </td>
                  <td style={cellStyle}>
                    <button
                      onClick={() => deleteRow(i)}
                      title="Delete row"
                      style={{ background: 'none', border: 'none', color: 'hsl(0 84% 60%)', cursor: 'pointer', fontSize: '16px', padding: '2px 6px' }}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

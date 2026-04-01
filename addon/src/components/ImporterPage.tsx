import React, { useState, useEffect, useRef } from 'react';
import type { AddonContext, Account, ActivityImport } from '../types';
import type { Provider } from '../services/ai';
import type { ExtractedTransaction } from '../services/prompt';
import { extractTransactions } from '../services/ai';
import { Settings } from './Settings';
import { Upload } from './Upload';
import { ReviewTable } from './ReviewTable';

type Step = 'upload' | 'extracting' | 'review' | 'importing' | 'done';

const SPIN_STYLE = <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>;

interface ImporterPageProps {
  ctx: AddonContext;
}

export function ImporterPage({ ctx }: ImporterPageProps) {
  const [provider, setProvider] = useState<Provider>('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [step, setStep] = useState<Step>('upload');
  const [transactions, setTransactions] = useState<ExtractedTransaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [importResult, setImportResult] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only: load accounts once
  useEffect(() => {
    ctx.api.accounts.getAll().then((accs) => {
      setAccounts(accs);
      if (accs.length > 0) setSelectedAccount(accs[0].id);
    }).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      setError(`Failed to load accounts: ${message}`);
    });
  }, []);

  async function handleFile(file: File) {
    setError('');
    setFileName(file.name);

    if (!apiKey) {
      setError('Please enter your API key first.');
      return;
    }

    setStep('extracting');

    try {
      let images: { base64: string; mediaType: string }[] = [];

      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const { pdfToImages } = await import('../services/pdf');
        const result = await pdfToImages(file);
        images = result.images.map((base64) => ({ base64, mediaType: 'image/jpeg' }));
      } else {
        const { imageToBase64, getMediaType } = await import('../services/pdf');
        const base64 = await imageToBase64(file);
        images = [{ base64, mediaType: getMediaType(file) }];
      }

      const abort = new AbortController();
      abortRef.current = abort;

      const extracted = await extractTransactions(provider, apiKey, images, abort.signal);
      setTransactions(extracted);
      setStep('review');
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        setStep('upload');
        return;
      }
      setError(err instanceof Error ? err.message : String(err));
      setStep('upload');
    } finally {
      abortRef.current = null;
    }
  }

  async function handleImport() {
    if (!selectedAccount) {
      setError('Please select an account.');
      return;
    }

    setError('');
    setStep('importing');

    try {
      const activities: ActivityImport[] = transactions.map((t, i) => ({
        accountId: selectedAccount,
        date: t.date,
        activityType: t.activityType,
        symbol: t.symbol,
        quantity: t.quantity,
        unitPrice: t.unitPrice,
        currency: t.currency,
        fee: t.fee,
        amount: t.amount,
        lineNumber: i + 1,
        isValid: true,
        isDraft: false,
      }));

      const result = await ctx.api.activities.import(activities);

      const imported = result?.summary?.imported ?? activities.length;
      setImportResult(`Successfully imported ${imported} transaction(s).`);
      setStep('done');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ctx.api.logger.error(`[AI Importer] Import failed: ${message}`);
      setError(`Import failed: ${message}`);
      setStep('review');
    }
  }

  function startOver() {
    setStep('upload');
    setTransactions([]);
    setError('');
    setImportResult('');
    setFileName('');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', maxWidth: '960px' }}>
      <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>AI Importer</h2>
      <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted-foreground)' }}>
        Extract transactions from PDFs & images using AI
      </p>

      {/* Settings — always visible */}
      <div style={{ padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
        <Settings
          secrets={ctx.api.secrets}
          logger={ctx.api.logger}
          provider={provider}
          onProviderChange={setProvider}
          apiKey={apiKey}
          onApiKeyChange={setApiKey}
        />
      </div>

      {/* Upload */}
      {step === 'upload' && (
        <div style={{ padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <Upload onFile={handleFile} disabled={!apiKey} />
        </div>
      )}

      {/* Extracting */}
      {step === 'extracting' && (
        <div style={{ padding: '32px 16px', borderRadius: '8px', border: '1px solid var(--border)', textAlign: 'center' }}>
          <div style={{ display: 'inline-block', width: '24px', height: '24px', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <p style={{ marginTop: '12px' }}>Extracting transactions from <strong>{fileName}</strong>...</p>
          <button
            onClick={() => abortRef.current?.abort()}
            style={{ marginTop: '8px', padding: '6px 16px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--foreground)', cursor: 'pointer', fontSize: '13px' }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Review */}
      {step === 'review' && (
        <div style={{ padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <ReviewTable transactions={transactions} onChange={setTransactions} />

          <div style={{ marginTop: '16px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '13px', fontWeight: 500 }}>Import to:</label>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: '13px' }}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
              ))}
            </select>

            <div style={{ flex: 1 }} />

            <button
              onClick={startOver}
              style={{ padding: '6px 16px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--foreground)', cursor: 'pointer', fontSize: '13px' }}
            >
              Start Over
            </button>
            <button
              onClick={handleImport}
              disabled={transactions.length === 0}
              style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', background: 'var(--primary)', color: 'var(--primary-foreground)', cursor: transactions.length === 0 ? 'not-allowed' : 'pointer', opacity: transactions.length === 0 ? 0.5 : 1, fontSize: '13px', fontWeight: 500 }}
            >
              Import {transactions.length} Transaction{transactions.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}

      {/* Importing */}
      {step === 'importing' && (
        <div style={{ padding: '32px 16px', borderRadius: '8px', border: '1px solid var(--border)', textAlign: 'center' }}>
          <div style={{ display: 'inline-block', width: '24px', height: '24px', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <p style={{ marginTop: '12px' }}>Importing transactions...</p>
        </div>
      )}

      {/* Done */}
      {step === 'done' && (
        <div style={{ padding: '24px 16px', borderRadius: '8px', border: '1px solid var(--border)', textAlign: 'center' }}>
          <p style={{ fontSize: '14px', fontWeight: 500, color: 'hsl(142 71% 45%)' }}>{importResult}</p>
          <button
            onClick={startOver}
            style={{ marginTop: '12px', padding: '6px 16px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--foreground)', cursor: 'pointer', fontSize: '13px' }}
          >
            Import Another
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: '12px 16px', borderRadius: '8px', background: 'hsl(0 84% 60% / 0.1)', color: 'hsl(0 84% 60%)', fontSize: '13px', whiteSpace: 'pre-wrap' }}>
          {error}
        </div>
      )}

      {SPIN_STYLE}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import type { AddonContext, Account, ActivityImport } from '../types';
import type { Provider } from '../services/ai';
import type { ExtractedTransaction } from '../services/prompt';
import { extractTransactions } from '../services/ai';
import { pdfToImages, imageToBase64, getMediaType } from '../services/pdf';
import { Settings } from './Settings';
import { Upload } from './Upload';
import { ReviewTable } from './ReviewTable';

type Step = 'upload' | 'extracting' | 'review' | 'importing' | 'done';

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
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  useEffect(() => {
    ctx.api.accounts.getAll().then((accs) => {
      setAccounts(accs);
      if (accs.length > 0) setSelectedAccount(accs[0].id);
    }).catch((err) => {
      setError(`Failed to load accounts: ${(err as Error).message}`);
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
        const result = await pdfToImages(file);
        images = result.images.map((base64) => ({ base64, mediaType: 'image/jpeg' }));
      } else {
        const base64 = await imageToBase64(file);
        images = [{ base64, mediaType: getMediaType(file) }];
      }

      const abort = new AbortController();
      setAbortController(abort);

      const extracted = await extractTransactions(provider, apiKey, images, abort.signal);
      setTransactions(extracted);
      setStep('review');
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setStep('upload');
        return;
      }
      setError((err as Error).message);
      setStep('upload');
    } finally {
      setAbortController(null);
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

      // Validate first
      const checked = await ctx.api.activities.checkImport(activities);
      const hasErrors = checked.filter((a) => a.errors && Object.keys(a.errors).length > 0);
      const duplicates = checked.filter((a) => a.duplicateOfId);

      if (hasErrors.length > 0) {
        const msgs = hasErrors.map((e) => {
          const errs = Object.entries(e.errors || {}).map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`).join('; ');
          return `Line ${e.lineNumber}: ${errs}`;
        });
        setError(`Validation errors:\n${msgs.join('\n')}`);
        setStep('review');
        return;
      }

      const toImport = checked.filter((a) => !a.duplicateOfId);

      if (toImport.length === 0) {
        setImportResult(`All ${duplicates.length} transaction(s) are duplicates — nothing to import.`);
        setStep('done');
        return;
      }

      const result = await ctx.api.activities.import(toImport);

      const imported = result.summary?.imported ?? toImport.length;
      const msg = duplicates.length > 0
        ? `Imported ${imported} transaction(s). Skipped ${duplicates.length} duplicate(s).`
        : `Successfully imported ${imported} transaction(s).`;

      setImportResult(msg);
      setStep('done');
    } catch (err) {
      setError((err as Error).message);
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
            onClick={() => abortController?.abort()}
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

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

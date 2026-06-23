import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { AddonContext, Account, ActivityImport } from '../types';
import { type AIConfig, DEFAULT_BASE_URL, extractTransactions, evaluateConfidence, findDuplicateIndices } from '../services/ai';
import type { PageContent } from '../services/pdf';
import type { ExtractedTransaction, DateFormat } from '../services/prompt';
import { toActivityImport, partitionChecked } from '../services/importer';
import { Settings } from './Settings';
import { Upload } from './Upload';
import { ReviewTable } from './ReviewTable';
import { useConfirm } from './ConfirmDialog';

type Step = 'upload' | 'extracting' | 'review' | 'importing' | 'done';

const SPIN_STYLE = <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>;

// The SDK bridge doesn't pass accountId at the root level, which the self-hosted
// Axum backend requires — so the import calls go straight to the REST API.
async function apiCall<T>(path: string, body: unknown): Promise<T> {
  const resp = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`API ${resp.status}: ${text}`);
  }
  return resp.json();
}

interface ImporterPageProps {
  ctx: AddonContext;
}

export function ImporterPage({ ctx }: ImporterPageProps) {
  const [config, setConfig] = useState<AIConfig>({
    baseUrl: DEFAULT_BASE_URL,
    apiKey: '',
    model: '',
  });
  const [dateFormat, setDateFormat] = useState<DateFormat>('DD/MM/YYYY');
  const [step, setStep] = useState<Step>('upload');
  const [transactions, setTransactions] = useState<ExtractedTransaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [importResult, setImportResult] = useState('');
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const reviewHeadingRef = useRef<HTMLHeadingElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);
  const { confirm, dialog } = useConfirm();

  useEffect(() => {
    ctx.api.accounts.getAll().then((accs) => {
      setAccounts(accs);
      if (accs.length > 0) setSelectedAccount(accs[0].id);
    }).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      setError(`Failed to load accounts: ${message}`);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only: load accounts once
  }, []);

  // Move focus to the newly revealed panel so keyboard/screen-reader users follow the flow.
  useEffect(() => {
    if (step === 'review') reviewHeadingRef.current?.focus();
    else if (step === 'done') doneRef.current?.focus();
  }, [step]);

  async function handleFile(file: File) {
    setError('');
    setFileName(file.name);

    if (!config.model) {
      setError('Please select a model first. Use "Test Connection" to load available models.');
      return;
    }

    // Cancel any in-flight extraction, then take ownership of the abort slot. All
    // state writes below are guarded on `abortRef.current === abort` so a superseded
    // call can never clobber the current one's controller or step.
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    setStep('extracting');
    setProgress(null);

    try {
      let pages: PageContent[];

      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const { pdfToContent, LARGE_DOC_THRESHOLD } = await import('../services/pdf');
        if (abort.signal.aborted) return;
        const result = await pdfToContent(file);
        pages = result.pages;
        if (abort.signal.aborted) return;

        if (pages.length > LARGE_DOC_THRESHOLD) {
          const ok = await confirm({
            title: 'Large document',
            message: `This document has ${pages.length} pages. Processing may take several minutes and consume significant API credits. Continue?`,
            confirmLabel: 'Continue',
            cancelLabel: 'Cancel',
          });
          if (!ok) {
            if (abortRef.current === abort) { abortRef.current = null; setStep('upload'); }
            return;
          }
          if (abort.signal.aborted) return;
        }
      } else {
        const { imageToBase64, getMediaType } = await import('../services/pdf');
        const base64 = await imageToBase64(file);
        pages = [{ mode: 'image', base64, mediaType: getMediaType(file), pageNumber: 1 }];
      }

      const extracted = await extractTransactions(
        config,
        pages,
        abort.signal,
        (c, t) => { if (abortRef.current === abort) setProgress({ current: c, total: t }); },
        dateFormat,
      );
      if (abortRef.current !== abort) return; // superseded by a newer upload
      setTransactions(extracted);
      setStep('review');
    } catch (err: unknown) {
      if (abortRef.current !== abort) return; // stale call — ignore its failure
      if (err instanceof Error && err.name === 'AbortError') {
        setStep('upload');
        return;
      }
      setError(err instanceof Error ? err.message : String(err));
      setStep('upload');
    } finally {
      if (abortRef.current === abort) {
        abortRef.current = null;
        setProgress(null);
      }
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
      const draft = transactions.map((t, i) => toActivityImport(t, selectedAccount, i + 1));
      ctx.api.logger.debug(`[AI Importer] Sending ${draft.length} activities to checkImport`);

      // Resolve symbols and detect duplicates (populates exchangeMic, symbolName, duplicateOfId)
      const checked = await apiCall<ActivityImport[]>(
        '/api/v1/activities/import/check',
        { accountId: selectedAccount, activities: draft },
      );
      const { valid, duplicates, unresolved } = partitionChecked(checked);

      let toImport = [...valid];
      let forceImported = 0;

      // Unresolved (non-duplicate) symbols: offer force-import. Duplicates are never
      // swept in here — they're skipped so the same statement can't be re-imported.
      if (unresolved.length > 0) {
        const symbols = [...new Set(unresolved.map((a) => a.symbol).filter(Boolean))];
        const symbolList = symbols.length > 0 ? symbols.join(', ') : 'unknown symbols';
        const message = valid.length > 0
          ? `${unresolved.length} transaction(s) couldn't be resolved in market data (${symbolList}).\n\n${valid.length} transaction(s) resolved successfully.\n\nImport the unresolved ones anyway? They'll be created as custom assets.`
          : `None of the ${unresolved.length} transaction(s) could be resolved in market data (${symbolList}).\n\nImport them anyway? They'll be created as custom assets.`;

        const ok = await confirm({
          title: 'Unresolved symbols',
          message,
          confirmLabel: 'Import anyway',
          cancelLabel: 'Back to review',
        });
        if (ok) {
          toImport = [...valid, ...unresolved.map((a) => ({ ...a, isValid: true, forceImport: true }))];
          forceImported = unresolved.length;
        } else if (valid.length === 0) {
          setStep('review');
          return;
        }
        // declined with some valid rows → import only the valid ones
      }

      if (toImport.length === 0) {
        const note = duplicates.length > 0
          ? `${duplicates.length} duplicate transaction(s) already in your portfolio were skipped.`
          : 'No transactions to import.';
        setImportResult(note);
        setStep('done');
        return;
      }

      const result = await apiCall<{ activities: ActivityImport[]; summary?: { imported?: number } }>(
        '/api/v1/activities/import',
        { accountId: selectedAccount, activities: toImport },
      );
      const imported = result?.summary?.imported ?? toImport.length;
      let msg = `Successfully imported ${imported} transaction(s).`;
      if (forceImported > 0) msg += ` ${forceImported} as custom symbols.`;
      if (duplicates.length > 0) msg += ` ${duplicates.length} duplicate(s) skipped.`;
      const declinedUnresolved = unresolved.length - forceImported;
      if (declinedUnresolved > 0) msg += ` ${declinedUnresolved} unresolved skipped.`;
      setImportResult(msg);
      setStep('done');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ctx.api.logger.error(`[AI Importer] Import failed: ${message}`);
      // Show a sanitized message to the user — full details stay in the logger
      const userMessage = message.length > 200 ? message.slice(0, 200) + '...' : message;
      setError(`Import failed: ${userMessage}`);
      setStep('review');
    }
  }

  const flagsByIndex = useMemo(
    () => new Map(transactions.map((t, i) => [i, evaluateConfidence(t)] as const)),
    [transactions],
  );

  const duplicateIndices = useMemo(
    () => findDuplicateIndices(transactions),
    [transactions],
  );

  const warningCount = useMemo(
    () => Array.from(flagsByIndex.values()).reduce((sum, f) => sum + f.length, 0) + duplicateIndices.size,
    [flagsByIndex, duplicateIndices],
  );

  async function startOver() {
    if (transactions.length > 0) {
      const ok = await confirm({
        title: 'Discard transactions?',
        message: `You have ${transactions.length} extracted transaction(s) that haven't been imported. Start over and discard them?`,
        confirmLabel: 'Discard',
        cancelLabel: 'Keep',
        danger: true,
      });
      if (!ok) return;
    }
    setStep('upload');
    setTransactions([]);
    setError('');
    setImportResult('');
    setFileName('');
  }

  const canUpload = !!config.model;

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
          config={config}
          onConfigChange={setConfig}
          dateFormat={dateFormat}
          onDateFormatChange={setDateFormat}
        />
      </div>

      {/* Upload */}
      {step === 'upload' && (
        <div style={{ padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
          {!canUpload && (
            <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'hsl(38 92% 40%)' }}>
              Select a model above to enable upload — click “Test Connection”, then pick a model.
            </p>
          )}
          <Upload onFile={handleFile} disabled={!canUpload} />
        </div>
      )}

      {/* Extracting */}
      {step === 'extracting' && (
        <div role="status" aria-live="polite" style={{ padding: '32px 16px', borderRadius: '8px', border: '1px solid var(--border)', textAlign: 'center' }}>
          <div aria-hidden="true" style={{ display: 'inline-block', width: '24px', height: '24px', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <p style={{ marginTop: '12px' }}>Extracting transactions from <strong>{fileName}</strong>...</p>
          {progress && progress.total > 1 && (
            <p style={{ marginTop: '4px', fontSize: '12px', color: 'var(--muted-foreground)' }}>
              Processing chunk {progress.current} of {progress.total}...
            </p>
          )}
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
          <h3 ref={reviewHeadingRef} tabIndex={-1} style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 600, outline: 'none' }}>
            Review transactions
          </h3>
          <ReviewTable
            transactions={transactions}
            onChange={setTransactions}
            flagsByIndex={flagsByIndex}
            duplicateIndices={duplicateIndices}
            warningCount={warningCount}
          />

          <div style={{ marginTop: '16px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <label htmlFor="import-account" style={{ fontSize: '13px', fontWeight: 500 }}>Import to:</label>
            <select
              id="import-account"
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
              Import {transactions.length} Transaction{transactions.length !== 1 ? 's' : ''}{warningCount > 0 ? ` (${warningCount} warning${warningCount !== 1 ? 's' : ''})` : ''}
            </button>
          </div>
        </div>
      )}

      {/* Importing */}
      {step === 'importing' && (
        <div role="status" aria-live="polite" style={{ padding: '32px 16px', borderRadius: '8px', border: '1px solid var(--border)', textAlign: 'center' }}>
          <div aria-hidden="true" style={{ display: 'inline-block', width: '24px', height: '24px', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <p style={{ marginTop: '12px' }}>Importing transactions...</p>
        </div>
      )}

      {/* Done */}
      {step === 'done' && (
        <div ref={doneRef} tabIndex={-1} role="status" style={{ padding: '24px 16px', borderRadius: '8px', border: '1px solid var(--border)', textAlign: 'center', outline: 'none' }}>
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
        <div role="alert" style={{ padding: '12px 16px', borderRadius: '8px', background: 'hsl(0 84% 60% / 0.1)', color: 'hsl(0 84% 60%)', fontSize: '13px', whiteSpace: 'pre-wrap' }}>
          {error}
        </div>
      )}

      {dialog}
      {SPIN_STYLE}
    </div>
  );
}

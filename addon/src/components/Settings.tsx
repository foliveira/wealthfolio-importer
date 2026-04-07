import React, { useState, useEffect, useRef } from 'react';
import type { SecretsAPI, HostAPI } from '../types';
import type { AIConfig } from '../services/ai';
import { fetchModels, normalizeBaseUrl, buildConnectionError } from '../services/ai';
import { DATE_FORMATS, type DateFormat } from '../services/prompt';
import { ModelCombobox } from './ModelCombobox';

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

interface SettingsProps {
  secrets: SecretsAPI;
  logger: HostAPI['logger'];
  config: AIConfig;
  onConfigChange: (config: AIConfig) => void;
  dateFormat: DateFormat;
  onDateFormatChange: (f: DateFormat) => void;
}

export function Settings({ secrets, logger, config, onConfigChange, dateFormat, onDateFormatChange }: SettingsProps) {
  const [showKey, setShowKey] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [models, setModels] = useState<string[] | null>(null);
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState('');
  const [migrationBanner, setMigrationBanner] = useState('');
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // --- Load saved settings + migration ---
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only
  useEffect(() => {
    (async () => {
      try {
        // Check for old provider key (migration needed)
        const oldProvider = await secrets.get('provider');
        if (oldProvider) {
          if (oldProvider === 'openai') {
            await secrets.set('base-url', DEFAULT_BASE_URL);
            await secrets.set('model', 'gpt-5.4-mini');
            // api-key is already stored under the same key name
          } else if (oldProvider === 'anthropic') {
            await secrets.delete('api-key');
            setMigrationBanner('Anthropic native API has been removed. Please configure an OpenAI-compatible endpoint.');
          }
          await secrets.delete('provider');
        }

        // Load current settings
        const [savedBaseUrl, savedApiKey, savedModel, savedDateFormat] = await Promise.all([
          secrets.get('base-url'),
          secrets.get('api-key'),
          secrets.get('model'),
          secrets.get('date-format'),
        ]);

        const newConfig: AIConfig = {
          baseUrl: savedBaseUrl || DEFAULT_BASE_URL,
          apiKey: savedApiKey || '',
          model: savedModel || '',
        };
        onConfigChange(newConfig);

        if (savedBaseUrl && savedBaseUrl !== DEFAULT_BASE_URL) {
          setShowAdvanced(true);
        }

        if (savedDateFormat && (DATE_FORMATS as readonly string[]).includes(savedDateFormat)) {
          onDateFormatChange(savedDateFormat as DateFormat);
        }
      } catch (e) {
        logger.error(`[AI Importer] Failed to load settings: ${e}`);
      }
    })();
  }, []);

  useEffect(() => {
    return () => clearTimeout(saveTimer.current);
  }, []);

  // --- Handlers ---

  const updateConfig = (partial: Partial<AIConfig>) => {
    const updated = { ...config, ...partial };
    onConfigChange(updated);

    // If base URL changed, clear the saved model (it's meaningless for a different provider)
    if (partial.baseUrl !== undefined && partial.baseUrl !== config.baseUrl) {
      updated.model = '';
      setModels(null);
      secrets.delete('model').catch(e => logger.error(`[AI Importer] Failed to delete model: ${e}`));
    }

    // Persist
    if (partial.baseUrl !== undefined) {
      secrets.set('base-url', partial.baseUrl).catch(e => logger.error(`[AI Importer] Failed to save base URL: ${e}`));
    }
    if (partial.model !== undefined) {
      if (partial.model) {
        secrets.set('model', partial.model).catch(e => logger.error(`[AI Importer] Failed to save model: ${e}`));
      } else {
        secrets.delete('model').catch(e => logger.error(`[AI Importer] Failed to delete model: ${e}`));
      }
    }
  };

  const handleKeyChange = (key: string) => {
    onConfigChange({ ...config, apiKey: key });
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (key) {
        secrets.set('api-key', key).catch(e => logger.error(`[AI Importer] Failed to save API key: ${e}`));
      } else {
        secrets.delete('api-key').catch(e => logger.error(`[AI Importer] Failed to delete API key: ${e}`));
      }
    }, 500);
  };

  const handleDateFormatChange = (value: string) => {
    if (!(DATE_FORMATS as readonly string[]).includes(value)) return;
    const f = value as DateFormat;
    onDateFormatChange(f);
    secrets.set('date-format', f).catch(e => logger.error(`[AI Importer] Failed to save date format: ${e}`));
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestError('');
    try {
      const result = await fetchModels(config.baseUrl, config.apiKey);
      setModels(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setTestError(message);
      setModels(null);
    } finally {
      setTesting(false);
    }
  };

  // --- Derived ---
  const baseUrlDomain = (() => {
    try { return new URL(normalizeBaseUrl(config.baseUrl)).hostname; }
    catch { return 'your configured endpoint'; }
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Migration banner */}
      {migrationBanner && (
        <div style={{ padding: '10px 12px', borderRadius: '6px', background: 'hsl(38 92% 50% / 0.1)', color: 'hsl(38 92% 40%)', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{migrationBanner}</span>
          <button onClick={() => setMigrationBanner('')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '16px', padding: '0 4px' }}>x</button>
        </div>
      )}

      <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>AI Provider</h3>

      {/* API Key */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input
          type={showKey ? 'text' : 'password'}
          value={config.apiKey}
          onChange={(e) => handleKeyChange(e.target.value)}
          placeholder="API Key (optional for local providers)"
          style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: '13px' }}
        />
        <button
          onClick={() => setShowKey(!showKey)}
          style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--foreground)', cursor: 'pointer', fontSize: '13px' }}
        >
          {showKey ? 'Hide' : 'Show'}
        </button>
      </div>

      {/* Test Connection */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button
          onClick={handleTestConnection}
          disabled={testing}
          style={{ padding: '6px 16px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--foreground)', cursor: testing ? 'not-allowed' : 'pointer', fontSize: '13px', opacity: testing ? 0.6 : 1 }}
        >
          {testing ? 'Testing...' : 'Test Connection'}
        </button>
        {models && !testError && (
          <span style={{ fontSize: '12px', color: 'hsl(142 71% 45%)' }}>
            Connected ({models.length} models available)
          </span>
        )}
      </div>

      {testError && (
        <div style={{ padding: '8px 12px', borderRadius: '6px', background: 'hsl(0 84% 60% / 0.1)', color: 'hsl(0 84% 60%)', fontSize: '12px', whiteSpace: 'pre-wrap' }}>
          {testError}
        </div>
      )}

      {/* Model */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <label style={{ fontSize: '13px', fontWeight: 500, minWidth: '48px' }}>Model</label>
        <ModelCombobox
          value={config.model}
          onChange={(model) => updateConfig({ model })}
          models={models}
        />
      </div>

      {/* Advanced toggle */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer', fontSize: '12px', padding: 0 }}
      >
        {showAdvanced ? '- Hide advanced' : '+ Advanced settings'}
      </button>

      {showAdvanced && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <label style={{ fontSize: '13px', fontWeight: 500, minWidth: '64px' }}>Base URL</label>
          <input
            type="text"
            value={config.baseUrl}
            onChange={(e) => updateConfig({ baseUrl: e.target.value })}
            placeholder={DEFAULT_BASE_URL}
            style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: '13px' }}
          />
        </div>
      )}

      <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted-foreground)' }}>
        Stored securely in Wealthfolio. Only sent to {baseUrlDomain}.
      </p>

      <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Document Date Format</h3>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <select
          value={dateFormat}
          onChange={(e) => handleDateFormatChange(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: '13px' }}
        >
          {DATE_FORMATS.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>

      <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted-foreground)' }}>
        How dates appear in your brokerage statements. Helps the AI correctly interpret ambiguous dates like 03/04/2025.
      </p>
    </div>
  );
}

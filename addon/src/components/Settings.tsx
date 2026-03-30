import { useState, useEffect } from 'react';
import type { SecretsAPI } from '../types';
import type { Provider } from '../services/ai';

interface SettingsProps {
  secrets: SecretsAPI;
  provider: Provider;
  onProviderChange: (p: Provider) => void;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
}

export function Settings({ secrets, provider, onProviderChange, apiKey, onApiKeyChange }: SettingsProps) {
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    secrets.get('provider').then((p) => {
      if (p === 'openai' || p === 'anthropic') onProviderChange(p);
    });
    secrets.get('api-key').then((k) => {
      if (k) onApiKeyChange(k);
    });
  }, []);

  const handleProviderChange = async (p: Provider) => {
    onProviderChange(p);
    await secrets.set('provider', p);
  };

  const handleKeyChange = async (key: string) => {
    onApiKeyChange(key);
    if (key) {
      await secrets.set('api-key', key);
    } else {
      await secrets.delete('api-key');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>AI Provider</h3>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <select
          value={provider}
          onChange={(e) => handleProviderChange(e.target.value as Provider)}
          style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: '13px' }}
        >
          <option value="anthropic">Anthropic (Claude)</option>
          <option value="openai">OpenAI (GPT-5.4-mini)</option>
        </select>
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input
          type={showKey ? 'text' : 'password'}
          value={apiKey}
          onChange={(e) => handleKeyChange(e.target.value)}
          placeholder="Enter your API key..."
          style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', fontSize: '13px' }}
        />
        <button
          onClick={() => setShowKey(!showKey)}
          style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--foreground)', cursor: 'pointer', fontSize: '13px' }}
        >
          {showKey ? 'Hide' : 'Show'}
        </button>
      </div>

      <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted-foreground)' }}>
        Stored securely in Wealthfolio. Only sent to {provider === 'anthropic' ? 'Anthropic' : 'OpenAI'}.
      </p>
    </div>
  );
}

---
title: "feat: Unified OpenAI-Compatible API Configuration"
type: feat
status: active
date: 2026-04-07
origin: docs/brainstorms/2026-04-07-unified-openai-compatible-api-requirements.md
---

# feat: Unified OpenAI-Compatible API Configuration

## Overview

Replace the dual Anthropic/OpenAI provider architecture with a single OpenAI-compatible API client. Users configure a Base URL, API Key, and Model to connect to any OpenAI-compatible provider (OpenAI, Ollama, LM Studio, vLLM, OpenRouter, etc.). The settings UI gains a "Test Connection" button that fetches available models, a searchable combobox with curated recommendations, and an Advanced toggle for custom base URLs.

## Problem Statement / Motivation

The addon has two fully separate code paths for Anthropic and OpenAI — different content builders, different API calls, different response parsers. This doubles maintenance cost and locks out users who want other providers. Standardizing on the OpenAI-compatible chat completions API (which all major local and cloud providers now support) eliminates this duplication and unlocks broad provider choice with zero provider-specific code. (see origin: `docs/brainstorms/2026-04-07-unified-openai-compatible-api-requirements.md`)

## Proposed Solution

### Phase 1: Unified API Client (R1, R5)

Rewrite `addon/src/services/ai.ts` to use a single code path.

**Remove:**
- `Provider` type (`'anthropic' | 'openai'`)
- `AnthropicContentBlock` and `AnthropicResponse` types
- `buildAnthropicContent()` (lines 154-176)
- `extractWithAnthropic()` (lines 202-235)
- `extractChunk()` dispatcher (lines 141-152)
- `anthropic-version`, `anthropic-dangerous-direct-browser-access` headers

**Add/Modify:**
- New config type:
  ```typescript
  export interface AIConfig {
    baseUrl: string;  // e.g. "https://api.openai.com/v1"
    apiKey: string;   // empty string for keyless providers
    model: string;    // e.g. "gpt-5.4-mini"
  }
  ```
- Single `extractChunk(config, pages, signal, systemPrompt)` that calls `POST {config.baseUrl}/chat/completions`
- Use `buildOpenAIContent()` as the sole content builder (already uses `image_url` format)
- Conditionally include `Authorization: Bearer ${apiKey}` header only when `apiKey` is non-empty
- **Remove `reasoning_effort: 'low'`** — OpenAI-specific, causes 400 errors on other providers
- Keep `max_completion_tokens: 16384` (supported by OpenAI and most providers; local providers that don't support it ignore it)
- Keep `response_format: { type: 'json_schema', json_schema: { name: 'transactions', strict: true, schema: TRANSACTION_SCHEMA } }` — supported by OpenAI (natively) and Ollama/LM Studio/vLLM (via grammar-based constrained decoding)
- Keep `temperature: 0` for deterministic output across providers

**Critical constraint:** The `TRANSACTION_SCHEMA` in `prompt.ts` must comply with OpenAI's strict mode limits (all fields required, `additionalProperties: false`, max 5 nesting levels, max 100 properties). It already does.

**Files changed:**
- `addon/src/services/ai.ts` — major rewrite (~120 lines removed, ~20 added)
- `addon/src/services/prompt.ts` — no changes needed
- `addon/src/services/ai.test.ts` — update any imports that reference removed types; existing parsing/validation tests remain unchanged

### Phase 2: Settings UI Redesign (R2, R3, R4)

Rewrite `addon/src/components/Settings.tsx` with the new field layout.

**Default view (no Advanced toggle):**
1. **API Key** — password input with show/hide toggle (existing pattern). Optional — placeholder text: "Optional for local providers"
2. **Test Connection** button — fetches `GET {baseUrl}/models`, shows loading spinner, populates model combobox on success
3. **Model** — searchable combobox (new component) or free-text input (fallback)

**Advanced view (toggle expanded):**
4. **Base URL** — text input, pre-filled with `https://api.openai.com/v1`. Placeholder: "https://api.openai.com/v1"

**Date Format** dropdown remains unchanged below all AI settings.

**Privacy notice:** Update from "Only sent to {Anthropic|OpenAI}" to "Only sent to your configured AI endpoint" or show the base URL domain.

#### Combobox Component (`addon/src/components/ModelCombobox.tsx`)

New hand-written React component (no external dependencies — project uses no UI library). Behavior:

- **Input field** with type-to-filter functionality
- **Dropdown list** appears on focus when models are loaded
- **Two sections:** "Recommended" (from allowlist) at top, separator, "All Models" below (shown via toggle)
- If no recommended models match, show all models directly
- If `/models` fetch failed, render as a plain `<input>` (free-text mode)
- Keyboard navigation: arrow keys, enter to select, escape to close
- Styled with project's CSS custom properties (`--border`, `--background`, `--foreground`, etc.)

#### Curated Allowlist (`addon/src/services/models.ts`)

New file with a simple array:

```typescript
export const RECOMMENDED_MODELS = [
  'gpt-5.4-mini',
  'gpt-5.4',
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4o',
  'gpt-4o-mini',
];
```

These models are confirmed to support both vision (`image_url` content blocks) and structured output (`response_format: json_schema`). Updated with addon releases.

#### Test Connection Flow

1. User clicks "Test Connection" button
2. Button shows loading state (spinner + disabled)
3. `GET {baseUrl}/models` fires with optional `Authorization` header
4. **On success:** Parse `response.data` array, extract `id` field from each entry. Cross-reference with `RECOMMENDED_MODELS`. Populate combobox.
5. **On CORS/network error:** Show error message (see R7 handling below). Combobox degrades to free-text.
6. **On HTTP error (401, 403, etc.):** Show specific error via existing `apiError()` pattern. Combobox degrades to free-text.

#### fetchModels Function (`addon/src/services/ai.ts`)

```typescript
export async function fetchModels(baseUrl: string, apiKey: string): Promise<string[]> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/models`, { headers });
  if (!response.ok) throw apiError(response.status, await response.text());

  const data = await response.json();
  return (data.data ?? []).map((m: { id: string }) => m.id).sort();
}
```

**Files changed:**
- `addon/src/components/Settings.tsx` — major rewrite
- `addon/src/components/ModelCombobox.tsx` — new file
- `addon/src/services/models.ts` — new file (curated allowlist)
- `addon/src/services/ai.ts` — add `fetchModels()` + `normalizeBaseUrl()`

### Phase 3: Base URL Validation & Normalization

Add a `normalizeBaseUrl(url: string): string` utility in `ai.ts`:

- Strip trailing slashes
- If URL does not start with `http://` or `https://`, prepend `http://` for localhost/private IPs, `https://` otherwise
- Log a console warning (via logger) if URL does not end in `/v1` (common misconfiguration) but do not block — some providers use different paths

**Behavior on Base URL change:** Clear the saved model name from secrets and reset the combobox. The old model name is meaningless for a different provider.

### Phase 4: Settings Migration (R6)

Add migration logic to `Settings.tsx` `useEffect` on mount (or a dedicated `migrateSettings()` function).

**Migration detection:** Check for existence of the old `provider` secret key. If it exists, migration has not run.

**Migration logic:**
```
if secrets.get('provider') exists:
  oldProvider = secrets.get('provider')
  oldApiKey = secrets.get('api-key')

  if oldProvider === 'openai':
    secrets.set('base-url', 'https://api.openai.com/v1')
    secrets.set('model', 'gpt-5.4-mini')
    // api-key already exists with the correct key name
  else if oldProvider === 'anthropic':
    secrets.delete('api-key')
    // Show a one-time dismissible banner:
    // "Anthropic native API has been removed. Please configure an OpenAI-compatible endpoint."

  secrets.delete('provider')  // Remove old key, marks migration as complete
  // date-format is preserved (different key, untouched)
```

**Idempotency:** Migration runs only when the `provider` key exists. Deleting it at the end marks migration as complete. No separate version flag needed — the absence of the old key is the sentinel.

**Date format preservation:** The `date-format` secret uses a separate key and is never touched by migration.

**Files changed:**
- `addon/src/components/Settings.tsx` — add migration in `useEffect`

### Phase 5: CORS Error Handling (R7)

**Detection heuristic:** When `fetch()` throws a `TypeError` (the only error type for CORS failures), apply this heuristic:

- If the base URL points to `localhost`, `127.0.0.1`, `0.0.0.0`, or a private IP range (`192.168.*`, `10.*`, `172.16-31.*`): likely CORS. Show CORS-specific guidance.
- Otherwise: show generic network error guidance.

**CORS error messages by detected provider:**

| URL pattern | Message |
|---|---|
| `:11434` (Ollama default port) | "Cannot reach Ollama. Set `OLLAMA_ORIGINS` to include this app's origin. See Ollama docs." |
| `:1234` (LM Studio default port) | "Cannot reach LM Studio. Enable CORS in Developer > Local Server settings." |
| Other localhost | "Cannot reach the local server. Ensure CORS is enabled and the server is running." |
| Remote URL | "Cannot reach the server. Check the URL and your network connection." |

**Files changed:**
- `addon/src/services/ai.ts` — add `isCorsLikelyError()` helper and CORS error message map

### Phase 6: State Flow Update

Update `ImporterPage.tsx` to pass the new `AIConfig` object instead of `provider` + `apiKey`:

**Current state (lines 20-21):**
```typescript
const [provider, setProvider] = useState<Provider>('anthropic');
const [apiKey, setApiKey] = useState('');
```

**New state:**
```typescript
const [aiConfig, setAiConfig] = useState<AIConfig>({
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: '',
});
```

Update `extractTransactions()` signature to accept `AIConfig` instead of `Provider` + `apiKey`.

**Files changed:**
- `addon/src/components/ImporterPage.tsx` — state shape change, props update
- `addon/src/services/ai.ts` — `extractTransactions()` signature change

## System-Wide Impact

- **Interaction graph**: Settings save → SecretsAPI.set → persisted. Test Connection → fetch /models → populate combobox → user selects → save model to secrets. Extract → fetch /chat/completions → parse response → review table. No callbacks or observers.
- **Error propagation**: fetch errors → caught in extraction/test-connection → displayed as user-facing messages. No retry logic. No silent failures.
- **State lifecycle risks**: Migration deletes `provider` key as final step. If interrupted mid-migration, old `provider` key still exists, so migration re-runs on next load (safe — idempotent writes).
- **API surface parity**: The addon has no other interfaces — this is the only entry point.
- **Integration test scenarios**: (1) Migrate from OpenAI → extract with migrated settings. (2) Configure Ollama → Test Connection → select model → extract. (3) CORS failure on localhost → see guidance → fix → retry.

## Acceptance Criteria

- [ ] Single code path: no Anthropic-specific code remains in `ai.ts`
- [ ] Settings UI: API Key + Model visible by default, Base URL behind Advanced toggle
- [ ] Test Connection: fetches /models, populates searchable combobox with recommended models shown first
- [ ] Free-text fallback: if /models fails, model field becomes a text input
- [ ] API key optional: omit Authorization header when empty
- [ ] Base URL change clears saved model
- [ ] Migration: old `openai` users auto-migrated, old `anthropic` users see dismissible banner
- [ ] Migration: `date-format` preserved
- [ ] CORS errors: localhost URLs show provider-specific guidance
- [ ] Extraction works with OpenAI (gpt-5.4-mini) end-to-end
- [ ] Extraction works with Ollama (llama3.2-vision) end-to-end (manual testing)
- [ ] No `reasoning_effort` in request body
- [ ] `RECOMMENDED_MODELS` array exists in `models.ts`
- [ ] Existing `ai.test.ts` tests pass (parsing/validation logic unchanged)

## Success Metrics

- Code reduction: ~120 lines removed from `ai.ts` (two content builders, two API callers, dispatcher)
- One new component (`ModelCombobox.tsx`), one new config file (`models.ts`)
- Settings UI has fewer decisions for the user (no provider dropdown — just key + model)

## Dependencies & Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Combobox UX is clunky (no UI library) | Medium | Keep it minimal — input + dropdown list + keyboard nav. Style with host app CSS vars. |
| Ollama structured output quality is lower than OpenAI | Medium | Existing `validateTransaction()` catches invalid fields. Document that local models may produce lower quality results. |
| OpenAI adds new models not in allowlist | Certain (over time) | "Show all models" toggle always available. Update allowlist in releases. |
| Migration corrupts settings for edge-case users | Low | Migration is idempotent. Only writes if old `provider` key exists. Preserves unrelated secrets. |
| Some providers reject `max_completion_tokens` | Low | Most ignore unknown fields. If reports come in, can conditionally use `max_tokens` for non-OpenAI URLs. |

## Sources & References

### Origin

- **Origin document:** [docs/brainstorms/2026-04-07-unified-openai-compatible-api-requirements.md](docs/brainstorms/2026-04-07-unified-openai-compatible-api-requirements.md) — Key decisions: drop Anthropic native API, require structured output, curated allowlist with "Show all" toggle, explicit Test Connection button, optional API key, Advanced toggle for Base URL.

### Internal References

- Current dual-provider code: `addon/src/services/ai.ts` (full file — primary refactor target)
- Settings component: `addon/src/components/Settings.tsx` (full file — UI rewrite)
- State owner: `addon/src/components/ImporterPage.tsx:20-31` (provider/apiKey state)
- SecretsAPI interface: `addon/src/types.ts:43-47`
- System prompt & schema: `addon/src/services/prompt.ts`
- Existing tests: `addon/src/services/ai.test.ts`
- Documented CORS/SDK gotcha: `docs/solutions/integration-issues/ai-vision-extraction-for-financial-documents.md`

### External References

- OpenAI Structured Outputs Guide: https://developers.openai.com/api/docs/guides/structured-outputs
- Ollama OpenAI Compatibility: https://docs.ollama.com/api/openai-compatibility
- Ollama Structured Outputs: https://docs.ollama.com/capabilities/structured-outputs
- Ollama CORS (OLLAMA_ORIGINS): https://docs.ollama.com/faq
- LM Studio OpenAI-Compatible Endpoints: https://lmstudio.ai/docs/developer/openai-compat
- LM Studio CORS Bug (Chromium): https://github.com/lmstudio-ai/lmstudio-bug-tracker/issues/392
- vLLM OpenAI-Compatible Server: https://docs.vllm.ai/en/stable/serving/openai_compatible_server/

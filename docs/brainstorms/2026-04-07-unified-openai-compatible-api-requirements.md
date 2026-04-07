---
date: 2026-04-07
topic: unified-openai-compatible-api
---

# Unified OpenAI-Compatible API Configuration

## Problem Frame

The addon currently hardcodes two AI providers (Anthropic and OpenAI) with separate code paths for API calls, content building, and response parsing. This limits users to exactly two providers and requires maintaining duplicate logic. Users who want to use Ollama, LM Studio, vLLM, or any other OpenAI-compatible provider are locked out.

## Requirements

- R1. **Single API interface:** Replace the dual-provider architecture with a single OpenAI-compatible chat completions API client. Remove the native Anthropic API code path entirely. Image inputs use the OpenAI `image_url` content block format (base64 data URLs).
- R2. **Settings UI:** Show API Key and Model fields by default. An "Advanced" toggle reveals a Base URL field (pre-filled with `https://api.openai.com/v1`). API Key is optional — leave empty for providers that don't require authentication (e.g., local Ollama).
- R3. **Dynamic model list via Test Connection:** A "Test Connection" button fetches available models from `GET {baseURL}/models`. On success, show a searchable/filterable combobox dropdown. On failure, degrade to a free-text input for manual model name entry. Always re-fetch on button click (no caching). The saved model name persists across sessions and displays on load without requiring a fetch.
- R4. **Curated model allowlist:** Maintain a hardcoded array of recommended model IDs in the codebase. After fetching models, show only those matching the allowlist by default ("Recommended" view). A "Show all models" toggle reveals the full list. If no recommended models match the provider's list (e.g., Ollama with custom models), show all models by default.
- R5. **Structured output required:** Use OpenAI's `response_format: { type: 'json_schema', ... }` for all extraction requests. Do not implement prompt-based JSON fallbacks. Providers that don't support structured outputs are unsupported.
- R6. **Migrate stored settings:** On first load after update, migrate existing `provider` and `api-key` secrets to the new schema (base URL, API key, model). Map the old `openai` provider to the OpenAI base URL with `gpt-5.4-mini` as default model. For old `anthropic` provider, clear the stored settings so the user reconfigures on next use.
- R7. **CORS error handling:** Detect CORS errors from custom endpoints and display a clear, actionable error message explaining how to configure the provider's CORS settings (e.g., `OLLAMA_ORIGINS` for Ollama). The addon runs client-side in both desktop and self-hosted web contexts, so CORS is enforced by the browser.

## Success Criteria

- Any OpenAI-compatible endpoint (OpenAI, Ollama, LM Studio, etc.) can be used for extraction by configuring base URL + API key + model
- The settings UI is simpler than the current dual-provider dropdown
- The codebase has one API call path instead of two
- CORS errors produce helpful, actionable guidance

## Scope Boundaries

- Native Anthropic API support is deliberately removed (users can access Claude via OpenAI-compatible proxies like OpenRouter or LiteLLM)
- Azure OpenAI is out of scope (non-standard URL scheme; users can use LiteLLM or similar proxies)
- No automatic model capability detection — user picks the model (curated allowlist highlights known-good options but does not auto-select)
- No provider-specific logic or special-casing beyond the curated allowlist
- No prompt-based JSON extraction fallback

## Key Decisions

- **Drop Anthropic native API:** Simplifies code significantly. Users who want Claude can use OpenRouter or similar proxies that expose an OpenAI-compatible interface.
- **Structured output required:** Keeps extraction reliable without complex JSON parsing fallbacks. Limits provider compatibility but maintains quality.
- **Explicit "Test Connection" button:** User clicks to validate connection and load models. Doubles as connection verification. No auto-fetch on input change.
- **Curated allowlist with "Show all" toggle:** Default view shows only recommended models (matched from a hardcoded list). "Show all models" toggle reveals the full provider list. Keeps the initial experience clean while retaining full access.
- **Searchable combobox for models:** Handles large model lists with type-to-filter. Degrades to free-text when /models endpoint is unavailable.
- **Advanced toggle for Base URL:** Keeps the default experience clean (just API Key + Model) while giving power users full control.
- **Azure OpenAI out of scope:** Non-standard URL pattern adds complexity. Users can proxy via LiteLLM.
- **Optional API key:** Supports local providers (Ollama, LM Studio) that don't need authentication. Omit Authorization header when key is empty.

## Outstanding Questions

### Deferred to Planning

- [Affects R3][Needs research] Do all target providers (Ollama, LM Studio, vLLM) implement the `GET /models` endpoint with the same response shape as OpenAI?
- [Affects R4][Technical] What models should be in the initial curated allowlist? Needs research on which models support both vision and structured output.
- [Affects R6][Technical] What is the best UX for the Anthropic migration — show a one-time notification explaining the change, or silently clear and let the user discover the new settings?
- [Affects R7][Needs research] What are the specific CORS configuration steps for common providers (Ollama, LM Studio, vLLM) to include in error messages?

## Next Steps

-> `/ce:plan` for structured implementation planning

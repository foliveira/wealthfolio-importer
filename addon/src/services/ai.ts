import { SYSTEM_PROMPT, USER_PROMPT, TRANSACTION_SCHEMA, ACTIVITY_TYPES, type ExtractedTransaction } from './prompt';

export type Provider = 'anthropic' | 'openai';

interface ImageInput {
  base64: string;
  mediaType: string;
}

type AnthropicContentBlock =
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'text'; text: string };

type OpenAIContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail: 'high' } };

interface AnthropicResponse {
  content?: Array<{ text?: string }>;
  error?: { message?: string };
}

interface OpenAIResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}

export async function extractTransactions(
  provider: Provider,
  apiKey: string,
  images: ImageInput[],
  signal?: AbortSignal,
): Promise<ExtractedTransaction[]> {
  if (provider === 'anthropic') {
    return extractWithAnthropic(apiKey, images, signal);
  }
  return extractWithOpenAI(apiKey, images, signal);
}

async function extractWithAnthropic(
  apiKey: string,
  images: ImageInput[],
  signal?: AbortSignal,
): Promise<ExtractedTransaction[]> {
  const content: AnthropicContentBlock[] = [];
  for (const img of images) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: img.mediaType, data: img.base64 },
    });
  }
  content.push({ type: 'text', text: USER_PROMPT });

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    }),
    signal,
  });

  if (!res.ok) {
    const body: AnthropicResponse = await res.json().catch(() => ({}));
    throw apiError(res.status, body.error?.message || res.statusText);
  }

  const data: AnthropicResponse = await res.json();
  const text = data.content?.[0]?.text;
  return parseResponse(text);
}

async function extractWithOpenAI(
  apiKey: string,
  images: ImageInput[],
  signal?: AbortSignal,
): Promise<ExtractedTransaction[]> {
  const content: OpenAIContentBlock[] = [{ type: 'text', text: USER_PROMPT }];
  for (const img of images) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:${img.mediaType};base64,${img.base64}`, detail: 'high' },
    });
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-5.4-mini',
      max_completion_tokens: 4096,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'transactions', strict: true, schema: TRANSACTION_SCHEMA },
      },
    }),
    signal,
  });

  if (!res.ok) {
    const body: OpenAIResponse = await res.json().catch(() => ({}));
    throw apiError(res.status, body.error?.message || res.statusText);
  }

  const data: OpenAIResponse = await res.json();
  const text = data.choices?.[0]?.message?.content;
  return parseResponse(text);
}

function parseResponse(text: string | undefined | null): ExtractedTransaction[] {
  if (!text) throw new Error('Empty response from AI provider.');

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    const stripped = text.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '');
    try {
      parsed = JSON.parse(stripped);
    } catch {
      throw new Error('Could not parse AI response as JSON. Please try again with a clearer document.');
    }
  }

  const transactions = Array.isArray(parsed)
    ? parsed
    : typeof parsed === 'object' && parsed !== null && 'transactions' in parsed
      ? (parsed as Record<string, unknown>).transactions
      : undefined;

  if (!Array.isArray(transactions)) {
    throw new Error('Unexpected response structure. Expected a "transactions" array.');
  }

  return transactions.map(validateTransaction);
}

function validateTransaction(t: unknown): ExtractedTransaction {
  const obj = (typeof t === 'object' && t !== null ? t : {}) as Record<string, unknown>;
  return {
    date: typeof obj.date === 'string' ? obj.date : '',
    symbol: typeof obj.symbol === 'string' ? obj.symbol : '',
    quantity: typeof obj.quantity === 'number' && isFinite(obj.quantity) ? Math.max(0, obj.quantity) : 0,
    activityType: (ACTIVITY_TYPES as readonly string[]).includes(obj.activityType as string)
      ? (obj.activityType as ExtractedTransaction['activityType'])
      : 'BUY',
    unitPrice: typeof obj.unitPrice === 'number' && isFinite(obj.unitPrice) ? Math.max(0, obj.unitPrice) : 0,
    currency: typeof obj.currency === 'string' && obj.currency.length <= 5 ? obj.currency : 'USD',
    fee: typeof obj.fee === 'number' && isFinite(obj.fee) ? Math.max(0, obj.fee) : 0,
    amount: typeof obj.amount === 'number' && isFinite(obj.amount) ? obj.amount : 0,
  };
}

function apiError(status: number, message: string): Error {
  if (status === 401) return new Error('Invalid API key. Please check your key in Settings.');
  if (status === 429) return new Error('Rate limited. Please wait a moment and try again.');
  if (status === 403) return new Error('Access denied. Check your API key permissions.');
  return new Error(`API error (${status}): ${message}`);
}

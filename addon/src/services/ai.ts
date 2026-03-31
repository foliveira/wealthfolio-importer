import { SYSTEM_PROMPT, USER_PROMPT, TRANSACTION_SCHEMA, ACTIVITY_TYPES, type ExtractedTransaction } from './prompt';

export type Provider = 'anthropic' | 'openai';

interface ImageInput {
  base64: string;
  mediaType: string;
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
  const content: unknown[] = [];
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
    const body = await res.json().catch(() => ({}));
    throw apiError(res.status, (body as { error?: { message?: string } }).error?.message || res.statusText);
  }

  const data = await res.json();
  const text = (data as { content?: { text?: string }[] }).content?.[0]?.text;
  return parseResponse(text);
}

async function extractWithOpenAI(
  apiKey: string,
  images: ImageInput[],
  signal?: AbortSignal,
): Promise<ExtractedTransaction[]> {
  const content: unknown[] = [{ type: 'text', text: USER_PROMPT }];
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
    const body = await res.json().catch(() => ({}));
    throw apiError(res.status, (body as { error?: { message?: string } }).error?.message || res.statusText);
  }

  const data = await res.json();
  const text = (data as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content;
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
      throw new Error(`Could not parse AI response.\n\n${text.slice(0, 1000)}`);
    }
  }

  const transactions = Array.isArray(parsed)
    ? parsed
    : (parsed as { transactions?: unknown[] }).transactions;

  if (!Array.isArray(transactions)) {
    throw new Error(`Unexpected response structure.\n\n${JSON.stringify(parsed).slice(0, 1000)}`);
  }

  return transactions.map(validateTransaction);
}

function validateTransaction(t: Record<string, unknown>): ExtractedTransaction {
  return {
    date: typeof t.date === 'string' ? t.date : '',
    symbol: typeof t.symbol === 'string' ? t.symbol : '',
    quantity: typeof t.quantity === 'number' && isFinite(t.quantity) ? t.quantity : 0,
    activityType: (ACTIVITY_TYPES as readonly string[]).includes(t.activityType as string)
      ? (t.activityType as ExtractedTransaction['activityType'])
      : 'BUY',
    unitPrice: typeof t.unitPrice === 'number' && isFinite(t.unitPrice) ? t.unitPrice : 0,
    currency: typeof t.currency === 'string' && t.currency.length <= 5 ? t.currency : 'USD',
    fee: typeof t.fee === 'number' && isFinite(t.fee) ? t.fee : 0,
    amount: typeof t.amount === 'number' && isFinite(t.amount) ? t.amount : 0,
  };
}

function apiError(status: number, message: string): Error {
  if (status === 401) return new Error('Invalid API key. Please check your key in Settings.');
  if (status === 429) return new Error('Rate limited. Please wait a moment and try again.');
  if (status === 403) return new Error('Access denied. Check your API key permissions.');
  return new Error(`API error (${status}): ${message}`);
}

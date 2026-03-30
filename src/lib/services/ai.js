import { SYSTEM_PROMPT, USER_PROMPT, TRANSACTION_SCHEMA } from '$lib/prompt.js';

/**
 * Extract transactions from images using the selected AI provider.
 * @param {'anthropic'|'openai'} provider
 * @param {string} apiKey
 * @param {{ base64: string, mediaType: string }[]} images
 * @param {AbortSignal} [signal]
 * @returns {Promise<object[]>}
 */
export async function extractTransactions(provider, apiKey, images, signal) {
	if (provider === 'anthropic') {
		return extractWithAnthropic(apiKey, images, signal);
	}
	return extractWithOpenAI(apiKey, images, signal);
}

async function extractWithAnthropic(apiKey, images, signal) {
	const content = [];
	for (const img of images) {
		content.push({
			type: 'image',
			source: {
				type: 'base64',
				media_type: img.mediaType,
				data: img.base64
			}
		});
	}
	content.push({ type: 'text', text: USER_PROMPT });

	const res = await fetch('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: {
			'x-api-key': apiKey,
			'anthropic-version': '2023-06-01',
			'content-type': 'application/json',
			'anthropic-dangerous-direct-browser-access': 'true'
		},
		body: JSON.stringify({
			model: 'claude-sonnet-4-5-20250514',
			max_tokens: 4096,
			system: SYSTEM_PROMPT,
			messages: [{ role: 'user', content }]
		}),
		signal
	});

	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		throw apiError(res.status, body.error?.message || res.statusText);
	}

	const data = await res.json();
	const text = data.content?.[0]?.text;
	return parseResponse(text);
}

async function extractWithOpenAI(apiKey, images, signal) {
	const content = [{ type: 'text', text: USER_PROMPT }];
	for (const img of images) {
		content.push({
			type: 'image_url',
			image_url: {
				url: `data:${img.mediaType};base64,${img.base64}`,
				detail: 'high'
			}
		});
	}

	const res = await fetch('https://api.openai.com/v1/chat/completions', {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${apiKey}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			model: 'gpt-5.4-mini',
			max_completion_tokens: 4096,
			messages: [
				{ role: 'system', content: SYSTEM_PROMPT },
				{ role: 'user', content }
			],
			response_format: {
				type: 'json_schema',
				json_schema: {
					name: 'transactions',
					strict: true,
					schema: TRANSACTION_SCHEMA
				}
			}
		}),
		signal
	});

	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		throw apiError(res.status, body.error?.message || res.statusText);
	}

	const data = await res.json();
	const text = data.choices?.[0]?.message?.content;
	return parseResponse(text);
}

function parseResponse(text) {
	if (!text) throw new Error('Empty response from AI provider. The model returned no content.');

	let parsed;

	// Try direct parse first
	try {
		parsed = JSON.parse(text);
	} catch {
		// Fallback: strip markdown code fences
		const stripped = text.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '');
		try {
			parsed = JSON.parse(stripped);
		} catch {
			throw new Error(`Could not parse AI response as JSON.\n\nRaw output:\n${text.slice(0, 1000)}`);
		}
	}

	// Handle both { transactions: [...] } and direct array [...]
	const transactions = Array.isArray(parsed) ? parsed : parsed.transactions;

	if (!Array.isArray(transactions)) {
		throw new Error(`Unexpected response structure. Expected "transactions" array.\n\nParsed output:\n${JSON.stringify(parsed).slice(0, 1000)}`);
	}

	return transactions;
}

function apiError(status, message) {
	if (status === 401) return new Error('Invalid API key. Please check your key in Settings.');
	if (status === 429) return new Error('Rate limited. Please wait a moment and try again.');
	if (status === 403) return new Error('Access denied. Your API key may not have the required permissions.');
	return new Error(`API error (${status}): ${message}`);
}

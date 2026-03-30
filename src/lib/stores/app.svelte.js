const STORAGE_KEY = 'wealthfolio-importer';

function loadSettings() {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) return JSON.parse(stored);
	} catch {
		// ignore
	}
	return { provider: 'anthropic', apiKey: '' };
}

function saveSettings(provider, apiKey) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify({ provider, apiKey }));
	} catch {
		// ignore (e.g. incognito mode)
	}
}

function createAppState() {
	const saved = loadSettings();

	let provider = $state(saved.provider);
	let apiKey = $state(saved.apiKey);
	let transactions = $state([]);
	let step = $state('upload'); // 'upload' | 'extracting' | 'review'
	let error = $state('');
	let extractionAbort = $state(null);

	return {
		get provider() { return provider; },
		set provider(v) { provider = v; saveSettings(v, apiKey); },

		get apiKey() { return apiKey; },
		set apiKey(v) { apiKey = v; saveSettings(provider, v); },

		get transactions() { return transactions; },
		set transactions(v) { transactions = v; },

		get step() { return step; },
		set step(v) { step = v; },

		get error() { return error; },
		set error(v) { error = v; },

		get extractionAbort() { return extractionAbort; },
		set extractionAbort(v) { extractionAbort = v; },

		get isConfigured() { return apiKey.length > 0; },

		reset() {
			transactions = [];
			step = 'upload';
			error = '';
			extractionAbort = null;
		},

		clearSettings() {
			apiKey = '';
			provider = 'anthropic';
			try { localStorage.removeItem(STORAGE_KEY); } catch {}
		}
	};
}

export const app = createAppState();

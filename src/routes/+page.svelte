<script>
	import { app } from '$lib/stores/app.svelte.js';
	import Settings from '$lib/components/Settings.svelte';
	import Upload from '$lib/components/Upload.svelte';
	import ReviewTable from '$lib/components/ReviewTable.svelte';
	import { extractTransactions } from '$lib/services/ai.js';

	let fileName = $state('');
	let pageWarning = $state('');

	async function handleFile(file) {
		app.error = '';
		pageWarning = '';
		fileName = file.name;

		if (!app.isConfigured) {
			app.error = 'Please enter your API key in Settings first.';
			return;
		}

		app.step = 'extracting';

		try {
			let images = [];

			if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
				const { pdfToImages } = await import('$lib/services/pdf.js');
				const result = await pdfToImages(file);
				if (result.pageCount > 5) {
					pageWarning = `Processing ${result.pageCount} pages. This may take longer and use more API credits.`;
				}
				images = result.images.map((base64) => ({ base64, mediaType: 'image/jpeg' }));
			} else {
				const { imageToBase64, getMediaType } = await import('$lib/services/pdf.js');
				const base64 = await imageToBase64(file);
				images = [{ base64, mediaType: getMediaType(file) }];
			}

			const abort = new AbortController();
			app.extractionAbort = abort;

			const transactions = await extractTransactions(
				app.provider,
				app.apiKey,
				images,
				abort.signal
			);

			app.transactions = transactions;
			app.step = 'review';
		} catch (err) {
			if (err.name === 'AbortError') {
				app.step = 'upload';
				return;
			}
			app.error = err.message;
			app.step = 'upload';
		} finally {
			app.extractionAbort = null;
		}
	}

	function cancelExtraction() {
		app.extractionAbort?.abort();
	}

	function startOver() {
		app.reset();
		fileName = '';
		pageWarning = '';
	}
</script>

<Settings />

{#if app.step === 'upload'}
	<Upload onfile={handleFile} />
{/if}

{#if app.step === 'extracting'}
	<div class="card extracting">
		<div class="spinner"></div>
		<p>Extracting transactions from <strong>{fileName}</strong>...</p>
		{#if pageWarning}
			<p class="warning">{pageWarning}</p>
		{/if}
		<button class="btn-secondary" onclick={cancelExtraction}>Cancel</button>
	</div>
{/if}

{#if app.step === 'review'}
	<ReviewTable bind:transactions={app.transactions} onstartover={startOver} />
{/if}

{#if app.error}
	<div class="error">{app.error}</div>
{/if}

<style>
	.extracting {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 3rem 1.5rem;
		text-align: center;
	}

	.spinner {
		width: 2rem;
		height: 2rem;
		border: 3px solid var(--color-border);
		border-top-color: var(--color-primary);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}
</style>

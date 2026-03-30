<script>
	const ACCEPTED_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
	const ACCEPTED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg'];
	const MAX_SIZE_MB = 20;
	const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

	let { onfile } = $props();
	let dragging = $state(false);
	let error = $state('');

	function validate(file) {
		if (!file) return 'No file selected.';
		const ext = '.' + file.name.split('.').pop().toLowerCase();
		if (!ACCEPTED_TYPES.includes(file.type) && !ACCEPTED_EXTENSIONS.includes(ext)) {
			return `Unsupported file type. Please upload a PDF, PNG, or JPEG file.`;
		}
		if (file.size > MAX_SIZE_BYTES) {
			return `File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is ${MAX_SIZE_MB}MB.`;
		}
		return null;
	}

	function handleFile(file) {
		error = '';
		const err = validate(file);
		if (err) {
			error = err;
			return;
		}
		onfile(file);
	}

	function ondrop(e) {
		e.preventDefault();
		dragging = false;
		const file = e.dataTransfer?.files?.[0];
		if (file) handleFile(file);
	}

	function ondragover(e) {
		e.preventDefault();
		dragging = true;
	}

	function ondragleave() {
		dragging = false;
	}

	function onchange(e) {
		const file = e.target.files?.[0];
		if (file) handleFile(file);
	}
</script>

<div class="card">
	<h2>Upload Document</h2>

	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="dropzone"
		class:dragging
		{ondrop}
		{ondragover}
		{ondragleave}
		onclick={() => document.getElementById('file-input').click()}
		onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') document.getElementById('file-input').click(); }}
		role="button"
		tabindex="0"
	>
		<p class="dropzone-text">Drop a PDF or image here, or click to browse</p>
		<p class="muted">Supports PDF, PNG, JPEG — up to {MAX_SIZE_MB}MB</p>
	</div>

	<input
		id="file-input"
		type="file"
		accept={ACCEPTED_EXTENSIONS.join(',')}
		{onchange}
		hidden
	/>

	{#if error}
		<p class="error">{error}</p>
	{/if}
</div>

<style>
	.dropzone {
		border: 2px dashed var(--color-border);
		border-radius: var(--radius);
		padding: 3rem 1.5rem;
		text-align: center;
		cursor: pointer;
		transition: border-color 0.15s, background 0.15s;
	}

	.dropzone:hover, .dragging {
		border-color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 5%, transparent);
	}

	.dropzone-text {
		font-weight: 500;
		margin-bottom: 0.25rem;
	}

	.error {
		margin-top: 0.75rem;
	}
</style>

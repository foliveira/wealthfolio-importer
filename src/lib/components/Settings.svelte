<script>
	import { app } from '$lib/stores/app.svelte.js';

	let showKey = $state(false);
</script>

<div class="card settings">
	<h2>Settings</h2>

	<div class="field">
		<label for="provider">AI Provider</label>
		<select id="provider" bind:value={app.provider}>
			<option value="anthropic">Anthropic (Claude)</option>
			<option value="openai">OpenAI (GPT-4o)</option>
		</select>
	</div>

	<div class="field">
		<label for="apiKey">API Key</label>
		<div class="key-input">
			{#if showKey}
				<input id="apiKey" type="text" bind:value={app.apiKey} placeholder="Enter your API key..." />
			{:else}
				<input id="apiKey" type="password" bind:value={app.apiKey} placeholder="Enter your API key..." />
			{/if}
			<button class="btn-secondary toggle" onclick={() => showKey = !showKey}>
				{showKey ? 'Hide' : 'Show'}
			</button>
		</div>
		<p class="muted">Your key is stored locally and only sent to {app.provider === 'anthropic' ? 'Anthropic' : 'OpenAI'}.</p>
	</div>

	{#if app.apiKey}
		<button class="btn-danger" onclick={() => app.clearSettings()}>Clear Settings</button>
	{/if}
</div>

<style>
	.settings {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.key-input {
		display: flex;
		gap: 0.5rem;
	}

	.key-input input {
		flex: 1;
	}

	.toggle {
		flex-shrink: 0;
		width: 4rem;
	}
</style>

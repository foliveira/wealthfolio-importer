<script>
	import '../app.css';
	let { children } = $props();
</script>

<div class="container">
	<header>
		<h1>Wealthfolio Importer</h1>
		<p class="muted">Extract transactions from PDFs & images using AI</p>
	</header>
	<main>
		{@render children()}
	</main>
</div>

<style>
	header {
		margin-bottom: 1.5rem;
	}

	main {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
</style>

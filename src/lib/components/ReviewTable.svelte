<script>
	import { ACTIVITY_TYPES } from '$lib/prompt.js';
	import { generateCSV, downloadCSV } from '$lib/services/csv.js';

	let { transactions = $bindable(), onstartover } = $props();

	function addRow() {
		transactions = [...transactions, {
			date: new Date().toISOString(),
			symbol: '',
			quantity: 0,
			activityType: 'BUY',
			unitPrice: 0,
			currency: 'USD',
			fee: 0,
			amount: 0
		}];
	}

	function deleteRow(index) {
		transactions = transactions.filter((_, i) => i !== index);
	}

	function handleDownload() {
		const csv = generateCSV(transactions);
		downloadCSV(csv);
	}
</script>

<div class="card review">
	<div class="review-header">
		<h2>Review Transactions ({transactions.length})</h2>
		<div class="review-actions">
			<button class="btn-secondary" onclick={addRow}>+ Add Row</button>
			<button class="btn-primary" onclick={handleDownload} disabled={transactions.length === 0}>
				Download CSV
			</button>
		</div>
	</div>

	{#if transactions.length === 0}
		<p class="muted">No transactions extracted. You can add rows manually or try a different document.</p>
	{:else}
		<div class="table-wrapper">
			<table>
				<thead>
					<tr>
						<th>Date</th>
						<th>Symbol</th>
						<th>Qty</th>
						<th>Type</th>
						<th>Unit Price</th>
						<th>Currency</th>
						<th>Fee</th>
						<th>Amount</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{#each transactions as row, i}
						<tr>
							<td><input type="text" bind:value={row.date} class="col-date" /></td>
							<td><input type="text" bind:value={row.symbol} class="col-symbol" /></td>
							<td><input type="number" bind:value={row.quantity} step="any" class="col-num" /></td>
							<td>
								<select bind:value={row.activityType}>
									{#each ACTIVITY_TYPES as t}
										<option value={t}>{t}</option>
									{/each}
								</select>
							</td>
							<td><input type="number" bind:value={row.unitPrice} step="any" class="col-num" /></td>
							<td><input type="text" bind:value={row.currency} class="col-currency" /></td>
							<td><input type="number" bind:value={row.fee} step="any" class="col-num" /></td>
							<td><input type="number" bind:value={row.amount} step="any" class="col-num" /></td>
							<td>
								<button class="btn-delete" onclick={() => deleteRow(i)} title="Delete row">&times;</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	<div class="bottom-actions">
		<button class="btn-secondary" onclick={onstartover}>Start Over</button>
	</div>
</div>

<style>
	.review {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.review-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.review-actions {
		display: flex;
		gap: 0.5rem;
	}

	.table-wrapper {
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.8125rem;
	}

	th {
		text-align: left;
		padding: 0.5rem 0.25rem;
		border-bottom: 2px solid var(--color-border);
		font-weight: 600;
		white-space: nowrap;
	}

	td {
		padding: 0.25rem;
		border-bottom: 1px solid var(--color-border);
	}

	td input, td select {
		font-size: 0.8125rem;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
	}

	.col-date { width: 11rem; min-width: 11rem; }
	.col-symbol { width: 6rem; min-width: 5rem; }
	.col-num { width: 6rem; min-width: 5rem; }
	.col-currency { width: 4rem; min-width: 3.5rem; }

	td select {
		width: 8rem;
		min-width: 7rem;
	}

	.btn-delete {
		background: none;
		color: var(--color-error);
		font-size: 1.25rem;
		line-height: 1;
		padding: 0.125rem 0.5rem;
	}

	.btn-delete:hover {
		background: var(--color-error);
		color: white;
		border-radius: 4px;
	}

	.bottom-actions {
		display: flex;
		justify-content: flex-start;
	}
</style>

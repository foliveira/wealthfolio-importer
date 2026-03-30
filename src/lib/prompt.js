export const ACTIVITY_TYPES = [
	'BUY',
	'SELL',
	'DIVIDEND',
	'DEPOSIT',
	'WITHDRAWAL',
	'TAX',
	'FEE',
	'INTEREST',
	'TRANSFER_IN',
	'TRANSFER_OUT'
];

export const CSV_COLUMNS = [
	'date',
	'symbol',
	'quantity',
	'activityType',
	'unitPrice',
	'currency',
	'fee',
	'amount'
];

export const SYSTEM_PROMPT = `You are a financial document parser. Extract all investment transactions from the provided document image(s). Return ONLY valid JSON.

Each transaction must have these fields:
- date: ISO 8601 format (YYYY-MM-DDTHH:mm:ss.000Z). Use midnight if time is unknown.
- symbol: Ticker symbol (e.g., MSFT, AAPL). Use $CASH-{CURRENCY} for cash transactions (e.g., $CASH-USD).
- quantity: Number of shares/units. Use 1 for cash activities.
- activityType: One of: ${ACTIVITY_TYPES.join(', ')}
- unitPrice: Price per share/unit. Use 1 for cash activities.
- currency: ISO 4217 code (USD, EUR, GBP, etc.)
- fee: Transaction fee. Use 0 if none or unknown.
- amount: Total amount. For BUY/SELL: quantity × unitPrice. For cash activities: the cash amount.

Rules:
- Only extract actual transactions, NOT summaries, balances, or totals.
- If a transaction type does not match any activityType exactly, choose the closest match.
- If you cannot determine a field, use a reasonable default.
- Return an empty array [] if no transactions are found.`;

export const USER_PROMPT = 'Extract all investment transactions from this document.';

export const TRANSACTION_SCHEMA = {
	type: 'object',
	properties: {
		transactions: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					date: { type: 'string' },
					symbol: { type: 'string' },
					quantity: { type: 'number' },
					activityType: {
						type: 'string',
						enum: ACTIVITY_TYPES
					},
					unitPrice: { type: 'number' },
					currency: { type: 'string' },
					fee: { type: 'number' },
					amount: { type: 'number' }
				},
				required: ['date', 'symbol', 'quantity', 'activityType', 'unitPrice', 'currency', 'fee', 'amount'],
				additionalProperties: false
			}
		}
	},
	required: ['transactions'],
	additionalProperties: false
};

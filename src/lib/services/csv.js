import { CSV_COLUMNS } from '$lib/prompt.js';

function escapeField(val) {
	const str = String(val ?? '');
	if (str.includes(',') || str.includes('"') || str.includes('\n')) {
		return `"${str.replace(/"/g, '""')}"`;
	}
	return str;
}

/**
 * Generate CSV string from transaction rows.
 * @param {object[]} rows
 * @returns {string}
 */
export function generateCSV(rows) {
	const header = CSV_COLUMNS.map(escapeField).join(',');
	const lines = rows.map((row) =>
		CSV_COLUMNS.map((col) => escapeField(row[col])).join(',')
	);
	return header + '\r\n' + lines.join('\r\n');
}

/**
 * Download a CSV string as a file.
 * @param {string} csv
 * @param {string} [filename]
 */
export function downloadCSV(csv, filename = 'wealthfolio-import.csv') {
	const BOM = '\uFEFF';
	const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}

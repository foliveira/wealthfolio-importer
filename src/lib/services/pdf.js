import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

const MAX_PAGES = 20;
const RENDER_SCALE = 2.0;
const JPEG_QUALITY = 0.85;

/**
 * Convert a PDF file to an array of base64 JPEG images (one per page).
 * @param {File} file
 * @returns {Promise<{ images: string[], pageCount: number }>}
 */
export async function pdfToImages(file) {
	const arrayBuffer = await file.arrayBuffer();
	const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
	const pageCount = pdf.numPages;

	if (pageCount > MAX_PAGES) {
		pdf.destroy();
		throw new Error(`PDF has ${pageCount} pages. Maximum supported is ${MAX_PAGES}.`);
	}

	const images = [];
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');

	for (let i = 1; i <= pageCount; i++) {
		const page = await pdf.getPage(i);
		const viewport = page.getViewport({ scale: RENDER_SCALE });

		canvas.width = viewport.width;
		canvas.height = viewport.height;

		await page.render({ canvasContext: ctx, viewport }).promise;

		const base64 = canvas.toDataURL('image/jpeg', JPEG_QUALITY).split(',')[1];
		images.push(base64);

		page.cleanup();
	}

	pdf.destroy();
	return { images, pageCount };
}

/**
 * Read an image file as base64.
 * @param {File} file
 * @returns {Promise<string>}
 */
export function imageToBase64(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result.split(',')[1]);
		reader.onerror = () => reject(new Error('Failed to read image file.'));
		reader.readAsDataURL(file);
	});
}

/**
 * Get the media type for an image file.
 * @param {File} file
 * @returns {string}
 */
export function getMediaType(file) {
	const ext = file.name.split('.').pop().toLowerCase();
	const types = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' };
	return types[ext] || file.type || 'image/jpeg';
}

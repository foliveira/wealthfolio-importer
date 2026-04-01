import * as pdfjsLib from 'pdfjs-dist';
// @ts-expect-error -- Vite ?raw import has no type declaration
import pdfjsWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?raw';

const MAX_PAGES = 20;
const RENDER_SCALE = 2.0;
const JPEG_QUALITY = 0.85;

// Blob URL from inlined worker source — must remain alive for the app lifetime
// so pdf.js can spawn workers on demand. Intentionally never revoked.
const workerBlob = new Blob([pdfjsWorkerSrc], { type: 'application/javascript' });
pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(workerBlob);

export async function pdfToImages(file: File): Promise<{ images: string[] }> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageCount = pdf.numPages;

  if (pageCount > MAX_PAGES) {
    pdf.destroy();
    throw new Error(`PDF has ${pageCount} pages. Maximum supported is ${MAX_PAGES}.`);
  }

  const images: string[] = [];
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to create canvas 2D context.');

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: RENDER_SCALE });

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    images.push(canvas.toDataURL('image/jpeg', JPEG_QUALITY).split(',')[1]);
    page.cleanup();
  }

  // Release canvas pixel buffer
  canvas.width = 0;
  canvas.height = 0;

  pdf.destroy();
  return { images };
}

export function imageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Unexpected reader result type.'));
        return;
      }
      resolve(reader.result.split(',')[1]);
    };
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png']);

export function getMediaType(file: File): string {
  return ALLOWED_IMAGE_TYPES.has(file.type) ? file.type : 'image/jpeg';
}

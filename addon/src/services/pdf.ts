import * as pdfjsLib from 'pdfjs-dist';
// Import worker source as raw string — Vite bundles it inline
// @ts-ignore
import pdfjsWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?raw';

const MAX_PAGES = 20;
const RENDER_SCALE = 2.0;
const JPEG_QUALITY = 0.85;

// Create a blob URL from the inlined worker source.
// This works in any context (blob URLs, Tauri webview, etc.)
// because the worker code is embedded in the bundle itself.
const workerBlob = new Blob([pdfjsWorkerSrc], { type: 'application/javascript' });
pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(workerBlob);

export async function pdfToImages(file: File): Promise<{ images: string[]; pageCount: number }> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
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

    await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
    images.push(canvas.toDataURL('image/jpeg', JPEG_QUALITY).split(',')[1]);
    page.cleanup();
  }

  pdf.destroy();
  return { images, pageCount };
}

export function imageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

export function getMediaType(file: File): string {
  const ext = file.name.split('.').pop()?.toLowerCase();
  const types: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' };
  return (ext && types[ext]) || file.type || 'image/jpeg';
}

import { defineConfig } from 'vite';
import { copyFileSync } from 'fs';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/addon.tsx',
      formats: ['es'],
      fileName: 'addon',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', '@wealthfolio/ui', '@wealthfolio/addon-sdk'],
    },
    outDir: 'dist',
  },
  plugins: [
    {
      name: 'copy-pdf-worker',
      closeBundle() {
        const src = resolve('node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
        const dest = resolve('dist/pdf.worker.min.mjs');
        copyFileSync(src, dest);
      },
    },
  ],
});

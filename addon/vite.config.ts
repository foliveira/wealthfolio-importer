import { defineConfig } from 'vite';

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
});

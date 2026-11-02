import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { devApi } from './dev/dev-api.js';

export default defineConfig(({ command }) => ({
  plugins: [react(), ...(command === 'serve' ? [devApi()] : [])],
  build: { chunkSizeWarningLimit: 2000 },
  resolve: command === 'serve' ? { alias: { '@netlify/blobs': new URL('./dev/blobs-mock.js', import.meta.url).pathname } } : {},
}));

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

const extensao = JSON.parse(readFileSync(new URL('./extensao-chrome/manifest.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: { __VERSAO_EXTENSAO__: JSON.stringify(extensao.version) },
  build: { chunkSizeWarningLimit: 900 },
});

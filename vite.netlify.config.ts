import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/postcss';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  css: { postcss: { plugins: [tailwind()] } },
  define: { 'import.meta.env.VITE_HOST_PLATFORM': JSON.stringify('netlify') },
  build: { outDir: 'netlify-dist' },
});

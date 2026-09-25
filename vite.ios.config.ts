import { copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';

const root = fileURLToPath(new URL('.', import.meta.url));

// A local, classic-script bundle for WKWebView.loadFileURL. No web server,
// dynamic imports, network requests or native dependency manager are needed.
export default defineConfig({
  base: './',
  resolve: { alias: { '@': root } },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process.env.NEXT_PUBLIC_BASE_PATH': JSON.stringify(''),
    'process.env.NEXT_PUBLIC_APP_VERSION': JSON.stringify('ios-2026.09.25.8'),
  },
  css: { postcss: { plugins: [tailwindcss()] } },
  plugins: [react(), {
    name: 'ios-html',
    closeBundle() {
      copyFileSync(`${root}native/web/index.html`, `${root}native/ios/Michas/Web/index.html`);
    },
  }],
  build: {
    outDir: 'native/ios/Michas/Web',
    emptyOutDir: true,
    target: 'safari16',
    lib: {
      entry: 'native/web/main.tsx',
      name: 'Michas',
      formats: ['iife'],
      fileName: 'app',
      cssFileName: 'app',
    },
  },
});

// Standalone Vite serves the GPU harness and the production TypeScript shaders.
// Keep its dependency cache separate from the app's dev/build environments.
const config = {
  cacheDir: 'node_modules/.vite-gpu-checks',
  server: { host: '127.0.0.1', port: 3003, strictPort: true },
};

export default config;

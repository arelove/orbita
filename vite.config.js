import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';

// @ts-expect-error process is nodejs global
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [sveltekit()],
  clearScreen: false,
  server: {
    port: 9034,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: 'ws', host, port: 9035 }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
}));

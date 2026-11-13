import { defineConfig } from 'vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'auth/login/index.html'),
        signup: resolve(__dirname, 'auth/signup/index.html'),
        pending: resolve(__dirname, 'auth/pending/index.html'),
        callback: resolve(__dirname, 'auth/callback/index.html'),
        admin: resolve(__dirname, 'admin/index.html'),
      },
    },
  },
});


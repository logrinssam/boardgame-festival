import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  base: '/boardgame-festival/ops/',
  resolve: {
    alias: {
      '@bgf/shared/firebase': path.resolve(
        import.meta.dirname,
        '../../packages/shared/src/firebase/client.ts',
      ),
      '@bgf/shared': path.resolve(
        import.meta.dirname,
        '../../packages/shared/src/index.ts',
      ),
    },
  },
  server: {
    port: 5174,
  },
});

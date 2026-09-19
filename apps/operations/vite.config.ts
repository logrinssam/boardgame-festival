import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// 새 버전 감지용 빌드 ID — 배포(GitHub Actions)에서는 커밋 해시, 로컬 빌드는 시각
const buildId =
  (process.env.GITHUB_SHA ?? '').slice(0, 7) || `local-${Date.now().toString(36)}`;

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'emit-version-json',
      apply: 'build',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: JSON.stringify({ buildId }),
        });
      },
    },
  ],
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  base: '/boardgame-festival/ops/',
  resolve: {
    alias: {
      '@bgf/shared/firebase/reservations': path.resolve(
        import.meta.dirname,
        '../../packages/shared/src/firebase/reservations.ts',
      ),
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

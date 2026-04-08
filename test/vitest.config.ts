import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(root, '..');

export default defineConfig({
  root,
  test: {
    globals: true,
    environment: 'node',
    include: ['unit/**/*.{test,spec}.{ts,js}', 'integration/**/*.{test,spec}.{ts,js}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: ['../backend/src/capacitySchedule.js', '../backend/src/stepCompletionSync.js', '../frontend/src/lib/trSearch.ts'],
    },
    testTimeout: 15000,
  },
  resolve: {
    alias: {
      '@frontend': path.join(repoRoot, 'frontend/src'),
    },
  },
});

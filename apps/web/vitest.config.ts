import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
// Unit tests for pure web-layer helpers only; UI is covered by Playwright journeys.
export default defineConfig({
  test: { include: ['src/**/*.test.ts'] },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
});

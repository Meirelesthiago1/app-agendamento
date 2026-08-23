import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.teste.ts', '**/*.teste.tsx'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**'],
  },
});

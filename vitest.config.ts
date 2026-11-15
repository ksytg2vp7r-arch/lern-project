import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/helfer/global-setup.ts'],
    // Alle Tests teilen sich eine Test-Datenbank, deshalb nacheinander.
    fileParallelism: false,
    testTimeout: 20000,
  },
});

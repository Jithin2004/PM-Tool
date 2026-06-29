import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: './',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json', 'clover'],
      reportsDirectory: 'testing/reports/coverage/vitest'
    },
    include: ['testing/certification/**/*.vitest.ts'],
    reporters: ['default', 'junit'],
    outputFile: {
      junit: 'testing/reports/junit/vitest-results.xml'
    }
  }
});

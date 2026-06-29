import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import path from 'path';

// Load correct environment
const isProd = process.env.TEST_ENV === 'production';
dotenv.config({ 
  path: isProd ? path.resolve(process.cwd(), 'frontend/.env.production.test') 
               : path.resolve(process.cwd(), 'frontend/.env') 
});

export default defineConfig({
  testDir: '../certification',
  testMatch: '**/*.spec.ts',
  timeout: 60000,
  expect: {
    timeout: 5000
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: '../reports/playwright-html' }],
    ['junit', { outputFile: '../reports/junit/playwright-results.xml' }],
    ['./RegressionReporter.ts']
  ],
  use: {
    actionTimeout: 0,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  webServer: {
    command: 'npm run dev',
    cwd: '../../frontend',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    }
  ]
});

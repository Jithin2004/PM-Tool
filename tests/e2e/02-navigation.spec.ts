import { test, expect } from '@playwright/test';
import { setupNetworkValidation } from './helpers/network.helper';
import * as path from 'path';

// Use the authenticated state created by 01-auth.spec.ts
test.use({ storageState: path.resolve('.', '.auth', 'user.json') });

const routesToTest = [
  '/', // Dashboard/Mission Control
  '/workspace/portfolio',
  '/workspace/reports',
  '/workspace/decisions',
  '/workspace/meetings',
  '/workspace/requirements',
  '/workspace/documents',
  '/workspace/approvals',
  '/workspace/onboarding',
  '/execution', // Board
  '/execution/timeline',
  '/execution/gantt',
  '/execution/sprints',
  '/resources', // Logistics
  '/resources/teams',
  '/resources/work-logs',
  '/resources/finance',
  '/control/settings',
  '/control/automations',
  '/control/templates',
  '/control/system'
];

test.describe('Navigation Flow', () => {
  for (const route of routesToTest) {
    test(`should load ${route} without crashes or API errors`, async ({ page }) => {
      const network = setupNetworkValidation(page);

      // Navigate to the route
      await page.goto(route, { waitUntil: 'networkidle' });

      // Check if we are unexpectedly redirected to login
      await expect(page).not.toHaveURL(/.*\/login/, { timeout: 5000 });

      // General check to ensure a page structure is loaded (e.g. sidebar or main content)
      // Wait for any element that signifies the page rendered.
      await page.waitForSelector('body');

      // Assert no HTTP errors or console errors were encountered
      network.assertNoErrors();
    });
  }
});

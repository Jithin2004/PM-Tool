import { test, expect } from '@playwright/test';
import { setupNetworkValidation } from './helpers/network.helper';

test.describe('Authentication Session', () => {
  test('should restore session on refresh', async ({ page }) => {
    const network = setupNetworkValidation(page);

    await page.goto('/');
    
    // We should not be redirected to login because we are already logged in
    await expect(page).not.toHaveURL(/.*\/login/);
    
    network.assertNoErrors();
  });
});

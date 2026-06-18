import { test, expect } from '@playwright/test';
test.use({ storageState: { cookies: [], origins: [] } });
test.describe('Authentication Flow', () => {
  test('Login page renders correctly', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'RESOLVE PM', exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('Enter your email')).toBeVisible();
    await expect(page.getByPlaceholder('Enter your password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });

  test('Shows error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Enter your email').fill('invalid@example.com');
    await page.getByPlaceholder('Enter your password').fill('wrongpassword');
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page.locator('.text-red-400')).toBeVisible();
    await expect(page.getByText('Access Denied / Error')).toBeVisible();
  });
});

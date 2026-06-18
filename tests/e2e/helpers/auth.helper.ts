import { Page, expect } from '@playwright/test';

export async function login(page: Page) {
  const email = process.env.TEST_EMAIL!;
  const password = process.env.TEST_PASSWORD!;

  await page.goto('/login');
  
  // Need to find the input fields, usually by type or label
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  
  // Submit
  await page.click('button[type="submit"]');

  await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 30000 });
  // Instead of 'Command Center', wait for general page element, or just do a generic check
  await expect(page.locator('body')).toBeVisible();
}

export async function logout(page: Page) {
  // Try to find a logout button or profile menu
  // Adjust selector based on the app's actual layout
  try {
    await page.click('button[aria-label="Profile Menu"], button[aria-label="User Menu"]');
    await page.click('text=Log out, text=Sign out, text=Logout');
  } catch (e) {
    // Fallback if UI is different
    await page.goto('/login'); // If there is a direct logout route or clearing local storage
  }
}

export async function preserveSession(page: Page, path: string) {
  await page.context().storageState({ path });
}

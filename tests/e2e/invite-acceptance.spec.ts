import { test, expect } from '@playwright/test';
import { provisionTestEmployee } from './utils/auth';

test.describe('Employee Invitation and Acceptance Flow', () => {
  // Use a clean state for the employee
  test.use({ storageState: { cookies: [], origins: [] } });
  
  test('Admin can invite an employee and employee can accept and setup account', async ({ page }) => {
    // 1. Provision user via backend API simulating Admin action
    const fs = require('fs');
    const path = require('path');
    const authState = JSON.parse(fs.readFileSync(path.join(process.cwd(), '.auth', 'user.json'), 'utf8'));
    const tokenObj = authState.origins[0].localStorage.find((x: any) => x.name.endsWith('-auth-token'));
    const realToken = JSON.parse(tokenObj.value).access_token;
    
    // This calls the backend to create the user and returns the invite link
    const employee = await provisionTestEmployee(realToken, 'developer');

    // Make sure invite link exists
    expect(employee.inviteLink).toBeDefined();

    // 2. Employee navigates to the invite link
    // The inviteLink is a full URL, but playwright might need just the path
    const urlObj = new URL(employee.inviteLink);
    await page.goto(urlObj.pathname);

    // 3. Employee completes account setup
    // Assuming AcceptInvitePage has inputs for full name (maybe prefilled) and password
    // Wait for the form to appear
    await expect(page.getByText(/Welcome, Test Employee/i)).toBeVisible({ timeout: 10000 });
    
    // Fill in the password
    await page.getByPlaceholder('At least 8 characters').fill(employee.password);
    await page.getByPlaceholder('Repeat password').fill(employee.password);
    
    // Submit
    await page.getByRole('button', { name: 'Complete Provisioning' }).click();

    // 4. Validate redirect and successful join
    // The user should be redirected to the app (e.g. /overview or similar)
    await expect(page).toHaveURL(/.*\/workspace\/|.*\/overview|.*\/execution|.*\/resources|.*\/control/, { timeout: 15000 });
    
    // Also verify no errors appear
    await expect(page.getByText('Access Denied / Error')).toBeHidden();
  });
});

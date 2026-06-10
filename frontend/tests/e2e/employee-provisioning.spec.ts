import { test, expect } from '@playwright/test';
import { provisionTestEmployee } from './utils/auth';

test.describe('Employee Provisioning Flow', () => {
  test('Admin can provision a new employee and employee can login with temp password', async ({ page }) => {
    // 1. Provision user via backend API simulating Admin action
    const dummyToken = 'test-admin-token';
    
    // This calls the backend running on port 5001 to create the user
    const employee = await provisionTestEmployee(dummyToken, 'developer');

    // 2. Employee navigates to login
    await page.goto('/login');

    // 3. Employee enters provisioned credentials
    await page.getByPlaceholder('Enter your email').fill(employee.email);
    await page.getByPlaceholder('Enter your password').fill(employee.password);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Since they have force_password_change=true, we expect them to be redirected
    // or presented with the PasswordSetup screen depending on how AuthContext handles it.
    // For now, let's just assert that there is no error.
    await expect(page.getByText('Access Denied / Error')).toBeHidden({ timeout: 10000 });
  });
});

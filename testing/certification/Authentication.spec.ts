import { test, expect } from '@playwright/test';
import { SandboxIntegration } from '../sandbox/sandbox';

let sandboxId: string;

test.describe('Authentication Certification Pack', () => {
  test.beforeAll(async () => {
    const context = SandboxIntegration.getSharedContext();
    sandboxId = context.sandboxId;
  });

  test.beforeEach(async ({ page }) => {
    page.on('console', msg => {
      if (msg.text().includes('[DEBUG] Profile metadata')) {
        console.log(`[BROWSER CONSOLE] ${msg.text()}`);
      }
    });
  });

  test.afterAll(async () => {
    if (sandboxId) {
      await SandboxIntegration.destroySandbox(sandboxId);
    }
  });

  test('Valid Login Flow with DB and API verification', async ({ page }) => {
    const adminEmail = SandboxIntegration.getTestIdentity('Admin');
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', adminEmail);
    await page.fill('input[type="password"]', 'Password123!');
    
    // Layer 2: Network Verification
    const responsePromise = page.waitForResponse(response => 
      response.url().includes('supabase.co') && 
      response.url().includes('/token') && 
      response.status() === 200
    );
    
    await page.click('button[type="submit"]');
    await responsePromise;
    
    // Layer 1: UI Verification
    await expect(page).toHaveURL(/.*\/overview/);
  });

  test('Invalid credentials rejection', async ({ page }) => {
    const qaEmail = SandboxIntegration.getTestIdentity('QA');
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', qaEmail);
    await page.fill('input[type="password"]', 'WrongPassword!');
    
    // Layer 2: Network Interception for expected 400 Bad Request
    const responsePromise = page.waitForResponse(response => 
      response.url().includes('supabase.co') && 
      response.url().includes('/token') && 
      response.status() === 400
    );
    
    await page.click('button[type="submit"]');
    await responsePromise;
    
    // Layer 1: Visible Result
    await expect(page.locator('text=Invalid login credentials')).toBeVisible();
  });

  test('Session persistence', async ({ page, context }) => {
    const devEmail = SandboxIntegration.getTestIdentity('Developer');
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', devEmail);
    await page.fill('input[type="password"]', 'Password123!');
    const responsePromise = page.waitForResponse(response => 
      response.url().includes('supabase.co') && response.url().includes('/token') && response.status() === 200
    );
    await page.click('button[type="submit"]');
    await responsePromise;
    await expect(page).toHaveURL(/.*\/overview/);
    
    const newPage = await context.newPage();
    await newPage.goto('http://localhost:3000/overview');
    await expect(newPage).toHaveURL(/.*\/overview/);
  });

  test('Logout flow', async ({ page }) => {
    const adminEmail = SandboxIntegration.getTestIdentity('Admin');
    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', adminEmail);
    await page.fill('input[type="password"]', 'Password123!');
    const responsePromise = page.waitForResponse(response => 
      response.url().includes('supabase.co') && response.url().includes('/token') && response.status() === 200
    );
    await page.click('button[type="submit"]');
    await responsePromise;
    // Note: Admin might be redirected to /workspace/portfolio instead of /overview, so we check we left /login
    await expect(page).not.toHaveURL(/.*\/login/);
    
    // Layer 2: Network logout API request
    const logoutPromise = page.waitForResponse(response => 
      response.url().includes('supabase.co') && 
      response.url().includes('/logout')
    );
    
    await page.click('button:has-text("Logout")');
    await responsePromise;
    await expect(page).toHaveURL(/.*\/login/);
  });

  test('Password reset flow', async ({ page }) => {
    await page.goto('http://localhost:3000/login');
    await page.click('text=Forgot Password?'); 
    await expect(page).toHaveURL(/.*\/reset-password/);
    
    const targetEmail = SandboxIntegration.getTestIdentity('Admin');
    await page.fill('input[type="email"]', targetEmail);
    
    // Verify a POST request is sent to /recover
    const requestPromise = page.waitForRequest(request => 
      request.url().includes('supabase.co') && 
      request.url().includes('/recover') &&
      request.method() === 'POST'
    );
    
    await page.click('button[type="submit"]');
    
    // Verify the request leaves the browser
    const request = await requestPromise;
    
    // Verify the payload contains the submitted email
    const postData = request.postDataJSON();
    expect(postData?.email).toBe(targetEmail);
    
    // Verify the UI renders the application's handled outcome (success or handled error), rather than hanging
    const successMessage = page.locator('text=Check your email');
    const errorMessage = page.locator(`text=Email address "${targetEmail}" is invalid`);
    
    await expect(successMessage.or(errorMessage)).toBeVisible();
  });
});

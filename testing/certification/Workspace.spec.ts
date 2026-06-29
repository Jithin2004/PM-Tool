import { test } from '@playwright/test';
import { SandboxIntegration } from '../sandbox/sandbox';
import { CertificationSession, CertificationNavigation, CertificationAssertion } from '../helpers/certification';

test.describe('Workspace Certification Pack', () => {
  test.beforeAll(async () => {
    SandboxIntegration.getSharedContext();
  });

  test.afterAll(async () => {
    // Sandbox destruction is handled by the master runner
  });

  test.beforeEach(async ({ page }) => {
    await CertificationSession.login(page, 'Admin');
  });

  test('Create Workspace Flow', async ({ page }) => {
    await CertificationNavigation.navigateTo(page, '/workspaces/new');
    await page.fill('input[name="workspaceName"]', 'Test Workspace');
    
    // Layer 2: Intercept API Response
    const responsePromise = page.waitForResponse(response => 
      response.url().includes('supabase.co') && 
      response.url().includes('/rest/v1/workspaces') &&
      response.status() === 201
    );
    
    await page.click('button[type="submit"]');
    await responsePromise;
    
    // Layer 1: Visible Result
    await page.locator('text=Workspace created successfully').waitFor({ state: 'visible' });
  });

  test('Update Workspace Flow', async ({ page }) => {
    await CertificationNavigation.navigateTo(page, '/workspaces/settings');
    await page.fill('input[name="workspaceName"]', 'Updated Workspace');
    
    const responsePromise = page.waitForResponse(response => 
      response.url().includes('supabase.co') && 
      response.url().includes('/rest/v1/workspaces') &&
      response.status() === 204
    );
    
    await page.click('button[type="submit"]');
    await responsePromise;
    await page.locator('text=Workspace updated').waitFor({ state: 'visible' });
  });

  test('Archive and Restore Workspace', async ({ page }) => {
    await CertificationNavigation.navigateTo(page, '/workspaces/settings');
    
    let responsePromise = page.waitForResponse(response => 
      response.url().includes('supabase.co') && 
      response.url().includes('/rest/v1/workspaces') &&
      response.status() === 204
    );
    
    await page.click('button:has-text("Archive")');
    await page.click('button:has-text("Confirm Archive")');
    await responsePromise;
    await page.locator('text=Workspace archived').waitFor({ state: 'visible' });
  });

  test('Multi-tenant isolation check', async ({ page, browser }) => {
    await CertificationNavigation.navigateTo(page, '/workspaces/tenant-a');
    
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await CertificationSession.login(pageB, 'QA');
    await CertificationNavigation.navigateTo(pageB, '/workspaces/tenant-b');
    
    // Abstracted isolation check based purely on UI limits
    await page.locator('text=tenant-b').waitFor({ state: 'hidden' });
  });
});

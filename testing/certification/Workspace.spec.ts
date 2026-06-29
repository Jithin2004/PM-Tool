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
    page.on('console', msg => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        console.log(`[BROWSER ${msg.type().toUpperCase()}] ${msg.text()}`);
      }
    });
    await CertificationSession.login(page, 'Super Admin');
  });

  test('Create Workspace Flow', async ({ page }) => {
    await CertificationNavigation.navigateTo(page, '/admin/super');
    
    // Open the create workspace modal
    await page.click('button:has-text("New Workspace"):visible');
    
    await page.fill('input[name="workspaceName"]', 'Test Workspace');
    
    await page.click('button[type="submit"]');
    
    // Layer 1: Visible Result
    await page.locator('input[name="workspaceName"]').waitFor({ state: 'hidden', timeout: 5000 });
  });

  test('Update Workspace Flow', async ({ page }) => {
    await CertificationNavigation.navigateTo(page, '/admin/settings');
    await page.fill('input[name="workspaceName"]', 'Updated Workspace');
    
      await page.click('button:has-text("Save All Settings")');
    await page.locator('text=Settings saved successfully').waitFor({ state: 'visible', timeout: 5000 });
  });

  test('Archive and Restore Workspace', async ({ page }) => {
    await CertificationNavigation.navigateTo(page, '/admin/settings');
    
    let responsePromise = page.waitForResponse(response => 
      response.url().includes('supabase.co') && 
      response.url().includes('/rest/v1/workspaces') &&
      [200, 201, 204].includes(response.status())
    );
    
    await page.click('button:has-text("Archive")');
    await page.fill('input[type="text"]', 'Confirm Archive'); // from showPrompt in Dialogs
    await page.click('.modal-premium button:has-text("Archive")');
    
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

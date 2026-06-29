import { test } from '@playwright/test';
import { SandboxIntegration } from '../sandbox/sandbox';
import { CertificationSession, CertificationNavigation, CertificationAssertion } from '../helpers/certification';

test.describe('Finance Certification Pack', () => {
  test.beforeAll(async () => {
    SandboxIntegration.getSharedContext();
  });

  test.afterAll(async () => {
    // Sandbox destruction is handled by the master runner
  });

  test.beforeEach(async ({ page }) => {
    await CertificationSession.login(page, 'Finance');
  });

  test('Finance Command Center Access', async ({ page }) => {
    // Layer 2: API validation
    const responsePromise = page.waitForResponse(response => 
      response.url().includes('supabase.co') && 
      response.url().includes('/rest/v1/finance_records')
    );
    
    await CertificationNavigation.navigateTo(page, '/resources/finance');
    
    try {
      await responsePromise;
      await page.locator('text=Finance Command Center').waitFor({ state: 'visible' });
    } catch (e) {
      // Registered as Application/Infrastructure Failure
      throw e;
    }
  });
});

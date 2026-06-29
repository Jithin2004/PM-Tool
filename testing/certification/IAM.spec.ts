import { test, expect } from '@playwright/test';
import { SandboxIntegration } from '../sandbox/sandbox';
import { CertificationSession, CertificationNavigation, CertificationAssertion } from '../helpers/certification';

test.describe('IAM Certification Pack', () => {
  test.beforeAll(async () => {
    SandboxIntegration.getSharedContext();
  });

  test.afterAll(async () => {
    // Sandbox destruction is handled by the master runner
  });

  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log('BROWSER_LOG:', msg.text()));
  });

  test('Super Admin capability: settings.manage', async ({ page }) => {
    await CertificationSession.login(page, 'Super Admin');
    await CertificationNavigation.navigateTo(page, '/admin/settings');
    await CertificationAssertion.assertRouteLoaded(page, '/admin/settings');

    // UI visibility: Should not see Access Restricted
    await CertificationAssertion.assertAuthorized(page);

    // Verify a relevant UI element is present
    await page.locator('h2:has-text("Company Control Center")').waitFor({ state: 'visible', timeout: 30000 });
  });

  test('Project Manager capability restriction: cannot access settings.manage', async ({ page }) => {
    await CertificationSession.login(page, 'Project Manager');
    await CertificationNavigation.navigateTo(page, '/admin/settings');

    await expect(async () => {
      await CertificationAssertion.assertUnauthorized(page, '/admin/settings');
    }).toPass({ timeout: 15000 });
  });

  test('Finance capability: finance.view', async ({ page }) => {
    await CertificationSession.login(page, 'Finance');
    await CertificationNavigation.navigateTo(page, '/finance');
    await CertificationAssertion.assertRouteLoaded(page, '/finance');
    await CertificationAssertion.assertAuthorized(page);
  });

  test('Developer capability restriction: cannot access finance.view', async ({ page }) => {
    await CertificationSession.login(page, 'Developer');
    await CertificationNavigation.navigateTo(page, '/finance');

    await expect(async () => {
      await CertificationAssertion.assertUnauthorized(page, '/finance');
    }).toPass({ timeout: 15000 });
  });

  test('Admin capability: user.manage', async ({ page }) => {
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        console.log('BROWSER_NETWORK:', request.method(), request.url());
      }
    });
    page.on('console', msg => console.log('BROWSER_LOG:', msg.text()));
    
    await CertificationSession.login(page, 'Admin');
    await CertificationNavigation.navigateTo(page, '/admin/identity');
    await page.locator('h1:has-text("Access Control")').waitFor({ state: 'visible', timeout: 15000 });
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  });

  test('HR capability restriction: cannot access user.manage', async ({ page }) => {
    await CertificationSession.login(page, 'HR');
    await CertificationNavigation.navigateTo(page, '/admin/identity');

    await expect(async () => {
      await CertificationAssertion.assertUnauthorized(page, '/admin/identity');
    }).toPass({ timeout: 15000 });
  });

  test('Project Manager capability: project.create', async ({ page }) => {
    await CertificationSession.login(page, 'Project Manager');
    await CertificationNavigation.navigateTo(page, '/projects');

    await page.locator('button:has-text("New Project"), button:has-text("Create Project")').first().waitFor({ state: 'visible', timeout: 15000 });
  });

  test('Observer capability restriction: cannot create projects', async ({ page }) => {
    await CertificationSession.login(page, 'Observer');
    await CertificationNavigation.navigateTo(page, '/projects');

    await expect(async () => {
      await CertificationAssertion.assertUnauthorized(page, '/projects');
    }).toPass({ timeout: 15000 });
  });
});

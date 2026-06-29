import { expect, Page } from '@playwright/test';
import { SandboxIntegration } from '../sandbox/sandbox';

export class CertificationSession {
  /**
   * Performs a fresh UI login to obtain a valid session without caching JWTs.
   */
  static async login(page: Page, role: string) {
    const email = SandboxIntegration.getTestIdentity(role);
    if (!email) {
      throw new Error(`Test identity not found for role: ${role}`);
    }

    await page.goto('http://localhost:3000/login');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', 'Password123!');

    const responsePromise = page.waitForResponse(response => 
      response.url().includes('supabase.co') && 
      response.url().includes('/token') && 
      response.status() === 200
    );
    
    await page.click('button[type="submit"]');
    await responsePromise;
    await page.waitForURL(/.*\/overview/);

    // Dismiss onboarding tour if present (prevents Spotlight from intercepting pointer events)
    await page.locator('button:has-text("Skip")').click({ timeout: 3000 }).catch(() => {});
  }
}

export class CertificationNavigation {
  /**
   * Handles protected route navigation and waits for application readiness.
   */
  static async navigateTo(page: Page, path: string) {
    await page.goto(`http://localhost:3000${path}`);
    
    // Wait for the route to change
    await page.waitForURL(new RegExp(`.*${path.replace(/\//g, '\\/')}`));
  }
}

export class CertificationAssertion {
  static async assertAuthorized(page: Page) {
    await expect(page.locator('h2:has-text("Access Restricted")')).not.toBeVisible();
  }

  static async assertUnauthorized(page: Page, fallbackPath: string) {
    const isRestricted = await page.locator('h2:has-text("Access Restricted")').isVisible();
    const isRedirected = !page.url().includes(fallbackPath);
    expect(isRestricted || isRedirected).toBeTruthy();
  }

  static async assertRouteLoaded(page: Page, path: string) {
    await expect(page).toHaveURL(new RegExp(`.*${path.replace(/\//g, '\\/')}`));
  }
}

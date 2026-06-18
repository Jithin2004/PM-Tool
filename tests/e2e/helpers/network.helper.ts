import { Page, expect } from '@playwright/test';

export function setupNetworkValidation(page: Page) {
  const errors: string[] = [];

  // Fail on HTTP 400+ for fetch/xhr
  page.on('response', (response) => {
    // Only care about api/fetch requests from the app itself, ignore external tracking/analytics
    if (['fetch', 'xhr'].includes(response.request().resourceType())) {
      if (response.status() >= 400) {
        errors.push(`HTTP ${response.status()} on ${response.url()}`);
      }
    }
  });

  // Fail on console errors
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignore some common harmless errors if necessary, but log all by default
      if (!text.includes('favicon')) {
        errors.push(`Console Error: ${text}`);
      }
    }
  });

  // Fail on undefined URLs
  page.on('request', (request) => {
    if (request.url().includes('undefined')) {
      errors.push(`Undefined URL requested: ${request.url()}`);
    }
    
    // Check for localhost in production (if testing prod)
    if (process.env.NODE_ENV === 'production') {
      if (request.url().includes('localhost') || request.url().includes('127.0.0.1')) {
        errors.push(`Localhost call in production: ${request.url()}`);
      }
    }
  });

  return {
    assertNoErrors: () => {
      expect(errors, `Network/Console validation failed:\n${errors.join('\n')}`).toEqual([]);
    }
  };
}

import { test, expect } from '@playwright/test';

test.describe('Backend Health Verification', () => {
  test('Backend exposes GET /health returning valid JSON', async ({ request }) => {
    const apiUrl = process.env.TEST_API_URL || 'http://localhost:5001';
    
    const response = await request.get(`${apiUrl}/health`);
    
    // Smoke test fails if it returns HTML or 502
    expect(response.ok()).toBeTruthy();
    
    const body = await response.json();
    
    expect(body.status).toBe('ok');
    expect(body.service).toBeDefined();
    expect(body.version).toBeDefined();
  });
});

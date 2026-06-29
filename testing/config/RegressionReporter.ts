import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { RegressionRegistry, RegressionCategories } from '../regression/registry';
import path from 'path';

export default class RegressionReporter implements Reporter {
  onTestEnd(test: TestCase, result: TestResult) {
    if (result.status === 'failed' || result.status === 'timedOut') {
      
      const attachments = result.attachments;
      const screenshot = attachments.find(a => a.name === 'screenshot');
      const video = attachments.find(a => a.name === 'video');
      const trace = attachments.find(a => a.name === 'trace');

      RegressionRegistry.register({
        id: `REG-${Date.now()}-${test.title.replace(/[^a-zA-Z0-9]/g, '-')}`,
        ticketId: 'PENDING',
        description: `Automated failure in: ${test.title}\nError: ${result.error?.message}`,
        category: RegressionCategories.API,
        dateAdded: new Date().toISOString(),
        component: test.title.split(' ')[0] || 'Unknown',
        feature: test.title,
        capability: 'End to End Execution',
        workspace: 'sandbox',
        browser: test.parent?.project()?.name || 'chromium',
        screenshotPath: screenshot?.path,
        videoPath: video?.path,
        tracePath: trace?.path,
        stackTrace: result.error?.stack,
        reproductionSteps: [`Run test: ${test.title}`],
        severity: 'CRITICAL',
        owner: 'certification-engine',
        dbSnapshot: { state: 'unverified' } // Can be hooked into DB state before failure
      });
      console.log(`\n[REGRESSION REGISTRY] Registered failure for: ${test.title}`);
    }
  }

  onEnd(result: { status: string }) {
    const regressions = RegressionRegistry.getRegressions();
    if (regressions.length > 0) {
      console.log(`\nTotal New Regressions Registered: ${regressions.length}`);
    }
  }
}

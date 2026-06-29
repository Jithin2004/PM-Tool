import { test as baseTest } from '@playwright/test';

type Fixtures = {
  authenticatedAdmin: any;
  authenticatedPM: any;
  authenticatedDeveloper: any;
  authenticatedFinance: any;
  authenticatedClient: any;
  sandboxWorkspace: any;
  seededWorkspace: any;
  emptyWorkspace: any;
};

export const test = baseTest.extend<Fixtures>({
  authenticatedAdmin: async ({}, use) => { await use({}); },
  authenticatedPM: async ({}, use) => { await use({}); },
  authenticatedDeveloper: async ({}, use) => { await use({}); },
  authenticatedFinance: async ({}, use) => { await use({}); },
  authenticatedClient: async ({}, use) => { await use({}); },
  sandboxWorkspace: async ({}, use) => { await use({}); },
  seededWorkspace: async ({}, use) => { await use({}); },
  emptyWorkspace: async ({}, use) => { await use({}); },
});

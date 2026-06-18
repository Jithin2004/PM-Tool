import { test as setup } from '@playwright/test';
import { login, preserveSession } from './helpers/auth.helper';
import * as path from 'path';
import * as fs from 'fs';

const authFile = path.resolve('.', '.auth', 'user.json');

setup('authenticate', async ({ page }) => {
  // Perform authentication steps. Replace these actions with your own.
  await login(page);

  // Ensure dir exists
  fs.mkdirSync(path.dirname(authFile), { recursive: true });
  await preserveSession(page, authFile);
});

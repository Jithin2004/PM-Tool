// @ts-nocheck
(globalThis as any).import = { meta: { env: { DEV: true } } };
import { hasCapability } from './frontend/src/core/auth/permissions.ts';

const profile = { role: 'admin' };
const isView = hasCapability(profile, 'project.view') && !hasCapability(profile, 'task.update');
console.log('isView for admin:', isView);
console.log('project.view:', hasCapability(profile, 'project.view'));
console.log('task.update:', hasCapability(profile, 'task.update'));

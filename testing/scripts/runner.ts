import { SandboxIntegration } from '../sandbox/sandbox';
import { DataFactory } from '../factories/dataFactory';
import { execSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: './frontend/.env' });

// ─────────────────────────────────────────────────────────────────────────────
// CPO v1.0 — Certification Performance Optimizer
// ─────────────────────────────────────────────────────────────────────────────

type PackName =
  | 'Authentication'
  | 'IAM'
  | 'Workspace'
  | 'Projects'
  | 'Tasks'
  | 'Knowledge'
  | 'Meetings'
  | 'People & Teams'
  | 'Finance'
  | 'Automation'
  | 'Dashboards'
  | 'Client Portal'
  | 'Performance'
  | 'Security'
  | 'Database';

type RunnerType = 'playwright' | 'vitest';

type PackWeight = 'LIGHT' | 'MEDIUM' | 'HEAVY' | 'VERY_HEAVY';

// Phase A — Pack Profile Classification
// Determined from execution history and static analysis:
//   - Authentication: 5 tests, shallow pages (login/reset), low DB, ~60s total  → LIGHT
//   - IAM: 8 tests, AdminPanel 361KB + 100+ dep chain, session-injected          → HEAVY
//   - Workspace: 4 tests, settings routes, medium DB                             → MEDIUM
//   - Projects: 4 tests, realtime sync needed, medium DB                         → MEDIUM
//   - Tasks: 4 tests, realtime sync needed, medium DB                            → MEDIUM
//   - Finance: 1 test, single page, low DB                                       → LIGHT
interface PackProfile {
  weight: PackWeight;
  estimatedSeconds: number;
  requiresAuth: boolean;
  sandboxUsage: 'shared' | 'independent';
  pageCount: number;
  routeCount: number;
  dbIntensity: 'low' | 'medium' | 'high';
  networkIntensity: 'low' | 'medium' | 'high';
}

// Phase B — Adaptive Worker Map
// Worker count is determined by weight class. Heavy packs serialize to prevent
// Vite dev-server concurrency saturation from collapsing deep module waterfalls.
const WEIGHT_WORKER_MAP: Record<PackWeight, number> = {
  LIGHT:      1,
  MEDIUM:     3,
  HEAVY:      1,   // Serial — prevents Vite waterfall timeout under concurrency
  VERY_HEAVY: 1,
};

interface PackDefinition {
  name: PackName;
  runner: RunnerType;
  file: string;
  dependencies: PackName[];
  independent?: boolean;
  profile: PackProfile;
}

const PACKS: PackDefinition[] = [
  {
    name: 'Authentication',
    runner: 'playwright',
    file: 'testing/certification/Authentication.spec.ts',
    dependencies: [],
    profile: {
      weight: 'LIGHT',
      estimatedSeconds: 60,
      requiresAuth: true,
      sandboxUsage: 'shared',
      pageCount: 3,
      routeCount: 2,
      dbIntensity: 'low',
      networkIntensity: 'medium',
    },
  },
  {
    name: 'IAM',
    runner: 'playwright',
    file: 'testing/certification/IAM.spec.ts',
    dependencies: [],
    profile: {
      weight: 'HEAVY',
      estimatedSeconds: 120,
      requiresAuth: true,
      sandboxUsage: 'shared',
      pageCount: 5,
      routeCount: 4,
      dbIntensity: 'low',
      networkIntensity: 'high',
    },
  },
  {
    name: 'Workspace',
    runner: 'playwright',
    file: 'testing/certification/Workspace.spec.ts',
    dependencies: [],
    profile: {
      weight: 'MEDIUM',
      estimatedSeconds: 60,
      requiresAuth: true,
      sandboxUsage: 'shared',
      pageCount: 3,
      routeCount: 2,
      dbIntensity: 'medium',
      networkIntensity: 'medium',
    },
  },
  {
    name: 'Projects',
    runner: 'playwright',
    file: 'testing/certification/Projects.spec.ts',
    dependencies: [],
    profile: {
      weight: 'MEDIUM',
      estimatedSeconds: 60,
      requiresAuth: true,
      sandboxUsage: 'shared',
      pageCount: 3,
      routeCount: 2,
      dbIntensity: 'medium',
      networkIntensity: 'medium',
    },
  },
  {
    name: 'Tasks',
    runner: 'playwright',
    file: 'testing/certification/Tasks.spec.ts',
    dependencies: [],
    profile: {
      weight: 'MEDIUM',
      estimatedSeconds: 60,
      requiresAuth: true,
      sandboxUsage: 'shared',
      pageCount: 3,
      routeCount: 2,
      dbIntensity: 'medium',
      networkIntensity: 'medium',
    },
  },
  {
    name: 'Finance',
    runner: 'playwright',
    file: 'testing/certification/Finance.spec.ts',
    dependencies: [],
    profile: {
      weight: 'LIGHT',
      estimatedSeconds: 60,
      requiresAuth: true,
      sandboxUsage: 'shared',
      pageCount: 1,
      routeCount: 1,
      dbIntensity: 'low',
      networkIntensity: 'low',
    },
  },
];

type PackStatus = 'PASS' | 'FAIL' | 'SKIPPED' | 'BLOCKED' | 'PENDING' | 'CONFIGURATION_ERROR';

interface PackResult {
  status: PackStatus;
  reason?: string;
  exitCode?: number;
  command?: string;
  workerCount?: number;
  executionMs?: number;
  retries?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dataset mode — Phase D
// CLI flag: --dataset=small|medium|large|enterprise
// Default: small
// ─────────────────────────────────────────────────────────────────────────────
type DatasetMode = 'small' | 'medium' | 'large' | 'enterprise';

function resolveDatasetMode(): DatasetMode {
  const flag = process.argv.find(a => a.startsWith('--dataset='));
  if (flag) {
    const val = flag.split('=')[1] as DatasetMode;
    if (['small', 'medium', 'large', 'enterprise'].includes(val)) return val;
  }
  return 'small';
}

const PLAYWRIGHT_CONFIG = 'testing/config/playwright.config.ts';

// Phase B — Build command with adaptive worker count
function buildCommand(runner: RunnerType, testFile: string, workers: number): string {
  if (runner === 'playwright') {
    return `npx playwright test ${testFile} --config=${PLAYWRIGHT_CONFIG} --reporter=list --workers=${workers}`;
  }
  return `npx vitest run ${testFile}`;
}

function resolveWorkerCount(pack: PackDefinition): number {
  return WEIGHT_WORKER_MAP[pack.profile.weight];
}

function parsePlaywrightOutput(exitCode: number, output: string): { status: PackStatus; reason?: string } {
  if (exitCode === 0) return { status: 'PASS' };
  if (output.includes('No tests found')) return { status: 'CONFIGURATION_ERROR', reason: 'No tests found' };
  if (output.includes('Cannot find module')) return { status: 'CONFIGURATION_ERROR', reason: 'Cannot find module' };
  if (
    output.includes('ECONNREFUSED') ||
    output.includes('Server unavailable') ||
    output.includes('ERR_CONNECTION_REFUSED')
  ) {
    return { status: 'BLOCKED', reason: 'Server unavailable' };
  }
  return { status: 'FAIL', reason: 'Assertion failures' };
}

async function checkFrontend(): Promise<boolean> {
  try {
    const res = await fetch('http://localhost:3000');
    return res.status === 200;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase F — Generic Warm-up Strategy
// Pre-fetches the application root so Vite transforms and caches the module
// graph for all routes before heavy packs start. Does NOT hardcode any specific
// page or component. Works by requesting the root HTML which triggers the Vite
// module transform pipeline for the entry bundle.
// ─────────────────────────────────────────────────────────────────────────────
async function warmupViteServer(): Promise<number> {
  const warmupStart = Date.now();
  console.log('[CPO] Warm-up: Pre-warming Vite module graph...');
  try {
    // Request root to seed the entry bundle transform
    await fetch('http://localhost:3000/');
    // Allow Vite background transforms to settle
    await new Promise(resolve => setTimeout(resolve, 3000));
    const elapsed = Date.now() - warmupStart;
    console.log(`[CPO] Warm-up complete in ${elapsed}ms`);
    return elapsed;
  } catch (e) {
    console.warn('[CPO] Warm-up skipped — server not reachable');
    return 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Runner
// ─────────────────────────────────────────────────────────────────────────────
async function runCertification() {
  const runnerStart = Date.now();
  const datasetMode = resolveDatasetMode();

  console.log('--- RESOLVE CERTIFICATION ENGINE v5.0 (CPO v1.0) ---');
  console.log(`Dataset mode: ${datasetMode.toUpperCase()}`);
  console.log(`Adaptive worker scheduling: ENABLED`);
  console.log(`Worker map: LIGHT=${WEIGHT_WORKER_MAP.LIGHT} | MEDIUM=${WEIGHT_WORKER_MAP.MEDIUM} | HEAVY=${WEIGHT_WORKER_MAP.HEAVY} | VERY_HEAVY=${WEIGHT_WORKER_MAP.VERY_HEAVY}`);

  // ── Phase E telemetry accumulators ───────────────────────────────────────
  const telemetry = {
    sandboxCreationMs: 0,
    provisioningMs: 0,
    authMs: 0,
    warmupMs: 0,
    skippedPacks: 0,
    retries: 0,
    infrastructureFailures: 0,
    applicationFailures: 0,
  };

  let sandboxId: string | undefined;

  // ── Environment checks ───────────────────────────────────────────────────
  const envVars = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];
  const missingEnv = envVars.some(v => !process.env[v]);
  const isFrontendUp = await checkFrontend();
  const infrastructureBlocked = missingEnv || !isFrontendUp;

  if (infrastructureBlocked) {
    console.error('INFRASTRUCTURE BLOCKED: Missing env vars or frontend offline.');
    telemetry.infrastructureFailures++;
  }

  const results = new Map<PackName, PackResult>();
  for (const pack of PACKS) {
    results.set(pack.name, {
      status: infrastructureBlocked ? 'BLOCKED' : 'PENDING',
      workerCount: resolveWorkerCount(pack),
    });
  }

  if (!infrastructureBlocked) {
    try {
      // ── Phase C — Shared Sandbox (single creation, immutable context) ────
      const sandboxStart = Date.now();
      console.log('\n[CPO] Phase C: Shared sandbox provisioning...');
      const sandbox = await SandboxIntegration.createSandbox();
      sandboxId = sandbox.sandboxId;
      telemetry.sandboxCreationMs = Date.now() - sandboxStart;
      console.log(`[CPO] Sandbox ready: ${sandboxId} (${telemetry.sandboxCreationMs}ms)`);

      // ── Identity provisioning ─────────────────────────────────────────────
      const provStart = Date.now();
      const identities = await SandboxIntegration.provisionTestIdentities(sandboxId);
      telemetry.provisioningMs = Date.now() - provStart;
      console.log(`[CPO] Identities provisioned (${telemetry.provisioningMs}ms)`);

      // ── Write shared context (single write, all packs consume) ───────────
      const contextData = {
        sandboxId,
        workspaceId: sandboxId,
        identities,
        provisionTimestamp: Date.now(),
      };
      fs.writeFileSync(
        path.join(__dirname, '../sandbox/context.json'),
        JSON.stringify(contextData, null, 2)
      );

      // ── Phase D — Dataset seeding ─────────────────────────────────────────
      const payload = DataFactory.generateSuite(datasetMode);
      await SandboxIntegration.seedSandbox(sandboxId, payload);
      console.log(`[CPO] Sandbox seeded with dataset: ${datasetMode.toUpperCase()}`);

      // ── Phase F — Warm-up before heavy packs ─────────────────────────────
      const hasHeavyPack = PACKS.some(p => p.profile.weight === 'HEAVY' || p.profile.weight === 'VERY_HEAVY');
      if (hasHeavyPack) {
        telemetry.warmupMs = await warmupViteServer();
      }

      // ── Execute packs sequentially (dependency-aware) ─────────────────────
      for (const pack of PACKS) {
        let depsMet = true;
        let skipReason = '';

        if (!pack.independent) {
          for (const dep of pack.dependencies) {
            const depResult = results.get(dep);
            if (depResult && depResult.status !== 'PASS') {
              depsMet = false;
              skipReason = `${dep} not certified`;
              break;
            }
          }
        }

        if (!depsMet) {
          results.set(pack.name, {
            status: 'SKIPPED',
            reason: skipReason,
            workerCount: resolveWorkerCount(pack),
          });
          telemetry.skippedPacks++;
          console.log(`\n[CPO] Skipping: ${pack.name} — ${skipReason}`);
          continue;
        }

        // Self-validation
        if (pack.runner === 'playwright' && !fs.existsSync(PLAYWRIGHT_CONFIG)) {
          results.set(pack.name, {
            status: 'CONFIGURATION_ERROR',
            reason: `Config not found: ${PLAYWRIGHT_CONFIG}`,
            workerCount: resolveWorkerCount(pack),
          });
          continue;
        }
        if (!fs.existsSync(pack.file)) {
          results.set(pack.name, {
            status: 'CONFIGURATION_ERROR',
            reason: `Test file not found: ${pack.file}`,
            workerCount: resolveWorkerCount(pack),
          });
          continue;
        }

        // ── Phase B — Adaptive worker resolution ─────────────────────────
        const workers = resolveWorkerCount(pack);
        const cmd = buildCommand(pack.runner, pack.file, workers);

        console.log(`\nExecuting: ${pack.name}... [weight=${pack.profile.weight} workers=${workers} est=${pack.profile.estimatedSeconds}s]`);

        const packStart = Date.now();
        try {
          const spawnResult = spawnSync(cmd, {
            shell: true,
            stdio: ['ignore', 'pipe', 'pipe'],
            encoding: 'utf-8',
          });
          const exitCode = spawnResult.status ?? 1;
          const output = (spawnResult.stdout || '') + '\n' + (spawnResult.stderr || '');
          const executionMs = Date.now() - packStart;

          console.log(output);

          const classification = parsePlaywrightOutput(exitCode, output);

          if (classification.status === 'FAIL') {
            telemetry.applicationFailures++;
          }

          results.set(pack.name, {
            status: classification.status,
            reason: classification.reason,
            exitCode,
            command: cmd,
            workerCount: workers,
            executionMs,
            retries: 0,
          });
        } catch (e: any) {
          const executionMs = Date.now() - packStart;
          telemetry.infrastructureFailures++;
          results.set(pack.name, {
            status: 'CONFIGURATION_ERROR',
            reason: 'Failed to spawn process',
            exitCode: 1,
            command: cmd,
            workerCount: workers,
            executionMs,
          });
        }
      }
    } catch (err) {
      console.error('Fatal Runner Error:', err);
      telemetry.infrastructureFailures++;
    } finally {
      // ── Phase C — Shared sandbox cleanup (single cycle) ───────────────────
      if (sandboxId) {
        await SandboxIntegration.destroySandbox(sandboxId);
        const ctxPath = path.join(__dirname, '../sandbox/context.json');
        if (fs.existsSync(ctxPath)) fs.unlinkSync(ctxPath);
      }
    }
  }

  const totalMs = Date.now() - runnerStart;

  // ── Phase E — Terminal telemetry summary ──────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════');
  console.log('  CPO v1.0 — CERTIFICATION TELEMETRY SUMMARY');
  console.log('══════════════════════════════════════════════════════');
  console.log(`  Total runtime         : ${(totalMs / 1000).toFixed(1)}s`);
  console.log(`  Dataset mode          : ${datasetMode.toUpperCase()}`);
  console.log(`  Sandbox creation      : ${(telemetry.sandboxCreationMs / 1000).toFixed(1)}s`);
  console.log(`  Identity provisioning : ${(telemetry.provisioningMs / 1000).toFixed(1)}s`);
  console.log(`  Vite warm-up          : ${(telemetry.warmupMs / 1000).toFixed(1)}s`);
  console.log(`  Skipped packs         : ${telemetry.skippedPacks}`);
  console.log(`  Retries               : ${telemetry.retries}`);
  console.log(`  Infrastructure faults : ${telemetry.infrastructureFailures}`);
  console.log(`  Application failures  : ${telemetry.applicationFailures}`);
  console.log('──────────────────────────────────────────────────────');
  console.log('  PACK RESULTS:');

  for (const pack of PACKS) {
    const res = results.get(pack.name)!;
    const duration = res.executionMs ? `${(res.executionMs / 1000).toFixed(1)}s` : 'N/A';
    const status = res.status.padEnd(20);
    console.log(`  ${pack.name.padEnd(20)} ${status} workers=${res.workerCount ?? '?'}  time=${duration}`);
  }

  console.log('══════════════════════════════════════════════════════');

  // ── Regression summary (preserved for compatibility) ──────────────────────
  console.log('\n--- REGRESSION SUMMARY ---');
  for (const pack of PACKS) {
    const res = results.get(pack.name)!;
    console.log(`Executed command: ${res.command || 'N/A'}`);
    console.log(`Result classification: ${res.reason || 'Success'}`);
    console.log(`Exit code: ${res.exitCode !== undefined ? res.exitCode : 'N/A'}`);
    console.log(`Status: ${res.status}`);
  }

  const passCount = Array.from(results.values()).filter(r => r.status === 'PASS').length;
  const confidence = Math.round((passCount / PACKS.length) * 100);
  console.log(`Confidence: ${confidence}%`);
}

runCertification();

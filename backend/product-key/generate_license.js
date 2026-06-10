#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════
 *  Resolve PM v1.3 — License Key Generator & Signer
 *  ─────────────────────────────────────────────────────────────
 *  This script:
 *    1. Generates an RSA-PSS key pair (2048-bit)
 *    2. Saves private key as  ./keys/private_key.pem   (NEVER commit)
 *    3. Saves public key as   ./keys/public_key.jwk.json
 *    4. Creates a signed      ./license.json  for a given customer
 *
 *  Usage:
 *    node generate_license.js                         ← generates keys + demo license
 *    node generate_license.js --customer "Acme Corp" --plan ENTERPRISE --days 365
 *    node generate_license.js --sign-only             ← uses existing keys
 *
 *  Requirements:
 *    Node 18+ (Web Crypto API available via globalThis.crypto)
 *
 *  SECURITY NOTES:
 *    • private_key.pem is gitignored and must NEVER be committed.
 *    • The public JWK must be embedded in the frontend (productKey.ts).
 *    • Distribute license.json to customers via secure channel only.
 * ═══════════════════════════════════════════════════════════════
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { subtle } = require('crypto').webcrypto ?? globalThis.crypto;

// ── Constants ──────────────────────────────────────────────────
const KEYS_DIR    = path.join(__dirname, 'keys');
const PRIV_PATH   = path.join(KEYS_DIR, 'private_key.pem');
const PUB_PATH    = path.join(KEYS_DIR, 'public_key.jwk.json');
const LICENSE_OUT = path.join(__dirname, 'license.json');

const ALG = {
  name: 'RSA-PSS',
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: 'SHA-256',
};

// ── CLI argument parsing ───────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (flag) => {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : null;
};

const CUSTOMER   = getArg('--customer') || 'Acme Corp';
const PLAN       = getArg('--plan')     || 'BUSINESS';
const DAYS       = parseInt(getArg('--days') || '365', 10);
const SIGN_ONLY  = args.includes('--sign-only');
const HELP       = args.includes('--help') || args.includes('-h');

if (HELP) {
  console.log(`
Resolve PM License Generator
─────────────────────────────
Usage:
  node generate_license.js [options]

Options:
  --customer <name>   Customer/company name  (default: "Acme Corp")
  --plan <plan>       License plan           (STARTER | BUSINESS | ENTERPRISE)
  --days <n>          License validity days  (default: 365)
  --sign-only         Use existing keys; don't regenerate keypair
  --help, -h          Show this help message

Output:
  ./keys/private_key.pem       RSA-PSS private key (PEM) — NEVER COMMIT
  ./keys/public_key.jwk.json   Public key in JWK format — embed in frontend
  ./license.json               Signed license file — distribute to customer
`);
  process.exit(0);
}

// ── Utility: base64url encoding ────────────────────────────────
function base64url(buffer) {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// ── Utility: PEM encode ────────────────────────────────────────
function toPem(arrayBuffer, label) {
  const b64 = Buffer.from(arrayBuffer).toString('base64');
  const lines = b64.match(/.{1,64}/g).join('\n');
  return `-----BEGIN ${label}-----\n${lines}\n-----END ${label}-----\n`;
}

// ── Generate RSA-PSS key pair ──────────────────────────────────
async function generateKeyPair() {
  console.log('🔑 Generating RSA-PSS 2048-bit key pair...');

  const keyPair = await subtle.generateKey(ALG, true, ['sign', 'verify']);

  // Export private key as PKCS8
  const privDer = await subtle.exportKey('pkcs8', keyPair.privateKey);
  const privPem = toPem(privDer, 'PRIVATE KEY');

  // Export public key as SPKI (for PEM) and JWK (for frontend embedding)
  const pubJwk = await subtle.exportKey('jwk', keyPair.publicKey);

  // Ensure keys directory exists
  if (!fs.existsSync(KEYS_DIR)) {
    fs.mkdirSync(KEYS_DIR, { recursive: true });
  }

  fs.writeFileSync(PRIV_PATH, privPem, { mode: 0o600 });
  fs.writeFileSync(PUB_PATH, JSON.stringify(pubJwk, null, 2));

  // Write .gitignore inside keys/ to prevent accidental commits
  fs.writeFileSync(
    path.join(KEYS_DIR, '.gitignore'),
    '# NEVER commit the private key\n*\n!.gitignore\n!public_key.jwk.json\n'
  );

  console.log(`✅ Private key saved: ${PRIV_PATH}  ← NEVER COMMIT THIS FILE`);
  console.log(`✅ Public JWK saved:  ${PUB_PATH}`);

  return { privateKey: keyPair.privateKey, publicJwk: pubJwk };
}

// ── Load existing private key from PEM ────────────────────────
async function loadPrivateKey() {
  if (!fs.existsSync(PRIV_PATH)) {
    throw new Error(`Private key not found at ${PRIV_PATH}. Run without --sign-only first.`);
  }
  const pem = fs.readFileSync(PRIV_PATH, 'utf8');
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der  = Buffer.from(b64, 'base64');

  const privateKey = await subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSA-PSS', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const pubJwk = JSON.parse(fs.readFileSync(PUB_PATH, 'utf8'));
  return { privateKey, publicJwk: pubJwk };
}

// ── Build license payload ──────────────────────────────────────
function buildPayload(publicJwk) {
  const now    = Date.now();
  const expiry = now + DAYS * 24 * 60 * 60 * 1000;

  return {
    version:      '1.3.0',
    schemaVersion: 1,
    licenseId:    `LIC-${Date.now().toString(36).toUpperCase()}`,
    issuedAt:     now,
    expiresAt:    expiry,
    companyName:  CUSTOMER,
    plan:         PLAN,
    features:     planFeatures(PLAN),
    supportExpiry: expiry,
    publicKeyThumbprint: thumbprint(publicJwk),
  };
}

function planFeatures(plan) {
  const base = ['task_management', 'project_tracking', 'team_inbox', 'reports'];
  if (plan === 'BUSINESS' || plan === 'ENTERPRISE') {
    base.push('advanced_automation', 'continuity_engine', 'workspace_clone');
  }
  if (plan === 'ENTERPRISE') {
    base.push('multi_workspace', 'audit_log', 'priority_sla', 'api_access');
  }
  return base;
}

function thumbprint(jwk) {
  // A simple identifier based on the key's modulus to bind license to key
  const n = jwk.n || '';
  return n.substring(0, 16);
}

// ── Sign payload ───────────────────────────────────────────────
async function signPayload(privateKey, payload) {
  const encoder = new TextEncoder();
  const data     = encoder.encode(JSON.stringify(payload));

  const sigBuffer = await subtle.sign(
    { name: 'RSA-PSS', saltLength: 32 },
    privateKey,
    data
  );

  return base64url(sigBuffer);
}

// ── Main ───────────────────────────────────────────────────────
async function main() {
  console.log('\n🏷️  Resolve PM License Generator v1.3\n');

  let privateKey, publicJwk;

  if (SIGN_ONLY) {
    console.log('📂 Loading existing keys (--sign-only mode)...');
    ({ privateKey, publicJwk } = await loadPrivateKey());
  } else {
    ({ privateKey, publicJwk } = await generateKeyPair());
  }

  console.log('\n📝 Building license payload...');
  const payload   = buildPayload(publicJwk);
  console.log('   Customer:   ', payload.companyName);
  console.log('   Plan:       ', payload.plan);
  console.log('   License ID: ', payload.licenseId);
  console.log('   Expires:    ', new Date(payload.expiresAt).toISOString());

  console.log('\n✍️  Signing license with RSA-PSS SHA-256...');
  const signature = await signPayload(privateKey, payload);

  const license = { payload, signature };
  fs.writeFileSync(LICENSE_OUT, JSON.stringify(license, null, 2));

  console.log(`\n✅ License written: ${LICENSE_OUT}`);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('NEXT STEPS:');
  console.log('  1. Embed the public JWK in frontend/src/lib/productKey.ts');
  console.log(`     → Copy contents of: ${PUB_PATH}`);
  console.log('  2. Distribute license.json to the customer securely.');
  console.log('  3. NEVER commit private_key.pem to version control.');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch((err) => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});

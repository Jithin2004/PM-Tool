// ── Product Key Verification, Offline Grace Period & License File Support ──
// Phase 8 Upgrade: Adds RSA-PSS offline license.json verification via Web Crypto API

import { supabase } from './supabase';
import { sha256 } from '../utils/cryptoUtils';

const STORAGE_KEY = 'resolve-product-license';
const FINGERPRINT_KEY = 'resolve-device-fingerprint';
const envApiUrl = (import.meta as any).env.VITE_PRODUCT_KEY_API_URL;
if (import.meta.env.PROD && !envApiUrl) {
  throw new Error('VITE_PRODUCT_KEY_API_URL is missing in production environment. License verification cannot proceed.');
}
const API_BASE_URL = envApiUrl || 'http://localhost:10000'; // Development fallback
const ACTIVATE_URL = `${API_BASE_URL}/activate`;
const VERIFY_URL = `${API_BASE_URL}/verify`;
const TIMEOUT_MS = 30_000;
const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ── Embedded Public Verification Key (JWK) ───────────────────────────────────
// Generated via: node backend/product-key/generate_license.js
// The private key is never stored in this repository.
// To update: re-generate keys and paste the new public_key.jwk.json contents here.
// PLACEHOLDER: Replace with real generated JWK before production deployment.
const PUBLIC_JWK: JsonWebKey = {
  kty: 'RSA',
  alg: 'PS256',
  use: 'sig',
  e: 'AQAB',
  // n: '<paste-your-modulus-here-from-keys/public_key.jwk.json>',
  n: 'PLACEHOLDER_REPLACE_WITH_REAL_MODULUS',
};

const LICENSE_SCHEMA_VERSION = 1;

export type LicenseStatus = 'Unactivated' | 'Activated' | 'Expired Support' | 'Transferred Ownership' | 'Invalid' | 'inactive';

export interface LicenseData {
  token: string;
  verifiedAt: number;
  productKey: string;
  plan?: string;
  features?: string[];
  offlineVerified?: boolean;
  offlineLicense?: boolean; // true when loaded from license.json file
  status: LicenseStatus;
  companyName?: string;
  purchaseId?: string;
  supportExpiry?: number;
}

export interface VerifyResult {
  success: boolean;
  error?: string;
  token?: string;
  plan?: string;
  licenseData?: LicenseData;
}

// ── License File Payload (from generate_license.js) ─────────────────────────
interface LicenseFilePayload {
  version: string;
  schemaVersion: number;
  licenseId: string;
  issuedAt: number;
  expiresAt: number;
  companyName: string;
  plan: string;
  features: string[];
  supportExpiry: number;
  publicKeyThumbprint: string;
}

interface LicenseFile {
  payload: LicenseFilePayload;
  signature: string; // base64url-encoded RSA-PSS signature
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function base64urlToBuffer(b64url: string): ArrayBuffer {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// Generate or fetch device fingerprint from localStorage
export function getDeviceFingerprint(): string {
  try {
    let fp = localStorage.getItem(FINGERPRINT_KEY);
    if (!fp) {
      const screenInfo = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;
      const navigatorInfo = `${window.navigator.userAgent}-${window.navigator.language}`;
      const randomPart = Math.random().toString(36).substring(2, 15);
      const raw = `${screenInfo}-${navigatorInfo}-${randomPart}`;
      
      let hash = 0;
      for (let i = 0; i < raw.length; i++) {
        const char = raw.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
      }
      fp = `dev-${Math.abs(hash).toString(16)}-${randomPart}`;
      localStorage.setItem(FINGERPRINT_KEY, fp);
    }
    return fp;
  } catch {
    return 'fallback-fingerprint';
  }
}

let memoryLicense: LicenseData | null = null;

function getStored(): LicenseData | null {
  return memoryLicense;
}

// ── RSA-PSS Offline License File Verification ────────────────────────────────
/**
 * Verifies a license.json file produced by generate_license.js using the
 * embedded RSA-PSS public key via the Web Crypto API.
 *
 * On success, writes the verified license into localStorage so the app
 * treats the installation as activated.
 */
export async function verifyLicenseFile(file: File): Promise<VerifyResult> {
  try {
    const text = await file.text();
    let licenseFile: LicenseFile;

    try {
      licenseFile = JSON.parse(text);
    } catch {
      return { success: false, error: 'Invalid license file: not valid JSON.' };
    }

    if (!licenseFile.payload || !licenseFile.signature) {
      return { success: false, error: 'Invalid license file: missing payload or signature.' };
    }

    const { payload, signature } = licenseFile;

    // Schema version guard
    if (payload.schemaVersion !== LICENSE_SCHEMA_VERSION) {
      return { success: false, error: `License schema version mismatch. Expected ${LICENSE_SCHEMA_VERSION}, got ${payload.schemaVersion}.` };
    }

    // Expiry check
    if (Date.now() > payload.expiresAt) {
      return { success: false, error: `License expired on ${new Date(payload.expiresAt).toLocaleDateString()}.` };
    }

    // Guard: fail closed if verification key is missing or placeholder
    const isPlaceholderKey = PUBLIC_JWK.n === 'PLACEHOLDER_REPLACE_WITH_REAL_MODULUS' || !PUBLIC_JWK.n;
    if (isPlaceholderKey) {
      return { success: false, error: 'Verification key missing. Offline license validation failed.' };
    }

    // Import public key
    let publicKey: CryptoKey;
    try {
      publicKey = await crypto.subtle.importKey(
        'jwk',
        PUBLIC_JWK,
        { name: 'RSA-PSS', hash: 'SHA-256' },
        false,
        ['verify']
      );
    } catch {
      return { success: false, error: 'Failed to import verification key. License file may be corrupt.' };
    }

    // Verify signature
    const signatureBuffer = base64urlToBuffer(signature);
    const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
    const isValid = await crypto.subtle.verify(
      { name: 'RSA-PSS', saltLength: 32 },
      publicKey,
      signatureBuffer,
      payloadBytes
    );

    if (!isValid) {
      return { success: false, error: 'License signature is invalid. This license file may have been tampered with.' };
    }

    // Build and store the license
    const license: LicenseData = {
      token: `offline-${payload.licenseId}`,
      verifiedAt: Date.now(),
      productKey: payload.licenseId,
      plan: payload.plan,
      features: payload.features,
      offlineVerified: true,
      offlineLicense: true,
      status: Date.now() > payload.supportExpiry ? 'Expired Support' : 'Activated',
      companyName: payload.companyName,
      purchaseId: payload.licenseId,
      supportExpiry: payload.supportExpiry,
    };
    
    memoryLicense = license;

    return { success: true, plan: payload.plan, licenseData: license };

  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to verify license file.' };
  }
}

// ── Synchronous check to gate routers/onboarding ─────────────────────────────
export function isProductKeyVerified(): boolean {
  const stored = getStored();
  if (stored) {
    if (stored.status === 'Activated' || stored.status === 'Expired Support') {
      // Enforce 7-day grace period
      const age = Date.now() - stored.verifiedAt;
      if (age <= GRACE_PERIOD_MS) {
        return true;
      }
    }
  }
  
  // Fallback: Check if we have a pending activation validated in sessionStorage during onboarding
  try {
    const pendingStr = sessionStorage.getItem('pendingLicenseActivation');
    if (pendingStr) {
      const parsed = JSON.parse(pendingStr);
      if (parsed.validated) {
        return true;
      }
    }
  } catch (e) {}

  return false;
}

export function getLicenseInfo(): LicenseData | null {
  return getStored();
}

export function clearLicense(): void {
  memoryLicense = null;
}

// ── Activate new license key via server ──────────────────────────────────────
export async function validateNewActivationKey(productKey: string): Promise<VerifyResult> {
  if (!productKey.trim()) {
    return { success: false, error: 'Product key is required.' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        productKey: productKey.trim()
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const errorMsg = body?.error || `Verification failed (${res.status}).`;
      return { success: false, error: errorMsg };
    }

    const data = await res.json();
    const token = data?.licenseId || data?.token; // fallback for token
    const plan = data?.plan || 'BUSINESS';

    if (!token) {
      return { success: false, error: 'Server did not return a verification token or license ID.' };
    }

    const license: LicenseData = {
      token,
      verifiedAt: Date.now(),
      productKey: productKey.trim(),
      plan,
      offlineVerified: false,
      offlineLicense: false,
      status: 'Activated',
      companyName: data?.companyName || 'Enterprise Customer',
      purchaseId: data?.purchaseId || `INV-${Math.floor(Math.random() * 100000)}`,
      supportExpiry: data?.supportUntil || data?.supportExpiry || Date.now() + 365 * 24 * 60 * 60 * 1000
    };

    memoryLicense = license;
    return { success: true, token, plan, licenseData: license };

  } catch (err: any) {
    clearTimeout(timer);
    if (err?.name === 'AbortError') {
      return { success: false, error: 'Verification timed out. Server may be unavailable.' };
    }
    return {
      success: false,
      error: err?.message === 'Failed to fetch'
        ? 'Unable to reach activation server. Check your connection and try again.'
        : (err?.message || 'Verification failed. Please try again.'),
    };
  }
}

// ── Verify existing license key via server ──────────────────────────────────────
export async function verifyLicenseKey(productKey: string): Promise<VerifyResult> {
  if (!productKey.trim()) {
    return { success: false, error: 'Product key is required.' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        productKey: productKey.trim()
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const errorMsg = body?.error || `Verification failed (${res.status}).`;
      return { success: false, error: errorMsg };
    }

    const data = await res.json();
    const token = data?.licenseId || data?.token;
    const plan = data?.plan || 'BUSINESS';

    const license: LicenseData = {
      token,
      verifiedAt: Date.now(),
      productKey: productKey.trim(),
      plan,
      offlineVerified: false,
      offlineLicense: false,
      status: 'Activated',
      companyName: data?.companyName || 'Enterprise Customer',
      purchaseId: data?.purchaseId || `INV-${Math.floor(Math.random() * 100000)}`,
      supportExpiry: data?.supportUntil || data?.supportExpiry || Date.now() + 365 * 24 * 60 * 60 * 1000
    };

    memoryLicense = license;
    return { success: true, token, plan, licenseData: license };

  } catch (err: any) {
    clearTimeout(timer);
    if (err?.name === 'AbortError') {
      return { success: false, error: 'Verification timed out. Server may be unavailable.' };
    }
    return {
      success: false,
      error: err?.message === 'Failed to fetch'
        ? 'Unable to reach activation server. Check your connection and try again.'
        : (err?.message || 'Verification failed. Please try again.'),
    };
  }
}

export async function validateWorkspaceLicenseUpdate(productKey: string, currentWorkspaceId: string): Promise<VerifyResult> {
  if (!productKey.trim() || !currentWorkspaceId) {
    return { success: false, error: 'Product key and workspace ID are required.' };
  }

  // Generate SHA-256 hash of productKey
  const hashedKey = await sha256(productKey.trim());

  // 1. Fetch license record from local DB
  const { data: localLicense } = await supabase
    .from('workspace_license')
    .select('workspace_id, activation_date')
    .eq('license_key_hash', hashedKey)
    .maybeSingle();

  if (localLicense) {
    if (localLicense.workspace_id && localLicense.workspace_id !== currentWorkspaceId) {
      return { success: false, error: 'This key is already attached to another workspace on this system.' };
    }
    // Existing local license -> check /verify
    return await verifyLicenseKey(productKey);
  }

  // No local license -> First activation
  return await validateNewActivationKey(productKey);
}

// ── Background online license check ──────────────────────────────────────────
export async function checkLicenseOnline(): Promise<{ valid: boolean; offline: boolean; error?: string }> {
  try {
    const { data: license, error } = await supabase.from('workspace_license').select('*').limit(1).maybeSingle();
    
    if (error || !license) {
      memoryLicense = null;
      return { valid: false, offline: false, error: 'No license key activated in database.' };
    }
    
    const isLicenseActivated = license.workspace_id && license.activation_date;
    if (!isLicenseActivated) {
      memoryLicense = null;
      return { valid: false, offline: false, error: 'License is inactive.' };
    }

    const isSupportExpired = license.support_until && new Date(license.support_until).getTime() < Date.now();
    const derivedStatus: LicenseStatus = isSupportExpired ? 'Expired Support' : 'Activated';

    memoryLicense = {
      token: license.id,
      verifiedAt: Date.now(),
      productKey: license.license_key_hash,
      plan: license.license_type,
      status: derivedStatus,
      offlineVerified: true,
      offlineLicense: false,
      supportExpiry: license.support_until ? new Date(license.support_until).getTime() : undefined,
    };
    
    return { valid: true, offline: false };
  } catch (err: any) {
    memoryLicense = null;
    return { valid: false, offline: false, error: err.message };
  }
}

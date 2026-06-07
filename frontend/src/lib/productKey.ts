// ── Product Key Verification & Offline Grace Period ──

const STORAGE_KEY = 'resolve-product-license';
const FINGERPRINT_KEY = 'resolve-device-fingerprint';
const API_BASE_URL = (import.meta as any).env.VITE_PRODUCT_KEY_API_URL || 'http://localhost:5000';
const ACTIVATE_URL = `${API_BASE_URL}/activate`;
const VERIFY_URL = `${API_BASE_URL}/verify`;
const TIMEOUT_MS = 10_000;
const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface LicenseData {
  token: string;
  verifiedAt: number;
  productKey: string;
  plan?: string;
  features?: string[];
  offlineVerified?: boolean;
}

export interface VerifyResult {
  success: boolean;
  error?: string;
  token?: string;
  plan?: string;
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

function getStored(): LicenseData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.token === 'string' && typeof parsed.verifiedAt === 'number') {
      return parsed as LicenseData;
    }
    return null;
  } catch {
    return null;
  }
}

// Synchronous check to gate routers/onboarding
export function isProductKeyVerified(): boolean {
  const stored = getStored();
  if (!stored) return false;
  
  // Enforce 7-day grace period
  const age = Date.now() - stored.verifiedAt;
  if (age > GRACE_PERIOD_MS) {
    return false;
  }
  return true;
}

export function getLicenseInfo(): LicenseData | null {
  return getStored();
}

export function clearLicense(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
}

// Activate new license key
export async function verifyProductKey(productKey: string): Promise<VerifyResult> {
  if (!productKey.trim()) {
    return { success: false, error: 'Product key is required.' };
  }

  const fingerprint = getDeviceFingerprint();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(ACTIVATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        productKey: productKey.trim(),
        fingerprint
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
    const token = data?.token;
    const plan = data?.plan || 'BUSINESS';

    if (!token) {
      return { success: false, error: 'Server did not return a verification token.' };
    }

    const license: LicenseData = {
      token,
      verifiedAt: Date.now(),
      productKey: productKey.trim(),
      plan,
      offlineVerified: false
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(license));
    return { success: true, token, plan };

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

// Background checking for license validation
export async function checkLicenseOnline(): Promise<{ valid: boolean; offline: boolean; error?: string }> {
  const stored = getStored();
  if (!stored) {
    return { valid: false, offline: false, error: 'No license key activated.' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(VERIFY_URL, {
      method: 'GET',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${stored.token}`
      },
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (res.status === 401 || res.status === 403) {
      // Explicit invalidation by server (revoked/expired/fingerprint mismatch)
      clearLicense();
      return { valid: false, offline: false, error: 'License is no longer valid.' };
    }

    if (!res.ok) {
      throw new Error(`Server returned status ${res.status}`);
    }

    const data = await res.json();
    if (data && data.valid) {
      // Update local storage verification time
      const updated: LicenseData = {
        ...stored,
        verifiedAt: Date.now(),
        plan: data.plan || stored.plan || 'BUSINESS',
        features: data.features || [],
        offlineVerified: false
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return { valid: true, offline: false };
    } else {
      clearLicense();
      return { valid: false, offline: false, error: data.error || 'License is invalid.' };
    }

  } catch (err: any) {
    clearTimeout(timer);
    
    // Server is offline or unreachable - check grace period
    const age = Date.now() - stored.verifiedAt;
    if (age <= GRACE_PERIOD_MS) {
      // Within 7 days - mark as offline verified
      const updated: LicenseData = {
        ...stored,
        offlineVerified: true
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return { valid: true, offline: true };
    } else {
      // Grace period expired
      clearLicense();
      return { valid: false, offline: false, error: 'License verification grace period expired. Connect to the internet to verify.' };
    }
  }
}

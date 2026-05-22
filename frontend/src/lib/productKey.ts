// ── Product Key Verification ──

const STORAGE_KEY = 'resolve-product-license';
const API_BASE_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:5000';
const VERIFY_URL = `${API_BASE_URL}/activate`;
const TIMEOUT_MS = 10_000;

interface LicenseData {
  token: string;
  verifiedAt: number;
  productKey: string;
}

export interface VerifyResult {
  success: boolean;
  error?: string;
  token?: string;
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

export function isProductKeyVerified(): boolean {
  const stored = getStored();
  if (!stored) return false;
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

export async function verifyProductKey(productKey: string): Promise<VerifyResult> {
  if (!productKey.trim()) {
    return { success: false, error: 'Product key is required.' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productKey: productKey.trim() }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return {
        success: false,
        error: body ? `Server returned ${res.status}: ${body.slice(0, 200)}` : `Verification failed (${res.status}).`,
      };
    }

    const data = await res.json();

    const token = data?.token || data?.access_token || data?.key || crypto.randomUUID();

    const license: LicenseData = {
      token,
      verifiedAt: Date.now(),
      productKey: productKey.trim(),
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(license));
    } catch { /* storage full — proceed anyway */ }

    return { success: true, token };
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

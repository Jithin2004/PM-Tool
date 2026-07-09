
// ─────────────────────────────────────────────────────────────────────────────
// Onboarding API client
//
// Changes in this patch:
//   1. In-flight guard: prevents duplicate concurrent onboard requests.
//      The module-level flag _onboardingInFlight ensures only one call can
//      be active at a time. The finally block always clears it.
//   2. X-Idempotency-Key header: sends workspaceId as the idempotency key
//      so the backend can return a cached response on safe retries.
//   3. isOnboardingInFlight(): exported so UI components can disable the
//      submit button while a request is in progress.
//
// API_BASE_URL and TIMEOUT_MS are defined in the consuming module's config.
// ─────────────────────────────────────────────────────────────────────────────

const ONBOARD_URL = `${API_BASE_URL}/onboard`;

/** True while an onboarding request is in-flight. */
let _onboardingInFlight = false;

/**
 * Returns true if an onboarding request is currently in progress.
 * Use this to disable the submit button in your UI component.
 */
export function isOnboardingInFlight(): boolean {
  return _onboardingInFlight;
}

/**
 * Submits the workspace onboarding request to the backend.
 *
 * Throws if a request is already in-flight (prevents duplicate submissions).
 * Always clears the in-flight flag on completion or error.
 *
 * Sends X-Idempotency-Key using the workspaceId so the backend can safely
 * deduplicate retries caused by network timeouts.
 */
export async function onboardWorkspaceTransaction(payload: any, token: string): Promise<any> {
  if (_onboardingInFlight) {
    throw new Error('An onboarding request is already in progress. Please wait.');
  }

  _onboardingInFlight = true;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(ONBOARD_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        // Sends workspaceId as the idempotency key.
        // The backend caches successful responses for 24h keyed on this value,
        // so a network-timeout retry will receive the original result without
        // re-running the full onboarding flow.
        'X-Idempotency-Key': payload.workspaceId ?? ''
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || `Onboarding failed (${res.status})`);
    }

    return await res.json();
  } catch (err: any) {
    clearTimeout(timer);
    throw err;
  } finally {
    // Always reset — even on AbortError or network failure.
    _onboardingInFlight = false;
  }
}

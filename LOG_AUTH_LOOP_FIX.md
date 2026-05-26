# Change Log: Authentication Redirect Loop Fix

**Date**: May 26, 2026
**Issue**: Continuous login loop occurring during authentication flow: `Landing Page (/) -> Google OAuth -> Redirect to /overview -> Redirect back to Landing Page (/) -> Repeat`.

---

## Rationale & Root Cause Analysis

1. **Client-side Product Key Gate Limitation**:
   The application uses a client-side license verification check (`isProductKeyVerified()`) which relies on data stored in `localStorage` in the user's web browser.
   
2. **Early Gate Evaluation**:
   In `frontend/src/app/router.tsx`, the product key gate check was evaluated synchronously at the very beginning of the router component execution:
   ```typescript
   if (!isProductKeyVerified()) {
     return <Redirect to="/" />;
   }
   ```
   This ran before waiting for Supabase authentication states to resolve (e.g., `authLoading`, `profileResolved`).

3. **Impact on Invited Users**:
   When invited users log in on a new device or clear their browser data, their `localStorage` is empty. The router immediately redirects them to the landing page `/` upon reaching `/overview` after a successful Google OAuth login.
   On the landing page, they cannot bypass the gateway since `localStorage` is empty, leading to a loop where clicking login completes the Google flow, lands on `/overview`, and kicks them back to the landing page.

---

## Detailed Fixes & Changes

### 1. Updated `frontend/src/app/router.tsx`

**File Link**: [router.tsx](file:///C:/works/antigravity/PM-Tool/frontend/src/app/router.tsx)

* **Change**: Moved the product key verification gate after the authentication and workspace loading check screens, and updated it to bypass the gate if a valid Supabase `user` session is resolved.
* **Diff**:
  ```diff
  @@ -179,13 +179,6 @@
       return <Login />;
     }
   
  -  // ── Product key gate ──
  -
  -  if (!isProductKeyVerified()) {
  -    console.log("[ResolveRouter] Product key not verified, routing to /");
  -    return <Redirect to="/" />;
  -  }
  -
     if (workspaceLoading || authLoading || !profileResolved || profileHydrating) {
       return (
         <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] text-white">
  @@ -196,6 +196,13 @@
       );
     }
   
  +  // ── Product key gate ──
  +
  +  if (!isProductKeyVerified() && !user) {
  +    console.log("[ResolveRouter] Product key not verified, routing to /");
  +    return <Redirect to="/" />;
  +  }
  +
     if (!user) return <AuthPage />;
  ```

---

### 2. Updated `frontend/src/landing/LandingPage.tsx`

**File Link**: [LandingPage.tsx](file:///C:/works/antigravity/PM-Tool/frontend/src/landing/LandingPage.tsx)

* **Change**: Modified `verified` state detection to count the user as verified if they have an active authentication session. Removed the requirement for `isProductKeyVerified()` to be true for logged-in users to allow them to redirect properly.
* **Diff**:
  ```diff
  @@ -12,11 +12,11 @@
   import { AccessGateway } from './AccessGateway';
   
   export function LandingPage() {
  -  const verified = isProductKeyVerified();
  +  const verified = isProductKeyVerified() || !!useAuth().user;
     const { user, profile, profileResolved, loading: authLoading } = useAuth();
     const { workspace, loading: workspaceLoading } = useWorkspace();
   
  -  const authReady = verified && profileResolved && !authLoading;
  +  const authReady = profileResolved && !authLoading;
     const hasSession = authReady && !!user && !!profile && profile.role !== 'uninvited';
   ```

---

## Verification Results

- Verified that the codebase successfully builds with no compiler, linter, or type errors by executing:
  ```bash
  npm run build
  ```
  in the `frontend` folder, which successfully completed build compilation.

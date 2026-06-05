# Resolve PM Deployment Checklist

This document outlines the final steps and verifications required before deploying Resolve PM for a new organization.

## 1. Database & Security
- [ ] Run `MIGRATION_SPRINT6_RELEASE_CANDIDATE.sql` on the production Supabase project.
- [ ] Verify that all RLS policies are enabled and strict on all tables (especially `activity_logs`).
- [ ] Verify `DATABASE_HEALTH_REPORT.md` to ensure no orphaned foreign keys or duplicate columns exist in production schema.
- [ ] Ensure the Supabase Anon Key is secured and RLS policies prevent unauthorized access.

## 2. Environment Variables
- [ ] Copy `frontend/.env.example` to `frontend/.env.production`.
- [ ] Update `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to production Supabase credentials.
- [ ] Confirm `VITE_PRODUCT_KEY_API_URL` and `VITE_CALENDAR_API_URL` point to production backend domains.

## 3. Production Build & Hosting
- [ ] Run `npm run build` locally to verify no TypeScript or bundle size errors.
- [ ] Deploy the `frontend/dist` directory to Vercel, Netlify, or your preferred static host.
- [ ] Configure rewrite rules for Single Page Application (SPA) routing (e.g. `vercel.json` or `_redirects`).
- [ ] Ensure the frontend deployment has access to the correct Environment Variables.

## 4. Post-Deployment Verification
- [ ] Create a test workspace using the Super Admin role.
- [ ] Verify magic link and email invitations work for new members.
- [ ] Simulate roles (PM, HR, Employee) and verify that the UI restricts access to sensitive areas (like Finance and Settings).
- [ ] Verify that actions made during simulation mode correctly trigger the "Read-Only Simulation Mode" toast and prevent data mutation.
- [ ] Create a test project, assign tasks, log time, and verify that all actions are correctly logged immutably in `activity_logs`.

## 5. Final Handover
- [ ] Remove any leftover test workspaces (EXCEPT the Demo Workspace, if used for onboarding).
- [ ] Provide Super Admin credentials to the company owner.
- [ ] Hand over this checklist and confirm sign-off.

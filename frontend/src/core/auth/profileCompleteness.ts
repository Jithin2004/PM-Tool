import { User } from '../../types';

/**
 * Deterministically derives whether a user profile has completed their onboarding setup.
 * Rather than persisting a mutable status flag in the database, we derive this
 * from the presence of their initialized user preferences inside the profile's metadata.
 */
export function isProfileComplete(profile: User | null | undefined): boolean {
  if (!profile) return false;

  // Derive completeness from the existence of the preferences object in user metadata
  const metadata = (profile as any).metadata;
  if (metadata && typeof metadata === 'object') {
    if (metadata.preferences && typeof metadata.preferences === 'object') {
      return true;
    }
  }

  // Fallback: If they have a custom full name that isn't their default email prefix,
  // we can also treat them as complete to support legacy profiles gracefully.
  const fullName = profile.full_name?.trim();
  if (fullName && profile.email) {
    const emailPrefix = profile.email.split('@')[0].trim();
    if (fullName.toLowerCase() !== emailPrefix.toLowerCase()) {
      return true;
    }
  }

  return false;
}

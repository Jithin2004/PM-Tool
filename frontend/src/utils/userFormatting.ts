import type { Profile } from '../types';

export function formatUserName(user: Profile | any): string {
  if (!user) return 'Unknown User';
  const name = user.full_name || (user.email ? user.email.split('@')[0] : 'Unknown');
  
  if (['resigned', 'terminated', 'suspended'].includes(user.employment_status)) {
    return `${name} (Former Employee)`;
  }
  return name;
}

export function isUserArchived(user: Profile | any): boolean {
  if (!user) return true; // Treat unknown as archived for safety in assignment
  return ['resigned', 'terminated', 'suspended'].includes(user.employment_status);
}

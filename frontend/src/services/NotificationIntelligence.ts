export type NotificationPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
import { getAuthorityRank } from '../core/auth/permissions';

export interface NotificationIntelligenceResult {
  shouldSend: boolean;
  priority: NotificationPriority;
  modifiedTitle?: string;
}

export function evaluateNotification(
  category: string,
  title: string,
  body?: string,
  role?: string
): NotificationIntelligenceResult {
  const lowercaseTitle = title.toLowerCase();

  // 1. Explicit Allows (Phase 5 requirement)
  if (
    lowercaseTitle.includes('needs your approval') ||
    lowercaseTitle.includes('you are blocking someone') ||
    lowercaseTitle.includes('deadline risk') ||
    lowercaseTitle.includes('ownership transferred') ||
    lowercaseTitle.includes('blocker')
  ) {
    return { shouldSend: true, priority: 'CRITICAL', modifiedTitle: title };
  }

  // 2. Trivial filters (Never send - Reject noise)
  if (
    lowercaseTitle.includes('task updated') || 
    lowercaseTitle.includes('someone commented') || 
    lowercaseTitle.includes('comment added') ||
    lowercaseTitle.includes('status changed') ||
    lowercaseTitle.includes('project changed')
  ) {
    return { shouldSend: false, priority: 'LOW' };
  }

  // 3. Critical Rules (Immediate)
  if (category === 'risk' || lowercaseTitle.includes('risk increased') || lowercaseTitle.includes('critical')) {
    return { shouldSend: true, priority: 'CRITICAL', modifiedTitle: title };
  }

  // 4. Rate Limiting Check (Frontend Memory for Simulation)
  if (role) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const cacheKey = `notif_count_${role}_${today}`;
      const count = parseInt(localStorage.getItem(cacheKey) || '0', 10);
      
      let maxCount = 0;

      const rank = getAuthorityRank(role);
      
      if (rank >= getAuthorityRank('admin')) maxCount = 10;
      else if (rank >= getAuthorityRank('manager')) maxCount = 15;
      else if (rank >= getAuthorityRank('member')) maxCount = 5;
      else maxCount = 5;

      if (count >= maxCount) {
        // Silent block if over daily limit
        return { shouldSend: false, priority: 'LOW', modifiedTitle: title };
      }
      
      // Increment if it passed critical checks or will be sent
      localStorage.setItem(cacheKey, (count + 1).toString());
    } catch (e) {
      // Ignore local storage errors
    }
  }

  // 5. High Priority
  if (category === 'deadlines' || lowercaseTitle.includes('deadline')) {
    return { shouldSend: true, priority: 'HIGH', modifiedTitle: title };
  }
  if (category === 'system' || lowercaseTitle.includes('approval')) {
    return { shouldSend: true, priority: 'HIGH', modifiedTitle: title };
  }

  return { shouldSend: false, priority: 'LOW', modifiedTitle: title };
}

import type { SkillLevel, ResourceProfile } from '../types';

const SKILL_MULTIPLIERS: Record<SkillLevel, number> = {
  intern: 0.6,
  junior: 0.8,
  mid: 1.0,
  senior: 1.2,
  lead: 1.3
};

const DEFAULT_PROFILES: Record<SkillLevel, Omit<ResourceProfile, 'skill_level'>> = {
  intern: { experience_years: 0, focus_factor: 0.7, parallel_efficiency: 0.3, context_switch_penalty: 0.4, meeting_burden: 0.1 },
  junior: { experience_years: 1, focus_factor: 0.75, parallel_efficiency: 0.4, context_switch_penalty: 0.35, meeting_burden: 0.15 },
  mid: { experience_years: 3, focus_factor: 0.8, parallel_efficiency: 0.6, context_switch_penalty: 0.25, meeting_burden: 0.2 },
  senior: { experience_years: 6, focus_factor: 0.85, parallel_efficiency: 0.7, context_switch_penalty: 0.2, meeting_burden: 0.25 },
  lead: { experience_years: 10, focus_factor: 0.9, parallel_efficiency: 0.8, context_switch_penalty: 0.15, meeting_burden: 0.35 }
};

export function getDefaultProfile(skillLevel: SkillLevel): ResourceProfile {
  return { skill_level: skillLevel, ...DEFAULT_PROFILES[skillLevel] };
}

export function effectivenessMultiplier(profile: ResourceProfile): number {
  const base = SKILL_MULTIPLIERS[profile.skill_level] || 1.0;
  const focus = profile.focus_factor;
  const parallelPenalty = 1 - (1 - profile.parallel_efficiency) * profile.context_switch_penalty;
  const meetingDeduction = 1 - profile.meeting_burden;
  return Number((base * focus * parallelPenalty * meetingDeduction).toFixed(3));
}

export function teamOutput(
  engineerCount: number,
  profiles: ResourceProfile[]
): number {
  if (engineerCount <= 0 || profiles.length === 0) return 0;
  const totalEffectiveness = profiles.reduce((sum, p) => sum + effectivenessMultiplier(p), 0);
  const avgEffectiveness = totalEffectiveness / profiles.length;
  const coordinationPenalty = 1 + (engineerCount - 1) * 0.15;
  const rawOutput = engineerCount * avgEffectiveness;
  const effectiveOutput = rawOutput / coordinationPenalty;
  return Number(effectiveOutput.toFixed(3));
}

import { getAuthorityRank } from '../core/auth/permissions';

export function getProfileFromRole(profile?: any, experience_years?: number): ResourceProfile {
  if (!profile) return getDefaultProfile('mid');
  const { hasFunction, getAuthorityRank } = require('../core/auth/permissions');
  const roleStr = typeof profile === 'string' ? profile : (profile.authority || profile.role);
  const rank = getAuthorityRank(roleStr);
  
  let skillLevel: SkillLevel = 'mid';
  
  if (hasFunction(profile, 'Engineering')) {
      // If they are explicitly engineering, determine level based on authority but base it on being an engineer
      skillLevel = rank >= getAuthorityRank('admin') ? 'lead'
        : rank >= getAuthorityRank('manager') ? 'senior' // managers acting as engineers are senior
        : rank === getAuthorityRank('member') ? 'mid'
        : 'junior';
  } else {
      // Fallback for generic roles
      skillLevel = rank <= getAuthorityRank('viewer') ? 'intern'
        : rank >= getAuthorityRank('admin') ? 'lead'
        : rank >= getAuthorityRank('manager') ? 'senior' // editor changed to manager
        : rank === getAuthorityRank('member') ? 'junior'
        : 'mid';
  }

  const base = getDefaultProfile(skillLevel);
  return {
    ...base,
    experience_years: experience_years ?? base.experience_years
  };
}

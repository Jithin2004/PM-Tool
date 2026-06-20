import { supabase } from '../lib/supabase';

export interface WorkspaceOnboardingState {
  workspace_id: string;
  setup_completed: boolean;
  completed_steps: string[];
  selected_templates: string[];
  created_at: string;
  updated_at: string;
}

export const ONBOARDING_STEPS = {
  COMPANY_BASICS: 'company_basics',
  INVITE_TEAM: 'invite_team',
  TEMPLATES: 'templates',
} as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[keyof typeof ONBOARDING_STEPS];

class OnboardingService {
  /**
   * Load onboarding state for a workspace. Returns null if not found.
   */
  async getState(workspaceId: string): Promise<WorkspaceOnboardingState | null> {
    try {
      const { data, error } = await supabase
        .from('workspace_onboarding_state')
        .select('*')
        .eq('workspace_id', workspaceId)
        .maybeSingle();

      if (error) {
        console.warn('[onboardingService] getState error:', error.message);
        return null;
      }
      return data as WorkspaceOnboardingState | null;
    } catch (err) {
      console.error('[onboardingService] getState failed:', err);
      return null;
    }
  }

  /**
   * Mark a step as completed (idempotent).
   */
  async markStep(workspaceId: string, step: OnboardingStep): Promise<void> {
    try {
      // Load current state
      const current = await this.getState(workspaceId);
      const existing = current?.completed_steps ?? [];

      if (existing.includes(step)) return; // Already marked

      const updatedSteps = [...existing, step];
      const allDone = Object.values(ONBOARDING_STEPS).every(s => updatedSteps.includes(s));

      await supabase
        .from('workspace_onboarding_state')
        .upsert(
          {
            workspace_id: workspaceId,
            completed_steps: updatedSteps,
            setup_completed: allDone,
            selected_templates: current?.selected_templates ?? [],
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'workspace_id' }
        );
    } catch (err) {
      console.error('[onboardingService] markStep failed:', err);
    }
  }

  /**
   * Save selected operating templates.
   */
  async saveTemplates(workspaceId: string, templates: string[]): Promise<void> {
    try {
      const current = await this.getState(workspaceId);
      await supabase
        .from('workspace_onboarding_state')
        .upsert(
          {
            workspace_id: workspaceId,
            selected_templates: templates,
            completed_steps: current?.completed_steps ?? [],
            setup_completed: current?.setup_completed ?? false,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'workspace_id' }
        );
    } catch (err) {
      console.error('[onboardingService] saveTemplates failed:', err);
    }
  }

  /**
   * Mark setup as complete — called after all 3 wizard steps are done.
   */
  async completeSetup(workspaceId: string): Promise<void> {
    try {
      await supabase
        .from('workspace_onboarding_state')
        .upsert(
          {
            workspace_id: workspaceId,
            setup_completed: true,
            completed_steps: Object.values(ONBOARDING_STEPS),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'workspace_id' }
        );
    } catch (err) {
      console.error('[onboardingService] completeSetup failed:', err);
    }
  }

  /**
   * Returns true if the workspace setup wizard should be shown.
   * Shows only when setup_completed is false (or no record yet).
   */
  async shouldShowWizard(workspaceId: string): Promise<boolean> {
    const state = await this.getState(workspaceId);
    if (!state) return true; // No record → first time
    return !state.setup_completed;
  }
}

export const onboardingService = new OnboardingService();

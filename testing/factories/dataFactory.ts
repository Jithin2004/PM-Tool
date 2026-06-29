import { SandboxIntegration } from '../sandbox/sandbox';
import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// DataFactory — SDSR v1.0
// Generates valid seed payloads matching the production schema column names.
// IDs are not included — let the database generate them via DEFAULT gen_random_uuid().
// ─────────────────────────────────────────────────────────────────────────────

export interface SeedTeam {
  name: string;
  memberCount: number;
}

export interface SeedProject {
  name: string;
  status: 'planning' | 'active' | 'in-progress' | 'review' | 'done';
  milestoneCount: number;
  taskCount: number;
}

export interface SeedPayload {
  teams: SeedTeam[];
  projects: SeedProject[];
  datasetMode: 'small' | 'medium' | 'large' | 'enterprise';
}

export class DataFactory {
  static generateId(): string {
    return crypto.randomUUID();
  }

  static workspace(size: 'small' | 'medium' | 'large' | 'enterprise') {
    return {
      id: this.generateId(),
      name: `Workspace ${size.toUpperCase()}`,
      settings: { size_tier: size }
    };
  }

  static user(role: string) {
    return {
      id: this.generateId(),
      email: SandboxIntegration.getTestIdentity(role),
      full_name: `${role} User`,
      role: role
    };
  }

  static team(size: number) {
    return {
      id: this.generateId(),
      name: `Team of ${size}`,
      members: Array.from({ length: size }).map(() => this.user('Developer'))
    };
  }

  static project(milestoneCount: number) {
    return {
      id: this.generateId(),
      title: 'Enterprise Project',
      status: 'active',
      milestones: Array.from({ length: milestoneCount }).map((_, i) => ({
        title: `Milestone ${i + 1}`,
        status: 'pending'
      }))
    };
  }

  /**
   * Generates a structured seed payload with valid schema-compatible field names.
   * Used by sandbox.ts seedSandbox for direct client-side insertion.
   */
  static generateSuite(size: 'small' | 'medium' | 'large' | 'enterprise'): SeedPayload {
    const scales = {
      small:      { teams: 1,  users: 3,   projects: 1,   milestones: 2,  tasks: 10 },
      medium:     { teams: 3,  users: 15,  projects: 5,   milestones: 4,  tasks: 50 },
      large:      { teams: 10, users: 50,  projects: 20,  milestones: 10, tasks: 200 },
      enterprise: { teams: 25, users: 200, projects: 100, milestones: 25, tasks: 1000 },
    };

    const scale = scales[size];
    const teamSize = Math.max(1, Math.floor(scale.users / scale.teams));
    const tasksPerProject = Math.max(1, Math.floor(scale.tasks / scale.projects));

    const teams: SeedTeam[] = Array.from({ length: scale.teams }, (_, i) => ({
      name: `[SEED] Team ${i + 1} (${size})`,
      memberCount: teamSize,
    }));

    const statuses: SeedProject['status'][] = ['planning', 'active', 'in-progress', 'review', 'done'];
    const projects: SeedProject[] = Array.from({ length: scale.projects }, (_, i) => ({
      name: `[SEED] Project ${i + 1} (${size})`,
      status: statuses[i % statuses.length],
      milestoneCount: scale.milestones,
      taskCount: tasksPerProject,
    }));

    return { teams, projects, datasetMode: size };
  }
}

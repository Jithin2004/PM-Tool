import { User, Workspace } from '../../types';
import { Session } from '@supabase/supabase-js';

export enum AuthState {
  BOOTING = 'BOOTING',
  AUTHENTICATING = 'AUTHENTICATING',
  AUTHENTICATED = 'AUTHENTICATED',
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  ERROR = 'ERROR'
}

export enum BootstrapState {
  IDLE = 'IDLE',
  HYDRATING_PROFILE = 'HYDRATING_PROFILE',
  RESOLVING_WORKSPACE = 'RESOLVING_WORKSPACE',
  VALIDATING_LICENSE = 'VALIDATING_LICENSE',
  INITIALIZING_SERVICES = 'INITIALIZING_SERVICES',
  READY = 'READY',
  ERROR = 'ERROR'
}

export enum ProvisioningState {
  INITIALIZING = 'INITIALIZING',
  READY = 'READY',
  PROFILE_MISSING = 'PROFILE_MISSING',
  WORKSPACE_MISSING = 'WORKSPACE_MISSING',
  WORKSPACE_INACTIVE = 'WORKSPACE_INACTIVE',
  PENDING_INVITE = 'PENDING_INVITE',
  LICENSE_REQUIRED = 'LICENSE_REQUIRED'
}

export interface AppContext {
  session: Session | null;
  user: User | null;
  workspace: Workspace | null;
}

export interface LifecycleAwareService {
  initialize(context: AppContext): void;
  pause(): void;
  resume(): void;
  dispose(): void;
  getStatus?(): 'idle' | 'running' | 'paused' | 'error';
}

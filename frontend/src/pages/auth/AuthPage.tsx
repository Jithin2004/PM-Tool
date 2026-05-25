import React from 'react';
import { Activity, Zap } from 'lucide-react';
import { ResolveLayout } from '../../app/layouts/ResolveLayout';
import { useWorkspace } from '../../context/WorkspaceContext';

export function AuthPage() {
  const { signInWithGoogle, error } = useWorkspace();

  return (
    <ResolveLayout eyebrow="Signup / Login">
      <div className="mx-auto max-w-md border border-border bg-surface-3 p-8">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-5 flex h-14 w-14 items-center justify-center bg-white text-black">
            <Activity className="h-7 w-7" />
          </div>
          <h2 className="text-3xl font-semibold tracking-tight">Welcome to Resolve PM</h2>
          <p className="mt-3 text-sm text-text-tertiary">Deadlines based on how humans actually work.</p>
        </div>

        {error && (
          <div className="mb-4 border border-red-500/30 bg-signal-critical-bg p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <button
          onClick={() => signInWithGoogle()}
          className="flex h-12 w-full items-center justify-center gap-2 bg-white text-sm font-semibold text-black transition-colors hover:bg-neutral-200"
        >
          <Zap className="h-4 w-4" />
          Continue with Google
        </button>
      </div>
    </ResolveLayout>
  );
}

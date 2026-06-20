import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Plus, FolderPlus, Zap, Command, Sparkles } from 'lucide-react';
import { slideUp } from '../../lib/animation';
import { QuickActionButton } from '../widgets/QuickActionButton';

interface QuickActionsRailProps {
  onOpenPalette: () => void;
  onCreateTask?: () => void;
  onCreateProject?: () => void;
  onTriggerAutomation?: () => void;
  onAISummary?: () => void;
}

const IS_SSR = typeof window === 'undefined';

export function QuickActionsRail({
  onOpenPalette, onCreateTask, onCreateProject, onTriggerAutomation, onAISummary,
}: QuickActionsRailProps) {
  const [mounted, setMounted] = useState(!IS_SSR);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
    if (e.metaKey || e.ctrlKey) return;
    switch (e.key.toLowerCase()) {
      case 't': e.preventDefault(); onCreateTask?.(); break;
      case 'p': e.preventDefault(); onCreateProject?.(); break;
    }
  }, [onCreateTask, onCreateProject]);

  useEffect(() => {
    if (IS_SSR) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!mounted) return null;

  return (
    <motion.div
      variants={slideUp}
      initial="hidden"
      animate="visible"
      className="flex flex-wrap gap-1.5"
    >
      <QuickActionButton
        icon={Plus}
        label="New Task"
        shortcut="T"
        onClick={onCreateTask || (() => window.dispatchEvent(new CustomEvent('quick-action', { detail: { action_type: 'create-task' } })))}
      />
      <QuickActionButton
        icon={FolderPlus}
        label="New Project"
        shortcut="P"
        onClick={onCreateProject || (() => window.dispatchEvent(new CustomEvent('quick-action', { detail: { action_type: 'create-project' } })))}
      />
      <QuickActionButton
        icon={Zap}
        label="Trigger"
        onClick={onTriggerAutomation || (() => {})}
      />
      <QuickActionButton
        icon={Command}
        label="Command Palette"
        shortcut="⌘K"
        onClick={onOpenPalette}
      />
      <QuickActionButton
        icon={Sparkles}
        label="Operational Summary"
        onClick={onAISummary || (() => window.dispatchEvent(new CustomEvent('quick-action', { detail: { action_type: 'ai-summary' } })))}
      />
    </motion.div>
  );
}

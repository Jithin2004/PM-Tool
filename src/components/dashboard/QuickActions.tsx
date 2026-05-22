import { Plus, FolderPlus, Zap, Sparkles, Command } from 'lucide-react';
import { WidgetCard } from '../widgets/WidgetCard';
import { QuickActionButton } from '../widgets/QuickActionButton';

interface QuickActionsProps {
  onOpenPalette: () => void;
  onCreateTask?: () => void;
  onCreateProject?: () => void;
  onTriggerAutomation?: () => void;
  onAISummary?: () => void;
}

export function QuickActions({ onOpenPalette, onCreateTask, onCreateProject, onTriggerAutomation, onAISummary }: QuickActionsProps) {
  return (
    <WidgetCard title="Quick Actions">
      <div className="flex flex-wrap gap-2">
        <QuickActionButton icon={Plus} label="New Task" shortcut="T" onClick={onCreateTask || (() => window.dispatchEvent(new CustomEvent('quick-action', { detail: { action: 'create-task' } })))} />
        <QuickActionButton icon={FolderPlus} label="New Project" shortcut="P" onClick={onCreateProject || (() => window.dispatchEvent(new CustomEvent('quick-action', { detail: { action: 'create-project' } })))} />
        <QuickActionButton icon={Zap} label="Trigger" onClick={onTriggerAutomation || (() => {})} />
        <QuickActionButton icon={Command} label="Command Palette" shortcut="⌘K" onClick={onOpenPalette} />
        <QuickActionButton icon={Sparkles} label="AI Summary" onClick={onAISummary || (() => window.dispatchEvent(new CustomEvent('quick-action', { detail: { action: 'ai-summary' } })))} />
      </div>
    </WidgetCard>
  );
}

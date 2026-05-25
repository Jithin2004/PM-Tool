import type { LucideIcon } from 'lucide-react';

interface QuickActionButtonProps {
  icon: LucideIcon;
  label: string;
  shortcut?: string;
  onClick: () => void;
}

export function QuickActionButton({ icon: Icon, label, shortcut, onClick }: QuickActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 bg-surface border border-border hover:bg-surface-3 transition-colors text-[11px] font-medium text-text-secondary"
    >
      <Icon className="w-3.5 h-3.5 text-text-tertiary" />
      <span>{label}</span>
      {shortcut && <span className="text-[9px] text-text-quaternary ml-auto">{shortcut}</span>}
    </button>
  );
}

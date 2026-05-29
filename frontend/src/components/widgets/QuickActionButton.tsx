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
      className="flex items-center gap-3 px-4 py-2.5 bg-surface-3/30 border border-border/50 rounded-xl hover:bg-surface/50 hover:border-teal-500/30 hover:-translate-y-0.5 transition-all text-xs font-bold text-text-primary shadow-sm hover:shadow-md"
    >
      <Icon className="w-4 h-4 text-blue-400" />
      <span className="tracking-wide">{label}</span>
      {shortcut && <span className="text-[10px] font-bold text-text-tertiary ml-auto bg-surface-3 px-2 py-0.5 rounded-md border border-border/50">{shortcut}</span>}
    </button>
  );
}

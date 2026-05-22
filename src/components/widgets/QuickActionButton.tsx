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
      className="flex items-center gap-2 px-3 py-2 bg-[#0c0c0c] border border-white/10 hover:bg-white/[0.04] transition-colors text-[11px] font-mono text-white/70"
    >
      <Icon className="w-3.5 h-3.5 text-white/50" />
      <span>{label}</span>
      {shortcut && <span className="text-[9px] text-white/20 ml-auto">{shortcut}</span>}
    </button>
  );
}

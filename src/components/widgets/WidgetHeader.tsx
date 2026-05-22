interface WidgetHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function WidgetHeader({ title, subtitle, action }: WidgetHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h2 className="text-sm font-sans font-medium text-white/90">{title}</h2>
        {subtitle && <p className="text-[11px] font-mono text-white/40 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

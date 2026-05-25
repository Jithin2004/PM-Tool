import React from 'react';
import { motion } from 'framer-motion';
import { Target, BarChart3, Users, TrendingUp } from 'lucide-react';
import { Stats } from '../../types';

export function StatCard({ label, value, icon: Icon, color = "text-text-primary" }: { label: string, value: any, icon: any, color?: string }) {
  return (
    <div className="bg-bg p-4 sm:p-6 group hover:bg-surface-3 transition-colors">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-text-secondary group-hover:text-text-primary transition-colors" />
        <span className="text-[9px] sm:text-[10px] uppercase font-mono text-text-secondary tracking-wider leading-none">{label}</span>
      </div>
      <div className={`text-xl sm:text-2xl font-mono font-medium ${color}`}>{value}</div>
    </div>
  );
}

export function StatsGrid({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/10 border-b border-border">
      <StatCard label="ETA Confidence" value={`${stats.deliveryConfidence}%`} icon={Target} color="text-signal-safe" />
      <StatCard label="Active Workflows" value={stats.totalProjects} icon={BarChart3} />
      <StatCard label="Team Allocation" value={`${stats.teamBandwidth}%`} icon={Users} />
      <StatCard label="Delivery Risk" value={`${stats.dailyFatigue}h`} icon={TrendingUp} color="text-signal-warning" />
    </div>
  );
}

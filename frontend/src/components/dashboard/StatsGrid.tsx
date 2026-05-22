import React from 'react';
import { motion } from 'framer-motion';
import { Target, BarChart3, Users, TrendingUp } from 'lucide-react';
import { Stats } from '../../types';

export function StatCard({ label, value, icon: Icon, color = "text-white" }: { label: string, value: any, icon: any, color?: string }) {
  return (
    <div className="bg-[#0a0a0a] p-4 sm:p-6 group hover:bg-white/[0.02] transition-colors">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white/85 group-hover:text-white transition-colors" />
        <span className="text-[9px] sm:text-[10px] uppercase font-mono text-white/85 tracking-wider leading-none">{label}</span>
      </div>
      <div className={`text-xl sm:text-2xl font-mono font-medium ${color}`}>{value}</div>
    </div>
  );
}

export function StatsGrid({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/10 border-b border-white/10">
      <StatCard label="ETA Confidence" value={`${stats.deliveryConfidence}%`} icon={Target} color="text-green-400" />
      <StatCard label="Active Workflows" value={stats.totalProjects} icon={BarChart3} />
      <StatCard label="Team Allocation" value={`${stats.teamBandwidth}%`} icon={Users} />
      <StatCard label="Delivery Risk" value={`${stats.dailyFatigue}h`} icon={TrendingUp} color="text-yellow-500" />
    </div>
  );
}

import React from 'react';
import {
  LayoutDashboard, Briefcase, BookOpen, ListTodo, Route,
  BarChart3, BrainCircuit, Clock, Truck, Users, Building2,
  Activity, Shield, Zap, Settings, Link2, FileText,
  Key, Lock, PlusCircle, Bell, Sliders, GitBranch, GitFork
} from 'lucide-react';

import {
  Radar, TreeStructure, ArchiveBox, Kanban, Timeline,
  ChartLineUp, Compass, Broadcast, Binoculars, Files,
  Notebook, UsersThree, GitBranch as PhosphorGitBranch
} from '@phosphor-icons/react';

// Unified Icon Registry for Routing and Navigation
const ROUTE_ICON_MAP: Record<string, React.ComponentType<any>> = {
  // Lucide Defaults
  LayoutDashboard, Briefcase, BookOpen, ListTodo, Route,
  BarChart3, BrainCircuit, Clock, Truck, Users, Building2,
  Activity, Shield, Zap, Settings, Link2, FileText,
  Key, Lock, PlusCircle, Bell, Sliders, GitBranch, GitFork,

  // Resolve PM Enterprise Command Center Set (Phosphor)
  TreeStructure, ArchiveBox, Kanban, Timeline,
  ChartLineUp, Compass, Broadcast, Binoculars, Files,
  Notebook, UsersThree, PhosphorGitBranch, Radar
};

export interface RouteIconProps {
  name: string;
  className?: string;
  weight?: 'regular' | 'fill' | 'light' | 'bold' | 'duotone' | 'thin';
}

/**
 * RouteIcon
 * 
 * Separates route icon mapping and rendering from the routeRegistry structure.
 * Wraps Lucide and Phosphor SVGs with standard viewBox, stroke, and scale propagation.
 */
export function RouteIcon({ name, className = "w-[15px] h-[15px] shrink-0", weight = 'regular' }: RouteIconProps) {
  const Component = ROUTE_ICON_MAP[name];
  
  if (!Component) {
    // Graceful fallback for missing icons
    return <span className={`inline-block bg-white/10 rounded-sm ${className}`} />;
  }

  // Pass classNames to standard SVG wrapper. Phosphor uses 'weight', Lucide ignores it.
  return <Component className={className} weight={weight} />;
}

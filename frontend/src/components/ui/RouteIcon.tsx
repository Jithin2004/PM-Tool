import React from 'react';
import {
  LayoutDashboard, Briefcase, BookOpen, ListTodo, Route,
  BarChart3, BrainCircuit, Clock, Truck, Users, Building2,
  Activity, Shield, Zap, Settings, Link2, FileText,
  Key, Lock, PlusCircle, Bell, Sliders, GitBranch, GitFork,
  Radar, Landmark
} from 'lucide-react';

import {
  TreeStructure, Archive, Kanban, Calendar,
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
  Radar, Landmark,

  // Resolve PM Enterprise Command Center Set (Phosphor)
  TreeStructure, ArchiveBox: Archive, Kanban, Timeline: Calendar,
  ChartLineUp, Compass, Broadcast, Binoculars, Files,
  Notebook, UsersThree, PhosphorGitBranch
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
    return <span className={`inline-block bg-[var(--pm-surface)]/10 rounded-sm ${className}`} />;
  }

  // Pass classNames to standard SVG wrapper. Phosphor uses 'weight', Lucide ignores it.
  return <Component className={className} weight={weight} />;
}

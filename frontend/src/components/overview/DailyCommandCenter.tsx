import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { DailyOverview, getDailyOverview } from '../../services/overviewService';
import { DailyHeader } from './DailyHeader';
import { MetricsGrid } from './MetricsGrid';
import { TodayFocusList } from './TodayFocusList';
import { BlockersList } from './BlockersList';
import { RecommendationsList } from './RecommendationsList';
import { ActivityStream } from '../dashboard/ActivityStream';

export function DailyCommandCenter() {
  const { profile, user } = useAuth();
  const { workspace } = useWorkspace();
  const [overview, setOverview] = useState<DailyOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'metrics' | 'executiveInsights' | 'activity'>(() => {
    const path = window.location.pathname;
    if (path === '/overview/executive') return 'executiveInsights';
    if (path === '/overview/activity') return 'activity';
    return 'metrics';
  });

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === '/overview/executive') setActiveTab('executiveInsights');
      else if (path === '/overview/activity') setActiveTab('activity');
      else setActiveTab('metrics');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    async function load() {
      if (!user || !workspace || !profile?.role) return;
      try {
        const data = await getDailyOverview(user.id, workspace.id, profile.role, profile.full_name || profile.email || 'User');
        console.log('[DailyCommandCenter] overview loaded', data);
        setOverview(data);
      } catch (err) {
        console.error('[DailyCommandCenter] getDailyOverview failed', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user, workspace, profile]);

  if (loading || !overview) {
    console.log('[DailyCommandCenter] Early Return - loading=', loading, 'overview=', !!overview, 'workspace=', workspace?.id, 'user=', user?.id);
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const overviewViews = {
    metrics: (
      <>
        {overview.metrics.length > 0 && (
          <MetricsGrid metrics={overview.metrics} />
        )}
        <div className="mt-8 space-y-6 max-w-4xl">
          <TodayFocusList items={overview.todayFocus} />
        </div>
      </>
    ),
    executiveInsights: (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <div className="space-y-6">
          <RecommendationsList items={overview.recommendations} />
        </div>
        <div className="space-y-6">
          {overview.blockers.length > 0 && <BlockersList items={overview.blockers} />}
        </div>
      </div>
    ),
    activity: (
      <div className="mt-8 bg-[var(--pm-surface)] border border-[var(--pm-outline-variant)] rounded-xl p-4 h-full min-h-[500px]">
        {workspace?.id && <ActivityStream wsId={workspace.id} />}
      </div>
    )
  };

  return (
    <div className="space-y-8 pb-16 px-1 h-full overflow-y-auto scrollbar-premium font-sans animate-fade-in">
      <DailyHeader greeting={overview.greeting} />
      {overviewViews[activeTab]}
    </div>
  );
}

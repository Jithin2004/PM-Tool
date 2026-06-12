import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { DailyOverview, getDailyOverview } from '../../services/overviewService';
import { DailyHeader } from './DailyHeader';
import { MetricsGrid } from './MetricsGrid';
import { TodayFocusList } from './TodayFocusList';
import { BlockersList } from './BlockersList';
import { RecommendationsList } from './RecommendationsList';

export function DailyCommandCenter() {
  const { profile, user } = useAuth();
  const { workspace } = useWorkspace();
  const [overview, setOverview] = useState<DailyOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!user || !workspace || !profile?.role) return;
      const data = await getDailyOverview(user.id, workspace.id, profile.role, profile.full_name || profile.email || 'User');
      setOverview(data);
      setLoading(false);
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

  return (
    <div className="space-y-8 pb-16 px-1 h-full overflow-y-auto scrollbar-premium font-sans animate-fade-in">
      <DailyHeader greeting={overview.greeting} />
      
      {overview.metrics.length > 0 && (
        <MetricsGrid metrics={overview.metrics} />
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <TodayFocusList items={overview.todayFocus} />
        </div>
        <div className="space-y-6">
          <RecommendationsList items={overview.recommendations} />
          {overview.blockers.length > 0 && <BlockersList items={overview.blockers} />}
        </div>
      </div>
    </div>
  );
}

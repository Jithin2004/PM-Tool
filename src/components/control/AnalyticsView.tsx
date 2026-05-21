import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { CalendarIntelligencePanel } from '../admin/CalendarIntelligencePanel';

const AnalyticsView = React.memo(function AnalyticsView() {
  const { profile } = useAuth();

  if (profile?.role !== 'super_admin') {
    return <div className="flex-1 flex items-center justify-center text-white/50 font-mono text-sm uppercase">Unauthorized</div>;
  }

  return (
    <div className="max-w-[1600px] mx-auto px-3 sm:px-6 py-6 sm:py-12">
      <CalendarIntelligencePanel />
    </div>
  );
});

export default AnalyticsView;
import React from 'react';
import { WorkLogsPanel } from './WorkLogsPanel';

const WorkLogsView = React.memo(function WorkLogsView() {
  return <WorkLogsPanel />;
});

export default WorkLogsView;

import React, { useEffect, useState } from 'react';
import LegacyResolveWorkspace from '../App';
import { WorkspaceSetupPage } from '../pages/onboarding/WorkspaceSetupPage';
import { ProjectCreatePage } from '../pages/project/ProjectCreatePage';

function usePathname() {
  const [pathname, setPathname] = useState(window.location.pathname);

  useEffect(() => {
    const update = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', update);

    const originalPushState = window.history.pushState;
    window.history.pushState = function pushState(...args) {
      originalPushState.apply(window.history, args);
      update();
    };

    return () => {
      window.removeEventListener('popstate', update);
      window.history.pushState = originalPushState;
    };
  }, []);

  return pathname;
}

export function ResolveRouter() {
  const pathname = usePathname();

  if (pathname === '/onboarding/workspace') {
    return <WorkspaceSetupPage />;
  }

  if (pathname === '/projects/new') {
    return <ProjectCreatePage />;
  }

  return <LegacyResolveWorkspace />;
}

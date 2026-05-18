import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { AppProviders } from './app/providers.tsx';
import { ResolveRouter } from './app/router.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <ResolveRouter />
    </AppProviders>
  </StrictMode>,
);

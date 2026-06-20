import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AppErrorBoundary } from './components/error/AppErrorBoundary';
import './index.css';

// Initialize global operational density
const savedDensity = localStorage.getItem('app-density') || 'comfortable';
document.body.classList.add(`density-${savedDensity}`);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);

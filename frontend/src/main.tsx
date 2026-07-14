import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AppErrorBoundary } from './components/error/AppErrorBoundary';
import './design/colors.css';
import './design/typography.css';
import './design/spacing.css';
import './design/elevation.css';
import './design/motion.css';
import './design/components.css';
import './design/layouts.css';
import './index.css';

// Initialize global operational density
let savedDensity = 'comfortable';
try {
  savedDensity = localStorage.getItem('app-density') || 'comfortable';
} catch (e) {
  // Ignore quota or security errors
}
document.body.classList.add(`density-${savedDensity}`);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);

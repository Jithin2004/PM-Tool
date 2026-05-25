import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Initialize global operational density
const savedDensity = localStorage.getItem('app-density') || 'comfortable';
document.body.classList.add(`density-${savedDensity}`);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

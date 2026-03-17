import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';
import { ThemeProvider } from './theme/ThemeProvider';
import { inject } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';

if (import.meta.env.MODE === 'production') {
  inject();
  injectSpeedInsights();
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);


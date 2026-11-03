import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { apply, type Theme } from './lib/theme';
import './styles.css';

apply((document.documentElement.dataset.theme as Theme) || 'light');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

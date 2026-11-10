import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './shared/base.css';
import { applyTheme, rememberedTheme } from './shared/theme.js';

// Paint with the last-known theme immediately; the live theme is applied once content loads.
applyTheme(rememberedTheme());

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

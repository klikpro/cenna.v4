import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { sbDumpAllSettingKeys } from './lib/supabase';

// Debug helper: ketik sbDump() di DevTools console untuk lihat semua key di DB
(window as any).sbDump = sbDumpAllSettingKeys;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

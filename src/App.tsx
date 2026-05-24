/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import LandingPage, { emergencyStopAllMic } from './components/LandingPage';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import AiConfig from './components/AiConfig';
import ApiSettings from './components/ApiSettings';
import ConversationTemplate from './components/ConversationTemplate';
import AuditLog from './components/AuditLog';
import Settings from './components/Settings';
import {
  sbGetSession,
  sbSignOut,
  sbGetLogs, sbAddLog, sbClearLogs,
} from './lib/supabase';
import { AuditLogEntry } from './types';

type ActivePage =
  | 'landing'
  | 'login'
  | 'dashboard'
  | 'ai'
  | 'templates'
  | 'api'
  | 'logs'
  | 'settings';

/** Detect if the current URL path starts with /admin */
function isAdminRoute(): boolean {
  return window.location.pathname.startsWith('/admin');
}

export default function App() {
  const [page, setPage] = useState<ActivePage>('landing');
  const [adminSession, setAdminSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);

  // ─ Boot: restore session from Supabase Auth ──────────────────────────────
  useEffect(() => {
    async function boot() {
      const session = await sbGetSession();
      if (session && isAdminRoute()) {
        setAdminSession(session);
        await loadAllData();
        setPage('dashboard');
      } else if (!session && isAdminRoute()) {
        setPage('login');
      } else {
        setPage('landing');
      }
      setLoading(false);
    }
    boot();
  }, []);

  // ⚠️ Lapisan keamanan akhir: force-stop semua mic track saat keluar dari landing page
  // Menangani race condition getUserMedia yang resolve setelah React cleanup
  useEffect(() => {
    if (page !== 'landing') {
      emergencyStopAllMic();
    }
  }, [page]);

  async function loadAllData() {
    const lg = await sbGetLogs();
    setLogs(lg);
  }

  const handleLoginSuccess = async (session: any) => {
    setAdminSession(session);
    await loadAllData();
    setPage('dashboard');
  };

  const handleLogout = async () => {
    if (confirm('Yakin ingin keluar dari Admin Panel?')) {
      await sbSignOut();
      setAdminSession(null);
      setPage(isAdminRoute() ? 'login' : 'landing');
    }
  };

  const handleClearLogs = async () => {
    if (confirm('Bersihkan seluruh log audit terekam?')) {
      await sbClearLogs(adminSession?.name || 'Admin');
      setLogs(await sbGetLogs());
    }
  };

  // ─ Loading splash ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1a36] flex items-center justify-center">
        <div className="text-white/60 text-sm animate-pulse">Memuat CENNA AI…</div>
      </div>
    );
  }

  if (page === 'landing') {
    return <LandingPage onLoginClick={() => setPage('login')} />;
  }

  if (page === 'login') {
    return (
      <Login
        onLoginSuccess={handleLoginSuccess}
        onBackClick={() => setPage('landing')}
      />
    );
  }

  // ─ Admin layout ───────────────────────────────────────────────────────────
  const avatarInitials = adminSession?.name
    ? adminSession.name
        .replace(/^dr\.\s*/i, '')
        .split(' ')
        .map((w: string) => w[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : 'AD';

  const PAGE_TITLE: Record<ActivePage, string> = {
    landing:   '',
    login:     '',
    dashboard: 'Overview Dashboard',
    ai:        'Asisten AI & Prompts',
    templates: 'Conversation Template',
    api:       'API & Integrasi',
    logs:      'Keamanan Audit Log',
    settings:  'Pengaturan',
  };

  const PAGE_SUB: Record<ActivePage, string> = {
    landing:   '',
    login:     '',
    dashboard: 'Pusat Kontrol CENNA AI Voice Assistant',
    ai:        'Konfigurasi prompt, perilaku, dan reasoning engine AI',
    templates: 'Percakapan terskript tanpa AI — atur alur, jawaban, dan visual per langkah',
    api:       'Kredensial Supabase dan integrasi STT/TTS',
    logs:      'Rekam jejak aktivitas sistem',
    settings:  'Identitas platform dan preferensi',
  };

  return (
    <div className="flex min-h-screen bg-[#f8f5f0] text-[#1e2a4a] font-sans">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-60 bg-[#1e2a4a] text-white flex flex-col z-40 hidden md:flex">
        {/* Logo */}
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-[36px] h-[36px] rounded-full bg-white/15 border border-white/20 flex items-center justify-center font-bold text-sm">
              C
            </div>
            <div>
              <h2 className="font-bold text-sm tracking-wider">CENNA AI</h2>
              <span className="text-[10px] text-white/40 tracking-wider">Admin Panel</span>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1">
          <div className="text-[10px] font-bold text-white/30 tracking-widest uppercase px-3 py-2">
            Overview
          </div>
          <button
            id="btn-sidebar-dash"
            onClick={() => setPage('dashboard')}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left border-none cursor-pointer transition text-xs font-semibold ${
              page === 'dashboard' ? 'bg-white/12 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
            }`}
          >
            <span>📊</span> Dashboard
          </button>

          <div className="text-[10px] font-bold text-white/30 tracking-widest uppercase px-3 py-2 pt-4">
            AI Voice Assistant
          </div>
          <button
            id="btn-sidebar-ai"
            onClick={() => setPage('ai')}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left border-none cursor-pointer transition text-xs font-semibold ${
              page === 'ai' ? 'bg-white/12 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
            }`}
          >
            <span>🤖</span> Konfigurasi AI
          </button>
          <button
            id="btn-sidebar-templates"
            onClick={() => setPage('templates')}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left border-none cursor-pointer transition text-xs font-semibold ${
              page === 'templates' ? 'bg-white/12 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
            }`}
          >
            <span>📋</span> Conversation Template
          </button>
          <button
            id="btn-sidebar-api"
            onClick={() => setPage('api')}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left border-none cursor-pointer transition text-xs font-semibold ${
              page === 'api' ? 'bg-white/12 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
            }`}
          >
            <span>🔑</span> API & Integrasi
          </button>

          <div className="text-[10px] font-bold text-white/30 tracking-widest uppercase px-3 py-2 pt-4">
            Sistem
          </div>
          <button
            id="btn-sidebar-logs"
            onClick={() => setPage('logs')}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left border-none cursor-pointer transition text-xs font-semibold ${
              page === 'logs' ? 'bg-white/12 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
            }`}
          >
            <span>📝</span> Audit Log
            {logs.filter((l) => l.level === 'critical' || l.level === 'warning').length > 0 && (
              <span className="ml-auto bg-red-500/30 px-2 py-0.5 rounded-full text-[9px] font-extrabold text-red-200">
                {logs.filter((l) => l.level === 'critical' || l.level === 'warning').length}
              </span>
            )}
          </button>
          <button
            id="btn-sidebar-settings"
            onClick={() => setPage('settings')}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left border-none cursor-pointer transition text-xs font-semibold ${
              page === 'settings' ? 'bg-white/12 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
            }`}
          >
            <span>⚙️</span> Pengaturan
          </button>
        </nav>

        {/* Footer avatar */}
        <div className="p-4 border-t border-white/5 space-y-2 bg-[#121c33]">
          <div className="flex items-center gap-3">
            <div className="w-[34px] h-[34px] rounded-full bg-slate-100 flex items-center justify-center font-bold text-[#1e2a4a] text-xs">
              {avatarInitials}
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-xs truncate">{adminSession?.name}</h4>
              <span className="text-[10px] text-white/40 block">Super Admin</span>
            </div>
          </div>
          <button
            id="btn-sidebar-logout"
            onClick={handleLogout}
            className="w-full py-2 bg-red-400/10 hover:bg-red-400/20 text-red-400 hover:text-red-300 rounded-lg border-none text-[11px] font-bold cursor-pointer transition"
          >
            🚪 Keluar
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 md:ml-60 flex flex-col min-h-screen">
        {/* Topbar */}
        <header className="sticky top-0 z-30 bg-[#f8f5f0]/90 backdrop-blur-md border-b border-[#1e2a4a]/12 h-16 flex items-center justify-between px-6 md:px-8">
          <div>
            <h1 className="font-extrabold text-base md:text-lg text-[#1e2a4a] leading-tight">
              {PAGE_TITLE[page]}
            </h1>
            <p className="text-[11px] text-[#1e2a4a]/50 hidden sm:block">
              {PAGE_SUB[page]}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              id="btn-topbar-pill-home"
              onClick={async () => {
                await sbSignOut();
                setAdminSession(null);
                setPage('landing');
              }}
              className="px-3 py-1.5 rounded-full border border-gray-200 text-[#1e2a4a] text-xs font-semibold bg-white cursor-pointer hover:bg-slate-50 transition"
              title="Kembali ke Beranda Depan"
            >
              Beranda Depan
            </button>
            <div className="w-[34px] h-[34px] rounded-full bg-[#1e2a4a]/8 flex items-center justify-center font-bold text-xs" title={adminSession?.name}>
              {avatarInitials}
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="p-6 md:p-8 flex-1 max-w-6xl w-full mx-auto">
          {page === 'dashboard' && (
            <Dashboard
              logs={logs}
              onNavigate={(val) => setPage(val as ActivePage)}
            />
          )}
          {page === 'ai' && <AiConfig />}
          {page === 'templates' && <ConversationTemplate />}
          {page === 'api' && (
            <ApiSettings onSettingsSaved={() => {}} />
          )}
          {page === 'logs' && <AuditLog logs={logs} onClearLogs={handleClearLogs} />}
          {page === 'settings' && (
            <Settings
              onAdminProfileUpdated={(name) => {
                setAdminSession({ ...adminSession, name });
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
}

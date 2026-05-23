/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Doctors from './components/Doctors';
import Drugs from './components/Drugs';
import Icd10 from './components/Icd10';
import AiConfig from './components/AiConfig';
import ApiSettings from './components/ApiSettings';
import AuditLog from './components/AuditLog';
import Settings from './components/Settings';
import {
  getLocalDoctors,
  saveLocalDoctors,
  getLocalDrugs,
  saveLocalDrugs,
  getLocalIcd,
  saveLocalIcd,
  getLocalLogs,
  saveLocalLogs,
  addLocalLog,
} from './lib/supabase';
import { Doctor, Drug, IcdCode, AuditLogEntry } from './types';

type ActivePage =
  | 'landing'
  | 'login'
  | 'dashboard'
  | 'doctors'
  | 'drugs'
  | 'icd'
  | 'ai'
  | 'api'
  | 'logs'
  | 'settings';

export default function App() {
  const [page, setPage] = useState<ActivePage>('landing');
  const [adminSession, setAdminSession] = useState<any>(null);

  // Global synchronized states
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [icdCodes, setIcdCodes] = useState<IcdCode[]>([]);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);

  // Local storage trigger on mount
  useEffect(() => {
    setDoctors(getLocalDoctors());
    setDrugs(getLocalDrugs());
    setIcdCodes(getLocalIcd());
    setLogs(getLocalLogs());

    const session = sessionStorage.getItem('cenna_admin');
    if (session) {
      setAdminSession(JSON.parse(session));
      setPage('dashboard');
    }
  }, []);

  const handleLoginSuccess = (session: any) => {
    setAdminSession(session);
    setLogs(getLocalLogs()); // reload logs
    setPage('dashboard');
  };

  const handleLogout = () => {
    if (confirm('Yakin ingin keluar dari Admin Panel?')) {
      sessionStorage.removeItem('cenna_admin');
      setAdminSession(null);
      setPage('landing');
    }
  };

  // Doctors Mutations
  const handleSaveDoctor = (newDoc: Doctor) => {
    const list = [...doctors];
    const idx = list.findIndex((x) => x.id === newDoc.id);
    if (idx >= 0) {
      list[idx] = newDoc;
      addLocalLog('success', 'DOCTOR', `Profil dokter "${newDoc.name}" diperbarui.`);
    } else {
      list.unshift(newDoc);
      addLocalLog('success', 'DOCTOR', `Dokter baru "${newDoc.name}" ditambahkan.`);
    }
    setDoctors(list);
    saveLocalDoctors(list);
    setLogs(getLocalLogs());
  };

  const handleDeleteDoctor = (id: string) => {
    const target = doctors.find((x) => x.id === id);
    const list = doctors.filter((x) => x.id !== id);
    setDoctors(list);
    saveLocalDoctors(list);
    addLocalLog('warning', 'DOCTOR', `Dokter "${target?.name || id}" dihapus dari sistem.`);
    setLogs(getLocalLogs());
  };

  // Drugs Mutations
  const handleSaveDrug = (newDrug: Drug) => {
    const list = [...drugs];
    const idx = list.findIndex((x) => x.id === newDrug.id);
    if (idx >= 0) {
      list[idx] = newDrug;
      addLocalLog('success', 'DRUG', `Obat "${newDrug.generic}" diperbarui di formularium.`);
    } else {
      list.unshift(newDrug);
      addLocalLog('success', 'DRUG', `Obat baru "${newDrug.generic}" didaftarkan.`);
    }
    setDrugs(list);
    saveLocalDrugs(list);
    setLogs(getLocalLogs());
  };

  const handleDeleteDrug = (id: string) => {
    const target = drugs.find((x) => x.id === id);
    const list = drugs.filter((x) => x.id !== id);
    setDrugs(list);
    saveLocalDrugs(list);
    addLocalLog('warning', 'DRUG', `Obat "${target?.generic || id}" dihapus.`);
    setLogs(getLocalLogs());
  };

  // ICD Mutations
  const handleSaveIcd = (newCode: IcdCode) => {
    const list = [...icdCodes];
    const idx = list.findIndex((x) => x.id === newCode.id);
    if (idx >= 0) {
      list[idx] = newCode;
      addLocalLog('success', 'SYSTEM', `Kode ICD-10 "${newCode.code}" diperbarui.`);
    } else {
      list.unshift(newCode);
      addLocalLog('success', 'SYSTEM', `Kode custom ICD-10 "${newCode.code}" ditambahkan.`);
    }
    setIcdCodes(list);
    saveLocalIcd(list);
    setLogs(getLocalLogs());
  };

  const handleDeleteIcd = (id: string) => {
    const target = icdCodes.find((x) => x.id === id);
    const list = icdCodes.filter((x) => x.id !== id);
    setIcdCodes(list);
    saveLocalIcd(list);
    addLocalLog('warning', 'SYSTEM', `Kode ICD-10 "${target?.code || id}" dihapus.`);
    setLogs(getLocalLogs());
  };

  const handleImportIcdCodes = (newCodes: IcdCode[]) => {
    const list = [...newCodes, ...icdCodes];
    setIcdCodes(list);
    saveLocalIcd(list);
    addLocalLog('success', 'SYSTEM', `Mengimpor ${newCodes.length} kode ICD-10.`);
    setLogs(getLocalLogs());
    alert(`Sukses mengimpor ${newCodes.length} kode ICD-10!`);
  };

  const handleClearLogs = () => {
    if (confirm('Bersihkan seluruh log audit terekam?')) {
      const remaining: AuditLogEntry[] = [
        {
          id: 'sys_init',
          ts: new Date().toISOString().replace('T', ' ').substring(0, 19),
          level: 'info',
          category: 'SYSTEM',
          message: 'Log audit dipaksa bersih secara manual.',
          user: adminSession?.name || 'Admin',
          ip: '127.0.0.1',
        },
      ];
      setLogs(remaining);
      saveLocalLogs(remaining);
    }
  };

  const isDemo = !localStorage.getItem('SUPABASE_ANON_KEY');

  // Route rendering coordinators
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

  // Dashboard admin dashboard layout wrap
  const avatarInitials = adminSession?.name
    ? adminSession.name
        .replace(/^dr\.\s*/i, '')
        .split(' ')
        .map((w: string) => w[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : 'AD';

  return (
    <div className="flex min-h-screen bg-[#f8f5f0] text-[#1e2a4a] font-sans">
      {/* Absolute sidebar */}
      <aside className="fixed inset-y-0 left-0 w-60 bg-[#1e2a4a] text-white flex flex-col z-40 hidden md:flex">
        {/* Logo header */}
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

        {/* Sidebar Nav menu links */}
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
            Manajemen
          </div>
          <button
            id="btn-sidebar-doctors"
            onClick={() => setPage('doctors')}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left border-none cursor-pointer transition text-xs font-semibold ${
              page === 'doctors' ? 'bg-white/12 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
            }`}
          >
            <span>👨‍⚕️</span> Manajemen Dokter
            <span className="ml-auto bg-white/15 px-2 py-0.5 rounded-full text-[10px] text-white/80">
              {doctors.length}
            </span>
          </button>

          <div className="text-[10px] font-bold text-white/30 tracking-widest uppercase px-3 py-2 pt-4">
            AI & Konten
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
            id="btn-sidebar-icd"
            onClick={() => setPage('icd')}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left border-none cursor-pointer transition text-xs font-semibold ${
              page === 'icd' ? 'bg-white/12 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
            }`}
          >
            <span>📋</span> Database ICD-10
          </button>
          <button
            id="btn-sidebar-drugs"
            onClick={() => setPage('drugs')}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left border-none cursor-pointer transition text-xs font-semibold ${
              page === 'drugs' ? 'bg-white/12 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
            }`}
          >
            <span>💊</span> Database Obat
          </button>

          <div className="text-[10px] font-bold text-white/30 tracking-widest uppercase px-3 py-2 pt-4">
            Sistem
          </div>
          <button
            id="btn-sidebar-api"
            onClick={() => setPage('api')}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left border-none cursor-pointer transition text-xs font-semibold ${
              page === 'api' ? 'bg-white/12 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
            }`}
          >
            <span>🔑</span> API & Integrasi
          </button>
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

        {/* Sidebar avatar info footer */}
        <div className="p-4 border-t border-white/5 space-y-2 bg-[#121c33]">
          <div className="flex items-center gap-3">
            <div className="w-[34px] height-[34px] rounded-full bg-slate-100 flex items-center justify-center font-bold text-[#1e2a4a] text-xs">
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

      {/* Right Content container */}
      <main className="flex-1 md:ml-60 flex flex-col min-h-screen">
        {/* Sticky blurred topbar */}
        <header className="sticky top-0 z-30 bg-[#f8f5f0]/90 backdrop-blur-md border-b border-[#1e2a4a]/12 h-16 flex items-center justify-between px-6 md:px-8">
          <div>
            <h1 className="font-extrabold text-base md:text-lg text-[#1e2a4a] leading-tight">
              {page === 'dashboard' ? 'Overview Dashboard' :
               page === 'doctors' ? 'Manajemen Akun Dokter' :
               page === 'drugs' ? 'Medikasi & Formularium' :
               page === 'icd' ? 'Diagnosis ICD-10' :
               page === 'ai' ? 'Asisten AI & Prompts' :
               page === 'api' ? 'Saringan API & Database' :
               page === 'logs' ? 'Keamanan Audit Log' : 'Pengaturan Klinik'}
            </h1>
            <p className="text-[11px] text-[#1e2a4a]/50 hidden sm:block">
              {page === 'dashboard' ? 'Asisten Ambient Cockpit Terpadu' :
               page === 'doctors' ? 'Mengatur rujukan kredensial surat STR dokter klinik' :
               page === 'drugs' ? 'Verifikasi interaksi obat mayor fokal penunjang keselamatan terapi' :
               page === 'icd' ? 'Tabel klasifikasi diagnosis medis BPJS' :
               page === 'ai' ? 'Optimasi instructions prompt core' :
               page === 'api' ? 'Kredensial database Supabase dan integrasi Whisper STT' :
               page === 'logs' ? 'System logs' : 'Aturan visual faskes platform'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              id="btn-topbar-pill-home"
              onClick={() => {
                sessionStorage.removeItem('cenna_admin');
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

        {/* Dynamic Inner body display based on routers page state */}
        <div className="p-6 md:p-8 flex-1 max-w-6xl w-full mx-auto">
          {page === 'dashboard' && (
            <Dashboard
              doctors={doctors}
              logs={logs}
              onNavigate={(val) => setPage(val as any)}
              isDemoMode={isDemo}
            />
          )}

          {page === 'doctors' && (
            <Doctors
              doctors={doctors}
              onSaveDoctor={handleSaveDoctor}
              onDeleteDoctor={handleDeleteDoctor}
            />
          )}

          {page === 'drugs' && (
            <Drugs
              drugs={drugs}
              onSaveDrug={handleSaveDrug}
              onDeleteDrug={handleDeleteDrug}
            />
          )}

          {page === 'icd' && (
            <Icd10
              icdCodes={icdCodes}
              onSaveIcd={handleSaveIcd}
              onDeleteIcd={handleDeleteIcd}
              onImportCodes={handleImportIcdCodes}
            />
          )}

          {page === 'ai' && <AiConfig />}

          {page === 'api' && (
            <ApiSettings
              onSettingsSaved={() => {
                // reload db status/connectivity triggers
              }}
            />
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

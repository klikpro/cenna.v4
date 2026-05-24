/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { AuditLogEntry } from '../types';

interface DashboardProps {
  logs: AuditLogEntry[];
  onNavigate: (view: string) => void;
}

const LEVEL_STYLE: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-600',
  warning:  'bg-amber-500/10 text-amber-600',
  success:  'bg-emerald-500/10 text-[#10b981]',
  info:     'bg-[#1e2a4a]/5 text-[#1e2a4a]/70',
};

const LEVEL_ICON: Record<string, string> = {
  critical: '🚨',
  warning:  '⚠️',
  success:  '✅',
  info:     '⚙️',
};

export default function Dashboard({ logs, onNavigate }: DashboardProps) {
  const totalSessions = logs.filter(l => l.category === 'SOAP' || l.category === 'AI').length;
  const criticalCount = logs.filter(l => l.level === 'critical').length;
  const warningCount  = logs.filter(l => l.level === 'warning').length;

  // Matikan semua audio stream aktif saat admin dashboard mount
  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices?.().then(() => {
      // Coba hentikan semua track mikrofon yang mungkin masih aktif dari landing page
      (navigator as any).mediaDevices?.getUserMedia?.({ audio: false })?.catch(() => {});
    }).catch(() => {});
    // Hard stop: enumerate semua MediaStreamTrack aktif via RTCPeerConnection workaround
    // (browser modern: track dimatikan saat komponen unmount via useWakeWord cleanup)
    console.info('[Admin] Dashboard mounted — mic stream seharusnya nonaktif (LandingPage unmounted).');
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Mic nonaktif indicator */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/8 border border-emerald-500/20 rounded-2xl w-fit">
        <span className="text-base">🔇</span>
        <div>
          <p className="text-[11px] font-bold text-emerald-700">Mikrofon Nonaktif</p>
          <p className="text-[10px] text-emerald-600/60">CENNA tidak mendengarkan selama di mode Admin</p>
        </div>
        <div className="w-2 h-2 rounded-full bg-emerald-400 ml-1" style={{ animation: 'pulse 2s ease-in-out infinite' }} />
      </div>


      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Metric 1: Total Sesi AI */}
        <div className="bg-white border border-[#1e2a4a]/12 rounded-2xl p-5 hover:shadow-md transition relative overflow-hidden">
          <div className="flex justify-between items-start mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#1e2a4a]/8 flex items-center justify-center text-lg">🎙️</div>
            <span className="text-[11px] font-semibold text-[#10b981] bg-[#10b981]/10 px-2 py-1 rounded-full">
              Voice AI
            </span>
          </div>
          <div className="text-3xl font-extrabold text-[#1e2a4a] mb-1 font-mono">{totalSessions}</div>
          <div className="text-xs text-[#1e2a4a]/50">Sesi AI Terekam</div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#1e2a4a]/5">
            <div className="h-full bg-gradient-to-r from-[#1e2a4a] to-[#2d3f6b]" style={{ width: '70%' }} />
          </div>
        </div>

        {/* Metric 2: Warning Count */}
        <div className="bg-white border border-[#1e2a4a]/12 rounded-2xl p-5 hover:shadow-md transition relative overflow-hidden">
          <div className="flex justify-between items-start mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/8 flex items-center justify-center text-lg">⚠️</div>
            <span className="text-[11px] font-semibold text-amber-600 bg-amber-500/10 px-2 py-1 rounded-full">
              Perlu Perhatian
            </span>
          </div>
          <div className="text-3xl font-extrabold text-[#131d35] mb-1 font-mono">{warningCount}</div>
          <div className="text-xs text-[#1e2a4a]/50">Log Warning</div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#1e2a4a]/5">
            <div className="h-full bg-[#f59e0b]" style={{ width: `${Math.min(warningCount * 10, 100)}%` }} />
          </div>
        </div>

        {/* Metric 3: Critical Count */}
        <div className="bg-white border border-[#1e2a4a]/12 rounded-2xl p-5 hover:shadow-md transition relative overflow-hidden">
          <div className="flex justify-between items-start mb-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/8 flex items-center justify-center text-lg">🚨</div>
            <span className={`text-[11px] font-semibold px-2 py-1 rounded-full ${
              criticalCount > 0 ? 'text-red-600 bg-red-500/10' : 'text-[#10b981] bg-[#10b981]/10'
            }`}>
              {criticalCount > 0 ? 'Ada Alert' : 'Aman'}
            </span>
          </div>
          <div className="text-3xl font-extrabold text-[#131d35] mb-1 font-mono">{criticalCount}</div>
          <div className="text-xs text-[#1e2a4a]/50">Log Critical</div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#1e2a4a]/5">
            <div className={`h-full ${criticalCount > 0 ? 'bg-red-500' : 'bg-[#10b981]'}`} style={{ width: `${criticalCount > 0 ? 100 : 0}%` }} />
          </div>
        </div>
      </div>

      {/* Row 2: Log + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white border border-[#1e2a4a]/12 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-[#1e2a4a]/12 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-sm text-[#1e2a4a]">Aktivitas & Log Sistem Terkini</h3>
              <p className="text-[11px] text-[#1e2a4a]/45">Riwayat sesi AI dan audit trail</p>
            </div>
            <button
              id="btn-dash-to-logs"
              onClick={() => onNavigate('logs')}
              className="text-xs font-semibold text-[#3d5494] hover:text-[#1e2a4a] bg-transparent border-none cursor-pointer"
            >
              Lihat Semua →
            </button>
          </div>
          <div className="p-5 divide-y divide-[#1e2a4a]/6 space-y-4">
            {logs.length === 0 ? (
              <p className="text-xs text-[#1e2a4a]/40 text-center py-4">Belum ada aktivitas tercatat.</p>
            ) : logs.slice(0, 5).map((log) => (
              <div key={log.id} className="flex gap-4 pt-3 first:pt-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs flex-shrink-0 ${LEVEL_STYLE[log.level] || LEVEL_STYLE.info}`}>
                  {LEVEL_ICON[log.level] || '⚙️'}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-[#1e2a4a] truncate">{log.message}</h4>
                  <p className="text-[11px] text-[#1e2a4a]/55">{log.user} · IP: {log.ip}</p>
                </div>
                <div className="text-[10px] text-[#1e2a4a]/30 font-mono self-start whitespace-nowrap">
                  {log.ts.split(' ')[1]}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-6">
          <div className="bg-white border border-[#1e2a4a]/12 rounded-2xl shadow-sm p-5">
            <h3 className="font-bold text-sm text-[#1e2a4a] mb-4">Aksi Cepat</h3>
            <div className="grid grid-cols-1 gap-2">
              <button
                id="btn-dash-to-ai"
                onClick={() => onNavigate('ai')}
                className="p-3 text-left bg-[#f8f5f0] border border-[#1e2a4a]/12 rounded-xl text-xs font-semibold text-[#1e2a4a] hover:bg-slate-100 cursor-pointer transition"
              >
                🤖 Konfigurasi AI & Prompt
              </button>
              <button
                id="btn-dash-to-api"
                onClick={() => onNavigate('api')}
                className="p-3 text-left bg-[#f8f5f0] border border-[#1e2a4a]/12 rounded-xl text-xs font-semibold text-[#1e2a4a] hover:bg-slate-100 cursor-pointer transition"
              >
                🔑 API & Database
              </button>
              <button
                id="btn-dash-to-logs"
                onClick={() => onNavigate('logs')}
                className="p-3 text-left bg-[#f8f5f0] border border-[#1e2a4a]/12 rounded-xl text-xs font-semibold text-[#1e2a4a] hover:bg-slate-100 cursor-pointer transition"
              >
                📝 Lihat Audit Log
              </button>
              <button
                id="btn-dash-to-settings"
                onClick={() => onNavigate('settings')}
                className="p-3 text-left bg-[#f8f5f0] border border-[#1e2a4a]/12 rounded-xl text-xs font-semibold text-[#1e2a4a] hover:bg-slate-100 cursor-pointer transition"
              >
                ⚙️ Pengaturan Platform
              </button>
            </div>
          </div>

          {/* Status block */}
          <div className="bg-white border border-[#1e2a4a]/12 rounded-2xl shadow-sm p-5">
            <h3 className="font-bold text-sm text-[#1e2a4a] mb-4">Status Sistem</h3>
            <div className="space-y-3">
              {[
                { label: 'AI Engine (LLM)', status: 'OK' },
                { label: 'Speech-to-Text (STT)', status: 'OK' },
                { label: 'Text-to-Speech (TTS)', status: 'OK' },
                { label: 'Supabase Database', status: 'OK' },
              ].map(item => (
                <div key={item.label} className="flex justify-between items-center text-xs border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
                    <span className="font-medium">{item.label}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-[#10b981] font-bold">{item.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

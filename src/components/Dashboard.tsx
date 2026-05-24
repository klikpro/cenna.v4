/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Doctor, AuditLogEntry } from '../types';

interface DashboardProps {
  doctors: Doctor[];
  logs: AuditLogEntry[];
  onNavigate: (view: string) => void;
  isDemoMode: boolean;
}

export default function Dashboard({ doctors, logs, onNavigate, isDemoMode }: DashboardProps) {
  const activeDocs = doctors.filter((d) => d.status === 'active').length;
  const trialDocs = doctors.filter((d) => d.status === 'trial').length;
  const totalSoap = doctors.reduce((acc, d) => acc + (d.soap_month || 0), 0);

  // BUG-18 FIX: Hitung dokter baru berdasarkan 30 hari terakhir secara dinamis
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const newDoctorsCount = doctors.filter(
    (d) => d.created_at && d.created_at >= thirtyDaysAgo
  ).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Dynamic Demo Alert Banner if using local fallback */}
      {isDemoMode && (
        <div id="demo-mode-alert-banner" className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/20 text-slate-800 rounded-2xl justify-between shadow-sm">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-base">⚠️</span>
            <span>
              <strong>Mode Demo Aktif.</strong> Hubungkan real database Supabase di{' '}
              <button
                id="btn-alert-link-api"
                onClick={() => onNavigate('api')}
                className="font-bold underline text-[#1e2a4a] bg-transparent border-none cursor-pointer"
              >
                Pengaturan API
              </button>{' '}
              untuk menyimpan data secara persisten.
            </span>
          </div>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Metric 1 */}
        <div className="bg-white border border-[#1e2a4a]/12 rounded-2xl p-5 hover:shadow-md transition relative overflow-hidden">
          <div className="flex justify-between items-start mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#1e2a4a]/8 flex items-center justify-center text-lg">👨‍⚕️</div>
            <span className="text-[11px] font-semibold text-[#10b981] bg-[#10b981]/10 px-2 py-1 rounded-full">
              {newDoctorsCount > 0 ? `↑ ${newDoctorsCount} baru (30hr)` : 'Tidak ada baru'}
            </span>
          </div>
          <div className="text-3xl font-extrabold text-[#1e2a4a] mb-1 font-mono">{activeDocs}</div>
          <div className="text-xs text-[#1e2a4a]/50">Dokter Aktif</div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#1e2a4a]/5">
            <div className="h-full bg-gradient-to-r from-[#1e2a4a] to-[#2d3f6b]" style={{ width: '60%' }} />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white border border-[#1e2a4a]/12 rounded-2xl p-5 hover:shadow-md transition relative overflow-hidden">
          <div className="flex justify-between items-start mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#b8a898]/15 flex items-center justify-center text-lg">📋</div>
            <span className="text-[11px] font-semibold text-amber-600 bg-amber-500/10 px-2 py-1 rounded-full" title="Estimasi berdasarkan data historis">
              Estimasi
            </span>
          </div>
          <div className="text-3xl font-extrabold text-[#131d35] mb-1 font-mono">{totalSoap.toLocaleString('id-ID')}</div>
          <div className="text-xs text-[#1e2a4a]/50">SOAP Tergenerate</div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#1e2a4a]/5">
            <div className="h-full bg-[#b8a898]" style={{ width: '80%' }} />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white border border-[#1e2a4a]/12 rounded-2xl p-5 hover:shadow-md transition relative overflow-hidden">
          <div className="flex justify-between items-start mb-3">
            <div className="w-10 h-10 rounded-xl bg-[#10b981]/8 flex items-center justify-center text-lg">🤖</div>
            <span className="text-[11px] font-semibold text-[#10b981] bg-[#10b981]/10 px-2 py-1 rounded-full">
              Lancar
            </span>
          </div>
          <div className="text-3xl font-extrabold text-[#131d35] mb-1 font-mono">98.4%</div>
          <div className="text-xs text-[#1e2a4a]/50">Rerata Ketepatan AI <span className="text-[9px] text-amber-500 font-bold">[Estimasi]</span></div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#1e2a4a]/5">
            <div className="h-full bg-[#10b981]" style={{ width: '98%' }} />
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white border border-[#1e2a4a]/12 rounded-2xl p-5 hover:shadow-md transition relative overflow-hidden">
          <div className="flex justify-between items-start mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/8 flex items-center justify-center text-lg">⚡</div>
            <span className="text-[11px] font-semibold text-[#10b981] bg-[#10b981]/10 px-2 py-1 rounded-full">
              Sangat Cepat
            </span>
          </div>
          <div className="text-3xl font-extrabold text-[#131d35] mb-1 font-mono">247ms</div>
          <div className="text-xs text-[#1e2a4a]/50">Response Time <span className="text-[9px] text-amber-500 font-bold">[Estimasi]</span></div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500/5">
            <div className="h-full bg-[#f59e0b]" style={{ width: '30%' }} />
          </div>
        </div>
      </div>

      {/* Row 2: Recent Activity & Status Block */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1 & 2: Recent Activity */}
        <div className="lg:col-span-2 bg-white border border-[#1e2a4a]/12 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-[#1e2a4a]/12 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-sm text-[#1e2a4a]">Aktivitas & Log Sistem Terkini</h3>
              <p className="text-[11px] text-[#1e2a4a]/45">Riwayat streaming klinis dan sensor audit</p>
            </div>
            <button
              id="btn-dash-to-logs"
              onClick={() => onNavigate('logs')}
              className="text-xs font-semibold text-[#3d5494] hover:text-[#1e2a4a] bg-transparent border-none cursor-pointer"
            >
              Lihat Audit Log →
            </button>
          </div>
          <div className="p-5 divide-y divide-[#1e2a4a]/6 space-y-4">
            {logs.slice(0, 4).map((log, idx) => (
              <div key={log.id} className="flex gap-4 pt-3 first:pt-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs flex-shrink-0 ${
                  log.level === 'critical' ? 'bg-red-500/10 text-red-600' :
                  log.level === 'warning' ? 'bg-amber-500/10 text-amber-600' :
                  log.level === 'success' ? 'bg-emerald-500/10 text-[#10b981]' : 'bg-[#1e2a4a]/5 text-[#1e2a4a]/70'
                }`}>
                  {log.category === 'DRUG' ? '💊' : log.category === 'SOAP' ? '📋' : log.category === 'AUTH' ? '🔑' : '⚙️'}
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

        {/* Column 3: System Status & Quick Links */}
        <div className="space-y-6">
          {/* Status block */}
          <div className="bg-white border border-[#1e2a4a]/12 rounded-2xl shadow-sm p-5">
            <h3 className="font-bold text-sm text-[#1e2a4a] mb-4">Status Integrasi & AI</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs border-b border-gray-100 pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
                  <span className="font-medium">AI Engine (Claude 4.6)</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-[#10b981] font-bold">OK</span>
              </div>
              <div className="flex justify-between items-center text-xs border-b border-gray-100 pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
                  <span className="font-medium">Whisper Speech API</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-[#10b981] font-bold">OK</span>
              </div>
              <div className="flex justify-between items-center text-xs border-b border-gray-100 pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
                  <span className="font-medium">Supabase Database</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-[#10b981] font-bold">OK</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="font-medium">Medifirst RME Sync</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/10 text-amber-600 font-bold">LATENCY</span>
              </div>
            </div>
          </div>

          {/* Quick Actions Shortcuts */}
          <div className="bg-white border border-[#1e2a4a]/12 rounded-2xl shadow-sm p-5">
            <h3 className="font-bold text-sm text-[#1e2a4a] mb-4">Aksi Pintar</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                id="btn-dash-to-doctors"
                onClick={() => onNavigate('doctors')}
                className="p-3 text-left bg-[#f8f5f0] border border-[#1e2a4a]/12 rounded-xl text-xs font-semibold text-[#1e2a4a] hover:bg-slate-100 cursor-pointer"
              >
                👨‍⚕️ Tambah Dokter
              </button>
              <button
                id="btn-dash-to-ai"
                onClick={() => onNavigate('ai')}
                className="p-3 text-left bg-[#f8f5f0] border border-[#1e2a4a]/12 rounded-xl text-xs font-semibold text-[#1e2a4a] hover:bg-slate-100 cursor-pointer"
              >
                🤖 AI Config
              </button>
              <button
                id="btn-dash-to-drugs"
                onClick={() => onNavigate('drugs')}
                className="p-3 text-left bg-[#f8f5f0] border border-[#1e2a4a]/12 rounded-xl text-xs font-semibold text-[#1e2a4a] hover:bg-slate-100 cursor-pointer"
              >
                💊 Cek Formularium
              </button>
              <button
                id="btn-dash-to-api"
                onClick={() => onNavigate('api')}
                className="p-3 text-left bg-[#f8f5f0] border border-[#1e2a4a]/12 rounded-xl text-xs font-semibold text-[#1e2a4a] hover:bg-slate-100 cursor-pointer"
              >
                🔑 Database API
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Mini Doctors Table */}
      <div className="bg-white border border-[#1e2a4a]/12 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-[#1e2a4a]/12 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-sm text-[#1e2a4a]">Daftar Dokter dan Performansi</h3>
            <p className="text-[11px] text-[#1e2a4a]/45">Rangkuman produktivitas dan status dokter aktif</p>
          </div>
          <button
            id="btn-dash-doctor-view"
            onClick={() => onNavigate('doctors')}
            className="text-xs font-semibold text-[#3d5494] hover:text-[#1e2a4a] bg-transparent border-none cursor-pointer"
          >
            Selengkapnya →
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-[#1e2a4a]/12 text-[#1e2a4a]/45 font-semibold">
                <th className="p-4 uppercase tracking-wider font-bold">Nama Dokter</th>
                <th className="p-4 uppercase tracking-wider font-bold">Spesialisasi</th>
                <th className="p-4 uppercase tracking-wider font-bold">Status Hubungan</th>
                <th className="p-4 uppercase tracking-wider font-bold">SOAP Terbuat / Bln</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {doctors.slice(0, 4).map((d) => (
                <tr key={d.id} className="hover:bg-slate-50/50">
                  <td className="p-4 font-bold text-[#1e2a4a]">{d.name}</td>
                  <td className="p-4 text-[#1e2a4a]/70">{d.specialization}</td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                      d.status === 'active' ? 'bg-emerald-500/10 text-[#10b981]' :
                      d.status === 'trial' ? 'bg-amber-500/10 text-amber-600' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {d.status === 'active' ? '● Aktif' : d.status === 'trial' ? '⏳ Trial' : 'Non-aktif'}
                    </span>
                  </td>
                  <td className="p-4 font-mono font-bold text-center">{d.soap_month}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

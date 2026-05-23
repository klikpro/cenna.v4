/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuditLogEntry } from '../types';

interface AuditLogProps {
  logs: AuditLogEntry[];
  onClearLogs: () => void;
}

export default function AuditLog({ logs, onClearLogs }: AuditLogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Row expander tracking
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const filteredLogs = logs.filter((l) => {
    const matchesSearch =
      l.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.user.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLevel = !levelFilter || l.level === levelFilter;
    const matchesCategory = !categoryFilter || l.category === categoryFilter;
    return matchesSearch && matchesLevel && matchesCategory;
  });

  const handleExportCSV = () => {
    const headers = ['Waktu', 'Level', 'Kategori', 'Pesan', 'User', 'IP Address', 'Detail JSON'];
    const rows = filteredLogs.map((l) => [
      l.ts,
      l.level.toUpperCase(),
      l.category,
      l.message,
      l.user,
      l.ip,
      l.detail || '',
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.map((x) => `"${x.replace(/"/g, '""')}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `CENNA_Audit_Log_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRowClick = (id: string) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Mini top status cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-white border border-[#1e2a4a]/12 p-4 rounded-xl text-center shadow-sm">
          <div className="text-xl font-bold font-mono text-slate-800">{logs.length}</div>
          <div className="text-[10px] text-slate-500">Total Telemetri</div>
        </div>
        <div className="bg-white border border-[#1e2a4a]/12 p-4 rounded-xl text-center shadow-sm">
          <div className="text-xl font-bold font-mono text-blue-600">{logs.filter((x) => x.level === 'info').length}</div>
          <div className="text-[10px] text-slate-500">Info</div>
        </div>
        <div className="bg-white border border-[#1e2a4a]/12 p-4 rounded-xl text-center shadow-sm">
          <div className="text-xl font-bold font-mono text-emerald-600">{logs.filter((x) => x.level === 'success').length}</div>
          <div className="text-[10px] text-slate-500">Success</div>
        </div>
        <div className="bg-white border border-[#1e2a4a]/12 p-4 rounded-xl text-center shadow-sm">
          <div className="text-xl font-bold font-mono text-amber-500">{logs.filter((x) => x.level === 'warning').length}</div>
          <div className="text-[10px] text-slate-500">Warning</div>
        </div>
        <div className="bg-white border border-[#1e2a4a]/12 p-4 rounded-xl text-center shadow-sm">
          <div className="text-xl font-bold font-mono text-red-600">{logs.filter((x) => x.level === 'error' || x.level === 'critical').length}</div>
          <div className="text-[10px] text-slate-500">Kritis (Alarms)</div>
        </div>
      </div>

      {/* Toolbar filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 bg-white border border-[#1e2a4a]/12 rounded-xl px-4 py-2 flex items-center gap-2">
          <span className="text-slate-400">🔍</span>
          <input
            id="audit-search-input"
            type="text"
            placeholder="Cari logs berdasarkan user, pesan, atau kategori..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs outline-none text-slate-800 placeholder-slate-400 font-sans"
          />
        </div>

        <select
          id="audit-filter-level"
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          className="bg-white border border-[#1e2a4a]/12 rounded-xl text-xs px-4 py-3 outline-none text-slate-700 cursor-pointer"
        >
          <option value="">Semua Tingkatan</option>
          <option value="info">Info</option>
          <option value="success">Success</option>
          <option value="warning">Warning</option>
          <option value="error">Error</option>
          <option value="critical">Critical</option>
        </select>

        <select
          id="audit-filter-category"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-white border border-[#1e2a4a]/12 rounded-xl text-xs px-4 py-3 outline-none text-slate-700 cursor-pointer"
        >
          <option value="">Semua Kategori</option>
          <option value="AUTH">Auth System</option>
          <option value="DRUG">Medication Safety</option>
          <option value="SOAP">SOAP Notes</option>
          <option value="AI">AI Decision</option>
          <option value="DOCTOR">Doctor Profile</option>
          <option value="SYSTEM">System Log</option>
        </select>

        <button
          id="btn-export-audit"
          onClick={handleExportCSV}
          className="px-5 py-3 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-600 cursor-pointer transition flex items-center gap-2"
        >
          <span>📥</span> Export CSV
        </button>

        <button
          id="btn-clear-audit-logs"
          onClick={onClearLogs}
          className="px-5 py-3 bg-red-500/10 hover:bg-red-500/15 text-red-600 text-xs font-bold rounded-xl border-none cursor-pointer"
        >
          🗑 Reset Log
        </button>
      </div>

      {/* Main Audit log table */}
      <div className="bg-white border border-[#1e2a4a]/12 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-[#1e2a4a]/12 flex justify-between items-center bg-slate-50/50">
          <div>
            <h3 className="font-bold text-sm text-[#1e2a4a]">System Audit Logs</h3>
            <p className="text-[11px] text-[#1e2a4a]/45">Log riwayat keamanan fokal, HIPAA compliance track, dan diagnosa asisten</p>
          </div>
          <span className="text-xs font-semibold text-[#1e2a4a]/50 font-mono">
            {filteredLogs.length} Entri log
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-[#1e2a4a]/12 text-[#1e2a4a]/45 font-bold uppercase">
                <th className="p-4 w-10"></th>
                <th className="p-4">Waktu</th>
                <th className="p-4">Level</th>
                <th className="p-4">Kategori</th>
                <th className="p-4">Deskripsi Event</th>
                <th className="p-4 font-bold">Inisator (User)</th>
                <th className="p-4">Alamat IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredLogs.map((log) => (
                <React.Fragment key={log.id}>
                  <tr
                    onClick={() => handleRowClick(log.id)}
                    className="hover:bg-slate-50/70 cursor-pointer transition"
                  >
                    <td className="p-4 font-bold text-center text-slate-400">
                      {expandedLogId === log.id ? '▼' : '▶'}
                    </td>
                    <td className="p-4 font-mono text-[11px] text-slate-500">{log.ts}</td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                        log.level === 'critical' ? 'bg-red-500/15 text-red-600' :
                        log.level === 'error' ? 'bg-red-500/10 text-red-600' :
                        log.level === 'warning' ? 'bg-amber-500/10 text-amber-600' :
                        log.level === 'success' ? 'bg-emerald-500/10 text-[#10b981]' : 'bg-blue-500/10 text-blue-600'
                      }`}>
                        {log.level}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px] font-bold uppercase">
                        {log.category}
                      </span>
                    </td>
                    <td className="p-4 font-medium text-slate-800" style={{ maxWidth: '300px' }}>
                      <div className="truncate" title={log.message}>{log.message}</div>
                    </td>
                    <td className="p-4 text-slate-500">{log.user}</td>
                    <td className="p-4 text-slate-400 font-mono text-[11px]">{log.ip}</td>
                  </tr>

                  {/* Expandable JSON details drawer */}
                  {expandedLogId === log.id && (
                    <tr className="bg-slate-50/70 text-[11px]">
                      <td colSpan={7} className="p-4 border-l-4 border-[#1e2a4a]">
                        <div className="space-y-2">
                          <p className="font-bold text-slate-700">Metadata Event Payload (Raw JSON):</p>
                          <pre className="p-3 bg-[#0d1a36] text-[#94a8d8] rounded-lg font-mono overflow-auto max-h-48 text-[10px]">
                            {log.detail
                              ? JSON.stringify(JSON.parse(log.detail), null, 2)
                              : '{\n  "status": "Tidak ada detail parameter tambahan terlampir."\n}'}
                          </pre>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

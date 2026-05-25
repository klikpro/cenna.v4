/**
 * @license SPDX-License-Identifier: Apache-2.0
 *
 * session-popup.tsx — ConclusionPopup & DataPopup
 * Dipecah dari LandingPage.tsx
 */

import React from 'react';
import type { AnamnesisData, ClinicalConclusion } from '../../types';
import type { CapturedData } from './ai-engine';

// ─── ConclusionPopup ──────────────────────────────────────────────────────────
interface ConclusionPopupProps {
  conclusion: ClinicalConclusion;
  anamnesis:  AnamnesisData;
  redFlags:   string[];
  onClose:    () => void;
  onSOAP:     () => void;
}

export function ConclusionPopup({ conclusion, anamnesis, redFlags, onClose, onSOAP }: ConclusionPopupProps) {
  const [tab, setTab] = React.useState<'diagnosa' | 'anamnesis' | 'tatalaksana' | 'edukasi'>('diagnosa');
  const katColor: Record<string, string> = {
    farmakologi: '#1e2a4a', 'non-farmakologi': '#10b981',
    rujukan: '#e74c3c', 'pemeriksaan penunjang': '#7F77DD',
  };
  const TABS = [
    { key: 'diagnosa',    label: '📋 DDx' },
    { key: 'anamnesis',   label: '🩺 Anamnesis' },
    { key: 'tatalaksana', label: '💊 Tatalaksana' },
    { key: 'edukasi',     label: '📖 Edukasi' },
  ] as const;
  const pqrsRows = [
    { key: 'P — Provokasi', val: anamnesis.provokasi },
    { key: 'Q — Kualitas',  val: anamnesis.kualitas  },
    { key: 'R — Radiasi',   val: anamnesis.radiasi   },
    { key: 'S — Skala',     val: anamnesis.skala     },
    { key: 'T — Waktu',     val: anamnesis.waktu     },
    { key: 'RPD',           val: anamnesis.rpd       },
    { key: 'RPK',           val: anamnesis.rpk       },
    { key: 'RPS',           val: anamnesis.rps       },
    { key: 'Pemfis',        val: anamnesis.pemfis    },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,15,30,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '1rem', backdropFilter: 'blur(6px)' }}>
      <div style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 40px 80px -16px rgba(30,42,74,0.4)', animation: 'popupIn 0.35s cubic-bezier(0.16,1,0.3,1) forwards' }}>
        {/* Header */}
        <div style={{ background: '#1e2a4a', padding: '16px 20px', borderRadius: '20px 20px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#f5f0e8', fontFamily: "'DM Sans',sans-serif" }}>🩺 Kesimpulan Klinis CENNA</p>
            <p style={{ margin: 0, fontSize: 10, color: 'rgba(245,240,232,0.5)', fontFamily: "'DM Mono',monospace", letterSpacing: '0.1em' }}>Analisis berbasis pola pikir dokter spesialis · PQRST</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(245,240,232,0.5)', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>
        {/* Red flags */}
        {redFlags.length > 0 && (
          <div style={{ background: '#fee2e2', borderBottom: '1px solid #fca5a5', padding: '10px 20px', display: 'flex', gap: 8 }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>🚨</span>
            <div>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#dc2626' }}>RED FLAG — Perlu perhatian segera</p>
              {redFlags.map((rf, i) => <p key={i} style={{ margin: '2px 0 0', fontSize: 11, color: '#7f1d1d' }}>• {rf}</p>)}
            </div>
          </div>
        )}
        {/* Diagnosis utama */}
        <div style={{ padding: '16px 20px 0' }}>
          <div style={{ background: '#f0f4ff', borderRadius: 12, padding: '12px 16px', borderLeft: '4px solid #1e2a4a' }}>
            <p style={{ margin: 0, fontSize: 9, color: '#7F77DD', fontFamily: "'DM Mono',monospace", letterSpacing: '0.12em', textTransform: 'uppercase' }}>Diagnosis Utama</p>
            <p style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 700, color: '#1e2a4a', fontFamily: "'DM Sans',sans-serif" }}>{conclusion.diagnosis_utama || 'Belum dapat ditentukan'}</p>
            {conclusion.icd10_code && <span style={{ fontSize: 10, background: '#1e2a4a', color: '#f5f0e8', padding: '2px 8px', borderRadius: 4, display: 'inline-block', marginTop: 4, fontFamily: "'DM Mono',monospace" }}>ICD-10: {conclusion.icd10_code}</span>}
            {conclusion.prognosis  && <p style={{ margin: '6px 0 0', fontSize: 11, color: '#64748b', fontStyle: 'italic', lineHeight: 1.5 }}>{conclusion.prognosis}</p>}
          </div>
        </div>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2, padding: '12px 20px 0', borderBottom: '1px solid #e5e7eb' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ padding: '6px 12px', fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', borderRadius: '8px 8px 0 0', background: tab === t.key ? '#1e2a4a' : 'transparent', color: tab === t.key ? '#f5f0e8' : '#94a3b8', fontFamily: "'DM Sans',sans-serif", transition: 'all 0.15s' }}>
              {t.label}
            </button>
          ))}
        </div>
        {/* Tab content */}
        <div style={{ padding: '16px 20px' }}>
          {tab === 'diagnosa' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {conclusion.diagnosis_banding.length === 0 && <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '16px 0' }}>Tidak ada diagnosis banding tercatat.</p>}
              {conclusion.diagnosis_banding.map((ddx, i) => (
                <div key={i} style={{ background: i === 0 ? '#f0f9ff' : '#f8fafc', borderRadius: 10, padding: '10px 14px', border: `1px solid ${i === 0 ? '#bae6fd' : '#e2e8f0'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1e2a4a', fontFamily: "'DM Sans',sans-serif", flex: 1 }}>{i + 1}. {ddx.diagnosis}</span>
                    <span style={{ fontSize: 11, background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: 4, fontFamily: "'DM Mono',monospace", fontWeight: 700, whiteSpace: 'nowrap' }}>{ddx.probabilitas}</span>
                  </div>
                  {ddx.icd10  && <span style={{ fontSize: 9, background: '#f1f5f9', color: '#64748b', padding: '1px 5px', borderRadius: 3, fontFamily: "'DM Mono',monospace", marginTop: 4, display: 'inline-block' }}>ICD-10: {ddx.icd10}</span>}
                  {ddx.alasan && <p style={{ margin: '6px 0 0', fontSize: 11, color: '#475569', lineHeight: 1.55 }}>{ddx.alasan}</p>}
                </div>
              ))}
            </div>
          )}
          {tab === 'anamnesis' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {pqrsRows.map(row => (
                <div key={row.key} style={{ background: row.val ? '#f0fdf4' : '#fafafa', borderRadius: 8, padding: '8px 10px', border: `1px solid ${row.val ? '#bbf7d0' : '#e5e7eb'}` }}>
                  <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: "'DM Mono',monospace" }}>{row.key}</p>
                  <p style={{ margin: '3px 0 0', fontSize: 11, color: row.val ? '#15803d' : '#94a3b8', lineHeight: 1.5, fontFamily: "'DM Sans',sans-serif" }}>{row.val || 'Belum tergali'}</p>
                </div>
              ))}
            </div>
          )}
          {tab === 'tatalaksana' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {conclusion.tatalaksana.length === 0 && <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '16px 0' }}>Tidak ada tatalaksana tercatat.</p>}
              {conclusion.tatalaksana.map((t, i) => (
                <div key={i} style={{ background: '#fafafa', borderRadius: 10, padding: '10px 14px', border: '1px solid #e2e8f0', borderLeft: `4px solid ${katColor[t.kategori] || '#b8a898'}` }}>
                  <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: katColor[t.kategori] || '#64748b', fontFamily: "'DM Mono',monospace" }}>{t.kategori}</span>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#1e293b', lineHeight: 1.65, fontFamily: "'DM Sans',sans-serif" }}>{t.detail}</p>
                </div>
              ))}
            </div>
          )}
          {tab === 'edukasi' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {conclusion.edukasi.length === 0 && <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '16px 0' }}>Tidak ada poin edukasi tercatat.</p>}
              {conclusion.edukasi.map((e, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 14px', background: '#fffbeb', borderRadius: 10, border: '1px solid #fde68a' }}>
                  <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1.4 }}>💡</span>
                  <p style={{ margin: 0, fontSize: 12, color: '#78350f', lineHeight: 1.65, fontFamily: "'DM Sans',sans-serif" }}>{e}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Footer */}
        <div style={{ padding: '12px 20px 18px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: 8 }}>
          <button onClick={onSOAP} style={{ flex: 1, padding: '10px 0', fontSize: 12, fontWeight: 600, background: '#1e2a4a', color: '#f5f0e8', border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
            📝 Lanjut Buat SOAP
          </button>
          <button onClick={onClose} style={{ padding: '10px 18px', fontSize: 12, background: 'none', color: '#94a3b8', border: '1px solid #e5e7eb', borderRadius: 10, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── DataPopup (fallback saat AI non-aktif) ────────────────────────────────────
interface DataPopupProps {
  data:        CapturedData;
  onClose:     () => void;
  onSOAP:      () => void;
  canContinue?: boolean;
  onContinue?:  () => void;
}

export function DataPopup({ data, onClose, onSOAP, canContinue, onContinue }: DataPopupProps) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(30,42,74,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
      <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 460, boxShadow: '0 32px 72px -12px rgba(30,42,74,0.28)', overflow: 'hidden', animation: 'popupIn 0.35s cubic-bezier(0.16,1,0.3,1) forwards' }}>
        <div style={{ background: '#1e2a4a', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(245,240,232,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <rect x="1" y="1" width="13" height="13" rx="2" stroke="#f5f0e8" strokeWidth="1.2" />
                <path d="M4 5h7M4 8h5M4 11h3" stroke="#f5f0e8" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 500, color: '#f5f0e8', margin: 0, fontFamily: "'DM Sans', sans-serif" }}>Data percakapan terdeteksi</p>
              <p style={{ fontSize: 10, color: 'rgba(245,240,232,0.5)', margin: 0, fontFamily: "'DM Mono', monospace", letterSpacing: '0.1em' }}>{data.waktu}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(245,240,232,0.5)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}>✕</button>
        </div>
        <div style={{ padding: '16px 18px' }}>
          {data.transcript && (
            <div style={{ marginBottom: 14, padding: '8px 12px', background: '#f9f8f6', borderRadius: 8, borderLeft: '2px solid #b8a898' }}>
              <p style={{ fontSize: 10, color: '#b8a898', margin: '0 0 4px', fontFamily: "'DM Mono', monospace", letterSpacing: '0.08em', textTransform: 'uppercase' }}>Transkrip</p>
              <p style={{ fontSize: 12, color: '#3a4660', margin: 0, lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif" }}>
                {data.transcript.length > 180 ? data.transcript.slice(0, 180) + '…' : data.transcript}
              </p>
            </div>
          )}
          {([
            { label: 'Keluhan',           items: data.keluhan,    color: '#e74c3c', bg: '#fef2f2' },
            { label: 'Obat / terapi',     items: data.obat,       color: '#1e2a4a', bg: '#f0f4ff' },
            { label: 'Pertanyaan dokter', items: data.pertanyaan, color: '#7F77DD', bg: '#eeedfe' },
          ] as const).map(({ label, items, color, bg }) => items.length > 0 && (
            <div key={label} style={{ marginBottom: 10 }}>
              <p style={{ fontSize: 10, color: '#b8a898', margin: '0 0 5px', fontFamily: "'DM Mono', monospace", letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {items.slice(0, 3).map((item, i) => (
                  <span key={i} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: bg, color, fontFamily: "'DM Sans', sans-serif" }}>
                    {item.length > 60 ? item.slice(0, 60) + '…' : item}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {!data.keluhan.length && !data.obat.length && !data.pertanyaan.length && (
            <p style={{ fontSize: 12, color: '#b8a898', textAlign: 'center', margin: '8px 0', fontFamily: "'DM Sans', sans-serif" }}>
              Percakapan dicatat — tidak ada entitas spesifik terdeteksi.
            </p>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button onClick={onSOAP} style={{ flex: 1, padding: '9px 0', fontSize: 12, fontWeight: 500, background: '#1e2a4a', color: '#f5f0e8', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
              Buat SOAP
            </button>
            {canContinue && onContinue && (
              <button onClick={onContinue} style={{ padding: '9px 14px', fontSize: 12, fontWeight: 500, background: '#7F77DD', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                ↩ Lanjut
              </button>
            )}
            <button onClick={onClose} style={{ padding: '9px 14px', fontSize: 12, background: 'none', color: '#b8a898', border: '1px solid #e5e2dc', borderRadius: 8, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

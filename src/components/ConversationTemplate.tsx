/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ConversationTemplate.tsx — Admin editor untuk scripted conversation templates.
 * Template terskript menggantikan AI ketika aktif: CENNA membaca step-by-step
 * tanpa memanggil LLM, dengan warna orb/background yang dapat dikustomisasi per step.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { sbGetTemplates, sbSaveTemplates } from '../lib/supabase';
import type { ConversationTemplate, ConversationStep } from '../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function newId(): string {
  return 'step_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
}

function newStep(order: number): ConversationStep {
  return {
    id: newId(),
    order,
    label: `Step ${order}`,
    response_text: '',
    next_question: '',
    orb_primary: '#1e2a4a',
    orb_secondary: '#b8a898',
    bg_from: '#f8f5f0',
    bg_to: '#ffffff',
  };
}

function newTemplate(): ConversationTemplate {
  return {
    id: 'tpl_' + Date.now().toString(36),
    name: 'Template Baru',
    description: '',
    is_active: false,
    greeting: 'Halo dokter, ada yang bisa Cenna bantu?',
    steps: [newStep(1)],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// ─── OrbPreview ──────────────────────────────────────────────────────────────

function OrbPreview({ primary, secondary, bgFrom, bgTo }: {
  primary: string; secondary: string; bgFrom: string; bgTo: string;
}) {
  return (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0"
      style={{
        width: 40, height: 40,
        background: `conic-gradient(from 0deg, ${primary} 0%, ${secondary} 50%, ${primary} 100%)`,
        boxShadow: `0 4px 16px ${primary}60`,
        position: 'relative',
        overflow: 'hidden',
      }}
      title={`Orb: ${primary} / ${secondary}`}
    >
      <div style={{
        position: 'absolute', inset: 3, borderRadius: '50%',
        background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.08) 60%, transparent 100%)`,
      }} />
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: `linear-gradient(135deg, ${bgFrom}44, ${bgTo}22)`,
      }} />
    </div>
  );
}

// ─── ColorPicker ─────────────────────────────────────────────────────────────

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <label className="text-[9px] font-bold text-[#1e2a4a]/40 tracking-widest uppercase whitespace-nowrap">{label}</label>
      <div className="relative">
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-8 h-8 rounded-lg cursor-pointer border-2 border-white shadow-sm"
          style={{ padding: 2 }}
        />
      </div>
      <span className="text-[8px] font-mono text-[#1e2a4a]/40">{value}</span>
    </div>
  );
}

// ─── StepCard ────────────────────────────────────────────────────────────────

interface StepCardProps {
  step: ConversationStep;
  index: number;
  total: number;
  onChange: (updated: ConversationStep) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function StepCard({ step, index, total, onChange, onDelete, onMoveUp, onMoveDown }: StepCardProps) {
  const upd = (patch: Partial<ConversationStep>) => onChange({ ...step, ...patch });

  return (
    <div
      className="bg-white border border-[#1e2a4a]/10 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
      style={{
        borderLeft: `4px solid ${step.orb_primary}`,
        background: `linear-gradient(to right, ${step.bg_from}18 0%, white 120px)`,
      }}
    >
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1e2a4a]/6">
        {/* Step number badge */}
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-extrabold flex-shrink-0"
          style={{ background: step.orb_primary }}
        >
          {index + 1}
        </div>

        {/* Label */}
        <input
          className="flex-1 text-sm font-semibold text-[#1e2a4a] bg-transparent border-none outline-none placeholder:text-[#1e2a4a]/25"
          placeholder="Nama step (e.g. Sapaan Awal)"
          value={step.label}
          onChange={e => upd({ label: e.target.value })}
        />

        {/* Orb preview */}
        <OrbPreview primary={step.orb_primary} secondary={step.orb_secondary} bgFrom={step.bg_from} bgTo={step.bg_to} />

        {/* Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#1e2a4a]/40 hover:bg-[#1e2a4a]/8 disabled:opacity-20 transition border-none cursor-pointer bg-transparent"
            title="Pindah ke atas"
          >↑</button>
          <button
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#1e2a4a]/40 hover:bg-[#1e2a4a]/8 disabled:opacity-20 transition border-none cursor-pointer bg-transparent"
            title="Pindah ke bawah"
          >↓</button>
          <button
            onClick={onDelete}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-50 transition border-none cursor-pointer bg-transparent"
            title="Hapus step"
          >✕</button>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: text fields */}
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold text-[#1e2a4a]/45 tracking-widest uppercase block mb-1">
              💬 Response CENNA (yang diucapkan)
            </label>
            <textarea
              className="w-full text-xs text-[#1e2a4a] bg-[#f8f5f0] border border-[#1e2a4a]/10 rounded-xl p-3 outline-none resize-none focus:border-[#1e2a4a]/30 transition placeholder:text-[#1e2a4a]/25"
              rows={3}
              placeholder="Teks yang akan CENNA ucapkan pada step ini…"
              value={step.response_text}
              onChange={e => upd({ response_text: e.target.value })}
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-[#1e2a4a]/45 tracking-widest uppercase block mb-1">
              ❓ Pertanyaan Lanjutan (opsional)
            </label>
            <textarea
              className="w-full text-xs text-[#1e2a4a] bg-[#f8f5f0] border border-[#1e2a4a]/10 rounded-xl p-3 outline-none resize-none focus:border-[#1e2a4a]/30 transition placeholder:text-[#1e2a4a]/25"
              rows={2}
              placeholder="Pertanyaan yang diucapkan setelah response (kosongkan jika tidak ada)…"
              value={step.next_question}
              onChange={e => upd({ next_question: e.target.value })}
            />
          </div>
        </div>

        {/* Right: color controls */}
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold text-[#1e2a4a]/45 tracking-widest uppercase block mb-2">
              🎨 Warna Orb
            </label>
            <div className="flex items-end gap-4 bg-[#f8f5f0] rounded-xl p-3 border border-[#1e2a4a]/8">
              <ColorPicker label="Primer" value={step.orb_primary} onChange={v => upd({ orb_primary: v })} />
              <ColorPicker label="Sekunder" value={step.orb_secondary} onChange={v => upd({ orb_secondary: v })} />
              <div className="flex-1 flex flex-col items-center gap-2">
                <span className="text-[9px] text-[#1e2a4a]/30 uppercase tracking-widest">Preview</span>
                <OrbPreview primary={step.orb_primary} secondary={step.orb_secondary} bgFrom={step.bg_from} bgTo={step.bg_to} />
              </div>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-[#1e2a4a]/45 tracking-widest uppercase block mb-2">
              🖼️ Warna Background
            </label>
            <div className="flex items-end gap-4 bg-[#f8f5f0] rounded-xl p-3 border border-[#1e2a4a]/8">
              <ColorPicker label="Awal" value={step.bg_from} onChange={v => upd({ bg_from: v })} />
              <ColorPicker label="Akhir" value={step.bg_to} onChange={v => upd({ bg_to: v })} />
              <div className="flex-1 h-10 rounded-lg border border-[#1e2a4a]/10 overflow-hidden">
                <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${step.bg_from}, ${step.bg_to})` }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ConversationTemplate() {
  const [templates, setTemplates]           = useState<ConversationTemplate[]>([]);
  const [selectedId, setSelectedId]         = useState<string | null>(null);
  const [saving, setSaving]                 = useState(false);
  const [saveMsg, setSaveMsg]               = useState('');
  const [loading, setLoading]               = useState(true);

  const selected = templates.find(t => t.id === selectedId) ?? null;

  // ─ Load from DB ─────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);
      const data = await sbGetTemplates();
      setTemplates(data);
      if (data.length > 0) setSelectedId(data[0].id);
      setLoading(false);
    })();
  }, []);

  // ─ Helpers ───────────────────────────────────────────────────────────────────
  const updateSelected = useCallback((patch: Partial<ConversationTemplate>) => {
    setTemplates(prev => prev.map(t => t.id === selectedId ? { ...t, ...patch, updated_at: new Date().toISOString() } : t));
  }, [selectedId]);

  const handleAddTemplate = () => {
    const tpl = newTemplate();
    setTemplates(prev => [...prev, tpl]);
    setSelectedId(tpl.id);
  };

  const handleDeleteTemplate = (id: string) => {
    if (!confirm('Hapus template ini? Data tidak dapat dikembalikan.')) return;
    const next = templates.filter(t => t.id !== id);
    setTemplates(next);
    setSelectedId(next.length > 0 ? next[0].id : null);
  };

  const handleActivate = (id: string) => {
    setTemplates(prev => prev.map(t => ({ ...t, is_active: t.id === id ? !t.is_active : false })));
  };

  const handleAddStep = () => {
    if (!selected) return;
    const nextOrder = (selected.steps.length > 0 ? Math.max(...selected.steps.map(s => s.order)) : 0) + 1;
    updateSelected({ steps: [...selected.steps, newStep(nextOrder)] });
  };

  const handleStepChange = (idx: number, updated: ConversationStep) => {
    if (!selected) return;
    const steps = [...selected.steps];
    steps[idx] = updated;
    updateSelected({ steps });
  };

  const handleDeleteStep = (idx: number) => {
    if (!selected) return;
    const steps = selected.steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 }));
    updateSelected({ steps });
  };

  const handleMoveStep = (idx: number, dir: -1 | 1) => {
    if (!selected) return;
    const steps = [...selected.steps];
    const target = idx + dir;
    if (target < 0 || target >= steps.length) return;
    [steps[idx], steps[target]] = [steps[target], steps[idx]];
    const reordered = steps.map((s, i) => ({ ...s, order: i + 1 }));
    updateSelected({ steps: reordered });
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      await sbSaveTemplates(templates);
      setSaveMsg('✅ Tersimpan ke database!');
    } catch (e: any) {
      setSaveMsg('❌ Gagal menyimpan: ' + e.message);
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(''), 3000);
    }
  };

  // ─ Render ────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-[#1e2a4a]/40 text-sm animate-pulse">
        Memuat template…
      </div>
    );
  }

  return (
    <div className="flex gap-6 animate-fade-in" style={{ minHeight: '70vh' }}>

      {/* ─ Left: Template List ─────────────────────────────────────────────── */}
      <div className="w-56 flex-shrink-0 flex flex-col gap-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold text-[#1e2a4a]/40 tracking-widest uppercase">Templates</span>
          <button
            onClick={handleAddTemplate}
            className="text-[11px] font-bold text-[#3d5494] hover:text-[#1e2a4a] bg-transparent border-none cursor-pointer px-2 py-1 rounded-lg hover:bg-[#1e2a4a]/8 transition"
          >
            + Baru
          </button>
        </div>

        {templates.length === 0 && (
          <div className="text-xs text-[#1e2a4a]/30 text-center py-8 bg-white rounded-2xl border border-dashed border-[#1e2a4a]/15">
            Belum ada template.<br />Klik "+ Baru" untuk mulai.
          </div>
        )}

        {templates.map(tpl => (
          <div
            key={tpl.id}
            onClick={() => setSelectedId(tpl.id)}
            className={`relative group rounded-xl px-3 py-2.5 cursor-pointer transition border ${
              selectedId === tpl.id
                ? 'bg-[#1e2a4a] text-white border-transparent'
                : 'bg-white text-[#1e2a4a] border-[#1e2a4a]/10 hover:border-[#1e2a4a]/25 hover:bg-[#f8f5f0]'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${tpl.is_active ? 'bg-emerald-400' : 'bg-transparent border border-current opacity-30'}`} />
              <span className="text-xs font-semibold truncate">{tpl.name}</span>
            </div>
            <div className={`text-[10px] mt-0.5 truncate ${selectedId === tpl.id ? 'text-white/50' : 'text-[#1e2a4a]/40'}`}>
              {tpl.steps.length} step{tpl.steps.length !== 1 ? 's' : ''}
              {tpl.is_active ? ' · 🟢 Aktif' : ''}
            </div>
            {/* Delete button */}
            <button
              onClick={e => { e.stopPropagation(); handleDeleteTemplate(tpl.id); }}
              className={`absolute right-2 top-2 opacity-0 group-hover:opacity-100 w-5 h-5 rounded flex items-center justify-center text-[10px] transition border-none cursor-pointer ${
                selectedId === tpl.id ? 'bg-white/20 text-white hover:bg-red-400/40' : 'bg-red-50 text-red-400 hover:bg-red-100'
              }`}
              title="Hapus template"
            >✕</button>
          </div>
        ))}

        {/* Save button */}
        {templates.length > 0 && (
          <div className="mt-auto pt-4 space-y-2">
            {saveMsg && (
              <p className={`text-[10px] text-center font-semibold ${saveMsg.startsWith('✅') ? 'text-emerald-600' : 'text-red-500'}`}>
                {saveMsg}
              </p>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-[#1e2a4a] text-white hover:bg-[#2d3f6b] border-none cursor-pointer transition disabled:opacity-60"
            >
              {saving ? 'Menyimpan…' : '💾 Simpan ke Database'}
            </button>
          </div>
        )}
      </div>

      {/* ─ Right: Template Editor ─────────────────────────────────────────── */}
      {!selected ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-5xl mb-4">📋</div>
            <p className="text-[#1e2a4a]/40 text-sm">Pilih template dari daftar,<br />atau buat template baru.</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-4 min-w-0">

          {/* Template header */}
          <div className="bg-white border border-[#1e2a4a]/12 rounded-2xl p-5 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-[#1e2a4a]/45 tracking-widest uppercase block mb-1">Nama Template</label>
                  <input
                    className="w-full text-sm font-semibold text-[#1e2a4a] bg-[#f8f5f0] border border-[#1e2a4a]/10 rounded-xl px-3 py-2 outline-none focus:border-[#1e2a4a]/30 transition"
                    value={selected.name}
                    onChange={e => updateSelected({ name: e.target.value })}
                    placeholder="Nama template…"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#1e2a4a]/45 tracking-widest uppercase block mb-1">Deskripsi</label>
                  <input
                    className="w-full text-xs text-[#1e2a4a] bg-[#f8f5f0] border border-[#1e2a4a]/10 rounded-xl px-3 py-2 outline-none focus:border-[#1e2a4a]/30 transition"
                    value={selected.description}
                    onChange={e => updateSelected({ description: e.target.value })}
                    placeholder="Deskripsi singkat template…"
                  />
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-[#1e2a4a]/45 tracking-widest uppercase block mb-1">
                    🗣️ Sapaan Awal (saat wake word terdeteksi)
                  </label>
                  <input
                    className="w-full text-xs text-[#1e2a4a] bg-[#f8f5f0] border border-[#1e2a4a]/10 rounded-xl px-3 py-2 outline-none focus:border-[#1e2a4a]/30 transition"
                    value={selected.greeting}
                    onChange={e => updateSelected({ greeting: e.target.value })}
                    placeholder="Halo dokter, ada yang bisa Cenna bantu?"
                  />
                </div>
                <div className="flex items-center justify-between bg-[#f8f5f0] rounded-xl px-4 py-3 border border-[#1e2a4a]/10">
                  <div>
                    <p className="text-xs font-semibold text-[#1e2a4a]">Status Template</p>
                    <p className="text-[10px] text-[#1e2a4a]/45">
                      {selected.is_active ? '🟢 Aktif — Landing page menggunakan template ini' : '⚫ Nonaktif — AI mode normal'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleActivate(selected.id)}
                    className={`px-4 py-1.5 rounded-full text-[11px] font-bold border-none cursor-pointer transition ${
                      selected.is_active
                        ? 'bg-emerald-500/15 text-emerald-700 hover:bg-red-50 hover:text-red-600'
                        : 'bg-[#1e2a4a]/8 text-[#1e2a4a]/60 hover:bg-emerald-50 hover:text-emerald-700'
                    }`}
                  >
                    {selected.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Info bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-[#1e2a4a]/40 tracking-widest uppercase">
                {selected.steps.length} Langkah Percakapan
              </span>
              {selected.is_active && (
                <span className="text-[9px] bg-emerald-500/10 text-emerald-700 font-bold px-2 py-0.5 rounded-full tracking-wider">
                  TEMPLATE MODE AKTIF
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <span className="text-[10px] text-[#1e2a4a]/35 italic">
                Setelah semua step habis → CENNA fallback ke mode AI
              </span>
              <button
                onClick={handleAddStep}
                className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-[#1e2a4a] text-white border-none cursor-pointer hover:bg-[#2d3f6b] transition"
              >
                + Tambah Step
              </button>
            </div>
          </div>

          {/* Step cards */}
          <div className="space-y-3 pb-4">
            {selected.steps.length === 0 && (
              <div className="text-center py-12 bg-white border border-dashed border-[#1e2a4a]/15 rounded-2xl">
                <p className="text-[#1e2a4a]/30 text-sm">Belum ada langkah percakapan.</p>
                <button
                  onClick={handleAddStep}
                  className="mt-3 px-4 py-2 rounded-xl text-xs font-bold bg-[#1e2a4a]/8 text-[#1e2a4a]/60 border-none cursor-pointer hover:bg-[#1e2a4a]/15 transition"
                >
                  + Tambah Step Pertama
                </button>
              </div>
            )}

            {selected.steps.map((step, idx) => (
              <StepCard
                key={step.id}
                step={step}
                index={idx}
                total={selected.steps.length}
                onChange={updated => handleStepChange(idx, updated)}
                onDelete={() => handleDeleteStep(idx)}
                onMoveUp={() => handleMoveStep(idx, -1)}
                onMoveDown={() => handleMoveStep(idx, 1)}
              />
            ))}

            {selected.steps.length > 0 && (
              <div className="flex items-center gap-3 py-3 px-4 bg-[#1e2a4a]/4 rounded-xl border border-dashed border-[#1e2a4a]/15">
                <div className="w-7 h-7 rounded-full bg-[#10b981]/20 flex items-center justify-center text-xs">🤖</div>
                <p className="text-[11px] text-[#1e2a4a]/50 italic">
                  Setelah step {selected.steps.length} selesai, CENNA beralih ke mode AI untuk melanjutkan percakapan.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

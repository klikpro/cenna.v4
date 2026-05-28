/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { getSupabaseClient, sbSetSetting, sbGetSetting, sbAddLog } from '../lib/supabase';
import { ELEVEN_FREE_VOICES, TTS_PROVIDERS, GOOGLE_TTS_VOICES, OPENAI_TTS_VOICES, invalidateTtsCache } from './landing/tts-engine';


interface ApiSettingsProps {
  onSettingsSaved: () => void;
}

// ─── AI Provider Definitions ─────────────────────────────────────────────────
export const AI_PROVIDERS = [
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    icon: '🟠',
    keyLabel: 'Anthropic API Key',
    keyPlaceholder: 'sk-ant-api03-xxxxxxxxxxxxxxxx',
    docsUrl: 'https://console.anthropic.com',
    models: [
      { value: 'claude-sonnet-4-6',          label: 'Claude Sonnet 4.6 — Akurat & Cepat (Rekomendasi)' },
      { value: 'claude-opus-4-6',             label: 'Claude Opus 4.6 — Spesialis Konsultan (Premium)' },
      { value: 'claude-haiku-4-5-20251001',   label: 'Claude Haiku 4.5 — Ultra Cepat & Hemat' },
    ],
    defaultModel: 'claude-sonnet-4-6',
    callFn: async (apiKey: string, model: string, systemPrompt: string, userMsg: string, temp: number, maxTokens: number) => {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature: temp,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMsg }],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data));
      return data.content?.[0]?.text || '';
    },
  },
  {
    id: 'openai',
    name: 'OpenAI GPT',
    icon: '🟢',
    keyLabel: 'OpenAI API Key',
    keyPlaceholder: 'sk-proj-xxxxxxxxxxxxxxxx',
    docsUrl: 'https://platform.openai.com',
    models: [
      { value: 'gpt-5',              label: 'GPT-5 — Model Terkuat OpenAI (2025)' },
      { value: 'gpt-4.1',           label: 'GPT-4.1 — 1M Context, Pengganti GPT-4o (Rekomendasi)' },
      { value: 'gpt-4.1-mini',      label: 'GPT-4.1 Mini — Cepat & Hemat, 1M Context' },
      { value: 'gpt-4.1-nano',      label: 'GPT-4.1 Nano — Ultra Ringan & Murah' },
      { value: 'gpt-4o',            label: 'GPT-4o — Multimodal Stabil' },
      { value: 'gpt-4o-mini',       label: 'GPT-4o Mini — Hemat, Masih Populer' },
      { value: 'o3',                label: 'o3 — Reasoning Terkuat (Complex Tasks)' },
      { value: 'o3-pro',            label: 'o3-pro — o3 + Compute Lebih Tinggi' },
      { value: 'o4-mini',           label: 'o4-mini — Reasoning Cepat & Efisien' },
    ],
    defaultModel: 'gpt-4.1',
    callFn: async (apiKey: string, model: string, systemPrompt: string, userMsg: string, temp: number, maxTokens: number) => {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature: temp,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMsg },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data));
      return data.choices?.[0]?.message?.content || '';
    },
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    icon: '🔵',
    keyLabel: 'Google AI Studio API Key',
    keyPlaceholder: 'AIzaSy-xxxxxxxxxxxxxxxx',
    docsUrl: 'https://aistudio.google.com',
    models: [
      { value: 'gemini-3.5-flash',          label: 'Gemini 3.5 Flash — Terbaru, Agentic Frontier (Default)' },
      { value: 'gemini-3-flash',            label: 'Gemini 3 Flash — Frontier Intelligence, Cepat' },
      { value: 'gemini-3.1-flash',          label: 'Gemini 3.1 Flash — Flash Generasi Terbaru' },
      { value: 'gemini-2.5-pro',            label: 'Gemini 2.5 Pro — Paling Akurat, 1M Token Context' },
      { value: 'gemini-2.5-flash',          label: 'Gemini 2.5 Flash — Stabil & Production-Ready' },
      { value: 'gemini-2.5-flash-lite',     label: 'Gemini 2.5 Flash-Lite — Ultra Hemat Volume Tinggi' },
      { value: 'gemini-2.0-flash',          label: 'Gemini 2.0 Flash — Stabil Lama, Terbukti' },
    ],
    defaultModel: 'gemini-3.5-flash',
    callFn: async (apiKey: string, model: string, systemPrompt: string, userMsg: string, temp: number, maxTokens: number) => {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userMsg }] }],
          generationConfig: {
            temperature: temp,
            maxOutputTokens: Math.max(maxTokens, 256), // minimum 256 agar tidak kosong
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Tampilkan pesan error Gemini yang deskriptif
        const errMsg = data.error?.message || JSON.stringify(data);
        throw new Error(`Gemini API error: ${errMsg}`);
      }
      // Cek finish reason — SAFETY / RECITATION / OTHER bisa bikin content null
      const candidate = data.candidates?.[0];
      if (!candidate) throw new Error('Gemini: Tidak ada kandidat respons. Cek API key dan model.');
      const finishReason = candidate.finishReason;
      if (finishReason === 'SAFETY') throw new Error('Gemini: Respons diblokir filter keamanan (SAFETY).');
      if (finishReason === 'RECITATION') throw new Error('Gemini: Respons diblokir karena sitasi (RECITATION).');
      const text = candidate.content?.parts?.[0]?.text;
      if (!text) throw new Error(`Gemini: Respons kosong (finishReason: ${finishReason || 'unknown'}). Coba model lain atau perpanjang maxTokens.`);
      return text;
    },
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    icon: '🟡',
    keyLabel: 'Mistral API Key',
    keyPlaceholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxx',
    docsUrl: 'https://console.mistral.ai',
    models: [
      { value: 'mistral-medium-3-5',       label: 'Mistral Medium 3.5 — Frontier Multimodal, Agentic (Terbaru)' },
      { value: 'mistral-large-2512',       label: 'Mistral Large 3 — 675B MoE, Terbaik untuk Medis' },
      { value: 'mistral-small-2603',       label: 'Mistral Small 4 — Hybrid Reasoning + Coding, 256K Context' },
      { value: 'magistral-medium-latest',  label: 'Magistral Medium — Native Reasoning, Chain-of-Thought' },
      { value: 'ministral-8b-2512',        label: 'Ministral 8B — Ringan & Efisien' },
      { value: 'ministral-3b-2512',        label: 'Ministral 3B — Ultra Ringan, Edge Devices' },
      { value: 'codestral-latest',         label: 'Codestral — Spesialis Kode & Skrip' },
    ],
    defaultModel: 'mistral-large-2512',
    callFn: async (apiKey: string, model: string, systemPrompt: string, userMsg: string, temp: number, maxTokens: number) => {
      const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature: temp,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMsg },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data));
      return data.choices?.[0]?.message?.content || '';
    },
  },
  {
    id: 'groq',
    name: 'Groq (LLaMA / Llama 4)',
    icon: '⚡',
    keyLabel: 'Groq API Key',
    keyPlaceholder: 'gsk_xxxxxxxxxxxxxxxxxxxxxxxxxx',
    docsUrl: 'https://console.groq.com',
    models: [
      { value: 'meta-llama/llama-4-maverick-17b-128e-instruct', label: 'Llama 4 Maverick 17B — Multimodal Terbaru Meta' },
      { value: 'meta-llama/llama-4-scout-17b-16e-instruct',     label: 'Llama 4 Scout 17B — Cepat & Ringan' },
      { value: 'llama-3.3-70b-versatile',                       label: 'LLaMA 3.3 70B — Serbaguna, Terbukti Stabil' },
      { value: 'llama-3.1-8b-instant',                          label: 'LLaMA 3.1 8B — Ultra Cepat 840 tok/s (Gratis)' },
      { value: 'openai/gpt-oss-120b',                           label: 'GPT-OSS 120B — OpenAI Open Weight via Groq' },
      { value: 'qwen-qwq-32b',                                  label: 'Qwen QwQ 32B — Reasoning Open Source' },
    ],
    defaultModel: 'llama-3.3-70b-versatile',
    callFn: async (apiKey: string, model: string, systemPrompt: string, userMsg: string, temp: number, maxTokens: number) => {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature: temp,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMsg },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data));
      return data.choices?.[0]?.message?.content || '';
    },
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    icon: '🐋',
    keyLabel: 'DeepSeek API Key',
    keyPlaceholder: 'sk-xxxxxxxxxxxxxxxxxxxxxxxx',
    docsUrl: 'https://platform.deepseek.com',
    models: [
      { value: 'deepseek-chat',       label: 'DeepSeek Chat (V3.2) — General Purpose, 24x Lebih Hemat' },
      { value: 'deepseek-reasoner',   label: 'DeepSeek Reasoner (R1) — Chain-of-Thought, Logika Mendalam' },
      { value: 'deepseek-r1-0528',    label: 'DeepSeek R1-0528 — Upgrade Reasoning Terkuat (Mei 2025)' },
      { value: 'deepseek-v3-0324',    label: 'DeepSeek V3-0324 — Hybrid Reasoning + Tool Use' },
    ],
    defaultModel: 'deepseek-chat',
    callFn: async (apiKey: string, model: string, systemPrompt: string, userMsg: string, temp: number, maxTokens: number) => {
      const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature: temp,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMsg },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data));
      return data.choices?.[0]?.message?.content || '';
    },
  },
  {
    id: 'openrouter',
    name: 'OpenRouter (Multi-Key)',
    icon: '🔀',
    keyLabel: 'OpenRouter API Key(s) — pisahkan dengan koma untuk multi-key',
    keyPlaceholder: 'sk-or-v1-xxx,sk-or-v1-yyy,sk-or-v1-zzz',
    docsUrl: 'https://openrouter.ai/keys',
    models: [
      { value: 'anthropic/claude-sonnet-4-6',            label: 'Claude Sonnet 4.6 via OR — Akurat & Cepat' },
      { value: 'openai/gpt-4.1',                         label: 'GPT-4.1 via OR — 1M Context' },
      { value: 'google/gemini-2.5-pro',                  label: 'Gemini 2.5 Pro via OR — 1M Token' },
      { value: 'meta-llama/llama-4-maverick:free',       label: 'Llama 4 Maverick — Gratis via OR' },
      { value: 'deepseek/deepseek-r1:free',              label: 'DeepSeek R1 — Gratis via OR' },
      { value: 'mistralai/mistral-large-2411',           label: 'Mistral Large 3 via OR' },
      { value: 'qwen/qwen3-235b-a22b:free',              label: 'Qwen3 235B — Gratis via OR' },
      { value: 'google/gemma-3-27b-it:free',             label: 'Gemma 3 27B — Gratis via OR' },
    ],
    defaultModel: 'anthropic/claude-sonnet-4-6',
    callFn: async (apiKey: string, model: string, systemPrompt: string, userMsg: string, temp: number, maxTokens: number) => {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'CENNA AI Clinical Assistant',
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature: temp,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user',   content: userMsg },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data));
      return data.choices?.[0]?.message?.content || '';
    },
  },
];

// ─── Drag-and-Drop Order List Component ─────────────────────────────────────
interface DragOrderItem { id: string; icon: string; name: string; sub?: string; hasKey?: boolean; }
interface DragOrderListProps {
  items: DragOrderItem[];
  onReorder: (newOrder: DragOrderItem[]) => void;
  label?: string;
  badge?: (item: DragOrderItem) => React.ReactNode;
}
function DragOrderList({ items, onReorder, label, badge }: DragOrderListProps) {
  const [dragging, setDragging] = React.useRef<number | null>(null);
  const [dragOver, setDragOver] = React.useRef<number | null>(null);
  const [localItems, setLocalItems] = React.useState(items);
  const [dragIdx, setDragIdx] = React.useState<number | null>(null);
  const [overIdx, setOverIdx] = React.useState<number | null>(null);

  // Sync with parent when items change externally
  React.useEffect(() => { setLocalItems(items); }, [items.map(i => i.id).join(',')]);

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    dragging.current = idx;
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragEnter = (idx: number) => {
    if (dragging.current === null || dragging.current === idx) return;
    dragOver.current = idx;
    setOverIdx(idx);
    // Reorder preview
    const next = [...localItems];
    const [moved] = next.splice(dragging.current, 1);
    next.splice(idx, 0, moved);
    dragging.current = idx;
    setLocalItems(next);
  };
  const handleDragEnd = () => {
    setDragIdx(null);
    setOverIdx(null);
    dragging.current = null;
    dragOver.current = null;
    onReorder(localItems);
  };
  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const next = [...localItems];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setLocalItems(next);
    onReorder(next);
  };
  const moveDown = (idx: number) => {
    if (idx === localItems.length - 1) return;
    const next = [...localItems];
    [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
    setLocalItems(next);
    onReorder(next);
  };

  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">{label}</span>
          <span className="text-[9px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">drag atau ▲▼ untuk atur urutan</span>
        </div>
      )}
      {localItems.map((item, idx) => (
        <div
          key={item.id}
          draggable
          onDragStart={e => handleDragStart(e, idx)}
          onDragEnter={() => handleDragEnter(idx)}
          onDragOver={e => e.preventDefault()}
          onDragEnd={handleDragEnd}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition select-none ${
            dragIdx === idx
              ? 'opacity-40 border-dashed border-[#1e2a4a]/40 bg-slate-50'
              : 'border-gray-200 bg-white hover:border-[#1e2a4a]/30 hover:shadow-sm'
          } cursor-grab active:cursor-grabbing`}
        >
          {/* Drag handle */}
          <div className="flex flex-col gap-[3px] px-0.5 cursor-grab opacity-30 hover:opacity-70 flex-shrink-0">
            <div className="w-3.5 h-[2px] bg-[#1e2a4a] rounded-full" />
            <div className="w-3.5 h-[2px] bg-[#1e2a4a] rounded-full" />
            <div className="w-3.5 h-[2px] bg-[#1e2a4a] rounded-full" />
          </div>
          {/* Rank badge */}
          <div className={`w-5 h-5 flex-shrink-0 flex items-center justify-center rounded-full text-[9px] font-black ${
            idx === 0 ? 'bg-[#1e2a4a] text-white' : 'bg-slate-100 text-slate-500'
          }`}>
            {idx + 1}
          </div>
          {/* Icon */}
          <span className="text-base flex-shrink-0">{item.icon}</span>
          {/* Name */}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-[#1e2a4a] leading-tight">{item.name}</p>
            {item.sub && <p className="text-[9px] text-slate-400 truncate">{item.sub}</p>}
          </div>
          {/* Custom badge */}
          {badge && badge(item)}
          {/* Up/Down arrows */}
          <div className="flex flex-col gap-0.5 flex-shrink-0">
            <button onClick={() => moveUp(idx)} disabled={idx === 0}
              className="w-5 h-5 flex items-center justify-center text-[#1e2a4a] bg-slate-100 hover:bg-slate-200 rounded disabled:opacity-20 text-[10px] font-bold border-none cursor-pointer">
              ▲
            </button>
            <button onClick={() => moveDown(idx)} disabled={idx === localItems.length - 1}
              className="w-5 h-5 flex items-center justify-center text-[#1e2a4a] bg-slate-100 hover:bg-slate-200 rounded disabled:opacity-20 text-[10px] font-bold border-none cursor-pointer">
              ▼
            </button>
          </div>
        </div>
      ))}
      {localItems.length > 0 && (
        <p className="text-[9px] text-slate-400 pt-1">
          📌 Urutan #1 = provider utama · Jika gagal/habis token, sistem otomatis ke urutan berikutnya
        </p>
      )}
    </div>
  );
}

// ─── Rotation Event ──────────────────────────────────────────────────────────
// Listener sederhana agar LandingPage bisa menampilkan label saat rotasi terjadi
type RotationListener = (msg: string) => void;
const _rotationListeners: Set<RotationListener> = new Set();
export function onAiRotation(fn: RotationListener) { _rotationListeners.add(fn); return () => _rotationListeners.delete(fn); }
function emitRotation(msg: string) { _rotationListeners.forEach(fn => fn(msg)); }

// ─── AI Config Cache ──────────────────────────────────────────────────────────
let _aiConfigCache: {
  providerId: string;
  // Multi-key per provider: key sudah di-expand ke array
  apiKeysMap: Record<string, string[]>;
  model: string;
  temperature: number;
  maxTokens: number;
  // Urutan rotasi provider (dari drag-drop admin)
  providerOrder: string[];
} | null = null;

const _AI_CONFIG_CACHE_TTL = 5 * 60 * 1000;
let _aiConfigCacheTs = 0;

// ─── Rotation State ───────────────────────────────────────────────────────────
// Menyimpan indeks key yang sedang aktif per-provider (persisten selama tab terbuka)
const _keyRotationIndex: Record<string, number> = {};
// Set key yang sementara di-blacklist (habis token / rate-limit), reset otomatis 60 detik
const _keyBlacklist: Map<string, number> = new Map(); // key → timestamp blacklist
const KEY_BLACKLIST_TTL = 60 * 1000; // 60 detik

function isKeyBlacklisted(providerId: string, keyIndex: number): boolean {
  const mapKey = `${providerId}:${keyIndex}`;
  const ts = _keyBlacklist.get(mapKey);
  if (!ts) return false;
  if (Date.now() - ts > KEY_BLACKLIST_TTL) {
    _keyBlacklist.delete(mapKey);
    console.debug(`[CENNA:rotation] Key ${mapKey} blacklist expired — dicoba lagi`);
    return false;
  }
  return true;
}

function blacklistKey(providerId: string, keyIndex: number) {
  const mapKey = `${providerId}:${keyIndex}`;
  _keyBlacklist.set(mapKey, Date.now());
  console.warn(`[CENNA:rotation] Key #${keyIndex + 1} provider '${providerId}' di-blacklist selama ${KEY_BLACKLIST_TTL / 1000}s`);
}

/** Deteksi apakah error disebabkan habis token / rate-limit / key tidak valid */
function isExhaustedError(err: any): boolean {
  const msg = (err?.message || '').toLowerCase();
  return (
    msg.includes('rate limit') ||
    msg.includes('rate_limit') ||
    msg.includes('quota') ||
    msg.includes('insufficient_quota') ||
    msg.includes('billing') ||
    msg.includes('exceeded') ||
    msg.includes('too many requests') ||
    msg.includes('429') ||
    msg.includes('overloaded') ||
    msg.includes('capacity') ||
    msg.includes('resource_exhausted') ||
    msg.includes('invalid api key') ||
    msg.includes('invalid_api_key') ||
    msg.includes('unauthorized') ||
    msg.includes('401') ||
    msg.includes('403')
  );
}

export function clearAiConfigCache() {
  _aiConfigCache = null;
  _aiConfigCacheTs = 0;
  _keyBlacklist.clear();
  console.debug('[CENNA:aiConfigCache] Cache & blacklist invalidated');
}

export async function loadAiConfigFromDb(): Promise<typeof _aiConfigCache> {
  const now = Date.now();
  if (_aiConfigCache && now - _aiConfigCacheTs < _AI_CONFIG_CACHE_TTL) {
    console.debug('[CENNA:loadAiConfigFromDb] Returning cached config (TTL ok)');
    return _aiConfigCache;
  }

  console.debug('[CENNA:loadAiConfigFromDb] Fetching api_ai_config from DB...');
  const dbAiConfig = await sbGetSetting<{
    provider: string; model: string; temperature: number; maxTokens: number;
  }>('api_ai_config');

  const providerId = dbAiConfig?.provider || 'anthropic';
  const provider   = AI_PROVIDERS.find(p => p.id === providerId) || AI_PROVIDERS[0];
  if (!AI_PROVIDERS.find(p => p.id === providerId))
    console.warn('[CENNA:loadAiConfigFromDb] Provider tidak dikenali:', providerId, '— fallback ke', provider.id);

  // Baca semua API key per-provider → simpan sebagai ARRAY (multi-key rotation)
  const apiKeysMap: Record<string, string[]> = {};
  await Promise.all(
    AI_PROVIDERS.map(async p => {
      const raw = await sbGetSetting<string | string[]>(`AI_KEY_${p.id.toUpperCase()}`);
      let keyArr: string[] = [];
      if (Array.isArray(raw)) {
        keyArr = raw.map(k => k.trim()).filter(Boolean);
      } else if (typeof raw === 'string' && raw.trim()) {
        // Backward-compat: string tunggal atau comma-separated
        keyArr = raw.split(',').map(k => k.trim()).filter(Boolean);
      }
      if (keyArr.length > 0) {
        apiKeysMap[p.id] = keyArr;
        console.debug(`[CENNA:loadAiConfigFromDb] ${p.id}: ${keyArr.length} key tersimpan`);
      } else {
        console.warn(`[CENNA:loadAiConfigFromDb] API key KOSONG untuk: ${p.id}`);
      }
    })
  );

  _aiConfigCache = {
    providerId,
    apiKeysMap,
    model:       dbAiConfig?.model       ?? provider.defaultModel,
    temperature: dbAiConfig?.temperature ?? 0.3,
    maxTokens:   dbAiConfig?.maxTokens   ?? 2048,
    providerOrder: (await sbGetSetting<string[]>('ai_provider_order')) || AI_PROVIDERS.map(p => p.id),
  };
  _aiConfigCacheTs = Date.now();
  console.debug('[CENNA:loadAiConfigFromDb] Cache tersimpan, providers:', Object.keys(apiKeysMap).map(id => `${id}(${apiKeysMap[id].length})`).join(', '));
  return _aiConfigCache;
}

// ─── Exported helper: call active AI provider — dengan rotasi otomatis ────────
//
// Urutan rotasi:
//   1. Coba semua key aktif pada provider utama (skip key yang di-blacklist)
//   2. Jika semua key provider utama gagal → coba provider lain yang punya key
//   3. Jika semua provider gagal → lempar error terakhir
//
export async function callActiveAI(
  systemPrompt: string,
  userMsg: string,
): Promise<string> {
  console.debug('[CENNA:callActiveAI] Memuat konfigurasi AI...');
  const cfg = await loadAiConfigFromDb();
  if (!cfg) throw new Error('Konfigurasi AI tidak tersedia.');

  const { providerId, apiKeysMap, model, temperature, maxTokens, providerOrder } = cfg;

  // Susun urutan provider sesuai pengaturan admin (drag-drop)
  // Provider utama = yang terpilih di selector (providerId), diprioritaskan di posisi pertama
  const sortedIds = [
    providerId,
    ...providerOrder.filter(id => id !== providerId),
    ...AI_PROVIDERS.map(p => p.id).filter(id => id !== providerId && !providerOrder.includes(id)),
  ];
  const orderedProviders = sortedIds
    .map(id => AI_PROVIDERS.find(p => p.id === id))
    .filter((p): p is typeof AI_PROVIDERS[0] => !!p && (apiKeysMap[p.id]?.length ?? 0) > 0);

  const primaryProvider = orderedProviders[0] || AI_PROVIDERS[0];

  let lastError: Error = new Error('Tidak ada AI provider yang berhasil dihubungi.');

  for (const provider of orderedProviders) {
    const keys = apiKeysMap[provider.id] ?? [];
    if (keys.length === 0) {
      console.warn(`[CENNA:callActiveAI] Skip ${provider.name}: tidak ada API key`);
      continue;
    }

    // Tentukan model yang dipakai — provider utama pakai model terpilih,
    // provider fallback pakai defaultModel-nya sendiri
    const activeModel = provider.id === primaryProvider.id ? model : provider.defaultModel;

    // Inisialisasi indeks rotasi untuk provider ini
    if (_keyRotationIndex[provider.id] === undefined) _keyRotationIndex[provider.id] = 0;

    // Coba setiap key pada provider ini, mulai dari indeks rotasi terakhir
    let triedCount = 0;
    while (triedCount < keys.length) {
      const keyIdx = _keyRotationIndex[provider.id] % keys.length;

      if (isKeyBlacklisted(provider.id, keyIdx)) {
        // Key ini sedang di-blacklist — skip ke berikutnya
        _keyRotationIndex[provider.id] = (keyIdx + 1) % keys.length;
        triedCount++;
        continue;
      }

      const apiKey = keys[keyIdx];
      console.debug(`[CENNA:callActiveAI] Mencoba ${provider.name} key #${keyIdx + 1}/${keys.length}, model: ${activeModel}`);
      emitRotation(`Menghubungi ${provider.name}… (key #${keyIdx + 1}/${keys.length})`);

      try {
        const result = await provider.callFn(
          apiKey, activeModel, systemPrompt, userMsg, temperature, maxTokens
        );
        // Berhasil — perbarui indeks rotasi ke key berikutnya (round-robin normal)
        _keyRotationIndex[provider.id] = (keyIdx + 1) % keys.length;
        console.debug(`[CENNA:callActiveAI] ✓ Berhasil via ${provider.name} key #${keyIdx + 1} (${result.length} karakter)`);
        return result;
      } catch (e: any) {
        lastError = e;
        console.warn(`[CENNA:callActiveAI] ✗ ${provider.name} key #${keyIdx + 1} gagal: ${e.message}`);

        if (isExhaustedError(e)) {
          // Token habis / rate-limit / key tidak valid → blacklist key ini sementara
          blacklistKey(provider.id, keyIdx);
          emitRotation(`${provider.name} key #${keyIdx + 1} habis — beralih ke key berikutnya…`);
          _keyRotationIndex[provider.id] = (keyIdx + 1) % keys.length;
          triedCount++;
          // Langsung coba key berikutnya pada provider yang sama
          continue;
        } else {
          // Error lain (network, 5xx, dll) — hentikan percobaan pada provider ini
          console.error(`[CENNA:callActiveAI] Error non-exhausted pada ${provider.name}:`, e.message);
          break;
        }
      }
    }

    console.warn(`[CENNA:callActiveAI] Semua key ${provider.name} gagal — mencoba provider berikutnya...`);
    emitRotation(`${provider.name} tidak tersedia — mencoba provider berikutnya…`);
  }

  // Semua provider gagal
  console.error('[CENNA:callActiveAI] ✗ Semua AI provider dan key telah dicoba — gagal semua.');
  throw new Error(
    `Semua AI provider gagal merespons. Error terakhir: ${lastError.message}\n` +
    `Periksa konfigurasi API key di menu Pengaturan.`
  );
}


// ─── Reusable Multi-Key Input Component ──────────────────────────────────────
interface MultiKeyInputProps {
  keys: string[];
  onChange: (keys: string[]) => void;
  placeholder?: string;
  label?: string;
  type?: string;
}
function MultiKeyInput({ keys, onChange, placeholder = 'Masukkan API key...', label, type = 'password' }: MultiKeyInputProps) {
  const safeKeys = keys.length ? keys : [''];
  const addKey = () => onChange([...safeKeys, '']);
  const removeKey = (i: number) => {
    const next = safeKeys.filter((_, idx) => idx !== i);
    onChange(next.length ? next : ['']);
  };
  const updateKey = (i: number, val: string) => {
    const next = [...safeKeys];
    next[i] = val;
    onChange(next);
  };
  return (
    <div className="space-y-2">
      {label && <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">{label}</label>}
      {safeKeys.map((k, i) => (
        <div key={i} className="flex gap-2 items-center">
          <div className="relative flex-1">
            {safeKeys.length > 1 && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-[#1e2a4a]/30 pointer-events-none select-none">
                #{i + 1}
              </span>
            )}
            <input
              type={type}
              value={k}
              onChange={e => updateKey(i, e.target.value)}
              placeholder={placeholder}
              className={`w-full py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono outline-none focus:border-[#1e2a4a] ${safeKeys.length > 1 ? 'pl-8 pr-4' : 'px-4'}`}
            />
          </div>
          {safeKeys.length > 1 && (
            <button
              type="button"
              onClick={() => removeKey(i)}
              className="w-8 h-8 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-red-200 text-xs font-bold bg-white cursor-pointer flex-shrink-0"
              title="Hapus key ini"
            >
              ×
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={addKey}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-[#1e2a4a] border border-dashed border-[#1e2a4a]/30 rounded-lg hover:bg-[#1e2a4a]/5 cursor-pointer bg-transparent transition"
      >
        <span className="text-sm leading-none">+</span> Tambah API Key
      </button>
      {safeKeys.filter(k => k.trim()).length > 1 && (
        <p className="text-[9px] text-slate-400">
          ⚡ {safeKeys.filter(k => k.trim()).length} key tersimpan · rotasi otomatis tiap menit
        </p>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ApiSettings({ onSettingsSaved }: ApiSettingsProps) {
  const [activeTab, setActiveTab] = useState<'database' | 'ai' | 'stt'>('database');

  // Supabase
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [supabaseRef, setSupabaseRef] = useState('');
  const [dbStatus, setDbStatus] = useState<'disconnected' | 'testing' | 'connected' | 'error'>('disconnected');
  const [dbError, setDbError] = useState<string | null>(null);

  // Multi-AI
  const [activeProvider, setActiveProvider] = useState('');
  // Multi-key: setiap provider menyimpan array of keys
  const [providerKeys, setProviderKeys] = useState<Record<string, string[]>>({});
  const [aiModel, setAiModel] = useState('');
  const [aiTemp, setAiTemp] = useState(0.3);
  const [aiMaxTokens, setAiMaxTokens] = useState(2048);
  const [aiTestStatus, setAiTestStatus] = React.useState<Record<string, 'idle' | 'testing' | 'ok' | 'error'>>({});
  // Urutan rotasi provider AI (drag-drop)
  const [aiProviderOrder, setAiProviderOrder] = React.useState<string[]>(AI_PROVIDERS.map(p => p.id));
  // Urutan rotasi TTS (drag-drop)
  const TTS_ORDER_DEFAULTS = ['elevenlabs', 'google', 'openai', 'azure', 'browser'];
  const [ttsOrder, setTtsOrder] = React.useState<string[]>(TTS_ORDER_DEFAULTS);

  // STT
  const [sttKeys, setSttKeys] = useState<string[]>(['']);
  const [sttProvider, setSttProvider] = useState('');
  const [sttLang, setSttLang] = useState('');
  // ElevenLabs
  const [elevenLabsKeys, setElevenLabsKeys] = useState<string[]>(['']);
  const [elevenVoiceId, setElevenVoiceId] = useState('');
  const [elevenSpeed,   setElevenSpeed]   = useState(1.0);
  const [elevenPreview, setElevenPreview] = useState<'idle'|'loading'|'playing'>('idle');
  // Google TTS
  const [googleTtsKeys,   setGoogleTtsKeys]   = useState<string[]>(['']);
  const [googleTtsVoice,  setGoogleTtsVoice]  = useState('');
  const [googleTtsRate,   setGoogleTtsRate]   = useState(1.0);
  // OpenAI TTS
  const [openaiTtsKeys,  setOpenaiTtsKeys]  = useState<string[]>(['']);
  const [openaiTtsVoice, setOpenaiTtsVoice] = useState('');
  const [openaiTtsModel, setOpenaiTtsModel] = useState('');
  // Azure TTS
  const [azureTtsKeys,   setAzureTtsKeys]   = useState<string[]>(['']);
  const [azureTtsRegion, setAzureTtsRegion] = useState('');
  const [azureTtsVoice,  setAzureTtsVoice]  = useState('');
  const [azureTtsRate,   setAzureTtsRate]   = useState(1.0);
  // TTS provider pilihan
  const [ttsPrefProvider, setTtsPrefProvider] = useState('');
  // TTS preview text — dikonfigurasi admin via DB
  const [ttsPreviewText, setTtsPreviewText] = useState('');
  // STT — Durasi deteksi jeda diam (silence detection)
  const [silenceMs, setSilenceMs] = useState(2000);

  const currentProviderDef = AI_PROVIDERS.find(p => p.id === activeProvider) || AI_PROVIDERS[0];

  useEffect(() => {
    async function loadSettings() {
      console.debug('[CENNA:loadSettings] Memuat semua konfigurasi dari DB...');

      // ── Supabase bootstrap ──
      const envUrl  = ((import.meta as unknown as { env: Record<string, string> }).env.VITE_SUPABASE_URL);
      const envAnon = ((import.meta as unknown as { env: Record<string, string> }).env.VITE_SUPABASE_ANON_KEY);
      console.debug('[CENNA:loadSettings] ENV VITE_SUPABASE_URL:', envUrl ? 'ada' : 'kosong');
      const dbSupaConfig = await sbGetSetting<{ url: string; anonKey: string; ref: string }>('supabase_bootstrap');
      console.debug('[CENNA:loadSettings] supabase_bootstrap dari DB:', dbSupaConfig ? 'ada' : 'kosong');
      setSupabaseUrl(envUrl || dbSupaConfig?.url || '');
      setSupabaseAnonKey(envAnon || dbSupaConfig?.anonKey || '');
      setSupabaseRef(dbSupaConfig?.ref || '');
      if (!envUrl && !dbSupaConfig?.url) console.warn('[CENNA:loadSettings] ⚠️ Supabase URL tidak ditemukan di ENV maupun DB!');

      // ── AI Config ──
      console.debug('[CENNA:loadSettings] Memuat api_ai_config...');
      const dbAiConfig = await sbGetSetting<{
        provider: string; model: string; temperature: number; maxTokens: number;
      }>('api_ai_config');
      console.debug('[CENNA:loadSettings] api_ai_config:', dbAiConfig);
      const savedProvider = dbAiConfig?.provider || '';
      if (!savedProvider) console.warn('[CENNA:loadSettings] ⚠️ AI provider belum dikonfigurasi di DB.');
      setActiveProvider(savedProvider);

      // Load API keys semua provider (multi-key: disimpan koma-separated)
      const keys: Record<string, string[]> = {};
      await Promise.all(
        AI_PROVIDERS.map(async p => {
          const k = await sbGetSetting<string>(`AI_KEY_${p.id.toUpperCase()}`);
          if (!k) { keys[p.id] = ['']; console.warn(`[CENNA:loadSettings] ⚠️ API Key kosong untuk provider: ${p.id}`); }
          else {
            keys[p.id] = k.split(',').map((x: string) => x.trim()).filter(Boolean);
            if (!keys[p.id].length) keys[p.id] = [''];
            console.debug(`[CENNA:loadSettings] ✓ API Key(s) ada untuk: ${p.id} (${keys[p.id].length} key)`);
          }
        })
      );
      setProviderKeys(keys);

      if (dbAiConfig) {
        setAiModel(dbAiConfig.model || AI_PROVIDERS.find(p => p.id === savedProvider)?.defaultModel || '');
        setAiTemp(dbAiConfig.temperature ?? 0.3);
        setAiMaxTokens(dbAiConfig.maxTokens ?? 2048);
        console.debug(`[CENNA:loadSettings] AI model: ${dbAiConfig.model}, temp: ${dbAiConfig.temperature}, maxTokens: ${dbAiConfig.maxTokens}`);
      } else {
        console.warn('[CENNA:loadSettings] ⚠️ api_ai_config tidak ada di DB — model kosong.');
        setAiModel(AI_PROVIDERS.find(p => p.id === savedProvider)?.defaultModel || '');
        setAiTemp(0.3);
        setAiMaxTokens(2048);
      }

      // ── STT Config ──
      console.debug('[CENNA:loadSettings] Memuat api_stt_config...');
      const dbSttConfig = await sbGetSetting<{ provider: string; lang: string; sttKey: string }>('api_stt_config');
      console.debug('[CENNA:loadSettings] api_stt_config:', dbSttConfig);
      if (!dbSttConfig) console.warn('[CENNA:loadSettings] ⚠️ STT config belum dikonfigurasi di DB.');
      setSttProvider(dbSttConfig?.provider || '');
      setSttLang(dbSttConfig?.lang || '');
      const _sttRaw = dbSttConfig?.sttKey || '';
      setSttKeys(_sttRaw ? _sttRaw.split(',').map((x: string) => x.trim()).filter(Boolean) : ['']);

      // ── ElevenLabs ──
      const elKey = await sbGetSetting<string>('ELEVENLABS_API_KEY');
      const elVoice = await sbGetSetting<string>('ELEVEN_VOICE_ID');
      const elSpeed = await sbGetSetting<number>('ELEVEN_SPEED');
      if (!elKey) console.warn('[CENNA:loadSettings] ⚠️ ELEVENLABS_API_KEY kosong.');
      if (!elVoice) console.warn('[CENNA:loadSettings] ⚠️ ELEVEN_VOICE_ID kosong.');
      console.debug('[CENNA:loadSettings] ElevenLabs — key:', elKey ? 'ada' : 'kosong', 'voice:', elVoice, 'speed:', elSpeed);
      setElevenLabsKeys(elKey ? elKey.split(',').map((x: string) => x.trim()).filter(Boolean) : ['']);
      setElevenVoiceId(elVoice || '');
      setElevenSpeed(elSpeed ?? 1.0);

      // ── Google TTS ──
      const _gTts = (await sbGetSetting<string>('GOOGLE_TTS_KEY')) || '';
      setGoogleTtsKeys(_gTts ? _gTts.split(',').map((x: string) => x.trim()).filter(Boolean) : ['']);
      setGoogleTtsVoice((await sbGetSetting<string>('GOOGLE_TTS_VOICE')) || '');
      setGoogleTtsRate((await sbGetSetting<number>('GOOGLE_TTS_RATE')) ?? 1.0);

      // ── OpenAI TTS ──
      const _oTts = (await sbGetSetting<string>('OPENAI_TTS_KEY')) || '';
      setOpenaiTtsKeys(_oTts ? _oTts.split(',').map((x: string) => x.trim()).filter(Boolean) : ['']);
      setOpenaiTtsVoice((await sbGetSetting<string>('OPENAI_TTS_VOICE')) || '');
      setOpenaiTtsModel((await sbGetSetting<string>('OPENAI_TTS_MODEL')) || '');

      // ── Azure TTS ──
      const _aTts = (await sbGetSetting<string>('AZURE_TTS_KEY')) || '';
      setAzureTtsKeys(_aTts ? _aTts.split(',').map((x: string) => x.trim()).filter(Boolean) : ['']);
      setAzureTtsRegion((await sbGetSetting<string>('AZURE_TTS_REGION')) || '');
      setAzureTtsVoice((await sbGetSetting<string>('AZURE_TTS_VOICE')) || '');
      setAzureTtsRate((await sbGetSetting<number>('AZURE_TTS_RATE')) ?? 1.0);

      // ── TTS preferred & preview ──
      const ttsProvider = await sbGetSetting<string>('tts_provider');
      const ttsPreview  = await sbGetSetting<string>('tts_preview_text');
      if (!ttsProvider) console.warn('[CENNA:loadSettings] ⚠️ tts_provider belum dipilih di DB.');
      setTtsPrefProvider(ttsProvider || '');
      setTtsPreviewText(ttsPreview || '');

      // ── AI Provider Order ──
      const savedAiOrder = await sbGetSetting<string[]>('ai_provider_order');
      if (Array.isArray(savedAiOrder) && savedAiOrder.length > 0) {
        // Merge: pastikan semua provider ada (provider baru tidak hilang)
        const merged = [
          ...savedAiOrder.filter(id => AI_PROVIDERS.some(p => p.id === id)),
          ...AI_PROVIDERS.map(p => p.id).filter(id => !savedAiOrder.includes(id)),
        ];
        setAiProviderOrder(merged);
        console.debug('[CENNA:loadSettings] ai_provider_order:', merged);
      }

      // ── TTS Order ──
      const savedTtsOrder = await sbGetSetting<string[]>('tts_order');
      if (Array.isArray(savedTtsOrder) && savedTtsOrder.length > 0) {
        const allTts = ['elevenlabs', 'google', 'openai', 'azure', 'browser'];
        const merged = [
          ...savedTtsOrder.filter(id => allTts.includes(id)),
          ...allTts.filter(id => !savedTtsOrder.includes(id)),
        ];
        setTtsOrder(merged);
        console.debug('[CENNA:loadSettings] tts_order:', merged);
      }

      // ── STT Silence duration ──
      const savedSilenceMs = await sbGetSetting<number>('stt_silence_ms');
      if (savedSilenceMs) setSilenceMs(savedSilenceMs);
      console.debug('[CENNA:loadSettings] stt_silence_ms:', savedSilenceMs ?? '(default 2000)');

      console.debug('[CENNA:loadSettings] ✅ Semua konfigurasi berhasil dimuat.');
    }
    loadSettings().catch(e => console.error('[CENNA:loadSettings] ❌ Fatal error saat memuat settings:', e));
  }, []);

  const handleProviderChange = (pid: string) => {
    console.debug(`[CENNA:handleProviderChange] Ganti provider: ${activeProvider} → ${pid}`);
    setActiveProvider(pid);
    const def = AI_PROVIDERS.find(p => p.id === pid);
    if (def) { setAiModel(def.defaultModel); console.debug(`[CENNA:handleProviderChange] Default model: ${def.defaultModel}`); }
    else console.warn(`[CENNA:handleProviderChange] Provider ${pid} tidak ditemukan di AI_PROVIDERS!`);
  };

  const handleSaveSupabase = async () => {
    console.debug('[CENNA:handleSaveSupabase] Mulai menyimpan konfigurasi Supabase...');
    if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
      console.warn('[CENNA:handleSaveSupabase] ⚠️ URL atau Anon Key kosong — simpan dibatalkan.');
      alert('Supabase Project URL dan Anon Key wajib diisi.');
      return;
    }
    try {
      await sbSetSetting('supabase_bootstrap', {
        url: supabaseUrl.trim(),
        anonKey: supabaseAnonKey.trim(),
        ref: supabaseRef.trim(),
        updatedAt: new Date().toISOString(),
      });
      console.debug('[CENNA:handleSaveSupabase] ✅ supabase_bootstrap tersimpan ke DB.');
      localStorage.removeItem('SUPABASE_URL');
      localStorage.removeItem('SUPABASE_ANON_KEY');
      localStorage.removeItem('SUPABASE_REF');
      setDbStatus('connected');
      await sbAddLog('success', 'SYSTEM', 'Supabase credentials saved to database.');
      alert('Konfigurasi Supabase berhasil disimpan ke database! (bukan localStorage)');
      onSettingsSaved();
    } catch (e: any) {
      console.error('[CENNA:handleSaveSupabase] ❌ Gagal menyimpan:', e);
      setDbStatus('error');
      alert(`❌ Gagal menyimpan konfigurasi Supabase!\n\n${e.message}`);
    }
  };

  const handleTestDatabase = async () => {
    console.debug('[CENNA:handleTestDatabase] Menguji koneksi ke Supabase...');
    if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
      console.warn('[CENNA:handleTestDatabase] ⚠️ URL atau Key kosong — test dibatalkan.');
      alert('Isi URL dan Key terlebih dahulu.');
      return;
    }
    setDbStatus('testing');
    setDbError(null);
    const start = Date.now();
    try {
      const res = await fetch(`${supabaseUrl.trim()}/rest/v1/`, {
        headers: { apikey: supabaseAnonKey.trim() },
      });
      const latency = Date.now() - start;
      console.debug(`[CENNA:handleTestDatabase] HTTP ${res.status} — latency: ${latency}ms`);
      if (res.ok) {
        setDbStatus('connected');
        console.debug('[CENNA:handleTestDatabase] ✅ Koneksi sukses.');
        alert(`Koneksi Supabase Sukses! Latency: ${latency}ms`);
      } else {
        setDbStatus('error');
        setDbError(`Status: ${res.status}`);
        console.error(`[CENNA:handleTestDatabase] ❌ HTTP ${res.status} — koneksi gagal.`);
      }
    } catch (e: any) {
      setDbStatus('error');
      setDbError(e.message);
      console.error('[CENNA:handleTestDatabase] ❌ Exception:', e.message);
    }
  };

  const handleSaveAI = async () => {
    console.debug(`[CENNA:handleSaveAI] Provider: ${activeProvider}, Model: ${aiModel}, Temp: ${aiTemp}, MaxTokens: ${aiMaxTokens}`);
    const keys = (providerKeys[activeProvider] || []).map(k => k.trim()).filter(Boolean);
    if (!keys.length) {
      console.warn(`[CENNA:handleSaveAI] ⚠️ API Key ${currentProviderDef.name} kosong — simpan dibatalkan.`);
      alert(`${currentProviderDef.name} API Key wajib diisi minimal satu.`);
      return;
    }
    try {
      const keyStr = keys.join(',');
      console.debug(`[CENNA:handleSaveAI] Menyimpan AI_KEY_${activeProvider.toUpperCase()} ke DB (${keys.length} key)...`);
      await sbSetSetting(`AI_KEY_${activeProvider.toUpperCase()}`, keyStr);
      console.debug('[CENNA:handleSaveAI] Menyimpan api_ai_config ke DB...');
      await sbSetSetting('api_ai_config', {
        provider: activeProvider,
        model: aiModel,
        temperature: aiTemp,
        maxTokens: aiMaxTokens,
        keyConfigured: true,
        updatedAt: new Date().toISOString(),
      });
      clearAiConfigCache();
      console.debug('[CENNA:handleSaveAI] ✅ AI config tersimpan, cache di-invalidate.');
      // Simpan urutan rotasi provider
      await sbSetSetting('ai_provider_order', aiProviderOrder);
      console.debug('[CENNA:handleSaveAI] ✅ ai_provider_order tersimpan:', aiProviderOrder);
      await sbAddLog('success', 'SYSTEM', `AI Engine diubah ke ${currentProviderDef.name} — ${aiModel}.`);
      alert(`✅ Konfigurasi ${currentProviderDef.name} berhasil disimpan ke database!`);
    } catch (e: any) {
      console.error('[CENNA:handleSaveAI] ❌ Error:', e);
      alert(`❌ Gagal menyimpan ke database!\n\n${e.message}\n\nKemungkinan RLS policy tabel app_settings tidak mengizinkan INSERT/UPDATE. Jalankan SQL ini di Supabase Dashboard:\n\nCREATE POLICY \"allow_auth_write\" ON app_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);\nCREATE POLICY \"allow_anon_read\" ON app_settings FOR SELECT TO anon USING (true);`);
    }
  };

  const handleTestAI = async (pid: string) => {
    const pdef = AI_PROVIDERS.find(p => p.id === pid)!;
    const key = (providerKeys[pid] || [''])[0] || '';
    console.debug(`[CENNA:handleTestAI] Menguji provider: ${pid}, model default: ${pdef.defaultModel}`);
    if (!key) {
      console.warn(`[CENNA:handleTestAI] ⚠️ API Key ${pdef.name} kosong — test dibatalkan.`);
      alert(`Isi API Key ${pdef.name} terlebih dahulu.`);
      return;
    }
    setAiTestStatus(prev => ({ ...prev, [pid]: 'testing' }));
    try {
      console.debug(`[CENNA:handleTestAI] Memanggil ${pdef.name}...`);
      const result = await pdef.callFn(
        key,
        pdef.defaultModel,
        'Kamu adalah asisten klinis CENNA AI. Jawab singkat sesuai instruksi.',
        'Balas dengan tepat teks ini tanpa perubahan: CENNA-CONNECTED',
        0.1,
        50,
      );
      console.debug(`[CENNA:handleTestAI] Respons dari ${pdef.name}:`, result);
      if (result && result.length > 0) {
        setAiTestStatus(prev => ({ ...prev, [pid]: 'ok' }));
        alert(`✅ ${pdef.name} terhubung!\nResponse: "${result.trim().substring(0, 80)}"`);
      } else {
        throw new Error('Respons kosong dari provider');
      }
    } catch (e: any) {
      console.error(`[CENNA:handleTestAI] ❌ Error dari ${pdef.name}:`, e.message);
      setAiTestStatus(prev => ({ ...prev, [pid]: 'error' }));
      alert(`❌ Koneksi ${pdef.name} gagal:\n${e.message}`);
    }
  };

  const handleSaveSTT = async () => {
    console.debug('[CENNA:handleSaveSTT] Menyimpan konfigurasi STT/TTS...', { sttProvider, sttLang, ttsPrefProvider });
    try {
      const _sttKeyStr = sttKeys.map(k => k.trim()).filter(Boolean).join(',');
      await sbSetSetting('api_stt_config', {
        provider: sttProvider,
        lang: sttLang,
        sttKey: _sttKeyStr,
        keyConfigured: !!_sttKeyStr,
        updatedAt: new Date().toISOString(),
      });
      console.debug('[CENNA:handleSaveSTT] ✅ api_stt_config tersimpan.');
      const _elKeyStr = elevenLabsKeys.map(k => k.trim()).filter(Boolean).join(',');
      await sbSetSetting('ELEVENLABS_API_KEY', _elKeyStr);
      await sbSetSetting('ELEVEN_VOICE_ID', elevenVoiceId);
      await sbSetSetting('ELEVEN_SPEED', elevenSpeed);
      console.debug('[CENNA:handleSaveSTT] ✅ ElevenLabs config tersimpan. Keys:', elevenLabsKeys.filter(k=>k.trim()).length, 'Voice:', elevenVoiceId, 'Speed:', elevenSpeed);
      const _gTtsKeyStr = googleTtsKeys.map(k => k.trim()).filter(Boolean).join(',');
      await sbSetSetting('GOOGLE_TTS_KEY', _gTtsKeyStr);
      await sbSetSetting('GOOGLE_TTS_VOICE', googleTtsVoice);
      await sbSetSetting('GOOGLE_TTS_RATE', googleTtsRate);
      const _oTtsKeyStr = openaiTtsKeys.map(k => k.trim()).filter(Boolean).join(',');
      await sbSetSetting('OPENAI_TTS_KEY', _oTtsKeyStr);
      await sbSetSetting('OPENAI_TTS_VOICE', openaiTtsVoice);
      await sbSetSetting('OPENAI_TTS_MODEL', openaiTtsModel);
      const _aTtsKeyStr = azureTtsKeys.map(k => k.trim()).filter(Boolean).join(',');
      await sbSetSetting('AZURE_TTS_KEY', _aTtsKeyStr);
      await sbSetSetting('AZURE_TTS_REGION', azureTtsRegion);
      await sbSetSetting('AZURE_TTS_VOICE', azureTtsVoice);
      await sbSetSetting('AZURE_TTS_RATE', azureTtsRate);
      await sbSetSetting('tts_provider', ttsPrefProvider);
      await sbSetSetting('tts_preview_text', ttsPreviewText.trim());
      await sbSetSetting('stt_silence_ms', silenceMs);
      // Simpan urutan rotasi TTS
      await sbSetSetting('tts_order', ttsOrder);
      console.debug('[CENNA:handleSaveSTT] ✅ tts_order tersimpan:', ttsOrder);
      // BUG-N5 FIX: invalidasi TTS cache agar perubahan efektif segera (tidak tunggu 5 menit TTL)
      invalidateTtsCache();
      console.debug('[CENNA:handleSaveSTT] ✅ Semua TTS config tersimpan & cache invalidated. Provider utama:', ttsPrefProvider);
      await sbAddLog('success', 'SYSTEM', `STT/TTS config updated. TTS utama: ${ttsPrefProvider}.`);
      alert('✅ Konfigurasi Speech/TTS berhasil disimpan ke database!');

    } catch (e: any) {
      console.error('[CENNA:handleSaveSTT] ❌ Error:', e);
      alert(`❌ Gagal menyimpan STT config!\n\n${e.message}`);
    }
  };

  const handleClearDbConfig = async () => {
    console.debug('[CENNA:handleClearDbConfig] Konfirmasi hapus konfigurasi Supabase...');
    if (confirm('Hapus seluruh konfigurasi Supabase tersimpan?')) {
      console.warn('[CENNA:handleClearDbConfig] ⚠️ Menghapus supabase_bootstrap dari DB...');
      await sbSetSetting('supabase_bootstrap', null);
      localStorage.removeItem('SUPABASE_URL');
      localStorage.removeItem('SUPABASE_ANON_KEY');
      localStorage.removeItem('SUPABASE_REF');
      setSupabaseUrl(''); setSupabaseAnonKey(''); setSupabaseRef('');
      setDbStatus('disconnected');
      console.debug('[CENNA:handleClearDbConfig] ✅ Konfigurasi Supabase dihapus.');
    } else {
      console.debug('[CENNA:handleClearDbConfig] Dibatalkan oleh user.');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex border-b border-[#1e2a4a]/12 gap-1 bg-[#1e2a4a]/5 p-1 rounded-xl">
        {(['database', 'ai', 'stt'] as const).map(tab => (
          <button key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition border-none cursor-pointer ${
              activeTab === tab ? 'bg-white text-[#1e2a4a] shadow-sm' : 'text-[#1e2a4a]/50 bg-transparent'
            }`}>
            {tab === 'database' ? '🗄️ Supabase' : tab === 'ai' ? '🤖 AI Engine' : '🎤 Speech-to-Text'}
          </button>
        ))}
      </div>

      {/* ── DATABASE TAB ─────────────────────────────────────────────────── */}
      {activeTab === 'database' && (
        <div className="bg-white border border-[#1e2a4a]/12 rounded-3xl p-6 space-y-6">
          <div className="flex gap-4 justify-between items-start flex-wrap">
            <div>
              <h3 className="font-bold text-sm text-[#1e2a4a] mb-1">Supabase Database Integration</h3>
              <p className="text-xs text-slate-500">Hubungkan pangkalan data klinis relasional Anda.</p>
            </div>
            <span className={`px-3 py-1 rounded-full font-bold text-[10px] ${
              dbStatus === 'connected' ? 'bg-emerald-500/10 text-[#10b981]' :
              dbStatus === 'testing' ? 'bg-amber-500/10 text-amber-600 animate-pulse' : 'bg-gray-100 text-gray-400'
            }`}>
              {dbStatus === 'connected' ? '● Terhubung' : dbStatus === 'testing' ? '⏳ Menguji...' : '◯ Belum Terhubung'}
            </span>
          </div>
          {dbError && (
            <div className="p-3 bg-red-400/10 border border-red-500/20 text-red-600 rounded-xl text-xs font-semibold">
              Koneksi gagal: {dbError}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">Supabase Project URL</label>
              <input id="api-supabase-url" type="url" value={supabaseUrl} onChange={e => setSupabaseUrl(e.target.value)}
                placeholder="https://xxxxxxxxxxxx.supabase.co"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono outline-none focus:border-[#1e2a4a]" />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">Project Reference ID</label>
              <input id="api-supabase-ref" type="text" value={supabaseRef} onChange={e => setSupabaseRef(e.target.value)}
                placeholder="Xxxxxxxxxxxxx"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono outline-none focus:border-[#1e2a4a]" />
            </div>
            <div className="md:col-span-2 space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">Anon (Public) API Key</label>
              <input id="api-supabase-anon" type="password" value={supabaseAnonKey} onChange={e => setSupabaseAnonKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI..."
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono outline-none focus:border-[#1e2a4a]" />
            </div>
          </div>
          <div className="flex gap-3 border-t border-gray-100 pt-6">
            <button id="btn-save-supabase" onClick={handleSaveSupabase}
              className="px-6 py-3 bg-[#1e2a4a] hover:bg-[#2d3f6b] text-white text-xs font-bold rounded-xl border-none cursor-pointer">
              💾 Simpan Konfigurasi
            </button>
            <button id="btn-test-supabase" onClick={handleTestDatabase}
              className="px-5 py-3 border border-[#1e2a4a]/25 hover:border-slate-400 text-[#1e2a4a] text-xs font-bold rounded-xl bg-transparent cursor-pointer">
              🔌 Uji Koneksi
            </button>
            <button id="btn-clear-supabase" onClick={handleClearDbConfig}
              className="px-4 py-3 bg-red-500/10 hover:bg-red-500/15 text-red-600 text-xs font-bold rounded-xl border-none cursor-pointer ml-auto">
              🗑 Hapus Data
            </button>
          </div>
        </div>
      )}

      {/* ── AI ENGINE TAB ─────────────────────────────────────────────────── */}
      {activeTab === 'ai' && (
        <div className="space-y-6">
          {/* Active provider banner */}
          <div className="bg-[#1e2a4a] text-white rounded-2xl p-4 flex items-center gap-3">
            <span className="text-2xl">{currentProviderDef.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-white/50 uppercase tracking-widest font-bold">AI Engine Aktif</p>
              <h3 className="font-bold text-sm">{currentProviderDef.name}</h3>
              <p className="text-[11px] text-white/60 truncate">Model: {aiModel}</p>
            </div>
            <span className="px-3 py-1 bg-emerald-400/20 text-emerald-300 rounded-full text-[10px] font-bold">
              ● AKTIF
            </span>
          </div>

          {/* Provider selector cards */}
          <div className="bg-white border border-[#1e2a4a]/12 rounded-3xl p-6 space-y-4">
            <div>
              <h3 className="font-bold text-sm text-[#1e2a4a] mb-1">Pilih AI Provider</h3>
              <p className="text-xs text-slate-500">Setiap provider dapat dikonfigurasi API key-nya. Satu provider aktif digunakan sebagai engine CENNA AI.</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {AI_PROVIDERS.map(p => {
                const hasKey = (providerKeys[p.id] || []).some(k => k.trim());
                const testSt = aiTestStatus[p.id] || 'idle';
                return (
                  <div
                    key={p.id}
                    onClick={() => handleProviderChange(p.id)}
                    className={`relative p-3 border-2 rounded-2xl cursor-pointer transition ${
                      activeProvider === p.id
                        ? 'border-[#1e2a4a] bg-slate-50 shadow-md'
                        : 'border-gray-200 hover:border-[#1e2a4a]/40'
                    }`}
                  >
                    {activeProvider === p.id && (
                      <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-500" />
                    )}
                    <div className="text-xl mb-1">{p.icon}</div>
                    <h4 className="font-bold text-[11px] text-[#1e2a4a] leading-tight">{p.name}</h4>
                    <div className="flex items-center gap-1 mt-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${hasKey ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                      <span className={`text-[10px] font-medium ${hasKey ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {hasKey ? 'Key tersimpan' : 'Belum ada key'}
                      </span>
                    </div>
                    {testSt === 'ok' && <div className="text-[10px] text-emerald-600 font-bold mt-0.5">✓ Terkoneksi</div>}
                    {testSt === 'error' && <div className="text-[10px] text-red-500 font-bold mt-0.5">✗ Error</div>}
                    {testSt === 'testing' && <div className="text-[10px] text-amber-500 animate-pulse mt-0.5">⏳ Testing…</div>}
                  </div>
                );
              })}
            </div>

            {/* Selected provider config */}
            <div className="border-t border-gray-100 pt-5 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">{currentProviderDef.icon}</span>
                <h4 className="font-bold text-sm text-[#1e2a4a]">{currentProviderDef.name} — Konfigurasi</h4>
                <a href={currentProviderDef.docsUrl} target="_blank" rel="noreferrer"
                  className="ml-auto text-[10px] text-blue-500 hover:underline" onClick={e => e.stopPropagation()}>
                  Dapatkan Key ↗
                </a>
              </div>

              <div className="space-y-1">
                <MultiKeyInput
                  keys={providerKeys[activeProvider] || ['']}
                  onChange={keys => setProviderKeys(prev => ({ ...prev, [activeProvider]: keys }))}
                  label={currentProviderDef.keyLabel}
                  placeholder={currentProviderDef.keyPlaceholder}
                />
                <button onClick={() => handleTestAI(activeProvider)}
                  disabled={aiTestStatus[activeProvider] === 'testing'}
                  className="mt-1 px-4 py-2 border border-[#1e2a4a]/25 text-[#1e2a4a] text-xs font-bold rounded-xl bg-transparent cursor-pointer whitespace-nowrap hover:bg-slate-50 disabled:opacity-50">
                  {aiTestStatus[activeProvider] === 'testing' ? '⏳' : '🔌 Test Key Pertama'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">Model</label>
                  <select
                    value={aiModel}
                    onChange={e => setAiModel(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none text-slate-800">
                    {currentProviderDef.models.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                    Temperature: <span className="font-mono">{aiTemp}</span>
                  </label>
                  <input type="range" min="0" max="1" step="0.1" value={aiTemp}
                    onChange={e => setAiTemp(parseFloat(e.target.value))}
                    className="w-full h-1 bg-gray-200 appearance-none cursor-pointer accent-[#1e2a4a] rounded-lg mt-3" />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <button id="btn-save-ai-api" onClick={handleSaveAI}
                className="px-6 py-3 bg-[#1e2a4a] hover:bg-[#2d3f6b] text-white text-xs font-bold rounded-xl border-none cursor-pointer shadow-md">
                💾 Simpan & Aktifkan {currentProviderDef.name}
              </button>
            </div>
          </div>

          {/* All providers quick-config table */}
          <div className="bg-white border border-[#1e2a4a]/12 rounded-3xl p-6 space-y-4">
            <h4 className="font-bold text-sm text-[#1e2a4a]">Status Semua Provider</h4>
            <div className="space-y-2">
              {AI_PROVIDERS.map(p => {
                const hasKey = (providerKeys[p.id] || []).some(k => k.trim());
                const isActive = p.id === activeProvider;
                return (
                  <div key={p.id} className={`flex items-center gap-3 p-3 rounded-xl ${isActive ? 'bg-[#1e2a4a]/5 border border-[#1e2a4a]/15' : 'bg-gray-50'}`}>
                    <span className="text-base">{p.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-[#1e2a4a]">{p.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{p.models[0].label}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isActive && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full">AKTIF</span>}
                      <span className={`w-2 h-2 rounded-full ${hasKey ? 'bg-emerald-400' : 'bg-gray-300'}`} title={hasKey ? 'Key tersimpan' : 'Belum dikonfigurasi'} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── AI Provider Rotation Order (drag-drop) ── */}
          <div className="bg-white border border-[#1e2a4a]/12 rounded-3xl p-6 space-y-4">
            <div>
              <h4 className="font-bold text-sm text-[#1e2a4a] mb-0.5">🔄 Urutan Rotasi Provider AI</h4>
              <p className="text-[10px] text-slate-500">Atur prioritas fallback — jika provider #1 kehabisan token, sistem otomatis coba provider #2, #3, dst.</p>
            </div>
            <DragOrderList
              label="Urutan Prioritas"
              items={aiProviderOrder.map(id => {
                const p = AI_PROVIDERS.find(x => x.id === id)!;
                const hasKey = (providerKeys[id] || []).some(k => k.trim());
                return { id, icon: p?.icon || '🤖', name: p?.name || id, sub: p?.models[0]?.label, hasKey };
              })}
              onReorder={newOrder => setAiProviderOrder(newOrder.map(i => i.id))}
              badge={item => (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {item.id === activeProvider && (
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-bold rounded-full">UTAMA</span>
                  )}
                  <span className={`w-2 h-2 rounded-full ${item.hasKey ? 'bg-emerald-400' : 'bg-gray-300'}`}
                    title={item.hasKey ? 'Key tersimpan' : 'Belum ada key'} />
                </div>
              )}
            />
            <div className="pt-2 border-t border-gray-100">
              <button onClick={handleSaveAI}
                className="px-5 py-2.5 bg-[#1e2a4a] hover:bg-[#2d3f6b] text-white text-xs font-bold rounded-xl border-none cursor-pointer shadow-sm">
                💾 Simpan Urutan Rotasi AI
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STT TAB ──────────────────────────────────────────────────────── */}
      {activeTab === 'stt' && (
        <div className="bg-white border border-[#1e2a4a]/12 rounded-3xl p-6 space-y-6">
          <div>
            <h3 className="font-bold text-sm text-[#1e2a4a] mb-1">Speech-to-Text (Transkripsi Audio)</h3>
            <p className="text-xs text-slate-500">Engine pengubah suara dialog dokter-pasien menjadi teks rekap hidup.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">STT Provider</label>
              <select id="api-stt-provider" value={sttProvider} onChange={e => setSttProvider(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none text-slate-800">
                <option value="openai-whisper">OpenAI Whisper (Rekomendasi)</option>
                <option value="google-stt">Google Cloud Speech-to-Text</option>
                <option value="azure-stt">Microsoft Azure Cognitive Voice</option>
                <option value="groq-whisper">Groq Whisper (Gratis & Cepat)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">Bahasa Target</label>
              <select id="api-stt-lang" value={sttLang} onChange={e => setSttLang(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none text-slate-800">
                <option value="id">Bahasa Indonesia</option>
                <option value="id,en">Bilingual (Indonesia / Inggris)</option>
                <option value="en">English Only</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <MultiKeyInput
                keys={sttKeys}
                onChange={setSttKeys}
                label="API Key STT"
                placeholder="sk-proj-xxxxxxxxxxxxxxxxxxxxxxxx"
              />
            </div>
          </div>

          {/* Silence Detection Duration */}
          <div className="border border-[#1e2a4a]/10 rounded-2xl p-4 space-y-3 bg-slate-50/60">
            <div className="flex items-center gap-2">
              <span className="text-base">⏱️</span>
              <div>
                <h4 className="font-bold text-xs text-[#1e2a4a]">Deteksi Jeda Diam (Silence Detection)</h4>
                <p className="text-[10px] text-slate-400">Durasi hening setelah bicara berhenti sebelum CENNA mulai memproses. Nilai kecil = responsif, nilai besar = toleran terhadap jeda bicara panjang.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">Durasi Jeda (Desktop)</label>
                <select
                  id="api-stt-silence-ms"
                  value={silenceMs}
                  onChange={e => setSilenceMs(Number(e.target.value))}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs outline-none text-slate-800 cursor-pointer"
                >
                  <option value={1000}>1 detik — Sangat Responsif (percakapan cepat)</option>
                  <option value={1500}>1.5 detik — Cepat</option>
                  <option value={2000}>2 detik — Seimbang ✅ Rekomendasi</option>
                  <option value={2500}>2.5 detik — Standar</option>
                  <option value={3000}>3 detik — Lambat (jeda bicara panjang)</option>
                  <option value={4000}>4 detik — Sangat Lambat (pasien bicara pelan)</option>
                </select>
              </div>
              <div className="px-4 py-3 bg-[#1e2a4a]/5 rounded-xl text-[10px] text-slate-500 leading-relaxed">
                <p>📱 <strong>Mobile</strong> otomatis menggunakan <strong>{Math.max(1000, silenceMs - 500)}ms</strong> (lebih cepat 500ms dari desktop)</p>
                <p className="mt-1">🖥️ <strong>Desktop</strong> menggunakan <strong>{silenceMs}ms</strong></p>
              </div>
            </div>
          </div>

          {/* ElevenLabs TTS Section */}
          <div className="border-t border-gray-100 pt-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-[#1e2a4a]">🎙️ ElevenLabs TTS</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Paling natural, multilingual · Model: eleven_multilingual_v2</p>
              </div>
              <div className="flex items-center gap-2">
                {ttsPrefProvider === 'elevenlabs' && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-bold rounded-full">AKTIF</span>}
                <a href="https://elevenlabs.io" target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:underline">Key ↗</a>
              </div>
            </div>

            {/* API Keys */}
            <div>
              <MultiKeyInput
                keys={elevenLabsKeys}
                onChange={setElevenLabsKeys}
                label="ElevenLabs API Key"
                placeholder="sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              />
            </div>

            {/* Voice Picker */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">Pilih Suara</label>
              <div className="grid grid-cols-3 gap-2">
                {ELEVEN_FREE_VOICES.map(v => (
                  <button
                    key={v.id}
                    onClick={() => setElevenVoiceId(v.id)}
                    className={`p-2.5 rounded-xl border-2 text-left transition cursor-pointer ${
                      elevenVoiceId === v.id
                        ? 'border-[#1e2a4a] bg-[#1e2a4a]/5'
                        : 'border-gray-200 hover:border-[#1e2a4a]/40 bg-white'
                    }`}
                  >
                    <p className="text-[11px] font-bold text-[#1e2a4a] leading-tight">{v.name}</p>
                    <p className="text-[9px] text-slate-400 mt-0.5 leading-tight">{v.desc}</p>
                    {elevenVoiceId === v.id && (
                      <div className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Speed Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">Kecepatan Bicara</label>
                <span className="text-[11px] font-mono font-bold text-[#1e2a4a]">
                  {elevenSpeed === 0.7 ? 'Lambat' : elevenSpeed === 1.0 ? 'Normal' : elevenSpeed === 1.2 ? 'Cepat' : `×${elevenSpeed}`}
                </span>
              </div>
              <input
                type="range" min="0.7" max="1.2" step="0.1"
                value={elevenSpeed}
                onChange={e => setElevenSpeed(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-gray-200 appearance-none cursor-pointer accent-[#1e2a4a] rounded-lg"
              />
              <div className="flex justify-between text-[9px] text-slate-400">
                <span>0.7× Lambat</span><span>1.0× Normal</span><span>1.2× Cepat</span>
              </div>
            </div>

            {/* Preview Text — dikonfigurasi admin */}
            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">Teks Kalimat Preview</label>
              <input
                id="api-tts-preview-text"
                type="text"
                value={ttsPreviewText}
                onChange={e => setTtsPreviewText(e.target.value)}
                placeholder="Contoh: Halo dokter, ada yang bisa Cenna bantu?"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1e2a4a]"
              />
              <p className="text-[9px] text-slate-400">Kalimat yang diputar saat tombol Preview ditekan. Simpan via tombol di bawah.</p>
            </div>

            {/* Preview Button */}
            <button
              disabled={!elevenLabsKeys[0] || elevenPreview === 'loading'}
              onClick={async () => {
                if (!elevenLabsKeys[0]) return;
                setElevenPreview('loading');
                try {
                  const res = await fetch(
                    `https://api.elevenlabs.io/v1/text-to-speech/${elevenVoiceId}/stream`,
                    {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'xi-api-key': elevenLabsKeys[0] },
                      body: JSON.stringify({
                        text: ttsPreviewText.trim() || 'Halo, ada yang bisa saya bantu?',
                        model_id: 'eleven_multilingual_v2',
                        voice_settings: { stability: 0.45, similarity_boost: 0.80, style: 0.20, use_speaker_boost: true, speed: elevenSpeed },
                      }),
                    }
                  );
                  if (!res.ok) { alert('Preview gagal: ' + res.status); setElevenPreview('idle'); return; }
                  const blob = await res.blob();
                  const url  = URL.createObjectURL(blob);
                  const audio = new Audio(url);
                  setElevenPreview('playing');
                  audio.onended = () => { URL.revokeObjectURL(url); setElevenPreview('idle'); };
                  audio.onerror = () => { URL.revokeObjectURL(url); setElevenPreview('idle'); };
                  await audio.play();
                } catch { setElevenPreview('idle'); }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-[#1e2a4a]/8 hover:bg-[#1e2a4a]/15 text-[#1e2a4a] text-xs font-bold rounded-xl border-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {elevenPreview === 'loading' ? '⏳ Memuat...' : elevenPreview === 'playing' ? '🔊 Memutar...' : '▶️ Preview Suara'}
            </button>
          </div>
          {/* Google Cloud TTS */}
          <div className="border-t border-gray-100 pt-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-[#1e2a4a]">🔵 Google Cloud TTS</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Bahasa Indonesia konsisten · Standard & WaveNet neural</p>
              </div>
              <div className="flex items-center gap-2">
                {ttsPrefProvider === 'google' && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-bold rounded-full">AKTIF</span>}
                <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:underline">Key ↗</a>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <MultiKeyInput
                  keys={googleTtsKeys}
                  onChange={setGoogleTtsKeys}
                  label="Google Cloud API Key"
                  placeholder="AIzaSy-xxxxxxxxxxxxxxxx"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">Suara</label>
                <select value={googleTtsVoice} onChange={e => setGoogleTtsVoice(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none text-slate-800">
                  {GOOGLE_TTS_VOICES.map(v => <option key={v.id} value={v.id}>{v.name} — {v.desc}</option>)}
                </select>
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">Kecepatan: <span className="font-mono">{googleTtsRate}×</span></label>
                <input type="range" min="0.7" max="1.3" step="0.1" value={googleTtsRate} onChange={e => setGoogleTtsRate(parseFloat(e.target.value))} className="w-full h-1.5 bg-gray-200 appearance-none cursor-pointer accent-[#1e2a4a] rounded-lg" />
              </div>
            </div>
          </div>

          {/* OpenAI TTS */}
          <div className="border-t border-gray-100 pt-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-[#1e2a4a]">🟢 OpenAI TTS</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">tts-1 / tts-1-hd · Pakai OpenAI API key yang sama</p>
              </div>
              {ttsPrefProvider === 'openai' && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-bold rounded-full">AKTIF</span>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-3">
                <p className="text-[9px] text-slate-400 mb-1">Bisa sama dengan key AI Engine jika OpenAI GPT sudah dikonfigurasi.</p>
                <MultiKeyInput
                  keys={openaiTtsKeys}
                  onChange={setOpenaiTtsKeys}
                  label="OpenAI API Key (TTS)"
                  placeholder="sk-proj-xxxxxxxxxxxxxxxxxxxxxxxx"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">Suara</label>
                <select value={openaiTtsVoice} onChange={e => setOpenaiTtsVoice(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none text-slate-800">
                  {OPENAI_TTS_VOICES.map(v => <option key={v.id} value={v.id}>{v.name} — {v.desc}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">Model</label>
                <select value={openaiTtsModel} onChange={e => setOpenaiTtsModel(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none text-slate-800">
                  <option value="tts-1">tts-1 — Cepat & efisien</option>
                  <option value="tts-1-hd">tts-1-hd — Kualitas tinggi</option>
                </select>
              </div>
            </div>
          </div>

          {/* Azure TTS */}
          <div className="border-t border-gray-100 pt-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-[#1e2a4a]">🔷 Microsoft Azure TTS</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Neural voices id-ID · GadisNeural & ArdiNeural</p>
              </div>
              <div className="flex items-center gap-2">
                {ttsPrefProvider === 'azure' && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-bold rounded-full">AKTIF</span>}
                <a href="https://portal.azure.com" target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:underline">Key ↗</a>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <MultiKeyInput
                  keys={azureTtsKeys}
                  onChange={setAzureTtsKeys}
                  label="Azure Subscription Key"
                  placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">Region</label>
                <select value={azureTtsRegion} onChange={e => setAzureTtsRegion(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none text-slate-800">
                  <option value="southeastasia">Southeast Asia (Singapura)</option>
                  <option value="eastasia">East Asia</option>
                  <option value="australiaeast">Australia East</option>
                  <option value="eastus">East US</option>
                  <option value="westeurope">West Europe</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">Suara Neural</label>
                <select value={azureTtsVoice} onChange={e => setAzureTtsVoice(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none text-slate-800">
                  <option value="id-ID-GadisNeural">Gadis — Perempuan, hangat (rekomendasi)</option>
                  <option value="id-ID-ArdiNeural">Ardi — Laki-laki, profesional</option>
                  <option value="id-ID-Standard-A">Standard A — Perempuan</option>
                  <option value="id-ID-Standard-B">Standard B — Laki-laki</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">Kecepatan: <span className="font-mono">{azureTtsRate}×</span></label>
                <input type="range" min="0.7" max="1.3" step="0.1" value={azureTtsRate} onChange={e => setAzureTtsRate(parseFloat(e.target.value))} className="w-full h-1.5 bg-gray-200 appearance-none cursor-pointer accent-[#1e2a4a] rounded-lg mt-2" />
              </div>
            </div>
          </div>

          {/* TTS Provider Pilihan */}
          <div className="border-t border-gray-100 pt-5 space-y-3">
            <div>
              <h4 className="font-bold text-xs text-[#1e2a4a] mb-1">🔊 Urutan Rotasi TTS CENNA</h4>
              <p className="text-[10px] text-slate-500">Drag untuk atur urutan. Provider #1 digunakan utama. Jika gagal/habis token, sistem otomatis ke urutan berikutnya, lalu Browser TTS sebagai cadangan terakhir.</p>
            </div>
            {/* TTS Drag-Drop Order */}
            <DragOrderList
              label="Urutan Prioritas TTS"
              items={(() => {
                const TTS_META: Record<string, { icon: string; name: string; sub: string }> = {
                  elevenlabs: { icon: '🎤', name: 'ElevenLabs', sub: 'Paling natural · eleven_multilingual_v2' },
                  google:     { icon: '🔵', name: 'Google Cloud TTS', sub: 'Bahasa Indonesia konsisten · WaveNet' },
                  openai:     { icon: '🟢', name: 'OpenAI TTS', sub: 'tts-1 / tts-1-hd · Stabil' },
                  azure:      { icon: '🔷', name: 'Microsoft Azure TTS', sub: 'Neural voices id-ID · GadisNeural' },
                  browser:    { icon: '🌐', name: 'Browser TTS', sub: 'Gratis · Tidak perlu API key' },
                };
                const hasKeyMap: Record<string, boolean> = {
                  elevenlabs: elevenLabsKeys.some(k => k.trim()),
                  google:     googleTtsKeys.some(k => k.trim()),
                  openai:     openaiTtsKeys.some(k => k.trim()),
                  azure:      azureTtsKeys.some(k => k.trim()),
                  browser:    true,
                };
                return ttsOrder.map(id => ({
                  id,
                  icon: TTS_META[id]?.icon || '🔊',
                  name: TTS_META[id]?.name || id,
                  sub:  TTS_META[id]?.sub,
                  hasKey: hasKeyMap[id] ?? false,
                }));
              })()}
              onReorder={newOrder => {
                const newIds = newOrder.map(i => i.id);
                setTtsOrder(newIds);
                // Sync ttsPrefProvider ke item #1
                setTtsPrefProvider(newIds[0] || '');
              }}
              badge={item => (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {item.id === ttsOrder[0] && (
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-bold rounded-full">UTAMA</span>
                  )}
                  {item.id !== 'browser' && (
                    <span className={`w-2 h-2 rounded-full ${item.hasKey ? 'bg-emerald-400' : 'bg-gray-300'}`}
                      title={item.hasKey ? 'Key tersimpan' : 'Belum ada key'} />
                  )}
                </div>
              )}
            />
          </div>

          <div className="pt-4 border-t border-gray-100">
            <button id="btn-save-stt" onClick={handleSaveSTT}
              className="px-6 py-3 bg-[#1e2a4a] hover:bg-[#2d3f6b] text-white text-xs font-bold rounded-xl border-none cursor-pointer shadow-md">
              💾 Simpan Semua STT/TTS Config
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { getSupabaseClient, addLocalLog, sbSetSetting, sbGetSetting } from '../lib/supabase';
import { ELEVEN_FREE_VOICES } from './LandingPage';

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
];

// ─── In-memory cache untuk AI config (agar tidak hit DB tiap panggilan) ────────
let _aiConfigCache: {
  providerId: string;
  apiKeys: Record<string, string>;
  model: string;
  temperature: number;
  maxTokens: number;
} | null = null;

export function clearAiConfigCache() {
  _aiConfigCache = null;
}

export async function loadAiConfigFromDb(): Promise<typeof _aiConfigCache> {
  if (_aiConfigCache) return _aiConfigCache;

  const dbAiConfig = await sbGetSetting<{
    provider: string; model: string; temperature: number; maxTokens: number;
  }>('api_ai_config');

  const providerId = dbAiConfig?.provider || 'anthropic';
  const provider   = AI_PROVIDERS.find(p => p.id === providerId) || AI_PROVIDERS[0];

  // Baca semua API key per-provider dari DB
  const apiKeys: Record<string, string> = {};
  await Promise.all(
    AI_PROVIDERS.map(async p => {
      const k = await sbGetSetting<string>(`AI_KEY_${p.id.toUpperCase()}`);
      if (k) apiKeys[p.id] = k;
    })
  );

  _aiConfigCache = {
    providerId,
    apiKeys,
    model:       dbAiConfig?.model       ?? provider.defaultModel,
    temperature: dbAiConfig?.temperature ?? 0.3,
    maxTokens:   dbAiConfig?.maxTokens   ?? 2048,
  };
  return _aiConfigCache;
}

// ─── Exported helper: call active AI provider ────────────────────────────────
export async function callActiveAI(
  systemPrompt: string,
  userMsg: string,
): Promise<string> {
  const cfg      = await loadAiConfigFromDb();
  const provider = AI_PROVIDERS.find(p => p.id === cfg!.providerId) || AI_PROVIDERS[0];
  const apiKey   = cfg!.apiKeys[provider.id] || '';

  if (!apiKey) throw new Error(`API Key untuk ${provider.name} belum dikonfigurasi.`);
  return provider.callFn(apiKey, cfg!.model, systemPrompt, userMsg, cfg!.temperature, cfg!.maxTokens);
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
  const [activeProvider, setActiveProvider] = useState('anthropic');
  const [providerKeys, setProviderKeys] = useState<Record<string, string>>({});
  const [aiModel, setAiModel] = useState('claude-sonnet-4-6');
  const [aiTemp, setAiTemp] = useState(0.3);
  const [aiMaxTokens, setAiMaxTokens] = useState(2048);
  const [aiTestStatus, setAiTestStatus] = useState<Record<string, 'idle' | 'testing' | 'ok' | 'error'>>({});

  // STT
  const [sttKey, setSttKey] = useState('');
  const [sttProvider, setSttProvider] = useState('openai-whisper');
  const [sttLang, setSttLang] = useState('id');
  const [elevenLabsKey, setElevenLabsKey] = useState('');
  const [elevenVoiceId, setElevenVoiceId] = useState('cgSgspJ2msm6clMCkdW9');
  const [elevenSpeed,   setElevenSpeed]   = useState(1.0);
  const [elevenPreview, setElevenPreview] = useState<'idle'|'loading'|'playing'>('idle');

  const currentProviderDef = AI_PROVIDERS.find(p => p.id === activeProvider) || AI_PROVIDERS[0];

  useEffect(() => {
    async function loadSettings() {
      // ── Supabase bootstrap: baca dari ENV vars, fallback ke DB setting, lalu default ──
      const envUrl  = import.meta.env.VITE_SUPABASE_URL  as string | undefined;
      const envAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
      const dbSupaConfig = await sbGetSetting<{ url: string; anonKey: string; ref: string }>('supabase_bootstrap');
      setSupabaseUrl(envUrl || dbSupaConfig?.url || 'https://vtwdgdbxgdmrravpdeix.supabase.co');
      setSupabaseAnonKey(envAnon || dbSupaConfig?.anonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0d2RnZGJ4Z2RtcnJhdnBkZWl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1MzQ1NjYsImV4cCI6MjA5NTExMDU2Nn0._nJBT6q1wCkvjcYjsRYN8bKDMeeqOfV1WlQxQYT0DJk');
      setSupabaseRef(dbSupaConfig?.ref || 'vtwdgdbxgdmrravpdeix');

      // ── AI Config: 100% dari Supabase DB ──
      const dbAiConfig = await sbGetSetting<{
        provider: string; model: string; temperature: number; maxTokens: number;
      }>('api_ai_config');
      const savedProvider = dbAiConfig?.provider || 'anthropic';
      setActiveProvider(savedProvider);

      // Load semua API key per-provider dari DB
      const keys: Record<string, string> = {};
      await Promise.all(
        AI_PROVIDERS.map(async p => {
          const k = await sbGetSetting<string>(`AI_KEY_${p.id.toUpperCase()}`);
          keys[p.id] = k || '';
        })
      );
      setProviderKeys(keys);

      if (dbAiConfig) {
        setAiModel(dbAiConfig.model || AI_PROVIDERS.find(p => p.id === savedProvider)?.defaultModel || 'claude-sonnet-4-6');
        setAiTemp(dbAiConfig.temperature ?? 0.3);
        setAiMaxTokens(dbAiConfig.maxTokens ?? 2048);
      } else {
        setAiModel(AI_PROVIDERS.find(p => p.id === savedProvider)?.defaultModel || 'claude-sonnet-4-6');
        setAiTemp(0.3);
        setAiMaxTokens(2048);
      }

      // ── STT Config: 100% dari Supabase DB ──
      const dbSttConfig = await sbGetSetting<{ provider: string; lang: string; sttKey: string }>('api_stt_config');
      setSttProvider(dbSttConfig?.provider || 'openai-whisper');
      setSttLang(dbSttConfig?.lang || 'id');
      setSttKey(dbSttConfig?.sttKey || '');

      // ── ElevenLabs: dari DB ──
      setElevenLabsKey((await sbGetSetting<string>('ELEVENLABS_API_KEY')) || '');
      setElevenVoiceId((await sbGetSetting<string>('ELEVEN_VOICE_ID')) || 'cgSgspJ2msm6clMCkdW9');
      setElevenSpeed((await sbGetSetting<number>('ELEVEN_SPEED')) ?? 1.0);
    }
    loadSettings();
  }, []);

  // Saat provider berubah, update model ke default provider tersebut
  const handleProviderChange = (pid: string) => {
    setActiveProvider(pid);
    const def = AI_PROVIDERS.find(p => p.id === pid);
    if (def) setAiModel(def.defaultModel);
  };

  const handleSaveSupabase = async () => {
    if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
      alert('Supabase Project URL dan Anon Key wajib diisi.');
      return;
    }
    // Simpan ke DB (bukan localStorage). ENV vars tetap prioritas utama saat runtime.
    await sbSetSetting('supabase_bootstrap', {
      url: supabaseUrl.trim(),
      anonKey: supabaseAnonKey.trim(),
      ref: supabaseRef.trim(),
      updatedAt: new Date().toISOString(),
    });
    // Hapus sisa credentials lama dari localStorage jika ada
    localStorage.removeItem('SUPABASE_URL');
    localStorage.removeItem('SUPABASE_ANON_KEY');
    localStorage.removeItem('SUPABASE_REF');
    setDbStatus('connected');
    addLocalLog('success', 'SYSTEM', 'Supabase credentials saved to database.');
    alert('Konfigurasi Supabase berhasil disimpan ke database! (bukan localStorage)');
    onSettingsSaved();
  };

  const handleTestDatabase = async () => {
    if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
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
      if (res.ok || res.status === 200) {
        setDbStatus('connected');
        alert(`Koneksi Supabase Sukses! Latency: ${latency}ms`);
      } else {
        setDbStatus('error');
        setDbError(`Status: ${res.status}`);
      }
    } catch (e: any) {
      setDbStatus('error');
      setDbError(e.message);
    }
  };

  const handleSaveAI = async () => {
    const key = providerKeys[activeProvider] || '';
    if (!key.trim()) {
      alert(`${currentProviderDef.name} API Key wajib diisi.`);
      return;
    }
    try {
      // Simpan API key provider ini ke DB
      await sbSetSetting(`AI_KEY_${activeProvider.toUpperCase()}`, key.trim());
      // Simpan konfigurasi AI aktif ke DB
      await sbSetSetting('api_ai_config', {
        provider: activeProvider,
        model: aiModel,
        temperature: aiTemp,
        maxTokens: aiMaxTokens,
        keyConfigured: true,
        updatedAt: new Date().toISOString(),
      });
      // Invalidasi cache in-memory agar callActiveAI baca ulang dari DB
      clearAiConfigCache();
      addLocalLog('success', 'SYSTEM', `AI Engine diubah ke ${currentProviderDef.name} — ${aiModel}.`);
      alert(`✅ Konfigurasi ${currentProviderDef.name} berhasil disimpan ke database!`);
    } catch (e: any) {
      console.error('[handleSaveAI] Error:', e);
      alert(`❌ Gagal menyimpan ke database!\n\n${e.message}\n\nKemungkinan RLS policy tabel app_settings tidak mengizinkan INSERT/UPDATE. Jalankan SQL ini di Supabase Dashboard:\n\nCREATE POLICY \"allow_auth_write\" ON app_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);\nCREATE POLICY \"allow_anon_read\" ON app_settings FOR SELECT TO anon USING (true);`);
    }
  };

  const handleTestAI = async (pid: string) => {
    const pdef = AI_PROVIDERS.find(p => p.id === pid)!;
    const key = providerKeys[pid] || '';
    if (!key) { alert(`Isi API Key ${pdef.name} terlebih dahulu.`); return; }
    setAiTestStatus(prev => ({ ...prev, [pid]: 'testing' }));
    try {
      // Gunakan prompt lebih panjang & jelas agar tidak dipotong
      const result = await pdef.callFn(
        key,
        pdef.defaultModel,
        'Kamu adalah asisten klinis CENNA AI. Jawab singkat sesuai instruksi.',
        'Balas dengan tepat teks ini tanpa perubahan: CENNA-CONNECTED',
        0.1,
        50, // minimal 50 token agar tidak terpotong
      );
      if (result && result.length > 0) {
        setAiTestStatus(prev => ({ ...prev, [pid]: 'ok' }));
        alert(`✅ ${pdef.name} terhubung!\nResponse: "${result.trim().substring(0, 80)}"`);
      } else {
        throw new Error('Respons kosong dari provider');
      }
    } catch (e: any) {
      setAiTestStatus(prev => ({ ...prev, [pid]: 'error' }));
      alert(`❌ Koneksi ${pdef.name} gagal:\n${e.message}`);
    }
  };

  const handleSaveSTT = async () => {
    try {
      await sbSetSetting('api_stt_config', {
        provider: sttProvider,
        lang: sttLang,
        sttKey: sttKey.trim(),
        keyConfigured: !!sttKey.trim(),
        updatedAt: new Date().toISOString(),
      });
      await sbSetSetting('ELEVENLABS_API_KEY', elevenLabsKey.trim());
      await sbSetSetting('ELEVEN_VOICE_ID', elevenVoiceId);
      await sbSetSetting('ELEVEN_SPEED', elevenSpeed);
      addLocalLog('success', 'SYSTEM', 'STT config updated.');
      alert('✅ Konfigurasi Speech-to-Text berhasil disimpan ke database!');
    } catch (e: any) {
      console.error('[handleSaveSTT] Error:', e);
      alert(`❌ Gagal menyimpan STT config!\n\n${e.message}`);
    }
  };

  const handleClearDbConfig = async () => {
    if (confirm('Hapus seluruh konfigurasi Supabase tersimpan?')) {
      await sbSetSetting('supabase_bootstrap', null);
      // Bersihkan localStorage lama juga
      localStorage.removeItem('SUPABASE_URL');
      localStorage.removeItem('SUPABASE_ANON_KEY');
      localStorage.removeItem('SUPABASE_REF');
      setSupabaseUrl(''); setSupabaseAnonKey(''); setSupabaseRef('');
      setDbStatus('disconnected');
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
                const hasKey = !!(providerKeys[p.id] || '').trim();
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
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                  {currentProviderDef.keyLabel}
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={providerKeys[activeProvider] || ''}
                    onChange={e => setProviderKeys(prev => ({ ...prev, [activeProvider]: e.target.value }))}
                    placeholder={currentProviderDef.keyPlaceholder}
                    className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono outline-none focus:border-[#1e2a4a]"
                  />
                  <button onClick={() => handleTestAI(activeProvider)}
                    disabled={aiTestStatus[activeProvider] === 'testing'}
                    className="px-4 py-2 border border-[#1e2a4a]/25 text-[#1e2a4a] text-xs font-bold rounded-xl bg-transparent cursor-pointer whitespace-nowrap hover:bg-slate-50 disabled:opacity-50">
                    {aiTestStatus[activeProvider] === 'testing' ? '⏳' : '🔌 Test'}
                  </button>
                </div>
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
                const hasKey = !!(providerKeys[p.id] || '').trim();
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
            <div className="md:col-span-2 space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">API Key STT</label>
              <input id="api-stt-key" type="password" value={sttKey} onChange={e => setSttKey(e.target.value)}
                placeholder="sk-proj-xxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono outline-none focus:border-[#1e2a4a]" />
            </div>
          </div>

          {/* ElevenLabs TTS Section */}
          <div className="border-t border-gray-100 pt-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-[#1e2a4a]">🎙️ ElevenLabs TTS — Suara Cenna</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Free-tier voices · Model: eleven_multilingual_v2</p>
              </div>
              <a href="https://elevenlabs.io" target="_blank" rel="noreferrer"
                className="text-[10px] text-blue-500 hover:underline">Dapatkan Key ↗</a>
            </div>

            {/* API Key */}
            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">ElevenLabs API Key</label>
              <div className="flex gap-2 items-center">
                <input
                  id="api-elevenlabs-key"
                  type="password"
                  value={elevenLabsKey}
                  onChange={e => setElevenLabsKey(e.target.value)}
                  placeholder="sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono outline-none focus:border-[#1e2a4a]"
                />
                {elevenLabsKey && (
                  <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-bold whitespace-nowrap">✓ Key ada</span>
                )}
              </div>
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

            {/* Preview Button */}
            <button
              disabled={!elevenLabsKey || elevenPreview === 'loading'}
              onClick={async () => {
                if (!elevenLabsKey) return;
                setElevenPreview('loading');
                try {
                  const res = await fetch(
                    `https://api.elevenlabs.io/v1/text-to-speech/${elevenVoiceId}/stream`,
                    {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'xi-api-key': elevenLabsKey },
                      body: JSON.stringify({
                        text: 'Halo dokter, ada yang bisa Cenna bantu?',
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
          <div className="pt-4 border-t border-gray-100">
            <button id="btn-save-stt" onClick={handleSaveSTT}
              className="px-6 py-3 bg-[#1e2a4a] hover:bg-[#2d3f6b] text-white text-xs font-bold rounded-xl border-none cursor-pointer shadow-md">
              💾 Simpan STT Config
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

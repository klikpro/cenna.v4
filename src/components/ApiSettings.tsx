/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { getSupabaseClient, addLocalLog, sbSetSetting, sbGetSetting } from '../lib/supabase';

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
      { value: 'gpt-4o',          label: 'GPT-4o — Multimodal, Sangat Akurat' },
      { value: 'gpt-4o-mini',     label: 'GPT-4o Mini — Cepat & Hemat' },
      { value: 'o3-mini',         label: 'o3-mini — Reasoning Mendalam' },
    ],
    defaultModel: 'gpt-4o',
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
      { value: 'gemini-3.5-flash',        label: 'Gemini 3.5 Flash — Terbaru, Agentic & Coding (Default)' },
      { value: 'gemini-3-flash',           label: 'Gemini 3 Flash — Frontier Intelligence, Cepat & Efisien' },
      { value: 'gemini-2.5-pro',           label: 'Gemini 2.5 Pro — Konteks Panjang 1M Token, Paling Akurat' },
      { value: 'gemini-2.5-flash',         label: 'Gemini 2.5 Flash — Stabil & Production-Ready' },
      { value: 'gemini-2.5-flash-lite',    label: 'Gemini 2.5 Flash-Lite — Ultra Hemat & Cepat' },
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
          generationConfig: { temperature: temp, maxOutputTokens: maxTokens },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data));
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
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
      { value: 'mistral-large-latest',   label: 'Mistral Large — Terbaik untuk Medis' },
      { value: 'mistral-medium-latest',  label: 'Mistral Medium — Seimbang' },
      { value: 'open-mistral-nemo',      label: 'Mistral Nemo — Open Source Ringan' },
    ],
    defaultModel: 'mistral-large-latest',
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
    name: 'Groq (LLaMA/Mixtral)',
    icon: '⚡',
    keyLabel: 'Groq API Key',
    keyPlaceholder: 'gsk_xxxxxxxxxxxxxxxxxxxxxxxxxx',
    docsUrl: 'https://console.groq.com',
    models: [
      { value: 'llama-3.3-70b-versatile',   label: 'LLaMA 3.3 70B — Open Source Terbaik' },
      { value: 'llama-3.1-8b-instant',      label: 'LLaMA 3.1 8B — Ultra Cepat (Gratis)' },
      { value: 'mixtral-8x7b-32768',        label: 'Mixtral 8x7B — MoE 32K Context' },
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
      { value: 'deepseek-chat',       label: 'DeepSeek Chat V3 — Sangat Hemat & Akurat' },
      { value: 'deepseek-reasoner',   label: 'DeepSeek Reasoner R1 — Logika Mendalam' },
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

// ─── Exported helper: call active AI provider ────────────────────────────────
export async function callActiveAI(
  systemPrompt: string,
  userMsg: string,
): Promise<string> {
  const providerId = localStorage.getItem('AI_PROVIDER') || 'anthropic';
  const provider = AI_PROVIDERS.find(p => p.id === providerId) || AI_PROVIDERS[0];
  const apiKey = localStorage.getItem(`AI_KEY_${providerId.toUpperCase()}`) || '';
  const model = localStorage.getItem('AI_MODEL') || provider.defaultModel;
  const temp = parseFloat(localStorage.getItem('AI_TEMPERATURE') || '0.3');
  const maxTokens = parseInt(localStorage.getItem('AI_MAX_TOKENS') || '2048');

  if (!apiKey) throw new Error(`API Key untuk ${provider.name} belum dikonfigurasi.`);
  return provider.callFn(apiKey, model, systemPrompt, userMsg, temp, maxTokens);
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

  const currentProviderDef = AI_PROVIDERS.find(p => p.id === activeProvider) || AI_PROVIDERS[0];

  useEffect(() => {
    async function loadSettings() {
      setSupabaseUrl(localStorage.getItem('SUPABASE_URL') || 'https://vtwdgdbxgdmrravpdeix.supabase.co');
      setSupabaseAnonKey(localStorage.getItem('SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0d2RnZGJ4Z2RtcnJhdnBkZWl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1MzQ1NjYsImV4cCI6MjA5NTExMDU2Nn0._nJBT6q1wCkvjcYjsRYN8bKDMeeqOfV1WlQxQYT0DJk');
      setSupabaseRef(localStorage.getItem('SUPABASE_REF') || 'vtwdgdbxgdmrravpdeix');

      const savedProvider = localStorage.getItem('AI_PROVIDER') || 'anthropic';
      setActiveProvider(savedProvider);

      // Load semua keys per provider
      const keys: Record<string, string> = {};
      AI_PROVIDERS.forEach(p => {
        keys[p.id] = localStorage.getItem(`AI_KEY_${p.id.toUpperCase()}`) || '';
      });
      // Backward compat: jika ada ANTHROPIC_API_KEY lama
      if (!keys['anthropic']) keys['anthropic'] = localStorage.getItem('ANTHROPIC_API_KEY') || '';
      setProviderKeys(keys);

      const dbAiConfig = await sbGetSetting<{ model: string; temperature: number; maxTokens: number }>('api_ai_config');
      if (dbAiConfig) {
        setAiModel(dbAiConfig.model || AI_PROVIDERS.find(p => p.id === savedProvider)?.defaultModel || 'claude-sonnet-4-6');
        setAiTemp(dbAiConfig.temperature ?? 0.3);
        setAiMaxTokens(dbAiConfig.maxTokens ?? 2048);
      } else {
        setAiModel(localStorage.getItem('AI_MODEL') || AI_PROVIDERS.find(p => p.id === savedProvider)?.defaultModel || 'claude-sonnet-4-6');
        setAiTemp(parseFloat(localStorage.getItem('AI_TEMPERATURE') || '0.3'));
        setAiMaxTokens(parseInt(localStorage.getItem('AI_MAX_TOKENS') || '2048'));
      }

      const dbSttConfig = await sbGetSetting<{ provider: string; lang: string }>('api_stt_config');
      if (dbSttConfig) {
        setSttProvider(dbSttConfig.provider || 'openai-whisper');
        setSttLang(dbSttConfig.lang || 'id');
      } else {
        setSttProvider(localStorage.getItem('STT_PROVIDER') || 'openai-whisper');
        setSttLang(localStorage.getItem('STT_LANG') || 'id');
      }
      setSttKey(localStorage.getItem('STT_API_KEY') || '');
    }
    loadSettings();
  }, []);

  // Saat provider berubah, update model ke default provider tersebut
  const handleProviderChange = (pid: string) => {
    setActiveProvider(pid);
    const def = AI_PROVIDERS.find(p => p.id === pid);
    if (def) setAiModel(def.defaultModel);
  };

  const handleSaveSupabase = () => {
    if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
      alert('Supabase Project URL dan Anon Key wajib diisi.');
      return;
    }
    localStorage.setItem('SUPABASE_URL', supabaseUrl.trim());
    localStorage.setItem('SUPABASE_ANON_KEY', supabaseAnonKey.trim());
    localStorage.setItem('SUPABASE_REF', supabaseRef.trim());
    setDbStatus('connected');
    addLocalLog('success', 'SYSTEM', 'Supabase credentials updated locally.');
    alert('Konfigurasi Supabase database berhasil disimpan!');
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
    // Simpan key aktif ke localStorage per-provider
    localStorage.setItem(`AI_KEY_${activeProvider.toUpperCase()}`, key.trim());
    // Backward compat untuk Anthropic
    if (activeProvider === 'anthropic') localStorage.setItem('ANTHROPIC_API_KEY', key.trim());
    localStorage.setItem('AI_PROVIDER', activeProvider);
    localStorage.setItem('AI_MODEL', aiModel);
    localStorage.setItem('AI_TEMPERATURE', aiTemp.toString());
    localStorage.setItem('AI_MAX_TOKENS', aiMaxTokens.toString());

    await sbSetSetting('api_ai_config', {
      provider: activeProvider,
      model: aiModel,
      temperature: aiTemp,
      maxTokens: aiMaxTokens,
      keyConfigured: true,
      updatedAt: new Date().toISOString(),
    });
    addLocalLog('success', 'SYSTEM', `AI Engine diubah ke ${currentProviderDef.name} — ${aiModel}.`);
    alert(`Konfigurasi ${currentProviderDef.name} berhasil disimpan sebagai AI Engine aktif!`);
  };

  const handleTestAI = async (pid: string) => {
    const pdef = AI_PROVIDERS.find(p => p.id === pid)!;
    const key = providerKeys[pid] || '';
    if (!key) { alert(`Isi API Key ${pdef.name} terlebih dahulu.`); return; }
    setAiTestStatus(prev => ({ ...prev, [pid]: 'testing' }));
    try {
      const result = await pdef.callFn(
        key,
        pdef.defaultModel,
        'Kamu adalah asisten medis singkat.',
        'Balas hanya dengan: "CENNA OK"',
        0.1,
        20,
      );
      if (result.includes('CENNA') || result.length > 0) {
        setAiTestStatus(prev => ({ ...prev, [pid]: 'ok' }));
        alert(`✅ ${pdef.name} terhubung! Response: "${result.trim()}"`);
      } else {
        throw new Error('Respons kosong');
      }
    } catch (e: any) {
      setAiTestStatus(prev => ({ ...prev, [pid]: 'error' }));
      alert(`❌ Gagal: ${e.message}`);
    }
  };

  const handleSaveSTT = async () => {
    localStorage.setItem('STT_API_KEY', sttKey.trim());
    localStorage.setItem('STT_PROVIDER', sttProvider);
    localStorage.setItem('STT_LANG', sttLang);
    await sbSetSetting('api_stt_config', {
      provider: sttProvider,
      lang: sttLang,
      keyConfigured: !!sttKey.trim(),
      updatedAt: new Date().toISOString(),
    });
    addLocalLog('success', 'SYSTEM', 'STT config updated.');
    alert('Konfigurasi Speech-to-Text berhasil disimpan!');
  };

  const handleClearDbConfig = () => {
    if (confirm('Hapus seluruh konfigurasi Supabase?')) {
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

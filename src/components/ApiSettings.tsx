/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { getSupabaseClient, addLocalLog } from '../lib/supabase';

interface ApiSettingsProps {
  onSettingsSaved: () => void;
}

export default function ApiSettings({ onSettingsSaved }: ApiSettingsProps) {
  const [activeTab, setActiveTab] = useState<'database' | 'ai' | 'stt'>('database');

  // Supabase keys
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [supabaseRef, setSupabaseRef] = useState('');
  const [dbStatus, setDbStatus] = useState<'disconnected' | 'testing' | 'connected' | 'error'>('disconnected');
  const [dbError, setDbError] = useState<string | null>(null);

  // Anthropic config
  const [anthropicKey, setAnthropicKey] = useState('');
  const [aiModel, setAiModel] = useState('claude-sonnet-4-6');
  const [aiTemp, setAiTemp] = useState(0.3);
  const [aiMaxTokens, setAiMaxTokens] = useState(2048);
  const [aiStatus, setAiStatus] = useState<'disconnected' | 'testing' | 'connected'>('disconnected');

  // STT Config
  const [sttKey, setSttKey] = useState('');
  const [sttProvider, setSttProvider] = useState('openai-whisper');
  const [sttLang, setSttLang] = useState('id');

  useEffect(() => {
    setSupabaseUrl(localStorage.getItem('SUPABASE_URL') || '');
    setSupabaseAnonKey(localStorage.getItem('SUPABASE_ANON_KEY') || '');
    setSupabaseRef(localStorage.getItem('SUPABASE_REF') || '');
    setAnthropicKey(localStorage.getItem('ANTHROPIC_API_KEY') || '');
    setAiModel(localStorage.getItem('AI_MODEL') || 'claude-sonnet-4-6');
    setAiTemp(parseFloat(localStorage.getItem('AI_TEMPERATURE') || '0.3'));
    setAiMaxTokens(parseInt(localStorage.getItem('AI_MAX_TOKENS') || '2048'));
    setSttKey(localStorage.getItem('STT_API_KEY') || '');
    setSttProvider(localStorage.getItem('STT_PROVIDER') || 'openai-whisper');
    setSttLang(localStorage.getItem('STT_LANG') || 'id');
  }, []);

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
      alert('Isi URL dan Key terlebih dahulu sebelum mengetes koneksi.');
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
        setDbError(`Panggilan gagal dengan kode status: ${res.status}`);
      }
    } catch (e: any) {
      setDbStatus('error');
      setDbError(e.message || 'Koneksi gagal fokal.');
    }
  };

  const handleSaveAI = () => {
    if (!anthropicKey.trim()) {
      alert('Anthropic Claude API Key wajib diisi.');
      return;
    }
    localStorage.setItem('ANTHROPIC_API_KEY', anthropicKey.trim());
    localStorage.setItem('AI_MODEL', aiModel);
    localStorage.setItem('AI_TEMPERATURE', aiTemp.toString());
    localStorage.setItem('AI_MAX_TOKENS', aiMaxTokens.toString());
    setAiStatus('connected');
    addLocalLog('success', 'SYSTEM', 'Anthropic Claude AI API Key updated.');
    alert('Aturan Credentials AI Engine Claude berhasil disimpan!');
  };

  const handleSaveSTT = () => {
    localStorage.setItem('STT_API_KEY', sttKey.trim());
    localStorage.setItem('STT_PROVIDER', sttProvider);
    localStorage.setItem('STT_LANG', sttLang);
    addLocalLog('success', 'SYSTEM', 'OpenAI Whisper key updated.');
    alert('Konfigurasi Speech-to-Text berhasil disimpan!');
  };

  const handleClearDbConfig = () => {
    if (confirm('Hapus seluruh konfigurasi simpanan Supabase?')) {
      localStorage.removeItem('SUPABASE_URL');
      localStorage.removeItem('SUPABASE_ANON_KEY');
      localStorage.removeItem('SUPABASE_REF');
      setSupabaseUrl('');
      setSupabaseAnonKey('');
      setSupabaseRef('');
      setDbStatus('disconnected');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex border-b border-[#1e2a4a]/12 gap-1 bg-[#1e2a4a]/5 p-1 rounded-xl">
        <button
          id="btn-tab-api-db"
          onClick={() => setActiveTab('database')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition border-none cursor-pointer ${
            activeTab === 'database' ? 'bg-white text-[#1e2a4a] shadow-sm' : 'text-[#1e2a4a]/50 bg-transparent'
          }`}
        >
          🗄️ Supabase Database
        </button>
        <button
          id="btn-tab-api-ai"
          onClick={() => setActiveTab('ai')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition border-none cursor-pointer ${
            activeTab === 'ai' ? 'bg-white text-[#1e2a4a] shadow-sm' : 'text-[#1e2a4a]/50 bg-transparent'
          }`}
        >
          🤖 AI Engine API
        </button>
        <button
          id="btn-tab-api-stt"
          onClick={() => setActiveTab('stt')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition border-none cursor-pointer ${
            activeTab === 'stt' ? 'bg-white text-[#1e2a4a] shadow-sm' : 'text-[#1e2a4a]/50 bg-transparent'
          }`}
        >
          🎤 Speech-to-Text
        </button>
      </div>

      {activeTab === 'database' && (
        <div className="bg-white border border-[#1e2a4a]/12 rounded-3xl p-6 space-y-6">
          <div className="flex gap-4 justify-between items-start flex-wrap">
            <div>
              <h3 className="font-bold text-sm text-[#1e2a4a] mb-1">Supabase Database Integration</h3>
              <p className="text-xs text-slate-500">Hubungkan pangkalan data instrumen klinis relasional Anda secara langsung.</p>
            </div>
            <span className={`px-3 py-1 rounded-full font-bold text-[10px] ${
              dbStatus === 'connected' ? 'bg-emerald-500/10 text-[#10b981]' :
              dbStatus === 'testing' ? 'bg-amber-500/10 text-amber-600 animate-pulse' : 'bg-gray-100 text-gray-400'
            }`}>
              {dbStatus === 'connected' ? '● Terhubung' : dbStatus === 'testing' ? '⏳ Menguji...' : '◯ Belum Terhubung'}
            </span>
          </div>

          {dbError && (
            <div id="db-error-view" className="p-3 bg-red-400/10 border border-red-500/20 text-red-600 rounded-xl text-xs font-semibold">
              Koneksi gagal fokal: {dbError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                Supabase Project URL
              </label>
              <input
                id="api-supabase-url"
                type="url"
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
                placeholder="https://xxxxxxxxxxxx.supabase.co"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono outline-none focus:border-[#1e2a4a]"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                Project Reference ID (opsional)
              </label>
              <input
                id="api-supabase-ref"
                type="text"
                value={supabaseRef}
                onChange={(e) => setSupabaseRef(e.target.value)}
                placeholder="Xxxxxxxxxxxxx"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono outline-none focus:border-[#1e2a4a]"
              />
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                Anon (Public) API Key
              </label>
              <input
                id="api-supabase-anon"
                type="password"
                value={supabaseAnonKey}
                onChange={(e) => setSupabaseAnonKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI..."
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono outline-none focus:border-[#1e2a4a]"
              />
            </div>
          </div>

          <div className="flex gap-3 border-t border-gray-100 pt-6">
            <button
              id="btn-save-supabase"
              onClick={handleSaveSupabase}
              className="px-6 py-3 bg-[#1e2a4a] hover:bg-[#2d3f6b] text-white text-xs font-bold rounded-xl border-none cursor-pointer"
            >
              💾 Simpan Konfigurasi
            </button>
            <button
              id="btn-test-supabase"
              onClick={handleTestDatabase}
              className="px-5 py-3 border border-[#1e2a4a]/25 hover:border-slate-400 text-[#1e2a4a] text-xs font-bold rounded-xl bg-transparent cursor-pointer"
            >
              🔌 Uji Koneksi
            </button>
            <button
              id="btn-clear-supabase"
              onClick={handleClearDbConfig}
              className="px-4 py-3 bg-red-500/10 hover:bg-red-500/15 text-red-600 text-xs font-bold rounded-xl border-none cursor-pointer ml-auto"
            >
              🗑 Hapus Data
            </button>
          </div>

          {/* SQL database schema block copy text */}
          <div className="border-t border-gray-100 pt-6 space-y-2">
            <h4 className="font-bold text-xs text-[#1e2a4a]">SQL Schema Guide (Supabase SQL Editor)</h4>
            <p className="text-[11px] text-slate-500 leading-normal">Buka tab SQL Query di Dasbor Supabase Anda dan pasta schema berikut:</p>
            <div className="bg-[#0d1a36] text-[#94a8d8] p-4 rounded-xl text-[10px] font-mono whitespace-pre overflow-x-auto h-48 leading-relaxed select-all border border-[#1e2a4a]/12">
{`-- SQL Setup script untuk CENNA database
CREATE TABLE IF NOT EXISTS doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  specialization TEXT,
  clinic TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);`}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'ai' && (
        <div className="bg-white border border-[#1e2a4a]/12 rounded-3xl p-6 space-y-6">
          <div>
            <h3 className="font-bold text-sm text-[#1e2a4a] mb-1">AI Engine Credentials Settings</h3>
            <p className="text-xs text-slate-500">Hubungkan kunci API Anthropic Claude Anda demi menggerakkan penalaran diagnostic hidup.</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                Anthropic Claude API Key
              </label>
              <input
                id="api-anthropic-key"
                type="password"
                value={anthropicKey}
                onChange={(e) => setAnthropicKey(e.target.value)}
                placeholder="sk-ant-api03-xxxxxxxxxxx"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono outline-none focus:border-[#1e2a4a]"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                  Model Terpilih
                </label>
                <select
                  id="api-ai-model-select"
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none text-slate-800"
                >
                  <option value="claude-sonnet-4-6">claude-sonnet-4-6 (Sangat Akurat)</option>
                  <option value="claude-haiku-4-5-20251001">claude-haiku-4-5 (Blazing Fast)</option>
                  <option value="claude-opus-4-6">claude-opus-4-6 (Spesialis Konsultan)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                  Temperature parameter: <span className="font-mono text-xs">{aiTemp}</span>
                </label>
                <input
                  id="api-ai-temp-slider"
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={aiTemp}
                  onChange={(e) => setAiTemp(parseFloat(e.target.value))}
                  className="w-full h-1 bg-gray-200 appearance-none cursor-pointer accent-[#1e2a4a] rounded-lg mt-3"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <button
              id="btn-save-ai-api"
              onClick={handleSaveAI}
              className="px-6 py-3 bg-[#1e2a4a] hover:bg-[#2d3f6b] text-white text-xs font-bold rounded-xl border-none cursor-pointer shadow-md"
            >
              💾 Simpan AI Config
            </button>
          </div>
        </div>
      )}

      {activeTab === 'stt' && (
        <div className="bg-white border border-[#1e2a4a]/12 rounded-3xl p-6 space-y-6">
          <div>
            <h3 className="font-bold text-sm text-[#1e2a4a] mb-1">Speech-to-Text (Transkripsi Audio)</h3>
            <p className="text-xs text-slate-500">Konfigurasi engine pengubah suara dialog fokal dokter-pasien menjadi tulisan rekap hidup.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                STT Provider
              </label>
              <select
                id="api-stt-provider"
                value={sttProvider}
                onChange={(e) => setSttProvider(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none text-slate-800"
              >
                <option value="openai-whisper">OpenAI Whisper (Rekomendasi Utama)</option>
                <option value="google-stt">Google Cloud Speech-to-Text</option>
                <option value="azure-stt">Microsoft Azure Cognitive Voice</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                Bahasa Target Utama
              </label>
              <select
                id="api-stt-lang"
                value={sttLang}
                onChange={(e) => setSttLang(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none text-slate-800"
              >
                <option value="id">Bahasa Indonesia</option>
                <option value="id,en">Bilingual (Indonesia / Inggris)</option>
              </select>
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                Transkripsi API Key (OpenAI / Azure Token)
              </label>
              <input
                id="api-stt-key"
                type="password"
                value={sttKey}
                onChange={(e) => setSttKey(e.target.value)}
                placeholder="sk-proj-xxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono outline-none focus:border-[#1e2a4a]"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <button
              id="btn-save-stt"
              onClick={handleSaveSTT}
              className="px-6 py-3 bg-[#1e2a4a] hover:bg-[#2d3f6b] text-white text-xs font-bold rounded-xl border-none cursor-pointer shadow-md"
            >
              💾 Simpan STT Config
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

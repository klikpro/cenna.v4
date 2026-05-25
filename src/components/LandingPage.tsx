/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * LandingPage v5.2 — Wake-word definitive fix
 *
 * Root causes yang diperbaiki:
 * 1. wakeEnabled diinisialisasi false + getUserMedia async → race condition:
 *    mic granted SETELAH mount, tapi useWakeWord sudah skip start().
 *    Fix: mic permission di-request di dalam hook, bukan di luar.
 * 2. speechSynthesis.onend tidak selalu fire (Chrome bug) → phase stuck di
 *    'speaking'. Fix: fallback timeout 4 detik + cancel sebelum speak.
 * 3. useWakeWord menerima prop `enabled` yang terlambat satu render.
 *    Fix: hook mengelola mic permission sendiri; outer state hanya `phase`.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { sbGetSetting, sbSetSetting, sbSaveSession, DEFAULT_PROMPT_ANAMNESIS, sbGetActiveTemplate } from '../lib/supabase';
import { callActiveAI } from './ApiSettings';
import { ELEVEN_FREE_VOICES, TTS_PROVIDERS, GOOGLE_TTS_VOICES, OPENAI_TTS_VOICES } from './tts-constants';
import type { AnamnesisData, ClinicalConclusion, ConversationTemplate } from '../types';

// Re-export agar komponen lain yang sudah import dari LandingPage tidak perlu diubah
export { ELEVEN_FREE_VOICES, TTS_PROVIDERS, GOOGLE_TTS_VOICES, OPENAI_TTS_VOICES } from './tts-constants';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LandingPageProps {
  onLoginClick: () => void;
}

type OrbPhase = 'idle' | 'speaking' | 'listening' | 'processing' | 'responding' | 'popup';

interface CapturedData {
  transcript: string;
  keluhan:    string[];
  obat:       string[];
  pertanyaan: string[];
  waktu:      string;
  anamnesis?: AnamnesisData;
  conclusion?: ClinicalConclusion | null;
}

// ─── Palet ───────────────────────────────────────────────────────────────────

const PALETTE = {
  navy:  { r: 30,  g: 42,  b: 74  },
  cream: { r: 245, g: 240, b: 232 },
  tan:   { r: 184, g: 168, b: 152 },
};

// ─── Logo ─────────────────────────────────────────────────────────────────────

const CENNA_LOGO = "data:image/png;base64,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";

// ─── Wake-word patterns ───────────────────────────────────────────────────────

/**
 * Normalisasi teks lebih agresif:
 * - lowercase
 * - hapus semua non-latin (strip accent, tanda baca, angka)
 * - collapse spasi ganda
 */
function normalizeText(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')                     // pisahkan accent dari huruf
    .replace(/[\u0300-\u036f]/g, '')      // hapus accent marks
    .replace(/[^a-z ]/g, ' ')            // hapus semua bukan huruf/spasi
    .replace(/\s+/g, ' ')               // collapse spasi ganda
    .trim();
}

const WAKE_PATTERNS = [
  // Variasi 'cenna'
  'hai cenna', 'hei cenna', 'hey cenna', 'hi cenna',
  'hai senna', 'hei senna', 'hey senna', 'hi senna',
  'hai tenna', 'hei tenna', 'hai cena',  'hey cena',
  'hai xena',  'hai zena',  'hai kena',  'hei kena',
  'hei sena',  'hai sen na', 'hai ce na', 'hey se na',
  // Variasi kapitalisasi / spasi yang lolos normalisasi
  'hai sen a', 'hei sen a', 'hey sen a',
  'hai chena', 'hei chena', 'hey chena',
  'hai tsena', 'hai dsena', 'hai nena',
  // STT sering salah dengar "cenna" sebagai kata lain
  'hai sana',  'hei sana',  'hey sana',
  'hai sina',  'hei sina',
  'hai rena',  'hei rena',
  'hai dena',  'hei dena',
  'hai fena',  'hei fena',
  'hai wena',  'hei wena',
  // Tanpa spasi (stream interim)
  'haicenna',  'heicenna',  'hicenna',
  'haisenna',  'heisenna',
];

function matchesWakeWord(raw: string): boolean {
  const t = normalizeText(raw);
  console.log('[Cenna wake] normalizing:', JSON.stringify(raw), '\u2192', JSON.stringify(t));

  // 1. Exact pattern match
  if (WAKE_PATTERNS.some((p) => t.includes(p))) {
    console.log('[Cenna wake] \u2713 MATCHED (pattern) on:', JSON.stringify(t));
    return true;
  }

  // 2. Fuzzy fallback: "hai/hei/hey/hi" + spasi + 4-7 huruf (nama apapun)
  const fuzzy = /\b(hai|hei|hey|hi)\s+[a-z]{4,7}\b/.test(t);
  if (fuzzy) console.log('[Cenna wake] \u2713 MATCHED (fuzzy) on:', JSON.stringify(t));
  else       console.log('[Cenna wake] \u2717 no match for:', JSON.stringify(t));
  return fuzzy;
}

// \u2500\u2500\u2500 Kata penutup sesi (voice trigger untuk akhiri) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
const CLOSING_PATTERNS = [
  'terima kasih cenna', 'terima kasih senna', 'terima kasih kena',
  'makasih cenna', 'makasih senna',
  'cukup cenna', 'cukup senna',
  'selesai cenna', 'selesai senna',
  'stop cenna', 'stop senna',
  'akhiri sesi', 'akhiri konsultasi',
  'terima kasih ya',
];

function matchesClosingWord(raw: string): boolean {
  const t = normalizeText(raw);
  return CLOSING_PATTERNS.some(p => t.includes(p));
}

// \u2500\u2500\u2500 Cache prompt & behavior dari DB \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// Cache di-reset tiap sesi baru (resetAnamnesisState) agar perubahan prompt/behavior
// dari admin dashboard langsung aktif \u2014 tanpa perlu refresh browser.
let _cachedAnamnesisPrompt: string | null = null;
let _cachedAiBehavior: { ddxCount: number; profile: string; ddx: boolean; ebm: boolean } | null = null;

// ─── Template mode state ───────────────────────────────────
// Direset tiap sesi baru (resetAnamnesisState)
let _activeTemplate: ConversationTemplate | null = null;
let _templateStepIndex: number = 0;   // indeks step saat ini
let _templateDone: boolean = false;    // true = semua step habis, fallback ke AI

/** Baca prompt anamnesis dari DB; fallback ke DEFAULT_PROMPT_ANAMNESIS dari supabase.ts */
async function getAnamnesisPrompt(): Promise<string> {
  if (_cachedAnamnesisPrompt) return _cachedAnamnesisPrompt;
  const db = await sbGetSetting<string>('prompt_anamnesis');
  _cachedAnamnesisPrompt = db || DEFAULT_PROMPT_ANAMNESIS;
  console.log('[Cenna AI] Prompt anamnesis loaded from', db ? 'database' : 'default fallback');
  return _cachedAnamnesisPrompt;
}

/** Baca konfigurasi perilaku AI dari DB; fallback ke nilai default */
async function getAiBehavior() {
  if (_cachedAiBehavior) return _cachedAiBehavior;
  const db = await sbGetSetting<{ ddxCount: number; profile: string; ddx: boolean; ebm: boolean }>('ai_behavior');
  _cachedAiBehavior = db || { ddxCount: 3, profile: 'gp', ddx: true, ebm: true };
  console.log('[Cenna AI] AI behavior loaded from', db ? 'database' : 'default fallback');
  return _cachedAiBehavior;
}

// State akumulasi anamnesis lintas ronde dalam satu sesi
let _currentAnamnesis: AnamnesisData = {
  provokasi: '', kualitas: '', radiasi: '', skala: '', waktu: '',
  rpd: '', rpk: '', rps: '', pemfis: '',
  phase: 'gathering', missing_fields: [],
};

function mergeAnamnesis(prev: AnamnesisData, next: Partial<AnamnesisData>): AnamnesisData {
  return {
    provokasi: next.provokasi || prev.provokasi,
    kualitas:  next.kualitas  || prev.kualitas,
    radiasi:   next.radiasi   || prev.radiasi,
    skala:     next.skala     || prev.skala,
    waktu:     next.waktu     || prev.waktu,
    rpd:       next.rpd       || prev.rpd,
    rpk:       next.rpk       || prev.rpk,
    rps:       next.rps       || prev.rps,
    pemfis:    next.pemfis    || prev.pemfis,
    phase:     next.phase     || prev.phase,
    missing_fields: next.missing_fields ?? prev.missing_fields,
  };
}

function resetAnamnesisState() {
  _currentAnamnesis = {
    provokasi: '', kualitas: '', radiasi: '', skala: '', waktu: '',
    rpd: '', rpk: '', rps: '', pemfis: '',
    phase: 'gathering', missing_fields: [],
  };
  _cachedAnamnesisPrompt = null;
  _cachedAiBehavior = null;
  // Reset template state
  _activeTemplate = null;
  _templateStepIndex = 0;
  _templateDone = false;
}

/**
 * Fuzzy match: cek apakah ucapan user cocok dengan trigger text sebuah step.
 * Algoritma: normalkan keduanya, ambil kata signifikan (>3 huruf) dari trigger,
 * jika setidaknya 50% kata tersebut muncul di ucapan user → match.
 * Jika trigger kosong → selalu match (sequential mode).
 */
function fuzzyMatchTrigger(userSpeech: string, triggerText: string): boolean {
  if (!triggerText || !triggerText.trim()) return true; // kosong = sequential, selalu match

  const normalize = (s: string) =>
    s.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')  // hapus accent
      .replace(/[^a-z0-9 ]/g, ' ')      // hanya huruf/angka/spasi
      .replace(/\s+/g, ' ')
      .trim();

  const speech  = normalize(userSpeech);
  const trigger = normalize(triggerText);

  // Kata signifikan dari trigger (panjang > 3 char, bukan stop word pendek)
  const STOP = new Set(['yang', 'dengan', 'dari', 'untuk', 'pada', 'adalah', 'ada', 'dan', 'atau']);
  const words = trigger.split(' ').filter(w => w.length > 3 && !STOP.has(w));

  // Jika tidak ada kata signifikan, coba substring match langsung
  if (words.length === 0) return speech.includes(trigger);

  // Hitung berapa kata trigger yang muncul di ucapan user
  const matched = words.filter(w => speech.includes(w));
  const threshold = Math.max(1, Math.ceil(words.length * 0.5)); // minimal 50%
  const isMatch   = matched.length >= threshold;

  console.log(`[Cenna Template] fuzzy: "${speech.slice(0, 50)}" vs trigger "${trigger.slice(0, 40)}" → ${matched.length}/${words.length} (need ${threshold}) → ${isMatch ? '✓' : '✗'}`);
  return isMatch;
}

async function callCennaAI(transcript: string, history: Array<{ role: 'user'|'assistant'; content: string }>): Promise<{
  voice_response: string;
  keluhan: string[];
  obat: string[];
  pertanyaan: string[];
  red_flags: string[];
  anamnesis: AnamnesisData;
  conclusion: ClinicalConclusion | null;
  session_end: boolean;
}> {
  // Baca prompt & behavior dari DB (di-cache per sesi)
  const systemPrompt = await getAnamnesisPrompt();
  const behavior     = await getAiBehavior();

  // Inject instruksi behavior dari konfigurasi admin ke system prompt
  const behaviorCtx = [
    behavior.ddx    ? `- Sertakan ${behavior.ddxCount} diagnosis banding teratas dengan probabilitas.` : '- Jangan sertakan diagnosis banding.',
    behavior.ebm    ? '- Gunakan pendekatan evidence-based medicine (EBM).' : '',
    behavior.profile === 'specialist' ? '- Berpikir seperti dokter SPESIALIS KONSULTAN.' : '',
    behavior.profile === 'emergency'  ? '- PRIORITASKAN red flag dan tatalaksana emergensi.' : '',
    behavior.profile === 'pediatric'  ? '- Perhatikan dosis dan pertimbangan khusus pasien anak.' : '',
  ].filter(Boolean).join('\n');

  const enrichedPrompt = behaviorCtx
    ? `${systemPrompt}\n\n== INSTRUKSI PERILAKU (dari konfigurasi admin) ==\n${behaviorCtx}`
    : systemPrompt;
  const anamnesisCtx = JSON.stringify(_currentAnamnesis, null, 2);
  const historyContext = history.length > 0
    ? '\n\nKonteks percakapan sebelumnya:\n' +
      history.map(h => `[${h.role === 'user' ? 'Dokter/Pasien' : 'CENNA'}]: ${h.content}`).join('\n')
    : '';

  const raw = await callActiveAI(
    enrichedPrompt,
    `Status anamnesis saat ini:\n${anamnesisCtx}${historyContext}\n\n[Transkrip baru]:\n"${transcript}"\n\nEvaluasi missing_fields di atas. Tanya hanya field yang benar-benar kosong dan paling mengubah probabilitas diagnosis. Berikan conclusion segera jika data sudah cukup.`
  );

  const cleaned = raw
    .replace(/```json|```/gi, '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);

  try {
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
    if (parsed.anamnesis) {
      _currentAnamnesis = mergeAnamnesis(_currentAnamnesis, parsed.anamnesis);
    }
    if (parsed.phase === 'complete') _currentAnamnesis.phase = 'complete';

    const isComplete = parsed.phase === 'complete' || parsed.session_end === true || matchesClosingWord(transcript);

    return {
      voice_response: typeof parsed.voice_response === 'string' && parsed.voice_response.trim()
        ? parsed.voice_response.trim()
        : 'Data sudah dicatat, dokter.',
      keluhan:    Array.isArray(parsed.keluhan)    ? parsed.keluhan    : [],
      obat:       Array.isArray(parsed.obat)       ? parsed.obat       : [],
      pertanyaan: Array.isArray(parsed.pertanyaan) ? parsed.pertanyaan : [],
      red_flags:  Array.isArray(parsed.red_flags)  ? parsed.red_flags  : [],
      anamnesis:  { ..._currentAnamnesis },
      conclusion: parsed.conclusion ?? null,
      session_end: isComplete,
    };
  } catch {
    console.warn('[Cenna AI] JSON parse failed, raw:', cleaned.slice(0, 200));
    return {
      voice_response: 'Data percakapan sudah dicatat, dokter.',
      keluhan: [], obat: [], pertanyaan: [], red_flags: [],
      anamnesis: { ..._currentAnamnesis },
      conclusion: null,
      session_end: matchesClosingWord(transcript),
    };
  }
}

// ─── Deteksi nada tanya ───────────────────────────────────────────────────────

function isQuestion(text: string): boolean {
  const t = text.trim().toLowerCase();
  return (
    t.endsWith('?') ||
    /^(apakah|apa|bagaimana|berapa|kenapa|mengapa|kapan|di mana|siapa)\b/.test(t) ||
    t.includes('ya dok') ||
    t.includes('betul tidak') ||
    t.includes('bisa tidak')
  );
}

// ─── Ekstrak entitas klinis ───────────────────────────────────────────────────

function extractEntities(text: string): Pick<CapturedData, 'keluhan' | 'obat' | 'pertanyaan'> {
  const sentences = text.split(/[.,;!?]+/).map(s => s.trim()).filter(Boolean);

  const keluhanKeywords = ['nyeri', 'sakit', 'pusing', 'mual', 'muntah', 'sesak', 'batuk', 'demam', 'lemas', 'lelah', 'gatal', 'bengkak', 'diare'];
  const obatKeywords    = ['amlodipin', 'metformin', 'paracetamol', 'ibuprofen', 'amoksisilin', 'ranitidin', 'omeprazol', 'bisoprolol', 'captopril', 'atorvastatin', 'mg', 'tablet', 'kapsul', 'sirup'];

  const keluhan:    string[] = [];
  const obat:       string[] = [];
  const pertanyaan: string[] = [];

  sentences.forEach(s => {
    const sl = s.toLowerCase();
    if (isQuestion(s) && s.length > 8) pertanyaan.push(s);
    if (keluhanKeywords.some(k => sl.includes(k))) keluhan.push(s);
    if (obatKeywords.some(k => sl.includes(k)))    obat.push(s);
  });

  return { keluhan, obat, pertanyaan };
}

// ─── ElevenLabs TTS ─────────────────────────────────────────────────────────
//
// Free-tier default voices (tidak perlu plan berbayar):

// ELEVEN_FREE_VOICES, TTS_PROVIDERS, GOOGLE_TTS_VOICES, OPENAI_TTS_VOICES
// sudah diimport & di-re-export dari './tts-constants' di atas — tidak perlu didefinisikan ulang di sini.

/** Pilih suara browser terbaik untuk Bahasa Indonesia */
function getBrowserVoiceID(): SpeechSynthesisVoice | null {
  if (!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  // Prioritas: id-ID > id > ms-ID > fallback pertama
  return (
    voices.find(v => v.lang === 'id-ID') ||
    voices.find(v => v.lang.startsWith('id')) ||
    voices.find(v => v.lang === 'ms-MY') ||
    voices[0] ||
    null
  );
}

/** ElevenLabs TTS */
async function speakElevenLabs(text: string, onEnd: () => void): Promise<boolean> {
  const apiKey =
    (import.meta.env.VITE_ELEVENLABS_API_KEY as string | undefined) ||
    (await sbGetSetting<string>('ELEVENLABS_API_KEY')) || '';
  if (!apiKey) return false;

  const voiceId = (await sbGetSetting<string>('ELEVEN_VOICE_ID')) || 'cgSgspJ2msm6clMCkdW9';
  const speed   = (await sbGetSetting<number>('ELEVEN_SPEED')) ?? 1.0;
  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.45, similarity_boost: 0.80, style: 0.20, use_speaker_boost: true, speed },
        }),
      },
    );
    if (!res.ok) { console.warn('[TTS:EL] error', res.status); return false; }
    const url = URL.createObjectURL(await res.blob());
    const audio = new Audio(url);
    audio.onended = () => { URL.revokeObjectURL(url); onEnd(); };
    audio.onerror = () => { URL.revokeObjectURL(url); onEnd(); };
    await audio.play();
    return true;
  } catch (e) { console.warn('[TTS:EL] fetch error:', e); return false; }
}

/** Google Cloud TTS — model id-ID-Standard-A atau Wavenet */
async function speakGoogle(text: string, onEnd: () => void): Promise<boolean> {
  const apiKey = (await sbGetSetting<string>('GOOGLE_TTS_KEY')) || '';
  if (!apiKey) return false;

  const voiceName = (await sbGetSetting<string>('GOOGLE_TTS_VOICE')) || 'id-ID-Standard-A';
  const speakingRate = (await sbGetSetting<number>('GOOGLE_TTS_RATE')) ?? 1.0;
  try {
    const res = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text },
          voice: { languageCode: 'id-ID', name: voiceName },
          audioConfig: { audioEncoding: 'MP3', speakingRate },
        }),
      },
    );
    if (!res.ok) { console.warn('[TTS:GCP] error', res.status); return false; }
    const { audioContent } = await res.json();
    if (!audioContent) return false;
    const audio = new Audio(`data:audio/mp3;base64,${audioContent}`);
    audio.onended = onEnd;
    audio.onerror = () => onEnd();
    await audio.play();
    return true;
  } catch (e) { console.warn('[TTS:GCP] error:', e); return false; }
}

/** OpenAI TTS */
async function speakOpenAI(text: string, onEnd: () => void): Promise<boolean> {
  const apiKey = (await sbGetSetting<string>('OPENAI_TTS_KEY')) || '';
  if (!apiKey) return false;

  const voice = (await sbGetSetting<string>('OPENAI_TTS_VOICE')) || 'shimmer'; // shimmer paling natural untuk ID
  const model = (await sbGetSetting<string>('OPENAI_TTS_MODEL')) || 'tts-1';
  try {
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model, input: text, voice, response_format: 'mp3' }),
    });
    if (!res.ok) { console.warn('[TTS:OAI] error', res.status); return false; }
    const url = URL.createObjectURL(await res.blob());
    const audio = new Audio(url);
    audio.onended = () => { URL.revokeObjectURL(url); onEnd(); };
    audio.onerror = () => { URL.revokeObjectURL(url); onEnd(); };
    await audio.play();
    return true;
  } catch (e) { console.warn('[TTS:OAI] error:', e); return false; }
}

/** Microsoft Azure Cognitive TTS */
async function speakAzure(text: string, onEnd: () => void): Promise<boolean> {
  const subscriptionKey = (await sbGetSetting<string>('AZURE_TTS_KEY')) || '';
  const region          = (await sbGetSetting<string>('AZURE_TTS_REGION')) || 'southeastasia';
  if (!subscriptionKey) return false;

  const voiceName  = (await sbGetSetting<string>('AZURE_TTS_VOICE'))  || 'id-ID-GadisNeural';
  const speakingRate = (await sbGetSetting<number>('AZURE_TTS_RATE')) ?? 1.0;
  const ratePercent = Math.round((speakingRate - 1) * 100);
  const rateStr = ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`;

  const ssml = `<speak version='1.0' xml:lang='id-ID'>
    <voice name='${voiceName}'>
      <prosody rate='${rateStr}'>${text.replace(/[<>&]/g, c => c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&amp;')}</prosody>
    </voice>
  </speak>`;

  try {
    const res = await fetch(
      `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': subscriptionKey,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
        },
        body: ssml,
      },
    );
    if (!res.ok) { console.warn('[TTS:AZ] error', res.status); return false; }
    const url = URL.createObjectURL(await res.blob());
    const audio = new Audio(url);
    audio.onended = () => { URL.revokeObjectURL(url); onEnd(); };
    audio.onerror = () => { URL.revokeObjectURL(url); onEnd(); };
    await audio.play();
    return true;
  } catch (e) { console.warn('[TTS:AZ] error:', e); return false; }
}

/** Browser Web Speech TTS — selalu berhasil (fallback akhir) */
function speakBrowser(text: string, onEnd: () => void): void {
  if (!('speechSynthesis' in window)) { onEnd(); return; }
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  // Selalu paksa id-ID agar tidak campur bahasa
  const idVoice = getBrowserVoiceID();
  if (idVoice) utt.voice = idVoice;
  utt.lang  = 'id-ID';
  utt.rate  = 1.0;
  utt.pitch = 1.0;
  // Chrome bug: onend tidak selalu fire — fallback timeout berdasarkan panjang teks
  const estimatedMs = Math.max(3000, text.length * 65);
  let ended = false;
  const finish = () => { if (ended) return; ended = true; onEnd(); };
  utt.onend   = finish;
  utt.onerror = finish;
  window.speechSynthesis.speak(utt);
  setTimeout(finish, estimatedMs);
}

/**
 * speak() — entry point utama.
 * Coba provider sesuai urutan prioritas, fallback otomatis jika gagal.
 */
async function speak(text: string, onEnd: () => void): Promise<void> {
  const preferredProvider = (await sbGetSetting<string>('tts_provider')) || 'elevenlabs';

  const tryProviders = async (order: string[]): Promise<void> => {
    for (const p of order) {
      let ok = false;
      if (p === 'elevenlabs') ok = await speakElevenLabs(text, onEnd);
      else if (p === 'google') ok = await speakGoogle(text, onEnd);
      else if (p === 'openai') ok = await speakOpenAI(text, onEnd);
      else if (p === 'azure')  ok = await speakAzure(text, onEnd);
      else if (p === 'browser') { speakBrowser(text, onEnd); return; }
      if (ok) { console.log(`[TTS] playing via ${p}`); return; }
      console.warn(`[TTS] ${p} failed, trying next...`);
    }
    // Semua API gagal — paksa browser
    speakBrowser(text, onEnd);
  };

  // Susun urutan: preferred dulu, lalu sisanya, browser selalu terakhir
  const fallbackOrder = ['elevenlabs', 'google', 'openai', 'azure']
    .filter(p => p !== preferredProvider);
  await tryProviders([preferredProvider, ...fallbackOrder, 'browser']);
}

// ─── Global mic-track registry ───────────────────────────────────────────────
// Setiap track yang diperoleh lewat getUserMedia didaftarkan di sini.
// emergencyStopAllMic() memanggil stop() pada semua track — melepas mic di browser.
const _globalMicTracks = new Set<MediaStreamTrack>();

// ─── Global SpeechRecognition registry ───────────────────────────────────────
// Setiap instance SpeechRecognition yang aktif didaftarkan di sini.
// emergencyStopAllMic() memanggil abort() pada semua instance — menghentikan STT.
const _globalSpeechRecs = new Set<SpeechRecognition>();

/** Hentikan SEMUA track mikrofon DAN SpeechRecognition secara paksa */
export function emergencyStopAllMic(): void {
  // 1. Hentikan semua MediaStream track (indikator mic di browser)
  _globalMicTracks.forEach(track => {
    try { track.stop(); } catch { /* ignore */ }
  });
  _globalMicTracks.clear();

  // 2. Hentikan semua SpeechRecognition instance yang aktif (bug utama: ini yang sebelumnya tidak dilakukan)
  _globalSpeechRecs.forEach(rec => {
    try { rec.abort(); } catch { /* ignore */ }
  });
  _globalSpeechRecs.clear();

  // 3. Hentikan TTS juga agar tidak ada suara tersisa
  try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }

  console.log('[Cenna] emergencyStopAllMic — semua mic track + SpeechRecognition dihentikan');
}


function useWakeWord(onDetected: () => void, active: boolean) {
  const recRef        = useRef<SpeechRecognition | null>(null);
  const timerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runningRef    = useRef(false);
  const activeRef     = useRef(active);
  const onDetectedRef = useRef(onDetected);
  // FIX: Simpan MediaStream agar bisa di-stop saat unmount/navigasi ke admin
  const streamRef     = useRef<MediaStream | null>(null);

  // Synchronous ref update — tidak tunggu re-render
  activeRef.current   = active;
  onDetectedRef.current = onDetected;

  const stopRef = useRef<() => void>(() => undefined);

  const stop = useCallback(() => {
    runningRef.current = false;
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (recRef.current) {
      try { recRef.current.abort(); } catch { /* ignore */ }
      _globalSpeechRecs.delete(recRef.current); // ← hapus dari registry global
      recRef.current = null;
    }
    // Stop semua track dan hapus dari registry global
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try { track.stop(); } catch { /* ignore */ }
        _globalMicTracks.delete(track);
      });
      streamRef.current = null;
      console.log('[Cenna wake] MediaStream tracks stopped — mic released');
    }
    console.log('[Cenna wake] stopped');
  }, []);
  stopRef.current = stop;

  const start = useCallback(() => {
    if (!activeRef.current) return;
    if (runningRef.current) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      console.warn('[Cenna wake] SpeechRecognition not supported');
      return;
    }

    const rec: SpeechRecognition = new SR();
    rec.lang            = 'id-ID';
    rec.continuous      = true;
    rec.interimResults  = true;
    rec.maxAlternatives = 5;

    rec.onstart = () => {
      runningRef.current = true;
      console.log('[Cenna wake] 🎙️ listening...');
    };

    rec.onresult = (evt: SpeechRecognitionEvent) => {
      for (let i = evt.resultIndex; i < evt.results.length; i++) {
        const r = evt.results[i];
        const alts = Array.from({ length: r.length }, (_, j) => r[j].transcript);
        console.log('[Cenna wake] heard:', { final: r.isFinal, alts });
        for (let j = 0; j < r.length; j++) {
          if (matchesWakeWord(r[j].transcript)) {
            onDetectedRef.current();
            return;
          }
        }
      }
    };

    const scheduleRestart = (delay: number) => {
      runningRef.current = false;
      recRef.current     = null;
      if (!activeRef.current) return;
      timerRef.current = setTimeout(start, delay);
    };

    rec.onend = () => {
      console.log('[Cenna wake] session ended, restarting...');
      _globalSpeechRecs.delete(rec); // ← instance sudah ended, hapus dari registry
      scheduleRestart(200);
    };

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      console.warn('[Cenna wake] error:', e.error);
      _globalSpeechRecs.delete(rec); // ← instance error, hapus dari registry
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        // Mic ditolak → stop total, jangan retry
        stopRef.current();
        return;
      }
      scheduleRestart(e.error === 'no-speech' ? 100 : 800);
    };

    recRef.current = rec;
    _globalSpeechRecs.add(rec); // ← daftarkan ke registry global
    try {
      rec.start();
      console.log('[Cenna wake] rec.start() called');
    } catch (err) {
      console.warn('[Cenna wake] rec.start() threw:', err);
      _globalSpeechRecs.delete(rec);
      recRef.current = null;
      scheduleRestart(800);
    }
  }, []);

  useEffect(() => {
    if (!active) {
      activeRef.current = false; // ← pastikan tidak ada restart setelah stop
      stop();
      return () => stop();
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    // ⚠️ FIX RACE CONDITION: tandai jika cleanup sudah dipanggil sebelum getUserMedia resolve
    let cleanupCalled = false;

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        if (cleanupCalled) {
          // Komponen unmount SEBELUM mic resolve — langsung stop stream
          stream.getTracks().forEach(t => { try { t.stop(); } catch { /* ok */ } });
          console.log('[Cenna wake] mic granted AFTER unmount — race condition fixed, tracks stopped');
          return;
        }
        // Daftarkan semua track ke registry global
        stream.getTracks().forEach(t => _globalMicTracks.add(t));
        streamRef.current = stream;
        console.log('[Cenna wake] mic granted, starting wake listener');
        start();
      })
      .catch((err) => {
        console.warn('[Cenna wake] mic denied:', err);
      });

    return () => {
      cleanupCalled = true;  // Set flag SEBELUM stop() agar race condition terdeteksi
      activeRef.current = false; // ← Pastikan onend tidak restart setelah abort
      stop();
    };
  }, [active, start, stop]);
}

// ─── Hook: ambient listener ───────────────────────────────────────────────────

interface AmbientListenerOptions {
  enabled:   boolean;
  silenceMs?: number;
  onData:    (data: CapturedData) => void;
}

function useAmbientListener({ enabled, silenceMs = 3000, onData }: AmbientListenerOptions) {
  const recRef          = useRef<SpeechRecognition | null>(null);
  const runningRef      = useRef(false);
  const transcriptRef   = useRef('');
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ambient listener juga request getUserMedia sendiri agar track bisa di-stop paksa
  const ambientStreamRef = useRef<MediaStream | null>(null);

  // Synchronous ref update
  const enabledRef = useRef(enabled);
  const onDataRef  = useRef(onData);
  enabledRef.current = enabled;
  onDataRef.current  = onData;

  const stopRef = useRef<() => void>(() => undefined);

  const fireSilence = useCallback(() => {
    const raw = transcriptRef.current.trim();
    if (!raw) return;
    const entities = extractEntities(raw);
    console.log('[Cenna ambient] firing — transcript:', raw.slice(0, 80));
    onDataRef.current({
      transcript: raw,
      keluhan:    entities.keluhan,
      obat:       entities.obat,
      pertanyaan: entities.pertanyaan,
      waktu:      new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    });
    transcriptRef.current = '';
  }, []);

  const stop = useCallback(() => {
    runningRef.current = false;
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    if (recRef.current) {
      try { recRef.current.abort(); } catch { /* ignore */ }
      _globalSpeechRecs.delete(recRef.current); // ← hapus dari registry global
      recRef.current = null;
    }
    // Hentikan MediaStream ambient dan hapus dari registry global
    if (ambientStreamRef.current) {
      ambientStreamRef.current.getTracks().forEach(t => {
        try { t.stop(); } catch { /* ignore */ }
        _globalMicTracks.delete(t);
      });
      ambientStreamRef.current = null;
    }
    console.log('[Cenna ambient] stopped — mic released');
  }, []);

  stopRef.current = stop;

  const start = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR || runningRef.current) return;

    const rec: SpeechRecognition = new SR();
    rec.lang           = 'id-ID';
    rec.continuous     = true;
    rec.interimResults = true;

    rec.onstart = () => { runningRef.current = true; console.log('[Cenna ambient] 🎙️ started'); };

    rec.onresult = (evt: SpeechRecognitionEvent) => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

      let newText = '';
      for (let i = evt.resultIndex; i < evt.results.length; i++) {
        const r = evt.results[i];
        if (r.isFinal) newText += r[0].transcript + ' ';
      }
      if (newText.trim()) {
        transcriptRef.current += newText;
        console.log('[Cenna ambient] transcript so far:', transcriptRef.current.slice(-80));
      }

      // Cek nada tanya
      const last = transcriptRef.current.trim().split(/[.!]+/).pop() ?? '';
      if (isQuestion(last) && last.length > 5) {
        fireSilence();
        return;
      }

      // Jeda timer
      silenceTimerRef.current = setTimeout(fireSilence, silenceMs);
    };

    rec.onend = () => {
      _globalSpeechRecs.delete(rec); // ← instance sudah ended, hapus dari registry
      runningRef.current = false;
      recRef.current     = null;
      if (enabledRef.current) setTimeout(start, 150);
    };
    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      _globalSpeechRecs.delete(rec); // ← instance error, hapus dari registry
      if (e.error === 'not-allowed') { stopRef.current(); return; }
      runningRef.current = false;
      recRef.current     = null;
      if (enabledRef.current) setTimeout(start, 800);
    };

    recRef.current = rec;
    _globalSpeechRecs.add(rec); // ← daftarkan ke registry global
    try {
      rec.start();
    } catch {
      _globalSpeechRecs.delete(rec);
      recRef.current = null;
      setTimeout(start, 800);
    }
  }, [fireSilence, silenceMs]);

  useEffect(() => {
    if (!enabled) {
      enabledRef.current = false; // ← pastikan tidak ada restart setelah stop
      stop();
      return () => stop();
    }

    let cleanupCalled = false;
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        if (cleanupCalled) {
          stream.getTracks().forEach(t => { try { t.stop(); } catch { /* ok */ } });
          return;
        }
        stream.getTracks().forEach(t => _globalMicTracks.add(t));
        ambientStreamRef.current = stream;
        start();
      })
      .catch(() => {
        // Fallback: mulai tanpa stream tracking (SpeechRecognition kelola mic sendiri)
        if (!cleanupCalled) start();
      });

    return () => {
      cleanupCalled = true;
      enabledRef.current = false; // ← Pastikan onend tidak restart setelah abort
      stop();
    };
  }, [enabled, start, stop]);
}

// ─── Helper: hex → {r,g,b} ────────────────────────────────────────────────────

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : PALETTE.navy;
}

// ─── Hook: Antigravity Particle Canvas ───────────────────────────────────────
//
// Partikel mengambang naik (defying gravity) dengan:
// - Drift horizontal sinusoidal
// - Koneksi garis antar partikel terdekat (< connectDist)
// - Warna dari branding admin (primary & accent)
// - Intensitas & jumlah partikel reaktif terhadap phase

interface Particle {
  x: number; y: number;
  vx: number; vy: number;  // velocity
  size: number;
  alpha: number;
  alphaDelta: number;
  colorIdx: number;         // 0 = primary, 1 = accent, 2 = mix
  phaseOffset: number;      // untuk drift sinusoidal unik per partikel
}

function useOrbCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  phase: OrbPhase,
  brandColors: { primary: string; accent: string },
) {
  const animIdRef     = useRef<number>(0);
  const particlesRef  = useRef<Particle[]>([]);
  const colorsRef     = useRef(brandColors);
  colorsRef.current   = brandColors;  // always latest, no re-run needed

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = (canvas.width  = window.innerWidth);
    let h = (canvas.height = window.innerHeight);
    const onResize = () => {
      w = canvas.width  = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    // ── Konfigurasi per phase ──────────────────────────────────────────────────
    const phaseConfig: Record<OrbPhase, {
      count: number;       // jumlah partikel
      speed: number;       // kecepatan naik (vy dasar)
      connectDist: number; // jarak maks untuk garis koneksi
      lineAlpha: number;   // opacity garis
      sizeMax: number;     // ukuran partikel maks
      bgAlpha: number;     // background fade trail (semakin kecil = ghosting lebih panjang)
    }> = {
      idle:       { count: 55,  speed: 0.35, connectDist: 140, lineAlpha: 0.08, sizeMax: 2.8, bgAlpha: 0.92 },
      speaking:   { count: 80,  speed: 0.60, connectDist: 160, lineAlpha: 0.14, sizeMax: 3.5, bgAlpha: 0.88 },
      listening:  { count: 100, speed: 0.75, connectDist: 170, lineAlpha: 0.18, sizeMax: 4.0, bgAlpha: 0.85 },
      processing: { count: 130, speed: 1.00, connectDist: 190, lineAlpha: 0.22, sizeMax: 4.5, bgAlpha: 0.82 },
      responding: { count: 90,  speed: 0.65, connectDist: 165, lineAlpha: 0.16, sizeMax: 3.8, bgAlpha: 0.87 },
      popup:      { count: 40,  speed: 0.25, connectDist: 120, lineAlpha: 0.06, sizeMax: 2.2, bgAlpha: 0.95 },
    };

    const cfg = phaseConfig[phase];

    // ── Inisialisasi / resize partikel ─────────────────────────────────────────
    const makeParticle = (): Particle => ({
      x:           Math.random() * w,
      y:           Math.random() * h,
      vx:          (Math.random() - 0.5) * 0.4,
      vy:          -(Math.random() * cfg.speed + 0.15), // naik (negatif = ke atas)
      size:        Math.random() * cfg.sizeMax + 0.8,
      alpha:       Math.random() * 0.5 + 0.1,
      alphaDelta:  (Math.random() - 0.5) * 0.004,
      colorIdx:    Math.floor(Math.random() * 3),
      phaseOffset: Math.random() * Math.PI * 2,
    });

    // Isi atau trim partikel agar sesuai count
    while (particlesRef.current.length < cfg.count) particlesRef.current.push(makeParticle());
    if (particlesRef.current.length > cfg.count) particlesRef.current.splice(cfg.count);

    let t = 0;

    const draw = () => {
      const { primary, accent } = colorsRef.current;
      const p  = hexToRgb(primary);
      const ac = hexToRgb(accent);
      // Mix: blend 50/50 primary+accent
      const mx = { r: (p.r + ac.r) >> 1, g: (p.g + ac.g) >> 1, b: (p.b + ac.b) >> 1 };
      const colorPalette = [p, ac, mx];

      t++;

      // ── Background: semi-transparent fill untuk trail ghosting halus
      ctx.fillStyle = `rgba(255,255,255,${cfg.bgAlpha})`;
      ctx.fillRect(0, 0, w, h);

      // ── Subtle radial aura di tengah ────────────────────────────────────────
      const aura = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, Math.min(w, h) * 0.42);
      aura.addColorStop(0,   `rgba(${p.r},${p.g},${p.b},0.04)`);
      aura.addColorStop(0.5, `rgba(${ac.r},${ac.g},${ac.b},0.025)`);
      aura.addColorStop(1,   'rgba(255,255,255,0)');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(w/2, h/2, Math.min(w, h) * 0.42, 0, Math.PI * 2);
      ctx.fill();

      const parts = particlesRef.current;

      // ── Update & draw particles ─────────────────────────────────────────────
      for (let i = 0; i < parts.length; i++) {
        const pt = parts[i];

        // Antigravity: partikel bergerak ke atas
        pt.y  += pt.vy;
        // Drift sinusoidal horizontal — tiap partikel punya fase unik
        pt.x  += pt.vx + Math.sin(t * 0.018 + pt.phaseOffset) * 0.35;
        // Alpha oscillation
        pt.alpha += pt.alphaDelta;
        if (pt.alpha > 0.75 || pt.alpha < 0.05) pt.alphaDelta *= -1;

        // Reset partikel yang sudah melampaui tepi atas
        if (pt.y < -10) {
          pt.y     = h + 5;
          pt.x     = Math.random() * w;
          pt.alpha = Math.random() * 0.3 + 0.05;
        }
        // Wrap horizontal
        if (pt.x < -10) pt.x = w + 5;
        if (pt.x > w + 10) pt.x = -5;

        const col = colorPalette[pt.colorIdx % 3];
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${col.r},${col.g},${col.b},${pt.alpha.toFixed(3)})`;
        ctx.fill();
      }

      // ── Draw connection lines ───────────────────────────────────────────────
      for (let i = 0; i < parts.length; i++) {
        for (let j = i + 1; j < parts.length; j++) {
          const dx = parts[i].x - parts[j].x;
          const dy = parts[i].y - parts[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < cfg.connectDist) {
            const progress = 1 - dist / cfg.connectDist;
            const colA = colorPalette[parts[i].colorIdx % 3];
            const colB = colorPalette[parts[j].colorIdx % 3];
            // Blend warna dua partikel
            const r = (colA.r + colB.r) >> 1;
            const g = (colA.g + colB.g) >> 1;
            const b = (colA.b + colB.b) >> 1;
            ctx.strokeStyle = `rgba(${r},${g},${b},${(cfg.lineAlpha * progress).toFixed(3)})`;
            ctx.lineWidth   = progress * 1.2;
            ctx.beginPath();
            ctx.moveTo(parts[i].x, parts[i].y);
            ctx.lineTo(parts[j].x, parts[j].y);
            ctx.stroke();
          }
        }
      }

      animIdRef.current = requestAnimationFrame(draw);
    };

    // Reset full canvas sebelum mulai
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    draw();
    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(animIdRef.current);
    };
  }, [phase]); // re-run hanya saat phase berubah; brandColors diambil live via ref
}


// ─── OrbCore ─────────────────────────────────────────────────────────────────

type OrbVisualModel = 'classic' | 'aurora' | 'pulse' | 'wave';

interface OrbCoreProps {
  phase: OrbPhase;
  wakeEnabled: boolean;
  wakeFlash: boolean;
  templateColors?: { primary: string; secondary: string } | null;
  orbSize: number;          // diameter container px (responsive)
  visualModel: OrbVisualModel;
}

function OrbCore({ phase, wakeEnabled, wakeFlash, templateColors, orbSize, visualModel }: OrbCoreProps) {
  // Warna berdasarkan template atau default
  const orbPrimary   = templateColors?.primary   ?? '#1e2a4a';
  const orbSecondary = templateColors?.secondary  ?? '#b8a898';

  // Ukuran proporsional dari container
  const S = {
    sphere:     orbSize * 0.59,
    glow:       orbSize * 0.76,
    wakeRing:   orbSize * 0.82,
    listenRing: orbSize * 0.85,
    outerRing:  orbSize * 0.69,
  };

  const glowColor = templateColors
    ? orbPrimary
    : { idle: '#1e2a4a', speaking: '#b8a898', listening: '#7F77DD', processing: '#7F77DD', responding: '#b8a898', popup: '#b8a898' }[phase];

  // Ring Tailwind class — harus string literal untuk Tailwind JIT; gunakan inline style saja
  const ringPx = (() => {
    if (templateColors) return `0 0 0 ${orbSize * 0.015}px ${orbPrimary}50`;
    return {
      idle:       `0 0 0 ${orbSize * 0.009}px rgba(30,42,74,0.20)`,
      speaking:   `0 0 0 ${orbSize * 0.015}px rgba(184,168,152,0.60)`,
      listening:  `0 0 0 ${orbSize * 0.015}px rgba(127,119,221,0.50)`,
      processing: `0 0 0 ${orbSize * 0.018}px rgba(127,119,221,0.70)`,
      responding: `0 0 0 ${orbSize * 0.015}px rgba(184,168,152,0.60)`,
      popup:      `0 0 0 ${orbSize * 0.009}px rgba(184,168,152,0.30)`,
    }[phase];
  })();

  // ── Render inner visual based on model ─────────────────────────────────────
  const renderInnerVisual = () => {
    if (visualModel === 'aurora') {
      return (
        <div style={{ width: S.sphere, height: S.sphere, position: 'relative', borderRadius: '50%', overflow: 'hidden' }}>
          {/* Blob layers */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: `radial-gradient(circle at 40% 35%, ${orbPrimary}dd 0%, transparent 65%)`,
            filter: 'blur(12px)', animation: 'orbSpin 9s linear infinite',
          }} />
          <div style={{
            position: 'absolute', inset: '15%', borderRadius: '50%',
            background: `radial-gradient(circle at 60% 55%, ${orbSecondary}bb 0%, transparent 70%)`,
            filter: 'blur(16px)', animation: 'orbSpin 13s linear infinite reverse',
          }} />
          <div style={{
            position: 'absolute', inset: '25%', borderRadius: '50%',
            background: `radial-gradient(circle at 50% 50%, rgba(255,255,255,0.25) 0%, transparent 60%)`,
            filter: 'blur(4px)',
          }} />
          {/* Highlight */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: 'radial-gradient(circle at 32% 28%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.05) 55%, transparent 80%)',
          }} />
          {/* Phase icon */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {phase === 'listening' && <div style={{ width: S.sphere * 0.15, height: S.sphere * 0.15, borderRadius: '50%', background: 'rgba(255,255,255,0.8)', animation: 'pulse 1s ease-in-out infinite' }} />}
            {phase === 'processing' && <div style={{ display: 'flex', gap: S.sphere * 0.04 }}>{[0,1,2].map(i => <div key={i} style={{ width: S.sphere * 0.06, height: S.sphere * 0.06, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', animation: `processingDot 1.1s ease-in-out ${i * 0.2}s infinite` }} />)}</div>}
          </div>
        </div>
      );
    }

    if (visualModel === 'pulse') {
      const rings = [1, 0.75, 0.52, 0.32];
      const opacities = ['80', '55', '38', '20'];
      return (
        <div style={{ width: S.sphere, height: S.sphere, position: 'relative' }}>
          {rings.map((scale, i) => (
            <div key={i} style={{
              position: 'absolute',
              width: `${scale * 100}%`, height: `${scale * 100}%`,
              top: `${(1 - scale) / 2 * 100}%`, left: `${(1 - scale) / 2 * 100}%`,
              borderRadius: '50%',
              border: `${Math.max(1.5, (2.5 - i * 0.4))}px solid ${orbPrimary}${opacities[i]}`,
              animation: `pulse ${1.4 + i * 0.45}s ease-in-out ${i * 0.15}s infinite`,
            }} />
          ))}
          {/* Center dot */}
          <div style={{
            position: 'absolute', top: '42%', left: '42%',
            width: '16%', height: '16%', borderRadius: '50%',
            background: orbPrimary,
            boxShadow: `0 0 ${S.sphere * 0.12}px ${orbPrimary}80`,
            animation: phase === 'listening' ? 'pulse 0.8s ease-in-out infinite' : undefined,
          }} />
          {/* Processing dots */}
          {phase === 'processing' && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: S.sphere * 0.06 }}>
              {[0,1,2,3,4,5].map(i => <div key={i} style={{ width: S.sphere * 0.05, height: S.sphere * 0.05, borderRadius: '50%', background: orbPrimary, animation: `processingDot 1.1s ease-in-out ${i * 0.12}s infinite` }} />)}
            </div>
          )}
        </div>
      );
    }

    if (visualModel === 'wave') {
      return (
        <div style={{ width: S.sphere, height: S.sphere, position: 'relative', borderRadius: '50%', overflow: 'hidden',
          background: `linear-gradient(160deg, ${orbPrimary} 0%, ${orbSecondary} 50%, ${orbPrimary} 100%)`,
          boxShadow: `0 0 ${S.sphere * 0.2}px ${orbPrimary}40`,
        }}>
          {/* Wave layers */}
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              position: 'absolute',
              width: '200%', height: '200%',
              top: `${30 + i * 12}%`, left: '-50%',
              borderRadius: '42%',
              background: `rgba(255,255,255,${0.12 - i * 0.03})`,
              animation: `orbSpin ${6 + i * 2}s linear ${i % 2 === 0 ? '' : 'reverse'} infinite`,
              transformOrigin: '50% 48%',
            }} />
          ))}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.45) 0%, transparent 55%)',
          }} />
          {/* Inner icons */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {phase === 'listening' && <div style={{ display: 'flex', gap: S.sphere * 0.04, alignItems: 'flex-end', height: S.sphere * 0.28 }}>
              {[0.5,0.75,1,0.75,0.5].map((s, i) => <div key={i} style={{ width: S.sphere * 0.04, borderRadius: S.sphere, background: 'rgba(255,255,255,0.8)', height: `${s * 100}%`, animation: `barBounce 1.6s ease-in-out ${i * 0.14}s infinite alternate` }} />)}
            </div>}
            {(phase === 'speaking' || phase === 'responding') && <div style={{ display: 'flex', gap: S.sphere * 0.04, alignItems: 'flex-end', height: S.sphere * 0.28 }}>
              {[0.6,0.9,1,0.8,0.5,0.7,0.4].map((s, i) => <div key={i} style={{ width: S.sphere * 0.035, borderRadius: S.sphere, background: 'white', height: `${s * 100}%`, animation: `barBounce 0.45s ease-in-out ${i * 0.06}s infinite alternate` }} />)}
            </div>}
          </div>
        </div>
      );
    }

    // DEFAULT: classic
    return (
      <div
        className="relative rounded-full flex items-center justify-center border-none transition-all duration-1000 ease-out"
        style={{
          width: S.sphere, height: S.sphere,
          background: templateColors
            ? `conic-gradient(from 0deg, ${orbPrimary} 0%, ${orbSecondary} 35%, #f5f0e8 55%, ${orbSecondary} 75%, ${orbPrimary} 100%)`
            : 'conic-gradient(from 0deg, #1e2a4a 0%, #b8a898 35%, #f5f0e8 55%, #b8a898 75%, #1e2a4a 100%)',
          boxShadow: `${ringPx}, 0 28px 60px -12px ${glowColor}40, 0 0 0 1px rgba(255,255,255,0.15) inset`,
          animation: 'orbSpin 14s linear infinite',
        }}
      >
        <div className="absolute rounded-full" style={{ inset: 6, background: 'radial-gradient(ellipse at 35% 30%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.08) 60%, transparent 100%)' }} />
        <div className="relative flex flex-col items-center justify-center z-10">
          {phase === 'idle' && (
            <div className="flex items-end" style={{ gap: S.sphere * 0.025, height: S.sphere * 0.14 }}>
              {[0.5, 0.75, 1, 0.75, 0.5].map((s, i) => (
                <div key={i} className="rounded-full bg-white/80"
                  style={{ width: S.sphere * 0.015, height: `${s * 100}%`, animation: `barBounce 1.6s ease-in-out ${i * 0.14}s infinite alternate`, opacity: 0.6 + s * 0.3 }} />
              ))}
            </div>
          )}
          {(phase === 'speaking' || phase === 'responding') && (
            <div className="flex items-end" style={{ gap: S.sphere * 0.025, height: S.sphere * 0.14 }}>
              {[0.6, 0.9, 1, 0.8, 0.5, 0.7, 0.4].map((s, i) => (
                <div key={i} className="rounded-full bg-white"
                  style={{ width: S.sphere * 0.015, height: `${s * 100}%`, animation: `barBounce 0.45s ease-in-out ${i * 0.06}s infinite alternate` }} />
              ))}
            </div>
          )}
          {phase === 'processing' && (
            <div className="flex items-center" style={{ gap: S.sphere * 0.03 }}>
              {[0,1,2,3,4,5].map(i => (
                <div key={i} className="rounded-full"
                  style={{ width: S.sphere * 0.024, height: S.sphere * 0.024, background: 'rgba(255,255,255,0.9)', animation: `processingDot 1.1s ease-in-out ${i * 0.12}s infinite` }} />
              ))}
            </div>
          )}
          {phase === 'listening' && (
            <div className="flex items-center" style={{ gap: S.sphere * 0.03 }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-full bg-white"
                  style={{ width: S.sphere * (0.02 + i % 2 * 0.01), height: S.sphere * (0.02 + i % 2 * 0.01), animation: `dotPulse 1.0s ease-in-out ${i * 0.18}s infinite` }} />
              ))}
            </div>
          )}
          {phase === 'popup' && (
            <div className="flex items-center justify-center" style={{ width: S.sphere * 0.25, height: S.sphere * 0.25 }}>
              <svg width={S.sphere * 0.18} height={S.sphere * 0.18} viewBox="0 0 28 28" fill="none">
                <path d="M6 14l6 6L22 8" stroke="rgba(255,255,255,0.9)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="relative flex items-center justify-center" style={{ width: orbSize, height: orbSize }}>
      {wakeEnabled && phase === 'idle' && (
        <div className="absolute rounded-full pointer-events-none"
          style={{ width: S.wakeRing, height: S.wakeRing, border: '1.5px solid rgba(16,185,129,0.35)', animation: 'wakeRingPulse 2.2s ease-in-out infinite' }} />
      )}
      {wakeFlash && (
        <div className="absolute rounded-full pointer-events-none"
          style={{ width: S.wakeRing, height: S.wakeRing, border: '2.5px solid rgba(16,185,129,0.7)', animation: 'wakeFlashRing 0.9s ease-out forwards' }} />
      )}
      {phase === 'listening' && (
        <div className="absolute rounded-full pointer-events-none"
          style={{ width: S.listenRing, height: S.listenRing, border: '1.5px solid rgba(127,119,221,0.45)', animation: 'listeningPulse 1.8s ease-in-out infinite' }} />
      )}
      {/* Glow layer */}
      <div className="absolute rounded-full transition-all duration-700 ease-out"
        style={{
          width: S.glow, height: S.glow,
          background: `radial-gradient(circle, ${glowColor}22 0%, transparent 75%)`,
          filter: `blur(${orbSize * 0.094}px)`,
          transform: `scale(${phase === 'listening' ? 1.12 : 1})`
        }} />
      {/* Visual model */}
      {visualModel !== 'classic' && (
        <div style={{ position: 'relative', boxShadow: ringPx, borderRadius: '50%', transition: 'box-shadow 0.7s ease' }}>
          {renderInnerVisual()}
        </div>
      )}
      {visualModel === 'classic' && renderInnerVisual()}
      {/* Outer dashed orbit ring */}
      {visualModel !== 'pulse' && (
        <div className="absolute rounded-full border border-[#1e2a4a]/10 pointer-events-none"
          style={{ width: S.outerRing, height: S.outerRing, animation: 'spinSlow 18s linear infinite reverse', borderStyle: 'dashed', borderWidth: '1px' }} />
      )}
    </div>
  );
}

// ─── StatusPill ───────────────────────────────────────────────────────────────

function StatusPill({ phase, aiLabel }: { phase: OrbPhase; aiLabel: string }) {
  const config = {
    idle:       { color: '#b8a898', label: 'Siap — ucapkan "Hai Cenna"' },
    speaking:   { color: '#10b981', label: 'Menyapa…' },
    listening:  { color: '#7F77DD', label: 'Mendengarkan percakapan' },
    processing: { color: '#7F77DD', label: aiLabel || 'Cenna sedang berpikir…' },
    responding: { color: '#10b981', label: 'Cenna merespons…' },
    popup:      { color: '#b8a898', label: 'Data ditangkap' },
  }[phase];
  return (
    <div className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#1e2a4a]/8 bg-white/60 backdrop-blur-sm"
      style={{ fontFamily: "'DM Mono', monospace" }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: config.color, animation: 'pulse 1.5s ease-in-out infinite' }} />
      <span className="text-[10px] tracking-[0.18em] uppercase text-[#1e2a4a]/40 font-medium"
        style={phase === 'processing' ? { color: '#7F77DD', opacity: 1 } : {}}>
        {config.label}
      </span>
    </div>
  );
}

// ─── ConclusionPopup — Diagnosa, DDx, Tatalaksana, Edukasi ─────────────────

interface ConclusionPopupProps {
  conclusion: ClinicalConclusion;
  anamnesis: AnamnesisData;
  redFlags: string[];
  onClose: () => void;
  onSOAP: () => void;
}

function ConclusionPopup({ conclusion, anamnesis, redFlags, onClose, onSOAP }: ConclusionPopupProps) {
  const [tab, setTab] = React.useState<'diagnosa' | 'anamnesis' | 'tatalaksana' | 'edukasi'>('diagnosa');
  const katColor: Record<string, string> = {
    farmakologi: '#1e2a4a', 'non-farmakologi': '#10b981',
    rujukan: '#e74c3c', 'pemeriksaan penunjang': '#7F77DD',
  };
  const TABS = [
    { key: 'diagnosa',   label: '📋 DDx' },
    { key: 'anamnesis',  label: '🩺 Anamnesis' },
    { key: 'tatalaksana', label: '💊 Tatalaksana' },
    { key: 'edukasi',   label: '📖 Edukasi' },
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
            {conclusion.prognosis && <p style={{ margin: '6px 0 0', fontSize: 11, color: '#64748b', fontStyle: 'italic', lineHeight: 1.5 }}>{conclusion.prognosis}</p>}
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
                  {ddx.icd10 && <span style={{ fontSize: 9, background: '#f1f5f9', color: '#64748b', padding: '1px 5px', borderRadius: 3, fontFamily: "'DM Mono',monospace", marginTop: 4, display: 'inline-block' }}>ICD-10: {ddx.icd10}</span>}
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

// ─── DataPopup (fallback saat AI non-aktif) ────────────────────────────────

interface DataPopupProps { data: CapturedData; onClose: () => void; onSOAP: () => void; canContinue?: boolean; onContinue?: () => void; }

function DataPopup({ data, onClose, onSOAP, canContinue, onContinue }: DataPopupProps) {
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
            <button onClick={onSOAP}
              style={{ flex: 1, padding: '9px 0', fontSize: 12, fontWeight: 500, background: '#1e2a4a', color: '#f5f0e8', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
              Buat SOAP
            </button>
            {canContinue && onContinue && (
              <button onClick={onContinue}
                style={{ padding: '9px 14px', fontSize: 12, fontWeight: 500, background: '#7F77DD', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                ↩ Lanjut
              </button>
            )}
            <button onClick={onClose}
              style={{ padding: '9px 14px', fontSize: 12, background: 'none', color: '#b8a898', border: '1px solid #e5e2dc', borderRadius: 8, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── LandingPage ──────────────────────────────────────────────────────────────

export default function LandingPage({ onLoginClick }: LandingPageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [phase,        setPhase]        = useState<OrbPhase>('idle');
  const [wakeFlash,    setWakeFlash]    = useState(false);
  const [capturedData, setCapturedData] = useState<CapturedData | null>(null);
  const [conclusionData, setConclusionData] = useState<ClinicalConclusion | null>(null);
  const [redFlagsData,   setRedFlagsData]   = useState<string[]>([]);
  const [customLogoUrl, setCustomLogoUrl] = useState<string | null>(null);
  const [aiLabel,      setAiLabel]      = useState('Cenna sedang berpikir…');
  const [aiEnabled,    setAiEnabled]    = useState(false);
  // Template mode: warna orb per step
  const [templateOrbColors, setTemplateOrbColors] = useState<{ primary: string; secondary: string } | null>(null);
  const [templateModeName,  setTemplateModeName]  = useState<string | null>(null);
  // Orb visual
  const [orbVisualModel, setOrbVisualModel] = useState<OrbVisualModel>('classic');
  const [orbSize, setOrbSize] = useState(() => Math.min(window.innerWidth * 0.88, window.innerHeight * 0.88, 700));
  // Brand colors untuk canvas (dari branding settings DB)
  const [brandColors, setBrandColors] = useState({ primary: '#1e2a4a', accent: '#b8a898' });
  const conversationHistoryRef = useRef<Array<{ role: 'user'|'assistant'; content: string }>>([]);
  const sessionDataRef = useRef<CapturedData[]>([]);
  function mergeSessionData(all: CapturedData[]): CapturedData {
    return {
      transcript: all.map(d => d.transcript).join(' — '),
      keluhan:    Array.from(new Set(all.flatMap(d => d.keluhan))),
      obat:       Array.from(new Set(all.flatMap(d => d.obat))),
      pertanyaan: Array.from(new Set(all.flatMap(d => d.pertanyaan))),
      waktu:      all[0]?.waktu ?? '',
    };
  }

  useEffect(() => {
    // Load visual settings from DB
    (async () => {
      const model = await sbGetSetting<string>('orb_visual_model');
      if (model) setOrbVisualModel(model as OrbVisualModel);

      const enabled = await sbGetSetting<boolean>('ai_enabled');
      setAiEnabled(!!enabled);

      const b = await sbGetSetting<{ logoUrl?: string; colorPrimary?: string; colorAccent?: string }>('branding');
      if (b?.logoUrl) setCustomLogoUrl(b.logoUrl);
      if (b?.colorPrimary || b?.colorAccent) {
        setBrandColors({
          primary: b.colorPrimary ?? '#1e2a4a',
          accent:  b.colorAccent  ?? '#b8a898',
        });
      }
    })();

    // Responsive orb size
    const handleResize = () => setOrbSize(Math.min(window.innerWidth * 0.88, window.innerHeight * 0.88, 700));
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Cek apakah AI key sudah dikonfigurasi:
    // Dua jalur: (1) flag keyConfigured ada → langsung aktif
    // (2) flag tidak ada (data lama) → cek API key aktual per-provider
    sbGetSetting<{ provider: string; keyConfigured?: boolean }>('api_ai_config').then(async cfg => {
      if (!cfg) return;
      if (cfg.keyConfigured) {
        setAiEnabled(true);
        return;
      }
      // Fallback: cek apakah API key provider aktif benar-benar tersimpan
      const providerId = cfg.provider || 'anthropic';
      const key = await sbGetSetting<string>(`AI_KEY_${providerId.toUpperCase()}`);
      if (key && key.trim().length > 0) {
        setAiEnabled(true);
      }
    });
  }, []);

  // phaseRef: selalu sinkron dengan state, dibaca dari closure tanpa stale
  const phaseRef = useRef<OrbPhase>('idle');
  phaseRef.current = phase;

  // firedRef: guard sekali-trigger agar wake word tidak double-fire
  const firedRef = useRef(false);

  const hasSpeechAPI =
    typeof window !== 'undefined' &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  // Di mobile, SpeechRecognition continuous tidak didukung penuh — tampilkan tombol tap
  const isMobile = typeof window !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  useOrbCanvas(canvasRef, phase, brandColors);

  // handleWakeWord — gunakan firedRef sebagai guard, bukan phaseRef
  // Alasan: phaseRef saat callback dipanggil mungkin belum 'idle' karena
  // React belum flush setState dari render sebelumnya.
  const handleWakeWord = useCallback(() => {
    // Guard: hanya jalankan sekali sampai fase kembali ke idle
    if (firedRef.current) {
      console.log('[Cenna] wake word debounced (already fired)');
      return;
    }
    firedRef.current = true;
    console.log('[Cenna] wake word! → speaking');

    // BUG-02 FIX: Reset state anamnesis module-level di awal setiap sesi baru
    resetAnamnesisState();
    conversationHistoryRef.current = [];
    sessionDataRef.current = [];
    setTemplateOrbColors(null);
    setTemplateModeName(null);

    setWakeFlash(true);
    setTimeout(() => setWakeFlash(false), 900);
    setPhase('speaking');

    const goListening = () => {
      console.log('[Cenna] → listening');
      setPhase('listening');
    };

    // Cek apakah ada template aktif, gunakan greeting-nya
    sbGetActiveTemplate().then(tpl => {
      if (tpl && tpl.steps.length > 0) {
        _activeTemplate    = tpl;
        _templateStepIndex = 0;
        _templateDone      = false;
        setTemplateModeName(tpl.name);
        const greeting = tpl.greeting || 'Halo dokter, ada yang bisa Cenna bantu?';
        // Set warna orb step pertama saat sapaan
        const step0 = tpl.steps[0];
        if (step0) setTemplateOrbColors({ primary: step0.orb_primary, secondary: step0.orb_secondary });
        console.log('[Cenna] Template mode aktif:', tpl.name);
        speak(greeting, goListening);
      } else {
        // Normal AI mode
        speak('Halo dokter, ada yang bisa Cenna bantu?', goListening);
      }
    }).catch(() => {
      speak('Halo dokter, ada yang bisa Cenna bantu?', goListening);
    });
  }, []);

  // Reset firedRef ketika phase kembali ke idle (setelah popup/close)
  // Juga reset saat kembali ke listening (chaining) agar wake-word tidak mati
  useEffect(() => {
    if (phase === 'idle' || phase === 'listening') {
      firedRef.current = false;
      console.log('[Cenna] phase', phase, '— wake guard reset');
    }
  }, [phase]);

  // Wake-word aktif saat idle SAJA — matikan saat fase lain
  // Bug fix: sebelumnya tidak dimatikan saat processing/responding sehingga
  // bisa terpicu ulang selagi AI sedang merespons
  useWakeWord(handleWakeWord, phase === 'idle');

  const handleAmbientData = useCallback(async (data: CapturedData) => {

    // ─── TEMPLATE MODE ─────────────────────────────────────────────
    // Alur: User bicara → fuzzy match trigger → CENNA respond → kembali listening
    if (_activeTemplate && !_templateDone) {
      const steps = _activeTemplate.steps;

      // Cari step dari indeks saat ini yang trigger-nya cocok dengan ucapan user
      let matchedStep = null;
      let matchedIdx  = _templateStepIndex;

      for (let i = _templateStepIndex; i < steps.length; i++) {
        if (fuzzyMatchTrigger(data.transcript, steps[i].trigger_text)) {
          matchedStep = steps[i];
          matchedIdx  = i;
          break;
        }
      }

      if (!matchedStep) {
        // Tidak ada step yang cocok — tunggu, kembali listening tanpa respond
        console.log('[Cenna Template] Tidak ada step yang cocok, menunggu...');
        setPhase('listening');
        return;
      }

      // Cocok! Advance ke step berikutnya
      _templateStepIndex = matchedIdx + 1;

      // Update warna orb sesuai step yang matched
      setTemplateOrbColors({ primary: matchedStep.orb_primary, secondary: matchedStep.orb_secondary });

      // Gabungkan response + pertanyaan lanjutan jika ada
      const fullResponse = matchedStep.next_question
        ? `${matchedStep.response_text} ${matchedStep.next_question}`
        : matchedStep.response_text;

      setPhase('responding');
      speak(fullResponse, () => {
        if (_templateStepIndex >= steps.length) {
          // Semua step sudah selesai → fallback ke AI mode
          _templateDone = true;
          setTemplateOrbColors(null);
          setTemplateModeName(null);
          console.log('[Cenna Template] Semua step selesai → fallback ke AI');
        } else {
          // Ada step berikutnya — prefetch warna step berikutnya
          const nextStep = steps[_templateStepIndex];
          setTemplateOrbColors({ primary: nextStep.orb_primary, secondary: nextStep.orb_secondary });
        }
        setPhase('listening');
      });

      sessionDataRef.current.push(data);
      return; // JANGAN lanjut ke blok AI
    }

    // ─── AI MODE (normal atau setelah semua template step selesai) ───────
    if (!aiEnabled) {
      setCapturedData(data);
      setPhase('listening');
      return;
    }

    const currentHistory = conversationHistoryRef.current!;
    currentHistory.push({ role: 'user', content: data.transcript });
    setPhase('processing');
    setAiLabel('Menganalisis percakapan…');

    try {
      setAiLabel('Cenna sedang berpikir…');
      const aiResult = await callCennaAI(data.transcript, currentHistory.slice(0, -1));

      currentHistory.push({ role: 'assistant', content: aiResult.voice_response });

      const enrichedData: CapturedData = {
        ...data,
        keluhan:    aiResult.keluhan.length    ? aiResult.keluhan    : data.keluhan,
        obat:       aiResult.obat.length       ? aiResult.obat       : data.obat,
        pertanyaan: aiResult.pertanyaan.length ? aiResult.pertanyaan : data.pertanyaan,
      };

      sessionDataRef.current.push(enrichedData);
      setPhase('responding');

      const isSessionEnd = aiResult.session_end || aiResult.conclusion !== null;

      if (isSessionEnd) {
        const sessionId = 'sess_' + Date.now() + Math.random().toString(36).substring(2, 6);
        const allTranscripts = sessionDataRef.current.map(d => d.transcript).join(' — ');
        const allKeluhan = Array.from(new Set(sessionDataRef.current.flatMap(d => d.keluhan)));
        const allObat = Array.from(new Set(sessionDataRef.current.flatMap(d => d.obat)));

        sbSaveSession({
          id: sessionId,
          created_at: new Date().toISOString(),
          anamnesis: aiResult.anamnesis,
          conclusion: aiResult.conclusion,
          red_flags: aiResult.red_flags,
          transcript_full: allTranscripts,
          keluhan: allKeluhan,
          obat: allObat,
          session_rounds: Math.ceil(currentHistory.length / 2),
        }).catch(err => console.warn('[Cenna] sbSaveSession failed:', err));

        speak(aiResult.voice_response, () => {
          if (aiResult.conclusion) {
            setConclusionData(aiResult.conclusion);
            setRedFlagsData(aiResult.red_flags);
            setCapturedData(mergeSessionData(sessionDataRef.current));
            setPhase('popup');
          } else {
            setCapturedData(mergeSessionData(sessionDataRef.current));
            setPhase('popup');
          }
        });
      } else {
        speak(aiResult.voice_response, () => setPhase('listening'));
      }

    } catch (err) {
      console.warn('[Cenna AI] gagal:', err);
      currentHistory.pop();
      setPhase('listening');
    }
  }, [aiEnabled]);

  // Ambient listener aktif saat listening SAJA — tidak saat processing/responding
  // untuk mencegah double-fire saat AI sedang memproses
  useAmbientListener({
    enabled:   phase === 'listening',
    silenceMs: 3000,
    onData:    handleAmbientData,
  });

  const handleClosePopup = () => {
    setCapturedData(null);
    setConclusionData(null);
    setRedFlagsData([]);
    conversationHistoryRef.current = [];
    sessionDataRef.current = [];
    resetAnamnesisState();
    firedRef.current = false;
    setPhase('idle');
  };

  const handleEndConversation = () => {
    conversationHistoryRef.current = [];
    sessionDataRef.current = [];
    setCapturedData(null);
    setConclusionData(null);
    setRedFlagsData([]);
    resetAnamnesisState();
    firedRef.current = false;
    setPhase('idle');
  };

  const handleSOAP = () => {
    conversationHistoryRef.current = [];
    sessionDataRef.current = [];
    setCapturedData(null);
    setConclusionData(null);
    setRedFlagsData([]);
    resetAnamnesisState();
    onLoginClick();
  };

  return (
    <div className="relative min-h-screen w-full bg-white overflow-hidden flex flex-col items-center justify-center select-none">
      <canvas ref={canvasRef} className="absolute inset-0 z-0 pointer-events-none" />

      {wakeFlash && (
        <div className="absolute inset-0 z-20 pointer-events-none"
          style={{ background: 'radial-gradient(circle at center, rgba(16,185,129,0.15) 0%, transparent 70%)', animation: 'wakeFlash 0.9s ease-out forwards' }} />
      )}

      {/* Wordmark */}
      <div className="absolute top-5 left-7 z-30 flex items-center gap-3">
        {customLogoUrl ? (
          <img src={customLogoUrl} alt="Logo Klinik" className="h-10 w-auto object-contain max-w-[120px]" />
        ) : (
          <img src={CENNA_LOGO} alt="CENNA" className="w-10 h-10 object-contain"
            style={{ filter: 'brightness(0) saturate(100%) invert(14%) sepia(27%) saturate(1200%) hue-rotate(196deg) brightness(95%) contrast(95%)' }} />
        )}
        <div className="flex flex-col leading-tight">
          <span className="text-[13px] font-semibold tracking-[0.22em] uppercase" style={{ fontFamily: "'DM Sans', sans-serif", color: '#1e2a4a' }}>CENNA AI</span>
          <span className="text-[9px] tracking-[0.18em] uppercase text-[#b8a898]"  style={{ fontFamily: "'DM Sans', sans-serif" }}>Clinical Intelligence</span>
        </div>
      </div>

      <button onClick={onLoginClick}
        className="absolute top-5 right-7 z-30 text-[10px] tracking-[0.18em] uppercase text-[#1e2a4a]/30 hover:text-[#1e2a4a]/60 transition-colors"
        style={{ fontFamily: "'DM Mono', monospace", background: 'none', border: 'none', cursor: 'pointer' }}>
        Admin →
      </button>

      {/* Template mode badge */}
      {templateModeName && (
        <div
          className="absolute top-5 left-1/2 z-30"
          style={{ transform: 'translateX(-50%)' }}
        >
          <div
            className="flex items-center gap-1.5 px-3 py-1 rounded-full border"
            style={{
              background: templateOrbColors ? `${templateOrbColors.primary}15` : 'rgba(30,42,74,0.08)',
              borderColor: templateOrbColors ? `${templateOrbColors.primary}30` : 'rgba(30,42,74,0.12)',
              fontFamily: "'DM Mono', monospace",
            }}
          >
            <span style={{ fontSize: 8 }}>📋</span>
            <span
              className="text-[9px] font-bold tracking-widest uppercase"
              style={{ color: templateOrbColors?.primary ?? '#1e2a4a' }}
            >
              Template: {templateModeName}
            </span>
            <span
              className="text-[8px] tracking-wider"
              style={{ color: templateOrbColors?.primary ?? '#1e2a4a', opacity: 0.5 }}
            >
              · step {_templateStepIndex}/{_activeTemplate?.steps.length ?? 0}
            </span>
          </div>
        </div>
      )}

      <div className="absolute inset-0 z-10 flex items-center justify-center">
        <OrbCore
          phase={phase}
          wakeEnabled={phase === 'idle'}
          wakeFlash={wakeFlash}
          templateColors={templateOrbColors}
          orbSize={orbSize}
          visualModel={orbVisualModel}
        />
      </div>

      {/* Status text — absolute center-bottom, di atas orb, z-20 */}
      <div className="absolute bottom-24 left-0 right-0 z-20 flex flex-col items-center gap-1 pointer-events-none text-center px-4">
        {phase === 'idle' && !hasSpeechAPI && (
          <p className="text-[9px] tracking-[0.1em] text-[#1e2a4a]/25" style={{ fontFamily: "'DM Mono', monospace" }}>
            Wake word tidak didukung browser ini
          </p>
        )}
        {phase === 'idle' && hasSpeechAPI && !isMobile && (
          <p className="text-[11px] tracking-[0.1em] text-[#1e2a4a]/30" style={{ fontFamily: "'DM Mono', monospace" }}>
            {aiEnabled ? '✦ AI Voice Assistant aktif' : '◦ Mode dasar aktif'}
          </p>
        )}
        {phase === 'idle' && hasSpeechAPI && isMobile && (
          <p className="text-[10px] tracking-[0.1em] text-[#1e2a4a]/30" style={{ fontFamily: "'DM Mono', monospace" }}>
            {aiEnabled ? '✦ AI Voice Assistant aktif' : '◦ Mode dasar aktif'}
          </p>
        )}
        {phase === 'speaking' && (
          <p className="text-[12px] tracking-[0.1em] text-[#b8a898]" style={{ fontFamily: "'DM Mono', monospace", animation: 'fadeIn 0.5s ease' }}>
            Cenna menyapa…
          </p>
        )}
        {phase === 'listening' && (
          <>
            <p className="text-[12px] tracking-[0.1em] text-[#7F77DD]" style={{ fontFamily: "'DM Mono', monospace", animation: 'fadeIn 0.5s ease' }}>
              Mendengarkan — jeda 3 detik untuk diproses
            </p>
            {_currentAnamnesis.missing_fields.length > 0 && (
              <p className="text-[10px] tracking-[0.08em] text-[#7F77DD]/50" style={{ fontFamily: "'DM Mono', monospace" }}>
                perlu: {_currentAnamnesis.missing_fields.slice(0, 3).join(', ')}{_currentAnamnesis.missing_fields.length > 3 ? ` +${_currentAnamnesis.missing_fields.length - 3}` : ''}
              </p>
            )}
          </>
        )}
        {phase === 'processing' && (
          <p className="text-[12px] tracking-[0.1em]" style={{ fontFamily: "'DM Mono', monospace", color: '#7F77DD', animation: 'fadeIn 0.3s ease' }}>
            {aiLabel}
          </p>
        )}
        {phase === 'responding' && (
          <p className="text-[12px] tracking-[0.1em] text-[#10b981]" style={{ fontFamily: "'DM Mono', monospace", animation: 'fadeIn 0.3s ease' }}>
            Cenna merespons…
          </p>
        )}
      </div>

      {/* Tombol tap untuk mobile — karena SpeechRecognition continuous tidak berjalan di HP */}
      {phase === 'idle' && hasSpeechAPI && isMobile && (
        <button
          onClick={handleWakeWord}
          style={{
            position: 'absolute',
            bottom: '6rem',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 25,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            pointerEvents: 'auto',
          }}
        >
          <div style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: 'rgba(30,42,74,0.08)',
            border: '1.5px solid rgba(30,42,74,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s, transform 0.15s',
          }}
            onTouchStart={e => (e.currentTarget.style.background = 'rgba(30,42,74,0.16)')}
            onTouchEnd={e => (e.currentTarget.style.background = 'rgba(30,42,74,0.08)')}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <rect x="9" y="2" width="6" height="12" rx="3" fill="rgba(30,42,74,0.7)" />
              <path d="M5 11a7 7 0 0014 0" stroke="rgba(30,42,74,0.7)" strokeWidth="1.6" strokeLinecap="round" />
              <line x1="12" y1="18" x2="12" y2="22" stroke="rgba(30,42,74,0.7)" strokeWidth="1.6" strokeLinecap="round" />
              <line x1="9" y1="22" x2="15" y2="22" stroke="rgba(30,42,74,0.7)" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
          <span style={{
            fontSize: 9,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'rgba(30,42,74,0.35)',
            fontFamily: "'DM Mono', monospace",
          }}>Ketuk untuk mulai</span>
        </button>
      )}

      <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center gap-2 z-20">
        <StatusPill phase={phase} aiLabel={aiLabel} />
        {(phase === 'listening' || phase === 'processing' || phase === 'responding') && (
          <button
            onClick={handleEndConversation}
            className="text-[9px] tracking-[0.14em] uppercase text-[#1e2a4a]/25 hover:text-[#1e2a4a]/50 transition-colors"
            style={{ fontFamily: "'DM Mono', monospace", background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Akhiri sesi
          </button>
        )}
      </div>


      {phase === 'popup' && capturedData && conclusionData && (
        <ConclusionPopup
          conclusion={conclusionData}
          anamnesis={_currentAnamnesis}
          redFlags={redFlagsData}
          onClose={handleClosePopup}
          onSOAP={handleSOAP}
        />
      )}
      {phase === 'popup' && capturedData && !conclusionData && (
        <DataPopup
          data={capturedData}
          onClose={handleClosePopup}
          onSOAP={handleSOAP}
          canContinue={conversationHistoryRef.current!.length > 0 && conversationHistoryRef.current!.length < 10}
          onContinue={() => { setCapturedData(null); setPhase('listening'); }}
        />
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
        @keyframes orbSpin        { from{filter:hue-rotate(0deg) brightness(1.02)} 50%{filter:hue-rotate(8deg) brightness(1.06)} to{filter:hue-rotate(0deg) brightness(1.02)} }
        @keyframes barBounce      { from{transform:scaleY(0.45);opacity:0.45} to{transform:scaleY(1);opacity:1} }
        @keyframes dotPulse       { 0%,100%{transform:scale(0.6);opacity:0.35} 50%{transform:scale(1.25);opacity:1} }
        @keyframes spinSlow       { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes pulse          { 0%,100%{opacity:0.5;transform:scale(0.9)} 50%{opacity:1;transform:scale(1.1)} }
        @keyframes wakeRingPulse  { 0%{transform:scale(1);opacity:0.5} 50%{transform:scale(1.06);opacity:0.22} 100%{transform:scale(1);opacity:0.5} }
        @keyframes wakeFlashRing  { 0%{transform:scale(1);opacity:1} 100%{transform:scale(1.2);opacity:0} }
        @keyframes wakeFlash      { 0%{opacity:1} 100%{opacity:0} }
        @keyframes listeningPulse { 0%,100%{transform:scale(1);opacity:0.5} 50%{transform:scale(1.08);opacity:0.25} }
        @keyframes fadeIn         { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes popupIn        { from{opacity:0;transform:scale(0.93) translateY(16px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes processingDot  { 0%,100%{transform:scale(0.5);opacity:0.3} 50%{transform:scale(1.3);opacity:1} }
        @keyframes orbProcessing  { 0%{filter:hue-rotate(0deg) brightness(1.1)} 50%{filter:hue-rotate(30deg) brightness(1.25)} 100%{filter:hue-rotate(0deg) brightness(1.1)} }
      `}</style>
    </div>
  );
}

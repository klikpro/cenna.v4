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
import { sbGetSetting } from '../lib/supabase';
import { callActiveAI } from './ApiSettings';

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

/**
 * Normalisasi lebih agresif:
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

function matchesWakeWord(raw: string): boolean {
  const t = normalizeText(raw);
  console.log('[Cenna wake] normalizing:', JSON.stringify(raw), '→', JSON.stringify(t));

  // 1. Exact pattern match
  if (WAKE_PATTERNS.some((p) => t.includes(p))) {
    console.log('[Cenna wake] ✓ MATCHED (pattern) on:', JSON.stringify(t));
    return true;
  }

  // 2. Fuzzy fallback: "hai/hei/hey/hi" + spasi + 4-7 huruf (nama apapun)
  //    Menangkap kasus STT menghasilkan kata yang tidak ada di WAKE_PATTERNS
  const fuzzy = /\b(hai|hei|hey|hi)\s+[a-z]{4,7}\b/.test(t);
  if (fuzzy) console.log('[Cenna wake] ✓ MATCHED (fuzzy) on:', JSON.stringify(t));
  else       console.log('[Cenna wake] ✗ no match for:', JSON.stringify(t));
  return fuzzy;
}

// ─── AI Voice Assistant: system prompt + structured output ───────────────────

const CENNA_VOICE_SYSTEM_PROMPT = `Kamu adalah CENNA — asisten klinis suara berbahasa Indonesia yang membantu dokter saat konsultasi berjalan.

Tugas utama:
1. Dengarkan transkrip percakapan dokter-pasien.
2. Berikan RESPONS SUARA yang natural, singkat (1-3 kalimat), empatik, dan relevan secara klinis.
3. Sekaligus, ekstrak data medis terstruktur dari percakapan tersebut.

Aturan respons suara:
- Jawab dalam Bahasa Indonesia yang natural dan hangat.
- Maksimal 2-3 kalimat — ini akan diucapkan via TTS.
- Jika ada keluhan, akui dan beri catatan relevan singkat.
- Jika ada pertanyaan dokter kepada pasien, bantu konfirmasi atau beri konteks.
- Jika tidak ada konteks klinis jelas, cukup konfirmasi bahwa data tercatat.
- JANGAN menyebut nama obat spesifik tanpa konteks yang jelas.
- JANGAN beri diagnosis — hanya bantu catat dan identifikasi.

Format output WAJIB JSON (tidak ada teks di luar JSON):
{
  "voice_response": "<teks yang akan diucapkan TTS, 1-3 kalimat>",
  "keluhan": ["<keluhan 1>", "<keluhan 2>"],
  "obat": ["<obat/terapi 1>"],
  "pertanyaan": ["<pertanyaan klinis yang terdeteksi>"],
  "ringkasan": "<ringkasan 1 kalimat untuk pop-up>"
}`;

async function callCennaAI(transcript: string): Promise<{
  voice_response: string;
  keluhan: string[];
  obat: string[];
  pertanyaan: string[];
  ringkasan: string;
}> {
  const raw = await callActiveAI(
    CENNA_VOICE_SYSTEM_PROMPT,
    `Transkrip percakapan:
"${transcript}"

Berikan respons JSON sesuai format.`
  );

  // Parse JSON — strip markdown fences dan karakter kontrol jika ada
  const cleaned = raw
    .replace(/```json|```/gi, '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ') // strip control chars yang bisa break JSON.parse
    .trim();

  // Ekstrak blok JSON dari dalam string jika ada teks sebelum/sesudah
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  try {
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
    // Pastikan semua field ada dan bertipe benar
    return {
      voice_response: typeof parsed.voice_response === 'string' && parsed.voice_response.trim()
        ? parsed.voice_response.trim()
        : 'Data percakapan sudah dicatat, dokter.',
      keluhan:    Array.isArray(parsed.keluhan)    ? parsed.keluhan    : [],
      obat:       Array.isArray(parsed.obat)       ? parsed.obat       : [],
      pertanyaan: Array.isArray(parsed.pertanyaan) ? parsed.pertanyaan : [],
      ringkasan:  typeof parsed.ringkasan === 'string' ? parsed.ringkasan : transcript.slice(0, 80),
    };
  } catch {
    // Fallback jika parsing gagal total
    console.warn('[Cenna AI] JSON parse failed, raw:', cleaned.slice(0, 200));
    return {
      voice_response: 'Data percakapan sudah dicatat, dokter.',
      keluhan: [],
      obat: [],
      pertanyaan: [],
      ringkasan: transcript.slice(0, 80),
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
// Semua voice & model dibaca dari localStorage agar bisa diubah dari UI.

const ELEVEN_FREE_VOICES = [
  { id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica',  desc: 'Warm & clear, cocok untuk sapaan' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah',    desc: 'Soft & professional' },
  { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura',    desc: 'Upbeat & friendly' },
  { id: 'iP95p4xoKVk53GoZ742B', name: 'Chris',    desc: 'Casual & conversational (male)' },
  { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian',    desc: 'Deep & authoritative (male)' },
  { id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum',   desc: 'Crisp & neutral (male)' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel',   desc: 'British, warm (male)' },
  { id: 'pqHfZKP75CvOlQylNhV4', name: 'Bill',     desc: 'Mature & calm (male)' },
  { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda',  desc: 'Cheerful & bright' },
];

export { ELEVEN_FREE_VOICES };

async function speakElevenLabs(text: string, onEnd: () => void): Promise<void> {
  const apiKey =
    (import.meta.env.VITE_ELEVENLABS_API_KEY as string | undefined) ||
    (await sbGetSetting<string>('ELEVENLABS_API_KEY')) ||
    '';

  if (!apiKey) {
    console.warn('[Cenna TTS] No ElevenLabs API key — falling back to browser TTS');
    speakBrowser(text, onEnd);
    return;
  }

  const voiceId = (await sbGetSetting<string>('ELEVEN_VOICE_ID')) || 'cgSgspJ2msm6clMCkdW9';
  const speed   = (await sbGetSetting<number>('ELEVEN_SPEED'))   ?? 1.0;

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability:        0.45,
            similarity_boost: 0.80,
            style:            0.20,
            use_speaker_boost: true,
            speed,             // 0.7 – 1.2 didukung eleven_multilingual_v2
          },
        }),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      console.warn('[Cenna TTS] ElevenLabs error:', res.status, err);
      speakBrowser(text, onEnd);
      return;
    }

    const blob  = await res.blob();
    const url   = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => { URL.revokeObjectURL(url); onEnd(); };
    audio.onerror = () => { URL.revokeObjectURL(url); onEnd(); };
    await audio.play();
    const voiceName = ELEVEN_FREE_VOICES.find(v => v.id === voiceId)?.name ?? voiceId;
    console.log(`[Cenna TTS] ElevenLabs playing — ${voiceName} ×${speed}`);
  } catch (err) {
    console.warn('[Cenna TTS] fetch error:', err);
    speakBrowser(text, onEnd);
  }
}

function speakBrowser(text: string, onEnd: () => void): void {
  if (!('speechSynthesis' in window)) { onEnd(); return; }
  window.speechSynthesis.cancel();
  const utt   = new SpeechSynthesisUtterance(text);
  utt.lang    = 'id-ID';
  utt.rate    = 1.0;
  utt.onend   = onEnd;
  utt.onerror = onEnd;
  window.speechSynthesis.speak(utt);
  setTimeout(onEnd, 6000);
}
//
// Perubahan dari v5.1:
// - Hook mengelola mic permission sendiri (tidak bergantung prop `enabled`
//   yang datang terlambat karena getUserMedia async di luar).
// - `active` prop cukup dipakai untuk STOP (saat phase bukan idle).
// - Tambah fallback: jika SpeechRecognition tidak ada, tidak crash.

function useWakeWord(onDetected: () => void, active: boolean) {
  const recRef      = useRef<SpeechRecognition | null>(null);
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningRef  = useRef(false);
  const activeRef   = useRef(active);
  const onDetectedRef = useRef(onDetected);
  // Synchronous ref update — tidak tunggu re-render
  activeRef.current   = active;
  onDetectedRef.current = onDetected;

  const stopRef = useRef<() => void>(() => undefined);

  const stop = useCallback(() => {
    runningRef.current = false;
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    try { recRef.current?.abort(); } catch { /* ignore */ }
    recRef.current = null;
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
      scheduleRestart(200);
    };

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      console.warn('[Cenna wake] error:', e.error);
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        // Mic ditolak → stop total, jangan retry
        stopRef.current();
        return;
      }
      scheduleRestart(e.error === 'no-speech' ? 100 : 800);
    };

    recRef.current = rec;
    try {
      rec.start();
      console.log('[Cenna wake] rec.start() called');
    } catch (err) {
      console.warn('[Cenna wake] rec.start() threw:', err);
      scheduleRestart(800);
    }
  }, []);

  useEffect(() => {
    if (!active) {
      stop();
      return () => stop();
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    // Minta mic permission di sini — hook mengelola sendiri
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(() => {
        console.log('[Cenna wake] mic granted, starting wake listener');
        start();
      })
      .catch((err) => {
        console.warn('[Cenna wake] mic denied:', err);
      });

    return () => stop();
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
    try { recRef.current?.abort(); } catch { /* ignore */ }
    recRef.current = null;
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
      runningRef.current = false;
      recRef.current     = null;
      if (enabledRef.current) setTimeout(start, 150);
    };
    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === 'not-allowed') { stopRef.current(); return; }
      runningRef.current = false;
      recRef.current     = null;
      if (enabledRef.current) setTimeout(start, 800);
    };

    recRef.current = rec;
    try { rec.start(); } catch { setTimeout(start, 800); }
  }, [fireSilence, silenceMs]);

  useEffect(() => {
    if (enabled) { start(); } else { stop(); }
    return () => stop();
  }, [enabled, start, stop]);
}

// ─── Palet processing (ungu elektrik) ────────────────────────────────────────
const PALETTE_PROCESSING = { r: 127, g: 119, b: 221 }; // #7F77DD

// ─── Hook: canvas animasi per fase ───────────────────────────────────────────

function useOrbCanvas(canvasRef: React.RefObject<HTMLCanvasElement | null>, phase: OrbPhase) {
  const angleRef  = useRef(0);
  const animIdRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = (canvas.width  = window.innerWidth);
    let h = (canvas.height = window.innerHeight);
    const onResize = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; };
    window.addEventListener('resize', onResize);

    const draw = () => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2;

      let ringAlpha = 0.07, pulseSpeed = 0.010, ringCount = 3, waveAmp = 8;
      let c1 = PALETTE.navy, c2 = PALETTE.tan;

      if (phase === 'speaking' || phase === 'responding') {
        c1 = PALETTE.tan; c2 = PALETTE.cream; ringAlpha = 0.12; pulseSpeed = 0.030; ringCount = 4; waveAmp = 28;
      } else if (phase === 'listening') {
        c1 = PALETTE.navy; c2 = PALETTE.cream; ringAlpha = 0.14; pulseSpeed = 0.025; ringCount = 5; waveAmp = 40;
      } else if (phase === 'processing') {
        c1 = PALETTE_PROCESSING; c2 = PALETTE.cream; ringAlpha = 0.18; pulseSpeed = 0.055; ringCount = 6; waveAmp = 20;
      } else if (phase === 'popup') {
        c1 = PALETTE.cream; c2 = PALETTE.tan; ringAlpha = 0.08; pulseSpeed = 0.008; ringCount = 3; waveAmp = 6;
      }

      angleRef.current += pulseSpeed;
      const a = angleRef.current;

      const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, 320);
      aura.addColorStop(0,   `rgba(${c1.r},${c1.g},${c1.b},0.06)`);
      aura.addColorStop(0.5, `rgba(${c2.r},${c2.g},${c2.b},0.03)`);
      aura.addColorStop(1,   'rgba(255,255,255,0)');
      ctx.fillStyle = aura;
      ctx.beginPath(); ctx.arc(cx, cy, 320, 0, Math.PI * 2); ctx.fill();

      for (let i = 0; i < ringCount; i++) {
        const t  = i / ringCount;
        const r  = PALETTE.navy.r * (1 - t) + PALETTE.tan.r * t | 0;
        const g  = PALETTE.navy.g * (1 - t) + PALETTE.tan.g * t | 0;
        const b  = PALETTE.navy.b * (1 - t) + PALETTE.tan.b * t | 0;
        const radius = (155 + i * 52) * (1 + Math.sin(a + i * 1.4) * 0.1);
        ctx.strokeStyle = `rgba(${r},${g},${b},${ringAlpha - i * 0.01})`;
        ctx.lineWidth   = 1.2 - i * 0.15;
        ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
      }

      const drawWave = (freq: number, ph: number, amp: number, maxDist: number, alpha: number, lw: number, col: { r: number; g: number; b: number }) => {
        ctx.strokeStyle = `rgba(${col.r},${col.g},${col.b},${alpha})`;
        ctx.lineWidth   = lw;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 8) {
          const dist = Math.abs(x - cx);
          const a2   = dist < maxDist ? amp * Math.cos((dist / maxDist) * (Math.PI / 2)) : 0;
          const y    = cy + Math.sin(x * freq + ph) * a2;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      };

      drawWave(0.013,  a * 2.2,       waveAmp,       450, ringAlpha + 0.04, 1.5, c1);
      drawWave(0.018, -a * 1.7 + 1.2, waveAmp * 0.5, 350, ringAlpha * 0.6,  1.0, c2);

      animIdRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(animIdRef.current);
    };
  }, [phase]);
}

// ─── OrbCore ─────────────────────────────────────────────────────────────────

interface OrbCoreProps { phase: OrbPhase; wakeEnabled: boolean; wakeFlash: boolean; }

function OrbCore({ phase, wakeEnabled, wakeFlash }: OrbCoreProps) {
  const glowColor = {
    idle: '#1e2a4a', speaking: '#b8a898', listening: '#1e2a4a',
    processing: '#7F77DD', responding: '#b8a898', popup: '#b8a898'
  }[phase];
  const orbRing = {
    idle: 'ring-[3px] ring-[#1e2a4a]/20',
    speaking: 'ring-[5px] ring-[#b8a898]/60',
    listening: 'ring-[5px] ring-[#1e2a4a]/40',
    processing: 'ring-[6px] ring-[#7F77DD]/70',
    responding: 'ring-[5px] ring-[#b8a898]/60',
    popup: 'ring-[3px] ring-[#b8a898]/30',
  }[phase];

  return (
    <div className="relative flex items-center justify-center" style={{ width: 340, height: 340 }}>
      {wakeEnabled && phase === 'idle' && (
        <div className="absolute rounded-full pointer-events-none"
          style={{ width: 280, height: 280, border: '1.5px solid rgba(16,185,129,0.35)', animation: 'wakeRingPulse 2.2s ease-in-out infinite' }} />
      )}
      {wakeFlash && (
        <div className="absolute rounded-full pointer-events-none"
          style={{ width: 280, height: 280, border: '2.5px solid rgba(16,185,129,0.7)', animation: 'wakeFlashRing 0.9s ease-out forwards' }} />
      )}
      {phase === 'listening' && (
        <div className="absolute rounded-full pointer-events-none"
          style={{ width: 290, height: 290, border: '1.5px solid rgba(127,119,221,0.45)', animation: 'listeningPulse 1.8s ease-in-out infinite' }} />
      )}
      <div className="absolute rounded-full transition-all duration-700 ease-out"
        style={{ width: 260, height: 260, background: `radial-gradient(circle, ${glowColor}22 0%, transparent 75%)`, filter: 'blur(32px)', transform: `scale(${phase === 'listening' ? 1.12 : 1})` }} />
      <div className={`relative rounded-full flex items-center justify-center border-none transition-all duration-700 ease-out ${orbRing}`}
        style={{ width: 200, height: 200, background: 'conic-gradient(from 0deg, #1e2a4a 0%, #b8a898 35%, #f5f0e8 55%, #b8a898 75%, #1e2a4a 100%)', boxShadow: `0 28px 60px -12px ${glowColor}40, 0 0 0 1px rgba(255,255,255,0.15) inset`, animation: 'orbSpin 14s linear infinite' }}>
        <div className="absolute rounded-full"
          style={{ inset: 6, background: 'radial-gradient(ellipse at 35% 30%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.08) 60%, transparent 100%)' }} />
        <div className="relative flex flex-col items-center justify-center z-10">
          {phase === 'idle' && (
            <div className="flex gap-[5px] items-end h-7">
              {[0.5, 0.75, 1, 0.75, 0.5].map((s, i) => (
                <div key={i} className="w-[3px] rounded-full bg-white/80"
                  style={{ height: `${s * 20}px`, animation: `barBounce 1.6s ease-in-out ${i * 0.14}s infinite alternate`, opacity: 0.6 + s * 0.3 }} />
              ))}
            </div>
          )}
          {(phase === 'speaking' || phase === 'responding') && (
            <div className="flex gap-[5px] items-end h-7">
              {[0.6, 0.9, 1, 0.8, 0.5, 0.7, 0.4].map((s, i) => (
                <div key={i} className="w-[3px] rounded-full bg-white"
                  style={{ height: `${s * 24}px`, animation: `barBounce 0.45s ease-in-out ${i * 0.06}s infinite alternate` }} />
              ))}
            </div>
          )}
          {phase === 'processing' && (
            <div className="flex gap-[6px] items-center">
              {[0,1,2,3,4,5].map(i => (
                <div key={i} className="rounded-full"
                  style={{ width: 4, height: 4, background: 'rgba(255,255,255,0.9)', animation: `processingDot 1.1s ease-in-out ${i*0.12}s infinite` }} />
              ))}
            </div>
          )}
          {phase === 'listening' && (
            <div className="flex gap-[6px] items-center">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-full bg-white"
                  style={{ width: `${4 + i % 2 * 2}px`, height: `${4 + i % 2 * 2}px`, animation: `dotPulse 1.0s ease-in-out ${i * 0.18}s infinite` }} />
              ))}
            </div>
          )}
          {phase === 'popup' && (
            <div className="flex items-center justify-center w-10 h-10">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M6 14l6 6L22 8" stroke="rgba(255,255,255,0.9)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}
        </div>
      </div>
      <div className="absolute rounded-full border border-[#1e2a4a]/10 pointer-events-none"
        style={{ width: 236, height: 236, animation: 'spinSlow 18s linear infinite reverse', borderStyle: 'dashed', borderWidth: '1px' }} />
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

// ─── DataPopup ────────────────────────────────────────────────────────────────

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
  const [customLogoUrl, setCustomLogoUrl] = useState<string | null>(null);
  const [aiLabel,      setAiLabel]      = useState('Cenna sedang berpikir…');
  const [aiEnabled,    setAiEnabled]    = useState(false); // true jika AI key tersedia
  const conversationHistoryRef = useRef<Array<{ role: 'user'|'assistant'; content: string }>>([]);

  useEffect(() => {
    sbGetSetting<{ logoUrl?: string }>('branding').then(b => {
      if (b?.logoUrl) setCustomLogoUrl(b.logoUrl);
    });
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

  useOrbCanvas(canvasRef, phase);

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

    setWakeFlash(true);
    setTimeout(() => setWakeFlash(false), 900);
    setPhase('speaking');

    const goListening = () => {
      console.log('[Cenna] → listening');
      setPhase('listening');
    };

    // ElevenLabs TTS — Charlotte menyapa dokter
    speakElevenLabs('Halo dokter, ada yang bisa Cenna bantu?', goListening);
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
    if (!aiEnabled) {
      // Fallback: mode lama tanpa AI
      setCapturedData(data);
      setPhase('popup');
      return;
    }

    // Mode AI: masuk fase processing
    // Snapshot history SEBELUM push agar tidak stale di closure
    const currentHistory = conversationHistoryRef.current;
    currentHistory.push({ role: 'user', content: data.transcript });
    setPhase('processing');
    setAiLabel('Menganalisis percakapan…');

    try {
      setAiLabel('Cenna sedang berpikir…');
      const aiResult = await callCennaAI(data.transcript);

      // Simpan respons AI ke history percakapan
      currentHistory.push({ role: 'assistant', content: aiResult.voice_response });

      // Fase responding: ucapkan respons AI via TTS
      setPhase('responding');
      const enrichedData: CapturedData = {
        ...data,
        keluhan:    aiResult.keluhan.length    ? aiResult.keluhan    : data.keluhan,
        obat:       aiResult.obat.length       ? aiResult.obat       : data.obat,
        pertanyaan: aiResult.pertanyaan.length ? aiResult.pertanyaan : data.pertanyaan,
      };

      speakElevenLabs(aiResult.voice_response, () => {
        setCapturedData(enrichedData);
        setPhase('popup');
      });

    } catch (err) {
      console.warn('[Cenna AI] gagal:', err);
      // Pop entry user yang sudah di-push agar history tidak kotor
      currentHistory.pop();
      // Fallback ke popup tanpa AI response
      setCapturedData(data);
      setPhase('popup');
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
    // Kembali ke listening jika history masih ada (chaining conversation)
    // Gunakan < 8 (bukan 10) untuk beri margin aman sebelum batas
    if (aiEnabled && conversationHistoryRef.current.length > 0 && conversationHistoryRef.current.length < 8) {
      setPhase('listening');
    } else {
      conversationHistoryRef.current = [];
      firedRef.current = false; // reset wake guard saat kembali ke idle
      setPhase('idle');
    }
  };

  const handleEndConversation = () => {
    conversationHistoryRef.current = [];
    setCapturedData(null);
    firedRef.current = false;
    setPhase('idle');
  };

  const handleSOAP = () => {
    conversationHistoryRef.current = [];
    setCapturedData(null);
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

      <div className="relative z-10 flex flex-col items-center justify-center text-center">
        <OrbCore phase={phase} wakeEnabled={phase === 'idle'} wakeFlash={wakeFlash} />
        <div className="mt-5" style={{ minHeight: 44 }}>
          {phase === 'idle' && !hasSpeechAPI && (
            <p className="text-[9px] tracking-[0.1em] text-[#1e2a4a]/25" style={{ fontFamily: "'DM Mono', monospace" }}>
              Wake word tidak didukung browser ini
            </p>
          )}
          {phase === 'idle' && hasSpeechAPI && (
            <p className="text-[10px] tracking-[0.1em] text-[#1e2a4a]/25" style={{ fontFamily: "'DM Mono', monospace" }}>
              {aiEnabled ? '✦ AI Voice Assistant aktif' : '◦ Mode dasar aktif'}
            </p>
          )}
          {phase === 'speaking' && (
            <p className="text-[11px] tracking-[0.1em] text-[#b8a898]" style={{ fontFamily: "'DM Mono', monospace", animation: 'fadeIn 0.5s ease' }}>
              Cenna menyapa…
            </p>
          )}
          {phase === 'listening' && (
            <>
              <p className="text-[11px] tracking-[0.1em] text-[#7F77DD]" style={{ fontFamily: "'DM Mono', monospace", animation: 'fadeIn 0.5s ease' }}>
                Mendengarkan — jeda 3 detik untuk diproses
              </p>
              {conversationHistoryRef.current.length > 0 && (
                <p className="text-[9px] tracking-[0.08em] text-[#7F77DD]/50 mt-1" style={{ fontFamily: "'DM Mono', monospace" }}>
                  ronde {Math.ceil(conversationHistoryRef.current.length / 2)} percakapan
                </p>
              )}
            </>
          )}
          {phase === 'processing' && (
            <p className="text-[11px] tracking-[0.1em]" style={{ fontFamily: "'DM Mono', monospace", color: '#7F77DD', animation: 'fadeIn 0.3s ease' }}>
              {aiLabel}
            </p>
          )}
          {phase === 'responding' && (
            <p className="text-[11px] tracking-[0.1em] text-[#10b981]" style={{ fontFamily: "'DM Mono', monospace", animation: 'fadeIn 0.3s ease' }}>
              Cenna merespons…
            </p>
          )}
        </div>
      </div>

      <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center gap-2 z-10">
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

      {phase === 'popup' && capturedData && (
        <DataPopup
          data={capturedData}
          onClose={handleClosePopup}
          onSOAP={handleSOAP}
          canContinue={conversationHistoryRef.current.length > 0 && conversationHistoryRef.current.length < 10}
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

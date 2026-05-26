/**
 * @license SPDX-License-Identifier: Apache-2.0
 *
 * ai-engine.ts — Logika AI anamnesis CENNA
 * Dipecah dari LandingPage.tsx
 */

import { sbGetSetting, DEFAULT_PROMPT_ANAMNESIS, DEFAULT_PROMPT_CONCLUSION, sbGetActiveTemplate } from '../../lib/supabase';
import { callActiveAI } from '../ApiSettings';
import { speak } from './tts-engine';
import type { AnamnesisData, ClinicalConclusion, ConversationTemplate } from '../../types';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface CapturedData {
  transcript: string;
  keluhan:    string[];   // untuk konteks AI anamnesis
  waktu:      string;
  anamnesis?: AnamnesisData;
  conclusion?: ClinicalConclusion | null;
}

// ─── Wake-word patterns ───────────────────────────────────────────────────────
function normalizeText(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const WAKE_PATTERNS = [
  'hai cenna', 'hei cenna', 'hey cenna', 'hi cenna',
  'hai senna', 'hei senna', 'hey senna', 'hi senna',
  'hai tenna', 'hei tenna', 'hai cena',  'hey cena',
  'hai xena',  'hai zena',  'hai kena',  'hei kena',
  'hei sena',  'hai sen na', 'hai ce na', 'hey se na',
  'hai sen a', 'hei sen a', 'hey sen a',
  'hai chena', 'hei chena', 'hey chena',
  'hai tsena', 'hai dsena', 'hai nena',
  'hai sana',  'hei sana',  'hey sana',
  'hai sina',  'hei sina',
  'hai rena',  'hei rena',
  'hai dena',  'hei dena',
  'hai fena',  'hei fena',
  'hai wena',  'hei wena',
  'haicenna',  'heicenna',  'hicenna',
  'haisenna',  'heisenna',
];

export function matchesWakeWord(raw: string): boolean {
  const t = normalizeText(raw);
  console.log('[Cenna wake] normalizing:', JSON.stringify(raw), '→', JSON.stringify(t));
  if (WAKE_PATTERNS.some((p) => t.includes(p))) {
    console.log('[Cenna wake] ✓ MATCHED (pattern) on:', JSON.stringify(t));
    return true;
  }
  const fuzzy = /\b(hai|hei|hey|hi)\s+[a-z]{4,7}\b/.test(t);
  if (fuzzy) console.log('[Cenna wake] ✓ MATCHED (fuzzy) on:', JSON.stringify(t));
  else       console.log('[Cenna wake] ✗ no match for:', JSON.stringify(t));
  return fuzzy;
}

// ─── Closing patterns ─────────────────────────────────────────────────────────
const CLOSING_PATTERNS = [
  'terima kasih cenna', 'terima kasih senna', 'terima kasih kena',
  'makasih cenna', 'makasih senna',
  'cukup cenna', 'cukup senna',
  'selesai cenna', 'selesai senna',
  'stop cenna', 'stop senna',
  'akhiri sesi', 'akhiri konsultasi',
];

export function matchesClosingWord(raw: string): boolean {
  const t = normalizeText(raw);
  return CLOSING_PATTERNS.some(p => t.includes(p));
}

// ─── Cache ────────────────────────────────────────────────────────────────────
// BUG-H1 FIX: Tambah TTL 5 menit agar perubahan prompt admin efektif tanpa reload
const AI_CACHE_TTL = 5 * 60 * 1000;
let _cachedAnamnesisPrompt:   string | null = null;
let _cachedAnamnesisPromptTs: number = 0;
let _cachedAiBehavior: {
  ddxCount: number; profile: string; ddx: boolean; ebm: boolean;
  uncertain: boolean; followup: boolean; edu: boolean; lang: string;
} | null = null;
let _cachedAiBehaviorTs: number = 0;

// Cache untuk conclusion prompt (terpisah dari anamnesis prompt)
let _cachedConclusionPrompt:   string | null = null;
let _cachedConclusionPromptTs: number = 0;

// ─── Template mode state ──────────────────────────────────────────────────────
export let _activeTemplate: ConversationTemplate | null = null;
export let _templateStepIndex: number = 0;
export let _templateDone: boolean = false;

export function setActiveTemplate(t: ConversationTemplate | null) { _activeTemplate = t; }
export function setTemplateStepIndex(i: number) { _templateStepIndex = i; }
export function setTemplateDone(v: boolean) { _templateDone = v; }

async function getAnamnesisPrompt(): Promise<string> {
  const now = Date.now();
  // BUG-H1 FIX: cache TTL check — expired setelah 5 menit
  if (_cachedAnamnesisPrompt !== null && now - _cachedAnamnesisPromptTs < AI_CACHE_TTL) return _cachedAnamnesisPrompt;
  const db = await sbGetSetting<string>('prompt_anamnesis');
  _cachedAnamnesisPrompt   = db || DEFAULT_PROMPT_ANAMNESIS;
  _cachedAnamnesisPromptTs = now;
  console.log('[Cenna AI] Prompt anamnesis loaded from', db ? 'database' : 'default fallback');
  return _cachedAnamnesisPrompt;
}

async function getAiBehavior() {
  const now = Date.now();
  if (_cachedAiBehavior !== null && now - _cachedAiBehaviorTs < AI_CACHE_TTL) return _cachedAiBehavior;
  const db = await sbGetSetting<{
    ddxCount: number; profile: string; ddx: boolean; ebm: boolean;
    uncertain: boolean; followup: boolean; edu: boolean; lang: string;
  }>('ai_behavior');
  _cachedAiBehavior   = db || { ddxCount: 3, profile: 'gp', ddx: true, ebm: true, uncertain: true, followup: true, edu: true, lang: 'id' };
  _cachedAiBehaviorTs = now;
  console.log('[Cenna AI] AI behavior loaded from', db ? 'database' : 'default fallback');
  return _cachedAiBehavior;
}

async function getConclusionPrompt(): Promise<string> {
  const now = Date.now();
  if (_cachedConclusionPrompt !== null && now - _cachedConclusionPromptTs < AI_CACHE_TTL) return _cachedConclusionPrompt;
  const db = await sbGetSetting<string>('prompt_conclusion');
  _cachedConclusionPrompt   = db || DEFAULT_PROMPT_CONCLUSION;
  _cachedConclusionPromptTs = now;
  console.log('[Cenna AI] Prompt conclusion loaded from', db ? 'database' : 'default fallback');
  return _cachedConclusionPrompt;
}

// ─── Anamnesis state (lintas ronde) ──────────────────────────────────────────
export let _currentAnamnesis: AnamnesisData = {
  provokasi: '', kualitas: '', radiasi: '', skala: '', waktu: '',
  rpd: '', rpk: '', rps: '', pemfis: '',
  phase: 'gathering', missing_fields: [],
};

export function mergeAnamnesis(prev: AnamnesisData, next: Partial<AnamnesisData>): AnamnesisData {
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

export function resetAnamnesisState() {
  _currentAnamnesis = {
    provokasi: '', kualitas: '', radiasi: '', skala: '', waktu: '',
    rpd: '', rpk: '', rps: '', pemfis: '',
    phase: 'gathering', missing_fields: [],
  };
  // BUG-H1 FIX: Reset cache timestamps agar prompt di-fetch ulang di sesi berikutnya
  _cachedAnamnesisPrompt    = null;
  _cachedAnamnesisPromptTs  = 0;
  _cachedAiBehavior         = null;
  _cachedAiBehaviorTs       = 0;
  // Reset conclusion prompt cache juga
  _cachedConclusionPrompt   = null;
  _cachedConclusionPromptTs = 0;
  _activeTemplate    = null;
  _templateStepIndex = 0;
  _templateDone      = false;
}

// ─── Fuzzy match trigger ──────────────────────────────────────────────────────
export function fuzzyMatchTrigger(userSpeech: string, triggerText: string): boolean {
  if (!triggerText || !triggerText.trim()) return true;
  const normalize = (s: string) =>
    s.toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ').trim();

  const speech  = normalize(userSpeech);
  const trigger = normalize(triggerText);
  const STOP = new Set(['yang', 'dengan', 'dari', 'untuk', 'pada', 'adalah', 'ada', 'dan', 'atau']);
  // BUG-L2 FIX: gunakan semua kata jika tidak ada kata panjang (>3 char)
  // Sebelumnya: jika words.length===0, langsung exact match — terlalu ketat untuk trigger pendek
  const longWords = trigger.split(' ').filter(w => w.length > 3 && !STOP.has(w));
  const words = longWords.length > 0 ? longWords : trigger.split(' ').filter(Boolean);
  if (words.length === 0) return speech.includes(trigger);
  const matched   = words.filter(w => speech.includes(w));
  const threshold = Math.max(1, Math.ceil(words.length * 0.5));
  const isMatch   = matched.length >= threshold;
  console.log(`[Cenna Template] fuzzy: "${speech.slice(0, 50)}" vs trigger "${trigger.slice(0, 40)}" → ${matched.length}/${words.length} (need ${threshold}) → ${isMatch ? '✓' : '✗'}`);
  return isMatch;
}

// ─── Entitas klinis ───────────────────────────────────────────────────────────
export function extractEntities(text: string): Pick<CapturedData, 'keluhan'> {
  const sentences = text.split(/[.,;!?]+/).map(s => s.trim()).filter(Boolean);
  const keluhanKeywords = ['nyeri', 'sakit', 'pusing', 'mual', 'muntah', 'sesak', 'batuk', 'demam', 'lemas', 'lelah', 'gatal', 'bengkak', 'diare'];
  const keluhan: string[] = [];
  sentences.forEach(s => {
    const sl = s.toLowerCase();
    if (keluhanKeywords.some(k => sl.includes(k))) keluhan.push(s);
  });
  return { keluhan };
}

// ─── callCennaAI ─────────────────────────────────────────────────────────────
export async function callCennaAI(
  transcript: string,
  history: Array<{ role: 'user'|'assistant'; content: string }>,
  roundNumber: number = 1,
): Promise<{
  voice_response: string;
  keluhan: string[];
  red_flags: string[];
  anamnesis: AnamnesisData;
  conclusion: ClinicalConclusion | null;
  session_end: boolean;
}> {
  const systemPrompt = await getAnamnesisPrompt();
  const behavior     = await getAiBehavior();

  const behaviorCtx = [
    behavior.ddx     ? `- Sertakan ${behavior.ddxCount} diagnosis banding teratas dengan probabilitas.` : '- Jangan sertakan diagnosis banding.',
    behavior.ebm     ? '- Gunakan pendekatan evidence-based medicine (EBM).' : '',
    behavior.uncertain ? '- Nyatakan ketidakpastian klinis secara eksplisit jika data belum cukup.' : '',
    behavior.followup  ? '- Sarankan rencana tindak lanjut yang jelas.' : '',
    behavior.edu       ? '- Sertakan poin edukasi pasien yang relevan.' : '',
    behavior.lang && behavior.lang !== 'id' ? `- Gunakan bahasa: ${behavior.lang}.` : '',
    behavior.profile === 'specialist' ? '- Berpikir seperti dokter SPESIALIS KONSULTAN.' : '',
    behavior.profile === 'emergency'  ? '- PRIORITASKAN red flag dan tatalaksana emergensi.' : '',
    behavior.profile === 'pediatric'  ? '- Perhatikan dosis dan pertimbangan khusus pasien anak.' : '',
  ].filter(Boolean).join('\n');

  const enrichedPrompt = behaviorCtx
    ? `${systemPrompt}\n\n== INSTRUKSI PERILAKU (dari konfigurasi admin) ==\n${behaviorCtx}`
    : systemPrompt;

  const anamnesisCtx  = JSON.stringify(_currentAnamnesis, null, 2);
  const historyContext = history.length > 0
    ? '\n\nKonteks percakapan sebelumnya:\n' +
      history.map(h => `[${h.role === 'user' ? 'Dokter/Pasien' : 'CENNA'}]: ${h.content}`).join('\n')
    : '';

  const MIN_ROUNDS = 3;
  const roundCtx = roundNumber < MIN_ROUNDS
    ? `[SISTEM: Ini ronde ke-${roundNumber} dari minimum ${MIN_ROUNDS} ronde. JANGAN menyimpulkan atau set session_end:true dulu.]`
    : `[SISTEM: Ini ronde ke-${roundNumber}. Boleh menyimpulkan dan set session_end:true HANYA jika data anamnesis sudah benar-benar lengkap.]`;

  const raw = await callActiveAI(
    enrichedPrompt,
    `${roundCtx}\n\nStatus anamnesis saat ini:\n${anamnesisCtx}${historyContext}\n\n[Transkrip baru]:\n"${transcript}"\n\nInstruksi:\n- Evaluasi missing_fields di atas\n- Ajukan 1-2 pertanyaan lanjutan yang paling penting secara klinis\n- Tetap di phase "gathering" selama masih ada field penting yang belum tergali\n- Set session_end:true dan sertakan conclusion HANYA jika ronde sudah cukup dan anamnesis benar-benar lengkap`
  );

  const cleaned = raw.replace(/```json|```/gi, '').replace(/[\u0000-\u001F\u007F]/g, ' ').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);

  try {
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
    if (parsed.anamnesis) _currentAnamnesis = mergeAnamnesis(_currentAnamnesis, parsed.anamnesis);
    if (parsed.phase === 'complete') _currentAnamnesis.phase = 'complete';

    const hasValidConclusion = parsed.conclusion
      && typeof parsed.conclusion === 'object'
      && typeof parsed.conclusion.diagnosis_utama === 'string'
      && parsed.conclusion.diagnosis_utama.trim().length > 0;

    const minRoundsMet = history.length >= 4 || matchesClosingWord(transcript);
    const isComplete   = minRoundsMet && (parsed.session_end === true || matchesClosingWord(transcript));
    console.log('[Cenna AI] ronde:', history.length, '| session_end raw:', parsed.session_end, '| isComplete:', isComplete, '| hasConclusion:', hasValidConclusion);

    return {
      voice_response: typeof parsed.voice_response === 'string' && parsed.voice_response.trim()
        ? parsed.voice_response.trim() : 'Data sudah dicatat, dokter.',
      keluhan:    Array.isArray(parsed.keluhan)   ? parsed.keluhan   : [],
      red_flags:  Array.isArray(parsed.red_flags) ? parsed.red_flags : [],
      anamnesis:  { ..._currentAnamnesis },
      conclusion: hasValidConclusion ? parsed.conclusion : null,
      session_end: isComplete,
    };
  } catch {
    console.warn('[Cenna AI] JSON parse failed, raw:', cleaned.slice(0, 200));
    return {
      voice_response: 'Data percakapan sudah dicatat, dokter.',
      keluhan: [], red_flags: [],
      anamnesis: { ..._currentAnamnesis },
      conclusion: null,
      session_end: matchesClosingWord(transcript),
    };
  }
}

// ─── generateConclusion — Fase 2: Kesimpulan klinis dengan prompt khusus ──────
// Dipanggil SEKALI setelah session_end:true, terpisah dari callCennaAI.
// Menggunakan prompt_conclusion dari DB agar lebih fokus & akurat daripada
// prompt anamnesis yang harus juga bertanya.
export async function generateConclusion(
  anamnesis: AnamnesisData,
  fullTranscript: string,
): Promise<{ conclusion: ClinicalConclusion; red_flags: string[] } | null> {
  const systemPrompt = await getConclusionPrompt();
  const behavior     = await getAiBehavior();

  // Inject behavior context ke conclusion prompt juga
  const behaviorCtx = [
    behavior.ddx ? `- Sertakan ${behavior.ddxCount} diagnosis banding teratas.` : '- Tidak perlu diagnosis banding.',
    behavior.ebm ? '- Gunakan pendekatan evidence-based medicine.' : '',
    behavior.uncertain ? '- Nyatakan ketidakpastian jika data kurang.' : '',
    behavior.edu ? '- Sertakan poin edukasi pasien.' : '',
    behavior.profile === 'specialist' ? '- Analisis seperti SPESIALIS KONSULTAN.' : '',
    behavior.profile === 'emergency'  ? '- PRIORITASKAN tatalaksana emergensi.' : '',
    behavior.profile === 'pediatric'  ? '- Pertimbangkan dosis dan kondisi khusus anak.' : '',
  ].filter(Boolean).join('\n');

  const enrichedPrompt = behaviorCtx
    ? `${systemPrompt}\n\n== INSTRUKSI PERILAKU ==\n${behaviorCtx}`
    : systemPrompt;

  const userMsg = [
    `DATA ANAMNESIS PQRST:\n${JSON.stringify(anamnesis, null, 2)}`,
    `\nTRANSKRIP PERCAKAPAN LENGKAP:\n"${fullTranscript}"`,
    `\nBuat kesimpulan klinis dalam format JSON yang diminta. Hanya JSON, tidak ada teks lain.`,
  ].join('\n');

  console.log('[Cenna AI] generateConclusion — memanggil prompt_conclusion...');
  const raw = await callActiveAI(enrichedPrompt, userMsg);
  const cleaned = raw.replace(/```json|```/gi, '').replace(/[\u0000-\u001F\u007F]/g, ' ').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);

  try {
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
    if (!parsed.diagnosis_utama || typeof parsed.diagnosis_utama !== 'string' || !parsed.diagnosis_utama.trim()) {
      console.warn('[Cenna AI] generateConclusion: diagnosis_utama kosong, skip.');
      return null;
    }
    const conclusion: ClinicalConclusion = {
      diagnosis_utama:   parsed.diagnosis_utama.trim(),
      diagnosis_banding: Array.isArray(parsed.diagnosis_banding) ? parsed.diagnosis_banding : [],
      tatalaksana:       Array.isArray(parsed.tatalaksana)       ? parsed.tatalaksana       : [],
      edukasi:           Array.isArray(parsed.edukasi)           ? parsed.edukasi           : [],
      red_flags:         Array.isArray(parsed.red_flags)         ? parsed.red_flags         : [],
      prognosis:         typeof parsed.prognosis === 'string'    ? parsed.prognosis         : '',
    };
    console.log('[Cenna AI] generateConclusion ✓ diagnosis:', conclusion.diagnosis_utama);
    return { conclusion, red_flags: conclusion.red_flags };
  } catch (e) {
    console.warn('[Cenna AI] generateConclusion JSON parse failed:', cleaned.slice(0, 300));
    return null;
  }
}

// ─── getWakeGreeting dari DB ──────────────────────────────────────────────────
export async function getWakeGreeting(): Promise<string> {
  const cfg = await sbGetSetting<{ wakeGreeting?: string }>('landing_config');
  return cfg?.wakeGreeting || 'Halo dokter, ada yang bisa saya bantu?';
}

// ─── handleWakeWordFlow — dipanggil setelah wake word terdeteksi ──────────────
export async function handleWakeWordFlow(
  onPhase: (p: string) => void,
  onTemplateColors: (c: { primary: string; secondary: string } | null) => void,
  onTemplateName: (n: string | null) => void,
) {
  const greeting = await getWakeGreeting();
  const goListening = () => { console.log('[Cenna] → listening'); onPhase('listening'); };

  try {
    const tpl = await sbGetActiveTemplate();
    if (tpl && tpl.steps.length > 0) {
      _activeTemplate    = tpl;
      _templateStepIndex = 0;
      _templateDone      = false;
      onTemplateName(tpl.name);
      const tplGreeting = tpl.greeting || greeting;
      const step0 = tpl.steps[0];
      if (step0) onTemplateColors({ primary: step0.orb_primary, secondary: step0.orb_secondary });
      console.log('[Cenna] Template mode aktif:', tpl.name);
      speak(tplGreeting, goListening);
    } else {
      speak(greeting, goListening);
    }
  } catch {
    speak(greeting, goListening);
  }
}

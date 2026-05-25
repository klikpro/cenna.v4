/**
 * @license SPDX-License-Identifier: Apache-2.0
 *
 * tts-engine.ts — Semua fungsi Text-to-Speech CENNA
 * Dipecah dari LandingPage.tsx agar mudah di-maintain dan di-test.
 */

import { sbGetSetting } from '../../lib/supabase';

// ─── BUG-M6 FIX: In-memory settings cache dengan TTL 5 menit ─────────────────
// Mengurangi DB calls dari 20+ per sesi menjadi 1x per 5 menit per key
const _settingsCache = new Map<string, { value: unknown; ts: number }>();
const _CACHE_TTL = 5 * 60 * 1000; // 5 menit

async function getCached<T>(key: string): Promise<T | null> {
  const cached = _settingsCache.get(key);
  if (cached && Date.now() - cached.ts < _CACHE_TTL) return cached.value as T;
  const value = await sbGetSetting<T>(key);
  _settingsCache.set(key, { value, ts: Date.now() });
  return value;
}

/** Invalidasi cache TTS — dipanggil setelah admin simpan config */
export function invalidateTtsCache(): void {
  _settingsCache.clear();
  console.debug('[TTS] Settings cache cleared');
}

// ─── TTS Constants (di-export untuk backward compat dengan ApiSettings.tsx) ──
export const TTS_PROVIDERS = [
  { id: 'elevenlabs', label: 'ElevenLabs (Rekomendasi)' },
  { id: 'google',     label: 'Google Cloud TTS' },
  { id: 'openai',     label: 'OpenAI TTS' },
  { id: 'azure',      label: 'Microsoft Azure TTS' },
  { id: 'browser',    label: 'Browser Built-in (Gratis)' },
];

export const ELEVEN_FREE_VOICES = [
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', desc: 'Female, Calm & Composed' },
  { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi',   desc: 'Female, Strong & Confident' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella',  desc: 'Female, Soft & Warm' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni', desc: 'Male, Well-rounded' },
  { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli',   desc: 'Female, Emotional' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh',   desc: 'Male, Deep & Natural' },
  { id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', desc: 'Male, Crisp & Clear' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam',   desc: 'Male, Narration Style' },
  { id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam',    desc: 'Male, Raspy & Mature' },
];

export const GOOGLE_TTS_VOICES = [
  { id: 'id-ID-Wavenet-A', name: 'Indonesian Female A', desc: 'WaveNet — natural quality' },
  { id: 'id-ID-Wavenet-B', name: 'Indonesian Male B',   desc: 'WaveNet — natural quality' },
  { id: 'id-ID-Wavenet-C', name: 'Indonesian Female C', desc: 'WaveNet — natural quality' },
  { id: 'id-ID-Wavenet-D', name: 'Indonesian Male D',   desc: 'WaveNet — natural quality' },
  { id: 'id-ID-Standard-A', name: 'Indonesian Female', desc: 'Standard quality' },
  { id: 'id-ID-Standard-B', name: 'Indonesian Male',   desc: 'Standard quality' },
];

export const OPENAI_TTS_VOICES = [
  { id: 'alloy',   name: 'Alloy',   desc: 'Neutral, Balanced' },
  { id: 'echo',    name: 'Echo',    desc: 'Male, Clear' },
  { id: 'fable',   name: 'Fable',   desc: 'British accent' },
  { id: 'onyx',    name: 'Onyx',    desc: 'Male, Deep & Authoritative' },
  { id: 'nova',    name: 'Nova',    desc: 'Female, Energetic' },
  { id: 'shimmer', name: 'Shimmer', desc: 'Female, Soft & Pleasant' },
];

export const AZURE_TTS_VOICES = [
  { id: 'id-ID-GadisNeural', name: 'Gadis',  desc: 'Female, Indonesian Neural' },
  { id: 'id-ID-ArdiNeural',  name: 'Ardi',   desc: 'Male, Indonesian Neural' },
  { id: 'en-US-JennyNeural', name: 'Jenny',  desc: 'Female, English US' },
  { id: 'en-US-GuyNeural',   name: 'Guy',    desc: 'Male, English US' },
];



// ─── Flag global: true selama TTS sedang memutar suara ───────────────────────
// Digunakan ambient listener untuk mengabaikan input saat Cenna berbicara.
let _isSpeaking = false;
export function isTtsSpeaking() { return _isSpeaking; }

// ─── Pilih suara browser terbaik untuk Bahasa Indonesia ──────────────────────
function getBrowserVoiceID(): SpeechSynthesisVoice | null {
  if (!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find(v => v.lang === 'id-ID') ||
    voices.find(v => v.lang.startsWith('id')) ||
    voices.find(v => v.lang === 'ms-MY') ||
    voices[0] ||
    null
  );
}

// ─── ElevenLabs TTS ───────────────────────────────────────────────────────────
export async function speakElevenLabs(text: string, onEnd: () => void): Promise<boolean> {
  const apiKey =
    ((import.meta as unknown as { env: Record<string, string> }).env.VITE_ELEVENLABS_API_KEY) ||
    (await getCached<string>('ELEVENLABS_API_KEY')) || '';
  if (!apiKey) return false;

  const voiceId = (await getCached<string>('ELEVEN_VOICE_ID')) || '';
  if (!voiceId) { console.warn('[TTS:EL] ELEVEN_VOICE_ID belum dikonfigurasi'); return false; }
  const speed = (await getCached<number>('ELEVEN_SPEED')) ?? 1.0;

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
    // BUG-M1 FIX: wrap play() agar tidak stuck jika mobile autoplay policy menolak
    try { await audio.play(); } catch (playErr) { console.warn('[TTS:EL] play() rejected:', playErr); URL.revokeObjectURL(url); onEnd(); return false; }
    return true;
  } catch (e) { console.warn('[TTS:EL] fetch error:', e); return false; }
}

// ─── Google Cloud TTS ─────────────────────────────────────────────────────────
export async function speakGoogle(text: string, onEnd: () => void): Promise<boolean> {
  const apiKey = (await getCached<string>('GOOGLE_TTS_KEY')) || '';
  if (!apiKey) return false;

  const voiceName    = (await getCached<string>('GOOGLE_TTS_VOICE')) || '';
  const speakingRate = (await getCached<number>('GOOGLE_TTS_RATE')) ?? 1.0;

  try {
    const res = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text },
          voice: { languageCode: 'id-ID', name: voiceName || undefined },
          audioConfig: { audioEncoding: 'MP3', speakingRate },
        }),
      },
    );
    if (!res.ok) { console.warn('[TTS:GCP] error', res.status); return false; }
    const { audioContent } = await res.json();
    if (!audioContent) return false;
    const audio = new Audio(`data:audio/mp3;base64,${audioContent}`);
    // BUG-M1 FIX: wrap play()
    try { await audio.play(); } catch (e) { console.warn('[TTS:GCP] play() rejected:', e); onEnd(); return false; }
    audio.onended = onEnd;
    audio.onerror = () => onEnd();
    return true;
  } catch (e) { console.warn('[TTS:GCP] error:', e); return false; }
}

// ─── OpenAI TTS ───────────────────────────────────────────────────────────────
export async function speakOpenAI(text: string, onEnd: () => void): Promise<boolean> {
  const apiKey = (await getCached<string>('OPENAI_TTS_KEY')) || '';
  if (!apiKey) return false;

  const voice = (await getCached<string>('OPENAI_TTS_VOICE')) || 'shimmer';
  const model = (await getCached<string>('OPENAI_TTS_MODEL')) || 'tts-1';

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
    // BUG-M1 FIX: wrap play()
    try { await audio.play(); } catch (e) { console.warn('[TTS:OAI] play() rejected:', e); URL.revokeObjectURL(url); onEnd(); return false; }
    return true;
  } catch (e) { console.warn('[TTS:OAI] error:', e); return false; }
}

// ─── Microsoft Azure TTS ──────────────────────────────────────────────────────
export async function speakAzure(text: string, onEnd: () => void): Promise<boolean> {
  const subscriptionKey = (await getCached<string>('AZURE_TTS_KEY')) || '';
  const region          = (await getCached<string>('AZURE_TTS_REGION')) || 'southeastasia';
  if (!subscriptionKey) return false;

  const voiceName    = (await getCached<string>('AZURE_TTS_VOICE'))  || 'id-ID-GadisNeural';
  const speakingRate = (await getCached<number>('AZURE_TTS_RATE')) ?? 1.0;
  const ratePercent  = Math.round((speakingRate - 1) * 100);
  const rateStr      = ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`;

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
    // BUG-M1 FIX: wrap play()
    try { await audio.play(); } catch (e) { console.warn('[TTS:AZ] play() rejected:', e); URL.revokeObjectURL(url); onEnd(); return false; }
    return true;
  } catch (e) { console.warn('[TTS:AZ] error:', e); return false; }
}

// ─── Browser Web Speech TTS — fallback akhir ─────────────────────────────────
export function speakBrowser(text: string, onEnd: () => void): void {
  if (!('speechSynthesis' in window)) { onEnd(); return; }
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  const idVoice = getBrowserVoiceID();
  if (idVoice) utt.voice = idVoice;
  utt.lang  = 'id-ID';
  utt.rate  = 1.0;
  utt.pitch = 1.0;
  const estimatedMs = Math.max(3000, text.length * 65);
  let ended = false;
  const finish = () => { if (ended) return; ended = true; onEnd(); };
  utt.onend   = finish;
  utt.onerror = finish;
  window.speechSynthesis.speak(utt);
  setTimeout(finish, estimatedMs);
}

// ─── speak() — entry point utama ─────────────────────────────────────────────
export async function speak(text: string, onEnd: () => void): Promise<void> {
  _isSpeaking = true;
  const preferredProvider = (await getCached<string>('tts_provider')) || 'elevenlabs';

  const safeOnEnd = () => {
    setTimeout(() => {
      _isSpeaking = false;
      console.log('[TTS] selesai — mic kembali aktif');
      onEnd();
    }, 500);
  };

  const tryProviders = async (order: string[]): Promise<void> => {
    for (const p of order) {
      let ok = false;
      if      (p === 'elevenlabs') ok = await speakElevenLabs(text, safeOnEnd);
      else if (p === 'google')     ok = await speakGoogle(text, safeOnEnd);
      else if (p === 'openai')     ok = await speakOpenAI(text, safeOnEnd);
      else if (p === 'azure')      ok = await speakAzure(text, safeOnEnd);
      else if (p === 'browser')    { speakBrowser(text, safeOnEnd); return; }
      if (ok) { console.log(`[TTS] playing via ${p}`); return; }
      console.warn(`[TTS] ${p} failed, trying next...`);
    }
    speakBrowser(text, safeOnEnd);
  };

  const fallbackOrder = ['elevenlabs', 'google', 'openai', 'azure']
    .filter(p => p !== preferredProvider);

  // BUG-C2 FIX: Safety net — pastikan _isSpeaking SELALU di-reset ke false
  // Sebelumnya: jika getCached/tryProviders throw, _isSpeaking stuck = true selamanya
  try {
    await tryProviders([preferredProvider, ...fallbackOrder, 'browser']);
  } catch (e) {
    console.error('[TTS] ❌ Unexpected error in speak():', e);
    _isSpeaking = false;
    try { onEnd(); } catch { /* prevent error cascade */ }
  }
}


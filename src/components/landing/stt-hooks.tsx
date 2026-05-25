/**
 * @license SPDX-License-Identifier: Apache-2.0
 *
 * stt-hooks.tsx — Wake word, ambient listener, mobile STT hooks
 * Dipecah dari LandingPage.tsx
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { sbGetSetting } from '../../lib/supabase';
import { isTtsSpeaking } from './tts-engine';
import { matchesWakeWord, extractEntities } from './ai-engine';
import type { CapturedData } from './ai-engine';

// ─── Web Speech API type declarations (tidak ada di standard lib) ─────────────
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}
type SpeechRecognition = {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  start(): void; abort(): void; stop(): void;
  onstart:  (() => void) | null;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onend:    (() => void) | null;
  onerror:  ((e: SpeechRecognitionErrorEvent) => void) | null;
};
type SpeechRecognitionEvent = { resultIndex: number; results: SpeechRecognitionResultList };
type SpeechRecognitionResultList = { length: number; [i: number]: SpeechRecognitionResult };
type SpeechRecognitionResult = { isFinal: boolean; length: number; [i: number]: SpeechRecognitionAlternative };
type SpeechRecognitionAlternative = { transcript: string; confidence: number };
type SpeechRecognitionErrorEvent = { error: string };


// ─── Global mic registry ──────────────────────────────────────────────────────
export const _globalMicTracks   = new Set<MediaStreamTrack>();
export const _globalSpeechRecs  = new Set<SpeechRecognition>();
export const _globalAudioCtxs   = new Set<AudioContext>();
export const _globalRecorders   = new Set<MediaRecorder>();

export function emergencyStopAllMic(): void {
  _globalMicTracks.forEach(t   => { try { t.stop(); } catch { /* ignore */ } });
  _globalMicTracks.clear();
  _globalSpeechRecs.forEach(r  => { try { r.abort(); } catch { /* ignore */ } });
  _globalSpeechRecs.clear();
  _globalRecorders.forEach(r   => { try { if (r.state !== 'inactive') r.stop(); } catch { /* ignore */ } });
  _globalRecorders.clear();
  _globalAudioCtxs.forEach(ctx => { try { ctx.close(); } catch { /* ignore */ } });
  _globalAudioCtxs.clear();
  try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
  console.log('[Cenna] emergencyStopAllMic — semua audio resource dihentikan');
}

// ─── useWakeWord ──────────────────────────────────────────────────────────────
export function useWakeWord(onDetected: () => void, active: boolean) {
  const recRef        = useRef<SpeechRecognition | null>(null);
  const timerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningRef    = useRef(false);
  const activeRef     = useRef(active);
  const onDetectedRef = useRef(onDetected);
  const streamRef     = useRef<MediaStream | null>(null);

  activeRef.current   = active;
  onDetectedRef.current = onDetected;

  const stopRef = useRef<() => void>(() => undefined);

  const stop = useCallback(() => {
    runningRef.current = false;
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (recRef.current) {
      try { recRef.current.abort(); } catch { /* ignore */ }
      _globalSpeechRecs.delete(recRef.current);
      recRef.current = null;
    }
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
    if (!SR) { console.warn('[Cenna wake] SpeechRecognition not supported'); return; }

    const rec: SpeechRecognition = new SR();
    rec.lang = 'id-ID'; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 5;

    rec.onstart  = () => { runningRef.current = true; console.log('[Cenna wake] 🎙️ listening...'); };
    rec.onresult = (evt: SpeechRecognitionEvent) => {
      for (let i = evt.resultIndex; i < evt.results.length; i++) {
        const r = evt.results[i];
        const alts = Array.from({ length: r.length }, (_, j) => r[j].transcript);
        console.log('[Cenna wake] heard:', { final: r.isFinal, alts });
        for (let j = 0; j < r.length; j++) {
          if (matchesWakeWord(r[j].transcript)) { onDetectedRef.current(); return; }
        }
      }
    };

    const scheduleRestart = (delay: number) => {
      runningRef.current = false; recRef.current = null;
      if (!activeRef.current) return;
      timerRef.current = setTimeout(start, delay);
    };

    rec.onend  = () => { console.log('[Cenna wake] session ended, restarting...'); _globalSpeechRecs.delete(rec); scheduleRestart(200); };
    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      console.warn('[Cenna wake] error:', e.error);
      _globalSpeechRecs.delete(rec);
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { stopRef.current(); return; }
      scheduleRestart(e.error === 'no-speech' ? 100 : 800);
    };

    recRef.current = rec;
    _globalSpeechRecs.add(rec);
    try { rec.start(); console.log('[Cenna wake] rec.start() called'); }
    catch (err) { console.warn('[Cenna wake] rec.start() threw:', err); _globalSpeechRecs.delete(rec); recRef.current = null; scheduleRestart(800); }
  }, []);

  useEffect(() => {
    if (!active) { activeRef.current = false; stop(); return () => stop(); }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    let cleanupCalled = false;
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        if (cleanupCalled) { stream.getTracks().forEach(t => { try { t.stop(); } catch { /* ok */ } }); console.log('[Cenna wake] mic granted AFTER unmount — race condition fixed'); return; }
        stream.getTracks().forEach(t => _globalMicTracks.add(t));
        streamRef.current = stream;
        console.log('[Cenna wake] mic granted, starting wake listener');
        start();
      })
      .catch((err) => { console.warn('[Cenna wake] mic denied:', err); });
    return () => { cleanupCalled = true; activeRef.current = false; stop(); };
  }, [active, start, stop]);
}

// ─── useAmbientListener ───────────────────────────────────────────────────────
interface AmbientListenerOptions {
  enabled:   boolean;
  silenceMs?: number;
  onData:    (data: CapturedData) => void;
}

export function useAmbientListener({ enabled, silenceMs = 3000, onData }: AmbientListenerOptions) {
  const recRef          = useRef<SpeechRecognition | null>(null);
  const runningRef      = useRef(false);
  const transcriptRef   = useRef('');
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ambientStreamRef = useRef<MediaStream | null>(null);
  const enabledRef  = useRef(enabled); const onDataRef = useRef(onData);
  enabledRef.current = enabled; onDataRef.current = onData;
  // BUG-H5 FIX: destroyedRef mencegah race condition restart setelah cleanup
  // Tanpa ini: rec.onend bisa restart mic setelah enabled=false karena async timing
  const destroyedRef = useRef(false);
  const stopRef = useRef<() => void>(() => undefined);

  const fireSilence = useCallback(() => {
    const raw = transcriptRef.current.trim();
    if (!raw) return;
    const entities = extractEntities(raw);
    console.log('[Cenna ambient] firing — transcript:', raw.slice(0, 80));
    onDataRef.current({ transcript: raw, keluhan: entities.keluhan, obat: entities.obat, pertanyaan: entities.pertanyaan, waktu: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) });
    transcriptRef.current = '';
  }, []);

  const stop = useCallback(() => {
    runningRef.current = false;
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    if (recRef.current) { try { recRef.current.abort(); } catch { /* ignore */ } _globalSpeechRecs.delete(recRef.current); recRef.current = null; }
    if (ambientStreamRef.current) { ambientStreamRef.current.getTracks().forEach(t => { try { t.stop(); } catch { /* ignore */ } _globalMicTracks.delete(t); }); ambientStreamRef.current = null; }
    console.log('[Cenna ambient] stopped — mic released');
  }, []);
  stopRef.current = stop;

  const start = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR || runningRef.current) return;
    const rec: SpeechRecognition = new SR();
    rec.lang = 'id-ID'; rec.continuous = true; rec.interimResults = true;
    rec.onstart  = () => { runningRef.current = true; console.log('[Cenna ambient] 🎙️ started'); };
    rec.onresult = (evt: SpeechRecognitionEvent) => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (isTtsSpeaking()) { if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current); return; }
      let newText = '';
      for (let i = evt.resultIndex; i < evt.results.length; i++) { const r = evt.results[i]; if (r.isFinal) newText += r[0].transcript + ' '; }
      if (newText.trim()) { transcriptRef.current += newText; console.log('[Cenna ambient] transcript so far:', transcriptRef.current.slice(-80)); }
      const last = transcriptRef.current.trim().split(/[.!]+/).pop() ?? '';
      if (last.trim().toLowerCase().endsWith('?') && last.length > 5) { fireSilence(); return; }
      silenceTimerRef.current = setTimeout(fireSilence, silenceMs);
    };
    // BUG-H5 FIX: periksa destroyedRef agar tidak restart jika effect sudah di-cleanup
    rec.onend  = () => { _globalSpeechRecs.delete(rec); runningRef.current = false; recRef.current = null; if (enabledRef.current && !destroyedRef.current) setTimeout(start, 150); };
    rec.onerror = (e: SpeechRecognitionErrorEvent) => { _globalSpeechRecs.delete(rec); if (e.error === 'not-allowed') { stopRef.current(); return; } runningRef.current = false; recRef.current = null; if (enabledRef.current && !destroyedRef.current) setTimeout(start, 800); };
    recRef.current = rec; _globalSpeechRecs.add(rec);
    // BUG-N7 FIX: periksa destroyedRef sebelum restart agar mic tidak bocor setelah cleanup
    try { rec.start(); } catch { _globalSpeechRecs.delete(rec); recRef.current = null; if (!destroyedRef.current) setTimeout(start, 800); }
  }, [fireSilence, silenceMs]);

  useEffect(() => {
    destroyedRef.current = false; // reset saat effect baru mount
    if (!enabled) { enabledRef.current = false; stop(); return () => stop(); }
    let cleanupCalled = false;
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => { if (cleanupCalled) { stream.getTracks().forEach(t => { try { t.stop(); } catch { /* ok */ } }); return; } stream.getTracks().forEach(t => _globalMicTracks.add(t)); ambientStreamRef.current = stream; start(); })
      .catch(() => { if (!cleanupCalled) start(); });
    return () => { cleanupCalled = true; enabledRef.current = false; destroyedRef.current = true; stop(); };
  }, [enabled, start, stop]);
}

// ─── getWhisperApiKey ─────────────────────────────────────────────────────────
// BUG-L1 FIX: Prioritas key didokumentasikan eksplisit:
//   1. OPENAI_WHISPER_KEY — key khusus Whisper (paling spesifik)
//   2. OPENAI_TTS_KEY    — key OpenAI shared untuk TTS/Whisper
//   3. AI_KEY_OPENAI     — key OpenAI umum (fallback terakhir)
async function getWhisperApiKey(): Promise<string> {
  const k1 = await sbGetSetting<string>('OPENAI_WHISPER_KEY');
  if (k1?.trim()) return k1.trim();
  const k2 = await sbGetSetting<string>('OPENAI_TTS_KEY');
  if (k2?.trim()) return k2.trim();
  const k3 = await sbGetSetting<string>('AI_KEY_OPENAI');
  if (k3?.trim()) return k3.trim();
  console.warn('[Mobile STT] Tidak ada OpenAI key ditemukan. Set salah satu: OPENAI_WHISPER_KEY, OPENAI_TTS_KEY, atau AI_KEY_OPENAI');
  return '';
}

// ─── useMobileAmbientListener ─────────────────────────────────────────────────
export function useMobileAmbientListener({ enabled, silenceMs = 2500, onData }: AmbientListenerOptions) {
  const enabledRef = useRef(enabled); const onDataRef = useRef(onData);
  enabledRef.current = enabled; onDataRef.current = onData;
  const streamRef       = useRef<MediaStream | null>(null);
  const audioCtxRef     = useRef<AudioContext | null>(null);
  const recorderRef     = useRef<MediaRecorder | null>(null);
  const chunksRef       = useRef<Blob[]>([]);
  const animFrameRef    = useRef<number>(0);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRecordingRef  = useRef(false);
  const destroyedRef    = useRef(false);

  const sendToWhisper = useCallback(async (blob: Blob, mimeType: string) => {
    if (blob.size < 2000) { console.log('[Mobile STT] Blob terlalu kecil, skip:', blob.size, 'bytes'); return; }
    try {
      const apiKey = await getWhisperApiKey();
      if (!apiKey) { console.warn('[Mobile STT] Tidak ada OpenAI API key untuk Whisper'); return; }
      const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
      const formData = new FormData();
      formData.append('file', blob, `audio.${ext}`);
      formData.append('model', 'whisper-1');
      formData.append('language', 'id');
      const res = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: formData });
      if (!res.ok) { const errText = await res.text().catch(() => ''); console.warn('[Mobile STT] Whisper error', res.status, errText.slice(0, 100)); return; }
      const { text } = await res.json() as { text?: string };
      if (!text?.trim()) return;
      console.log('[Mobile STT] Whisper ✓ transcript:', text.trim().slice(0, 80));
      const entities = extractEntities(text.trim());
      onDataRef.current({ transcript: text.trim(), keluhan: entities.keluhan, obat: entities.obat, pertanyaan: entities.pertanyaan, waktu: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) });
    } catch (e) { console.warn('[Mobile STT] fetch error:', e); }
  }, []);

  const getSupportedMime = () => {
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
    return candidates.find(m => MediaRecorder.isTypeSupported(m)) ?? '';
  };

  const stopRecording = useCallback((mimeType: string) => {
    const rec = recorderRef.current;
    if (!rec || rec.state === 'inactive') return;
    try { rec.stop(); } catch { /* ignore */ }
    isRecordingRef.current = false;
    console.log('[Mobile STT] Perekaman dihentikan');
    void mimeType;
  }, []);

  const startRecording = useCallback((stream: MediaStream) => {
    if (isRecordingRef.current || destroyedRef.current) return;
    const mimeType = getSupportedMime();
    if (!mimeType) { console.warn('[Mobile STT] MediaRecorder: tidak ada MIME yang didukung'); return; }
    chunksRef.current = [];
    let recorder: MediaRecorder;
    try { recorder = new MediaRecorder(stream, { mimeType }); }
    catch (e) { console.warn('[Mobile STT] MediaRecorder gagal dibuat:', e); return; }
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => { if (destroyedRef.current) return; const blob = new Blob(chunksRef.current, { type: mimeType }); chunksRef.current = []; sendToWhisper(blob, mimeType); };
    recorderRef.current = recorder; _globalRecorders.add(recorder); isRecordingRef.current = true;
    recorder.start(250); console.log('[Mobile STT] 🔴 Mulai merekam, MIME:', mimeType);
  }, [sendToWhisper]);

  const cleanupAll = useCallback(() => {
    destroyedRef.current = true; cancelAnimationFrame(animFrameRef.current);
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    if (speechTimerRef.current)  { clearTimeout(speechTimerRef.current);  speechTimerRef.current  = null; }
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') { rec.ondataavailable = null; rec.onstop = null; try { rec.stop(); } catch { /* ignore */ } }
    if (recorderRef.current) { _globalRecorders.delete(recorderRef.current); recorderRef.current = null; }
    isRecordingRef.current = false; chunksRef.current = [];
    if (audioCtxRef.current) { _globalAudioCtxs.delete(audioCtxRef.current); try { audioCtxRef.current.close(); } catch { /* ignore */ } audioCtxRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => { try { t.stop(); } catch { /* ignore */ } _globalMicTracks.delete(t); }); streamRef.current = null; }
    console.log('[Mobile STT] cleanup selesai');
  }, []);

  useEffect(() => {
    if (!enabled) { enabledRef.current = false; cleanupAll(); return; }
    destroyedRef.current = false;
    const SILENCE_THRESHOLD = 12; const SPEECH_DEBOUNCE_MS = 280;
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 } as MediaTrackConstraints })
      .then(stream => {
        if (destroyedRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream; stream.getTracks().forEach(t => _globalMicTracks.add(t));
        const audioCtx = new AudioContext({ sampleRate: 16000 });
        audioCtxRef.current = audioCtx; _globalAudioCtxs.add(audioCtx);
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser(); analyser.fftSize = 512; analyser.smoothingTimeConstant = 0.6;
        source.connect(analyser);
        const bufLen = analyser.frequencyBinCount; const timeDom = new Uint8Array(bufLen);
        let speechDetectedAt: number | null = null;
        const tick = () => {
          if (destroyedRef.current || !enabledRef.current) return;
          if (isTtsSpeaking()) { animFrameRef.current = requestAnimationFrame(tick); return; }
          analyser.getByteTimeDomainData(timeDom);
          let sum = 0; for (let i = 0; i < bufLen; i++) { const v = (timeDom[i] - 128) / 128; sum += v * v; }
          const rms = Math.sqrt(sum / bufLen) * 100; const isSpeakingNow = rms > SILENCE_THRESHOLD;
          if (isSpeakingNow) {
            if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
            if (!isRecordingRef.current && speechDetectedAt === null) { speechDetectedAt = Date.now(); speechTimerRef.current = setTimeout(() => { if (!destroyedRef.current && enabledRef.current) startRecording(stream); }, SPEECH_DEBOUNCE_MS); }
          } else {
            if (speechDetectedAt !== null && !isRecordingRef.current) { if (speechTimerRef.current) { clearTimeout(speechTimerRef.current); speechTimerRef.current = null; } speechDetectedAt = null; }
            if (isRecordingRef.current && !silenceTimerRef.current) { silenceTimerRef.current = setTimeout(() => { speechDetectedAt = null; if (isRecordingRef.current && recorderRef.current) stopRecording(recorderRef.current.mimeType); silenceTimerRef.current = null; }, silenceMs); }
          }
          animFrameRef.current = requestAnimationFrame(tick);
        };
        animFrameRef.current = requestAnimationFrame(tick); console.log('[Mobile STT] VAD aktif 🎙️');
      })
      .catch(err => { console.warn('[Mobile STT] mic denied:', err); });
    return () => { enabledRef.current = false; cleanupAll(); };
  }, [enabled, silenceMs, startRecording, stopRecording, cleanupAll]);
}

/**
 * @license SPDX-License-Identifier: Apache-2.0
 *
 * LandingPage.tsx v6.1 — Dipecah ke sub-modul, bug-fixed
 * Logo diambil dari DB (landing_config.logoUrl), tidak ada base64 hardcode.
 */

import type { AnamnesisData, ClinicalConclusion } from '../types';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { sbGetSetting, sbSaveSession } from '../lib/supabase';

// ─── Sub-modul ────────────────────────────────────────────────────────────────
import { speak } from './landing/tts-engine';
import {
  callCennaAI, resetAnamnesisState, matchesClosingWord, fuzzyMatchTrigger,
  _currentAnamnesis, _activeTemplate, _templateStepIndex, _templateDone,
  setTemplateStepIndex, setTemplateDone,
  handleWakeWordFlow,
  type CapturedData,
} from './landing/ai-engine';
import { useWakeWord, useAmbientListener, useMobileAmbientListener, emergencyStopAllMic } from './landing/stt-hooks';
import { OrbCore, useOrbCanvas, StatusPill, type OrbPhase, type OrbVisualModel } from './landing/orb-canvas';
import { ConclusionPopup, DataPopup } from './landing/session-popup';

// ─── Re-exports untuk backward-compatibility (App.tsx masih import dari sini)
export { emergencyStopAllMic } from './landing/stt-hooks';


// ─── Types ────────────────────────────────────────────────────────────────────
interface LandingPageProps { onLoginClick: () => void; }

// ─── Helper (di luar komponen, tidak re-created tiap render) ─────────────────
function mergeSessionData(all: CapturedData[]): CapturedData {
  return {
    transcript: all.map(d => d.transcript).join(' — '),
    keluhan:    Array.from(new Set(all.flatMap(d => d.keluhan))),
    obat:       Array.from(new Set(all.flatMap(d => d.obat))),
    pertanyaan: Array.from(new Set(all.flatMap(d => d.pertanyaan))),
    waktu:      all[0]?.waktu ?? '',
  };
}


// ─── LandingPage ──────────────────────────────────────────────────────────────
export default function LandingPage({ onLoginClick }: LandingPageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [phase,          setPhase]          = useState<OrbPhase>('idle');
  const [wakeFlash,      setWakeFlash]      = useState(false);
  const [capturedData,   setCapturedData]   = useState<CapturedData | null>(null);
  const [conclusionData, setConclusionData] = useState<ClinicalConclusion | null>(null);
  const [redFlagsData,   setRedFlagsData]   = useState<string[]>([]);
  const [aiLabel,        setAiLabel]        = useState('Cenna sedang berpikir…');
  const [aiEnabled,      setAiEnabled]      = useState(false);
  const [templateOrbColors, setTemplateOrbColors] = useState<{ primary: string; secondary: string } | null>(null);
  const [templateModeName,  setTemplateModeName]  = useState<string | null>(null);
  // BUG-M2 FIX: uiStepIndex sebagai React state agar badge step reaktif (module var tidak trigger re-render)
  const [uiStepIndex,    setUiStepIndex]    = useState(0);
  const [orbVisualModel, setOrbVisualModel] = useState<OrbVisualModel>('classic');
  const [orbSize, setOrbSize] = useState(() => Math.min(window.innerWidth * 0.88, window.innerHeight * 0.88, 700));
  const [brandColors, setBrandColors] = useState({ primary: '#1e2a4a', accent: '#b8a898' });

  // ── Branding dari DB (logo, appName, tagline) ──────────────────────────────
  const [logoUrl,        setLogoUrl]        = useState('');
  const [appName,        setAppName]        = useState('CENNA AI');
  const [tagline,        setTagline]        = useState('Clinical Intelligence');
  // ── Missing fields (state agar reaktif di UI) ─────────────────────────────
  const [missingFields,  setMissingFields]  = useState<string[]>([]);
  // BUG-N2 FIX: state untuk showLoginButton dari landing_config
  const [showLoginButton, setShowLoginButton] = useState(true);

  const conversationHistoryRef = useRef<Array<{ role: 'user'|'assistant'; content: string }>>([]);
  const sessionDataRef         = useRef<CapturedData[]>([]);

  // ── Load settings dari DB ──────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      // Orb visual model
      const model = await sbGetSetting<string>('orb_visual_model');
      if (model) setOrbVisualModel(model as OrbVisualModel);

      // AI enabled check
      const aiCfg = await sbGetSetting<{ provider?: string; keyConfigured?: boolean }>('api_ai_config');
      if (aiCfg?.keyConfigured) {
        setAiEnabled(true);
        console.debug('[CENNA:LandingPage] AI enabled via api_ai_config.keyConfigured');
      } else {
        const providers = ['anthropic', 'openai', 'gemini', 'mistral', 'groq', 'deepseek', 'openrouter'];
        const active    = aiCfg?.provider || 'anthropic';
        for (const p of [active, ...providers.filter(x => x !== active)]) {
          const key = await sbGetSetting<string>(`AI_KEY_${p.toUpperCase()}`);
          if (key?.trim()) { setAiEnabled(true); console.debug('[CENNA:LandingPage] AI enabled, provider:', p); break; }
        }
      }

      // Branding
      const b = await sbGetSetting<{ logoUrl?: string; brand?: string; tagline?: string; colorPrimary?: string; colorAccent?: string }>('branding');
      if (b?.brand)        setAppName(b.brand);
      if (b?.tagline)      setTagline(b.tagline);
      if (b?.colorPrimary || b?.colorAccent) setBrandColors({ primary: b.colorPrimary ?? '#1e2a4a', accent: b.colorAccent ?? '#b8a898' });
      // BUG-H2 FIX: cek typeof string agar logoUrl '' (hapus) ter-apply, bukan di-skip sebagai falsy
      if (typeof b?.logoUrl === 'string') setLogoUrl(b.logoUrl);

      // Landing config — prioritas lebih tinggi dari branding, override jika ada
      const lc = await sbGetSetting<{ appName?: string; tagline?: string; logoUrl?: string; wakeGreeting?: string; showLoginButton?: boolean }>('landing_config');
      if (lc?.appName)  setAppName(lc.appName);
      if (lc?.tagline)  setTagline(lc.tagline);
      // BUG-H2 FIX: typeof string check agar penghapusan logo ('') ter-apply
      if (typeof lc?.logoUrl === 'string') setLogoUrl(lc.logoUrl);
      // BUG-N2 FIX: baca showLoginButton — default true jika belum dikonfigurasi
      if (typeof lc?.showLoginButton === 'boolean') setShowLoginButton(lc.showLoginButton);

    })();

    const handleResize = () => setOrbSize(Math.min(window.innerWidth * 0.88, window.innerHeight * 0.88, 700));
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useOrbCanvas(canvasRef, phase, brandColors);

  const phaseRef  = useRef<OrbPhase>('idle');
  phaseRef.current = phase;
  const firedRef  = useRef(false);

  const hasSpeechAPI = typeof window !== 'undefined' &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  const isMobile = typeof window !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  // ── handleWakeWord ─────────────────────────────────────────────────────────
  const handleWakeWord = useCallback(() => {
    if (firedRef.current) { console.log('[Cenna] wake word debounced'); return; }
    firedRef.current = true;
    console.debug('[CENNA:LandingPage] Wake word! → speaking');
    resetAnamnesisState();
    conversationHistoryRef.current = [];
    sessionDataRef.current = [];
    setTemplateOrbColors(null);
    setTemplateModeName(null);
    setUiStepIndex(0); // BUG-N4 FIX: reset React state badge step
    setWakeFlash(true);
    setTimeout(() => setWakeFlash(false), 900);
    setPhase('speaking');

    handleWakeWordFlow(
      (p) => setPhase(p as OrbPhase),
      setTemplateOrbColors,
      setTemplateModeName,
    );
  }, []);

  useEffect(() => {
    if (phase === 'idle' || phase === 'listening') { firedRef.current = false; }
  }, [phase]);

  useWakeWord(handleWakeWord, phase === 'idle');

  // ── handleAmbientData ──────────────────────────────────────────────────────
  const handleAmbientData = useCallback(async (data: CapturedData) => {
    // Template mode
    if (_activeTemplate && !_templateDone) {
      const steps = _activeTemplate.steps;
      let matchedStep = null; let matchedIdx = _templateStepIndex;
      for (let i = _templateStepIndex; i < steps.length; i++) {
        if (fuzzyMatchTrigger(data.transcript, steps[i].trigger_text)) { matchedStep = steps[i]; matchedIdx = i; break; }
      }
      if (!matchedStep) { setPhase('listening'); return; }
      // BUG-M2 FIX: aggiorna sia il module var che il React state
      setTemplateStepIndex(matchedIdx + 1);
      setUiStepIndex(matchedIdx + 1);
      setTemplateOrbColors({ primary: matchedStep.orb_primary, secondary: matchedStep.orb_secondary });
      const fullResponse = matchedStep.next_question ? `${matchedStep.response_text} ${matchedStep.next_question}` : matchedStep.response_text;
      setPhase('responding');
      speak(fullResponse, () => {
        if (_templateStepIndex >= steps.length) { setTemplateDone(true); setTemplateOrbColors(null); setTemplateModeName(null); setUiStepIndex(0); }
        else { const next = steps[_templateStepIndex]; setTemplateOrbColors({ primary: next.orb_primary, secondary: next.orb_secondary }); }
        setPhase('listening');
      });
      sessionDataRef.current.push(data);
      return;
    }

    // Mode tanpa AI
    if (!aiEnabled) {
      sessionDataRef.current.push(data);
      setPhase('responding');
      speak('Baik dokter, data percakapan sudah saya catat.', () => { setCapturedData(mergeSessionData(sessionDataRef.current)); setPhase('popup'); });
      return;
    }

    // AI mode
    const currentHistory = conversationHistoryRef.current!;
    currentHistory.push({ role: 'user', content: data.transcript });
    setPhase('processing'); setAiLabel('Menganalisis percakapan…');
    console.debug('[CENNA:LandingPage] callCennaAI, ronde:', Math.floor(currentHistory.length / 2));

    try {
      setAiLabel('Cenna sedang berpikir…');
      const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('AI_TIMEOUT')), 30_000));
      const currentRound   = Math.floor(currentHistory.length / 2);
      const aiResult       = await Promise.race([callCennaAI(data.transcript, currentHistory.slice(0, -1), currentRound), timeoutPromise]);
      currentHistory.push({ role: 'assistant', content: aiResult.voice_response });

      const enrichedData: CapturedData = { ...data, keluhan: aiResult.keluhan.length ? aiResult.keluhan : data.keluhan, obat: aiResult.obat.length ? aiResult.obat : data.obat, pertanyaan: aiResult.pertanyaan.length ? aiResult.pertanyaan : data.pertanyaan };
      sessionDataRef.current.push(enrichedData);
      // BUG-10 FIX: sync missingFields ke React state agar UI reaktif
      setMissingFields([...aiResult.anamnesis.missing_fields]);
      setPhase('responding');

      const roundsDone = Math.floor(currentHistory.length / 2);
      const userForcedEnd = matchesClosingWord(data.transcript);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c = aiResult.conclusion as any;
      const hasValidConclusion = c !== null && typeof c === 'object' && typeof c.diagnosis_utama === 'string' && (c.diagnosis_utama as string).trim().length > 0;
      const isSessionEnd = (aiResult.session_end && hasValidConclusion && roundsDone >= 3) || userForcedEnd;
      console.debug('[CENNA:LandingPage] roundsDone:', roundsDone, '| isSessionEnd:', isSessionEnd);

      if (isSessionEnd) {
        const sessionId = 'sess_' + Date.now() + Math.random().toString(36).substring(2, 6);
        // BUG-N6 FIX: sertakan doctor_name dari sesi admin yang tersimpan
        let doctorName = '';
        try { doctorName = JSON.parse(sessionStorage.getItem('cenna_admin') || '{}').name || ''; } catch { /* ignore */ }
        sbSaveSession({ id: sessionId, created_at: new Date().toISOString(), doctor_name: doctorName || undefined, anamnesis: aiResult.anamnesis, conclusion: aiResult.conclusion, red_flags: aiResult.red_flags, transcript_full: sessionDataRef.current.map(d => d.transcript).join(' — '), keluhan: Array.from(new Set(sessionDataRef.current.flatMap(d => d.keluhan))), obat: Array.from(new Set(sessionDataRef.current.flatMap(d => d.obat))), session_rounds: Math.ceil(currentHistory.length / 2) }).catch(err => console.warn('[Cenna] sbSaveSession failed:', err));
        speak(aiResult.voice_response, () => { if (aiResult.conclusion) { setConclusionData(aiResult.conclusion); setRedFlagsData(aiResult.red_flags); } setCapturedData(mergeSessionData(sessionDataRef.current)); setPhase('popup'); });
      } else {
        speak(aiResult.voice_response, () => setPhase('listening'));
      }
    } catch (err) {
      const isTimeout = err instanceof Error && err.message === 'AI_TIMEOUT';
      console.warn('[CENNA:LandingPage] AI error:', isTimeout ? 'timeout 30s' : err);
      currentHistory.pop();
      setPhase('responding');
      speak(isTimeout ? 'Maaf dokter, Cenna terlalu lama merespons. Silakan ulangi.' : 'Maaf dokter, ada gangguan koneksi. Silakan ulangi.', () => setPhase('listening'));
    }
  }, [aiEnabled]);

  useAmbientListener({ enabled: phase === 'listening' && !isMobile, silenceMs: 3000, onData: handleAmbientData });
  useMobileAmbientListener({ enabled: phase === 'listening' && isMobile, silenceMs: 2500, onData: handleAmbientData });

  // BUG-M3 FIX: reset semua template visual state agar badge tidak tertinggal
  const handleClosePopup = () => { setCapturedData(null); setConclusionData(null); setRedFlagsData([]); conversationHistoryRef.current = []; sessionDataRef.current = []; resetAnamnesisState(); firedRef.current = false; setTemplateOrbColors(null); setTemplateModeName(null); setUiStepIndex(0); setPhase('idle'); };
  const handleEndConversation = () => { conversationHistoryRef.current = []; sessionDataRef.current = []; setCapturedData(null); setConclusionData(null); setRedFlagsData([]); resetAnamnesisState(); firedRef.current = false; setTemplateOrbColors(null); setTemplateModeName(null); setUiStepIndex(0); setPhase('idle'); };
  const handleSOAP = () => { conversationHistoryRef.current = []; sessionDataRef.current = []; setCapturedData(null); setConclusionData(null); setRedFlagsData([]); resetAnamnesisState(); onLoginClick(); };

  return (
    <div className="relative min-h-screen w-full bg-white overflow-hidden flex flex-col items-center justify-center select-none">
      <canvas ref={canvasRef} className="absolute inset-0 z-0 pointer-events-none" />

      {wakeFlash && (
        <div className="absolute inset-0 z-20 pointer-events-none"
          style={{ background: 'radial-gradient(circle at center, rgba(16,185,129,0.15) 0%, transparent 70%)', animation: 'wakeFlash 0.9s ease-out forwards' }} />
      )}

      {/* Wordmark — logo dari DB, tidak hardcode */}
      <div className="absolute top-5 left-7 z-30 flex items-center gap-3">
        {logoUrl ? (
          <img src={logoUrl} alt="Logo Klinik" className="h-10 w-auto object-contain max-w-[120px]" />
        ) : (
          <div style={{ width: 40, height: 40, borderRadius: 8, background: 'linear-gradient(135deg, #1e2a4a 0%, #3d5494 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#f5f0e8', fontSize: 18, fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>C</span>
          </div>
        )}
        <div className="flex flex-col leading-tight">
          <span className="text-[13px] font-semibold tracking-[0.22em] uppercase" style={{ fontFamily: "'DM Sans', sans-serif", color: '#1e2a4a' }}>{appName}</span>
          <span className="text-[9px] tracking-[0.18em] uppercase text-[#b8a898]"  style={{ fontFamily: "'DM Sans', sans-serif" }}>{tagline}</span>
        </div>
      </div>

      {/* BUG-N2 FIX: tombol Admin hanya tampil jika showLoginButton = true */}
      {showLoginButton && (
        <button onClick={onLoginClick}
          className="absolute top-5 right-7 z-30 text-[10px] tracking-[0.18em] uppercase text-[#1e2a4a]/30 hover:text-[#1e2a4a]/60 transition-colors"
          style={{ fontFamily: "'DM Mono', monospace", background: 'none', border: 'none', cursor: 'pointer' }}>
          Admin →
        </button>
      )}

      {/* Template mode badge */}
      {templateModeName && (
        <div className="absolute top-5 left-1/2 z-30" style={{ transform: 'translateX(-50%)' }}>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border" style={{ background: templateOrbColors ? `${templateOrbColors.primary}15` : 'rgba(30,42,74,0.08)', borderColor: templateOrbColors ? `${templateOrbColors.primary}30` : 'rgba(30,42,74,0.12)', fontFamily: "'DM Mono', monospace" }}>
            <span style={{ fontSize: 8 }}>📋</span>
            <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: templateOrbColors?.primary ?? '#1e2a4a' }}>Template: {templateModeName}</span>
            <span className="text-[8px] tracking-wider" style={{ color: templateOrbColors?.primary ?? '#1e2a4a', opacity: 0.5 }}>· step {uiStepIndex}/{_activeTemplate?.steps.length ?? 0}</span>
          </div>
        </div>
      )}

      <div className="absolute inset-0 z-10 flex items-center justify-center">
        <OrbCore phase={phase} wakeEnabled={phase === 'idle'} wakeFlash={wakeFlash} templateColors={templateOrbColors} orbSize={orbSize} visualModel={orbVisualModel} />
      </div>

      {/* Status text */}
      <div className="absolute bottom-24 left-0 right-0 z-20 flex flex-col items-center gap-1 pointer-events-none text-center px-4">
        {phase === 'idle' && !hasSpeechAPI && (<p className="text-[9px] tracking-[0.1em] text-[#1e2a4a]/25" style={{ fontFamily: "'DM Mono', monospace" }}>Wake word tidak didukung browser ini</p>)}
        {phase === 'idle' && hasSpeechAPI && (<p className="text-[11px] tracking-[0.1em] text-[#1e2a4a]/30" style={{ fontFamily: "'DM Mono', monospace" }}>{aiEnabled ? '✦ AI Voice Assistant aktif' : '◦ Mode dasar aktif'}</p>)}
        {phase === 'speaking'   && (<p className="text-[12px] tracking-[0.1em] text-[#b8a898]" style={{ fontFamily: "'DM Mono', monospace", animation: 'fadeIn 0.5s ease' }}>Cenna menyapa…</p>)}
        {phase === 'listening'  && (
          <>
            <p className="text-[12px] tracking-[0.1em] text-[#7F77DD]" style={{ fontFamily: "'DM Mono', monospace", animation: 'fadeIn 0.5s ease' }}>Mendengarkan — jeda 3 detik untuk diproses</p>
            {/* BUG-10 FIX: gunakan React state missingFields, bukan module variable */}
            {missingFields.length > 0 && (<p className="text-[10px] tracking-[0.08em] text-[#7F77DD]/50" style={{ fontFamily: "'DM Mono', monospace" }}>perlu: {missingFields.slice(0, 3).join(', ')}{missingFields.length > 3 ? ` +${missingFields.length - 3}` : ''}</p>)}

          </>
        )}
        {phase === 'processing' && (<p className="text-[12px] tracking-[0.1em]" style={{ fontFamily: "'DM Mono', monospace", color: '#7F77DD', animation: 'fadeIn 0.3s ease' }}>{aiLabel}</p>)}
        {phase === 'responding' && (<p className="text-[12px] tracking-[0.1em] text-[#10b981]" style={{ fontFamily: "'DM Mono', monospace", animation: 'fadeIn 0.3s ease' }}>Cenna merespons…</p>)}
      </div>

      {/* Tombol tap mobile */}
      {phase === 'idle' && hasSpeechAPI && isMobile && (
        <button onClick={handleWakeWord} style={{ position: 'absolute', bottom: '6rem', left: '50%', transform: 'translateX(-50%)', zIndex: 25, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', pointerEvents: 'auto' }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(30,42,74,0.08)', border: '1.5px solid rgba(30,42,74,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onTouchStart={e => (e.currentTarget.style.background = 'rgba(30,42,74,0.16)')}
            onTouchEnd={e   => (e.currentTarget.style.background = 'rgba(30,42,74,0.08)')}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <rect x="9" y="2" width="6" height="12" rx="3" fill="rgba(30,42,74,0.7)" />
              <path d="M5 11a7 7 0 0014 0" stroke="rgba(30,42,74,0.7)" strokeWidth="1.6" strokeLinecap="round" />
              <line x1="12" y1="18" x2="12" y2="22" stroke="rgba(30,42,74,0.7)" strokeWidth="1.6" strokeLinecap="round" />
              <line x1="9"  y1="22" x2="15" y2="22" stroke="rgba(30,42,74,0.7)" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
          <span style={{ fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(30,42,74,0.35)', fontFamily: "'DM Mono', monospace" }}>Ketuk untuk mulai</span>
        </button>
      )}

      <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center gap-2 z-20">
        <StatusPill phase={phase} aiLabel={aiLabel} />
        {(phase === 'listening' || phase === 'processing' || phase === 'responding') && (
          <button onClick={handleEndConversation} className="text-[9px] tracking-[0.14em] uppercase text-[#1e2a4a]/25 hover:text-[#1e2a4a]/50 transition-colors" style={{ fontFamily: "'DM Mono', monospace", background: 'none', border: 'none', cursor: 'pointer' }}>
            Akhiri sesi
          </button>
        )}
      </div>

      {phase === 'popup' && capturedData && conclusionData && (
        <ConclusionPopup conclusion={conclusionData} anamnesis={_currentAnamnesis} redFlags={redFlagsData} onClose={handleClosePopup} onSOAP={handleSOAP} />
      )}
      {phase === 'popup' && capturedData && !conclusionData && (
        <DataPopup data={capturedData} onClose={handleClosePopup} onSOAP={handleSOAP}
          canContinue={conversationHistoryRef.current!.length > 0 && conversationHistoryRef.current!.length < 10}
          onContinue={() => { setCapturedData(null); setPhase('listening'); }} />
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
      `}</style>
    </div>
  );
}

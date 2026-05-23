/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

interface LandingPageProps {
  onLoginClick: () => void;
}

type OrbStatus = 'idle' | 'listening' | 'thinking' | 'writing';

const PALETTE = {
  navy:  { r: 30,  g: 42,  b: 74  },
  cream: { r: 245, g: 240, b: 232 },
  tan:   { r: 184, g: 168, b: 152 },
};

const CENNA_LOGO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABgAAAAYACAYAAACw7oNrAAAAAXNSR0IArs4c6QAAAARzQklUCAgICHwIZIgAACAASURBVHic7N17mFxVlTf+tU5Vp0PSSSfIcBkTZdQRxxAuYiAZQGRQLkNmIEiD42VAeG2HQNNn78rN8Xa8JyS192kbotMKAyMoEBCYCSMgTETCm4SLXELQ+Mj80MQXUCTpTgfpS531+4MOTxtyqV1nV5+q7u/nL5Lsvc438Dx01VnnrE0EAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFA7OOsAAAAAAFkqFAonJUnyj8x8MhG9lYim72XpDiJ6SkSeYeZflEqlDR0dHRtGLikAAMDYVigUZpVKpdnMfBwRHU5ExMyJiPyBmV8SkReZ+UUR2RoEwc+LxeLL2SYGAADIHhoAAAAAMOYUCoUzROR8EZnHzG+ptI6I/JqIbmDmG4wxWzxGBAAAGPMWLVr0lwMDAxcy87lE9IEKSjxKRHeJyPXW2t95jgcAAFAX0AAAAACAMUNr/Rki0kT0bt+1ReRuEfl8HMdP+q4NAAAwViilDhCRjwdB8DEiOtVj6TuZeWWxWPyJx5oAAAA1Dw0AAAAAGPXCMDwrCIJriOivRuByNyZJ8oU4jp8fgWsBAACMGlrrBUT0r0Q0tVrXGHp772vW2huqdQ0AAIBaggYAAAAAjFpRFI3v7u7+DjNflMHlv2iM+WoG1wUAAKgrSqmTieg6Zn7XSF1TRO5OkuTSjo6Ol0bqmgAAAFlAAwAAAABGpTAM/yYIgjupCuN+HNwrIh+z1r6SYQYAAICap7Uu0uvj+UaciGxn5ouMMf+ZxfUBAABGAhoAAAAAMOq01v+IiG4koklZZxGR3xHRudbax7LOAgAAUCu01tOJ6L+J6Miss4hIh7U2zDoHAACAKzQAAAAAYNTRWl8E4AYi2p11FiL6LRGda619LOs sAAAAMuLP/Z8GbAAAAA==";

// ─── Wake-word detection via Web Speech API ────────────────────────────────
// Targets (in multiple languages / accents / misspellings):
const WAKE_PATTERNS = [
  'hai cenna', 'hei cenna', 'hey cenna', 'hi cenna',
  'hai senna', 'hei senna', 'hey senna', 'hi senna',
  'hai tenna', 'hei tenna',
  'hai cena',  'hey cena',
];

function matchesWakeWord(transcript: string): boolean {
  const t = transcript.toLowerCase().trim();
  return WAKE_PATTERNS.some((p) => t.includes(p));
}

// ─── Hook: always-on wake-word listener ────────────────────────────────────
function useWakeWord(onDetected: () => void, enabled: boolean) {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isStoppingRef = useRef(false);

  const start = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition: SpeechRecognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'id-ID'; // Indonesian – primary; also catches "Hai"

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (matchesWakeWord(transcript)) {
          onDetected();
        }
      }
    };

    recognition.onend = () => {
      // Auto-restart unless we explicitly stopped
      if (!isStoppingRef.current && enabled) {
        restartTimerRef.current = setTimeout(() => start(), 300);
      }
    };

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      // 'no-speech' is normal – just restart
      if (e.error !== 'no-speech') {
        console.warn('[WakeWord] SpeechRecognition error:', e.error);
      }
      if (!isStoppingRef.current && enabled) {
        restartTimerRef.current = setTimeout(() => start(), 800);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      /* already started – ignore */
    }
  }, [enabled, onDetected]);

  useEffect(() => {
    if (!enabled) {
      isStoppingRef.current = true;
      recognitionRef.current?.stop();
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      return;
    }
    isStoppingRef.current = false;
    start();

    return () => {
      isStoppingRef.current = true;
      recognitionRef.current?.stop();
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    };
  }, [enabled, start]);
}

// ─── Component ─────────────────────────────────────────────────────────────
export default function LandingPage({ onLoginClick }: LandingPageProps) {
  const [orbState, setOrbState] = useState<OrbStatus>('idle');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const angleRef = useRef(0);
  const animIdRef = useRef<number>(0);

  // Wake-word support: detect browser capability
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hasSpeechAPI = typeof window !== 'undefined' &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    !!(( window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const [wakeEnabled, setWakeEnabled] = useState(false); // user must grant mic permission first
  const [wakeStatus, setWakeStatus] = useState<'idle' | 'active' | 'unsupported'>(
    hasSpeechAPI ? 'idle' : 'unsupported'
  );
  const [wakeFlash, setWakeFlash] = useState(false); // brief glow when wake word fires

  // Called by the hook when "Hai Cenna" is detected
  const handleWakeWord = useCallback(() => {
    setWakeFlash(true);
    setTimeout(() => setWakeFlash(false), 900);
    setOrbState((prev) => (prev === 'idle' ? 'listening' : prev));
  }, []);

  useWakeWord(handleWakeWord, wakeEnabled);

  // Toggle wake-word detection (requests mic permission on first enable)
  const toggleWake = async () => {
    if (wakeStatus === 'unsupported') return;
    if (!wakeEnabled) {
      try {
        // Request mic permission explicitly so the browser grants it
        await navigator.mediaDevices.getUserMedia({ audio: true });
        setWakeEnabled(true);
        setWakeStatus('active');
      } catch {
        console.warn('[WakeWord] Microphone permission denied.');
      }
    } else {
      setWakeEnabled(false);
      setWakeStatus('idle');
    }
  };

  const handleOrbClick = () => {
    setOrbState((prev) => {
      if (prev === 'idle') return 'listening';
      if (prev === 'listening') return 'thinking';
      if (prev === 'thinking') return 'writing';
      return 'idle';
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);

    const handleResize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const draw = () => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;

      let ringAlpha = 0.08;
      let pulseSpeed = 0.012;
      let ringCount = 3;
      let waveAmp = 10;

      let c1 = PALETTE.navy;
      let c2 = PALETTE.tan;

      if (orbState === 'listening') {
        c1 = PALETTE.tan; c2 = PALETTE.navy;
        ringAlpha = 0.14; pulseSpeed = 0.028; ringCount = 4; waveAmp = 38;
      } else if (orbState === 'thinking') {
        c1 = PALETTE.navy; c2 = PALETTE.cream;
        ringAlpha = 0.12; pulseSpeed = 0.04; ringCount = 5; waveAmp = 16;
      } else if (orbState === 'writing') {
        c1 = PALETTE.tan; c2 = PALETTE.cream;
        ringAlpha = 0.13; pulseSpeed = 0.022; ringCount = 3; waveAmp = 26;
      }

      angleRef.current += pulseSpeed;
      const a = angleRef.current;

      const auraRadius = 320;
      const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, auraRadius);
      aura.addColorStop(0, `rgba(${c1.r},${c1.g},${c1.b},0.07)`);
      aura.addColorStop(0.5, `rgba(${c2.r},${c2.g},${c2.b},0.04)`);
      aura.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(cx, cy, auraRadius, 0, Math.PI * 2);
      ctx.fill();

      for (let i = 0; i < ringCount; i++) {
        const t = i / ringCount;
        const r = PALETTE.navy.r * (1 - t) + PALETTE.tan.r * t | 0;
        const g = PALETTE.navy.g * (1 - t) + PALETTE.tan.g * t | 0;
        const b = PALETTE.navy.b * (1 - t) + PALETTE.tan.b * t | 0;
        const factor = 1 + Math.sin(a + i * 1.4) * 0.1;
        const radius = (155 + i * 52) * factor;
        ctx.strokeStyle = `rgba(${r},${g},${b},${ringAlpha - i * 0.012})`;
        ctx.lineWidth = 1.2 - i * 0.15;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.strokeStyle = `rgba(${c1.r},${c1.g},${c1.b},${ringAlpha + 0.04})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 8) {
        const dx = x - cx;
        const dist = Math.abs(dx);
        const amp = dist < 450 ? waveAmp * Math.cos((dist / 450) * (Math.PI / 2)) : 0;
        const y = cy + Math.sin(x * 0.013 + a * 2.2) * amp;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.strokeStyle = `rgba(${c2.r},${c2.g},${c2.b},${ringAlpha * 0.6})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 8) {
        const dx = x - cx;
        const dist = Math.abs(dx);
        const amp = dist < 350 ? (waveAmp * 0.5) * Math.cos((dist / 350) * (Math.PI / 2)) : 0;
        const y = cy + Math.sin(x * 0.018 - a * 1.7 + 1.2) * amp;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      animIdRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animIdRef.current);
    };
  }, [orbState]);

  const orbRing =
    orbState === 'idle' ? 'ring-[3px] ring-[#1e2a4a]/20' :
    orbState === 'listening' ? 'ring-[5px] ring-[#b8a898]/50' :
    orbState === 'thinking' ? 'ring-[6px] ring-[#1e2a4a]/35' :
    'ring-[4px] ring-[#b8a898]/40';

  const glowColor =
    orbState === 'idle' ? '#1e2a4a' :
    orbState === 'listening' ? '#b8a898' :
    orbState === 'thinking' ? '#1e2a4a' : '#b8a898';

  // Wake-word button label / icon
  const wakeLabel =
    wakeStatus === 'unsupported' ? 'Wake word tidak didukung' :
    wakeStatus === 'active' ? 'Mendengarkan "Hai Cenna"…' :
    'Aktifkan "Hai Cenna"';

  const wakeDotColor =
    wakeStatus === 'active' ? '#10b981' :
    wakeStatus === 'unsupported' ? '#e5e7eb' : '#b8a898';

  return (
    <div className="relative min-h-screen w-full bg-white overflow-hidden flex flex-col items-center justify-center select-none">
      <canvas ref={canvasRef} className="absolute inset-0 z-0 pointer-events-none" />

      {/* Wake-word flash overlay */}
      {wakeFlash && (
        <div
          className="absolute inset-0 z-20 pointer-events-none"
          style={{
            background: 'radial-gradient(circle at center, rgba(184,168,152,0.18) 0%, transparent 70%)',
            animation: 'wakeFlash 0.9s ease-out forwards',
          }}
        />
      )}

      {/* Portal Admin */}
      <div className="absolute top-7 right-8 z-30">
        <button
          id="btn-admin-config"
          onClick={onLoginClick}
          className="group flex items-center gap-2 px-5 py-2 rounded-full border border-[#1e2a4a]/12 bg-white/80 backdrop-blur-md hover:bg-[#1e2a4a] transition-all duration-300 cursor-pointer shadow-sm"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[#1e2a4a]/60 group-hover:text-white transition-colors duration-300">
            Admin
          </span>
          <svg className="w-3 h-3 text-[#1e2a4a]/40 group-hover:text-white transition-colors duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {/* Wordmark with real logo */}
      <div className="absolute top-5 left-7 z-30 flex items-center gap-3">
        <img
          src={CENNA_LOGO}
          alt="CENNA"
          className="w-10 h-10 object-contain"
          style={{ filter: 'brightness(0) saturate(100%) invert(14%) sepia(27%) saturate(1200%) hue-rotate(196deg) brightness(95%) contrast(95%)' }}
        />
        <div className="flex flex-col leading-tight">
          <span
            className="text-[13px] font-semibold tracking-[0.22em] uppercase text-[#1e2a4a]"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            CENNA AI
          </span>
          <span
            className="text-[9px] tracking-[0.18em] uppercase text-[#b8a898]"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Clinical Intelligence
          </span>
        </div>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center">

        {/* Orb */}
        <div className="relative flex items-center justify-center" style={{ width: 340, height: 340 }}>

          {/* Wake-word active pulse ring */}
          {wakeStatus === 'active' && (
            <div
              className="absolute rounded-full pointer-events-none"
              style={{
                width: 280,
                height: 280,
                border: '1.5px solid rgba(16,185,129,0.35)',
                animation: 'wakeRingPulse 2.2s ease-in-out infinite',
              }}
            />
          )}

          {/* Wake-word detected flash ring */}
          {wakeFlash && (
            <div
              className="absolute rounded-full pointer-events-none"
              style={{
                width: 280,
                height: 280,
                border: '2.5px solid rgba(16,185,129,0.7)',
                animation: 'wakeFlashRing 0.9s ease-out forwards',
              }}
            />
          )}

          {/* Outer glow */}
          <div
            className="absolute rounded-full transition-all duration-700 ease-out"
            style={{
              width: 260,
              height: 260,
              background: `radial-gradient(circle, ${glowColor}22 0%, transparent 75%)`,
              filter: 'blur(32px)',
              transform: `scale(${orbState === 'thinking' ? 1.15 : 1})`,
            }}
          />

          {/* Orb button */}
          <button
            id="btn-prime-orb"
            onClick={handleOrbClick}
            className={`relative rounded-full flex items-center justify-center cursor-pointer border-none transition-all duration-700 ease-out transform hover:-translate-y-1.5 active:scale-95 ${orbRing}`}
            style={{
              width: 200,
              height: 200,
              background: 'conic-gradient(from 0deg, #1e2a4a 0%, #b8a898 35%, #f5f0e8 55%, #b8a898 75%, #1e2a4a 100%)',
              boxShadow: `0 28px 60px -12px ${glowColor}40, 0 0 0 1px rgba(255,255,255,0.15) inset${wakeFlash ? ', 0 0 0 6px rgba(16,185,129,0.25)' : ''}`,
              animation: 'orbSpin 12s linear infinite',
            }}
          >
            {/* Glossy overlay */}
            <div
              className="absolute rounded-full"
              style={{
                inset: 6,
                background: 'radial-gradient(ellipse at 35% 30%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.08) 60%, transparent 100%)',
              }}
            />

            {/* Animated indicator */}
            <div className="relative flex flex-col items-center justify-center">
              {orbState === 'idle' && (
                <div className="flex gap-[5px] items-end h-7">
                  {[0.5, 0.75, 1, 0.75, 0.5].map((s, i) => (
                    <div
                      key={i}
                      className="w-[3px] rounded-full bg-white/80"
                      style={{
                        height: `${s * 20}px`,
                        animation: `barBounce 1.4s ease-in-out ${i * 0.12}s infinite alternate`,
                        opacity: 0.7 + s * 0.3,
                      }}
                    />
                  ))}
                </div>
              )}
              {orbState === 'listening' && (
                <div className="flex gap-[5px] items-end h-7">
                  {[0.4,0.8,1,1,0.8,0.5,0.3].map((s, i) => (
                    <div
                      key={i}
                      className="w-[3px] rounded-full bg-white"
                      style={{
                        height: `${s * 26}px`,
                        animation: `barBounce 0.55s ease-in-out ${i * 0.07}s infinite alternate`,
                      }}
                    />
                  ))}
                </div>
              )}
              {orbState === 'thinking' && (
                <div className="relative w-10 h-10 flex items-center justify-center">
                  <div
                    className="absolute w-8 h-8 rounded-full border-2 border-white/60 border-t-transparent"
                    style={{ animation: 'spin 1.5s linear infinite' }}
                  />
                  <div
                    className="w-2 h-2 rounded-full bg-white/90"
                    style={{ animation: 'pulse 1s ease-in-out infinite' }}
                  />
                </div>
              )}
              {orbState === 'writing' && (
                <div className="flex gap-[6px] items-center">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-2 h-2 rounded-full bg-white/80"
                      style={{ animation: `dotPulse 1.2s ease-in-out ${i * 0.2}s infinite` }}
                    />
                  ))}
                </div>
              )}
            </div>
          </button>

          {/* Dashed accent ring */}
          <div
            className="absolute rounded-full border border-[#1e2a4a]/10 pointer-events-none"
            style={{
              width: 236,
              height: 236,
              animation: 'spinSlow 18s linear infinite reverse',
              borderStyle: 'dashed',
              borderWidth: '1px',
            }}
          />
        </div>

        {/* Brand text */}
        <div className="mt-6 space-y-2">
          <h1
            className="text-3xl font-light tracking-[0.22em] uppercase text-[#1e2a4a]"
            style={{ fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.24em' }}
          >
            CENNA
          </h1>
          <p
            className="text-[10px] tracking-[0.35em] uppercase text-[#b8a898] font-medium"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Ambient Clinical Intelligence
          </p>
        </div>

        {/* ── Wake-word toggle button ──────────────────────────────────────── */}
        <div className="mt-8">
          <button
            onClick={toggleWake}
            disabled={wakeStatus === 'unsupported'}
            className={`group flex items-center gap-2.5 px-5 py-2 rounded-full border transition-all duration-300 cursor-pointer
              ${wakeStatus === 'active'
                ? 'border-emerald-400/40 bg-emerald-50/80 hover:bg-emerald-100/80'
                : wakeStatus === 'unsupported'
                ? 'border-[#1e2a4a]/8 bg-white/40 opacity-40 cursor-not-allowed'
                : 'border-[#1e2a4a]/12 bg-white/70 hover:bg-[#f5f0e8]/80'
              } backdrop-blur-sm shadow-sm`}
            style={{ fontFamily: "'DM Sans', sans-serif" }}
            title={wakeStatus === 'unsupported' ? 'Browser ini tidak mendukung Web Speech API' : undefined}
          >
            {/* Mic icon */}
            <svg
              className={`w-3.5 h-3.5 transition-colors duration-300
                ${wakeStatus === 'active' ? 'text-emerald-500' : 'text-[#b8a898]'}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
            </svg>

            {/* Pulse dot (only when active) */}
            {wakeStatus === 'active' && (
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: wakeDotColor,
                  animation: 'pulse 1.4s ease-in-out infinite',
                }}
              />
            )}

            <span
              className={`text-[10px] font-semibold tracking-[0.14em] uppercase transition-colors duration-300
                ${wakeStatus === 'active'
                  ? 'text-emerald-600'
                  : wakeStatus === 'unsupported'
                  ? 'text-[#1e2a4a]/30'
                  : 'text-[#1e2a4a]/55'
                }`}
            >
              {wakeLabel}
            </span>
          </button>

          {/* Hint text */}
          {wakeStatus === 'active' && (
            <p
              className="mt-2 text-[9px] tracking-[0.12em] text-[#1e2a4a]/30 text-center"
              style={{ fontFamily: "'DM Mono', monospace" }}
            >
              Ucapkan &ldquo;Hai Cenna&rdquo; untuk mengaktifkan
            </p>
          )}
        </div>
        {/* ──────────────────────────────────────────────────────────────────── */}

      </div>

      {/* Bottom status pill */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center z-10">
        <div
          className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#1e2a4a]/8 bg-white/60 backdrop-blur-sm"
          style={{ fontFamily: "'DM Mono', monospace" }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: orbState === 'idle' ? '#b8a898' : orbState === 'listening' ? '#10b981' : orbState === 'thinking' ? '#1e2a4a' : '#b8a898',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          />
          <span className="text-[10px] tracking-[0.18em] uppercase text-[#1e2a4a]/40 font-medium">
            {orbState === 'idle' ? 'Ready' :
             orbState === 'listening' ? 'Listening' :
             orbState === 'thinking' ? 'Analysing' : 'Composing'}
          </span>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

        @keyframes orbSpin {
          from { filter: hue-rotate(0deg) brightness(1.02); }
          50%  { filter: hue-rotate(8deg) brightness(1.06); }
          to   { filter: hue-rotate(0deg) brightness(1.02); }
        }
        @keyframes barBounce {
          from { transform: scaleY(0.5); opacity: 0.5; }
          to   { transform: scaleY(1); opacity: 1; }
        }
        @keyframes dotPulse {
          0%, 100% { transform: scale(0.7); opacity: 0.4; }
          50% { transform: scale(1.2); opacity: 1; }
        }
        @keyframes spinSlow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.5; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.1); }
        }

        /* ── Wake-word animations ──────────────────────────────────────── */
        @keyframes wakeRingPulse {
          0%   { transform: scale(1);    opacity: 0.5; }
          50%  { transform: scale(1.06); opacity: 0.25; }
          100% { transform: scale(1);    opacity: 0.5; }
        }
        @keyframes wakeFlashRing {
          0%   { transform: scale(1);    opacity: 1; }
          100% { transform: scale(1.18); opacity: 0; }
        }
        @keyframes wakeFlash {
          0%   { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

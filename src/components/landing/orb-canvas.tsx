/**
 * @license SPDX-License-Identifier: Apache-2.0
 *
 * orb-canvas.tsx — OrbCore, OrbCanvas hook, StatusPill, helper hex→rgb
 * Dipecah dari LandingPage.tsx
 */

import React, { useEffect, useRef } from 'react';

export type OrbPhase = 'idle' | 'speaking' | 'listening' | 'processing' | 'responding' | 'popup';
export type OrbVisualModel = 'classic' | 'aurora' | 'pulse' | 'wave';

// ─── Palette fallback ─────────────────────────────────────────────────────────
const PALETTE = { navy: { r: 30, g: 42, b: 74 } };

// ─── Helper: hex → {r,g,b} ────────────────────────────────────────────────────
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : PALETTE.navy;
}

// ─── Particle interface ───────────────────────────────────────────────────────
interface Particle {
  x: number; y: number; vx: number; vy: number;
  size: number; alpha: number; alphaDelta: number;
  colorIdx: number; phaseOffset: number;
}

// ─── useOrbCanvas hook ────────────────────────────────────────────────────────
export function useOrbCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  phase: OrbPhase,
  brandColors: { primary: string; accent: string },
) {
  const animIdRef    = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const colorsRef    = useRef(brandColors);
  colorsRef.current  = brandColors;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = (canvas.width  = window.innerWidth);
    let h = (canvas.height = window.innerHeight);
    const onResize = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; };
    window.addEventListener('resize', onResize);

    const phaseConfig: Record<OrbPhase, { count: number; speed: number; connectDist: number; lineAlpha: number; sizeMax: number; bgAlpha: number }> = {
      idle:       { count: 55,  speed: 0.35, connectDist: 140, lineAlpha: 0.08, sizeMax: 2.8, bgAlpha: 0.92 },
      speaking:   { count: 80,  speed: 0.60, connectDist: 160, lineAlpha: 0.14, sizeMax: 3.5, bgAlpha: 0.88 },
      listening:  { count: 100, speed: 0.75, connectDist: 170, lineAlpha: 0.18, sizeMax: 4.0, bgAlpha: 0.85 },
      processing: { count: 130, speed: 1.00, connectDist: 190, lineAlpha: 0.22, sizeMax: 4.5, bgAlpha: 0.82 },
      responding: { count: 90,  speed: 0.65, connectDist: 165, lineAlpha: 0.16, sizeMax: 3.8, bgAlpha: 0.87 },
      popup:      { count: 40,  speed: 0.25, connectDist: 120, lineAlpha: 0.06, sizeMax: 2.2, bgAlpha: 0.95 },
    };

    const cfg = phaseConfig[phase];
    const makeParticle = (): Particle => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.4, vy: -(Math.random() * cfg.speed + 0.15),
      size: Math.random() * cfg.sizeMax + 0.8, alpha: Math.random() * 0.5 + 0.1,
      alphaDelta: (Math.random() - 0.5) * 0.004,
      colorIdx: Math.floor(Math.random() * 3), phaseOffset: Math.random() * Math.PI * 2,
    });

    while (particlesRef.current.length < cfg.count) particlesRef.current.push(makeParticle());
    if (particlesRef.current.length > cfg.count) particlesRef.current.splice(cfg.count);

    let t = 0;
    const draw = () => {
      const { primary, accent } = colorsRef.current;
      const p  = hexToRgb(primary); const ac = hexToRgb(accent);
      const mx = { r: (p.r + ac.r) >> 1, g: (p.g + ac.g) >> 1, b: (p.b + ac.b) >> 1 };
      const colorPalette = [p, ac, mx];
      t++;

      ctx.fillStyle = `rgba(255,255,255,${cfg.bgAlpha})`;
      ctx.fillRect(0, 0, w, h);

      const aura = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, Math.min(w, h) * 0.42);
      aura.addColorStop(0,   `rgba(${p.r},${p.g},${p.b},0.04)`);
      aura.addColorStop(0.5, `rgba(${ac.r},${ac.g},${ac.b},0.025)`);
      aura.addColorStop(1,   'rgba(255,255,255,0)');
      ctx.fillStyle = aura;
      ctx.beginPath(); ctx.arc(w/2, h/2, Math.min(w, h) * 0.42, 0, Math.PI * 2); ctx.fill();

      const parts = particlesRef.current;
      for (let i = 0; i < parts.length; i++) {
        const pt = parts[i];
        pt.y += pt.vy; pt.x += pt.vx + Math.sin(t * 0.018 + pt.phaseOffset) * 0.35;
        pt.alpha += pt.alphaDelta;
        if (pt.alpha > 0.75 || pt.alpha < 0.05) pt.alphaDelta *= -1;
        if (pt.y < -10) { pt.y = h + 5; pt.x = Math.random() * w; pt.alpha = Math.random() * 0.3 + 0.05; }
        if (pt.x < -10) pt.x = w + 5;
        if (pt.x > w + 10) pt.x = -5;
        const col = colorPalette[pt.colorIdx % 3];
        ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${col.r},${col.g},${col.b},${pt.alpha.toFixed(3)})`; ctx.fill();
      }

      for (let i = 0; i < parts.length; i++) {
        for (let j = i + 1; j < parts.length; j++) {
          const dx = parts[i].x - parts[j].x; const dy = parts[i].y - parts[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < cfg.connectDist) {
            const progress = 1 - dist / cfg.connectDist;
            const colA = colorPalette[parts[i].colorIdx % 3]; const colB = colorPalette[parts[j].colorIdx % 3];
            const r = (colA.r + colB.r) >> 1; const g = (colA.g + colB.g) >> 1; const b = (colA.b + colB.b) >> 1;
            ctx.strokeStyle = `rgba(${r},${g},${b},${(cfg.lineAlpha * progress).toFixed(3)})`;
            ctx.lineWidth = progress * 1.2;
            ctx.beginPath(); ctx.moveTo(parts[i].x, parts[i].y); ctx.lineTo(parts[j].x, parts[j].y); ctx.stroke();
          }
        }
      }
      animIdRef.current = requestAnimationFrame(draw);
    };

    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    draw();
    return () => { window.removeEventListener('resize', onResize); cancelAnimationFrame(animIdRef.current); };
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps
}

// ─── OrbCore ──────────────────────────────────────────────────────────────────
interface OrbCoreProps {
  phase:           OrbPhase;
  wakeEnabled:     boolean;
  wakeFlash:       boolean;
  templateColors?: { primary: string; secondary: string } | null;
  orbSize:         number;
  visualModel:     OrbVisualModel;
}

export function OrbCore({ phase, wakeEnabled, wakeFlash, templateColors, orbSize, visualModel }: OrbCoreProps) {
  const orbPrimary   = templateColors?.primary   ?? '#1e2a4a';
  const orbSecondary = templateColors?.secondary  ?? '#b8a898';
  const S = { sphere: orbSize * 0.59, glow: orbSize * 0.76, wakeRing: orbSize * 0.82, listenRing: orbSize * 0.85, outerRing: orbSize * 0.69 };
  const glowColor = templateColors ? orbPrimary : { idle: '#1e2a4a', speaking: '#b8a898', listening: '#7F77DD', processing: '#7F77DD', responding: '#b8a898', popup: '#b8a898' }[phase];
  const ringPx = (() => {
    if (templateColors) return `0 0 0 ${orbSize * 0.015}px ${orbPrimary}50`;
    return { idle: `0 0 0 ${orbSize * 0.009}px rgba(30,42,74,0.20)`, speaking: `0 0 0 ${orbSize * 0.015}px rgba(184,168,152,0.60)`, listening: `0 0 0 ${orbSize * 0.015}px rgba(127,119,221,0.50)`, processing: `0 0 0 ${orbSize * 0.018}px rgba(127,119,221,0.70)`, responding: `0 0 0 ${orbSize * 0.015}px rgba(184,168,152,0.60)`, popup: `0 0 0 ${orbSize * 0.009}px rgba(184,168,152,0.30)` }[phase];
  })();

  const renderInnerVisual = () => {
    if (visualModel === 'aurora') return (
      <div style={{ width: S.sphere, height: S.sphere, position: 'relative', borderRadius: '50%', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: `radial-gradient(circle at 40% 35%, ${orbPrimary}dd 0%, transparent 65%)`, filter: 'blur(12px)', animation: 'orbSpin 9s linear infinite' }} />
        <div style={{ position: 'absolute', inset: '15%', borderRadius: '50%', background: `radial-gradient(circle at 60% 55%, ${orbSecondary}bb 0%, transparent 70%)`, filter: 'blur(16px)', animation: 'orbSpin 13s linear infinite reverse' }} />
        <div style={{ position: 'absolute', inset: '25%', borderRadius: '50%', background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.25) 0%, transparent 60%)', filter: 'blur(4px)' }} />
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(circle at 32% 28%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.05) 55%, transparent 80%)' }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {phase === 'listening'  && <div style={{ width: S.sphere * 0.15, height: S.sphere * 0.15, borderRadius: '50%', background: 'rgba(255,255,255,0.8)', animation: 'pulse 1s ease-in-out infinite' }} />}
          {phase === 'processing' && <div style={{ display: 'flex', gap: S.sphere * 0.04 }}>{[0,1,2].map(i => <div key={i} style={{ width: S.sphere * 0.06, height: S.sphere * 0.06, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', animation: `processingDot 1.1s ease-in-out ${i * 0.2}s infinite` }} />)}</div>}
        </div>
      </div>
    );
    if (visualModel === 'pulse') {
      const rings = [1, 0.75, 0.52, 0.32]; const opacities = ['80', '55', '38', '20'];
      return (
        <div style={{ width: S.sphere, height: S.sphere, position: 'relative' }}>
          {rings.map((scale, i) => (<div key={i} style={{ position: 'absolute', width: `${scale * 100}%`, height: `${scale * 100}%`, top: `${(1 - scale) / 2 * 100}%`, left: `${(1 - scale) / 2 * 100}%`, borderRadius: '50%', border: `${Math.max(1.5, (2.5 - i * 0.4))}px solid ${orbPrimary}${opacities[i]}`, animation: `pulse ${1.4 + i * 0.45}s ease-in-out ${i * 0.15}s infinite` }} />))}
          <div style={{ position: 'absolute', top: '42%', left: '42%', width: '16%', height: '16%', borderRadius: '50%', background: orbPrimary, boxShadow: `0 0 ${S.sphere * 0.12}px ${orbPrimary}80`, animation: phase === 'listening' ? 'pulse 0.8s ease-in-out infinite' : undefined }} />
          {phase === 'processing' && (<div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: S.sphere * 0.06 }}>{[0,1,2,3,4,5].map(i => <div key={i} style={{ width: S.sphere * 0.05, height: S.sphere * 0.05, borderRadius: '50%', background: orbPrimary, animation: `processingDot 1.1s ease-in-out ${i * 0.12}s infinite` }} />)}</div>)}
        </div>
      );
    }
    if (visualModel === 'wave') return (
      <div style={{ width: S.sphere, height: S.sphere, position: 'relative', borderRadius: '50%', overflow: 'hidden', background: `linear-gradient(160deg, ${orbPrimary} 0%, ${orbSecondary} 50%, ${orbPrimary} 100%)`, boxShadow: `0 0 ${S.sphere * 0.2}px ${orbPrimary}40` }}>
        {[0, 1, 2].map(i => (<div key={i} style={{ position: 'absolute', width: '200%', height: '200%', top: `${30 + i * 12}%`, left: '-50%', borderRadius: '42%', background: `rgba(255,255,255,${0.12 - i * 0.03})`, animation: `orbSpin ${6 + i * 2}s linear ${i % 2 === 0 ? '' : 'reverse'} infinite`, transformOrigin: '50% 48%' }} />))}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.45) 0%, transparent 55%)' }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {phase === 'listening'  && <div style={{ display: 'flex', gap: S.sphere * 0.04, alignItems: 'flex-end', height: S.sphere * 0.28 }}>{[0.5,0.75,1,0.75,0.5].map((s, i) => <div key={i} style={{ width: S.sphere * 0.04, borderRadius: S.sphere, background: 'rgba(255,255,255,0.8)', height: `${s * 100}%`, animation: `barBounce 1.6s ease-in-out ${i * 0.14}s infinite alternate` }} />)}</div>}
          {(phase === 'speaking' || phase === 'responding') && <div style={{ display: 'flex', gap: S.sphere * 0.04, alignItems: 'flex-end', height: S.sphere * 0.28 }}>{[0.6,0.9,1,0.8,0.5,0.7,0.4].map((s, i) => <div key={i} style={{ width: S.sphere * 0.035, borderRadius: S.sphere, background: 'white', height: `${s * 100}%`, animation: `barBounce 0.45s ease-in-out ${i * 0.06}s infinite alternate` }} />)}</div>}
        </div>
      </div>
    );
    // DEFAULT: classic
    return (
      <div className="relative rounded-full flex items-center justify-center border-none transition-all duration-1000 ease-out"
        style={{ width: S.sphere, height: S.sphere, background: templateColors ? `conic-gradient(from 0deg, ${orbPrimary} 0%, ${orbSecondary} 35%, #f5f0e8 55%, ${orbSecondary} 75%, ${orbPrimary} 100%)` : 'conic-gradient(from 0deg, #1e2a4a 0%, #b8a898 35%, #f5f0e8 55%, #b8a898 75%, #1e2a4a 100%)', boxShadow: `${ringPx}, 0 28px 60px -12px ${glowColor}40, 0 0 0 1px rgba(255,255,255,0.15) inset`, animation: 'orbSpin 14s linear infinite' }}>
        <div className="absolute rounded-full" style={{ inset: 6, background: 'radial-gradient(ellipse at 35% 30%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.08) 60%, transparent 100%)' }} />
        <div className="relative flex flex-col items-center justify-center z-10">
          {phase === 'idle'       && <div className="flex items-end" style={{ gap: S.sphere * 0.025, height: S.sphere * 0.14 }}>{[0.5,0.75,1,0.75,0.5].map((s,i) => <div key={i} className="rounded-full bg-white/80" style={{ width: S.sphere * 0.015, height: `${s * 100}%`, animation: `barBounce 1.6s ease-in-out ${i * 0.14}s infinite alternate`, opacity: 0.6 + s * 0.3 }} />)}</div>}
          {(phase === 'speaking' || phase === 'responding') && <div className="flex items-end" style={{ gap: S.sphere * 0.025, height: S.sphere * 0.14 }}>{[0.6,0.9,1,0.8,0.5,0.7,0.4].map((s,i) => <div key={i} className="rounded-full bg-white" style={{ width: S.sphere * 0.015, height: `${s * 100}%`, animation: `barBounce 0.45s ease-in-out ${i * 0.06}s infinite alternate` }} />)}</div>}
          {phase === 'processing' && <div className="flex items-center" style={{ gap: S.sphere * 0.03 }}>{[0,1,2,3,4,5].map(i => <div key={i} className="rounded-full" style={{ width: S.sphere * 0.024, height: S.sphere * 0.024, background: 'rgba(255,255,255,0.9)', animation: `processingDot 1.1s ease-in-out ${i * 0.12}s infinite` }} />)}</div>}
          {phase === 'listening'  && <div className="flex items-center" style={{ gap: S.sphere * 0.03 }}>{[0,1,2,3,4].map(i => <div key={i} className="rounded-full bg-white" style={{ width: S.sphere * (0.02 + i % 2 * 0.01), height: S.sphere * (0.02 + i % 2 * 0.01), animation: `dotPulse 1.0s ease-in-out ${i * 0.18}s infinite` }} />)}</div>}
          {phase === 'popup'      && <div className="flex items-center justify-center" style={{ width: S.sphere * 0.25, height: S.sphere * 0.25 }}><svg width={S.sphere * 0.18} height={S.sphere * 0.18} viewBox="0 0 28 28" fill="none"><path d="M6 14l6 6L22 8" stroke="rgba(255,255,255,0.9)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg></div>}
        </div>
      </div>
    );
  };

  return (
    <div className="relative flex items-center justify-center" style={{ width: orbSize, height: orbSize }}>
      {wakeEnabled && phase === 'idle' && (<div className="absolute rounded-full pointer-events-none" style={{ width: S.wakeRing, height: S.wakeRing, border: '1.5px solid rgba(16,185,129,0.35)', animation: 'wakeRingPulse 2.2s ease-in-out infinite' }} />)}
      {wakeFlash && (<div className="absolute rounded-full pointer-events-none" style={{ width: S.wakeRing, height: S.wakeRing, border: '2.5px solid rgba(16,185,129,0.7)', animation: 'wakeFlashRing 0.9s ease-out forwards' }} />)}
      {phase === 'listening' && (<div className="absolute rounded-full pointer-events-none" style={{ width: S.listenRing, height: S.listenRing, border: '1.5px solid rgba(127,119,221,0.45)', animation: 'listeningPulse 1.8s ease-in-out infinite' }} />)}
      <div className="absolute rounded-full transition-all duration-700 ease-out" style={{ width: S.glow, height: S.glow, background: `radial-gradient(circle, ${glowColor}22 0%, transparent 75%)`, filter: `blur(${orbSize * 0.094}px)`, transform: `scale(${phase === 'listening' ? 1.12 : 1})` }} />
      {visualModel !== 'classic' && (<div style={{ position: 'relative', boxShadow: ringPx, borderRadius: '50%', transition: 'box-shadow 0.7s ease' }}>{renderInnerVisual()}</div>)}
      {visualModel === 'classic' && renderInnerVisual()}
      {visualModel !== 'pulse' && (<div className="absolute rounded-full border border-[#1e2a4a]/10 pointer-events-none" style={{ width: S.outerRing, height: S.outerRing, animation: 'spinSlow 18s linear infinite reverse', borderStyle: 'dashed', borderWidth: '1px' }} />)}
    </div>
  );
}

// ─── StatusPill ───────────────────────────────────────────────────────────────
export function StatusPill({ phase, aiLabel }: { phase: OrbPhase; aiLabel: string }) {
  const config = {
    idle:       { color: '#b8a898', label: 'Siap — ucapkan "Hai Cenna"' },
    speaking:   { color: '#10b981', label: 'Menyapa…' },
    listening:  { color: '#7F77DD', label: 'Mendengarkan percakapan' },
    processing: { color: '#7F77DD', label: aiLabel || 'Cenna sedang berpikir…' },
    responding: { color: '#10b981', label: 'Cenna merespons…' },
    popup:      { color: '#b8a898', label: 'Data ditangkap' },
  }[phase];
  return (
    <div className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#1e2a4a]/8 bg-white/60 backdrop-blur-sm" style={{ fontFamily: "'DM Mono', monospace" }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: config.color, animation: 'pulse 1.5s ease-in-out infinite' }} />
      <span className="text-[10px] tracking-[0.18em] uppercase text-[#1e2a4a]/40 font-medium" style={phase === 'processing' ? { color: '#7F77DD', opacity: 1 } : {}}>
        {config.label}
      </span>
    </div>
  );
}

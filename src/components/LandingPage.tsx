/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Mic, Activity, Volume2, ShieldAlert } from 'lucide-react';

interface LandingPageProps {
  onLoginClick: () => void;
}

type OrbStatus = 'idle' | 'listening' | 'thinking' | 'writing';

export default function LandingPage({ onLoginClick }: LandingPageProps) {
  const [orbState, setOrbState] = useState<OrbStatus>('idle');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Auto cycle states on click or let the user click to test different modes
  const handleOrbClick = () => {
    setOrbState((prev) => {
      if (prev === 'idle') return 'listening';
      if (prev === 'listening') return 'thinking';
      if (prev === 'thinking') return 'writing';
      return 'idle';
    });
  };

  // Canvas-based organic fluid waveform/aura animations behind the white floating orb
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

    let angle = 0;
    let animId: number;

    const draw = () => {
      // Clean white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);

      // Soft ambient glowing circles behind the floating orb
      let accentColor = 'rgba(59, 130, 246, 0.12)'; // Default idle soft blue
      let ringCount = 2;
      let pulseSpeed = 0.015;

      if (orbState === 'listening') {
        accentColor = 'rgba(16, 185, 129, 0.18)'; // active green
        ringCount = 3;
        pulseSpeed = 0.03;
      } else if (orbState === 'thinking') {
        accentColor = 'rgba(139, 92, 246, 0.18)'; // thinking deep violet
        ringCount = 4;
        pulseSpeed = 0.045;
      } else if (orbState === 'writing') {
        accentColor = 'rgba(245, 158, 11, 0.16)'; // writing golden aura
        ringCount = 3;
        pulseSpeed = 0.025;
      }

      angle += pulseSpeed;

      // Draw beautiful concentric soft radial waves
      for (let i = 0; i < ringCount; i++) {
        const factor = 1 + Math.sin(angle + i * 1.5) * 0.15;
        const radius = (180 + i * 45) * factor;

        ctx.strokeStyle = accentColor;
        ctx.lineWidth = 1.5 - i * 0.25;
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw fluid floating ambient waveforms around the center
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x < w; x += 10) {
        // Distance check from center
        const dx = x - w / 2;
        const dist = Math.abs(dx);
        let ampFactor = 0;

        // Peak amplitude only near the center orb area
        if (dist < 400) {
          ampFactor = Math.cos((dist / 400) * (Math.PI / 2));
        }

        const waveAmp = (orbState === 'listening' ? 40 : orbState === 'thinking' ? 15 : orbState === 'writing' ? 25 : 10) * ampFactor;
        const y = h / 2 + Math.sin(x * 0.015 + angle * 2) * waveAmp;

        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
    };
  }, [orbState]);

  return (
    <div className="relative min-h-screen w-full bg-white overflow-hidden flex flex-col items-center justify-center select-none font-sans">
      {/* Background canvas containing beautiful organic waves */}
      <canvas ref={canvasRef} className="absolute inset-0 z-0 pointer-events-none" />

      {/* Tiny Super-Minimal Subtle Control Link for Admin/Credential configuration */}
      <div className="absolute top-6 right-6 z-30">
        <button
          id="btn-admin-config"
          onClick={onLoginClick}
          className="px-4 py-2 text-[11px] font-bold text-slate-400 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-full border border-slate-100 transition duration-300 cursor-pointer shadow-sm tracking-wider uppercase"
        >
          Portal Admin
        </button>
      </div>

      {/* Main Single Full-screen Floating Orb Container */}
      <div className="relative z-10 flex flex-col items-center justify-center p-4 text-center max-w-lg w-full">
        
        {/* Dynamic Glowing Rings around the prime orb */}
        <div className="relative flex items-center justify-center w-[340px] h-[340px]">
          
          {/* Accent Glow Shadow Layer */}
          <div className={`absolute w-[280px] h-[280px] rounded-full filter blur-[70px] opacity-40 transition-all duration-750 ease-out ${
            orbState === 'idle' ? 'bg-blue-400' :
            orbState === 'listening' ? 'bg-emerald-400' :
            orbState === 'thinking' ? 'bg-purple-400' : 'bg-amber-400'
          }`} />

          {/* Prime Glassmorphic Floating Orb */}
          <button
            id="btn-prime-orb"
            onClick={handleOrbClick}
            className={`w-[220px] h-[220px] rounded-full bg-white/70 backdrop-blur-2xl flex flex-col items-center justify-center border-none transition-all duration-750 ease-out cursor-pointer shadow-[0_25px_60px_-15px_rgba(0,0,0,0.1)] hover:shadow-[0_30px_70px_-10px_rgba(0,0,0,0.15)] transform active:scale-95 hover:-translate-y-1 ${
              orbState === 'idle' ? 'ring-4 ring-blue-500/15' :
              orbState === 'listening' ? 'ring-8 ring-emerald-500/20' :
              orbState === 'thinking' ? 'ring-8 ring-purple-500/25' : 'ring-6 ring-amber-500/20'
            }`}
          >
            {/* Spinning inner detail ring */}
            <div className={`absolute inset-3 rounded-full border border-slate-100/60 flex items-center justify-center transition-transform duration-1000 ${
              orbState === 'thinking' ? 'rotate-180' : 'rotate-0'
            }`}>
              
              {/* Dynamic status icons */}
              <div className="flex flex-col items-center justify-center">
                {orbState === 'idle' && (
                  <Volume2 className="w-10 h-10 text-blue-500 transition-all animate-bounce" />
                )}
                {orbState === 'listening' && (
                  <Mic className="w-10 h-10 text-emerald-500 transition-all animate-pulse" />
                )}
                {orbState === 'thinking' && (
                  <Sparkles className="w-10 h-10 text-purple-500 transition-all animate-spin" style={{ animationDuration: '3s' }} />
                )}
                {orbState === 'writing' && (
                  <Activity className="w-10 h-10 text-amber-500 transition-all animate-pulse" />
                )}
              </div>

            </div>
          </button>

        </div>

        {/* Dynamic Status Display & Instructional micro-labels */}
        <div className="mt-8 space-y-1 transition-all duration-500">
          <p className="text-[10px] tracking-widest uppercase font-bold text-slate-400 font-mono">
            {orbState === 'idle' ? 'Sistem Siap' :
             orbState === 'listening' ? 'Mendengarkan...' :
             orbState === 'thinking' ? 'Menganalisis Kasus...' : 'Membentuk Rujukan SOAP...'}
          </p>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 capitalize">
            {orbState === 'idle' ? 'Hai Cenna' : orbState}
          </h1>
          <p className="text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed pt-2">
            Klik AI ORB untuk mensimulasikan perubahan status layanan secara real-time.
          </p>
        </div>

      </div>

      {/* Auto Wake Up Voice recognition helper indicator invisible or deeply minimalist at bottom */}
      <div className="absolute bottom-6 left-0 right-0 text-center z-10">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 border border-slate-100 text-[10px] text-slate-400 font-medium font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Auto Wake Word: Active
        </span>
      </div>
    </div>
  );
}

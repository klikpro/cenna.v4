/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';

interface LandingPageProps {
  onLoginClick: () => void;
}

export default function LandingPage({ onLoginClick }: LandingPageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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

    class Particle {
      x: number = Math.random() * w;
      y: number = Math.random() * h;
      vx: number = (Math.random() - 0.5) * 0.25;
      vy: number = (Math.random() - 0.5) * 0.25;
      r: number = Math.random() * 1.5 + 0.3;
      a: number = Math.random() * 0.15 + 0.03;

      update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < 0 || this.x > w) this.vx *= -1;
        if (this.y < 0 || this.y > h) this.vy *= -1;
      }

      draw() {
        if (!ctx) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(30,42,74,${this.a * 0.35})`;
        ctx.fill();
      }
    }

    const particles = Array.from({ length: 65 }, () => new Particle());

    let animationId: number;
    const loop = () => {
      ctx.clearRect(0, 0, w, h);
      
      // Draw smooth off-white backgrounds with subtle radial overlays
      ctx.fillStyle = '#f8f5f0';
      ctx.fillRect(0, 0, w, h);

      const radialLeft = ctx.createRadialGradient(w * 0.1, h * 0.85, 0, w * 0.1, h * 0.85, w * 0.3);
      radialLeft.addColorStop(0, 'rgba(184,168,152,0.12)');
      radialLeft.addColorStop(1, 'transparent');
      ctx.fillStyle = radialLeft;
      ctx.fillRect(0, 0, w, h);

      const radialRight = ctx.createRadialGradient(w * 0.9, h * 0.1, 0, w * 0.9, h * 0.1, w * 0.25);
      radialRight.addColorStop(0, 'rgba(30,42,74,0.06)');
      radialRight.addColorStop(1, 'transparent');
      ctx.fillStyle = radialRight;
      ctx.fillRect(0, 0, w, h);

      // Connect near particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(30,42,74,${0.04 * (1 - d / 120)})`;
            ctx.lineWidth = 0.45;
            ctx.stroke();
          }
        }
      }

      particles.forEach((p) => {
        p.update();
        p.draw();
      });

      animationId = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <div className="relative min-height-screen overflow-x-hidden font-sans pb-16 bg-[#f8f5f0]">
      {/* Dynamic Background Canvas */}
      <canvas ref={canvasRef} id="bg-canvas" className="fixed inset-0 z-0 pointer-events-none" />

      {/* Sticky Blurred Nav Header */}
      <nav id="main-nav" className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 h-[68px] bg-white/80 backdrop-blur-md border-b border-[#1e2a4a]/12 transition-all duration-300">
        <div className="flex items-center gap-3">
          <div className="w-[36px] height-[36px] rounded-full bg-gradient-to-br from-[#1e2a4a] to-[#2d3f6b] flex items-center justify-center font-extrabold text-[15px] text-white shadow-md">
            C
          </div>
          <span className="font-bold text-[18px] tracking-wide text-[#1e2a4a] font-sans">
            CENNA AI
          </span>
        </div>

        <div className="flex gap-4 items-center">
          <button
            id="btn-admin-login-top"
            onClick={onLoginClick}
            className="px-5 py-2 border border-[#1e2a4a]/15 rounded-full text-[13px] font-semibold text-[#1e2a4a] hover:bg-[#1e2a4a]/6 transition pointer cursor-pointer"
          >
            Admin Panel
          </button>
          <a
            id="btn-demo-contact-top"
            href="#cta"
            className="hidden sm:inline-flex px-[18px] py-[9px] bg-[#1e2a4a] hover:bg-[#2d3f6b] border-none rounded-full text-[13px] font-semibold text-white shadow-md transition items-center gap-1 cursor-pointer"
          >
            Request Demo <span>&rarr;</span>
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <header id="hero" className="relative z-10 pt-[140px] px-6 text-center max-w-4xl mx-auto flex flex-col items-center">
        <div className="inline-flex items-center gap-2 px-4 py-[6px] rounded-full bg-[#1e2a4a]/6 border border-[#1e2a4a]/15 text-[11px] font-semibold text-[#1e2a4a] uppercase tracking-wider mb-8">
          <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
          Ambient Clinical Intelligence · 2026
        </div>

        <h1 className="text-5xl md:text-8xl tracking-tight text-[#111827] mb-2 font-serif font-bold text-center leading-tight">
          CENNA AI
        </h1>

        <p className="text-[13px] font-bold tracking-widest text-[#b8a898] uppercase mb-6 font-sans">
          From Conversation to Clinical Action
        </p>

        <p className="max-w-2xl text-[16px] md:text-[19px] leading-relaxed text-[#1e2a4a]/60 font-light mb-10 text-center">
          <span className="text-[#111827] italic font-normal">"Dokter berbicara. CENNA memahami, berpikir, membantu, dan mengeksekusi."</span>
          <br />
          Next-generation personal medical assistant dibangun untuk layanan kesehatan Indonesia.
        </p>

        <div className="flex gap-4 items-center flex-wrap justify-center mb-14">
          <a
            id="btn-hero-demo"
            href="#cta"
            className="px-8 py-4 bg-[#1e2a4a] hover:bg-[#2d3f6b] rounded-full text-[15px] font-semibold text-white shadow-lg shadow-[#1e2a4a]/30 transition transform hover:-translate-y-[2px]"
          >
            🎤 Mulai Demo Layanan
          </a>
          <button
            id="btn-hero-login"
            onClick={onLoginClick}
            className="px-8 py-4 border-2 border-[#1e2a4a]/25 hover:border-[#1e2a4a]/40 text-[#1e2a4a] rounded-full text-[15px] font-medium bg-transparent hover:bg-[#1e2a4a]/6 transition"
          >
            Admin Workspace &rarr;
          </button>
        </div>

        {/* Floating Cockpit Hud Visualizer */}
        <div className="relative w-full max-w-[340px] mb-12">
          <div className="w-[200px] h-[200px] border border-[#1e2a4a]/12 rounded-full flex items-center justify-center mx-auto relative animate-pulse">
            <div className="w-[170px] h-[170px] border border-[#1e2a4a]/6 rounded-full flex items-center justify-center absolute">
              <div className="w-[140px] h-[140px] rounded-full bg-gradient-to-tr from-[#3d5494] via-[#1e2a4a] to-[#0d1a36] shadow-xl shadow-[#1e2a4a]/35 flex items-center justify-center relative overflow-hidden">
                <span className="font-bold text-[12px] tracking-widest text-white/90">CENNA AI</span>
              </div>
            </div>
            <div className="absolute top-[10px] -right-[15px] bg-white/95 border border-[#1e2a4a]/12 p-2 rounded-xl text-left shadow-md">
              <strong className="block text-lg font-extrabold text-[#1e2a4a] font-sans">&lt;250ms</strong>
              <span className="text-[10px] text-[#1e2a4a]/50">Latency Speed</span>
            </div>
            <div className="absolute bottom-[20px] -left-[20px] bg-white/95 border border-[#1e2a4a]/12 p-2 rounded-xl text-left shadow-md">
              <strong className="block text-lg font-extrabold text-[#111827] font-sans">98.4%</strong>
              <span className="text-[10px] text-[#1e2a4a]/50">SOP Accuracy</span>
            </div>
          </div>
        </div>
      </header>

      {/* Paradigm Section */}
      <section id="paradigm" className="py-24 max-w-5xl mx-auto px-6">
        <header className="text-center mb-16">
          <div className="inline-flex px-4 py-[5px] bg-[#1e2a4a]/6 border border-[#1e2a4a]/12 rounded-full text-[11px] font-semibold text-[#1e2a4a] uppercase tracking-wider mb-4">
            02 / Paradigm Shift
          </div>
          <h2 className="text-3xl md:text-5xl font-serif font-bold text-[#111827] mb-4">
            Meninggalkan <span className="bg-gradient-to-tr from-[#1e2a4a] to-[#b8a898] bg-clip-text text-transparent">Beban RME Lama</span>
          </h2>
          <p className="text-[#1e2a4a]/55 text-sm md:text-base max-w-md mx-auto">
            CENNA mengubah dokter dari juru ketik yang lelah di depan monitor menjadi pendengar sejati bagi kesembuhan pasien.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-red-500/5 border border-red-500/15 p-6 rounded-2xl">
            <h3 className="text-red-700 font-bold text-[15px] flex items-center gap-2 mb-4 bg-red-500/10 p-[10px] rounded-lg">
              <span>⛔</span> Manajemen Rekam Medis Konvensional
            </h3>
            <ul className="space-y-3 text-red-900/75 text-sm">
              <li className="flex gap-2"><span>✕</span> Dokter terus-menerus mengetik selama konsultasi</li>
              <li className="flex gap-2"><span>✕</span> Kontak mata dengan pasien terpotong atau minim</li>
              <li className="flex gap-2"><span>✕</span> Entri formulir SOAP membosankan dengan banyak klik</li>
              <li className="flex gap-2"><span>✕</span> Pilihan kode ICD-10 harus dicari manual berulang kali</li>
              <li className="flex gap-2"><span>✕</span> Menghambat efisiensi klinik dengan volume pasien tinggi</li>
            </ul>
          </div>

          <div className="bg-[#1e2a4a]/5 border border-[#1e2a4a]/15 p-6 rounded-2xl">
            <h3 className="text-[#1e2a4a] font-bold text-[15px] flex items-center gap-2 mb-4 bg-[#1e2a4a]/8 p-[10px] rounded-lg">
              <span>✦</span> AI Ambient Cockpit Experience
            </h3>
            <ul className="space-y-3 text-slate-800 text-sm">
              <li className="flex gap-2"><span className="text-[#10b981] font-bold">✓</span> AI mendengar percakapan secara pasif di latar belakang</li>
              <li className="flex gap-2"><span className="text-[#10b981] font-bold">✓</span> Memahami istilah medis Indonesia dan latin secara instan</li>
              <li className="flex gap-2"><span className="text-[#10b981] font-bold">✓</span> Penyusunan rekam medis SOAP tergenerate otomatis</li>
              <li className="flex gap-2"><span className="text-[#10b981] font-bold">✓</span> Differential diagnosis bertenaga reasoning klinis</li>
              <li className="flex gap-2"><span className="text-[#10b981] font-bold">✓</span> Eksekusi hands-free 100% tersinkron ke file RME</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-[#ede6d6]/40">
        <div className="max-w-5xl mx-auto px-6">
          <header className="text-center mb-16">
            <div className="inline-flex px-4 py-[5px] bg-[#1e2a4a]/6 border border-[#1e2a4a]/12 rounded-full text-[11px] font-semibold text-[#1e2a4a] uppercase tracking-wider mb-4">
              03 / Fitur Inti
            </div>
            <h2 className="text-3xl md:text-5xl font-serif font-bold text-[#111827] mb-4">
              Didesain untuk Kepresisian <span className="bg-gradient-to-tr from-[#1e2a4a] to-[#b8a898] bg-clip-text text-transparent">Klinis</span>
            </h2>
            <p className="text-[#1e2a4a]/55 text-sm md:text-base max-w-md mx-auto">
              Sistem asisten yang tanggap mengawal keselamatan terapi Anda di setiap lini.
            </p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white/85 border border-[#1e2a4a]/12 p-6 rounded-2xl hover:shadow-lg transition">
              <div className="text-3xl mb-4">🎙</div>
              <h4 className="font-bold text-[#1e2a4a] mb-2 text-base">Ambient Listening</h4>
              <p className="text-[#1e2a4a]/60 text-xs leading-relaxed">
                Merekam otomatis audio konsultasi, membedakan lafal dokter dan pasien, serta menyajikan transkrip medis real-time yang akurat.
              </p>
            </div>

            <div className="bg-white/85 border border-[#1e2a4a]/12 p-6 rounded-2xl hover:shadow-lg transition">
              <div className="text-3xl mb-4">🧠</div>
              <h4 className="font-bold text-[#1e2a4a] mb-2 text-base">Clinical Intelligence</h4>
              <p className="text-[#1e2a4a]/60 text-xs leading-relaxed">
                Menyusun resep terukur, otomatis mencocokkan differential diagnosis, mendeteksi red flags tanda bahaya kritis, serta menyarankan kode ICD-10.
              </p>
            </div>

            <div className="bg-white/85 border border-[#1e2a4a]/12 p-6 rounded-2xl hover:shadow-lg transition">
              <div className="text-3xl mb-4">💊</div>
              <h4 className="font-bold text-[#1e2a4a] mb-2 text-base">Medication Safety</h4>
              <p className="text-[#1e2a4a]/60 text-xs leading-relaxed">
                Mengecek interaksi obat bermasalah, saringan kontraindikasi komorbid, duplikasi obat, serta kategori kehamilan agar resep selalu aman.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Voice Cockpit Section */}
      <section id="voice" className="py-24 max-w-5xl mx-auto px-6">
        <header className="text-center mb-16">
          <div className="inline-flex px-4 py-[5px] bg-[#1e2a4a]/6 border border-[#1e2a4a]/12 rounded-full text-[11px] font-semibold text-[#1e2a4a] uppercase tracking-wider mb-4">
            04 / Cockpit Interaksi
          </div>
          <h2 className="text-3xl md:text-5xl font-serif font-bold text-[#111827] mb-4">
            Voice Control & <span className="bg-gradient-to-tr from-[#1e2a4a] to-[#b8a898] bg-clip-text text-transparent">Clinical Gap Detector</span>
          </h2>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-[#ede6d6]/60 p-8 rounded-2xl border border-[#1e2a4a]/12">
            <h4 className="font-bold text-base text-[#1e2a4a] mb-2">Hands-Free System Commands</h4>
            <p className="text-xs text-[#1e2a4a]/60 mb-6">Ubah instruksi vokal langsung menjadi rekapitulasi data tanpa sentuhan keyboard:</p>
            <div className="space-y-3">
              <div className="flex gap-3 bg-white/60 p-3 rounded-lg border border-[#1e2a4a]/8 text-xs font-semibold">
                <span className="text-slate-400">›</span> "Cenna buka riwayat kontrol gula darah."
              </div>
              <div className="flex gap-3 bg-white/60 p-3 rounded-lg border border-[#1e2a4a]/8 text-xs font-semibold">
                <span className="text-slate-400">›</span> "Cenna resepkan Amoxicillin 500 MG 3 kali sehari."
              </div>
              <div className="flex gap-3 bg-white/60 p-3 rounded-lg border border-[#1e2a4a]/8 text-xs font-semibold">
                <span className="text-slate-400">›</span> "Cenna generate rujukan Sp.PD ke RS rujukan."
              </div>
            </div>
          </div>

          <div className="bg-[#ede6d6]/60 p-8 rounded-2xl border border-[#1e2a4a]/12">
            <h4 className="font-bold text-base text-[#1e2a4a] mb-2">Smart Clinical Gap Analyzer</h4>
            <p className="text-xs text-[#1e2a4a]/60 mb-6">Membimbing dokter dengan mengajukan pertanyaan krusial yang luput:</p>
            <div className="bg-white/80 p-4 rounded-xl border border-[#1e2a4a]/8">
              <div className="text-xs italic text-[#1e2a4a]/60 mb-3">Pasien: "Nyeri perut kanan bawah sejak kemarin malam"</div>
              <div className="text-[10px] text-[#1e2a4a] font-bold border-b border-slate-200 pb-2 mb-3">CENNA AI GAP DETECTOR:</div>
              <div className="space-y-2 text-xs text-[#1e2a4a]/75">
                <p>🙋‍♂️ "Apakah nyeri bertambah jika batuk atau melompat?" (Tanda Peritonitis)</p>
                <p>🙋‍♂️ "Ada riwayat mual, mutah atau nafsu makan berkurang?" (Migrasi Nyeri)</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Box */}
      <section id="cta" className="py-24 max-w-5xl mx-auto px-6">
        <div className="bg-gradient-to-br from-[#1e2a4a] to-[#2d3f6b] rounded-3xl p-12 text-center text-white relative overflow-hidden shadow-2xl">
          <div className="relative z-10">
            <h2 className="text-3xl md:text-5xl font-serif mb-4">Siap Mengimplementasikan Kesehatan Masa Depan?</h2>
            <p className="text-white/70 max-w-md mx-auto text-sm md:text-base mb-8">
              Kurangi kelelahan dokter, tingkatkan keselamatan dan fokus tatap muka pada pasien sekarang juga.
            </p>
            <button
              onClick={onLoginClick}
              className="px-8 py-4 bg-white text-[#1e2a4a] hover:bg-slate-100 font-bold rounded-full transition cursor-pointer text-sm shadow-md"
            >
              Mulai Gunakan Workspace Terpadu
            </button>
            <p className="text-white/40 text-[11px] mt-6">
              dr. Reza Ariandes · CENNA AI · 2026 · hello@cennaai.id
            </p>
          </div>
        </div>
      </section>

      {/* Landing Footer */}
      <footer className="max-w-5xl mx-auto px-6 border-t border-[#1e2a4a]/12 pt-8 flex flex-col sm:flex-row justify-between items-center text-[#1e2a4a]/40 text-xs">
        <div>© 2026 CENNA AI. All rights reserved. Built with ❤️ in Jakarta.</div>
        <div className="flex gap-4 mt-4 sm:mt-0">
          <span>HIPAA compliant</span>
          <span>·</span>
          <span>Indonesia Cloud residency</span>
        </div>
      </footer>
    </div>
  );
}

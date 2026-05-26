/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { sbSignIn } from '../lib/supabase';

interface LoginProps {
  onLoginSuccess: (session: any) => void;
  onBackClick: () => void;
}

export default function Login({ onLoginSuccess, onBackClick }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Email dan password wajib diisi.');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const session = await sbSignIn(email.trim(), password);
      setSuccess('Otentikasi berhasil! Mengalihkan...');
      setTimeout(() => onLoginSuccess(session), 800);
    } catch (e: any) {
      setError(e.message || 'Email atau password salah.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#0d1a36] text-white flex items-center justify-center p-4 overflow-hidden font-sans">
      {/* Visual background gradient grid */}
      <div className="absolute inset-0 z-0 bg-gradient-to-tr from-[#0d1a36] via-[#101f42] to-[#2d3f6b]" />
      <div className="absolute top-[-200px] right-[-200px] w-[500px] h-[500px] rounded-full bg-[#1e2a4a]/20 blur-[100px]" />
      <div className="absolute bottom-[-150px] left-[-150px] w-[400px] h-[400px] rounded-full bg-[#b8a898]/10 blur-[80px]" />

      <div className="relative z-10 w-full max-w-[420px] flex flex-col items-center">
        {/* Brand header */}
        <div className="flex items-center gap-3 mb-10 cursor-pointer" onClick={onBackClick}>
          <div className="w-[46px] h-[46px] rounded-full bg-white/10 border border-white/20 flex items-center justify-center font-bold text-lg text-white font-sans shadow-lg backdrop-blur-md">
            C
          </div>
          <div>
            <h2 className="font-bold text-xl tracking-wider text-white">CENNA AI</h2>
            <span className="text-[11px] text-white/40 tracking-widest uppercase">Admin Dashboard</span>
          </div>
        </div>

        {/* Card */}
        <div className="w-full bg-[#f8f5f0] text-[#111827] rounded-3xl p-8 shadow-2xl backdrop-blur-md border border-white/10">
          <h1 className="text-2xl font-serif text-[#111827] mb-2 font-bold">Selamat Datang</h1>
          <p className="text-xs text-[#1e2a4a]/60 mb-8 leading-relaxed">
            Masuk ke panel administrasi CENNA AI untuk mengelola konfigurasi AI, pengaturan suara, dan data login sistem.
          </p>

          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div id="login-error-alert" className="p-3 bg-red-400/10 border border-red-500/20 text-red-600 rounded-xl text-xs font-medium flex items-center gap-2">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div id="login-success-alert" className="p-3 bg-emerald-500/10 border border-emerald-500/25 text-[#10b981] rounded-xl text-xs font-semibold flex items-center gap-2 animate-pulse">
                <span>✓</span>
                <span>{success}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-[11px] font-bold tracking-widest text-[#1e2a4a] uppercase">
                Email Administrator
              </label>
              <input
                id="login-email-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@klinik.com"
                className="w-full px-4 py-3 bg-[#ede6d6]/60 border border-[#1e2a4a]/15 rounded-xl text-xs text-[#111827] placeholder-[#1e2a4a]/30 focus:border-[#1e2a4a] focus:bg-white outline-none transition"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-[11px] font-bold tracking-widest text-[#1e2a4a] uppercase">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password-input"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  className="w-full px-4 py-3 bg-[#ede6d6]/60 border border-[#1e2a4a]/15 rounded-xl text-xs text-[#111827] placeholder-[#1e2a4a]/30 focus:border-[#1e2a4a] focus:bg-white outline-none transition"
                />
                <button
                  id="btn-login-toggle-pwd"
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-slate-700 text-xs border-none bg-transparent cursor-pointer"
                >
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            <button
              id="btn-login-submit"
              type="submit"
              disabled={loading}
              className="w-full py-4 text-xs font-bold leading-normal text-white bg-gradient-to-r from-[#1e2a4a] to-[#2d3f6b] rounded-xl hover:shadow-lg transition cursor-pointer flex justify-center items-center gap-2"
            >
              <span>{loading ? 'Sedang Memverifikasi...' : 'Masuk ke Dashboard'}</span>
              {!loading && <span>&rarr;</span>}
            </button>
          </form>

          <div className="flex justify-between items-center my-6 text-[11px] text-[#1e2a4a]/40">
            <span className="h-[1px] flex-1 bg-[#1e2a4a]/10" />
            <span className="px-3">Atau</span>
            <span className="h-[1px] flex-1 bg-[#1e2a4a]/10" />
          </div>

          <div className="text-center">
            <button
              id="btn-login-back-landing"
              onClick={onBackClick}
              className="text-xs text-[#1e2a4a]/50 hover:text-[#1e2a4a] bg-transparent border-none cursor-pointer"
            >
              ← Kembali ke Beranda
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { PlatformSettings, NotificationSettings, BrandingSettings } from '../types';
import { addLocalLog } from '../lib/supabase';

interface SettingsProps {
  onAdminProfileUpdated: (name: string) => void;
}

export default function Settings({ onAdminProfileUpdated }: SettingsProps) {
  // 1. Platform states
  const [platformName, setPlatformName] = useState('CENNA AI');
  const [platformOrg, setPlatformOrg] = useState('Klinik Sehat Mandiri');
  const [platformEmail, setPlatformEmail] = useState('admin@cennaai.id');
  const [platformPhone, setPlatformPhone] = useState('+6221-555-8848');
  const [platformTz, setPlatformTz] = useState('Asia/Jakarta');
  const [platformAddress, setPlatformAddress] = useState('Jl. Jenderal Sudirman No. 42, Jakarta Selatan');

  // 2. Profile states
  const [adminName, setAdminName] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [adminPassConfirm, setAdminPassConfirm] = useState('');

  // 3. Notification states
  const [notifRedflag, setNotifRedflag] = useState(true);
  const [notifDaily, setNotifDaily] = useState(true);
  const [notifError, setNotifError] = useState(true);
  const [notifToken, setNotifToken] = useState(true);

  // 4. Branding states
  const [brandTagline, setBrandTagline] = useState('Ambient Clinical Intelligence');
  const [colorPrimary, setColorPrimary] = useState('#1e2a4a');
  const [colorAccent, setColorAccent] = useState('#b8a898');

  useEffect(() => {
    // Load local
    const pStored = localStorage.getItem('PLATFORM_SETTINGS');
    if (pStored) {
      try {
        const p: PlatformSettings = JSON.parse(pStored);
        setPlatformName(p.name);
        setPlatformOrg(p.org);
        setPlatformEmail(p.email);
        setPlatformPhone(p.phone);
        setPlatformTz(p.tz);
        setPlatformAddress(p.address);
      } catch (e) {}
    }

    const bStored = localStorage.getItem('BRANDING_SETTINGS');
    if (bStored) {
      try {
        const b: BrandingSettings = JSON.parse(bStored);
        setBrandTagline(b.tagline);
        setColorPrimary(b.colorPrimary);
        setColorAccent(b.colorAccent);
      } catch (e) {}
    }

    const session = sessionStorage.getItem('cenna_admin');
    if (session) {
      try {
        const s = JSON.parse(session);
        setAdminName(s.name || s.email || '');
      } catch (e) {}
    }
  }, []);

  const handleSavePlatform = () => {
    const payload: PlatformSettings = {
      name: platformName.trim(),
      org: platformOrg.trim(),
      email: platformEmail.trim(),
      phone: platformPhone.trim(),
      tz: platformTz,
      currency: 'IDR',
      address: platformAddress.trim(),
    };
    localStorage.setItem('PLATFORM_SETTINGS', JSON.stringify(payload));
    addLocalLog('success', 'SYSTEM', 'Platform profile settings saved.');
    alert('Informasi platform klinik berhasil diperbarui!');
  };

  const handleSaveProfile = () => {
    if (!adminName.trim()) {
      alert('Nama lengkap administrator wajib diisi.');
      return;
    }
    if (adminPass && adminPass !== adminPassConfirm) {
      alert('Konfirmasi sandi rahasia tidak cocok.');
      return;
    }

    const sessionRaw = sessionStorage.getItem('cenna_admin');
    if (sessionRaw) {
      try {
        const s = JSON.parse(sessionRaw);
        s.name = adminName.trim();
        sessionStorage.setItem('cenna_admin', JSON.stringify(s));
      } catch (e) {}
    }

    onAdminProfileUpdated(adminName.trim());
    addLocalLog('success', 'SYSTEM', 'Admin profile parameters modified.');
    alert('Akun profil administrator diperbarui!');
    setAdminPass('');
    setAdminPassConfirm('');
  };

  const handleSaveBranding = () => {
    const payloadHandler: BrandingSettings = {
      brand: platformName.trim(),
      tagline: brandTagline.trim(),
      colorPrimary,
      colorHex: colorPrimary,
      colorAccent,
      colorAccentHex: colorAccent,
    };
    localStorage.setItem('BRANDING_SETTINGS', JSON.stringify(payloadHandler));
    addLocalLog('success', 'SYSTEM', 'Platform customized visual variables saved.');
    alert('Aturan visual branding klinik di-lock!');
  };

  const handleClearCache = () => {
    if (confirm('Yakin ingin membersihkan seluruh data simpanan browser? Semua setting API Anda harus diketik ulang.')) {
      localStorage.clear();
      addLocalLog('critical', 'SYSTEM', 'Forced total local storage cache deletion.');
      alert('Local storage berhasil dibersihkan! Mulai ulang halaman...');
      window.location.reload();
    }
  };

  const handleResetAIConfigs = () => {
    if (confirm('Yakin ingin mereset seluruh prompt system dan parameter behavior ke default?')) {
      localStorage.removeItem('AI_BEHAVIOR');
      localStorage.removeItem('PROMPT_CORE');
      localStorage.removeItem('PROMPT_SOAP');
      localStorage.removeItem('PROMPT_REDFLAG');
      localStorage.removeItem('PROMPT_MEDICATION');
      localStorage.removeItem('REASONING_CONFIG');
      localStorage.removeItem('SOAP_CONFIG');
      addLocalLog('warning', 'SYSTEM', 'Restored default clinical prompts config.');
      alert('Aturan AI bertenaga spesialis konsultan telah dikembalikan ke bawaan pabrik.');
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Container divider 2 grid-cols layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left col: 2 blocks */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card 1: Platform info */}
          <div className="bg-white border border-[#1e2a4a]/12 rounded-3xl p-6 shadow-sm space-y-4">
            <div>
              <h3 className="font-bold text-sm text-[#1e2a4a] mb-1">Informasi Klinik & Organisasi</h3>
              <p className="text-xs text-slate-500 font-normal">Identitas fokal faskes yang tercetak di kertas rujukan.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                  Nama Platform
                </label>
                <input
                  id="settings-platform-name"
                  type="text"
                  value={platformName}
                  onChange={(e) => setPlatformName(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1e2a4a]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                  Nama Organisasi / Klinik
                </label>
                <input
                  id="settings-platform-org"
                  type="text"
                  value={platformOrg}
                  onChange={(e) => setPlatformOrg(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1e2a4a]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                  Email Kontak Utama
                </label>
                <input
                  id="settings-platform-email"
                  type="email"
                  value={platformEmail}
                  onChange={(e) => setPlatformEmail(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1e2a4a]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                  No. HP / Telepon
                </label>
                <input
                  id="settings-platform-phone"
                  type="text"
                  value={platformPhone}
                  onChange={(e) => setPlatformPhone(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1e2a4a]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                  Zona Waktu (Timezone)
                </label>
                <select
                  id="settings-platform-tz"
                  value={platformTz}
                  onChange={(e) => setPlatformTz(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none text-slate-800"
                >
                  <option value="Asia/Jakarta">WIB — Jakarta (UTC+7)</option>
                  <option value="Asia/Makassar">WITA — Makassar (UTC+8)</option>
                  <option value="Asia/Jayapura">WIT — Jayapura (UTC+9)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                Alamat Kantor Fisik Faskes
              </label>
              <textarea
                id="settings-platform-address"
                value={platformAddress}
                onChange={(e) => setPlatformAddress(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none h-16 resize-vertical"
              />
            </div>

            <div className="pt-4 border-t border-gray-100 flex justify-end">
              <button
                id="btn-save-platform"
                onClick={handleSavePlatform}
                className="px-6 py-3 bg-[#1e2a4a] hover:bg-[#2d3f6b] text-white text-xs font-bold rounded-xl border-none cursor-pointer shadow-md"
              >
                💾 Simpan Informasi Platform
              </button>
            </div>
          </div>

          {/* Card 2: Profile settings */}
          <div className="bg-white border border-[#1e2a4a]/12 rounded-3xl p-6 shadow-sm space-y-4">
            <div>
              <h3 className="font-bold text-sm text-[#1e2a4a] mb-1">Pengaturan Profil Admin</h3>
              <p className="text-xs text-slate-500 font-normal">Identitas administrator utama pengampu login sistem.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                  Nama Lengkap Admin
                </label>
                <input
                  id="settings-admin-name"
                  type="text"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1e2a4a]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                  Email Akun (Login)
                </label>
                <input
                  id="settings-admin-email"
                  type="email"
                  disabled
                  value="admin@cennaai.id"
                  className="w-full px-4 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs text-gray-500 outline-none cursor-not-allowed"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                  Password Baru (Opsional)
                </label>
                <input
                  id="settings-admin-pass"
                  type="password"
                  value={adminPass}
                  onChange={(e) => setAdminPass(e.target.value)}
                  placeholder="Isi hanya jika ingin diganti"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1e2a4a]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                  Konfirmasi Password Baru
                </label>
                <input
                  id="settings-admin-pass-confirm"
                  type="password"
                  value={adminPassConfirm}
                  onChange={(e) => setAdminPassConfirm(e.target.value)}
                  placeholder="Ulangi password baru"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1e2a4a]"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 flex justify-end">
              <button
                id="btn-save-admin-profile"
                onClick={handleSaveProfile}
                className="px-6 py-3 bg-[#1e2a4a] hover:bg-[#2d3f6b] text-white text-xs font-bold rounded-xl border-none cursor-pointer shadow-md"
              >
                💾 Simpan Akun Admin
              </button>
            </div>
          </div>
        </div>

        {/* Right col: Branding & Danger zones */}
        <div className="space-y-6">
          {/* Card 3: Brand assets */}
          <div className="bg-white border border-[#1e2a4a]/12 rounded-3xl p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-[#1e2a4a]">🎨 Branding & Visual</h3>
            <div className="space-y-2">
              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                  Tagline Klinik Platform
                </label>
                <input
                  id="settings-brand-tagline"
                  type="text"
                  value={brandTagline}
                  onChange={(e) => setBrandTagline(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1e2a4a]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                    Warna Primer
                  </label>
                  <div className="flex gap-2 items-center">
                    <input
                      id="settings-color-primary"
                      type="color"
                      value={colorPrimary}
                      onChange={(e) => setColorPrimary(e.target.value)}
                      className="w-8 h-8 rounded border-none cursor-pointer outline-none bg-transparent"
                    />
                    <span className="font-mono text-xs">{colorPrimary}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                    Warna Aksen
                  </label>
                  <div className="flex gap-2 items-center">
                    <input
                      id="settings-color-accent"
                      type="color"
                      value={colorAccent}
                      onChange={(e) => setColorAccent(e.target.value)}
                      className="w-8 h-8 rounded border-none cursor-pointer outline-none bg-transparent"
                    />
                    <span className="font-mono text-xs">{colorAccent}</span>
                  </div>
                </div>
              </div>
            </div>

            <button
              id="btn-save-branding"
              onClick={handleSaveBranding}
              className="w-full py-3 bg-[#1e2a4a] hover:bg-[#2d3f6b] text-white text-xs font-bold rounded-xl border-none cursor-pointer shadow-md"
            >
              Lock Visual Branding
            </button>
          </div>

          {/* Card 4: Danger zone alerts */}
          <div className="bg-red-400/5 border border-red-500/20 rounded-3xl p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-red-600">⚠️ Danger Zone</h3>
            <div className="space-y-2 text-xs divide-y divide-[#ef4444]/10">
              <div className="py-3 first:pt-0">
                <h4 className="font-semibold text-slate-800 text-xs mb-1">Reset AI Configuration</h4>
                <p className="text-[11px] text-slate-400 mb-2 leading-relaxed">Kembalikan semua prompts bawaan dokter spesialis awal.</p>
                <button
                  id="btn-danger-reset-ai"
                  onClick={handleResetAIConfigs}
                  className="px-3 py-1.5 border border-red-500/20 bg-white hover:bg-red-50 text-red-600 rounded-lg text-[11px] font-bold cursor-pointer"
                >
                  Reset AI Config
                </button>
              </div>

              <div className="py-3">
                <h4 className="font-semibold text-slate-800 text-xs mb-1">Hapus Data & Cache Browser</h4>
                <p className="text-[11px] text-slate-400 mb-2 leading-relaxed">Hapus local storage, daftar dokter, dan rekap obat manual di device ini.</p>
                <button
                  id="btn-danger-clear-cache"
                  onClick={handleClearCache}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg border-none text-[11px] font-bold cursor-pointer"
                >
                  Bersihkan Browser Cache
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

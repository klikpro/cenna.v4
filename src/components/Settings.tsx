/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { PlatformSettings, NotificationSettings, BrandingSettings } from '../types';
import { sbGetSetting, sbSetSetting, sbAddLog, sbSignOut, getSupabaseClient } from '../lib/supabase';

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
  const [adminEmail, setAdminEmail] = useState('');  // BUG-12 FIX: dari sesi aktual
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
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadSettings() {
      const p = await sbGetSetting<PlatformSettings>('platform');
      if (p) {
        setPlatformName(p.name);
        setPlatformOrg(p.org);
        setPlatformEmail(p.email);
        setPlatformPhone(p.phone);
        setPlatformTz(p.tz);
        setPlatformAddress(p.address);
      }
      const b = await sbGetSetting<BrandingSettings>('branding');
      if (b) {
        setBrandTagline(b.tagline);
        setColorPrimary(b.colorPrimary);
        setColorAccent(b.colorAccent);
        if (b.logoUrl) setLogoUrl(b.logoUrl);
      }
      const session = sessionStorage.getItem('cenna_admin');
      if (session) {
        try { setAdminName(JSON.parse(session).name || ''); } catch (e) {}
      }
      // BUG-12 FIX: Baca email dari Supabase session aktual, bukan hardcoded
      const client = getSupabaseClient();
      if (client) {
        const { data: { user } } = await client.auth.getUser();
        if (user?.email) setAdminEmail(user.email);
      }
    }
    loadSettings();
  }, []);

  const handleSavePlatform = async () => {
    const payload: PlatformSettings = {
      name: platformName.trim(),
      org: platformOrg.trim(),
      email: platformEmail.trim(),
      phone: platformPhone.trim(),
      tz: platformTz,
      currency: 'IDR',
      address: platformAddress.trim(),
    };
    await sbSetSetting('platform', payload);
    await sbAddLog('success', 'SYSTEM', 'Platform profile settings saved.');
    alert('Informasi platform klinik berhasil diperbarui!');
  };

  const handleSaveProfile = async () => {
    if (!adminName.trim()) {
      alert('Nama lengkap administrator wajib diisi.');
      return;
    }
    if (adminPass && adminPass !== adminPassConfirm) {
      alert('Konfirmasi sandi rahasia tidak cocok.');
      return;
    }
    if (adminPass && adminPass.length < 8) {
      alert('Password baru minimal 8 karakter.');
      return;
    }

    // BUG-04 FIX: Implementasi perubahan password via Supabase Auth API
    if (adminPass) {
      const client = getSupabaseClient();
      if (!client) {
        alert('Tidak dapat terhubung ke Supabase. Periksa konfigurasi API.');
        return;
      }
      const { error } = await client.auth.updateUser({ password: adminPass });
      if (error) {
        alert(`Gagal mengubah password: ${error.message}`);
        return;
      }
    }

    onAdminProfileUpdated(adminName.trim());
    await sbAddLog('success', 'SYSTEM', `Admin profile diperbarui${adminPass ? ' (termasuk password)' : ''}.`);
    alert(adminPass ? 'Profil dan password berhasil diperbarui!' : 'Akun profil administrator diperbarui!');
    setAdminPass('');
    setAdminPassConfirm('');
  };

  const handleSaveBranding = async () => {
    const payloadHandler: BrandingSettings = {
      brand: platformName.trim(),
      tagline: brandTagline.trim(),
      colorPrimary,
      colorHex: colorPrimary,
      colorAccent,
      colorAccentHex: colorAccent,
      logoUrl: logoUrl || undefined,
    };
    await sbSetSetting('branding', payloadHandler);
    await sbAddLog('success', 'SYSTEM', 'Platform customized visual variables saved.');
    alert('Aturan visual branding klinik di-lock!');
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 512 * 1024) {
      alert('Ukuran logo maksimal 512 KB. Kompres gambar terlebih dahulu.');
      return;
    }
    if (!file.type.startsWith('image/')) {
      alert('Hanya file gambar (PNG, JPG, SVG, WebP) yang diizinkan.');
      return;
    }
    setLogoUploading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setLogoUrl(dataUrl);
      setLogoUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = async () => {
    if (confirm('Hapus logo kustom dan kembali ke logo default CENNA?')) {
      setLogoUrl('');
    }
  };

  const handleClearCache = async () => {
    if (confirm('Yakin ingin membersihkan seluruh data simpanan browser? Semua setting API Anda harus diketik ulang.')) {
      // BUG-05 FIX: Revoke sesi Supabase di server sebelum menghapus local storage
      await sbSignOut();
      localStorage.clear();
      alert('Local storage berhasil dibersihkan! Mulai ulang halaman...');
      window.location.reload();
    }
  };

  const handleResetAIConfigs = async () => {
    if (confirm('Yakin ingin mereset seluruh prompt system dan parameter behavior ke default?')) {
      await sbSetSetting('ai_behavior', null);
      await sbSetSetting('prompt_core', null);
      await sbSetSetting('prompt_soap', null);
      await sbSetSetting('prompt_redflag', null);
      await sbSetSetting('prompt_medication', null);
      await sbAddLog('warning', 'SYSTEM', 'Restored default clinical prompts config.');
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
                  value={adminEmail || '(Memuat...)'}
                  title="Email tidak dapat diubah dari sini — gunakan panel Supabase Auth"
                  className="w-full px-4 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs text-gray-500 outline-none cursor-not-allowed"
                />
                <p className="text-[9px] text-slate-400">Email hanya dapat diubah melalui panel Supabase Authentication.</p>
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

              {/* Logo Upload */}
              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">Logo Klinik</label>
                <div className="border-2 border-dashed border-[#1e2a4a]/20 rounded-xl p-3 flex flex-col items-center gap-2 bg-slate-50/50">
                  {logoUrl ? (
                    <div className="flex flex-col items-center gap-2 w-full">
                      <img src={logoUrl} alt="Logo preview" className="h-12 w-auto object-contain max-w-[160px]" />
                      <div className="flex gap-2 w-full">
                        <button
                          onClick={() => logoInputRef.current?.click()}
                          className="flex-1 py-1.5 text-[10px] font-bold text-[#1e2a4a] border border-[#1e2a4a]/20 rounded-lg bg-white hover:bg-slate-50 cursor-pointer"
                        >
                          Ganti Logo
                        </button>
                        <button
                          onClick={handleRemoveLogo}
                          className="py-1.5 px-3 text-[10px] font-bold text-red-500 border border-red-200 rounded-lg bg-white hover:bg-red-50 cursor-pointer"
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => logoInputRef.current?.click()}
                      disabled={logoUploading}
                      className="flex flex-col items-center gap-1.5 py-2 cursor-pointer disabled:opacity-50"
                    >
                      <span className="text-2xl">🖼️</span>
                      <span className="text-[10px] text-[#1e2a4a]/50 font-medium">
                        {logoUploading ? 'Memproses…' : 'Klik untuk upload logo'}
                      </span>
                      <span className="text-[9px] text-[#1e2a4a]/30">PNG, JPG, SVG, WebP · maks 512 KB</span>
                    </button>
                  )}
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                </div>
                {logoUrl && (
                  <p className="text-[9px] text-emerald-600 font-semibold">✓ Logo akan tampil di halaman depan. Klik "Lock Visual Branding" untuk menyimpan.</p>
                )}
              </div>
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

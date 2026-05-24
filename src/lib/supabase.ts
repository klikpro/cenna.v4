/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Doctor, Drug, IcdCode, AuditLogEntry } from '../types';

// ── Env-var based config (Vite exposes VITE_* at build time) ──────────────────
const ENV_URL  = import.meta.env.VITE_SUPABASE_URL  as string | undefined;
const ENV_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
// Service-role key lives ONLY in env vars — never hardcoded, never in localStorage
export const ENV_SERVICE_ROLE = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY as string | undefined;

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (_client) return _client;

  // Prefer env vars; fall back to hardcoded default (credentials no longer stored in localStorage)
  const url  = ENV_URL  || 'https://vtwdgdbxgdmrravpdeix.supabase.co';
  const anon = ENV_ANON || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0d2RnZGJ4Z2RtcnJhdnBkZWl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1MzQ1NjYsImV4cCI6MjA5NTExMDU2Nn0._nJBT6q1wCkvjcYjsRYN8bKDMeeqOfV1WlQxQYT0DJk';

  if (!url || !anon) return null;
  try {
    _client = createClient(url, anon);
    return _client;
  } catch (e) {
    console.error('Supabase initialization failed:', e);
    return null;
  }
}

/** Admin client using service-role key — only available when env var is set */
export function getAdminClient(): SupabaseClient | null {
  const url = ENV_URL || 'https://vtwdgdbxgdmrravpdeix.supabase.co';
  if (!url || !ENV_SERVICE_ROLE) return null;
  try {
    return createClient(url, ENV_SERVICE_ROLE);
  } catch (e) {
    console.error('Supabase admin client failed:', e);
    return null;
  }
}

// ── INITIAL DEMO DATA ─────────────────────────────────────────

export const DEMO_DOCTORS: Doctor[] = [
  { id: '1', name: 'dr. Ahmad Fauzi', email: 'ahmad.fauzi@klinikusehat.id', phone: '081234567890', str: '1234-5678-9012-3456', specialization: 'Umum', clinic: 'Klinik Sehat Mandiri', status: 'active', ai_profile: 'gp', soap_month: 42, notes: 'Dokter utama klinik yang sangat ramah.', created_at: '2025-01-15T08:00:00Z' },
  { id: '2', name: 'dr. Budi Santoso', email: 'budi.santoso@rsharapan.id', phone: '082345678901', str: '2345-6789-0123-4567', specialization: 'Umum', clinic: 'RS Harapan Sehat', status: 'active', ai_profile: 'gp', soap_month: 38, notes: 'Dokter jaga malam.', created_at: '2025-02-01T09:30:00Z' },
  { id: '3', name: 'dr. Sari Indrawati, SpPD', email: 'sari.indrawati@rsbunda.id', phone: '083456789012', str: '3456-7890-1234-5678', specialization: 'Penyakit Dalam', clinic: 'RS Bunda Jakarta', status: 'trial', ai_profile: 'specialist', soap_month: 24, notes: 'Trial 14 hari, fokus spesialisasi penyakit dalam.', created_at: '2025-03-10T10:15:00Z' },
  { id: '4', name: 'dr. Dewi Rahayu', email: 'dewi.rahayu@klinikpagi.id', phone: '084567890123', str: '4567-8901-2345-6789', specialization: 'Umum', clinic: 'Klinik Pagi Cerah', status: 'inactive', ai_profile: 'gp', soap_month: 0, notes: 'Sedang cuti panjang untuk studi lanjut.', created_at: '2025-01-20T11:00:00Z' },
  { id: '5', name: 'dr. Rizki Pratama, SpA', email: 'rizki.pratama@rsanak.id', phone: '085678901234', str: '5678-9012-3456-7890', specialization: 'Anak', clinic: 'RS Anak Sehat', status: 'active', ai_profile: 'pediatric', soap_month: 55, notes: 'Pediatri andalan anak-anak.', created_at: '2025-02-15T14:20:00Z' },
  { id: '6', name: 'dr. Nining Kurniasih, SpOG', email: 'nining.k@rsibu.id', phone: '086789012345', str: '6789-0123-4567-8901', specialization: 'Kandungan', clinic: 'RS Ibu & Anak', status: 'active', ai_profile: 'specialist', soap_month: 31, notes: 'Menangani konsultasi kehamilan reguler.', created_at: '2025-03-01T15:00:00Z' },
];

export const DEMO_DRUGS: Drug[] = [
  { id: '1', generic: 'Amoxicillin', brand: 'Amoxil, Kalmoxillin', drug_class: 'Antibiotik', form: 'Kapsul 500mg, Sirup 125mg/5ml', dose_adult: '500mg 3x/hari 5-7 hari', dose_child: '25-50 mg/kgBB/hari dibagi 3 dosis', indication: 'Infeksi bakteri saluran napas, kemih, kulit', contra: 'Alergi penisilin', preg: 'B', risk: 'low', is_generic: true, interactions: 'Methotrexate, Warfarin', notes: 'Antibiotik lini pertama untuk ISPA dan ISK ringan.' },
  { id: '2', generic: 'Paracetamol', brand: 'Panadol, Sanmol, Tempra', drug_class: 'Analgetik', form: 'Tablet 500mg, Sirup 120mg/5ml, Suppositoria', dose_adult: '500-1000mg setiap 4-6 jam, max 4g/hari', dose_child: '10-15 mg/kgBB/dosis setiap 4-6 jam', indication: 'Demam, nyeri ringan-sedang', contra: 'Gangguan hati berat', preg: 'B', risk: 'low', is_generic: true, interactions: 'Warfarin, Alkohol', notes: 'Obat penurun demam paling aman namun hepatotoksik jika overdosis.' },
  { id: '3', generic: 'Amlodipin', brand: 'Norvasc, Tensivask', drug_class: 'Antihipertensi', form: 'Tablet 5mg, 10mg', dose_adult: '5-10mg 1x/hari', dose_child: '2.5-5mg 1x/hari (>6 tahun)', indication: 'Hipertensi, angina stabil', contra: 'Syok kardiogenik, hipotensi sirkulasi', preg: 'C', risk: 'moderate', is_generic: true, interactions: 'Simvastatin, Ketokonazol', notes: 'Monitor edema perifer atau bengkak pergelangan kaki.' },
  { id: '4', generic: 'Metformin', brand: 'Glucophage, Diabex', drug_class: 'Antidiabetik', form: 'Tablet 500mg, 850mg', dose_adult: '500-2000mg/hari bersama makan', dose_child: '500-2000mg/hari (>10 tahun)', indication: 'Diabetes Melitus Tipe 2, PCOS', contra: 'GFR <30, asidosis laktak', preg: 'B', risk: 'low', is_generic: true, interactions: 'Alkohol, Kontras Iodinasi', notes: 'Diminum bersama makanan untuk meminimalkan efek samping saluran cerna.' },
  { id: '5', generic: 'Warfarin', brand: 'Coumadin', drug_class: 'Antikoagulan', form: 'Tablet 2mg, 5mg', dose_adult: 'Individual berdasarkan target INR (2-3)', dose_child: 'Perlu monitoring ketat', indication: 'AF, DVT, Emboli Paru', contra: 'Perdarahan aktif, kehamilan trimester 1 & 3', preg: 'X', risk: 'high', is_generic: false, interactions: 'Aspirin, Amoxicillin, Kontrasepsi Oral', notes: 'MEMILIKI RISIKO TINGGI (HIGH RISK). Monitor INR ketat.' },
  { id: '6', generic: 'Insulin Reguler', brand: 'Actrapid, Humulin R', drug_class: 'Antidiabetik', form: 'Injeksi 100 IU/ml', dose_adult: 'Individual berdasarkan GDS', dose_child: '0.5-1 IU/kgBB/hari', indication: 'DM Tipe 1, Ketoasidosis', contra: 'Hipoglikemia', preg: 'B', risk: 'high', is_generic: true, interactions: 'Beta-blocker, Alkohol', notes: 'HIGH ALERT. Risiko hipoglikemia berat jika salah hitung dosis.' },
  { id: '7', generic: 'Omeprazole', brand: 'Losec, Prilos', drug_class: 'Gastrointestinal', form: 'Kapsul 20mg, 40mg', dose_adult: '20-40mg 1x/hari sebelum makan pagi', dose_child: '0.7-3.5 mg/kgBB/hari', indication: 'GERD, gastritis, peptic ulcer', contra: 'Hipersensitivitas', preg: 'C', risk: 'low', is_generic: true, interactions: 'Clopidogrel, Ketokonazol', notes: 'Diminum 30-60 menit sebelum makan pagi.' },
  { id: '8', generic: 'Salbutamol', brand: 'Ventolin, Combivent', drug_class: 'Pernapasan', form: 'Inhaler MDI 100mcg, Nebulizer', dose_adult: '1-2 hirup (100-200mcg) jika sesak', dose_child: '0.15 mg/kgBB nebulisasi', indication: 'Asma, bronkospasme akut', contra: 'Aritmia berat', preg: 'C', risk: 'low', is_generic: true, interactions: 'Beta-blocker, Teofilin', notes: 'Bronkodilator cepat untuk serangan sesak napas akut.' },
];

export const DEMO_ICD: IcdCode[] = [
  { id: '1', code: 'J06.9', name_id: 'Infeksi Saluran Pernapasan Atas Akut', name_lat: 'Acute Upper Respiratory Infection', chapter: 'X', freq: 284, notes: 'Keluhan utama batuk, pilek, demam, pegal umum.' },
  { id: '2', code: 'K35', name_id: 'Appendisitis Akut', name_lat: 'Acute Appendicitis', chapter: 'XI', freq: 47, notes: 'Nyeri perut kanan bawah membakat, tanda perut positif.' },
  { id: '3', code: 'I21', name_id: 'Infark Miokard Akut', name_lat: 'Acute Myocardial Infarction', chapter: 'IX', freq: 31, notes: 'Nyeri dada kiri tertekan atau tertindih menjalar ke lengan.' },
  { id: '4', code: 'E11', name_id: 'Diabetes Melitus Tipe 2', name_lat: 'Type 2 Diabetes Mellitus', chapter: 'IV', freq: 198, notes: 'Evaluasi kepatuhan terapi oral, HbA1c berjangka.' },
  { id: '5', code: 'I10', name_id: 'Hipertensi Esensial', name_lat: 'Essential Hypertension', chapter: 'IX', freq: 312, notes: 'Tekan darah tinggi esensial tanpa penyakit ginjal.' },
  { id: '6', code: 'J18.9', name_id: 'Pneumonia yang Tidak Spesifik', name_lat: 'Pneumonia, Unspecified', chapter: 'X', freq: 89, notes: 'Bunyi paru ronki basah halus sedang.' },
  { id: '7', code: 'N39.0', name_id: 'Infeksi Saluran Kemih', name_lat: 'Urinary Tract Infection', chapter: 'XIV', freq: 143, notes: 'Keluhan anyang-anyangan, disuria, nyeri suprapubik.' },
  { id: '8', code: 'A09', name_id: 'Diare dan Gastroenteritis', name_lat: 'Diarrhoea and Gastroenteritis', chapter: 'I', freq: 176, notes: 'Analisis rehidrasi oralit dan loperamide jika perlu.' },
];

export const INTERACTIONS_DATA = [
  { a: 'Warfarin', b: 'Aspirin', level: 'major', mechanism: 'Meningkatkan risiko perdarahan serius karena sinergi antikoagulan & antiplatelet.', action: 'Hindari kombinasi; jika terpaksa, monitor ketat hematologi & perdarahan.' },
  { a: 'Warfarin', b: 'Amoxicillin', level: 'moderate', mechanism: 'Antibiotik mengganggu bakteri usus penghasil vitamin K, memperkuat efek warfarin.', action: 'Monitor target INR lebih sering selama mengonsumsi amoxicillin.' },
  { a: 'Furosemide', b: 'Digoxin', level: 'moderate', mechanism: 'Loop diuretik memicu hipokalemia, meningkatkan risiko toksisitas digoxin.', action: 'Selalu periksa kadar kalium serum secara berkala dan berikan suplemen K jika rendah.' },
  { a: 'Metformin', b: 'Alkohol', level: 'major', mechanism: 'Alkohol meningkatkan risiko asidosis laktat berbahaya akibat inhibisi laktat hati.', action: 'Edukasi pasien untuk tidak minum alkohol selama mengonsumsi metformin.' },
  { a: 'Amlodipin', b: 'Simvastatin', level: 'moderate', mechanism: 'Amlodipin menghambat metabolisme simvastatin, meningkatkan rhabdomiolisis.', action: 'Jangan melebihi dosis simvastatin 20mg harian jika dikombinasikan dengan amlodipin.' },
  { a: 'Morfin', b: 'Benzodiazepin', level: 'major', mechanism: 'Efek penekanan sistem saraf pusat aditif, memicu depresi pernapasan serius.', action: 'Kombinasi hanya diperkenankan pada kondisi ICU terpantau ketat.' },
];

export const HIGHRISK_DATA = [
  { drug: 'Warfarin / Antikoagulan', drug_class: 'Antikoagulan', risk: 'Perdarahan spontan mayor, stroke hemoragik', protocol: 'Verifikasi target INR; alert interaksi otomatis; konfirmasi tertulis.' },
  { drug: 'Insulin (Semua Jenis)', drug_class: 'Antidiabetik', risk: 'Hipoglikemia berat, penurunan kesadaran/koma', protocol: 'Instruksikan cek gula darah berkala; resepkan dosis berbasis unit presisi.' },
  { drug: 'Morfin & Opioid', drug_class: 'Opiat', risk: 'Henti napas mendadak, ketergantungan fisik berat', protocol: 'Pantau saturasi oksigen (SpO2); selalu siapkan nalokson sebagai antidot.' },
  { drug: 'Digoxin', drug_class: 'Kardiovaskular', risk: 'Aritmia ventrikel mematikan, intoksikasi glikosida', protocol: 'Monitor denyut jantung basal (Apical Pulse) dan kadar elektrolit serum.' },
];

export const DEMO_AUDIT_LOGS: AuditLogEntry[] = [
  { id: 'log_a', ts: '2026-05-23 14:12:00', level: 'warning', category: 'DRUG', message: 'Interaksi obat mayor terdeteksi: Warfarin + Aspirin pada resep.', user: 'dr. Ahmad Fauzi', ip: '192.168.1.10', detail: JSON.stringify({ drugs: ['warfarin', 'aspirin'], patient_id: 'p102' }) },
  { id: 'log_b', ts: '2026-05-23 14:10:15', level: 'success', category: 'SOAP', message: 'SOAP generated untuk pasien Dewi Sartika (ISPA, J06.9)', user: 'dr. Ahmad Fauzi', ip: '192.168.1.10', detail: JSON.stringify({ patient: 'Dewi Sartika', code: 'J06.9', duration: '45s' }) },
  { id: 'log_c', ts: '2026-05-23 13:45:00', level: 'info', category: 'AI', message: 'Differential diagnosis terstruktur berhasil dibuat (3 DDx)', user: 'dr. Budi Santoso', ip: '192.168.1.11', detail: JSON.stringify({ original_symptom: 'Nyeri perut kanan bawah', hypothesis: ['K35', 'N39.0', 'D64'] }) },
  { id: 'log_d', ts: '2026-05-23 13:43:10', level: 'critical', category: 'AI', message: 'RED FLAG: Akut peritonitis / Kemungkinan Appendisitis dianalisis.', user: 'dr. Budi Santoso', ip: '192.168.1.11', detail: JSON.stringify({ patient_age: 28, urgency: 'critical' }) },
  { id: 'log_e', ts: '2026-05-23 12:00:15', level: 'info', category: 'AUTH', message: 'Login administrator berhasil.', user: 'admin@cennaai.id', ip: '203.0.113.45', detail: JSON.stringify({ device: 'Chrome on macOS' }) },
  { id: 'log_f', ts: '2026-05-23 11:30:20', level: 'info', category: 'INTEGRATION', message: 'Sync sukses dengan rekam medis Medifirst (847 rekam medis)', user: 'SYSTEM', ip: '127.0.0.1', detail: JSON.stringify({ synced: 847, status: 'complete' }) },
];


// LOCAL STORAGE HELPERS WITH INITIAL SEEDING

export function getLocalDoctors(): Doctor[] {
  const stored = localStorage.getItem('CENNA_DOCTORS');
  if (!stored) {
    localStorage.setItem('CENNA_DOCTORS', JSON.stringify(DEMO_DOCTORS));
    return DEMO_DOCTORS;
  }
  return JSON.parse(stored);
}

export function saveLocalDoctors(docs: Doctor[]) {
  localStorage.setItem('CENNA_DOCTORS', JSON.stringify(docs));
}

export function getLocalDrugs(): Drug[] {
  const stored = localStorage.getItem('CENNA_DRUGS');
  if (!stored) {
    localStorage.setItem('CENNA_DRUGS', JSON.stringify(DEMO_DRUGS));
    return DEMO_DRUGS;
  }
  return JSON.parse(stored);
}

export function saveLocalDrugs(drugs: Drug[]) {
  localStorage.setItem('CENNA_DRUGS', JSON.stringify(drugs));
}

export function getLocalIcd(): IcdCode[] {
  const stored = localStorage.getItem('CENNA_ICD');
  if (!stored) {
    localStorage.setItem('CENNA_ICD', JSON.stringify(DEMO_ICD));
    return DEMO_ICD;
  }
  return JSON.parse(stored);
}

export function saveLocalIcd(codes: IcdCode[]) {
  localStorage.setItem('CENNA_ICD', JSON.stringify(codes));
}

export function getLocalLogs(): AuditLogEntry[] {
  const stored = localStorage.getItem('CENNA_LOGS');
  if (!stored) {
    localStorage.setItem('CENNA_LOGS', JSON.stringify(DEMO_AUDIT_LOGS));
    return DEMO_AUDIT_LOGS;
  }
  return JSON.parse(stored);
}

export function saveLocalLogs(logs: AuditLogEntry[]) {
  localStorage.setItem('CENNA_LOGS', JSON.stringify(logs));
}

export function addLocalLog(level: AuditLogEntry['level'], category: AuditLogEntry['category'], message: string, detailObj?: object) {
  const logs = getLocalLogs();
  const newLog: AuditLogEntry = {
    id: 'log_' + Date.now() + Math.random().toString(36).substring(2, 6),
    ts: new Date().toISOString().replace('T', ' ').substring(0, 19),
    level,
    category,
    message,
    user: sessionStorage.getItem('cenna_admin') ? JSON.parse(sessionStorage.getItem('cenna_admin')!).name || 'Admin' : 'SYSTEM',
    ip: '192.168.1.1' + Math.floor(Math.random() * 9),
    detail: detailObj ? JSON.stringify(detailObj) : undefined
  };
  logs.unshift(newLog);
  if (logs.length > 300) logs.pop();
  saveLocalLogs(logs);
}

// ── DATABASE LAYER (Supabase) ───────────────────────────────────────────────
// All functions below read/write from Supabase. They are used by App.tsx
// when a Supabase client is available, replacing the localStorage helpers above.

// —— SESSION ————————————————————————————————————————————————————————————————————————

/** Sign in via Supabase Auth; returns a normalized session object or throws. */
export async function sbSignIn(email: string, password: string) {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase tidak terkonfigurasi.');
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  if (!data.session) throw new Error('Login gagal: sesi tidak diterima.');
  return {
    email: data.user.email ?? email,
    role: (data.user.user_metadata?.role as string) || 'admin',
    name: (data.user.user_metadata?.name as string) || email.split('@')[0],
    token: data.session.access_token,
    userId: data.user.id,
    demo: false,
  };
}

/** Sign out the current Supabase Auth session. */
export async function sbSignOut() {
  const client = getSupabaseClient();
  if (client) await client.auth.signOut();
}

/** Restore an active Supabase session from the persisted token (auto-refresh). */
export async function sbGetSession() {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  if (!data.session) return null;
  const user = data.session.user;
  return {
    email: user.email ?? '',
    role: (user.user_metadata?.role as string) || 'admin',
    name: (user.user_metadata?.name as string) || (user.email?.split('@')[0] ?? 'Admin'),
    token: data.session.access_token,
    userId: user.id,
    demo: false,
  };
}

// —— SETTINGS (platform / branding / AI / STT stored in `app_settings` table) —
// Schema: app_settings (key TEXT PRIMARY KEY, value JSONB, updated_at TIMESTAMPTZ)

export async function sbGetSetting<T>(key: string): Promise<T | null> {
  const client = getSupabaseClient();
  if (!client) {
    console.warn(`[sbGetSetting] No Supabase client — key: ${key}`);
    return null;
  }

  // Coba exact key dulu, lalu fallback ke lowercase (data lama mungkin disimpan lowercase)
  const keysToTry = Array.from(new Set([key, key.toLowerCase(), key.toUpperCase()]));

  for (const k of keysToTry) {
    const { data, error } = await client
      .from('app_settings')
      .select('value')
      .eq('key', k)
      .maybeSingle();
    if (error) {
      console.error(`[sbGetSetting] Error reading key "${k}":`, error.message, error.code);
      continue;
    }
    if (data) {
      if (k !== key) console.info(`[sbGetSetting] Found "${key}" via fallback key "${k}"`);
      else console.debug(`[sbGetSetting] OK key "${k}":`, typeof data.value, String(data.value).slice(0, 30));
      return data.value as T;
    }
  }

  console.info(`[sbGetSetting] Key not found: "${key}" (tried: ${keysToTry.join(', ')})`);
  return null;
}

export async function sbSetSetting(key: string, value: unknown): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  await client
    .from('app_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
}

/** Debug helper: dump semua key di app_settings ke console. Panggil sekali dari DevTools. */
export async function sbDumpAllSettingKeys(): Promise<void> {
  const client = getSupabaseClient();
  if (!client) { console.warn('[sbDump] No client'); return; }
  const { data, error } = await client
    .from('app_settings')
    .select('key, updated_at')
    .order('key');
  if (error) { console.error('[sbDump] Error:', error.message); return; }
  console.group('[sbDump] All keys in app_settings (' + (data?.length ?? 0) + ' rows)');
  (data ?? []).forEach(row => console.log(' •', JSON.stringify(row.key), '—', row.updated_at));
  console.groupEnd();
}

// —— DOCTORS ————————————————————————————————————————————————————————————————————————

export async function sbGetDoctors(): Promise<Doctor[]> {
  const client = getSupabaseClient();
  if (!client) return getLocalDoctors();
  const { data, error } = await client.from('doctors').select('*').order('created_at', { ascending: false });
  if (error) { console.error(error); return getLocalDoctors(); }
  return (data ?? []) as Doctor[];
}

export async function sbUpsertDoctor(doc: Doctor): Promise<void> {
  const client = getSupabaseClient();
  if (!client) { saveLocalDoctors([doc, ...getLocalDoctors().filter(d => d.id !== doc.id)]); return; }
  const { error } = await client.from('doctors').upsert(doc, { onConflict: 'id' });
  if (error) throw new Error(error.message);
}

export async function sbDeleteDoctor(id: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) { saveLocalDoctors(getLocalDoctors().filter(d => d.id !== id)); return; }
  const { error } = await client.from('doctors').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// —— DRUGS —————————————————————————————————————————————————————————————————————————

export async function sbGetDrugs(): Promise<Drug[]> {
  const client = getSupabaseClient();
  if (!client) return getLocalDrugs();
  const { data, error } = await client.from('drugs').select('*').order('generic');
  if (error) { console.error(error); return getLocalDrugs(); }
  return (data ?? []) as Drug[];
}

export async function sbUpsertDrug(drug: Drug): Promise<void> {
  const client = getSupabaseClient();
  if (!client) { saveLocalDrugs([drug, ...getLocalDrugs().filter(d => d.id !== drug.id)]); return; }
  const { error } = await client.from('drugs').upsert(drug, { onConflict: 'id' });
  if (error) throw new Error(error.message);
}

export async function sbDeleteDrug(id: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) { saveLocalDrugs(getLocalDrugs().filter(d => d.id !== id)); return; }
  const { error } = await client.from('drugs').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// —— ICD-10 CODES ———————————————————————————————————————————————————————————————————

export async function sbGetIcd(): Promise<IcdCode[]> {
  const client = getSupabaseClient();
  if (!client) return getLocalIcd();
  const { data, error } = await client.from('icd_codes').select('*').order('code');
  if (error) { console.error(error); return getLocalIcd(); }
  return (data ?? []) as IcdCode[];
}

export async function sbUpsertIcd(code: IcdCode): Promise<void> {
  const client = getSupabaseClient();
  if (!client) { saveLocalIcd([code, ...getLocalIcd().filter(c => c.id !== code.id)]); return; }
  const { error } = await client.from('icd_codes').upsert(code, { onConflict: 'id' });
  if (error) throw new Error(error.message);
}

export async function sbDeleteIcd(id: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) { saveLocalIcd(getLocalIcd().filter(c => c.id !== id)); return; }
  const { error } = await client.from('icd_codes').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function sbImportIcd(codes: IcdCode[]): Promise<void> {
  const client = getSupabaseClient();
  if (!client) { saveLocalIcd([...codes, ...getLocalIcd()]); return; }
  const { error } = await client.from('icd_codes').upsert(codes, { onConflict: 'id' });
  if (error) throw new Error(error.message);
}

// —— AUDIT LOGS ————————————————————————————————————————————————————————————————————

export async function sbGetLogs(): Promise<AuditLogEntry[]> {
  const client = getSupabaseClient();
  if (!client) return getLocalLogs();
  const { data, error } = await client
    .from('audit_logs')
    .select('*')
    .order('ts', { ascending: false })
    .limit(300);
  if (error) { console.error(error); return getLocalLogs(); }
  return (data ?? []) as AuditLogEntry[];
}

export async function sbAddLog(
  level: AuditLogEntry['level'],
  category: AuditLogEntry['category'],
  message: string,
  userName = 'SYSTEM',
  detailObj?: object
): Promise<void> {
  const entry: AuditLogEntry = {
    id: 'log_' + Date.now() + Math.random().toString(36).substring(2, 6),
    ts: new Date().toISOString().replace('T', ' ').substring(0, 19),
    level,
    category,
    message,
    user: userName,
    ip: '0.0.0.0',
    detail: detailObj ? JSON.stringify(detailObj) : undefined,
  };

  const client = getSupabaseClient();
  if (!client) {
    addLocalLog(level, category, message, detailObj);
    return;
  }
  const { error } = await client.from('audit_logs').insert(entry);
  if (error) console.error('Log insert error:', error);
}

export async function sbClearLogs(adminName: string): Promise<void> {
  const client = getSupabaseClient();
  const sentinel: AuditLogEntry = {
    id: 'sys_init_' + Date.now(),
    ts: new Date().toISOString().replace('T', ' ').substring(0, 19),
    level: 'info',
    category: 'SYSTEM',
    message: 'Log audit dipaksa bersih secara manual.',
    user: adminName,
    ip: '0.0.0.0',
  };
  if (!client) {
    saveLocalLogs([sentinel]);
    return;
  }
  await client.from('audit_logs').delete().neq('id', 'none'); // delete all
  await client.from('audit_logs').insert(sentinel);
}

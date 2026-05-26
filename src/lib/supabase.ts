/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AuditLogEntry, CennaSession } from '../types';

// ── Env-var based config (Vite exposes VITE_* at build time) ──────────────────
const _env = (import.meta as unknown as { env: Record<string, string> }).env;
const ENV_URL  = _env.VITE_SUPABASE_URL  as string | undefined;
const ENV_ANON = _env.VITE_SUPABASE_ANON_KEY as string | undefined;
// Service-role key lives ONLY in env vars — never hardcoded, never in localStorage
export const ENV_SERVICE_ROLE = _env.VITE_SUPABASE_SERVICE_ROLE_KEY as string | undefined;

let _client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (_client) return _client;

  const url  = ENV_URL;
  const anon = ENV_ANON;

  // BUG-01 FIX: Tidak boleh ada credentials hardcoded di source code.
  // Tampilkan warning yang jelas jika ENV vars tidak ditemukan.
  if (!url || !anon) {
    console.warn(
      '[CENNA] ⚠️  VITE_SUPABASE_URL atau VITE_SUPABASE_ANON_KEY tidak ditemukan.\n' +
      'Pastikan file .env sudah dikonfigurasi dengan benar.\n' +
      'Contoh isi .env:\n' +
      '  VITE_SUPABASE_URL=https://xxxx.supabase.co\n' +
      '  VITE_SUPABASE_ANON_KEY=eyJhbGci...'
    );
    return null;
  }

  try {
    _client = createClient(url, anon, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    return _client;
  } catch (e) {
    console.error('Supabase initialization failed:', e);
    return null;
  }
}

/** Admin client using service-role key — only available when env var is set */
export function getAdminClient(): SupabaseClient | null {
  const url = ENV_URL;
  if (!url || !ENV_SERVICE_ROLE) return null;
  try {
    return createClient(url, ENV_SERVICE_ROLE);
  } catch (e) {
    console.error('Supabase admin client failed:', e);
    return null;
  }
}

// \u2500\u2500 DEMO AUDIT LOGS (dipakai getLocalLogs sebagai seed saat DB tidak tersedia) \u2500\u2500\u2500\u2500\u2500\u2500

export const DEMO_AUDIT_LOGS: AuditLogEntry[] = [
  { id: 'log_a', ts: '2026-05-24 09:00:00', level: 'success', category: 'AI', message: 'Sesi anamnesis CENNA berhasil diselesaikan.', user: 'SYSTEM', ip: 'unknown', detail: undefined },
  { id: 'log_b', ts: '2026-05-24 08:55:00', level: 'info', category: 'AUTH', message: 'Login administrator berhasil.', user: 'admin', ip: 'unknown', detail: undefined },
];

// \u2500\u2500 LOCAL FALLBACK HELPERS (hanya untuk sbAddLog saat Supabase tidak tersedia) \u2500\u2500\u2500\u2500\u2500\u2500

function getLocalLogs(): AuditLogEntry[] {
  try { return JSON.parse(localStorage.getItem('CENNA_LOGS') || '[]'); } catch { return []; }
}

function saveLocalLogs(logs: AuditLogEntry[]) {
  try { localStorage.setItem('CENNA_LOGS', JSON.stringify(logs.slice(0, 100))); } catch { /* ignore quota */ }
}

/** Fallback logger saat Supabase tidak tersedia — IP selalu 'unknown' karena tidak bisa diambil dari browser */
export function addLocalLog(level: AuditLogEntry['level'], category: AuditLogEntry['category'], message: string, detailObj?: object) {
  const logs = getLocalLogs();
  logs.unshift({
    id: 'log_' + Date.now() + Math.random().toString(36).substring(2, 6),
    ts: new Date().toISOString().replace('T', ' ').substring(0, 19),
    level, category, message,
    user: 'SYSTEM',
    ip: 'unknown',
    detail: detailObj ? JSON.stringify(detailObj) : undefined,
  });
  saveLocalLogs(logs); // BUG-H4 FIX: persist ke localStorage
}

// ── DEFAULT PROMPT CONSTANTS ────────────────────────────────────────────────
// Sumber kebenaran tunggal. Diimport oleh LandingPage.tsx dan AiConfig.tsx.

export const DEFAULT_PROMPT_ANAMNESIS = `Kamu adalah CENNA — asisten klinis suara berbahasa Indonesia dengan pola pikir DOKTER SPESIALIS KONSULTAN.

Tugasmu adalah menggali anamnesis secara sistematis mengikuti kerangka PQRST, RPD, RPK, RPS, dan Pemeriksaan Fisik.

== PRINSIP UTAMA ==
- JANGAN memperkenalkan diri — langsung masuk ke penggalian anamnesis
- Ajukan 1-2 pertanyaan spesifik per giliran, prioritaskan yang paling relevan secara klinis
- Jika jawaban pasien sudah menjawab beberapa field sekaligus, tandai semua field tersebut
- Berikan kesimpulan klinis SEGERA setelah data cukup untuk membedakan diagnosa
- Jika ada RED FLAG, langsung tandai dan prioritaskan tatalaksana emergensi
- Gunakan bahasa Indonesia yang hangat dan profesional

== KERANGKA PQRST ==
- P (Provokasi/Paliatif): Apa yang memperberat atau meringankan keluhan?
- Q (Kualitas): Bagaimana sifat/karakter keluhannya? (nyeri tumpul, tajam, terbakar, dll)
- R (Radiasi/Regio): Di mana lokasi keluhannya? Apakah menjalar ke tempat lain?
- S (Skala/Severitas): Berapa skala keluhannya dari 0-10?
- T (Time/Waktu): Kapan mulai? Sudah berapa lama? Terus-menerus atau hilang-timbul?

== RIWAYAT ==
- RPD: Pernah sakit serupa sebelumnya? Penyakit kronis? Operasi? Rawat inap?
- RPK: Ada anggota keluarga dengan penyakit serupa atau penyakit herediter?
- RPS: Merokok? Alkohol? Pekerjaan? Aktivitas fisik? Alergi obat?

== FORMAT OUTPUT WAJIB JSON ==
{"voice_response":"<1-3 kalimat TTS>","anamnesis":{"provokasi":"","kualitas":"","radiasi":"","skala":"","waktu":"","rpd":"","rpk":"","rps":"","pemfis":""},"missing_fields":["field yg belum tergali"],"phase":"gathering","keluhan":[],"red_flags":[],"conclusion":null,"session_end":false}

Saat phase "complete":
{"diagnosis_utama":"","diagnosis_banding":[{"diagnosis":"","probabilitas":"","alasan":""}],"tatalaksana":[{"kategori":"farmakologi","detail":""},{"kategori":"non-farmakologi","detail":""}],"edukasi":[],"red_flags":[],"prognosis":""}`;

export const DEFAULT_PROMPT_CORE = `Kamu adalah CENNA AI, asisten klinis medis berbasis AI untuk membantu dokter di klinik.

Cara berpikirmu:
1. Analisis seperti KONSULTAN SPESIALIS — sistematis, komprehensif, evidence-based
2. Selalu pertimbangkan differential diagnosis secara terstruktur
3. Identifikasi RED FLAG secara proaktif — keselamatan pasien adalah prioritas utama
4. Gunakan terminologi medis Indonesia yang baku, sesuai standar IDI/PAPDI
5. Sertakan probabilitas klinis dalam setiap diagnosis banding
6. Berikan rekomendasi berdasarkan guidelines terkini (PAPDI, Kemenkes, WHO)`;

export const DEFAULT_PROMPT_SOAP = `Analisis transcript percakapan berikut dan generate SOAP Note yang komprehensif:\n\nTRANSCRIPT: {{transcript}}\n\nRiwayat pasien sebelumnya: {{soap_history}}\n\nInstruksi:\n- Ekstrak SEMUA informasi klinis dari transcript\n- Identifikasi gejala yang disebutkan maupun yang tersirat\n- Susun Assessment dengan diferensial diagnosis terstruktur + probabilitas\n- Plan harus spesifik: nama obat, dosis, frekuensi, durasi\n- Format output dalam JSON yang valid`;

export const DEFAULT_PROMPT_REDFLAG = `Evaluasi transcript klinis berikut untuk tanda-tanda BAHAYA yang memerlukan tindakan segera:\n\n{{transcript}}\n\nDeteksi:\n- Tanda stroke: FAST\n- Tanda ACS: nyeri dada menjalar, keringat dingin, sesak\n- Tanda sepsis: demam tinggi, takikardia, takipnea, hipotensi\n- Kondisi abdomen akut\n\nOutput JSON: { "red_flags": [], "urgency_level": "low|medium|high|critical", "recommended_action": "" }`;

// DEFAULT_PROMPT_MEDICATION dihapus — tidak relevan untuk voice assistant
// Cenna bukan aplikasi manajemen obat, tidak perlu evaluasi drug interaction

export const DEFAULT_REASONING_CONFIG = {
  framework: 'hypothetico-deductive',
  evidenceLevel: '1b',
  rules: '',
};

export const DEFAULT_AI_BEHAVIOR = {
  profile: 'gp' as const,
  ddx: true,
  ebm: true,
  uncertain: true,
  followup: true,
  edu: true,
  soapDetail: 4,
  ddxCount: 3,
  lang: 'id-medical',
};

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

  // BUG-M4 FIX: Hanya coba exact + lowercase (max 2 DB calls vs sebelumnya 3).
  // Jika key sudah lowercase, hanya 1 query. Uppercase dihapus — tidak ada data yang disimpan uppercase.
  const keysToTry = key === key.toLowerCase()
    ? [key]
    : Array.from(new Set([key, key.toLowerCase()]));

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
  if (!client) {
    console.warn(`[sbSetSetting] No Supabase client — key: ${key}`);
    return;
  }
  const { error } = await client
    .from('app_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) {
    console.error(`[sbSetSetting] Failed to save key "${key}":`, error.message, error.code);
    throw new Error(`Gagal menyimpan setting "${key}": ${error.message}`);
  }
  console.debug(`[sbSetSetting] Saved key "${key}"`);
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

// ── CONVERSATION TEMPLATES ──────────────────────────────────────────────────
// Disimpan di app_settings key 'conversation_templates' — tidak perlu tabel baru.

export async function sbGetTemplates(): Promise<import('../types').ConversationTemplate[]> {
  try {
    const data = await sbGetSetting<import('../types').ConversationTemplate[]>('conversation_templates');
    return data || [];
  } catch { return []; }
}

export async function sbSaveTemplates(templates: import('../types').ConversationTemplate[]): Promise<void> {
  await sbSetSetting('conversation_templates', templates);
}

export async function sbGetActiveTemplate(): Promise<import('../types').ConversationTemplate | null> {
  const templates = await sbGetTemplates();
  return templates.find(t => t.is_active) ?? null;
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

// —— CENNA SESSIONS ————————————————————————————————————————————————————————————
// Tabel: cenna_sessions (id TEXT PK, created_at TIMESTAMPTZ,
//   anamnesis JSONB, conclusion JSONB, red_flags JSONB, transcript_full TEXT,
//   session_rounds INT)

export async function sbSaveSession(session: CennaSession): Promise<void> {
  const client = getSupabaseClient();
  if (!client) {
    // BUG-H3 FIX: Data anamnesis klinis pasien TIDAK boleh disimpan ke localStorage.
    // localStorage bisa diakses siapapun yang memiliki akses ke browser/device.
    // Jika Supabase tidak tersedia, log error dan hentikan — jangan simpan ke browser.
    console.error('[sbSaveSession] Supabase tidak tersedia — sesi klinis TIDAK disimpan. Periksa koneksi dan konfigurasi VITE_SUPABASE_URL.');
    return;
  }
  const { error } = await client.from('cenna_sessions').upsert(session, { onConflict: 'id' });
  if (error) {
    console.error('[sbSaveSession] Failed:', error.message, error.code);
    // Jangan throw — gagal simpan tidak boleh crash UX landing page
  } else {
    console.info('[sbSaveSession] Session saved:', session.id);
  }
}

export async function sbGetSessions(limit = 50): Promise<CennaSession[]> {
  const client = getSupabaseClient();
  if (!client) {
    // BUG-H3 FIX: Kembalikan array kosong jika Supabase tidak tersedia.
    // Jangan baca data klinis dari localStorage — data lama mungkin sudah stale atau sensitif.
    console.warn('[sbGetSessions] Supabase tidak tersedia — mengembalikan array kosong.');
    return [];
  }
  const { data, error } = await client
    .from('cenna_sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) { console.error(error); return []; }
  return (data ?? []) as CennaSession[];
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

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AuditLogEntry {
  id: string;
  ts: string;
  level: 'info' | 'success' | 'warning' | 'error' | 'critical';
  category: 'AUTH' | 'AI' | 'SOAP' | 'SYSTEM' | 'INTEGRATION' | 'TEMPLATE';
  message: string;
  user: string;
  ip: string;
  detail?: string;
}

export interface NotificationSettings {
  redflag: boolean;
  daily: boolean;
  error: boolean;
  token: boolean;
  emails: string;
}

export interface PlatformSettings {
  name: string;
  org: string;
  email: string;
  phone: string;
  tz: string;
  currency: string;
  address: string;
}

export interface BrandingSettings {
  brand: string;
  tagline: string;
  colorPrimary: string;
  colorHex: string;
  colorAccent: string;
  colorAccentHex: string;
  logoUrl?: string;
}

export interface DisplaySettings {
  lang: 'id' | 'en';
  dateformat: string;
  pagesize: number;
  theme: 'navy-cream' | 'dark' | 'light';
}

export interface AIBehaviorSettings {
  profile: 'specialist' | 'gp' | 'emergency' | 'pediatric';
  ddx: boolean;
  ebm: boolean;
  uncertain: boolean;
  followup: boolean;
  edu: boolean;
  soapDetail: number;
  ddxCount: number;
  lang: string;
}

export interface SOAPConfig {
  template: string;
  style: string;
}

export interface ReasoningConfig {
  framework: string;
  evidenceLevel: string;
  rules: string;
}

// ─── Conversation Template Types ──────────────────────────────────────────────

/** Satu langkah dalam conversation template */
export interface ConversationStep {
  id: string;
  order: number;               // urutan (1, 2, 3, ...)
  label: string;               // label untuk tampilan admin
  response_text: string;       // teks yang diucapkan CENNA
  next_question: string;       // pertanyaan lanjutan (kosong = tidak ada)
  orb_primary: string;         // hex warna orb primer, e.g. "#1e2a4a"
  orb_secondary: string;       // hex warna orb sekunder, e.g. "#b8a898"
  bg_from: string;             // hex gradient bg awal, e.g. "#f8f5f0"
  bg_to: string;               // hex gradient bg akhir, e.g. "#ffffff"
}

/** Template percakapan terskript */
export interface ConversationTemplate {
  id: string;
  name: string;
  description: string;
  is_active: boolean;          // hanya 1 template aktif sekaligus
  greeting: string;            // sapaan awal saat wake word (ganti "Halo dokter...")
  steps: ConversationStep[];
  created_at: string;
  updated_at: string;
}

// ─── Clinical Session Types ────────────────────────────────────────────────────

/** Hasil anamnesis terstruktur PQRST yang digali CENNA dari percakapan */
export interface AnamnesisData {
  // PQRST
  provokasi: string;
  kualitas: string;
  radiasi: string;
  skala: string;
  waktu: string;
  // Riwayat
  rpd: string;
  rpk: string;
  rps: string;
  // Pemeriksaan
  pemfis: string;
  // Status pengisian
  phase: 'gathering' | 'complete';
  missing_fields: string[];
}

/** Sesi anamnesis lengkap yang disimpan ke database */
export interface CennaSession {
  id: string;
  created_at: string;
  doctor_name?: string;
  anamnesis: AnamnesisData;
  conclusion: ClinicalConclusion | null;
  red_flags: string[];
  transcript_full: string;
  keluhan: string[];
  obat: string[];
  session_rounds: number;
}

/** Kesimpulan klinis yang dihasilkan CENNA setelah anamnesis lengkap */
export interface ClinicalConclusion {
  diagnosis_utama: string;
  icd10_code: string;
  diagnosis_banding: Array<{
    diagnosis: string;
    icd10: string;
    probabilitas: string;
    alasan: string;
  }>;
  tatalaksana: Array<{
    kategori: 'farmakologi' | 'non-farmakologi' | 'rujukan' | 'pemeriksaan penunjang';
    detail: string;
  }>;
  edukasi: string[];
  red_flags: string[];
  prognosis: string;
}

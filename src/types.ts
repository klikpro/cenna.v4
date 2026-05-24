/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AuditLogEntry {
  id: string;
  ts: string;
  level: 'info' | 'success' | 'warning' | 'error' | 'critical';
  category: 'AUTH' | 'AI' | 'SOAP' | 'SYSTEM' | 'INTEGRATION';
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

/** Hasil anamnesis terstruktur PQRST yang digali CENNA dari percakapan */
export interface AnamnesisData {
  // PQRST
  provokasi: string;        // Faktor yang memperberat / meringankan keluhan
  kualitas: string;         // Sifat / karakter keluhan (nyeri tumpul, tajam, dll)
  radiasi: string;          // Penyebaran / lokasi keluhan
  skala: string;            // Skala intensitas (0-10 atau deskriptif)
  waktu: string;            // Onset, durasi, frekuensi, pola
  // Riwayat
  rpd: string;              // Riwayat Penyakit Dahulu
  rpk: string;              // Riwayat Penyakit Keluarga
  rps: string;              // Riwayat Pribadi & Sosial (rokok, alkohol, pekerjaan, dll)
  // Pemeriksaan
  pemfis: string;           // Hasil Pemeriksaan Fisik (jika tersedia)
  // Status pengisian
  phase: 'gathering' | 'complete';
  missing_fields: string[]; // Field yang belum tergali
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

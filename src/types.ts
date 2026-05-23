/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Doctor {
  id: string;
  name: string;
  email: string;
  phone?: string;
  str?: string;
  specialization: string;
  clinic?: string;
  status: 'active' | 'trial' | 'inactive' | 'suspended';
  ai_profile: 'specialist' | 'gp' | 'emergency' | 'pediatric';
  soap_month: number;
  notes?: string;
  created_at?: string;
}

export interface Drug {
  id: string;
  generic: string;
  brand?: string;
  drug_class: string;
  form?: string;
  dose_adult?: string;
  dose_child?: string;
  indication?: string;
  contra?: string;
  preg: 'A' | 'B' | 'C' | 'D' | 'X';
  risk: 'low' | 'moderate' | 'high';
  is_generic: boolean;
  interactions?: string;
  notes?: string;
}

export interface IcdCode {
  id: string;
  code: string;
  name_id: string;
  name_lat?: string;
  chapter: string;
  notes?: string;
  freq: number;
  custom?: boolean;
}

export interface AuditLogEntry {
  id: string;
  ts: string;
  level: 'info' | 'success' | 'warning' | 'error' | 'critical';
  category: 'AUTH' | 'AI' | 'SOAP' | 'DRUG' | 'DOCTOR' | 'SYSTEM' | 'INTEGRATION';
  message: string;
  user: string;
  ip: string;
  detail?: string;
}

export interface NotificationSettings {
  redflag: boolean;
  daily: boolean;
  error: boolean;
  drug: boolean;
  doctor: boolean;
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

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Konstanta TTS/STT — dipisah agar tidak ada circular import antara
 * LandingPage.tsx ↔ ApiSettings.tsx
 */

export const ELEVEN_FREE_VOICES = [
  { id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica',  desc: 'Warm & clear, cocok untuk sapaan' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah',    desc: 'Soft & professional' },
  { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura',    desc: 'Upbeat & friendly' },
  { id: 'iP95p4xoKVk53GoZ742B', name: 'Chris',    desc: 'Casual & conversational (male)' },
  { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian',    desc: 'Deep & authoritative (male)' },
  { id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum',   desc: 'Crisp & neutral (male)' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel',   desc: 'British, warm (male)' },
  { id: 'pqHfZKP75CvOlQylNhV4', name: 'Bill',     desc: 'Mature & calm (male)' },
  { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda',  desc: 'Cheerful & bright' },
];

export const TTS_PROVIDERS = [
  { id: 'elevenlabs', name: 'ElevenLabs',          desc: 'Paling natural, multi-bahasa. Perlu API key.' },
  { id: 'google',     name: 'Google Cloud TTS',     desc: 'Sangat stabil, Bahasa Indonesia konsisten. Perlu API key.' },
  { id: 'openai',     name: 'OpenAI TTS',           desc: 'Kualitas baik, model tts-1. Perlu OpenAI API key.' },
  { id: 'azure',      name: 'Microsoft Azure TTS',  desc: 'Neural voices, sangat stabil. Perlu Azure key.' },
  { id: 'browser',    name: 'Browser TTS (gratis)', desc: 'Offline, tidak perlu key. Kualitas bergantung OS.' },
];

export const GOOGLE_TTS_VOICES = [
  { id: 'id-ID-Standard-A', name: 'Standard A', desc: 'Perempuan, standar' },
  { id: 'id-ID-Standard-B', name: 'Standard B', desc: 'Laki-laki, standar' },
  { id: 'id-ID-Standard-C', name: 'Standard C', desc: 'Perempuan, standar 2' },
  { id: 'id-ID-Standard-D', name: 'Standard D', desc: 'Laki-laki, standar 2' },
  { id: 'id-ID-Wavenet-A',  name: 'WaveNet A',  desc: 'Perempuan, neural (premium)' },
  { id: 'id-ID-Wavenet-B',  name: 'WaveNet B',  desc: 'Laki-laki, neural (premium)' },
  { id: 'id-ID-Wavenet-C',  name: 'WaveNet C',  desc: 'Perempuan, neural 2 (premium)' },
  { id: 'id-ID-Wavenet-D',  name: 'WaveNet D',  desc: 'Laki-laki, neural 2 (premium)' },
];

export const OPENAI_TTS_VOICES = [
  { id: 'shimmer', name: 'Shimmer', desc: 'Paling natural untuk Indonesia (rekomendasi)' },
  { id: 'nova',    name: 'Nova',    desc: 'Perempuan, muda & cerah' },
  { id: 'alloy',   name: 'Alloy',   desc: 'Netral, cocok klinis' },
  { id: 'echo',    name: 'Echo',    desc: 'Laki-laki, dalam' },
  { id: 'fable',   name: 'Fable',   desc: 'Ekspresif, hangat' },
  { id: 'onyx',    name: 'Onyx',    desc: 'Laki-laki, otoritatif' },
];

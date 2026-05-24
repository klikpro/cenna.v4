/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AIBehaviorSettings, SOAPConfig, ReasoningConfig } from '../types';
import { sbGetSetting, sbSetSetting, sbAddLog } from '../lib/supabase';
import { callActiveAI, AI_PROVIDERS, clearAiConfigCache } from './ApiSettings';

// Pre-seeded sandbox scenarios
const SCENARIOS = {
  ispa: `Pasien anak laki-laki 5 tahun, datang dengan keluhan demam 3 hari. Demam naik turun, tertinggi 38.9°C. Disertai batuk berdahak, pilek encer. Tidak ada keluhan sesak napas. Makan berkurang sedikit. Minum air putih hangat masih mau.
Dokter: Sudah ada riwayat minum obat penurun demam di rumah?
Ibu: Sudah diberikan parasetamol sirup 3 kali sehari dok, tapi demamnya naik lagi setelah obat habis.
Dokter: Ada kerabat dekat yang mengalami keluhan batuk pilek serupa?
Ibu: Ayahnya baru sembuh dari batuk pilek minggu lalu.`,
  appendicitis: `Pasien perempuan 28 tahun, mengeluh nyeri perut kanan bawah sejak 1 hari yang lalu. Nyeri awalnya dirasakan tumpul di daerah ulu hati/pusar, kemudian berkian tajam dan terlokalisir ke perut kanan bawah. Ada mual, muntah 1 kali tadi pagi. Nafsu makan menurun drastis. Ada demam ringan.
Dokter: Apakah nyeri terasa makin memberat saat berjalan atau terbatuk?
Pasien: Iya dok, terasa sangat nyeri kalau terguncang saat jalan.
Dokter: Apakah sedang dalam masa haid atau ada nyeri keputihan yang tidak biasa?
Pasien: Tidak dok, haid sedang teratur 2 minggu yang lalu.`,
  acs: `Pasien pria 58 tahun, mengeluh nyeri dada sebelah kiri yang terasa tertekan beban berat mendadak sejak 30 menit yang lalu. Nyeri menjalar ke arah lengan kiri dan geraham. Disertai keringat dingin membasahi pakaian, dan ada keluhan sesak napas mual. Riwayat hidup hipertensi dan merokok aktif 1 bungkus sehari.
Dokter: Apakah nyeri berkurang saat istirahat duduk?
Pasien: Tidak dok, masih terasa mencengkram dan sangat sesak.`,
  dm: `Pasien wanita 52 tahun, riwayat Diabetes Melitus Tipe 2 selama 5 tahun terkontrol tidak teratur. Mengeluhkan badan lemas, sering terbangun malam hari untuk BAK, dan berat badan turun 4 kg dalam sebulan terakhir tanpa usaha diet. Gula darah sewaktu (GDS) di laboratorium puskesmas tadi pagi fajar menunjukkan angka 312 mg/dL.`,
  stroke: `Pasien pria 65 tahun, dibawa keluarga segera ke IGD dengan keluhan kelemahan mendadak pada anggota gerak sebelah kanan (tangan dan kaki) saat bangun tidur pagi ini pukul 06.00. Mulut tampak pelo/miring ke kiri dan bicara sulit dipahami. Riwayat penyakit hipertensi lari tidak terkontrol obat.`,
  sepsis: `Pasien perempuan 45 tahun, demam menggigil tinggi sejak 2 hari disertai nyeri saat berkemih yang sangat perih. Tanda vital di ranjang: Suhu tubuh 39.4°C, Nadi 118x/menit cepat lemah, Pernapasan 24x/menit, Tekanan Darah 86/55 mmHg. Pasien tampak lemas dan respon kesadaran mengantuk somnolen.`,
};

export default function AiConfig() {
  const [activeTab, setActiveTab] = useState<'behavior' | 'prompts' | 'anamnesis' | 'reasoning' | 'sandbox'>('behavior');

  // 1. Behavior State
  const [profile, setProfile] = useState<'specialist' | 'gp' | 'emergency' | 'pediatric'>('gp');
  const [ddxActive, setDdxActive] = useState(true);
  const [ebmActive, setEbmActive] = useState(true);
  const [uncertainActive, setUncertainActive] = useState(true);
  const [followupActive, setFollowupActive] = useState(true);
  const [eduActive, setEduActive] = useState(true);
  const [soapDetail, setSoapDetail] = useState(4);
  const [ddxCount, setDdxCount] = useState(3);
  const [aiLang, setAiLang] = useState('id-medical');

  // 2. Prompts State
  const [promptAnamnesis, setPromptAnamnesis] = useState('');
  const [promptCore, setPromptCore] = useState('');
  const [promptSoap, setPromptSoap] = useState('');
  const [promptRedflag, setPromptRedflag] = useState('');
  const [promptMedication, setPromptMedication] = useState('');

  // 3. Reasoning State
  const [framework, setFramework] = useState('hypothetico-deductive');
  const [evidenceLevel, setEvidenceLevel] = useState('1b');
  const [clinicalRules, setClinicalRules] = useState('');

  // 4. Sandbox State
  const [selectedScenario, setSelectedScenario] = useState('');
  const [sandboxInput, setSandboxInput] = useState('');
  const [sandboxMode, setSandboxMode] = useState('soap');
  const [sandboxOutput, setSandboxOutput] = useState('');
  const [sandboxLoading, setSandboxLoading] = useState(false);

  const DEFAULT_PROMPT_ANAMNESIS = `Kamu adalah CENNA — asisten klinis suara berbahasa Indonesia dengan pola pikir DOKTER SPESIALIS KONSULTAN.

Tugasmu adalah menggali anamnesis secara sistematis mengikuti kerangka PQRST, Riwayat Penyakit Dahulu (RPD), Riwayat Penyakit Keluarga (RPK), Riwayat Pribadi & Sosial (RPS), dan Pemeriksaan Fisik (jika tersedia).

== KERANGKA PQRST ==
- P (Provokasi/Paliatif): Apa yang memperberat atau meringankan keluhan?
- Q (Kualitas): Bagaimana sifat / karakter keluhannya? (nyeri tumpul, tajam, seperti ditusuk, terbakar, dll)
- R (Radiasi/Regio): Di mana lokasi keluhannya? Apakah menjalar ke tempat lain?
- S (Skala/Severitas): Berapa skala keluhannya dari 0-10? Atau seberapa mengganggu aktivitas?
- T (Time/Waktu): Kapan mulai? Sudah berapa lama? Terus-menerus atau hilang-timbul?

== RIWAYAT ==
- RPD (Riwayat Penyakit Dahulu): Pernah sakit serupa sebelumnya? Penyakit kronis? Operasi? Rawat inap?
- RPK (Riwayat Penyakit Keluarga): Ada anggota keluarga dengan penyakit serupa atau penyakit herediter?
- RPS (Riwayat Pribadi & Sosial): Merokok? Alkohol? Pekerjaan? Aktivitas fisik? Status perkawinan? Alergi obat?

== PEMERIKSAAN FISIK ==
- Jika dokter menyebutkan hasil pemeriksaan fisik (tekanan darah, nadi, suhu, auskultasi, palpasi, dll), catat dan integrasikan ke dalam penilaian klinis.

== ATURAN PERCAKAPAN ==
- JANGAN bertanya semua sekaligus — ajukan 1-2 pertanyaan spesifik per giliran, prioritaskan yang paling relevan secara klinis
- Gunakan bahasa Indonesia yang hangat dan profesional seperti dokter yang berbicara langsung kepada pasien atau sejawat
- Saat keluhan sudah cukup tergali (minimal PQRST + 1 riwayat), sertakan field \"phase\": \"complete\" dan berikan kesimpulan klinis lengkap
- Selalu identifikasi RED FLAG yang memerlukan tindakan segera
- Gunakan terminologi medis Indonesia baku (IDI/PAPDI/WHO)

== FORMAT OUTPUT WAJIB JSON ==
{
  \"voice_response\": \"<1-3 kalimat yang akan diucapkan TTS — pertanyaan anamnesis berikutnya atau konfirmasi>\",
  \"anamnesis\": {
    \"provokasi\": \"<info atau kosong jika belum digali>\",
    \"kualitas\": \"\",
    \"radiasi\": \"\",
    \"skala\": \"\",
    \"waktu\": \"\",
    \"rpd\": \"\",
    \"rpk\": \"\",
    \"rps\": \"\",
    \"pemfis\": \"\"
  },
  \"missing_fields\": [\"<field yang belum tergali>\"],
  \"phase\": \"gathering\",
  \"keluhan\": [],
  \"obat\": [],
  \"pertanyaan\": [],
  \"red_flags\": [],
  \"conclusion\": null,
  \"session_end\": false
}

Saat phase \"complete\", isi field \"conclusion\" dengan:
{
  \"diagnosis_utama\": \"\",
  \"icd10_code\": \"\",
  \"diagnosis_banding\": [
    { \"diagnosis\": \"\", \"icd10\": \"\", \"probabilitas\": \"\", \"alasan\": \"\" }
  ],
  \"tatalaksana\": [
    { \"kategori\": \"farmakologi\", \"detail\": \"\" },
    { \"kategori\": \"non-farmakologi\", \"detail\": \"\" }
  ],
  \"edukasi\": [],
  \"red_flags\": [],
  \"prognosis\": \"\"
}`;

  const DEFAULT_PROMPT_CORE = `Kamu adalah CENNA AI, asisten klinis medis berbasis AI yang dirancang untuk membantu {{doctor_name}} ({{specialization}}) di {{clinic_name}}.\n\nCara berpikirmu:\n1. Analisis seperti KONSULTAN SPESIALIS — sistematis, komprehensif, evidence-based\n2. Selalu pertimbangkan differential diagnosis secara terstruktur\n3. Identifikasi RED FLAG secara proaktif — keselamatan pasien adalah prioritas utama\n4. Gunakan terminologi medis Indonesia yang baku, sesuai standar IDI/PAPDI\n5. Sertakan probabilitas klinis dalam setiap diagnosis banding\n6. Berikan rekomendasi berdasarkan guidelines terkini (PAPDI, Kemenkes, WHO)`;
  const DEFAULT_PROMPT_SOAP = `Analisis transcript percakapan berikut dan generate SOAP Note yang komprehensif:\n\nTRANSCRIPT: {{transcript}}\n\nRiwayat pasien sebelumnya: {{soap_history}}\n\nInstruksi:\n- Ekstrak SEMUA informasi klinis dari transcript\n- Identifikasi gejala yang disebutkan maupun yang tersirat\n- Susun Assessment dengan diferensial diagnosis terstruktur + probabilitas\n- Plan harus spesifik: nama obat, dosis, frekuensi, durasi\n- Format output dalam JSON yang valid`;
  const DEFAULT_PROMPT_REDFLAG = `Evaluasi transcript klinis berikut untuk tanda-tanda BAHAYA yang memerlukan tindakan segera:\n\n{{transcript}}\n\nDeteksi:\n- Tanda stroke: FAST\n- Tanda ACS: nyeri dada menjalar, keringat dingin, sesak\n- Tanda sepsis: demam tinggi, takikardia, takipnea, hipotensi\n- Kondisi abdomen akut\n\nOutput JSON: { "red_flags": [], "urgency_level": "low|medium|high|critical", "recommended_action": "" }`;
  const DEFAULT_PROMPT_MEDICATION = `Evaluasi keamanan regimen obat berikut untuk pasien {{patient_name}} ({{patient_age}} tahun):\n\nObat yang diresepkan: {{medications}}\nRiwayat alergi: {{allergies}}\nKondisi komorbid: {{comorbidities}}\n\nCek:\n1. Interaksi obat-obat (DDI)\n2. Kontraindikasi komorbid\n3. Kategori kehamilan\n\nOutput JSON: { "safe": true, "warnings": [], "suggestions": [] }`;

  // Load saved settings — 100% dari Supabase DB
  useEffect(() => {
    async function loadSettings() {
      // --- Prompts: dari Supabase ---
      const dbAnamnesis = await sbGetSetting<string>('prompt_anamnesis');
      setPromptAnamnesis(dbAnamnesis || DEFAULT_PROMPT_ANAMNESIS);

      const dbCore = await sbGetSetting<string>('prompt_core');
      setPromptCore(dbCore || DEFAULT_PROMPT_CORE);

      const dbSoap = await sbGetSetting<string>('prompt_soap');
      setPromptSoap(dbSoap || DEFAULT_PROMPT_SOAP);

      const dbRedflag = await sbGetSetting<string>('prompt_redflag');
      setPromptRedflag(dbRedflag || DEFAULT_PROMPT_REDFLAG);

      const dbMedication = await sbGetSetting<string>('prompt_medication');
      setPromptMedication(dbMedication || DEFAULT_PROMPT_MEDICATION);

      // --- Behavior: dari Supabase ---
      const dbBehavior = await sbGetSetting<AIBehaviorSettings>('ai_behavior');
      if (dbBehavior) {
        setProfile(dbBehavior.profile);
        setDdxActive(dbBehavior.ddx);
        setEbmActive(dbBehavior.ebm);
        setUncertainActive(dbBehavior.uncertain);
        setFollowupActive(dbBehavior.followup);
        setEduActive(dbBehavior.edu);
        setSoapDetail(dbBehavior.soapDetail);
        setDdxCount(dbBehavior.ddxCount);
        setAiLang(dbBehavior.lang);
      }

      // --- Reasoning: dari Supabase ---
      const dbReasoning = await sbGetSetting<ReasoningConfig>('reasoning_config');
      if (dbReasoning) {
        setFramework(dbReasoning.framework);
        setEvidenceLevel(dbReasoning.evidenceLevel);
        setClinicalRules(dbReasoning.rules);
      }
    }
    loadSettings();
  }, []);

  const handleSaveBehavior = async () => {
    const payload: AIBehaviorSettings = {
      profile,
      ddx: ddxActive,
      ebm: ebmActive,
      uncertain: uncertainActive,
      followup: followupActive,
      edu: eduActive,
      soapDetail,
      ddxCount,
      lang: aiLang,
    };
    await sbSetSetting('ai_behavior', payload);
    await sbAddLog('success', 'SYSTEM', 'Mengubah konfigurasi perilaku klinis AI.');
    alert('Konfigurasi perilaku klinis berhasil disimpan ke database!');
  };

  const handleSaveAnamnesis = async () => {
    await sbSetSetting('prompt_anamnesis', promptAnamnesis);
    await sbAddLog('success', 'SYSTEM', 'Prompt Anamnesis PQRST AI diperbarui.');
    alert('Prompt Anamnesis PQRST berhasil disimpan ke database!');
  };

  const handleResetAnamnesis = () => {
    if (confirm('Reset prompt anamnesis ke default bawaan sistem?')) {
      setPromptAnamnesis(DEFAULT_PROMPT_ANAMNESIS);
    }
  };

  const handleSavePrompts = async () => {
    await Promise.all([
      sbSetSetting('prompt_core', promptCore),
      sbSetSetting('prompt_soap', promptSoap),
      sbSetSetting('prompt_redflag', promptRedflag),
      sbSetSetting('prompt_medication', promptMedication),
    ]);
    await sbAddLog('success', 'SYSTEM', 'Memperbarui database template prompt utama AI.');
    alert('Seluruh kustomisasi prompt berhasil diperbarui ke database!');
  };

  const handleSaveReasoning = async () => {
    const payload: ReasoningConfig = {
      framework,
      evidenceLevel,
      rules: clinicalRules,
    };
    await sbSetSetting('reasoning_config', payload);
    await sbAddLog('success', 'SYSTEM', 'Mengubah logika reasoning klinis AI.');
    alert('Aturan reasoning engine berhasil diperbarui ke database!');
  };

  const handleSelectScenario = (key: string) => {
    setSelectedScenario(key);
    if (key && (SCENARIOS as any)[key]) {
      setSandboxInput((SCENARIOS as any)[key]);
    } else {
      setSandboxInput('');
    }
  };

  const handleRunSandbox = async () => {
    if (!sandboxInput.trim()) {
      alert('Tulis skenario klinis atau pilih dari template terlebih dahulu.');
      return;
    }
    setSandboxLoading(true);
    const dbAiCfg = await sbGetSetting<{ provider: string; model: string }>('api_ai_config');
    const activeProviderId = dbAiCfg?.provider || 'anthropic';
    const activeProviderDef = AI_PROVIDERS.find(p => p.id === activeProviderId) || AI_PROVIDERS[0];
    const activeModel = dbAiCfg?.model || activeProviderDef.defaultModel;
    setSandboxOutput(`⏳ CENNA AI menganalisis dengan ${activeProviderDef.icon} ${activeProviderDef.name}...\n\n`);

    try {
      const systemPrompt = 'Kamu adalah CENNA AI asisten klinis medis berbasis AI. Analisis setiap kasus dengan metodologi evidence-based medicine, gunakan terminologi medis Indonesia (IDI/PAPDI). Selalu sertakan kode ICD-10 yang relevan.';
      const actionPrompt = sandboxMode === 'soap'
        ? 'Buatkan resume SOAP Note klinis detail dan komprehensif'
        : sandboxMode === 'ddx'
        ? 'Analisis differential diagnosis lengkap dengan probabilitas dalam format JSON array'
        : 'Analisis dan deteksi Red Flag bahaya klinis kritis dari teks ini dalam format JSON';

      const result = await callActiveAI(systemPrompt, `${actionPrompt} dari teks kasus berikut:\n\n${sandboxInput}`);
      setSandboxOutput(`[${activeProviderDef.icon} ${activeProviderDef.name} — ${activeModel}]\n${'─'.repeat(55)}\n\n${result}`);
      await sbAddLog('success', 'AI', `Sandbox test berhasil via ${activeProviderDef.name}.`);
    } catch (e: any) {
      // Fallback simulasi jika provider belum dikonfigurasi
      if (e.message?.includes('belum dikonfigurasi') || e.message?.includes('API Key')) {
        await new Promise(r => setTimeout(r, 1200));
        let mockRes = '';
        if (sandboxMode === 'soap') {
          mockRes = `=========================================================\nCENNA GENERATED SOAP NOTE (Simulated — Offline Mode)\n=========================================================\n\n[SUBJECTIVE]\n- Keluhan Utama: Terdeteksi dari skenario transcript.\n- Gejala Penyerta: Mual, demam, penurunan nafsu makan.\n\n[OBJECTIVE]\n- Kesadaran: Compos Mentis (CM)\n\n[ASSESSMENT]\n- DDx: (1) Diagnosis utama 75%, (2) Alternatif 20%, (3) Lainnya 5%\n\n[PLAN]\n- Observasi tanda bahaya / Red Flag\n- Kontrol dalam 3 hari jika tidak membaik\n\n⚙️ Konfigurasi AI Provider di tab "API & Integrasi" untuk analisis real-time!\nProvider tersedia: ${AI_PROVIDERS.map(p => p.icon + ' ' + p.name).join(', ')}`;
        } else if (sandboxMode === 'ddx') {
          mockRes = `{\n  "differential_diagnoses": [\n    {\n      "icd10": "J06.9",\n      "diagnosis": "ISPA Non-Spesifik",\n      "probability": "70%",\n      "evidence": "Gejala klinis sesuai pola infeksi saluran napas atas"\n    }\n  ],\n  "note": "⚙️ Konfigurasi API Key untuk analisis DDx real-time"\n}`;
        } else {
          mockRes = `{\n  "red_flags": ["Perlu evaluasi lebih lanjut"],\n  "urgency_level": "medium",\n  "recommended_action": "⚙️ Konfigurasi API Key untuk deteksi Red Flag real-time",\n  "available_providers": [${AI_PROVIDERS.map(p => `"${p.name}"`).join(', ')}]\n}`;
        }
        setSandboxOutput(mockRes);
      } else {
        setSandboxOutput(`❌ Gagal memuat hasil AI.\nProvider: ${activeProviderDef.name}\nError: ${e.message}`);
      }
    } finally {
      setSandboxLoading(false);
    }
  };

  const handleInsertTag = (tag: string) => {
    setPromptCore((prev) => prev + ` ${tag}`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Tab select bar */}
      <div className="flex border-b border-[#1e2a4a]/12 gap-1 bg-[#1e2a4a]/5 p-1 rounded-xl">
        <button
          id="btn-tab-ai-behavior"
          onClick={() => setActiveTab('behavior')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition border-none cursor-pointer ${
            activeTab === 'behavior' ? 'bg-white text-[#1e2a4a] shadow-sm' : 'text-[#1e2a4a]/50 bg-transparent'
          }`}
        >
          🧠 Perilaku Klinis
        </button>
        <button
          id="btn-tab-ai-anamnesis"
          onClick={() => setActiveTab('anamnesis')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition border-none cursor-pointer ${
            activeTab === 'anamnesis' ? 'bg-white text-[#1e2a4a] shadow-sm' : 'text-[#1e2a4a]/50 bg-transparent'
          }`}
        >
          🩺 Prompt Anamnesis
        </button>
        <button
          id="btn-tab-ai-prompts"
          onClick={() => setActiveTab('prompts')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition border-none cursor-pointer ${
            activeTab === 'prompts' ? 'bg-white text-[#1e2a4a] shadow-sm' : 'text-[#1e2a4a]/50 bg-transparent'
          }`}
        >
          💬 System Prompts
        </button>
        <button
          id="btn-tab-ai-reasoning"
          onClick={() => setActiveTab('reasoning')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition border-none cursor-pointer ${
            activeTab === 'reasoning' ? 'bg-white text-[#1e2a4a] shadow-sm' : 'text-[#1e2a4a]/50 bg-transparent'
          }`}
        >
          🔬 Reasoning Engine
        </button>
        <button
          id="btn-tab-ai-sandbox"
          onClick={() => setActiveTab('sandbox')}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition border-none cursor-pointer ${
            activeTab === 'sandbox' ? 'bg-white text-[#1e2a4a] shadow-sm' : 'text-[#1e2a4a]/50 bg-transparent'
          }`}
        >
          🧪 AI Sandbox
        </button>
      </div>

      {activeTab === 'behavior' && (
        <div className="bg-white border border-[#1e2a4a]/12 rounded-3xl p-6 space-y-6">
          <div>
            <h3 className="font-bold text-sm text-[#1e2a4a] mb-1">Pengaturan Perilaku Klinis Utama</h3>
            <p className="text-xs text-slate-500">Tentukan spesialisasi penalaran bawaan dan ketelitian modul SOAP dari CENNA AI.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              onClick={() => setProfile('specialist')}
              className={`p-4 border-2 rounded-2xl cursor-pointer transition flex items-start gap-3 ${
                profile === 'specialist' ? 'border-[#1e2a4a] bg-slate-50' : 'border-gray-200'
              }`}
            >
              <div className="text-2xl pt-1">🏥</div>
              <div>
                <h4 className="font-bold text-xs text-[#1e2a4a] mb-1">Spesialis Konsultan</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">Reasoning terstrukur mendalam, differential diagnostik komprehensif didukung meta guideline.</p>
              </div>
            </div>

            <div
              onClick={() => setProfile('gp')}
              className={`p-4 border-2 rounded-2xl cursor-pointer transition flex items-start gap-3 ${
                profile === 'gp' ? 'border-[#1e2a4a] bg-slate-50' : 'border-gray-200'
              }`}
            >
              <div className="text-2xl pt-1">👨‍⚕️</div>
              <div>
                <h4 className="font-bold text-xs text-[#1e2a4a] mb-1">Dokter Umum Praktikal</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">Ekstraksi keluhan fokal utama, penulisan SOAP cepat, tindakan simtomatis lini pertama.</p>
              </div>
            </div>

            <div
              onClick={() => setProfile('emergency')}
              className={`p-4 border-2 rounded-2xl cursor-pointer transition flex items-start gap-3 ${
                profile === 'emergency' ? 'border-[#1e2a4a] bg-slate-50' : 'border-gray-200'
              }`}
            >
              <div className="text-2xl pt-1">🚨</div>
              <div>
                <h4 className="font-bold text-xs text-[#1e2a4a] mb-1">Emergency & Kritis</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">Penyaringan tanda bahaya akut (Red Flags), anjuran triase darurat penstabil fokal utama.</p>
              </div>
            </div>

            <div
              onClick={() => setProfile('pediatric')}
              className={`p-4 border-2 rounded-2xl cursor-pointer transition flex items-start gap-3 ${
                profile === 'pediatric' ? 'border-[#1e2a4a] bg-slate-50' : 'border-gray-200'
              }`}
            >
              <div className="text-2xl pt-1">👶</div>
              <div>
                <h4 className="font-bold text-xs text-[#1e2a4a] mb-1">Pediatri Anak</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">Menghitung takaran dosis pediatri berbasis rentang umur dan kelipatan bobot berat badan.</p>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-6 space-y-4">
            <h4 className="font-bold text-xs text-[#1e2a4a]">Fitur Penalaran Mandiri AI</h4>
            <div className="space-y-2 text-xs">
              <label className="flex items-center gap-2 cursor-pointer font-medium">
                <input type="checkbox" checked={ddxActive} onChange={(e) => setDdxActive(e.target.checked)} className="w-4 h-4 accent-[#1e2a4a]" />
                Diagnosis Banding Otomatis (Tampilkan 3-5 DDx)
              </label>
              <label className="flex items-center gap-2 cursor-pointer font-medium">
                <input type="checkbox" checked={ebmActive} onChange={(e) => setEbmActive(e.target.checked)} className="w-4 h-4 accent-[#1e2a4a]" />
                Evidence-Based Guideline (Sertakan rujukan IDI/PAPDI/WHO)
              </label>
              <label className="flex items-center gap-2 cursor-pointer font-medium">
                <input type="checkbox" checked={uncertainActive} onChange={(e) => setUncertainActive(e.target.checked)} className="w-4 h-4 accent-[#1e2a4a]" />
                Sinyalir Ketidakpastian Klinis (Clinical uncertainty flags)
              </label>
              <label className="flex items-center gap-2 cursor-pointer font-medium">
                <input type="checkbox" checked={followupActive} onChange={(e) => setFollowupActive(e.target.checked)} className="w-4 h-4 accent-[#1e2a4a]" />
                Follow-up & Kontrol Lanjutan otomatis
              </label>
              <label className="flex items-center gap-2 cursor-pointer font-medium">
                <input type="checkbox" checked={eduActive} onChange={(e) => setEduActive(e.target.checked)} className="w-4 h-4 accent-[#1e2a4a]" />
                Edukasi & Pencegahan preventif untuk Pasien
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-100 pt-6">
            <div className="space-y-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                Tingkat Kedetailan SOAP (1-5): <span className="font-mono text-xs">{soapDetail}</span>
              </label>
              <input
                id="soap-detail-slider"
                type="range"
                min="1"
                max="5"
                value={soapDetail}
                onChange={(e) => setSoapDetail(parseInt(e.target.value))}
                className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#1e2a4a]"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                Bahasa Output AI
              </label>
              <select
                id="ai-lang-select"
                value={aiLang}
                onChange={(e) => setAiLang(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none text-slate-800"
              >
                <option value="id-medical">Bahasa Indonesia + Latin Medis</option>
                <option value="id">Bahasa Indonesia Standar</option>
                <option value="en">English (Clinical)</option>
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <button
              id="btn-save-ai-behavior"
              onClick={handleSaveBehavior}
              className="px-6 py-3 bg-[#1e2a4a] hover:bg-[#2d3f6b] text-white text-xs font-bold rounded-xl border-none cursor-pointer shadow-md"
            >
              💾 Simpan Perilaku Klinis
            </button>
          </div>
        </div>
      )}

      {activeTab === 'anamnesis' && (
        <div className="bg-white border border-[#1e2a4a]/12 rounded-3xl p-6 space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-bold text-sm text-[#1e2a4a] mb-1">🩺 Prompt Anamnesis AI — Pola Pikir Dokter Spesialis</h3>
              <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
                Prompt ini mengendalikan cara CENNA menggali anamnesis di halaman depan (Landing Page).
                Menggunakan kerangka <strong>PQRST</strong>, <strong>RPD</strong>, <strong>RPK</strong>, <strong>RPS</strong>, dan <strong>Pemeriksaan Fisik</strong>.
                Setelah data terkumpul, CENNA akan langsung menjabarkan <strong>diagnosa, DDx, tatalaksana, dan edukasi</strong>.
              </p>
            </div>
            <button
              onClick={handleResetAnamnesis}
              className="ml-4 px-3 py-1.5 border border-orange-300 text-orange-600 rounded-lg text-[10px] font-bold cursor-pointer hover:bg-orange-50 whitespace-nowrap"
            >
              ↺ Reset Default
            </button>
          </div>

          {/* Info cards PQRST */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {[
              { key: 'P', label: 'Provokasi', desc: 'Pemberat / peringan' },
              { key: 'Q', label: 'Kualitas', desc: 'Karakter keluhan' },
              { key: 'R', label: 'Radiasi', desc: 'Lokasi & penjalaran' },
              { key: 'S', label: 'Skala', desc: 'Intensitas 0-10' },
              { key: 'T', label: 'Time', desc: 'Onset & durasi' },
            ].map(item => (
              <div key={item.key} className="bg-[#1e2a4a]/5 rounded-xl p-2.5 text-center">
                <span className="text-lg font-black text-[#1e2a4a]">{item.key}</span>
                <p className="text-[10px] font-bold text-[#1e2a4a] mt-0.5">{item.label}</p>
                <p className="text-[9px] text-slate-400">{item.desc}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {[
              { key: 'RPD', label: 'Riwayat Penyakit Dahulu', desc: 'Sakit sebelumnya, operasi, rawat inap' },
              { key: 'RPK', label: 'Riwayat Penyakit Keluarga', desc: 'Penyakit herediter, keluarga dekat' },
              { key: 'RPS', label: 'Riwayat Pribadi & Sosial', desc: 'Rokok, alkohol, pekerjaan, alergi' },
            ].map(item => (
              <div key={item.key} className="bg-blue-50 rounded-xl p-2.5">
                <span className="text-xs font-black text-blue-700">{item.key}</span>
                <p className="text-[10px] font-bold text-blue-700 mt-0.5">{item.label}</p>
                <p className="text-[9px] text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#1e2a4a]">
              System Prompt Anamnesis (disimpan ke database — digunakan oleh CENNA di Landing Page)
            </label>
            <p className="text-[10px] text-slate-400 mb-2">
              Edit dengan hati-hati. Pastikan format output JSON tetap konsisten agar parsing tidak rusak.
            </p>
            <textarea
              id="prompt-anamnesis-textarea"
              rows={20}
              value={promptAnamnesis}
              onChange={(e) => setPromptAnamnesis(e.target.value)}
              className="w-full p-4 bg-[#0d1a36] text-[#94a8d8] rounded-xl text-xs font-mono leading-relaxed outline-none focus:border-[#3d5494] border border-[#1e2a4a]/12 resize-vertical"
            />
          </div>

          {/* Output fields yang dihasilkan */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-2">
            <h4 className="text-xs font-bold text-emerald-800">📋 Output yang dihasilkan CENNA (disimpan ke database tiap sesi)</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
              {[
                '✅ Diagnosa Utama + ICD-10',
                '✅ Diagnosis Banding (DDx)',
                '✅ Tatalaksana Farmakologi',
                '✅ Tatalaksana Non-Farmakologi',
                '✅ Edukasi Pasien',
                '✅ Red Flags Terdeteksi',
                '✅ Riwayat PQRST Terstruktur',
                '✅ Prognosis Singkat',
              ].map(item => (
                <span key={item} className="text-emerald-700 font-medium">{item}</span>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex gap-3">
            <button
              id="btn-save-anamnesis-prompt"
              onClick={handleSaveAnamnesis}
              className="px-6 py-3 bg-[#1e2a4a] hover:bg-[#2d3f6b] text-white text-xs font-bold rounded-xl border-none cursor-pointer shadow-md"
            >
              💾 Simpan Prompt Anamnesis ke Database
            </button>
          </div>
        </div>
      )}

      {activeTab === 'prompts' && (
        <div className="bg-white border border-[#1e2a4a]/12 rounded-3xl p-6 space-y-6">
          <div>
            <h3 className="font-bold text-sm text-[#1e2a4a] mb-1">Editor System Prompts AI</h3>
            <p className="text-xs text-slate-500">Konfigurasi instruksi sistem bertingkat tinggi untuk mengendalikan akurasi ekstraksi informasi.</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                Core Identity Prompt (Rujukan cara berpikir dasar)
              </label>
              <div className="flex gap-2 flex-wrap pb-1">
                {['{{doctor_name}}', '{{specialization}}', '{{clinic_name}}', '{{transcript}}'].map((tag) => (
                  <button
                    key={tag}
                    id={`btn-insert-tag-${tag}`}
                    type="button"
                    onClick={() => handleInsertTag(tag)}
                    className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 border-none text-[10px] text-slate-600 font-mono cursor-pointer"
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <textarea
                id="prompt-core-textarea"
                rows={6}
                value={promptCore}
                onChange={(e) => setPromptCore(e.target.value)}
                className="w-full p-4 bg-[#0d1a36] text-[#94a8d8] rounded-xl text-xs font-mono line-height-relaxed outline-none focus:border-[#3d5494] border border-[#1e2a4a]/12"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                Pembentuk SOAP (SOAP Generator Prompts)
              </label>
              <textarea
                id="prompt-soap-textarea"
                rows={6}
                value={promptSoap}
                onChange={(e) => setPromptSoap(e.target.value)}
                className="w-full p-4 bg-[#0d1a36] text-[#94a8d8] rounded-xl text-xs font-mono line-height-relaxed outline-none focus:border-[#3d5494] border border-[#1e2a4a]/12"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                Saringan Red Flags (Akut/Darurat)
              </label>
              <textarea
                id="prompt-redflag-textarea"
                rows={4}
                value={promptRedflag}
                onChange={(e) => setPromptRedflag(e.target.value)}
                className="w-full p-4 bg-[#0d1a36] text-[#94a8d8] rounded-xl text-xs font-mono line-height-relaxed outline-none focus:border-[#3d5494] border border-[#1e2a4a]/12"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex gap-3">
            <button
              id="btn-save-ai-prompts"
              onClick={handleSavePrompts}
              className="px-6 py-3 bg-[#1e2a4a] hover:bg-[#2d3f6b] text-white text-xs font-bold rounded-xl border-none cursor-pointer shadow-md"
            >
              💾 Simpan Seluruh Prompts
            </button>
          </div>
        </div>
      )}

      {activeTab === 'reasoning' && (
        <div className="bg-white border border-[#1e2a4a]/12 rounded-3xl p-6 space-y-6">
          <div>
            <h3 className="font-bold text-sm text-[#1e2a4a] mb-1">Clinical Reasoning Settings</h3>
            <p className="text-xs text-slate-500">Sesuaikan logika penarikan hipotesa penyakit yang diizinkan untuk asisten AI.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                Metode Kerangka Penalaran
              </label>
              <select
                id="reasoning-framework-select"
                value={framework}
                onChange={(e) => setFramework(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none text-slate-800"
              >
                <option value="hypothetico-deductive">Hypothetico-Deductive (Standar Dokter Spesialis)</option>
                <option value="bayesian">Bayesian pattern matching (Probabilistik Gejala)</option>
                <option value="protocol">Protocol-driven (Ketat Alur Klinis Panduan)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                Tingkat Bukti Minimum (Minimum EBM)
              </label>
              <select
                id="evidence-level-select"
                value={evidenceLevel}
                onChange={(e) => setEvidenceLevel(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none text-slate-800"
              >
                <option value="1a">Level 1a — Meta-analysis Acak Terkontrol</option>
                <option value="1b">Level 1b — Percobaan Acak Terkontrol Individu</option>
                <option value="2">Level 2 — Studi Kohort Prospektif</option>
                <option value="expert">Expert Opinion — Panduan Dokter Utama Senior</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#1e2a4a]">
              Aturan Klinis Kustom (Format Pseudocode Aturan / IF-ELSE)
            </label>
            <textarea
              id="clinical-rules-textarea"
              rows={4}
              value={clinicalRules}
              onChange={(e) => setClinicalRules(e.target.value)}
              placeholder="// Tulis aturan kustom lokal\nIF patient_age < 5 AND fever_duration > 3 THEN suggest_test = 'darah lengkap';\nIF prescription_count > 5 THEN flag_polypharmacy = true;"
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none h-24 font-mono resize-vertical text-slate-800"
            />
          </div>

          <div className="pt-4 border-t border-gray-100">
            <button
              id="btn-save-ai-reasoning"
              onClick={handleSaveReasoning}
              className="px-6 py-3 bg-[#1e2a4a] hover:bg-[#2d3f6b] text-white text-xs font-bold rounded-xl border-none cursor-pointer shadow-md"
            >
              💾 Simpan Aturan Reasoning
            </button>
          </div>
        </div>
      )}

      {activeTab === 'sandbox' && (
        <div className="bg-white border border-[#1e2a4a]/12 rounded-3xl p-6 space-y-6">
          <div>
            <h3 className="font-bold text-sm text-[#1e2a4a] mb-1">AI Clinical Sandbox Tester</h3>
            <p className="text-xs text-slate-500">Uji coba simulasi transkrip dialog medis secara aman sebelum ditarik ke dalam RME hidup.</p>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                  Pilih Template Skenario Diagnosis
                </label>
                <select
                  id="sandbox-scenario-select"
                  value={selectedScenario}
                  onChange={(e) => handleSelectScenario(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none text-slate-800 cursor-pointer"
                >
                  <option value="">-- Tulis custom skenario Anda sendiri --</option>
                  <option value="ispa">Anak 5 tahun dengan batuk pilek demam (ISPA)</option>
                  <option value="appendicitis">Nyeri perut kanan bawah kanan bawah (Appendisitis Akut)</option>
                  <option value="acs">Pria 58 tahun nyeri dada kiri rasa tertindih (ACS)</option>
                  <option value="dm">Wanita lemas, nocturia malam hari, GDS tinggi (DM T2)</option>
                  <option value="stroke">Lumpuh separuh badan mendadak pagi hari (Stroke Iskemik)</option>
                  <option value="sepsis">Demam menggigil, tensi drop, ISK (Sepsis)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                  Mode Analisa AI
                </label>
                <select
                  id="sandbox-mode-select"
                  value={sandboxMode}
                  onChange={(e) => setSandboxMode(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none text-slate-800 cursor-pointer"
                >
                  <option value="soap">Generate Full Resume SOAP Note</option>
                  <option value="ddx">Analisa Struktur Differential Diagnosis</option>
                  <option value="redflag">Deteksi Realtime Red Flags</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                Input Percakapan Transcript Dokter-Pasien
              </label>
              <textarea
                id="sandbox-input-textarea"
                rows={6}
                value={sandboxInput}
                onChange={(e) => setSandboxInput(e.target.value)}
                placeholder="Tulis dialog transkrip perkataan lisan medis beralur di sini..."
                className="w-full p-4 bg-[#ede6d6]/40 border border-[#1e2a4a]/12 rounded-2xl text-xs font-sans text-slate-800 placeholder-slate-400 outline-none h-36 resize-vertical"
              />
            </div>

            <div className="flex gap-3">
              <button
                id="btn-run-sandbox"
                onClick={handleRunSandbox}
                disabled={sandboxLoading}
                className="px-6 py-3 bg-[#1e2a4a] hover:bg-[#2d3f6b] text-white text-xs font-bold rounded-xl border-none disabled:opacity-50 cursor-pointer shadow-md"
              >
                {sandboxLoading
                  ? `⏳ Menganalisis...`
                  : `🧪 Jalankan via AI Engine`}
              </button>
            </div>

            <div className="space-y-1 pt-4">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                Output Hasil Analisis CENNA AI (JSON / structured resume)
              </label>
              <div
                id="sandbox-output-block"
                className="w-full p-4 bg-[#0d1a36] text-[#94a8d8] rounded-xl text-xs font-mono whitespace-pre-wrap overflow-x-auto h-64 border border-[#1e2a4a]/12 leading-relaxed"
              >
                {sandboxOutput || 'Hasil analisis prompt akan dicetak di sini setelah test dijalankan...'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

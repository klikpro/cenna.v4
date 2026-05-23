/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Drug } from '../types';
import { HIGHRISK_DATA, INTERACTIONS_DATA } from '../lib/supabase';

interface DrugsProps {
  drugs: Drug[];
  onSaveDrug: (drug: Drug) => void;
  onDeleteDrug: (id: string) => void;
}

export default function Drugs({ drugs, onSaveDrug, onDeleteDrug }: DrugsProps) {
  const [activeTab, setActiveTab] = useState<'formulary' | 'checker' | 'highrisk'>('formulary');

  // Formulary search state
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('');

  // Interaction Checker tags state
  const [checkerTags, setCheckerTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [checkerResults, setCheckerResults] = useState<any[]>([]);
  const [checkerSearched, setCheckerSearched] = useState(false);

  // Form edit state
  const [modalOpen, setModalOpen] = useState(false);
  const [formId, setFormId] = useState<string | null>(null);
  const [formGeneric, setFormGeneric] = useState('');
  const [formBrand, setFormBrand] = useState('');
  const [formClass, setFormClass] = useState('Antibiotik');
  const [formForm, setFormForm] = useState('');
  const [formDoseAdult, setFormDoseAdult] = useState('');
  const [formDoseChild, setFormDoseChild] = useState('');
  const [formIndication, setFormIndication] = useState('');
  const [formContra, setFormContra] = useState('');
  const [formPreg, setFormPreg] = useState<'A' | 'B' | 'C' | 'D' | 'X'>('C');
  const [formRisk, setFormRisk] = useState<'low' | 'moderate' | 'high'>('low');
  const [formIsGeneric, setFormIsGeneric] = useState(true);
  const [formInteractions, setFormInteractions] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const filteredDrugs = drugs.filter((d) => {
    const matchesSearch =
      d.generic.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.brand || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.indication || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass = !classFilter || d.drug_class === classFilter;
    const matchesRisk = !riskFilter || d.risk === riskFilter;
    return matchesSearch && matchesClass && matchesRisk;
  });

  const handleOpenAdd = () => {
    setFormId(null);
    setFormGeneric('');
    setFormBrand('');
    setFormClass('Antibiotik');
    setFormForm('');
    setFormDoseAdult('');
    setFormDoseChild('');
    setFormIndication('');
    setFormContra('');
    setFormPreg('C');
    setFormRisk('low');
    setFormIsGeneric(true);
    setFormInteractions('');
    setFormNotes('');
    setErrorMsg(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (d: Drug) => {
    setFormId(d.id);
    setFormGeneric(d.generic);
    setFormBrand(d.brand || '');
    setFormClass(d.drug_class);
    setFormForm(d.form || '');
    setFormDoseAdult(d.dose_adult || '');
    setFormDoseChild(d.dose_child || '');
    setFormIndication(d.indication || '');
    setFormContra(d.contra || '');
    setFormPreg(d.preg);
    setFormRisk(d.risk);
    setFormIsGeneric(d.is_generic);
    setFormInteractions(d.interactions || '');
    setFormNotes(d.notes || '');
    setErrorMsg(null);
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formGeneric.trim()) {
      setErrorMsg('Nama generic wajib diisi.');
      return;
    }
    const payload: Drug = {
      id: formId || 'drug_' + Date.now(),
      generic: formGeneric.trim(),
      brand: formBrand.trim(),
      drug_class: formClass,
      form: formForm.trim(),
      dose_adult: formDoseAdult.trim(),
      dose_child: formDoseChild.trim(),
      indication: formIndication.trim(),
      contra: formContra.trim(),
      preg: formPreg,
      risk: formRisk,
      is_generic: formIsGeneric,
      interactions: formInteractions.trim(),
      notes: formNotes.trim(),
    };
    onSaveDrug(payload);
    setModalOpen(false);
  };

  // Add tags on input keypress
  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const val = tagInput.trim().toLowerCase();
      if (!checkerTags.includes(val)) {
        setCheckerTags([...checkerTags, val]);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setCheckerTags(checkerTags.filter((t) => t !== tag));
  };

  const handleCheck = () => {
    if (checkerTags.length < 2) {
      setCheckerResults([]);
      setCheckerSearched(false);
      return;
    }
    // Search overlap interactions
    const hits = INTERACTIONS_DATA.filter((i) => {
      const medicationA = i.a.toLowerCase();
      const medicationB = i.b.toLowerCase();
      return (
        (checkerTags.includes(medicationA) && checkerTags.some((t) => medicationB.includes(t) || t.includes(medicationB))) ||
        (checkerTags.includes(medicationB) && checkerTags.some((t) => medicationA.includes(t) || t.includes(medicationA)))
      );
    });
    setCheckerResults(hits);
    setCheckerSearched(true);
  };

  const handleClearChecker = () => {
    setCheckerTags([]);
    setCheckerResults([]);
    setCheckerSearched(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Settings Tabs for Drugs Cockpit */}
      <div className="flex border-b border-[#1e2a4a]/12 gap-1 bg-[#1e2a4a]/5 p-1 rounded-xl">
        <button
          id="btn-tab-formulary"
          onClick={() => setActiveTab('formulary')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition border-none cursor-pointer ${
            activeTab === 'formulary' ? 'bg-white text-[#1e2a4a] shadow-sm' : 'text-[#1e2a4a]/50 bg-transparent'
          }`}
        >
          Formularium Obat
        </button>
        <button
          id="btn-tab-checker"
          onClick={() => setActiveTab('checker')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition border-none cursor-pointer ${
            activeTab === 'checker' ? 'bg-white text-[#1e2a4a] shadow-sm' : 'text-[#1e2a4a]/50 bg-transparent'
          }`}
        >
          Cek Interaksi Obat
        </button>
        <button
          id="btn-tab-highrisk"
          onClick={() => setActiveTab('highrisk')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition border-none cursor-pointer ${
            activeTab === 'highrisk' ? 'bg-white text-[#1e2a4a] shadow-sm' : 'text-[#1e2a4a]/50 bg-transparent'
          }`}
        >
          Peringatan High-Risk (High Alert)
        </button>
      </div>

      {activeTab === 'formulary' && (
        <div className="space-y-6 animate-fade-in">
          {/* Filters shelf */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 bg-white border border-[#1e2a4a]/12 rounded-xl px-4 py-2 flex items-center gap-2">
              <span className="text-slate-400">🔍</span>
              <input
                id="drug-search-input"
                type="text"
                placeholder="Cari obat, kelas terapi, atau indikasi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-xs outline-none text-slate-800 placeholder-slate-400 font-sans"
              />
            </div>

            <select
              id="drug-class-filter"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="bg-white border border-[#1e2a4a]/12 rounded-xl text-xs px-4 py-3 outline-none text-slate-700 cursor-pointer"
            >
              <option value="">Semua Kelas Terapi</option>
              <option value="Antibiotik">Antibiotik</option>
              <option value="Analgetik">Analgetik</option>
              <option value="Antihipertensi">Antihipertensi</option>
              <option value="Antidiabetik">Antidiabetik</option>
              <option value="Antikoagulan">Antikoagulan</option>
              <option value="Gastrointestinal">Gastrointestinal</option>
              <option value="Kardiovaskular">Kardiovaskular</option>
              <option value="Pernapasan">Pernapasan</option>
            </select>

            <select
              id="drug-risk-filter"
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="bg-white border border-[#1e2a4a]/12 rounded-xl text-xs px-4 py-3 outline-none text-slate-700 cursor-pointer"
            >
              <option value="">Semua Risiko</option>
              <option value="low">Kategori Low Risk</option>
              <option value="moderate">Kategori Moderate</option>
              <option value="high">Kategori High-Risk (High Alert)</option>
            </select>

            <button
              id="btn-add-drug"
              onClick={handleOpenAdd}
              className="px-5 py-3 bg-[#1e2a4a] hover:bg-[#2d3f6b] rounded-xl text-xs font-bold text-white border-none cursor-pointer"
            >
              ＋ Tambah Obat
            </button>
          </div>

          {/* Table display */}
          <div className="bg-white border border-[#1e2a4a]/12 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-[#1e2a4a]/12 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="font-bold text-sm text-[#1e2a4a]">Formularium Obat Klinik</h3>
                <p className="text-[11px] text-[#1e2a4a]/45">Aturan rujukan dosis, kelas interaksi, dan kategori kehamilan FDA</p>
              </div>
              <span className="text-xs font-semibold text-[#1e2a4a]/50 font-mono">
                {filteredDrugs.length} Obat
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-[#1e2a4a]/12 text-[#1e2a4a]/45 font-bold uppercase tracking-wider">
                    <th className="p-4">Nama Generik / Paten</th>
                    <th className="p-4">Kelas Terapi</th>
                    <th className="p-4">Dosis Dewasa</th>
                    <th className="p-4">Sediaan</th>
                    <th className="p-4 text-center">FDA Hamil</th>
                    <th className="p-4 text-center">Risiko</th>
                    <th className="p-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredDrugs.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/50">
                      <td className="p-4">
                        <div className="font-bold text-[#1e2a4a]">{d.generic}</div>
                        <div className="text-[11px] text-[#1e2a4a]/50 italic">{d.brand || 'Generik Murni'}</div>
                      </td>
                      <td className="p-4">
                        <span className="font-semibold text-[10px] px-2.5 py-1 rounded bg-[#1e2a4a]/5 text-[#1e2a4a]">
                          {d.drug_class}
                        </span>
                      </td>
                      <td className="p-4 text-slate-600 truncate max-w-[180px]" title={d.dose_adult}>
                        {d.dose_adult || '—'}
                      </td>
                      <td className="p-4 text-slate-500">{d.form || '—'}</td>
                      <td className="p-4 text-center">
                        <span className={`inline-flex w-7 h-7 rounded-full font-bold text-xs items-center justify-center ${
                          d.preg === 'A' ? 'bg-emerald-100 text-emerald-700' :
                          d.preg === 'B' ? 'bg-blue-100 text-blue-700' :
                          d.preg === 'C' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {d.preg}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          d.risk === 'high' ? 'bg-red-500/15 text-red-600' :
                          d.risk === 'moderate' ? 'bg-amber-500/10 text-amber-600' : 'bg-emerald-500/10 text-[#10b981]'
                        }`}>
                          {d.risk === 'high' ? 'High-Risk' : d.risk === 'moderate' ? 'Moderate' : 'Low Risk'}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex justify-center gap-1">
                          <button
                            id={`btn-edit-drug-${d.id}`}
                            onClick={() => handleOpenEdit(d)}
                            className="w-7 h-7 rounded bg-slate-100 border-none cursor-pointer hover:bg-slate-200 flex items-center justify-center text-xs"
                          >
                            ✏️
                          </button>
                          <button
                            id={`btn-delete-drug-${d.id}`}
                            onClick={() => onDeleteDrug(d.id)}
                            className="w-7 h-7 rounded bg-red-400/10 hover:bg-red-400/20 text-red-600 border-none cursor-pointer flex items-center justify-center text-xs"
                          >
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'checker' && (
        <div className="space-y-6 animate-fade-in bg-white border border-[#1e2a4a]/12 rounded-3xl p-6 shadow-sm">
          <div>
            <h3 className="font-bold text-md text-[#1e2a4a] mb-1">Live Drug Interaction Checker</h3>
            <p className="text-xs text-slate-500">Mencegah potensi peracunan obat aditif dengan memantau interaksi berbahaya secara aktif.</p>
          </div>

          <div
            onClick={() => document.getElementById('checker-tag-input')?.focus()}
            className="flex flex-wrap gap-2 p-3 bg-[#ede6d6]/60 border border-[#1e2a4a]/12 rounded-2xl min-h-[56px] focus-within:bg-white focus-within:border-slate-400 outline-none select-none cursor-text"
          >
            {checkerTags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-2 px-3 py-1 bg-[#1e2a4a] text-white rounded-full font-bold text-xs">
                {tag}
                <button
                  id={`btn-remove-tag-${tag}`}
                  onClick={() => handleRemoveTag(tag)}
                  className="text-white bg-transparent border-none cursor-pointer p-0 font-bold"
                >
                  ✕
                </button>
              </span>
            ))}
            <input
              id="checker-tag-input"
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder={checkerTags.length === 0 ? "Ketik nama bahan/generik (mis. warfarin) + Tekan Enter..." : "Tambahkan obat..."}
              className="bg-transparent text-xs text-[#111827] flex-1 min-w-[150px] outline-none border-none py-1 h-6 font-sans"
            />
          </div>

          <div className="flex gap-4">
            <button
              id="btn-run-checker"
              onClick={handleCheck}
              disabled={checkerTags.length < 2}
              className="px-6 py-3 bg-[#1e2a4a] hover:bg-[#2d3f6b] text-white text-xs font-bold rounded-xl border-none disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
            >
              Analyze Interaksi ({checkerTags.length} Obat)
            </button>
            <button
              id="btn-clear-checker"
              onClick={handleClearChecker}
              className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border-none transition cursor-pointer"
            >
              ✕ Clear All
            </button>
          </div>

          {checkerSearched && (
            <div className="p-4 bg-slate-50 border border-[#1e2a4a]/8 rounded-2xl space-y-3">
              {checkerResults.length === 0 ? (
                <p className="text-xs text-[#10b981] font-semibold flex items-center gap-2">
                  <span>✓</span> Tidak ditemukan interaksi bertabrakan (hazard) dalam database internal kami untuk kombinasi ini.
                </p>
              ) : (
                <div className="space-y-4">
                  <h4 className="font-bold text-xs text-[#1e2a4a] flex items-center gap-2">
                    <span>⚠️</span> Ditemukan {checkerResults.length} tabrakan interaksi obat:
                  </h4>
                  {checkerResults.map((hit, i) => (
                    <div key={i} className={`p-4 rounded-xl border ${
                      hit.level === 'major' ? 'bg-red-500/5 border-red-500/20 text-red-900' : 'bg-amber-500/5 border-amber-500/20 text-amber-900'
                    }`}>
                      <div className="font-bold text-xs flex justify-between">
                        <span>{hit.a} ⟷ {hit.b}</span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                          hit.level === 'major' ? 'bg-red-500/10 text-red-600' : 'bg-amber-500/10 text-amber-600'
                        }`}>{hit.level}</span>
                      </div>
                      <p className="text-xs text-slate-800 mt-2 leading-relaxed">{hit.mechanism}</p>
                      <p className="text-[11px] text-slate-500 mt-2"><strong>Rekomendasi:</strong> {hit.action}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'highrisk' && (
        <div className="space-y-6 animate-fade-in bg-white border border-[#1e2a4a]/12 rounded-3xl p-6 shadow-sm">
          <div className="p-4 bg-red-400/5 border border-red-500/20 rounded-2xl flex gap-3 text-red-800">
            <span className="text-2xl mt-1">⚠️</span>
            <div>
              <h4 className="font-bold text-xs mb-1">Kebijakan High-Alert Medications</h4>
              <p className="text-xs leading-relaxed text-slate-500">
                Obat-obatan berikut memiliki batas keselamatan terapeutik yang sangat sempit. CENNA AI dikonfigurasi untuk menampilkan modul konfirmasi rekam sebelum dokter mencetak rujukan resep.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto border border-[#1e2a4a]/12 rounded-2xl">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-[#1e2a4a]/12 font-bold uppercase text-[#1e2a4a]/50">
                  <th className="p-4">Drug Generic</th>
                  <th className="p-4">Kelas</th>
                  <th className="p-4">Bahaya Utama</th>
                  <th className="p-4">SOP CENNA Safety Alert</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {HIGHRISK_DATA.map((hr, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="p-4 font-bold text-red-600 font-mono">🔴 {hr.drug}</td>
                    <td className="p-4 text-[#1e2a4a]">{hr.drug_class}</td>
                    <td className="p-4 text-slate-700">{hr.risk}</td>
                    <td className="p-4 text-slate-600 font-medium italic">{hr.protocol}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Formulary Modal */}
      {modalOpen && (
        <div id="drug-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-[620px] max-h-[90vh] overflow-y-auto shadow-2xl relative animate-scale-in">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="font-bold text-[#1e2a4a] text-base">
                {formId ? 'Edit Data Obat' : 'Tambah Obat Baru'}
              </h3>
              <button
                id="btn-close-drug-modal"
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 border-none flex items-center justify-center cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-400/10 border border-red-500/20 text-red-600 rounded-xl text-xs font-semibold">
                  {errorMsg}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                    Nama Generik <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="drug-form-generic"
                    type="text"
                    required
                    value={formGeneric}
                    onChange={(e) => setFormGeneric(e.target.value)}
                    placeholder="mis. Amoxicillin"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1e2a4a]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                    Nama Merek Dagang
                  </label>
                  <input
                    id="drug-form-brand"
                    type="text"
                    value={formBrand}
                    onChange={(e) => setFormBrand(e.target.value)}
                    placeholder="mis. Panadol, Sanmol"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1e2a4a]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                    Kelas Terapi
                  </label>
                  <select
                    id="drug-form-class"
                    value={formClass}
                    onChange={(e) => setFormClass(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none text-slate-800"
                  >
                    <option value="Antibiotik">Antibiotik</option>
                    <option value="Analgetik">Analgetik</option>
                    <option value="Antihipertensi">Antihipertensi</option>
                    <option value="Antidiabetik">Antidiabetik</option>
                    <option value="Antikoagulan">Antikoagulan</option>
                    <option value="Gastrointestinal">Gastrointestinal</option>
                    <option value="Kardiovaskular">Kardiovaskular</option>
                    <option value="Pernapasan">Pernapasan</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                    Bentuk Sediaan
                  </label>
                  <input
                    id="drug-form-form"
                    type="text"
                    value={formForm}
                    onChange={(e) => setFormForm(e.target.value)}
                    placeholder="Tablet, Kapsul, Injeksi"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1e2a4a]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                    Dosis Dewasa
                  </label>
                  <input
                    id="drug-form-dose-adult"
                    type="text"
                    value={formDoseAdult}
                    onChange={(e) => setFormDoseAdult(e.target.value)}
                    placeholder="500mg 3x sehari"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1e2a4a]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                    Dosis Anak-anak
                  </label>
                  <input
                    id="drug-form-dose-child"
                    type="text"
                    value={formDoseChild}
                    onChange={(e) => setFormDoseChild(e.target.value)}
                    placeholder="10-15 mg/kgBB"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1e2a4a]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                    FDA Kategori Ibu Hamil
                  </label>
                  <select
                    id="drug-form-preg"
                    value={formPreg}
                    onChange={(e) => setFormPreg(e.target.value as any)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none text-slate-800"
                  >
                    <option value="A">A — Terbukti Aman</option>
                    <option value="B">B — Relatif Aman (Studi Binatang)</option>
                    <option value="C">C — Efek samping terbukti, Hati-hati</option>
                    <option value="D">D — Positif Risiko Mayor, Terpaksa</option>
                    <option value="X">X — KONTRAINDIKASI MUTLAK</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                    Tingkat Risiko
                  </label>
                  <select
                    id="drug-form-risk"
                    value={formRisk}
                    onChange={(e) => setFormRisk(e.target.value as any)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none text-slate-800"
                  >
                    <option value="low">Low Risk</option>
                    <option value="moderate">Moderate</option>
                    <option value="high">High-Risk (High Alert)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                  Indikasi Pengobatan
                </label>
                <input
                  id="drug-form-indication"
                  type="text"
                  value={formIndication}
                  onChange={(e) => setFormIndication(e.target.value)}
                  placeholder="Infeksi saluran pernapasan atas, kemih"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1e2a4a]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                  Kontraindikasi Utama
                </label>
                <input
                  id="drug-form-contra"
                  type="text"
                  value={formContra}
                  onChange={(e) => setFormContra(e.target.value)}
                  placeholder="Alergi keluarga penisilin, asidosis ginjal"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1e2a4a]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                  Catatan Tambahan untuk AI
                </label>
                <textarea
                  id="drug-form-notes"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Dosis ginjal, kombinasi penambah, efek lambung..."
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none h-14 resize-vertical animate-fade-in"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                <button
                  id="btn-drug-form-cancel"
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 bg-transparent hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  id="btn-drug-form-submit"
                  type="submit"
                  className="px-5 py-2.5 bg-[#1e2a4a] hover:bg-[#2d3f6b] rounded-xl text-xs font-bold text-white border-none cursor-pointer"
                >
                  💾 Simpan Obat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

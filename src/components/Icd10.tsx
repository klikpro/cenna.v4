/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { IcdCode } from '../types';

interface Icd10Props {
  icdCodes: IcdCode[];
  onSaveIcd: (code: IcdCode) => void;
  onDeleteIcd: (id: string) => void;
  onImportCodes: (codes: IcdCode[]) => void;
}

const CHAPTERS_LIST = [
  { val: '', label: 'Semua' },
  { val: 'I', label: 'I (Infeksi)' },
  { val: 'IV', label: 'IV (Endokrin)' },
  { val: 'VI', label: 'VI (Saraf)' },
  { val: 'IX', label: 'IX (Sirkulasi)' },
  { val: 'X', label: 'X (Pernapasan)' },
  { val: 'XI', label: 'XI (Pencernaan)' },
  { val: 'XIV', label: 'XIV (Genitourinari)' },
];

export default function Icd10({ icdCodes, onSaveIcd, onDeleteIcd, onImportCodes }: Icd10Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [chapterFilter, setChapterFilter] = useState('');

  // Form states (Add/Edit right layout)
  const [formId, setFormId] = useState<string | null>(null);
  const [formCode, setFormCode] = useState('');
  const [formNameId, setFormNameId] = useState('');
  const [formNameLat, setFormNameLat] = useState('');
  const [formChapter, setFormChapter] = useState('X');
  const [formNotes, setFormNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const filteredCodes = icdCodes.filter((d) => {
    const matchesSearch =
      d.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.name_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.name_lat || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesChapter = !chapterFilter || d.chapter === chapterFilter;
    return matchesSearch && matchesChapter;
  });

  const totalPages = Math.ceil(filteredCodes.length / itemsPerPage);
  const displayedCodes = filteredCodes.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSelectRow = (c: IcdCode) => {
    setFormId(c.id);
    setFormCode(c.code);
    setFormNameId(c.name_id);
    setFormNameLat(c.name_lat || '');
    setFormChapter(c.chapter);
    setFormNotes(c.notes || '');
    setErrorMsg(null);
  };

  const handleCancelEdit = () => {
    setFormId(null);
    setFormCode('');
    setFormNameId('');
    setFormNameLat('');
    setFormChapter('X');
    setFormNotes('');
    setErrorMsg(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCode.trim()) {
      setErrorMsg('Kode ICD-10 wajib diisi.');
      return;
    }
    if (!formNameId.trim()) {
      setErrorMsg('Nama Indonesia wajib diisi.');
      return;
    }

    const payload: IcdCode = {
      id: formId || 'icd_' + Date.now(),
      code: formCode.trim().toUpperCase(),
      name_id: formNameId.trim(),
      name_lat: formNameLat.trim() || undefined,
      chapter: formChapter,
      notes: formNotes.trim() || undefined,
      freq: formId ? icdCodes.find((x) => x.id === formId)?.freq || 0 : 0,
      custom: true,
    };

    onSaveIcd(payload);
    handleCancelEdit();
  };

  // CSV Import file parser — BUG-14 FIX: parser yang lebih robust
  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;

      // BUG-14 FIX: Tangani CRLF (Windows) dan LF (Unix)
      const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim().length > 0);
      const parsed: IcdCode[] = [];

      /**
       * BUG-14 FIX: Parser CSV yang menangani field bertanda kutip mengandung koma.
       * Contoh: `J06.9,"Infeksi, akut",Acute infection,X`
       */
      function parseCSVLine(line: string): string[] {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
            else { inQuotes = !inQuotes; }
          } else if (ch === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += ch;
          }
        }
        result.push(current.trim());
        return result;
      }

      // Validasi format kode ICD-10: huruf kapital diikuti angka (A00–Z99)
      const icdCodeRegex = /^[A-Z]\d{2}(\.\d{0,4})?$/;

      // Skip baris header (baris pertama)
      for (let i = 1; i < lines.length; i++) {
        const parts = parseCSVLine(lines[i]);
        const rawCode = (parts[0] || '').toUpperCase().replace(/"/g, '').trim();
        const nameId  = (parts[1] || '').replace(/"/g, '').trim();

        if (!rawCode || !nameId) continue;

        // BUG-14 FIX: Validasi format kode ICD-10
        if (!icdCodeRegex.test(rawCode)) {
          console.warn(`[ICD Import] Kode tidak valid, baris ${i + 1}: "${rawCode}" — dilewati.`);
          continue;
        }

        parsed.push({
          // BUG-10 FIX: Gunakan index + timestamp untuk ID unik, hindari collision
          id: `icd_csv_${Date.now()}_${i}`,
          code: rawCode,
          name_id: nameId,
          name_lat: (parts[2] || '').replace(/"/g, '').trim() || undefined,
          chapter:  (parts[3] || '').replace(/"/g, '').trim() || 'XVIII',
          freq: 0,
          custom: true,
        });
      }

      if (parsed.length > 0) {
        onImportCodes(parsed);
        // BUG-10 FIX: Reset ke halaman 1 setelah import agar data baru terlihat
        setCurrentPage(1);
        alert(`Berhasil mengimpor ${parsed.length} kode ICD-10.${lines.length - 1 - parsed.length > 0 ? ` (${lines.length - 1 - parsed.length} baris dilewati karena format tidak valid)` : ''}`);
      } else {
        alert('Tidak ada kode valid yang dapat diimpor. Periksa format file CSV Anda.');
      }
    };
    reader.readAsText(file, 'UTF-8');
    // Reset input agar file yang sama bisa dipilih ulang
    e.target.value = '';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Chapter shortcuts Pills bar */}
      <div className="flex flex-wrap gap-2 pb-2">
        {CHAPTERS_LIST.map((ch) => (
          <button
            key={ch.val}
            id={`btn-chapter-${ch.val || 'all'}`}
            onClick={() => {
              setChapterFilter(ch.val);
              setCurrentPage(1);
            }}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold border border-[#1e2a4a]/12 cursor-pointer transition ${
              chapterFilter === ch.val ? 'bg-[#1e2a4a] text-white border-transparent' : 'bg-white text-slate-500 hover:text-slate-800'
            }`}
          >
            {ch.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left 2 cols: list database */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex gap-3">
            <div className="flex-1 bg-white border border-[#1e2a4a]/12 rounded-xl px-4 py-2 flex items-center gap-2">
              <span className="text-slate-400">🔍</span>
              <input
                id="icd-search-input"
                type="text"
                placeholder="Cari kode (mis. J06.9) atau nama penyakit..."
                value={searchQuery}
                aria-label="Cari kode ICD-10"
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-transparent text-xs outline-none text-slate-800 placeholder-slate-400 font-sans"
              />
            </div>
          </div>

          <div className="bg-white border border-[#1e2a4a]/12 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-[#1e2a4a]/12 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-sm text-[#1e2a4a]">Sistem Kode ICD-10 Jaminan BPJS</h3>
              <span className="text-xs font-semibold text-[#1e2a4a]/50 font-mono">
                {filteredCodes.length} diagnosis
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-[#1e2a4a]/12 text-[#1e2a4a]/45 font-bold uppercase">
                    <th className="p-4">Kode ICD-10</th>
                    <th className="p-4">Nama Indonesia</th>
                    <th className="p-4">Nama Latin / Inggris</th>
                    <th className="p-4 text-center">Chapter</th>
                    <th className="p-4 text-center">Frekuensi</th>
                    <th className="p-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {displayedCodes.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => handleSelectRow(c)}
                      className={`hover:bg-slate-50/50 cursor-pointer transition ${
                        formId === c.id ? 'bg-[#ede6d6]/40' : ''
                      }`}
                    >
                      <td className="p-4">
                        <span className="font-mono bg-[#1e2a4a]/6 text-[#1e2a4a] px-2 py-1 rounded font-bold">
                          {c.code}
                        </span>
                      </td>
                      <td className="p-4 font-semibold text-slate-800 max-w-[150px] truncate" title={c.name_id}>
                        {c.name_id}
                      </td>
                      <td className="p-4 text-slate-500 max-w-[150px] truncate" title={c.name_lat}>
                        {c.name_lat || '—'}
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-bold uppercase">
                          Bab {c.chapter}
                        </span>
                      </td>
                      <td className="p-4 text-center font-bold text-slate-800 font-mono">{c.freq}</td>
                      <td className="p-4 text-center">
                        <button
                          id={`btn-delete-icd-${c.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteIcd(c.id);
                          }}
                          className="w-7 h-7 rounded bg-red-400/10 hover:bg-red-400/20 text-red-600 border-none cursor-pointer flex items-center justify-center text-xs"
                        >
                          🗑
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination panel */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-gray-100 flex items-center justify-between">
                <div className="flex gap-2">
                  <button
                    id="btn-icd-page-prev"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                    className="px-3 py-1.5 rounded-lg border border-[#1e2a4a]/12 text-slate-500 hover:text-[#1e2a4a] text-xs font-bold disabled:opacity-40 cursor-pointer"
                  >
                    Prev
                  </button>
                  <button
                    id="btn-icd-page-next"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(currentPage + 1)}
                    className="px-3 py-1.5 rounded-lg border border-[#1e2a4a]/12 text-slate-500 hover:text-[#1e2a4a] text-xs font-bold disabled:opacity-40 cursor-pointer"
                  >
                    Next
                  </button>
                </div>
                <span className="text-[11px] font-semibold text-slate-500 font-mono">
                  Hal {currentPage} / {totalPages}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right 1 col: Add/Edit custom and import panel */}
        <div className="space-y-6">
          <div className="bg-white border border-[#1e2a4a]/12 rounded-2xl shadow-sm overflow-hidden p-5">
            <h3 className="font-bold text-sm text-[#1e2a4a] mb-1">
              {formId ? '📋 Persunting Kode ICD-10' : '＋ Tambah Diagnosis Baru'}
            </h3>
            <p className="text-[11px] text-[#1e2a4a]/45 mb-4">Input kode manual jika rujukan lokal diperlukan</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-400/10 border border-red-500/20 text-red-600 rounded-xl text-xs font-semibold">
                  {errorMsg}
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                  Kode Diagnosis (ICD-10)
                </label>
                <input
                  id="icd-form-code"
                  type="text"
                  required
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  placeholder="mis. J06.9"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1e2a4a] font-mono uppercase"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                  Nama Penyakit (Bahasa)
                </label>
                <input
                  id="icd-form-name-id"
                  type="text"
                  required
                  value={formNameId}
                  onChange={(e) => setFormNameId(e.target.value)}
                  placeholder="Flu / Infeksi pernapasan akut"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1e2a4a]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                  Nama Latin / Internasional
                </label>
                <input
                  id="icd-form-name-lat"
                  type="text"
                  value={formNameLat}
                  onChange={(e) => setFormNameLat(e.target.value)}
                  placeholder="Acute upper respiratory infection"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1e2a4a]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                  Chapter / Bab Penyakit
                </label>
                <select
                  id="icd-form-chapter"
                  value={formChapter}
                  onChange={(e) => setFormChapter(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none text-slate-800"
                >
                  <option value="I">I — Infeksi & Parasit</option>
                  <option value="IV">IV — Endokrin & Metabolik</option>
                  <option value="VI">VI — Sistem Saraf</option>
                  <option value="IX">IX — Sistem Sirkulasi</option>
                  <option value="X">X — Sistem Pernapasan</option>
                  <option value="XI">XI — Sistem Pencernaan</option>
                  <option value="XIV">XIV — Sistem Genitourinari</option>
                  <option value="XVIII">XVIII — Gejala & Tanda Klinis</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                  Keterangan Klinis Khusus
                </label>
                <textarea
                  id="icd-form-notes"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Tambahkan gejala khas, rujukan, atau diagnosis..."
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none h-16 resize-vertical"
                />
              </div>

              <div className="flex gap-2">
                <button
                  id="btn-icd-form-submit"
                  type="submit"
                  className="flex-1 py-3 bg-[#1e2a4a] hover:bg-[#2d3f6b] text-white text-xs font-bold rounded-xl border-none cursor-pointer"
                >
                  💾 Save Code
                </button>
                {formId && (
                  <button
                    id="btn-icd-form-cancel"
                    type="button"
                    onClick={handleCancelEdit}
                    className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border-none cursor-pointer"
                  >
                    Batal
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="bg-white border border-[#1e2a4a]/12 rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-sm text-[#1e2a4a] mb-2">📥 Impor Massal ICD-10</h3>
            <p className="text-[10px] text-slate-500 leading-relaxed mb-4">
              Upload file CSV kustomisasi regional Anda. Format kolom: <code className="font-mono text-[9px] bg-gray-100 p-1">code, name_id, name_lat, chapter</code>
            </p>
            <div className="border border-dashed border-slate-300 rounded-xl p-4 text-center cursor-pointer hover:border-slate-500 relative">
              <span className="text-2xl block mb-1">📄</span>
              <span className="text-xs font-semibold text-[#1e2a4a]">Pilih File CSV</span>
              <input
                id="file-icd-csv-importer"
                type="file"
                accept=".csv"
                onChange={handleCSVImport}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

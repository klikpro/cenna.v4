/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Doctor } from '../types';

interface DoctorsProps {
  doctors: Doctor[];
  onSaveDoctor: (doctor: Doctor) => void;
  onDeleteDoctor: (id: string) => void;
}

const SPEC_LIST = [
  'Umum', 'Penyakit Dalam', 'Anak', 'Kandungan', 'Bedah', 'Jantung', 'Saraf', 'THT', 'Mata', 'Kulit', 'Psikiatri'
];

export default function Doctors({ doctors, onSaveDoctor, onDeleteDoctor }: DoctorsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [specFilter, setSpecFilter] = useState('');

  // Modals state
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form state
  const [formId, setFormId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formStr, setFormStr] = useState('');
  const [formSpec, setFormSpec] = useState('Umum');
  const [formClinic, setFormClinic] = useState('');
  const [formStatus, setFormStatus] = useState<'active' | 'trial' | 'inactive' | 'suspended'>('active');
  const [formAiProfile, setFormAiProfile] = useState<'specialist' | 'gp' | 'emergency' | 'pediatric'>('gp');
  const [formNotes, setFormNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const filteredDoctors = doctors.filter((d) => {
    const matchesSearch =
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.specialization && d.specialization.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = !statusFilter || d.status === statusFilter;
    const matchesSpec = !specFilter || d.specialization === specFilter;

    return matchesSearch && matchesStatus && matchesSpec;
  });

  const handleOpenAdd = () => {
    setFormId(null);
    setFormName('');
    setFormEmail('');
    setFormPhone('');
    setFormStr('');
    setFormSpec('Umum');
    setFormClinic('');
    setFormStatus('active');
    setFormAiProfile('gp');
    setFormNotes('');
    setErrorMsg(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (doc: Doctor) => {
    setFormId(doc.id);
    setFormName(doc.name);
    setFormEmail(doc.email);
    setFormPhone(doc.phone || '');
    setFormStr(doc.str || '');
    setFormSpec(doc.specialization);
    setFormClinic(doc.clinic || '');
    setFormStatus(doc.status);
    setFormAiProfile(doc.ai_profile);
    setFormNotes(doc.notes || '');
    setErrorMsg(null);
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setErrorMsg('Nama lengkap wajib diisi.');
      return;
    }
    // BUG-09 FIX: Validasi email menggunakan regex standar, bukan hanya includes('@')
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!formEmail.trim() || !emailRegex.test(formEmail.trim())) {
      setErrorMsg('Masukkan alamat email yang valid (contoh: dokter@rumahsakit.id).');
      return;
    }

    const payload: Doctor = {
      id: formId || 'doc_' + Date.now(),
      name: formName.trim(),
      email: formEmail.trim(),
      phone: formPhone.trim(),
      str: formStr.trim(),
      specialization: formSpec,
      clinic: formClinic.trim(),
      status: formStatus,
      ai_profile: formAiProfile,
      soap_month: formId ? doctors.find((x) => x.id === formId)?.soap_month || 0 : 0,
      notes: formNotes.trim(),
      created_at: formId
        ? doctors.find((x) => x.id === formId)?.created_at
        : new Date().toISOString(),
    };

    onSaveDoctor(payload);
    setModalOpen(false);
  };

  const handleDeleteConfirm = () => {
    if (deleteId) {
      onDeleteDoctor(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Stat row inside Doctors Cockpit */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white border border-[#1e2a4a]/12 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#1e2a4a]/8 flex items-center justify-center text-lg">👨‍⚕️</div>
          <div>
            <div className="text-xl font-bold font-mono text-[#1e2a4a]">{doctors.length}</div>
            <div className="text-[11px] text-[#1e2a4a]/50">Total Terdaftar</div>
          </div>
        </div>
        <div className="bg-white border border-[#1e2a4a]/12 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/8 flex items-center justify-center text-lg text-emerald-600">✅</div>
          <div>
            <div className="text-xl font-bold font-mono text-emerald-600">{doctors.filter((d) => d.status === 'active').length}</div>
            <div className="text-[11px] text-[#1e2a4a]/50">Status Aktif</div>
          </div>
        </div>
        <div className="bg-white border border-[#1e2a4a]/12 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/8 flex items-center justify-center text-lg text-amber-600">⏳</div>
          <div>
            <div className="text-xl font-bold font-mono text-amber-600">{doctors.filter((d) => d.status === 'trial').length}</div>
            <div className="text-[11px] text-[#1e2a4a]/50">Status Percobaan (Trial)</div>
          </div>
        </div>
      </div>

      {/* Toolbar filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="flex-1 bg-white border border-[#1e2a4a]/12 rounded-xl px-4 py-2 flex items-center gap-2">
          <span className="text-slate-400">🔍</span>
          <input
            id="doctor-search-input"
            type="text"
            placeholder="Cari dokter, email, atau spesialisasi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs outline-none text-slate-800 placeholder-slate-400 font-sans"
          />
        </div>

        <select
          id="doctor-filter-status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-white border border-[#1e2a4a]/12 rounded-xl text-xs px-4 py-3 outline-none text-slate-700 cursor-pointer"
        >
          <option value="">Semua Status</option>
          <option value="active">Aktif</option>
          <option value="trial">Trial</option>
          <option value="inactive">Nonaktif</option>
          <option value="suspended">Suspend</option>
        </select>

        <select
          id="doctor-filter-spec"
          value={specFilter}
          onChange={(e) => setSpecFilter(e.target.value)}
          className="bg-white border border-[#1e2a4a]/12 rounded-xl text-xs px-4 py-3 outline-none text-slate-700 cursor-pointer"
        >
          <option value="">Semua Bidang</option>
          {SPEC_LIST.map((spec) => (
            <option key={spec} value={spec}>
              {spec}
            </option>
          ))}
        </select>

        <button
          id="btn-add-doctor"
          onClick={handleOpenAdd}
          className="px-5 py-3 bg-[#1e2a4a] hover:bg-[#2d3f6b] border-none rounded-xl text-xs font-bold text-white shadow-md transition cursor-pointer"
        >
          ＋ Tambah Dokter
        </button>
      </div>

      {/* Doctors Board Table */}
      <div className="bg-white border border-[#1e2a4a]/12 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-[#1e2a4a]/12 flex justify-between items-center bg-slate-50/50">
          <div>
            <h3 className="font-bold text-sm text-[#1e2a4a]">Daftar Praktisi Medis</h3>
            <p className="text-[11px] text-[#1e2a4a]/45">Kelola identitas, surat STR, dan integrasi modul asisten klinis</p>
          </div>
          <span className="text-xs font-semibold text-[#1e2a4a]/50 font-mono">
            {filteredDoctors.length} Dokter
          </span>
        </div>

        {filteredDoctors.length === 0 ? (
          <div className="p-20 text-center text-[#1e2a4a]/40 bg-white">
            <p className="text-4xl mb-4">👨‍⚕️</p>
            <h4 className="font-bold text-[#1e2a4a] text-sm mb-1">Tidak ada dokter ditemukan</h4>
            <p className="text-xs">Coba sesuaikan kata kunci pencarian atau bersihkan filter filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-[#1e2a4a]/12 text-[#1e2a4a]/45 font-bold uppercase tracking-wider">
                  <th className="p-4 font-bold">Nama Dokter</th>
                  <th className="p-4 font-bold">Spesialisasi</th>
                  <th className="p-4 font-bold">Klinik Terkait</th>
                  <th className="p-4 font-bold">Hubungan / Status</th>
                  <th className="p-4 font-bold">AI Companion</th>
                  <th className="p-4 font-bold">No STR</th>
                  <th className="p-4 text-center font-bold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredDoctors.map((d) => {
                  const initials = d.name.replace(/^dr\.\s*/i, '').split(' ').map((w) => w[0]).join('').substring(0, 2).toUpperCase();
                  return (
                    <tr key={d.id} className="hover:bg-slate-50/50">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#1e2a4a] to-[#3d5494] flex items-center justify-center font-bold text-white text-[13px]">
                            {initials}
                          </div>
                          <div>
                            <div className="font-bold text-[#1e2a4a]">{d.name}</div>
                            <div className="text-[11px] text-[#1e2a4a]/50">{d.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 bg-[#1e2a4a]/6 text-[#1e2a4a] rounded-lg font-semibold text-[10px]">
                          {d.specialization}
                        </span>
                      </td>
                      <td className="p-4 text-slate-600">{d.clinic || '—'}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                          d.status === 'active' ? 'bg-emerald-500/10 text-[#10b981]' :
                          d.status === 'trial' ? 'bg-amber-500/10 text-amber-600' :
                          d.status === 'inactive' ? 'bg-gray-100 text-gray-500' : 'bg-red-500/15 text-red-600'
                        }`}>
                          {d.status === 'active' ? '● Aktif' : d.status === 'trial' ? '⏳ Trial' : d.status === 'inactive' ? '◯ Nonaktif' : '⊘ Suspend'}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="uppercase text-[10px] font-bold text-slate-500 font-mono">
                          {d.ai_profile}
                        </span>
                      </td>
                      <td className="p-4 text-slate-500 font-mono text-[11px]">{d.str || '—'}</td>
                      <td className="p-4">
                        <div className="flex justify-center gap-2">
                          <button
                            id={`btn-edit-doctor-${d.id}`}
                            onClick={() => handleOpenEdit(d)}
                            title="Edit"
                            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 border-none cursor-pointer flex items-center justify-center text-xs"
                          >
                            ✏️
                          </button>
                          <button
                            id={`btn-delete-doctor-${d.id}`}
                            onClick={() => setDeleteId(d.id)}
                            title="Hapus"
                            className="w-8 h-8 rounded-lg bg-red-500/8 hover:bg-red-500/15 border-none cursor-pointer flex items-center justify-center text-xs text-red-600"
                          >
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Adding / Editing Modal */}
      {modalOpen && (
        <div id="doctor-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-[580px] max-h-[90vh] overflow-y-auto shadow-2xl relative animate-scale-in">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="font-bold text-[#1e2a4a] text-base">
                {formId ? 'Edit Data Praktisi' : 'Tambah Dokter Baru'}
              </h3>
              <button
                id="btn-close-doctor-modal"
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
                    Nama Lengkap Dokter
                  </label>
                  <input
                    id="doctor-form-name"
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="dr. Ahmad Fauzi, Sp.PD"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1e2a4a]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                    Alamat Email
                  </label>
                  <input
                    id="doctor-form-email"
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="ahmad@klinikusehat.id"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1e2a4a]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                    Nomor Telepon
                  </label>
                  <input
                    id="doctor-form-phone"
                    type="tel"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="08123456789"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1e2a4a]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                    Nomor STR Medis
                  </label>
                  <input
                    id="doctor-form-str"
                    type="text"
                    value={formStr}
                    onChange={(e) => setFormStr(e.target.value)}
                    placeholder="1234-5678-9012"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1e2a4a]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                    Spesialisasi
                  </label>
                  <select
                    id="doctor-form-spec"
                    value={formSpec}
                    onChange={(e) => setFormSpec(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none text-slate-800"
                  >
                    {SPEC_LIST.map((spec) => (
                      <option key={spec} value={spec}>
                        {spec}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                    Rumah Sakit / Klinik
                  </label>
                  <input
                    id="doctor-form-clinic"
                    type="text"
                    value={formClinic}
                    onChange={(e) => setFormClinic(e.target.value)}
                    placeholder="Klinik Sehat Mandiri"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#1e2a4a]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                    Status Akses RME
                  </label>
                  <select
                    id="doctor-form-status"
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none text-slate-800"
                  >
                    <option value="active">Aktif</option>
                    <option value="trial">Trial</option>
                    <option value="inactive">Nonaktif</option>
                    <option value="suspended">Suspend</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                    Modul AI Companion
                  </label>
                  <select
                    id="doctor-form-profile"
                    value={formAiProfile}
                    onChange={(e) => setFormAiProfile(e.target.value as any)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none text-slate-800"
                  >
                    <option value="gp">Dokter Umum</option>
                    <option value="specialist">Spesialis Konsultan</option>
                    <option value="emergency">UGD & Kritis</option>
                    <option value="pediatric">Pediatri (Anak)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1e2a4a]">
                  Catatan Keterangan
                </label>
                <textarea
                  id="doctor-form-notes"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Masukkan keterangan tambahan jika ada..."
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none h-16 resize-vertical"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                <button
                  id="btn-doctor-cancel-form"
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 bg-transparent hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  id="btn-doctor-submit-form"
                  type="submit"
                  className="px-5 py-2.5 bg-[#1e2a4a] hover:bg-[#2d3f6b] rounded-xl text-xs font-bold text-white border-none cursor-pointer"
                >
                  Simpan Dokter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Box */}
      {deleteId && (
        <div id="delete-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 text-center max-w-[380px] w-full shadow-2xl animate-scale-in">
            <span className="text-4xl block mb-3">⚠️</span>
            <h4 className="font-bold text-[#1e2a4a] text-md mb-2">Hapus Praktisi Medis?</h4>
            <p className="text-xs text-[#1e2a4a]/50 leading-relaxed mb-6">
              Tindakan ini akan menghapus akun dokter ini secara permanen dari pangkalan data. Aktivitas logs tidak akan diubah.
            </p>
            <div className="flex justify-center gap-3">
              <button
                id="btn-confirm-delete-doctor-cancel"
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-600 cursor-pointer"
              >
                Batal
              </button>
              <button
                id="btn-confirm-delete-doctor-ok"
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg border-none text-xs font-bold cursor-pointer"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

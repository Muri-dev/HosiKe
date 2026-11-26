import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { Bed, LogOut, Edit2, User, RefreshCw, AlertTriangle, Plus, ChevronDown, ChevronRight, Pill, Phone, UserPlus } from 'lucide-react';
import Toast from '../../components/common/Toast';
import Modal from '../../components/common/Modal';

const fmt = (d) => d ? new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

function durationDays(admittedAt) {
    if (!admittedAt) return null;
    const days = Math.floor((Date.now() - new Date(admittedAt)) / 86400000);
    return days === 0 ? 'Today' : `${days}d`;
}

const AdminAdmissions = () => {
    const [admissions, setAdmissions] = useState([]);
    const [details, setDetails] = useState({}); // id -> detailed data
    const [expandedRows, setExpandedRows] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [toast, setToast] = useState(null);

    // Edit modal
    const [selectedAdm, setSelectedAdm] = useState(null);
    const [formData, setFormData] = useState({ ward: '', bed_number: '' });

    // Admit modal
    const [showAdmit, setShowAdmit] = useState(false);
    const [admitData, setAdmitData] = useState({ patient_id: '', ward: 'General', bed_number: '', doctor_id: '', nurse_id: '', notes: '' });
    const [patients, setPatients] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [nurses, setNurses] = useState([]);
    const [admitting, setAdmitting] = useState(false);

    const fetchAdmissions = async () => {
        setLoading(true);
        try {
            const res = await api.get('/admissions/?status=admitted');
            setAdmissions(res.data);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const fetchOptions = async () => {
        try {
            const [pRes, dRes, nRes] = await Promise.all([
                api.get('/admin/users/?role=patient'),
                api.get('/admin/users/?role=doctor'),
                api.get('/admin/users/?role=nurse')
            ]);
            setPatients(pRes.data);
            setDoctors(dRes.data);
            setNurses(nRes.data);
        } catch (error) {
            console.error("Failed to load user options", error);
        }
    };

    useEffect(() => { fetchAdmissions(); }, []);

    const toggleRow = async (id) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
            setExpandedRows(newExpanded);
        } else {
            newExpanded.add(id);
            setExpandedRows(newExpanded);
            if (!details[id]) {
                try {
                    const res = await api.get(`/admin/admissions/${id}/detail/`);
                    setDetails(prev => ({ ...prev, [id]: res.data }));
                } catch (e) {
                    setToast({ message: 'Failed to load details', type: 'error' });
                }
            }
        }
    };

    const handleDischarge = async (id, patientName) => {
        if (!window.confirm(`Discharge ${patientName}?`)) return;
        try {
            await api.patch(`/admissions/${id}/`, { status: 'discharged' });
            setToast({ message: `${patientName} discharged successfully`, type: 'success' });
            fetchAdmissions();
        } catch (e) {
            const msg = e.response?.data?.detail || 'Discharge failed';
            setToast({ message: msg, type: 'error' });
        }
    };

    const handleEdit = (adm) => {
        setSelectedAdm(adm);
        setFormData({ ward: adm.ward, bed_number: adm.bed_number });
    };

    const saveEdit = async () => {
        try {
            await api.patch(`/admin/admissions/${selectedAdm.id}/detail/`, formData);
            setToast({ message: 'Admission updated', type: 'success' });
            setSelectedAdm(null);
            fetchAdmissions();
            // Refresh details if expanded
            if (expandedRows.has(selectedAdm.id)) {
                const res = await api.get(`/admin/admissions/${selectedAdm.id}/detail/`);
                setDetails(prev => ({ ...prev, [selectedAdm.id]: res.data }));
            }
        } catch (e) { setToast({ message: 'Update failed', type: 'error' }); }
    };

    const openAdmitModal = () => {
        if (patients.length === 0) fetchOptions();
        setShowAdmit(true);
    };

    const handleAdmit = async (e) => {
        e.preventDefault();
        setAdmitting(true);
        try {
            await api.post('/admin/admit/', admitData);
            setToast({ message: 'Patient admitted successfully', type: 'success' });
            setShowAdmit(false);
            setAdmitData({ patient_id: '', ward: 'General', bed_number: '', doctor_id: '', nurse_id: '', notes: '' });
            fetchAdmissions();
        } catch (err) {
            setToast({ message: err.response?.data?.detail || 'Failed to admit patient', type: 'error' });
        }
        setAdmitting(false);
    };

    const filtered = admissions.filter(a => {
        if (!search) return true;
        const s = search.toLowerCase();
        return (
            (a.patient_name || '').toLowerCase().includes(s) ||
            (a.ward || '').toLowerCase().includes(s) ||
            String(a.bed_number || '').includes(s)
        );
    });

    return (
        <div className="fade-in">
            {/* Header */}
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <Bed size={22} color="#6366f1" /> Current Admissions
                    </h1>
                    <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.875rem' }}>
                        All currently admitted inpatients — organised by ward
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <span style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 999, padding: '0.3rem 1rem', fontWeight: 700, fontSize: '0.85rem' }}>
                        🏥 {admissions.length} Admitted
                    </span>
                    <button onClick={openAdmitModal} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                        <Plus size={16} /> Admit Patient
                    </button>
                    <button onClick={fetchAdmissions} style={{ padding: '0.55rem 0.8rem', borderRadius: 8, background: '#f1f5f9', border: '1px solid #e2e8f0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                        <RefreshCw size={14} />
                    </button>
                </div>
            </header>

            {/* Search */}
            <div style={{ marginBottom: '1.25rem' }}>
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="🔍 Filter by patient name, ward or bed…"
                    style={{ width: 300, padding: '0.55rem 0.9rem', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.9rem', outline: 'none' }}
                />
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>Loading admissions…</div>
            ) : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem', background: '#f8fafc', borderRadius: 14, border: '2px dashed #e2e8f0' }}>
                    <Bed size={40} color="#cbd5e1" />
                    <p style={{ color: '#94a3b8', marginTop: '0.75rem' }}>No admitted patients found.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {filtered.map(adm => {
                        const days = durationDays(adm.admitted_at);
                        const isLong = (days && typeof days === 'string' && parseInt(days) >= 7);
                        const isExpanded = expandedRows.has(adm.id);
                        const det = details[adm.id]; // detailed data if loaded

                        return (
                            <div key={adm.id} style={{ background: '#fff', borderRadius: 12, border: `1px solid ${isLong ? '#fed7aa' : (isExpanded ? '#bfdbfe' : '#e2e8f0')}`, boxShadow: isExpanded ? '0 4px 12px rgba(59,130,246,0.1)' : '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden', transition: 'all 0.2s' }}>
                                {/* Main Row (Clickable) */}
                                <div 
                                    onClick={() => toggleRow(adm.id)}
                                    style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto auto auto auto', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', cursor: 'pointer', background: isExpanded ? '#f8fafc' : '#fff' }}
                                >
                                    <div style={{ color: '#94a3b8' }}>
                                        {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <User size={18} color="#fff" />
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '0.98rem', color: '#1e293b' }}>{adm.patient_name || '—'}</div>
                                            <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.1rem' }}>
                                                {adm.doctor_name ? `Dr. ${adm.doctor_name}` : 'No doctor'}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ward / Bed</div>
                                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>
                                            {adm.ward} / <span style={{ color: '#6366f1' }}>{adm.bed_number || '—'}</span>
                                        </div>
                                    </div>

                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Admitted</div>
                                        <div style={{ fontSize: '0.87rem', fontWeight: 600, color: '#475569' }}>{fmt(adm.admitted_at)}</div>
                                    </div>

                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Duration</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', justifyContent: 'center' }}>
                                            {isLong && <AlertTriangle size={13} color="#f59e0b" />}
                                            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: isLong ? '#d97706' : '#22c55e' }}>{days}</span>
                                        </div>
                                    </div>

                                    <span style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 999, padding: '0.2rem 0.7rem', fontSize: '0.75rem', fontWeight: 700 }}>🏥 Admitted</span>

                                    <div style={{ display: 'flex', gap: '0.5rem' }} onClick={e => e.stopPropagation()}>
                                        <button title="Edit ward/bed" onClick={() => handleEdit(adm)} style={{ padding: '0.4rem 0.75rem', borderRadius: 7, background: '#eff6ff', color: '#2563eb', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.82rem', fontWeight: 600 }}>
                                            <Edit2 size={14} /> Edit
                                        </button>
                                        <button title="Discharge patient" onClick={() => handleDischarge(adm.id, adm.patient_name)} style={{ padding: '0.4rem 0.75rem', borderRadius: 7, background: '#fef2f2', color: '#dc2626', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.82rem', fontWeight: 600 }}>
                                            <LogOut size={14} /> Discharge
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded Detail Panel */}
                                {isExpanded && (
                                    <div style={{ borderTop: '1px solid #e2e8f0', background: '#f8fafc', padding: '1.25rem' }}>
                                        {!det ? <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Loading details…</div> : (
                                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 1fr) minmax(250px, 1fr) 2fr', gap: '1.5rem' }}>
                                                {/* Patient & NOK */}
                                                <div>
                                                    <h4 style={{ margin: '0 0 0.75rem', color: '#334155', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Patient Info</h4>
                                                    <div style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.6 }}>
                                                        <div><strong>Name:</strong> {det.patient_full_name}</div>
                                                        <div><strong>Phone:</strong> {det.patient_phone || '—'}</div>
                                                        <div><strong>Gender:</strong> {det.patient_gender || '—'}</div>
                                                        <div><strong>Blood:</strong> {det.patient_blood_group || '—'}</div>
                                                    </div>
                                                    
                                                    <h4 style={{ margin: '1rem 0 0.5rem', color: '#334155', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Next of Kin</h4>
                                                    <div style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.6, background: '#fff', padding: '0.5rem 0.75rem', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                                        {det.nok_name ? (
                                                            <>
                                                                <div style={{ fontWeight: 600, color: '#1e293b' }}>{det.nok_name} <span style={{ color: '#94a3b8', fontWeight: 400 }}>({det.nok_relationship || 'Relation unspec.'})</span></div>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.2rem' }}><Phone size={12} /> {det.nok_phone || 'No phone'}</div>
                                                            </>
                                                        ) : <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Not provided</span>}
                                                    </div>
                                                </div>

                                                {/* Allocation & Notes */}
                                                <div>
                                                    <h4 style={{ margin: '0 0 0.75rem', color: '#334155', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Allocation</h4>
                                                    <div style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <div style={{ padding: '0.3rem', background: '#dbeafe', borderRadius: 6, color: '#2563eb' }}><UserPlus size={14} /></div>
                                                            <div>
                                                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Doctor</div>
                                                                <div style={{ fontWeight: 600, color: '#1e293b' }}>{det.doctor_name ? `Dr. ${det.doctor_name}` : 'Unassigned'}</div>
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <div style={{ padding: '0.3rem', background: '#fce7f3', borderRadius: 6, color: '#db2777' }}><UserPlus size={14} /></div>
                                                            <div>
                                                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Nurse</div>
                                                                <div style={{ fontWeight: 600, color: '#1e293b' }}>{det.nurse_name || 'Unassigned'}</div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {det.notes && (
                                                        <div style={{ marginTop: '1rem', padding: '0.6rem 0.8rem', background: '#fffbeb', borderLeft: '3px solid #f59e0b', fontSize: '0.8rem', color: '#92400e', borderRadius: '0 6px 6px 0' }}>
                                                            <strong>Notes:</strong> {det.notes}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Medications */}
                                                <div>
                                                    <h4 style={{ margin: '0 0 0.75rem', color: '#334155', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                        <Pill size={14} /> Active Medications
                                                    </h4>
                                                    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                                        {det.medications?.length === 0 ? (
                                                            <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.8rem', color: '#94a3b8' }}>No active prescriptions.</div>
                                                        ) : (
                                                            <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                                                                <thead>
                                                                    <tr style={{ background: '#f1f5f9', textAlign: 'left', color: '#64748b' }}>
                                                                        <th style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>Medicine</th>
                                                                        <th style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>Dose & Freq</th>
                                                                        <th style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>Administered</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {det.medications?.map(m => (
                                                                        <tr key={m.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                                                                            <td style={{ padding: '0.5rem 0.75rem', fontWeight: 500, color: '#1e293b' }}>{m.medicine_name}</td>
                                                                            <td style={{ padding: '0.5rem 0.75rem', color: '#475569' }}>{m.dosage} · {m.frequency}</td>
                                                                            <td style={{ padding: '0.5rem 0.75rem' }}>
                                                                                {m.administered ? <span style={{ color: '#16a34a', fontWeight: 600 }}>Yes</span> : <span style={{ color: '#94a3b8' }}>No</span>}
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Admit Modal */}
            <Modal isOpen={showAdmit} onClose={() => setShowAdmit(false)} title="Admit New Patient">
                <form onSubmit={handleAdmit}>
                    <div className="form-group">
                        <label>Patient *</label>
                        <select className="form-control" required value={admitData.patient_id} onChange={e => setAdmitData({...admitData, patient_id: e.target.value})}>
                            <option value="">Select a patient</option>
                            {patients.map(p => (
                                <option key={p.id} value={p.id}>{p.first_name} {p.last_name} ({p.username})</option>
                            ))}
                        </select>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group">
                            <label>Ward *</label>
                            <select className="form-control" required value={admitData.ward} onChange={e => setAdmitData({...admitData, ward: e.target.value})}>
                                {['General', 'Emergency', 'ICU', 'Maternity', 'Paediatric', 'Surgical', 'Medical'].map(w => (
                                    <option key={w} value={w}>{w} Ward</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Bed Number</label>
                            <input className="form-control" placeholder="e.g. A-12" value={admitData.bed_number} onChange={e => setAdmitData({...admitData, bed_number: e.target.value})} />
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group">
                            <label>Assigned Doctor (Op.)</label>
                            <select className="form-control" value={admitData.doctor_id} onChange={e => setAdmitData({...admitData, doctor_id: e.target.value})}>
                                <option value="">None</option>
                                {doctors.map(d => (
                                    <option key={d.id} value={d.id}>Dr. {d.last_name || d.username} {d.is_on_duty ? '🟢 On Duty' : ''}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Assigned Nurse (Op.)</label>
                            <select className="form-control" value={admitData.nurse_id} onChange={e => setAdmitData({...admitData, nurse_id: e.target.value})}>
                                <option value="">None</option>
                                {nurses.map(n => (
                                    <option key={n.id} value={n.id}>{n.first_name || n.username} {n.is_on_duty ? '🟢 On Duty' : ''}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Admission Notes</label>
                        <textarea className="form-control" rows="3" placeholder="Condition details, immediate needs..." value={admitData.notes} onChange={e => setAdmitData({...admitData, notes: e.target.value})}></textarea>
                    </div>
                    <button type="submit" className="btn-primary full-width" disabled={admitting}>
                        {admitting ? 'Admitting...' : 'Admit Patient'}
                    </button>
                </form>
            </Modal>

            {/* Edit Modal */}
            <Modal isOpen={!!selectedAdm} onClose={() => setSelectedAdm(null)} title={`Edit — ${selectedAdm?.patient_name}`}>
                <div className="form-group">
                    <label>Ward</label>
                    <select className="form-control" value={formData.ward} onChange={e => setFormData({ ...formData, ward: e.target.value })}>
                        {['General', 'ICU', 'Emergency', 'Maternity', 'Paediatric', 'Surgical', 'Medical'].map(w => (
                            <option key={w} value={w}>{w} Ward</option>
                        ))}
                    </select>
                </div>
                <div className="form-group">
                    <label>Bed Number</label>
                    <input className="form-control" value={formData.bed_number} onChange={e => setFormData({ ...formData, bed_number: e.target.value })} placeholder="e.g. B-14" />
                </div>
                <button className="btn-primary full-width" onClick={saveEdit}>Save Changes</button>
            </Modal>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

export default AdminAdmissions;

import React, { useEffect, useState, useCallback } from 'react';
import api from '../../api/axios';
import { Wifi, Search, RefreshCw, Activity, User, Phone, Droplet, Stethoscope, Clock, Plus, ChevronDown, ChevronRight, MessageSquare, UserPlus } from 'lucide-react';
import Toast from '../../components/common/Toast';
import Modal from '../../components/common/Modal';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtShortDate = (d) => d ? new Date(d).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const StatusDot = ({ status }) => {
    const color = status === 'pending' ? '#f59e0b' : status === 'reviewed' ? '#22c55e' : '#94a3b8';
    return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color, marginRight: 5 }} />;
};

const AdminRemotePatients = () => {
    const [monitorings, setMonitorings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [expanded, setExpanded] = useState(null);
    const [toast, setToast] = useState(null);

    // Enroll Modal
    const [showEnroll, setShowEnroll] = useState(false);
    const [enrollData, setEnrollData] = useState({ patient: '', assigned_doctor: '', notes: '' });
    const [patients, setPatients] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [enrolling, setEnrolling] = useState(false);

    const [showNewPatient, setShowNewPatient] = useState(false);
    const [newPatient, setNewPatient] = useState({ username:'', email:'', first_name:'', last_name:'', password:'', phone:'', address:'' });
    const [creating, setCreating] = useState(false);

    const fetchMonitorings = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/remote-monitoring/');
            setMonitorings(res.data);
        } catch (e) { console.error(e); }
        setLoading(false);
    }, []);

    const fetchOptions = async () => {
        try {
            const [pRes, dRes] = await Promise.all([
                api.get('/admin/users/?role=patient'),
                api.get('/admin/users/?role=doctor')
            ]);
            setPatients(pRes.data);
            setDoctors(dRes.data);
        } catch (error) {
            console.error("Failed to load user options", error);
        }
    };

    useEffect(() => { fetchMonitorings(); }, [fetchMonitorings]);

    const handleSearch = (e) => {
        e.preventDefault();
        // Just local filter since we load all active monitoring
    };

    const filtered = monitorings.filter(m => {
        if (!query) return true;
        const q = query.toLowerCase();
        return (m.patient_full_name || '').toLowerCase().includes(q) || (m.patient_username || '').toLowerCase().includes(q);
    });

    const openEnrollModal = () => {
        if (patients.length === 0) fetchOptions();
        setShowEnroll(true);
    };

    const handleEnroll = async (e) => {
        e.preventDefault();
        setEnrolling(true);
        try {
            await api.post('/admin/remote-monitoring/', enrollData);
            setToast({ message: 'Patient enrolled in remote monitoring', type: 'success' });
            setShowEnroll(false);
            setEnrollData({ patient: '', assigned_doctor: '', notes: '' });
            fetchMonitorings();
        } catch (err) {
            setToast({ message: err.response?.data?.detail || 'Failed to enroll patient', type: 'error' });
        }
        setEnrolling(false);
    };

    const handleCreatePatient = async (e) => {
        e.preventDefault();
        setCreating(true);
        try {
            await api.post('/admin/users/', { ...newPatient, role: 'patient' });
            setToast({ message: 'Patient created successfully', type: 'success' });
            setShowNewPatient(false);
            setNewPatient({ username:'', email:'', first_name:'', last_name:'', password:'', phone:'', address:'' });
            fetchOptions(); // Refresh dropdown
        } catch (err) {
            setToast({ message: err.response?.data?.detail || 'Failed to create patient', type: 'error' });
        }
        setCreating(false);
    };

    const handleDischarge = async (id, patientName) => {
        if (!window.confirm(`Discharge ${patientName} from remote monitoring?`)) return;
        try {
            await api.delete(`/admin/remote-monitoring/${id}/`);
            setToast({ message: `${patientName} removed from active monitoring`, type: 'success' });
            fetchMonitorings();
        } catch (e) { setToast({ message: 'Discharge failed', type: 'error' }); }
    };

    return (
        <div className="fade-in">
            {/* Header */}
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <Wifi size={22} color="#6366f1" /> Remote Monitoring
                    </h1>
                    <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.875rem' }}>
                        Manage patients enrolled in continuous remote active monitoring
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Search by name…"
                            style={{ padding: '0.5rem 0.9rem', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.9rem', width: 220 }}
                        />
                        <button type="submit" style={{ padding: '0.5rem 0.9rem', borderRadius: 8, background: '#6366f1', color: '#fff', border: 'none', cursor: 'pointer' }}>
                            <Search size={16} />
                        </button>
                    </form>
                    <button onClick={() => setShowNewPatient(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#e0e7ff', color: '#4338ca', border: 'none', padding: '0.5rem 0.9rem', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                        <UserPlus size={16} /> New Patient
                    </button>
                    <button onClick={openEnrollModal} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Plus size={16} /> Enroll Patient
                    </button>
                    <button onClick={fetchMonitorings} style={{ padding: '0.5rem 0.8rem', borderRadius: 8, background: '#f1f5f9', border: '1px solid #e2e8f0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <RefreshCw size={15} /> Refresh
                    </button>
                </div>
            </header>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>Loading…</div>
            ) : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem', background: '#f8fafc', borderRadius: 14, border: '2px dashed #e2e8f0' }}>
                    <Wifi size={40} color="#cbd5e1" />
                    <p style={{ color: '#94a3b8', marginTop: '0.75rem' }}>No patients are currently enrolled in remote monitoring.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {filtered.map(m => {
                        const isOpen = expanded === m.id;
                        const lastVital = m.latest_vitals?.[0];

                        return (
                            <div key={m.id} style={{ background: '#fff', borderRadius: 12, border: `1px solid ${isOpen ? '#bfdbfe' : '#e2e8f0'}`, boxShadow: isOpen ? '0 4px 12px rgba(59,130,246,0.1)' : '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden', transition: 'all 0.2s' }}>
                                {/* Row */}
                                <div
                                    onClick={() => setExpanded(isOpen ? null : m.id)}
                                    style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto auto auto', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', cursor: 'pointer', background: isOpen ? '#f8fafc' : '#fff' }}
                                >
                                    <div style={{ color: '#94a3b8' }}>
                                        {isOpen ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <User size={18} color="#fff" />
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '0.98rem', color: '#1e293b' }}>{m.patient_full_name}</div>
                                            <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.1rem' }}>
                                                {m.doctor_name ? `Dr. ${m.doctor_name}` : 'No assigned doctor'}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Enrolled</div>
                                        <div style={{ fontSize: '0.87rem', fontWeight: 600, color: '#475569' }}>{fmtShortDate(m.enrolled_at)}</div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center' }}>
                                        <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <Clock size={13} />
                                            {lastVital ? fmtShortDate(lastVital.created_at) : 'No vitals'}
                                            {lastVital?.status && <StatusDot status={lastVital.status} />}
                                        </div>
                                    </div>

                                    <span style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', borderRadius: 999, padding: '0.2rem 0.7rem', fontSize: '0.75rem', fontWeight: 700 }}>Active</span>

                                    <button onClick={(e) => { e.stopPropagation(); handleDischarge(m.id, m.patient_full_name); }} style={{ padding: '0.4rem 0.75rem', borderRadius: 7, background: '#fef2f2', color: '#dc2626', border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
                                        Discharge
                                    </button>
                                </div>

                                {/* Expanded detail */}
                                {isOpen && (
                                    <div style={{ borderTop: '1px solid #e2e8f0', background: '#f8fafc', padding: '1.25rem' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 1fr) 2.5fr', gap: '1.5rem' }}>
                                            {/* Patient Overview */}
                                            <div>
                                                <h4 style={{ margin: '0 0 0.75rem', color: '#334155', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Patient Info</h4>
                                                <div style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.6, background: '#fff', padding: '0.75rem', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Phone size={14} /> {m.patient_phone || '—'}</div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.4rem' }}><User size={14} /> {m.patient_email || '—'}</div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.4rem' }}><Droplet size={14} /> Blood: <strong>{m.patient_blood_group || '—'}</strong></div>
                                                    <div style={{ marginTop: '0.8rem', paddingTop: '0.8rem', borderTop: '1px solid #e2e8f0' }}>
                                                        <strong style={{ display: 'block', color: '#334155', marginBottom: '0.3rem' }}>Location</strong>
                                                        {m.patient_address || 'Not provided'}
                                                    </div>
                                                    <div style={{ marginTop: '0.6rem' }}>
                                                        <strong style={{ display: 'block', color: '#334155', marginBottom: '0.3rem' }}>Next of Kin</strong>
                                                        {m.nok_name ? (
                                                            <>
                                                                <div>{m.nok_name} <span style={{ color: '#94a3b8' }}>({m.nok_relationship || 'Relation unspec.'})</span></div>
                                                                <div><Phone size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} /> {m.nok_phone || 'No phone'}</div>
                                                            </>
                                                        ) : <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Not provided</span>}
                                                    </div>
                                                </div>

                                                <h4 style={{ margin: '1rem 0 0.5rem', color: '#334155', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Enrollment</h4>
                                                <div style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.6, background: '#fff', padding: '0.75rem', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                                    <div><strong>Enrolled By:</strong> {m.enrolled_by_name}</div>
                                                    <div><strong>Enrolled At:</strong> {fmtShortDate(m.enrolled_at)}</div>
                                                    {m.notes && <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#f8fafc', borderRadius: 6, fontSize: '0.8rem', fontStyle: 'italic' }}>{m.notes}</div>}
                                                </div>
                                            </div>

                                            {/* Vitals Timeline & Feedback */}
                                            <div>
                                                <h4 style={{ margin: '0 0 0.75rem', color: '#334155', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                    <Activity size={14} /> Submitted Vitals Timeline
                                                </h4>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                    {m.latest_vitals?.length === 0 ? (
                                                        <div style={{ padding: '2rem', textAlign: 'center', background: '#fff', borderRadius: 8, border: '1px dashed #cbd5e1', color: '#94a3b8', fontSize: '0.9rem' }}>
                                                            No vitals have been submitted by the patient yet.
                                                        </div>
                                                    ) : m.latest_vitals?.map(vital => (
                                                        <div key={vital.id} style={{ background: '#fff', borderRadius: 8, border: `1px solid ${vital.status === 'pending' ? '#fde68a' : '#e2e8f0'}`, borderLeft: `4px solid ${vital.status === 'pending' ? '#f59e0b' : '#10b981'}` }}>
                                                            <div style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
                                                                <div style={{ fontWeight: 600, color: '#334155', fontSize: '0.9rem' }}>{fmtDate(vital.created_at)}</div>
                                                                <StatusDot status={vital.status} />
                                                            </div>
                                                            <div style={{ padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem' }}>
                                                                <div>
                                                                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>BP (mmHg)</div>
                                                                    <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '1.05rem' }}>{vital.blood_pressure || '—'}</div>
                                                                </div>
                                                                <div>
                                                                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Heart Rate</div>
                                                                    <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '1.05rem' }}>{vital.heart_rate ? `${vital.heart_rate} bpm` : '—'}</div>
                                                                </div>
                                                                <div>
                                                                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Temp</div>
                                                                    <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '1.05rem' }}>{vital.temperature ? `${vital.temperature} °C` : '—'}</div>
                                                                </div>
                                                                <div>
                                                                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Weight</div>
                                                                    <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '1.05rem' }}>{vital.weight ? `${vital.weight} kg` : '—'}</div>
                                                                </div>
                                                            </div>
                                                            {vital.symptoms && (
                                                                <div style={{ padding: '0 1rem 1rem', fontSize: '0.85rem' }}>
                                                                    <strong style={{ color: '#475569' }}>Symptoms:</strong> <span style={{ color: '#ef4444' }}>{vital.symptoms}</span>
                                                                </div>
                                                            )}
                                                            
                                                            {/* Feedback Section */}
                                                            <div style={{ padding: '0.75rem 1rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderBottomRightRadius: 8, borderBottomLeftRadius: 8 }}>
                                                                {vital.doctor_feedback ? (
                                                                    <div style={{ display: 'flex', gap: '0.6rem', color: '#0f766e' }}>
                                                                        <MessageSquare size={16} style={{ marginTop: 2, flexShrink: 0 }} />
                                                                        <div>
                                                                            <div style={{ fontWeight: 600, fontSize: '0.8rem', marginBottom: '0.2rem' }}>Feedback sent on {fmtDate(vital.feedback_date)}:</div>
                                                                            <div style={{ fontSize: '0.85rem' }}>"{vital.doctor_feedback}"</div>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic' }}>
                                                                        Pending doctor review
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Enroll Modal */}
            <Modal isOpen={showEnroll} onClose={() => setShowEnroll(false)} title="Enroll Patient in Remote Monitoring">
                <form onSubmit={handleEnroll}>
                    <div className="form-group">
                        <label>Patient *</label>
                        <select className="form-control" required value={enrollData.patient} onChange={e => setEnrollData({...enrollData, patient: e.target.value})}>
                            <option value="">Select a patient</option>
                            {patients.map(p => (
                                <option key={p.id} value={p.id}>{p.first_name} {p.last_name} ({p.username})</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Assigned Doctor (Optional)</label>
                        <select className="form-control" value={enrollData.assigned_doctor} onChange={e => setEnrollData({...enrollData, assigned_doctor: e.target.value})}>
                            <option value="">None</option>
                            {doctors.map(d => (
                                <option key={d.id} value={d.id}>Dr. {d.last_name || d.username}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Monitoring Notes</label>
                        <textarea className="form-control" rows="3" placeholder="Identify conditions to monitor closely..." value={enrollData.notes} onChange={e => setEnrollData({...enrollData, notes: e.target.value})}></textarea>
                    </div>
                    <button type="submit" className="btn-primary full-width" disabled={enrolling}>
                        {enrolling ? 'Enrolling...' : 'Enroll Patient'}
                    </button>
                </form>
            </Modal>

            {/* New Patient Modal */}
            <Modal isOpen={showNewPatient} onClose={() => setShowNewPatient(false)} title="Register New Patient">
                <form onSubmit={handleCreatePatient}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group">
                            <label>First Name</label>
                            <input className="form-control" required value={newPatient.first_name} onChange={e => setNewPatient({...newPatient, first_name: e.target.value})} />
                        </div>
                        <div className="form-group">
                            <label>Last Name</label>
                            <input className="form-control" required value={newPatient.last_name} onChange={e => setNewPatient({...newPatient, last_name: e.target.value})} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Username *</label>
                        <input className="form-control" required value={newPatient.username} onChange={e => setNewPatient({...newPatient, username: e.target.value})} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group">
                            <label>Email</label>
                            <input type="email" className="form-control" value={newPatient.email} onChange={e => setNewPatient({...newPatient, email: e.target.value})} />
                        </div>
                        <div className="form-group">
                            <label>Phone</label>
                            <input className="form-control" value={newPatient.phone} onChange={e => setNewPatient({...newPatient, phone: e.target.value})} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Address / Location</label>
                        <input className="form-control" value={newPatient.address} onChange={e => setNewPatient({...newPatient, address: e.target.value})} />
                    </div>
                    <div className="form-group">
                        <label>Password *</label>
                        <input type="password" required className="form-control" value={newPatient.password} onChange={e => setNewPatient({...newPatient, password: e.target.value})} />
                    </div>
                    <button type="submit" className="btn-primary full-width" disabled={creating}>
                        {creating ? 'Registering...' : 'Register Patient'}
                    </button>
                </form>
            </Modal>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

export default AdminRemotePatients;

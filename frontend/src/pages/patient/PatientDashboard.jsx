import React, { useEffect, useState, useCallback } from 'react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import {
    User, Calendar, Activity, Pill, Clock, MessageSquare,
    AlertCircle, Edit2, Plus, X, ChevronDown, ChevronUp, Bed,
    Heart, Droplet, Thermometer, Scale,
} from 'lucide-react';
import Modal from '../../components/common/Modal';
import Toast from '../../components/common/Toast';
import ErrorBanner from '../../components/common/ErrorBanner';
import PatientProfileEditModal from './PatientProfileEditModal';
import MessagingPage from '../messaging/MessagingPage';

// ── helpers ────────────────────────────────────────────────────────────────
const fmt = (d) => d ? new Date(d).toLocaleString('en-KE') : '—';
const fmtD = (d) => d ? new Date(d).toLocaleDateString('en-KE') : '—';
const age = (dob) => {
    if (!dob) return '—';
    const diff = Date.now() - new Date(dob).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
};

const STATUS_COLORS = {
    pending: '#f59e0b', pending_approval: '#f59e0b', approved: '#3b82f6',
    in_progress: '#8b5cf6', completed: '#10b981', cancelled: '#ef4444',
    rejected: '#ef4444', admitted: '#3b82f6', discharged: '#94a3b8',
    active: '#10b981', discontinued: '#ef4444',
};
const Badge = ({ label, color }) => (
    <span style={{
        display: 'inline-block', padding: '0.2rem 0.65rem', borderRadius: 999,
        fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.02em',
        background: (color || STATUS_COLORS[label?.toLowerCase()] || '#64748b') + '1a',
        color: color || STATUS_COLORS[label?.toLowerCase()] || '#64748b',
        border: `1px solid ${(color || STATUS_COLORS[label?.toLowerCase()] || '#64748b')}40`,
    }}>
        {label}
    </span>
);

const Card = ({ children, style = {} }) => (
    <div className="card" style={{ borderRadius: 14, padding: '1.25rem 1.5rem', marginBottom: '1.25rem', ...style }}>
        {children}
    </div>
);

const SectionTitle = ({ icon: Icon, children }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        {Icon && <Icon size={16} color="var(--primary-color)" />}
        <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#1e293b' }}>{children}</h4>
    </div>
);

const Skeleton = ({ rows = 4 }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        {Array.from({ length: rows }).map((_, i) => (
            <div key={i} style={{ height: 18, borderRadius: 6, background: 'linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
        ))}
        <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
    </div>
);

const Empty = ({ icon: Icon = Clock, message }) => (
    <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#94a3b8' }}>
        <Icon size={36} style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
        <p style={{ margin: 0, fontSize: '0.9rem' }}>{message}</p>
    </div>
);

// ── TABS ──────────────────────────────────────────────────────────────────────
const TABS = [
    { id: 'summary', label: 'Summary', icon: User },
    { id: 'appointments', label: 'Appointments', icon: Calendar },
    { id: 'vitals', label: 'Vitals', icon: Activity },
    { id: 'prescriptions', label: 'Prescriptions', icon: Pill },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'history', label: 'History', icon: Clock },
];

// ═════════════════════════════════════════════════════════════════════════════
export default function PatientDashboard() {
    const { user: authUser } = useAuth();

    const [activeTab, setActiveTab] = useState('summary');
    const [profile, setProfile] = useState(null);
    const [admission, setAdmission] = useState(undefined); // undefined=loading, null=none
    const [appointments, setAppointments] = useState([]);
    const [vitals, setVitals] = useState([]);
    const [scripts, setScripts] = useState([]);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [toast, setToast] = useState(null);

    // Book appointment
    const [showBook, setShowBook] = useState(false);
    const [bookData, setBookData] = useState({ date: '', time: '', reason: '' });
    const [booking, setBooking] = useState(false);

    // Cancel appointment
    const [cancelAppt, setCancelAppt] = useState(null);
    const [cancelReason, setCancelReason] = useState('');

    // History expand
    const [expandedVisit, setExpandedVisit] = useState(null);

    // Profile edit
    const [showEdit, setShowEdit] = useState(false);

    // Self-reported vitals
    const [showLogVitals, setShowLogVitals] = useState(false);
    const [vitalsForm, setVitalsForm] = useState({ temperature: '', blood_pressure: '', heart_rate: '', weight: '', symptoms: '' });
    const [loggingVitals, setLoggingVitals] = useState(false);

    // ── data fetch ──────────────────────────────────────────────────────────
    const fetchAll = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [pRes, admRes, apptRes, vRes, rxRes, hRes] = await Promise.allSettled([
                api.get('/patient/me/'),
                api.get('/patient/admission/'),
                api.get('/appointments/mine/'),
                api.get('/patient/vitals/mine/'),
                api.get('/patient/prescriptions/mine/'),
                api.get('/patient/history/'),
            ]);
            if (pRes.status === 'fulfilled') setProfile(pRes.value.data);
            if (admRes.status === 'fulfilled') setAdmission(admRes.value.data);   // null or object
            if (apptRes.status === 'fulfilled') setAppointments(apptRes.value.data);
            if (vRes.status === 'fulfilled') setVitals(vRes.value.data);
            if (rxRes.status === 'fulfilled') setScripts(rxRes.value.data);
            if (hRes.status === 'fulfilled') setHistory(hRes.value.data);
        } catch {
            setError('Failed to load your health records. Please refresh.');
        }
        setLoading(false);
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const showToast = (msg, type = 'success') => {
        setToast({ message: msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    // ── Book appointment ────────────────────────────────────────────────────
    const handleBook = async (e) => {
        e.preventDefault();
        setBooking(true);
        try {
            await api.post('/appointments/book/', {
                date_time: `${bookData.date}T${bookData.time}:00`,
                reason: bookData.reason,
            });
            showToast('Appointment booked successfully!');
            setShowBook(false);
            setBookData({ date: '', time: '', reason: '' });
            fetchAll();
        } catch (err) {
            showToast(err.response?.data?.detail || 'Failed to book appointment.', 'error');
        } finally {
            setBooking(false);
        }
    };

    // ── Cancel appointment ──────────────────────────────────────────────────
    const handleCancel = async () => {
        try {
            await api.patch(`/appointments/${cancelAppt.id}/cancel/`, { reason: cancelReason });
            showToast('Appointment cancelled.');
            setCancelAppt(null);
            setCancelReason('');
            fetchAll();
        } catch (err) {
            showToast(err.response?.data?.detail || 'Could not cancel.', 'error');
        }
    };

    // ── Log self-reported vitals ──────────────────────────────────────────────
    const handleLogVitals = async (e) => {
        e.preventDefault();
        if (!vitalsForm.temperature && !vitalsForm.blood_pressure && !vitalsForm.heart_rate && !vitalsForm.weight && !vitalsForm.symptoms) {
            showToast('Please fill in at least one field.', 'error');
            return;
        }
        setLoggingVitals(true);
        try {
            const payload = {};
            if (vitalsForm.temperature) payload.temperature = parseFloat(vitalsForm.temperature);
            if (vitalsForm.blood_pressure) payload.blood_pressure = vitalsForm.blood_pressure;
            if (vitalsForm.heart_rate) payload.heart_rate = parseInt(vitalsForm.heart_rate);
            if (vitalsForm.weight) payload.weight = parseFloat(vitalsForm.weight);
            if (vitalsForm.symptoms) payload.symptoms = vitalsForm.symptoms;
            await api.post('/patient/vitals/mine/', payload);
            showToast('Vitals submitted! Your doctor will review them shortly.');
            setVitalsForm({ temperature: '', blood_pressure: '', heart_rate: '', weight: '', symptoms: '' });
            setShowLogVitals(false);
            fetchAll();
        } catch (err) {
            showToast(err.response?.data?.detail || 'Failed to submit vitals.', 'error');
        } finally {
            setLoggingVitals(false);
        }
    };

    // ── derived ─────────────────────────────────────────────────────────────
    const upcoming = appointments.filter(a => ['pending', 'pending_approval', 'approved', 'in_progress'].includes(a.status));
    const latest = vitals[0] || null;
    const activeRx = scripts.filter(s => s.items?.some(i => i.status === 'active'));

    // ── Patient status badge ─────────────────────────────────────────────────
    const patientStatus = admission ? 'Admitted' : 'Active';

    // ══════════ RENDER ══════════════════════════════════════════════════════

    const inputSt = {
        width: '100%', boxSizing: 'border-box', padding: '0.6rem 0.75rem',
        border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.9rem',
    };
    const btnPrimary = {
        padding: '0.55rem 1.25rem', borderRadius: 8, background: 'var(--primary-color)',
        color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
        display: 'flex', alignItems: 'center', gap: '0.4rem',
    };
    const btnSecondary = {
        padding: '0.55rem 1.1rem', borderRadius: 8, background: '#fff',
        color: '#475569', border: '1px solid #e2e8f0', cursor: 'pointer', fontWeight: 600,
    };

    return (
        <div style={{ fontFamily: 'inherit' }}>

            {/* ── HEADER ─────────────────────────────────────────────── */}
            <div style={{
                background: 'linear-gradient(135deg,var(--primary-color),#1d4ed8)',
                borderRadius: 16, padding: '1.5rem 2rem', marginBottom: '1.5rem',
                color: '#fff', display: 'flex', alignItems: 'center', gap: '1.5rem',
                flexWrap: 'wrap',
            }}>
                {/* Avatar */}
                <div style={{
                    width: 72, height: 72, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.5)',
                    overflow: 'hidden', background: 'rgba(255,255,255,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                    {profile?.avatar
                        ? <img src={profile.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <User size={36} color="rgba(255,255,255,0.8)" />
                    }
                </div>

                {/* Identity */}
                <div style={{ flex: 1, minWidth: 200 }}>
                    {loading
                        ? <div style={{ height: 24, width: 180, borderRadius: 6, background: 'rgba(255,255,255,0.2)' }} />
                        : <>
                            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>
                                {profile ? `${profile.first_name} ${profile.last_name}` : authUser?.username}
                            </h2>
                            <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.35rem', flexWrap: 'wrap', opacity: 0.85, fontSize: '0.87rem' }}>
                                {profile?.date_of_birth && <span>Age: <strong>{age(profile.date_of_birth)}</strong></span>}
                                {profile?.gender && <span>Gender: <strong style={{ textTransform: 'capitalize' }}>{profile.gender}</strong></span>}
                                {profile?.blood_group && <span>Blood: <strong>{profile.blood_group}</strong></span>}
                                {profile?.contact_number && <span>📞 {profile.contact_number}</span>}
                            </div>
                        </>
                    }
                </div>

                {/* Status + actions */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.6rem' }}>
                    <Badge label={patientStatus} color={patientStatus === 'Admitted' ? '#3b82f6' : '#10b981'} />
                    <div style={{ display: 'flex', gap: '0.6rem' }}>
                        <button style={{ ...btnSecondary, background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.35)', fontSize: '0.82rem' }}
                            onClick={() => setShowEdit(true)}>
                            <Edit2 size={14} style={{ display: 'inline' }} /> Edit Profile
                        </button>
                        <button style={{ ...btnSecondary, background: '#fff', color: 'var(--primary-color)', border: 'none', fontSize: '0.82rem' }}
                            onClick={() => setShowBook(true)}>
                            <Plus size={14} style={{ display: 'inline' }} /> Book Appointment
                        </button>
                    </div>
                </div>
            </div>

            {error && <ErrorBanner message={error} onClose={() => setError('')} />}

            {/* ── TABS ────────────────────────────────────────────────── */}
            <div style={{
                display: 'flex', gap: 0, borderBottom: '2px solid #e2e8f0',
                marginBottom: '1.5rem', overflowX: 'auto',
            }}>
                {TABS.map(({ id, label, icon: Icon }) => (
                    <button key={id} onClick={() => setActiveTab(id)} style={{
                        padding: '0.65rem 1rem', border: 'none', background: 'none', cursor: 'pointer',
                        fontWeight: 600, fontSize: '0.87rem', color: activeTab === id ? 'var(--primary-color)' : '#64748b',
                        borderBottom: `2px solid ${activeTab === id ? 'var(--primary-color)' : 'transparent'}`,
                        marginBottom: -2, display: 'flex', alignItems: 'center', gap: '0.4rem',
                        whiteSpace: 'nowrap', transition: 'color 0.15s',
                    }}>
                        <Icon size={15} /> {label}
                    </button>
                ))}
            </div>

            {/* ══════════ SUMMARY ═════════════════════════════════════ */}
            {activeTab === 'summary' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>

                    {/* Next Appointment */}
                    <Card>
                        <SectionTitle icon={Calendar}>Next Appointment</SectionTitle>
                        {loading ? <Skeleton rows={3} /> : upcoming.length > 0 ? (
                            <div style={{ background: '#f8fafc', borderRadius: 10, padding: '0.9rem 1rem' }}>
                                <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.25rem' }}>{fmt(upcoming[0].date_time)}</div>
                                <div style={{ color: '#475569', fontSize: '0.88rem' }}>
                                    {upcoming[0].doctor_name ? `Dr. ${upcoming[0].doctor_name}` : 'Doctor not yet assigned'}
                                </div>
                                <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.15rem' }}>{upcoming[0].reason}</div>
                                <div style={{ marginTop: '0.5rem' }}><Badge label={upcoming[0].status} /></div>
                            </div>
                        ) : <Empty icon={Calendar} message="No upcoming appointments" />}
                    </Card>

                    {/* Admission Card */}
                    {admission && (
                        <Card style={{ borderLeft: '4px solid #3b82f6' }}>
                            <SectionTitle icon={Bed}>Current Admission</SectionTitle>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1rem', fontSize: '0.88rem' }}>
                                <div><span style={{ color: '#94a3b8' }}>Ward</span><br /><strong>{admission.ward}</strong></div>
                                <div><span style={{ color: '#94a3b8' }}>Bed</span><br /><strong>{admission.bed_number || '—'}</strong></div>
                                <div><span style={{ color: '#94a3b8' }}>Admitted</span><br /><strong>{fmtD(admission.admitted_at)}</strong></div>
                                <div><span style={{ color: '#94a3b8' }}>Doctor</span><br /><strong>{admission.doctor_name || '—'}</strong></div>
                            </div>
                        </Card>
                    )}

                    {/* Latest Vitals */}
                    <Card>
                        <SectionTitle icon={Activity}>Latest Vitals</SectionTitle>
                        {loading ? <Skeleton rows={3} /> : latest ? (
                            <div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                                    {[
                                        { icon: Thermometer, label: 'Temp', value: latest.temperature ? `${latest.temperature}°C` : '—' },
                                        { icon: Heart, label: 'BP', value: latest.blood_pressure || '—' },
                                        { icon: Activity, label: 'HR', value: latest.heart_rate ? `${latest.heart_rate} bpm` : '—' },
                                        { icon: Scale, label: 'Wt', value: latest.weight ? `${latest.weight} kg` : '—' },
                                    ].map(({ icon: I, label, value }) => (
                                        <div key={label} style={{ background: '#f8fafc', borderRadius: 10, padding: '0.65rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <I size={16} color="var(--primary-color)" />
                                            <div>
                                                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{label}</div>
                                                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{value}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#94a3b8' }}>
                                    Recorded {fmt(latest.created_at)}
                                    {latest.recorder_name && (
                                        <span style={{ marginLeft: '0.5rem' }}>
                                            · by <strong style={{ color: '#475569' }}>{latest.recorder_name}</strong>
                                            {latest.recorder_role && (
                                                <span style={{
                                                    marginLeft: '0.35rem', padding: '0.05rem 0.4rem',
                                                    borderRadius: 999, fontSize: '0.65rem',
                                                    background: latest.recorder_role === 'nurse' ? '#e0f2fe' : latest.recorder_role === 'doctor' ? '#ede9fe' : '#d1fae5',
                                                    color: latest.recorder_role === 'nurse' ? '#0ea5e9' : latest.recorder_role === 'doctor' ? '#7c3aed' : '#059669',
                                                    fontWeight: 700, textTransform: 'capitalize',
                                                }}>{latest.recorder_role}</span>
                                            )}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ) : <Empty icon={Activity} message="No vitals recorded yet" />}
                    </Card>

                    {/* Active Prescriptions */}
                    <Card>
                        <SectionTitle icon={Pill}>Active Prescriptions</SectionTitle>
                        {loading ? <Skeleton rows={3} /> : activeRx.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                {activeRx.slice(0, 3).map(rx => (
                                    <div key={rx.id} style={{ background: '#f8fafc', borderRadius: 10, padding: '0.65rem 0.9rem' }}>
                                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.25rem' }}>
                                            Dr. {rx.doctor_name} · {fmtD(rx.date_time)}
                                        </div>
                                        {rx.items.filter(i => i.status === 'active').slice(0, 2).map(item => (
                                            <div key={item.id} style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                                                💊 {item.medicine_name} — {item.dosage} · {item.frequency}
                                            </div>
                                        ))}
                                    </div>
                                ))}
                                {activeRx.length > 3 && <div style={{ fontSize: '0.82rem', color: '#64748b' }}>+{activeRx.length - 3} more… see Prescriptions tab</div>}
                            </div>
                        ) : <Empty icon={Pill} message="No active prescriptions" />}
                    </Card>
                </div>
            )}

            {/* ══════════ APPOINTMENTS ════════════════════════════════ */}
            {activeTab === 'appointments' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ margin: 0 }}>My Appointments</h3>
                        <button style={btnPrimary} onClick={() => setShowBook(true)}><Plus size={16} /> Book New</button>
                    </div>

                    {loading ? <Card><Skeleton /></Card> : appointments.length === 0
                        ? <Card><Empty icon={Calendar} message="No appointments yet. Book your first one!" /></Card>
                        : (
                            <Card style={{ padding: 0, overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                                    <thead>
                                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                            {['Date & Time', 'Doctor', 'Reason', 'Status', 'Actions'].map(h => (
                                                <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {appointments.map((a, i) => (
                                            <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 ? '#fafafe' : '#fff' }}>
                                                <td style={{ padding: '0.8rem 1rem', fontWeight: 600 }}>{fmt(a.date_time)}</td>
                                                <td style={{ padding: '0.8rem 1rem', color: '#475569' }}>{a.doctor_name ? `Dr. ${a.doctor_name}` : 'Pending'}</td>
                                                <td style={{ padding: '0.8rem 1rem', color: '#475569', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.reason}</td>
                                                <td style={{ padding: '0.8rem 1rem' }}><Badge label={a.status} /></td>
                                                <td style={{ padding: '0.8rem 1rem' }}>
                                                    {['pending', 'pending_approval', 'approved'].includes(a.status) && (
                                                        <button onClick={() => { setCancelAppt(a); setCancelReason(''); }}
                                                            style={{ ...btnSecondary, fontSize: '0.78rem', padding: '0.3rem 0.7rem', color: '#ef4444', borderColor: '#fecaca' }}>
                                                            Cancel
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </Card>
                        )
                    }
                </div>
            )}

            {/* ══════════ VITALS ══════════════════════════════════════ */}
            {activeTab === 'vitals' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ margin: 0 }}>My Vitals</h3>
                        <button style={btnPrimary} onClick={() => setShowLogVitals(v => !v)}>
                            <Activity size={15} /> {showLogVitals ? 'Hide Form' : 'Log My Vitals'}
                        </button>
                    </div>

                    {/* ── Self-reporting form ── */}
                    {showLogVitals && (
                        <Card style={{ border: '2px solid var(--primary-color)', marginBottom: '1.5rem' }}>
                            <SectionTitle icon={Activity}>Record Your Current Readings</SectionTitle>
                            <p style={{ margin: '-0.5rem 0 1rem', fontSize: '0.84rem', color: '#64748b' }}>
                                Your readings will be sent directly to your doctor for remote review. They'll advise whether you need to come in.
                            </p>
                            <form onSubmit={handleLogVitals}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.9rem', marginBottom: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem' }}>
                                            🌡 Temperature (°C)
                                        </label>
                                        <input type="number" step="0.1" min="30" max="45" style={inputSt}
                                            placeholder="e.g. 37.2"
                                            value={vitalsForm.temperature}
                                            onChange={e => setVitalsForm(f => ({ ...f, temperature: e.target.value }))} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem' }}>
                                            ❤️ Blood Pressure
                                        </label>
                                        <input type="text" style={inputSt}
                                            placeholder="e.g. 120/80"
                                            value={vitalsForm.blood_pressure}
                                            onChange={e => setVitalsForm(f => ({ ...f, blood_pressure: e.target.value }))} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem' }}>
                                            💓 Heart Rate (bpm)
                                        </label>
                                        <input type="number" min="30" max="250" style={inputSt}
                                            placeholder="e.g. 72"
                                            value={vitalsForm.heart_rate}
                                            onChange={e => setVitalsForm(f => ({ ...f, heart_rate: e.target.value }))} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem' }}>
                                            ⚖️ Weight (kg)
                                        </label>
                                        <input type="number" step="0.1" min="1" style={inputSt}
                                            placeholder="e.g. 68"
                                            value={vitalsForm.weight}
                                            onChange={e => setVitalsForm(f => ({ ...f, weight: e.target.value }))} />
                                    </div>
                                </div>
                                <div style={{ marginBottom: '1rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem' }}>
                                        Symptoms / How are you feeling?
                                    </label>
                                    <textarea rows={3} style={{ ...inputSt, resize: 'vertical' }}
                                        placeholder="Describe any symptoms, pain, discomfort, or anything unusual you are experiencing…"
                                        value={vitalsForm.symptoms}
                                        onChange={e => setVitalsForm(f => ({ ...f, symptoms: e.target.value }))} />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                                    <button type="button" style={btnSecondary} onClick={() => setShowLogVitals(false)}>Cancel</button>
                                    <button type="submit" disabled={loggingVitals} style={btnPrimary}>
                                        {loggingVitals ? 'Submitting…' : '📤 Submit to Doctor'}
                                    </button>
                                </div>
                            </form>
                        </Card>
                    )}

                    {/* ── Latest readings banner ── */}
                    {latest && !loading && (
                        <div style={{
                            display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: '0.75rem',
                            marginBottom: '1.25rem',
                        }}>
                            {[
                                { icon: Thermometer, label: 'Temperature', value: latest.temperature ? `${latest.temperature}°C` : '—', color: '#f59e0b' },
                                { icon: Heart, label: 'Blood Pressure', value: latest.blood_pressure || '—', color: '#ef4444' },
                                { icon: Activity, label: 'Heart Rate', value: latest.heart_rate ? `${latest.heart_rate} bpm` : '—', color: '#8b5cf6' },
                                { icon: Scale, label: 'Weight', value: latest.weight ? `${latest.weight} kg` : '—', color: '#10b981' },
                            ].map(({ icon: I, label, value, color }) => (
                                <div key={label} style={{ background: '#fff', border: `1px solid ${color}30`, borderRadius: 12, padding: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                                        <I size={16} color={color} /><span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{label}</span>
                                    </div>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1e293b' }}>{value}</div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ── History table with feedback ── */}
                    {loading ? <Card><Skeleton /></Card> : vitals.length === 0
                        ? <Card><Empty icon={Activity} message="No vitals recorded yet. Log your first reading above!" /></Card>
                        : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {vitals.map((v, i) => (
                                    <Card key={v.id} style={{ padding: '1rem 1.25rem', marginBottom: 0 }}>
                                        {/* Header row */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                            <div>
                                                <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{fmt(v.created_at)}</div>
                                                {/* Recorder attribution */}
                                                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                    🩺 Recorded by{' '}
                                                    <strong style={{ color: '#334155' }}>
                                                        {v.recorder_name || 'Unknown'}
                                                    </strong>
                                                    {v.recorder_role && (
                                                        <span style={{
                                                            padding: '0.05rem 0.45rem', borderRadius: 999,
                                                            fontSize: '0.65rem', fontWeight: 700,
                                                            textTransform: 'capitalize',
                                                            background: v.recorder_role === 'nurse' ? '#e0f2fe' : v.recorder_role === 'doctor' ? '#ede9fe' : v.recorder_role === 'patient' ? '#d1fae5' : '#f1f5f9',
                                                            color: v.recorder_role === 'nurse' ? '#0ea5e9' : v.recorder_role === 'doctor' ? '#7c3aed' : v.recorder_role === 'patient' ? '#059669' : '#475569',
                                                        }}>{v.recorder_role}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                <Badge
                                                    label={v.recorder_role === 'patient' || !v.recorder_name ? 'Self-Reported' : 'Clinical'}
                                                    color={v.recorder_role === 'patient' || !v.recorder_name ? '#0d9488' : '#3b82f6'}
                                                />
                                                <Badge label={v.status} />
                                            </div>
                                        </div>
                                        {/* Readings */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.5rem', marginBottom: v.symptoms || v.doctor_feedback ? '0.75rem' : 0 }}>
                                            {v.temperature && <div style={{ background: '#fff7ed', borderRadius: 8, padding: '0.4rem 0.65rem', fontSize: '0.85rem' }}>🌡 <strong>{v.temperature}°C</strong></div>}
                                            {v.blood_pressure && <div style={{ background: '#fef2f2', borderRadius: 8, padding: '0.4rem 0.65rem', fontSize: '0.85rem' }}>❤️ <strong>{v.blood_pressure}</strong></div>}
                                            {v.heart_rate && <div style={{ background: '#faf5ff', borderRadius: 8, padding: '0.4rem 0.65rem', fontSize: '0.85rem' }}>💓 <strong>{v.heart_rate} bpm</strong></div>}
                                            {v.weight && <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '0.4rem 0.65rem', fontSize: '0.85rem' }}>⚖️ <strong>{v.weight} kg</strong></div>}
                                        </div>
                                        {v.symptoms && (
                                            <div style={{ fontSize: '0.83rem', color: '#475569', background: '#f8fafc', borderRadius: 8, padding: '0.45rem 0.7rem', marginBottom: v.doctor_feedback ? '0.6rem' : 0 }}>
                                                <strong>Symptoms:</strong> {v.symptoms}
                                            </div>
                                        )}
                                        {/* Doctor feedback banner */}
                                        {v.doctor_feedback && (
                                            <div style={{
                                                background: '#f0fdfa', border: '1px solid #99f6e4',
                                                borderRadius: 10, padding: '0.65rem 0.9rem', marginTop: '0.5rem',
                                            }}>
                                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0d9488', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    👨‍⚕️ Doctor's Feedback
                                                </div>
                                                <div style={{ fontSize: '0.88rem', color: '#134e4a' }}>{v.doctor_feedback}</div>
                                                {v.feedback_date && <div style={{ fontSize: '0.72rem', color: '#5eead4', marginTop: '0.2rem' }}>{fmt(v.feedback_date)}</div>}
                                            </div>
                                        )}
                                    </Card>
                                ))}
                            </div>
                        )
                    }
                </div>
            )}

            {/* ══════════ PRESCRIPTIONS ══════════════════════════════ */}
            {activeTab === 'prescriptions' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ margin: 0 }}>Prescriptions</h3>
                    </div>

                    {loading ? <Card><Skeleton /></Card> : scripts.length === 0
                        ? <Card><Empty icon={Pill} message="No prescriptions issued yet" /></Card>
                        : scripts.map(rx => (
                            <Card key={rx.id}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.9rem' }}>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Dr. {rx.doctor_name}</div>
                                        <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{fmtD(rx.date_time)} · {rx.reason}</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                                    {rx.items.map(item => (
                                        <div key={item.id} style={{
                                            display: 'grid', gridTemplateColumns: 'auto 1fr auto',
                                            alignItems: 'center', gap: '0.75rem',
                                            background: '#f8fafc', borderRadius: 10, padding: '0.7rem 1rem',
                                        }}>
                                            <Pill size={16} color="var(--primary-color)" />
                                            <div>
                                                <div style={{ fontWeight: 700 }}>{item.medicine_name}</div>
                                                <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                                                    {[item.dosage, item.frequency, item.duration, item.route].filter(Boolean).join(' · ')}
                                                </div>
                                                {item.instructions && <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.15rem' }}>{item.instructions}</div>}
                                            </div>
                                            <Badge label={item.status} />
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        ))
                    }
                </div>
            )}

            {/* ══════════ MESSAGES ════════════════════════════════════ */}
            {activeTab === 'messages' && (
                <div style={{ height: 'calc(100vh - 250px)', minHeight: 400 }}>
                    <MessagingPage embedded />
                </div>
            )}

            {/* ══════════ HISTORY ════════════════════════════════════ */}
            {activeTab === 'history' && (
                <div>
                    <h3 style={{ marginBottom: '1rem' }}>Visit History</h3>
                    {loading ? <Card><Skeleton /></Card> : history.length === 0
                        ? <Card><Empty icon={Clock} message="No past visit records" /></Card>
                        : history.map(visit => {
                            const expanded = expandedVisit === visit.id;
                            return (
                                <Card key={visit.id} style={{ padding: 0, overflow: 'hidden' }}>
                                    {/* Row header */}
                                    <div
                                        onClick={() => setExpandedVisit(expanded ? null : visit.id)}
                                        style={{
                                            display: 'grid', gridTemplateColumns: '1fr auto auto auto',
                                            alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem',
                                            cursor: 'pointer', background: expanded ? '#f8fafc' : '#fff',
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 700 }}>{fmtD(visit.date_time)}</div>
                                            <div style={{ fontSize: '0.83rem', color: '#64748b' }}>{visit.reason}</div>
                                        </div>
                                        <div style={{ fontSize: '0.85rem', color: '#475569' }}>Dr. {visit.doctor_name}</div>
                                        <Badge label={visit.status} />
                                        {expanded ? <ChevronUp size={18} color="#94a3b8" /> : <ChevronDown size={18} color="#94a3b8" />}
                                    </div>

                                    {/* Expanded detail */}
                                    {expanded && visit.has_consultation && (
                                        <div style={{ padding: '0 1.25rem 1.25rem', borderTop: '1px solid #f1f5f9' }}>
                                            {[
                                                { label: 'Diagnosis', value: visit.diagnosis },
                                                { label: 'Clinical Notes', value: visit.clinical_notes },
                                                { label: 'Treatment Plan', value: visit.treatment_plan },
                                                { label: 'Lab Results', value: visit.lab_results },
                                                { label: 'Follow-up Notes', value: visit.follow_up_notes },
                                            ].filter(s => s.value).map(({ label, value }) => (
                                                <div key={label} style={{ marginTop: '0.9rem' }}>
                                                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>{label}</div>
                                                    <div style={{ fontSize: '0.9rem', color: '#1e293b', background: '#f8fafc', borderRadius: 8, padding: '0.55rem 0.75rem' }}>{value}</div>
                                                </div>
                                            ))}
                                            {visit.prescription?.length > 0 && (
                                                <div style={{ marginTop: '0.9rem' }}>
                                                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>Prescribed Medications</div>
                                                    {visit.prescription.map((item, i) => (
                                                        <div key={i} style={{ fontSize: '0.88rem', background: '#f8fafc', borderRadius: 8, padding: '0.45rem 0.75rem', marginBottom: '0.3rem' }}>
                                                            💊 <strong>{item.medicine_name}</strong> — {item.dosage} · {item.frequency}
                                                            {item.duration && ` · ${item.duration}`}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {expanded && !visit.has_consultation && (
                                        <div style={{ padding: '0.75rem 1.25rem 1rem', borderTop: '1px solid #f1f5f9', color: '#94a3b8', fontSize: '0.88rem' }}>
                                            No clinical notes available for this visit.
                                        </div>
                                    )}
                                </Card>
                            );
                        })
                    }
                </div>
            )}

            {/* ══════════ MODALS ══════════════════════════════════════ */}

            {/* Book Appointment */}
            <Modal isOpen={showBook} onClose={() => setShowBook(false)} title="Book New Appointment">
                <form onSubmit={handleBook}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem' }}>Date</label>
                            <input type="date" required style={inputSt} value={bookData.date}
                                min={new Date().toISOString().split('T')[0]}
                                onChange={e => setBookData(b => ({ ...b, date: e.target.value }))} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem' }}>Time</label>
                            <input type="time" required style={inputSt} value={bookData.time}
                                onChange={e => setBookData(b => ({ ...b, time: e.target.value }))} />
                        </div>
                    </div>
                    <div style={{ marginBottom: '1.25rem' }}>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem' }}>Reason for Visit</label>
                        <textarea required rows={4} style={{ ...inputSt, resize: 'vertical' }} value={bookData.reason}
                            placeholder="Briefly describe your symptoms or reason for the visit…"
                            onChange={e => setBookData(b => ({ ...b, reason: e.target.value }))} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                        <button type="button" onClick={() => setShowBook(false)} style={btnSecondary}>Cancel</button>
                        <button type="submit" disabled={booking} style={btnPrimary}>{booking ? 'Booking…' : 'Confirm Booking'}</button>
                    </div>
                </form>
            </Modal>

            {/* Cancel Appointment */}
            <Modal isOpen={!!cancelAppt} onClose={() => setCancelAppt(null)} title="Cancel Appointment">
                {cancelAppt && (
                    <div>
                        <p style={{ marginBottom: '1rem', color: '#475569' }}>
                            Are you sure you want to cancel your appointment on <strong>{fmt(cancelAppt.date_time)}</strong>?
                        </p>
                        <div style={{ marginBottom: '1.25rem' }}>
                            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem' }}>Reason (optional)</label>
                            <textarea rows={3} style={{ ...inputSt, resize: 'vertical' }} value={cancelReason}
                                placeholder="Let us know why you're cancelling…"
                                onChange={e => setCancelReason(e.target.value)} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                            <button onClick={() => setCancelAppt(null)} style={btnSecondary}>Keep Appointment</button>
                            <button onClick={handleCancel} style={{ ...btnPrimary, background: '#ef4444' }}>
                                <AlertCircle size={15} /> Yes, Cancel
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Profile Edit */}
            {showEdit && profile && (
                <PatientProfileEditModal
                    profile={profile}
                    isOpen={showEdit}
                    onClose={() => setShowEdit(false)}
                    onSaved={(updated) => {
                        setProfile(p => ({ ...p, ...updated }));
                        showToast('Profile updated successfully!');
                    }}
                />
            )}

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
}

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import api from '../../api/axios';
import { Activity, User, Phone, Droplet, Clock, ChevronDown, ChevronRight, MessageSquare, HeartPulse, Filter, Search, Pill } from 'lucide-react';
import Toast from '../../components/common/Toast';
import { useAuth } from '../../context/AuthContext';

// Simple status color mapping
const StatusDot = ({ status }) => {
    let color = '#94a3b8';
    if (status === 'escalated' || status === 'critical') color = '#ef4444';
    else if (status === 'reviewed') color = '#10b981';
    else if (status === 'pending') color = '#f59e0b';

    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color }} />
            {status}
        </span>
    );
};

const fmtDate = (d) => new Date(d).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
});

const fmtShortDate = (d) => new Date(d).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric'
});

const DoctorRemoteMonitoring = () => {
    const { user } = useAuth();
    const [monitorings, setMonitorings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);

    // List Management & Filter States
    const [query, setQuery] = useState(''); // Text search (name or notes)
    const [illnessFilter, setIllnessFilter] = useState(''); // Text search for illness notes
    const [allocationFilter, setAllocationFilter] = useState('all'); // 'all', 'me'
    const [priorityFilter, setPriorityFilter] = useState('all'); // 'all', 'high'
    const [expanded, setExpanded] = useState(null);

    // Feedback forms (vital_id -> text)
    const [feedbacks, setFeedbacks] = useState({});
    const [submittingFeedback, setSubmittingFeedback] = useState(null);

    // Remote Prescription forms (monitoring_id -> form payload)
    const [rxForms, setRxForms] = useState({});
    
    const toggleRxForm = (patientId) => {
        setRxForms(prev => ({
            ...prev,
            [patientId]: prev[patientId] ? null : { 
                medicine_name: '', dosage: '', route: 'PO', 
                duration_days: 1, morning: true, afternoon: false, evening: true 
            }
        }));
    };

    const submitRemoteRx = async (monitoringId) => {
        const payload = rxForms[monitoringId];
        if (!payload || !payload.medicine_name) return;
        try {
            await api.post(`/doctor/remote-monitoring-patients/${monitoringId}/prescribe/`, payload);
            setToast({ message: 'Remote Prescription issued successfully', type: 'success' });
            toggleRxForm(monitoringId); // Close form
            fetchMonitorings(); // Refresh data
        } catch (e) {
            setToast({ message: 'Failed to issue prescription', type: 'error' });
        }
    };

    const fetchMonitorings = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/doctor/remote-monitoring-patients/');
            setMonitorings(res.data);
        } catch (e) {
            setToast({ message: 'Failed to load monitoring data', type: 'error' });
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchMonitorings();
    }, [fetchMonitorings]);

    const submitFeedback = async (monitoringId, vitalId) => {
        const text = feedbacks[vitalId];
        if (!text) return;
        setSubmittingFeedback(vitalId);
        try {
            await api.post(`/doctor/remote-monitoring-patients/${monitoringId}/feedback/`, {
                vital_id: vitalId,
                feedback: text
            });
            setToast({ message: 'Clinical Feedback sent successfully', type: 'success' });
            setFeedbacks({ ...feedbacks, [vitalId]: '' });
            fetchMonitorings(); // refresh to show updated feedback
        } catch (e) {
            setToast({ message: 'Failed to send feedback', type: 'error' });
        }
        setSubmittingFeedback(null);
    };

    // Calculate Priority locally (High if any active vital is unreviewed or extreme)
    const getPriority = (m) => {
        if (!m.latest_vitals?.length) return 'low';
        const v = m.latest_vitals[0];
        if (v.status === 'pending') return 'high';
        if (v.temperature > 37.5 || v.temperature < 35.0) return 'high';
        // Simplistic BP parse, just example: 140/90 => high
        if (v.blood_pressure && v.blood_pressure.includes('/')) {
            const [sys] = v.blood_pressure.split('/');
            if (parseInt(sys) > 135) return 'high';
        }
        return 'low';
    };

    // Derived filtered data
    const filtered = useMemo(() => {
        return monitorings.filter(m => {
            // Text Search (Name or Email)
            const searchMatch = !query || 
                m.patient_full_name.toLowerCase().includes(query.toLowerCase()) || 
                m.patient_username.toLowerCase().includes(query.toLowerCase());
            
            // Illness Filter (using Notes)
            const illnessMatch = !illnessFilter || 
                (m.notes && m.notes.toLowerCase().includes(illnessFilter.toLowerCase()));
            
            // Allocation Filter
            const allocationMatch = allocationFilter === 'all' || 
                (allocationFilter === 'me' && m.assigned_doctor === user.id);
            
            // Priority Filter
            const priorityMatch = priorityFilter === 'all' || 
                (priorityFilter === 'high' && getPriority(m) === 'high');

            return searchMatch && illnessMatch && allocationMatch && priorityMatch;
        });
    }, [monitorings, query, illnessFilter, allocationFilter, priorityFilter, user]);

    return (
        <div style={{ maxWidth: 1000, margin: '0 auto', paddingBottom: '3rem' }} className="fade-in">
            {/* Header */}
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <HeartPulse size={22} color="#10b981" /> Remote Monitor Assessment
                    </h1>
                    <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.875rem' }}>
                        Review remote patient vitals and administer clinical instructions
                    </p>
                </div>
            </header>

            {/* Filter Bar */}
            <div style={{ background: '#fff', padding: '1rem', borderRadius: 12, border: '1px solid #e2e8f0', display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Patient Search</label>
                    <div style={{ position: 'relative' }}>
                        <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: 10, top: 10 }} />
                        <input
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Name or Username..."
                            style={{ width: '100%', padding: '0.5rem 0.5rem 0.5rem 2rem', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.85rem' }}
                        />
                    </div>
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Illness / Condition Filter</label>
                    <input
                        value={illnessFilter}
                        onChange={e => setIllnessFilter(e.target.value)}
                        placeholder="Search conditions (e.g. Hypertension)"
                        style={{ width: '100%', padding: '0.5rem 0.9rem', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.85rem' }}
                    />
                </div>
                <div style={{ minWidth: 140 }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Doctor Allocated</label>
                    <select value={allocationFilter} onChange={e => setAllocationFilter(e.target.value)} style={{ padding: '0.5rem 0.9rem', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.85rem', width: '100%', background: '#f8fafc' }}>
                        <option value="all">All Patients</option>
                        <option value="me">My Patients</option>
                    </select>
                </div>
                <div style={{ minWidth: 140 }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.4rem', textTransform: 'uppercase' }}>Review Priority</label>
                    <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} style={{ padding: '0.5rem 0.9rem', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.85rem', width: '100%', background: '#f8fafc' }}>
                        <option value="all">All Priorities</option>
                        <option value="high">Requires Assessment</option>
                    </select>
                </div>
                <button onClick={fetchMonitorings} style={{ padding: '0.5rem 1rem', borderRadius: 8, background: '#10b981', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, fontSize: '0.85rem' }}>
                    <Filter size={15} /> Apply
                </button>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>Loading monitoring data…</div>
            ) : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem', background: '#f8fafc', borderRadius: 14, border: '2px dashed #e2e8f0' }}>
                    <Activity size={40} color="#cbd5e1" style={{ margin: '0 auto 1rem' }} />
                    <p style={{ color: '#64748b', fontSize: '1.05rem', fontWeight: 600 }}>No monitored patients match your filters.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {filtered.map(m => {
                        const isOpen = expanded === m.id;
                        const lastVital = m.latest_vitals?.[0];
                        const isHighPriority = getPriority(m) === 'high';

                        return (
                            <div key={m.id} style={{ background: '#fff', borderRadius: 12, border: `1px solid ${isHighPriority ? '#fca5a5' : isOpen ? '#bfdbfe' : '#e2e8f0'}`, borderLeft: `5px solid ${isHighPriority ? '#ef4444' : '#3b82f6'}`, boxShadow: isOpen ? '0 4px 12px rgba(59,130,246,0.1)' : '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden', transition: 'all 0.2s' }}>
                                {/* Row */}
                                <div
                                    onClick={() => setExpanded(isOpen ? null : m.id)}
                                    style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', alignItems: 'center', gap: '1.5rem', padding: '1rem 1.25rem', cursor: 'pointer', background: isOpen ? '#f8fafc' : '#fff' }}
                                >
                                    <div style={{ color: '#94a3b8' }}>
                                        {isOpen ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,#10b981,#34d399)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <User size={18} color="#fff" />
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>
                                                {m.patient_full_name} 
                                                {isHighPriority && <span style={{ marginLeft: 8, padding: '0.1rem 0.5rem', background: '#fee2e2', color: '#dc2626', fontSize: '0.65rem', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assessment Needed</span>}
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.1rem' }}>
                                                <strong>Condition:</strong> <span style={{ fontStyle: m.notes ? 'normal' : 'italic' }}>{m.notes?.substring(0, 40) || 'Unspecified'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center' }}>
                                        <div style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <Clock size={13} />
                                            {lastVital ? fmtShortDate(lastVital.created_at) : 'No vitals'}
                                            {lastVital?.status && <StatusDot status={lastVital.status} />}
                                        </div>
                                    </div>

                                    <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#475569', minWidth: 100 }}>
                                        <div>Allocated to:</div>
                                        <div style={{ fontWeight: 600, color: m.assigned_doctor === user.id ? '#10b981' : '#334155' }}>
                                            {m.doctor_name ? `Dr. ${m.doctor_name}` : 'Unassigned'}
                                        </div>
                                    </div>
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
                                                </div>

                                                <h4 style={{ margin: '1rem 0 0.5rem', color: '#334155', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Enrollment Notes</h4>
                                                <div style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.6, background: '#fff', padding: '0.75rem', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                                    {m.notes && <div style={{ fontSize: '0.82rem', fontStyle: 'italic', color: '#334155' }}>{m.notes}</div>}
                                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.5rem' }}>Enrolled By: {m.enrolled_by_name}</div>
                                                </div>
                                            </div>

                                            {/* Vitals Timeline & Feedback */}
                                            <div>
                                                {/* Remote Prescription Builder */}
                                                <div style={{ marginBottom: '1.5rem', background: '#fff', borderRadius: 8, border: '1px solid #cbd5e1', overflow: 'hidden' }}>
                                                    <div style={{ padding: '1rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase' }}>Remote Prescription</div>
                                                        <button 
                                                            onClick={() => toggleRxForm(m.id)}
                                                            style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                                                        >
                                                            {rxForms[m.id] ? 'Cancel' : '+ Issue Prescription'}
                                                        </button>
                                                    </div>
                                                    
                                                    {rxForms[m.id] && (
                                                        <div style={{ padding: '1.25rem' }}>
                                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                                                <input type="text" placeholder="Medicine Name" value={rxForms[m.id].medicine_name} onChange={e => setRxForms({...rxForms, [m.id]: {...rxForms[m.id], medicine_name: e.target.value}})} style={{ padding: '0.65rem 0.8rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.85rem' }} />
                                                                <input type="text" placeholder="Dosage (e.g., 500mg)" value={rxForms[m.id].dosage} onChange={e => setRxForms({...rxForms, [m.id]: {...rxForms[m.id], dosage: e.target.value}})} style={{ padding: '0.65rem 0.8rem', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.85rem' }} />
                                                            </div>
                                                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, auto) 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                                                                <div style={{ position: 'relative' }}>
                                                                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#3b82f6', marginBottom: '0.3rem', textTransform: 'uppercase' }}>Period (Auto-calculates End Date)</label>
                                                                    <input type="number" placeholder="Duration (Days)" title="System will automatically calculate the end date from this period" min="1" value={rxForms[m.id].duration_days} onChange={e => setRxForms({...rxForms, [m.id]: {...rxForms[m.id], duration_days: parseInt(e.target.value)||1}})} style={{ width: '100%', padding: '0.65rem 0.8rem', borderRadius: 8, border: '2px solid #bfdbfe', fontSize: '0.85rem' }} />
                                                                </div>
                                                                <div style={{ display: 'flex', gap: '0.5rem', background: '#fff', padding: '0.3rem', borderRadius: 8, border: '1px solid #cbd5e1' }}>
                                                                    <button type="button" onClick={() => setRxForms({...rxForms, [m.id]: {...rxForms[m.id], morning: !rxForms[m.id].morning}})} style={{ flex: 1, padding: '0.4rem', borderRadius: 6, border: rxForms[m.id].morning ? 'none' : '1px solid #e2e8f0', background: rxForms[m.id].morning ? '#3b82f6' : '#f8fafc', color: rxForms[m.id].morning ? '#fff' : '#64748b', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>Morning</button>
                                                                    <button type="button" onClick={() => setRxForms({...rxForms, [m.id]: {...rxForms[m.id], afternoon: !rxForms[m.id].afternoon}})} style={{ flex: 1, padding: '0.4rem', borderRadius: 6, border: rxForms[m.id].afternoon ? 'none' : '1px solid #e2e8f0', background: rxForms[m.id].afternoon ? '#3b82f6' : '#f8fafc', color: rxForms[m.id].afternoon ? '#fff' : '#64748b', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>Afternoon</button>
                                                                    <button type="button" onClick={() => setRxForms({...rxForms, [m.id]: {...rxForms[m.id], evening: !rxForms[m.id].evening}})} style={{ flex: 1, padding: '0.4rem', borderRadius: 6, border: rxForms[m.id].evening ? 'none' : '1px solid #e2e8f0', background: rxForms[m.id].evening ? '#3b82f6' : '#f8fafc', color: rxForms[m.id].evening ? '#fff' : '#64748b', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>Evening</button>
                                                                </div>
                                                            </div>
                                                            <button onClick={() => submitRemoteRx(m.id)} disabled={!rxForms[m.id].medicine_name} style={{ width: '100%', padding: '0.8rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.9rem', cursor: rxForms[m.id].medicine_name ? 'pointer' : 'not-allowed', opacity: rxForms[m.id].medicine_name ? 1 : 0.6 }}>Issue Verified Prescription</button>
                                                        </div>
                                                    )}
                                                </div>

                                                <h4 style={{ margin: '0 0 0.75rem', color: '#334155', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                    <Activity size={14} /> Patient Health Submissions
                                                </h4>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                    {m.latest_vitals?.length === 0 ? (
                                                        <div style={{ padding: '2rem', textAlign: 'center', background: '#fff', borderRadius: 8, border: '1px dashed #cbd5e1', color: '#94a3b8', fontSize: '0.9rem' }}>
                                                            No vitals have been submitted by the patient yet.
                                                        </div>
                                                    ) : m.latest_vitals?.map(vital => (
                                                        <div key={vital.id} style={{ background: '#fff', borderRadius: 8, border: `1px solid ${vital.status === 'pending' ? '#f59e0b' : '#10b981'}`, borderLeft: `5px solid ${vital.status === 'pending' ? '#f59e0b' : '#10b981'}` }}>
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
                                                                    <div style={{ fontWeight: 700, fontSize: '1.05rem', color: vital.temperature > 37.5 || vital.temperature < 35.0 ? '#ef4444' : '#1e293b' }}>{vital.temperature ? `${vital.temperature} °C` : '—'}</div>
                                                                </div>
                                                                <div>
                                                                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Weight</div>
                                                                    <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '1.05rem' }}>{vital.weight ? `${vital.weight} kg` : '—'}</div>
                                                                </div>
                                                            </div>
                                                            {vital.symptoms && (
                                                                <div style={{ padding: '0 1rem 1rem', fontSize: '0.85rem' }}>
                                                                    <strong style={{ color: '#475569' }}>Symptoms reported:</strong> <span style={{ color: '#ef4444', fontWeight: 600 }}>{vital.symptoms}</span>
                                                                </div>
                                                            )}
                                                            
                                                            {/* Clinical Assessment Section */}
                                                            <div style={{ padding: '0.75rem 1rem', background: '#f8fafc', borderTop: '1px solid #e2e8f0', borderBottomRightRadius: 8, borderBottomLeftRadius: 8 }}>
                                                                {vital.doctor_feedback ? (
                                                                    <div style={{ display: 'flex', gap: '0.6rem', color: '#0f766e' }}>
                                                                        <MessageSquare size={16} style={{ marginTop: 2, flexShrink: 0 }} />
                                                                        <div>
                                                                            <div style={{ fontWeight: 600, fontSize: '0.8rem', marginBottom: '0.2rem' }}>You assessed on {fmtDate(vital.feedback_date)}:</div>
                                                                            <div style={{ fontSize: '0.85rem' }}>"{vital.doctor_feedback}"</div>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div>
                                                                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#10b981', marginBottom: '0.6rem', textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                            <span>Action Required: Clinical Assessment</span>
                                                                            <button type="button" onClick={() => toggleRxForm(m.id)} style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                                              <Pill size={14} /> {rxForms[m.id] ? 'Cancel Prescription' : '+ Prescribe Medication'}
                                                                            </button>
                                                                        </div>
                                                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                                            <input 
                                                                                type="text" 
                                                                                placeholder="E.g., Your BP is elevated. Please take your prescribed lisinopril and re-check in 2 hours."
                                                                                value={feedbacks[vital.id] || ''}
                                                                                onChange={e => setFeedbacks({...feedbacks, [vital.id]: e.target.value})}
                                                                                style={{ flex: 1, padding: '0.6rem 0.75rem', borderRadius: 6, border: '2px solid #a7f3d0', fontSize: '0.85rem', outline: 'none' }}
                                                                            />
                                                                            <button 
                                                                                onClick={() => submitFeedback(m.id, vital.id)}
                                                                                disabled={submittingFeedback === vital.id || !feedbacks[vital.id]}
                                                                                style={{ padding: '0 1.25rem', borderRadius: 6, background: '#10b981', color: '#fff', border: 'none', fontSize: '0.9rem', fontWeight: 700, cursor: feedbacks[vital.id] ? 'pointer' : 'not-allowed', opacity: feedbacks[vital.id] ? 1 : 0.6 }}
                                                                            >
                                                                                {submittingFeedback === vital.id ? 'Sending...' : 'Issue Instruction'}
                                                                            </button>
                                                                        </div>
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

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

export default DoctorRemoteMonitoring;

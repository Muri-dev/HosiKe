import React, { useEffect, useState, useRef, useCallback } from 'react';
import api from '../../api/axios';
import {
    CheckCircle, Clock, AlertTriangle, Bell, BellOff,
    RefreshCw, User, MapPin, Pill, ChevronDown, ChevronUp,
    Activity, FileText
} from 'lucide-react';
import Toast from '../../components/common/Toast';

// ─── helpers ─────────────────────────────────────────────────────────────────
const fmtTime = (dt) =>
    new Date(dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const fmtDateTime = (dt) =>
    new Date(dt).toLocaleString([], {
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });

// Maps an hour (0-23) to a readable period label with emoji
function dosePeriod(dt) {
    const h = new Date(dt).getHours();
    if (h >= 5 && h < 12) return '🌅 Morning';
    if (h >= 12 && h < 14) return '☀️ Noon';
    if (h >= 14 && h < 18) return '🌤 Afternoon';
    if (h >= 18 && h < 22) return '🌆 Evening';
    return '🌙 Night';
}

function useCountdown(scheduledTime) {
    const [diff, setDiff] = useState(() => new Date(scheduledTime) - Date.now());

    useEffect(() => {
        const id = setInterval(() => setDiff(new Date(scheduledTime) - Date.now()), 1000);
        return () => clearInterval(id);
    }, [scheduledTime]);

    return diff; // negative = overdue
}

function CountdownBadge({ scheduledTime }) {
    const diff = useCountdown(scheduledTime);
    const abs = Math.abs(diff);
    const s = Math.floor((abs / 1000) % 60);
    const m = Math.floor((abs / 60000) % 60);
    const h = Math.floor(abs / 3600000);
    const label = h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`;

    if (diff < 0) return (
        <span style={styles.badgeOverdue}>⏰ {label} overdue</span>
    );
    if (diff < 30 * 60000) return (
        <span style={styles.badgeDue}>⏳ in {label}</span>
    );
    return (
        <span style={styles.badgeUpcoming}>🕐 in {label}</span>
    );
}

function urgencyStyle(scheduledTime, status) {
    if (status === 'administered') return styles.cardAdministered;
    const diff = new Date(scheduledTime) - Date.now();
    if (diff < 0) return styles.cardOverdue;
    if (diff < 30 * 60000) return styles.cardDue;
    return styles.cardUpcoming;
}

// ─── main component ───────────────────────────────────────────────────────────
const NurseMedications = () => {
    const [activeTab, setActiveTab] = useState('due'); // due | upcoming | administered
    const [queue, setQueue] = useState([]);
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState(null);
    const [notifAllowed, setNotifAllowed] = useState(
        typeof Notification !== 'undefined' ? Notification.permission : 'denied'
    );
    const [adminModal, setAdminModal] = useState(null); // {id, name, patient}
    const [adminNotes, setAdminNotes] = useState('');
    const [expandedId, setExpandedId] = useState(null);
    const notifiedRef = useRef(new Set());
    const refreshTimerRef = useRef(null);

    // ── fetch ─────────────────────────────────────────────────────────────────
    const fetchQueue = useCallback(async (tab = activeTab) => {
        setLoading(true);
        try {
            const scope = tab === 'administered' ? 'administered_today' : tab;
            const res = await api.get(`/nurse/med-queue/?scope=${scope}`);
            setQueue(res.data);
        } catch (e) {
            console.error(e);
            setToast({ message: 'Failed to load medication queue', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [activeTab]);

    useEffect(() => {
        fetchQueue(activeTab);
        refreshTimerRef.current = setInterval(() => fetchQueue(activeTab), 60_000);
        return () => clearInterval(refreshTimerRef.current);
    }, [activeTab]); // eslint-disable-line

    // ── browser notifications ─────────────────────────────────────────────────
    const requestNotifPermission = async () => {
        if (!('Notification' in window)) return;
        const p = await Notification.requestPermission();
        setNotifAllowed(p);
    };

    useEffect(() => {
        if (notifAllowed !== 'granted') return;
        // Fire notification when a scheduled item becomes due (diff crosses 0)
        const checkInterval = setInterval(() => {
            queue.forEach((task) => {
                const key = `nurse-${task.id}`;
                if (notifiedRef.current.has(key)) return;
                const diff = new Date(task.scheduled_time) - Date.now();
                if (diff <= 0 && diff > -60_000) {
                    notifiedRef.current.add(key);
                    new Notification(`💊 Medication Due`, {
                        body: `${task.medicine_name} ${task.dosage} — ${task.patient_name} (Bed ${task.bed || '—'})`,
                        icon: '/favicon.ico',
                        tag: key,
                    });
                }
            });
        }, 10_000);
        return () => clearInterval(checkInterval);
    }, [queue, notifAllowed]);

    // ── administer ────────────────────────────────────────────────────────────
    const openAdminModal = (task) => {
        setAdminModal(task);
        setAdminNotes('');
    };

    const confirmAdminister = async () => {
        if (!adminModal) return;
        try {
            await api.patch(`/nurse/med-queue/${adminModal.id}/administer/`, { notes: adminNotes });
            setToast({ message: `✅ ${adminModal.medicine_name} administered`, type: 'success' });
            setAdminModal(null);
            fetchQueue(activeTab);
        } catch {
            setToast({ message: 'Failed to mark as administered', type: 'error' });
        }
    };

    // ── render helpers ────────────────────────────────────────────────────────
    const tabCount = (tab) => {
        if (tab === activeTab) return queue.length;
        return null;
    };

    const sortedQueue = [...queue].sort((a, b) => new Date(a.scheduled_time) - new Date(b.scheduled_time));

    return (
        <div>
            {/* ── header ── */}
            <div style={styles.header}>
                <div>
                    <h2 style={styles.title}>
                        <Pill size={22} style={{ marginRight: 8, color: '#6366f1' }} />
                        Medication Administration
                    </h2>
                    <p style={styles.subtitle}>Real-time schedule for your assigned patients</p>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    {/* Notification toggle */}
                    {notifAllowed !== 'granted' ? (
                        <button style={styles.btnNotif} onClick={requestNotifPermission}>
                            <Bell size={15} /> Enable Alerts
                        </button>
                    ) : (
                        <span style={styles.notifOn}><Bell size={14} /> Alerts ON</span>
                    )}

                    <button style={styles.btnRefresh} onClick={() => fetchQueue(activeTab)}>
                        <RefreshCw size={15} className={loading ? 'spin' : ''} />
                        {loading ? 'Loading…' : 'Refresh'}
                    </button>
                </div>
            </div>

            {/* ── tabs ── */}
            <div style={styles.tabBar}>
                {[
                    { key: 'due', label: '🔴 Due Now' },
                    { key: 'upcoming', label: '🔵 Upcoming' },
                    { key: 'administered', label: '✅ Administered Today' },
                ].map(({ key, label }) => (
                    <button
                        key={key}
                        style={{ ...styles.tab, ...(activeTab === key ? styles.tabActive : {}) }}
                        onClick={() => setActiveTab(key)}
                    >
                        {label}
                        {tabCount(key) !== null && (
                            <span style={styles.tabBadge}>{tabCount(key)}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* ── cards ── */}
            {sortedQueue.length === 0 ? (
                <div style={styles.empty}>
                    <CheckCircle size={40} color="#22c55e" />
                    <p style={{ marginTop: '0.75rem', color: '#64748b' }}>
                        {activeTab === 'due' ? 'No medications are due right now.' :
                            activeTab === 'upcoming' ? 'No upcoming medications in the next 8 hours.' :
                                'No medications administered yet today.'}
                    </p>
                </div>
            ) : (
                <div style={styles.grid}>
                    {sortedQueue.map((task) => {
                        const cStyle = urgencyStyle(task.scheduled_time, task.status);
                        const isExpanded = expandedId === task.id;
                        return (
                            <div key={task.id} style={{ ...styles.card, ...cStyle }}>
                                {/* card header */}
                                <div style={styles.cardHeader}>
                                    <div>
                                        <div style={styles.medName}>{task.medicine_name}</div>
                                        <div style={styles.dosage}>{task.dosage} · {task.route}</div>
                                        <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '11px', fontWeight: 500 }}>
                                            <span style={{ color: task.morning ? '#0f766e' : '#94a3b8' }}>{task.morning ? '☑️ Morning Scheduled' : '🚫 No Morning Dose'}</span>
                                            <span style={{ color: task.afternoon ? '#0f766e' : '#94a3b8' }}>{task.afternoon ? '☑️ Afternoon Scheduled' : '🚫 No Afternoon Dose'}</span>
                                            <span style={{ color: task.evening ? '#0f766e' : '#94a3b8' }}>{task.evening ? '☑️ Evening Scheduled' : '🚫 No Evening Dose'}</span>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        {task.status !== 'administered' ? (
                                            <CountdownBadge scheduledTime={task.scheduled_time} />
                                        ) : (
                                            <span style={styles.badgeAdministered}>✅ Done</span>
                                        )}
                                    </div>
                                </div>

                                {/* patient info & timing */}
                                <div style={styles.meta}>
                                    <span><User size={13} /> {task.patient_name}</span>
                                    <span><MapPin size={13} /> Ward: {task.ward} · Bed {task.bed || '—'}</span>
                                    <span>
                                        <Clock size={13} /> Scheduled: <strong>{fmtTime(task.scheduled_time)}</strong>
                                    </span>
                                </div>

                                {/* duration indicator */}
                                {task.start_date && task.duration_days && (
                                    <div style={{ ...styles.meta, marginTop: '4px', fontSize: '11px', color: '#6366f1' }}>
                                        <span>
                                            <Calendar size={12} style={{ marginRight: '4px'}}/> 
                                            Ends on: <strong>{new Date(new Date(task.start_date).setDate(new Date(task.start_date).getDate() + task.duration_days)).toLocaleDateString()}</strong> 
                                            ({task.duration_days} Days)
                                        </span>
                                    </div>
                                )}

                                {/* expand/collapse extra info */}
                                <button
                                    style={styles.expandBtn}
                                    onClick={() => setExpandedId(isExpanded ? null : task.id)}
                                >
                                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    {isExpanded ? 'Less' : 'More details'}
                                </button>
                                {isExpanded && (
                                    <div style={styles.expandPanel}>
                                        {task.medication_item?.instructions && (
                                            <p><FileText size={13} /> <em>{task.medication_item.instructions}</em></p>
                                        )}
                                        {task.status === 'administered' && (
                                            <p>
                                                <Activity size={13} /> Administered at <strong>{fmtDateTime(task.administered_at)}</strong>
                                                {task.administered_by_name && ` by ${task.administered_by_name}`}
                                            </p>
                                        )}
                                        {task.notes && <p>📝 {task.notes}</p>}
                                    </div>
                                )}

                                {/* action */}
                                {task.status !== 'administered' && (
                                    <button
                                        style={styles.btnAdminister}
                                        onClick={() => openAdminModal(task)}
                                    >
                                        <CheckCircle size={16} /> Mark Administered
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── administer confirmation modal ── */}
            {adminModal && (
                <div style={styles.overlay} onClick={() => setAdminModal(null)}>
                    <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <h3 style={styles.modalTitle}>Confirm Administration</h3>
                        <p style={styles.modalSub}>
                            <strong>{adminModal.medicine_name} {adminModal.dosage}</strong><br />
                            Patient: <strong>{adminModal.patient_name}</strong> · Bed {adminModal.bed || '—'}<br />
                            Scheduled: <strong>{fmtTime(adminModal.scheduled_time)}</strong>
                        </p>
                        <label style={styles.label}>Notes (optional)</label>
                        <textarea
                            style={styles.textarea}
                            rows={3}
                            placeholder="Any observations or remarks…"
                            value={adminNotes}
                            onChange={(e) => setAdminNotes(e.target.value)}
                        />
                        <div style={styles.modalActions}>
                            <button style={styles.btnCancel} onClick={() => setAdminModal(null)}>Cancel</button>
                            <button style={styles.btnConfirm} onClick={confirmAdminister}>
                                <CheckCircle size={16} /> Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

// ─── styles ───────────────────────────────────────────────────────────────────
const styles = {
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' },
    title: { margin: 0, fontSize: '1.4rem', fontWeight: 700, display: 'flex', alignItems: 'center' },
    subtitle: { margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.875rem' },

    tabBar: { display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' },
    tab: { padding: '0.55rem 1.1rem', borderRadius: '999px', border: '2px solid #e2e8f0', background: '#f8fafc', color: '#64748b', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', transition: 'all .2s' },
    tabActive: { background: '#6366f1', borderColor: '#6366f1', color: '#fff' },
    tabBadge: { background: 'rgba(255,255,255,0.25)', borderRadius: '999px', padding: '0 0.45rem', fontSize: '0.75rem', fontWeight: 700 },

    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' },
    card: { borderRadius: '1rem', padding: '1.25rem', borderLeft: '5px solid', background: '#fff', boxShadow: '0 1px 8px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: '0.75rem' },
    cardOverdue: { borderLeftColor: '#ef4444', background: '#fff5f5' },
    cardDue: { borderLeftColor: '#f59e0b', background: '#fffbf0' },
    cardUpcoming: { borderLeftColor: '#3b82f6', background: '#f0f8ff' },
    cardAdministered: { borderLeftColor: '#22c55e', background: '#f0fdf4', opacity: 0.85 },

    cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
    medName: { fontWeight: 700, fontSize: '1.05rem', color: '#1e293b' },
    dosage: { fontSize: '0.82rem', color: '#475569', marginTop: '0.2rem' },

    meta: { display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.82rem', color: '#475569' },

    badgeOverdue: { background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '999px', padding: '0.2rem 0.65rem', fontSize: '0.78rem', fontWeight: 700, whiteSpace: 'nowrap' },
    badgeDue: { background: '#fffbeb', color: '#d97706', border: '1px solid #fcd34d', borderRadius: '999px', padding: '0.2rem 0.65rem', fontSize: '0.78rem', fontWeight: 700, whiteSpace: 'nowrap' },
    badgeUpcoming: { background: '#eff6ff', color: '#2563eb', border: '1px solid #93c5fd', borderRadius: '999px', padding: '0.2rem 0.65rem', fontSize: '0.78rem', fontWeight: 700, whiteSpace: 'nowrap' },
    badgeAdministered: { background: '#f0fdf4', color: '#16a34a', border: '1px solid #86efac', borderRadius: '999px', padding: '0.2rem 0.65rem', fontSize: '0.78rem', fontWeight: 700 },

    expandBtn: { background: 'none', border: 'none', color: '#6366f1', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', padding: 0, fontWeight: 600 },
    expandPanel: { background: 'rgba(0,0,0,0.03)', borderRadius: '0.5rem', padding: '0.75rem', fontSize: '0.82rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.3rem' },

    btnAdminister: { background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', border: 'none', borderRadius: '0.6rem', padding: '0.6rem 1rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center', fontSize: '0.9rem', marginTop: 'auto' },
    btnCancel: { background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '0.6rem', padding: '0.6rem 1.2rem', fontWeight: 600, cursor: 'pointer' },
    btnConfirm: { background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', border: 'none', borderRadius: '0.6rem', padding: '0.6rem 1.4rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' },
    btnRefresh: { background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '0.6rem', padding: '0.5rem 1rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' },
    btnNotif: { background: '#6366f1', color: '#fff', border: 'none', borderRadius: '0.6rem', padding: '0.5rem 1rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' },
    notifOn: { color: '#16a34a', fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' },

    empty: { textAlign: 'center', padding: '4rem 2rem', background: '#f8fafc', borderRadius: '1rem', border: '2px dashed #e2e8f0' },

    overlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' },
    modal: { background: '#fff', borderRadius: '1.25rem', padding: '2rem', width: '100%', maxWidth: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
    modalTitle: { margin: '0 0 0.75rem', fontSize: '1.2rem', fontWeight: 700, color: '#1e293b' },
    modalSub: { color: '#475569', fontSize: '0.9rem', margin: '0 0 1.25rem', lineHeight: 1.6 },
    label: { display: 'block', fontWeight: 600, fontSize: '0.85rem', color: '#374151', marginBottom: '0.4rem' },
    textarea: { width: '100%', borderRadius: '0.6rem', border: '1px solid #d1d5db', padding: '0.7rem', fontSize: '0.9rem', resize: 'vertical', marginBottom: '1.25rem', boxSizing: 'border-box' },
    modalActions: { display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' },
};

export default NurseMedications;

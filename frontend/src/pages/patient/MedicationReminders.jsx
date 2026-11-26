import React, { useEffect, useState, useRef, useCallback } from 'react';
import api from '../../api/axios';
import { Pill, Bell, CheckCircle, Clock, AlertTriangle, RefreshCw } from 'lucide-react';

// ─── helpers ─────────────────────────────────────────────────────────────────
const now = () => new Date();

// Maps an hour string "08:00" to a readable period label with emoji
function dosePeriodFromStr(timeStr) {
    const h = parseInt(timeStr.split(':')[0], 10);
    if (h >= 5 && h < 12) return '🌅 Morning';
    if (h >= 12 && h < 14) return '☀️ Noon';
    if (h >= 14 && h < 18) return '🌤 Afternoon';
    if (h >= 18 && h < 22) return '🌆 Evening';
    return '🌙 Night';
}

function getDoseStatus(timeStr) {
    // timeStr = "08:00"
    const [h, m] = timeStr.split(':').map(Number);
    const doseTime = new Date();
    doseTime.setHours(h, m, 0, 0);
    const diff = doseTime - now();
    if (diff > 30 * 60000) return 'upcoming';
    if (diff > -15 * 60000) return 'due'; // within ±15 min
    return 'overdue';
}

function getNextDoseTime(doseTimes) {
    const nowMs = now().getTime();
    for (const t of doseTimes) {
        const [h, m] = t.split(':').map(Number);
        const dt = new Date(); dt.setHours(h, m, 0, 0);
        if (dt.getTime() > nowMs) return t;
    }
    return null;
}

// ─── component ────────────────────────────────────────────────────────────────
const MedicationReminders = () => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [notifAllowed, setNotifAllowed] = useState(
        typeof Notification !== 'undefined' ? Notification.permission : 'denied'
    );
    const [adminStates, setAdminStates] = useState({}); // itemId -> {loading, done, time}
    const [toast, setToast] = useState(null);
    const notifiedRef = useRef(new Set());
    const timersRef = useRef([]);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    // ── fetch ─────────────────────────────────────────────────────────────────
    const fetchSchedule = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/patient/med-schedule/');
            setItems(res.data);
        } catch {
            // silent — not all patients have remote prescriptions
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchSchedule();
        const id = setInterval(fetchSchedule, 5 * 60000);
        return () => clearInterval(id);
    }, [fetchSchedule]);

    // ── browser notifications ─────────────────────────────────────────────────
    const requestPermission = async () => {
        if (!('Notification' in window)) return;
        const p = await Notification.requestPermission();
        setNotifAllowed(p);
    };

    useEffect(() => {
        // Clear old timers
        timersRef.current.forEach(clearTimeout);
        timersRef.current = [];

        if (notifAllowed !== 'granted' || items.length === 0) return;
        const nowMs = Date.now();

        items.forEach((item) => {
            const activeDoses = [];
            if (item.morning) activeDoses.push('08:00');
            if (item.afternoon) activeDoses.push('14:00');
            if (item.evening) activeDoses.push('20:00');

            activeDoses.forEach((t) => {
                const key = `rx-${item.id}-${t}`;
                if (notifiedRef.current.has(key)) return;

                const [h, m] = t.split(':').map(Number);
                const target = new Date();
                target.setHours(h, m, 0, 0);
                const delay = target.getTime() - nowMs;

                if (delay > 0 && delay < 24 * 3600 * 1000) {
                    // Fire a reminder 2 minutes BEFORE the dose
                    const preDelay = delay - 2 * 60000;
                    if (preDelay > 0) {
                        const id = setTimeout(() => {
                            new Notification(`⏰ Medication Reminder`, {
                                body: `Time to take ${item.medicine_name} ${item.dosage} in 2 minutes (${t})`,
                                icon: '/favicon.ico',
                                tag: `pre-${key}`,
                            });
                        }, preDelay);
                        timersRef.current.push(id);
                    }
                    // Fire at exact time
                    const id = setTimeout(() => {
                        notifiedRef.current.add(key);
                        new Notification(`💊 Take Your Medication Now`, {
                            body: `${item.medicine_name} ${item.dosage} — ${item.frequency}\n${item.instructions || ''}`,
                            icon: '/favicon.ico',
                            tag: key,
                        });
                    }, delay);
                    timersRef.current.push(id);
                }
            });
        });
        return () => timersRef.current.forEach(clearTimeout);
    }, [items, notifAllowed]);

    // ── self-administer ───────────────────────────────────────────────────────
    const handleTake = async (item, period) => {
        setAdminStates(s => ({ ...s, [`${item.id}-${period}`]: { loading: true } }));
        try {
            await api.patch(`/patient/med-schedule/${item.id}/self-administer/`, { period });
            setAdminStates(s => ({ ...s, [`${item.id}-${period}`]: { loading: false, done: true, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) } }));
            showToast(`✅ ${item.medicine_name} ${period} marked as taken`);
            fetchSchedule();
        } catch {
            setAdminStates(s => ({ ...s, [`${item.id}-${period}`]: { loading: false } }));
            showToast('Failed to record. Please try again.', 'error');
        }
    };

    // ── render ────────────────────────────────────────────────────────────────
    if (!loading && items.length === 0) return null; // no active prescriptions → hide section cleanly

    return (
        <div style={S.wrapper}>
            {/* header */}
            <div style={S.header}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={S.iconBox}><Pill size={18} color="#6366f1" /></div>
                    <div>
                        <div style={S.title}>Today's Medication Schedule</div>
                        <div style={S.subtitle}>Take each dose at the scheduled time</div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                    {notifAllowed !== 'granted' && (
                        <button style={S.btnNotif} onClick={requestPermission}>
                            <Bell size={14} /> Enable Reminders
                        </button>
                    )}
                    <button style={S.btnRefresh} onClick={fetchSchedule}>
                        <RefreshCw size={14} />
                    </button>
                </div>
            </div>

            {loading ? (
                <div style={S.loading}>Loading your medication schedule…</div>
            ) : (
                <div style={S.list}>
                    {items.map((item) => {
                        const state = adminStates[item.id] || {};
                        const alreadyAdministered = item.administered || state.done;

                        return (
                            <div key={item.id} style={S.medCard}>
                                {/* med info */}
                                <div style={S.medHeader}>
                                    <div>
                                        <div style={S.medName}>{item.medicine_name}</div>
                                        <div style={S.medMeta}>
                                            {item.dosage} · {item.route}
                                            {item.duration && ` · ${item.duration} days`}
                                            {item.active_until && ` · Until ${new Date(item.active_until).toLocaleDateString()}`}
                                        </div>
                                        {item.instructions && (
                                            <div style={S.instructions}>📋 {item.instructions}</div>
                                        )}
                                        <div style={S.doctor}>Prescribed by Dr. {item.doctor_name}</div>
                                    </div>
                                    {alreadyAdministered && (
                                        <span style={S.doneBadge}>
                                            <CheckCircle size={13} /> Taken{state.time ? ` at ${state.time}` : ''}
                                        </span>
                                    )}
                                </div>

                                {/* dose timeline */}
                                <div style={{ display: 'flex', gap: '12px', marginTop: '6px', marginBottom: '8px', fontSize: '11px', fontWeight: 500 }}>
                                    <span style={{ color: item.morning ? '#4f46e5' : '#94a3b8' }}>{item.morning ? '☑️ Morning Scheduled' : '🚫 No Morning Dose'}</span>
                                    <span style={{ color: item.afternoon ? '#4f46e5' : '#94a3b8' }}>{item.afternoon ? '☑️ Afternoon Scheduled' : '🚫 No Afternoon Dose'}</span>
                                    <span style={{ color: item.evening ? '#4f46e5' : '#94a3b8' }}>{item.evening ? '☑️ Evening Scheduled' : '🚫 No Evening Dose'}</span>
                                </div>
                                <div style={S.timeline}>
                                    {[...(item.morning ? ['08:00'] : []), ...(item.afternoon ? ['14:00'] : []), ...(item.evening ? ['20:00'] : [])].map((t) => {
                                        const status = getDoseStatus(t);
                                        const period = dosePeriodFromStr(t);
                                        return (
                                            <div key={t} style={{ ...S.doseChip, ...S[`doseChip_${status}`] }}>
                                                {status === 'overdue' && <AlertTriangle size={12} />}
                                                {status === 'due' && <Clock size={12} />}
                                                {status === 'upcoming' && <Clock size={12} />}
                                                {t}
                                                <span style={{ ...S.doseLabel, fontWeight: 600 }}> · {period}</span>
                                                <span style={{ ...S.doseLabel, marginLeft: 4 }}>
                                                    {status === 'overdue' ? '| Overdue' : status === 'due' ? '| Take now' : ''}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* action */}
                                {(() => {
                                    const todayStr = new Date().toISOString().split('T')[0];
                                    const dosesDone = item.administered_doses?.[todayStr] || [];
                                    
                                    return (
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                                            {item.morning && (
                                                <button
                                                    style={{ ...S.btnTake, ...(dosesDone.includes('morning') ? { background: '#f0fdf4', color: '#16a34a', border: '1px solid #86efac' } : {}) }}
                                                    onClick={() => !dosesDone.includes('morning') && handleTake(item, 'morning')}
                                                    disabled={dosesDone.includes('morning') || adminStates[`${item.id}-morning`]?.loading}
                                                >
                                                    <CheckCircle size={15} />
                                                    {adminStates[`${item.id}-morning`]?.loading ? 'Recording…' : dosesDone.includes('morning') ? 'Morning Taken' : 'Take Morning Dose'}
                                                </button>
                                            )}
                                            {item.afternoon && (
                                                <button
                                                    style={{ ...S.btnTake, ...(dosesDone.includes('afternoon') ? { background: '#f0fdf4', color: '#16a34a', border: '1px solid #86efac' } : {}) }}
                                                    onClick={() => !dosesDone.includes('afternoon') && handleTake(item, 'afternoon')}
                                                    disabled={dosesDone.includes('afternoon') || adminStates[`${item.id}-afternoon`]?.loading}
                                                >
                                                    <CheckCircle size={15} />
                                                    {adminStates[`${item.id}-afternoon`]?.loading ? 'Recording…' : dosesDone.includes('afternoon') ? 'Afternoon Taken' : 'Take Afternoon Dose'}
                                                </button>
                                            )}
                                            {item.evening && (
                                                <button
                                                    style={{ ...S.btnTake, ...(dosesDone.includes('evening') ? { background: '#f0fdf4', color: '#16a34a', border: '1px solid #86efac' } : {}) }}
                                                    onClick={() => !dosesDone.includes('evening') && handleTake(item, 'evening')}
                                                    disabled={dosesDone.includes('evening') || adminStates[`${item.id}-evening`]?.loading}
                                                >
                                                    <CheckCircle size={15} />
                                                    {adminStates[`${item.id}-evening`]?.loading ? 'Recording…' : dosesDone.includes('evening') ? 'Evening Taken' : 'Take Evening Dose'}
                                                </button>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* toast */}
            {toast && (
                <div style={{ ...S.toast, background: toast.type === 'error' ? '#fef2f2' : '#f0fdf4', color: toast.type === 'error' ? '#dc2626' : '#16a34a', borderColor: toast.type === 'error' ? '#fca5a5' : '#86efac' }}>
                    {toast.msg}
                </div>
            )}
        </div>
    );
};

// ─── styles ───────────────────────────────────────────────────────────────────
const S = {
    wrapper: { background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', marginBottom: '1.25rem', padding: '1.25rem 1.5rem', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.1rem', flexWrap: 'wrap', gap: '0.75rem' },
    iconBox: { background: '#eff6ff', padding: '0.6rem', borderRadius: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    title: { fontWeight: 700, fontSize: '1rem', color: '#1e293b' },
    subtitle: { fontSize: '0.78rem', color: '#64748b', marginTop: '0.1rem' },
    loading: { color: '#94a3b8', fontSize: '0.88rem', padding: '1rem 0' },
    list: { display: 'flex', flexDirection: 'column', gap: '1rem' },

    medCard: { background: '#f8faff', borderRadius: 12, padding: '1rem 1.1rem', border: '1px solid #e0e7ff', display: 'flex', flexDirection: 'column', gap: '0.75rem' },
    medHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' },
    medName: { fontWeight: 700, fontSize: '1rem', color: '#1e293b' },
    medMeta: { fontSize: '0.82rem', color: '#475569', marginTop: '0.15rem' },
    instructions: { fontSize: '0.8rem', color: '#6366f1', marginTop: '0.2rem' },
    doctor: { fontSize: '0.76rem', color: '#94a3b8', marginTop: '0.2rem' },
    doneBadge: { display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: '#f0fdf4', color: '#16a34a', fontSize: '0.78rem', fontWeight: 700, padding: '0.25rem 0.65rem', borderRadius: 999, border: '1px solid #86efac', whiteSpace: 'nowrap' },

    timeline: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' },
    doseChip: { display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.3rem 0.7rem', borderRadius: 999, fontSize: '0.8rem', fontWeight: 700, border: '1px solid' },
    doseChip_upcoming: { background: '#eff6ff', color: '#3b82f6', borderColor: '#bfdbfe' },
    doseChip_due: { background: '#fffbeb', color: '#d97706', borderColor: '#fcd34d' },
    doseChip_overdue: { background: '#fef2f2', color: '#dc2626', borderColor: '#fca5a5' },
    doseLabel: { fontSize: '0.7rem', fontWeight: 500, opacity: 0.75 },

    btnTake: { alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1.1rem', borderRadius: 8, background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem' },
    btnNotif: { display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.85rem', borderRadius: 8, background: '#6366f1', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' },
    btnRefresh: { display: 'inline-flex', alignItems: 'center', padding: '0.4rem', borderRadius: 8, background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', cursor: 'pointer' },

    toast: { marginTop: '0.75rem', padding: '0.6rem 1rem', borderRadius: 8, fontSize: '0.88rem', fontWeight: 600, border: '1px solid', background: '#f0fdf4' },
};

export default MedicationReminders;

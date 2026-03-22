import React, { useEffect, useState, useCallback } from 'react';
import api from '../../api/axios';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import { ShieldCheck, Search, Filter, X, Clock, User, Activity } from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────────────────────
const ACTION_LABELS = {
    vital_recorded: { label: 'Vitals Recorded', color: '#0ea5e9', bg: '#e0f2fe' },
    vital_updated: { label: 'Vitals Updated', color: '#0ea5e9', bg: '#e0f2fe' },
    consultation_created: { label: 'Consultation Created', color: '#7c3aed', bg: '#ede9fe' },
    consultation_updated: { label: 'Consultation Updated', color: '#7c3aed', bg: '#ede9fe' },
    prescription_added: { label: 'Prescription Added', color: '#d97706', bg: '#fef3c7' },
    medication_administered: { label: 'Medication Administered', color: '#059669', bg: '#d1fae5' },
    admission_created: { label: 'Patient Admitted', color: '#dc2626', bg: '#fee2e2' },
    patient_discharged: { label: 'Patient Discharged', color: '#16a34a', bg: '#dcfce7' },
    nurse_task_completed: { label: 'Task Completed', color: '#2563eb', bg: '#dbeafe' },
    appointment_status: { label: 'Appointment Status', color: '#64748b', bg: '#f1f5f9' },
    feedback_submitted: { label: 'Feedback Submitted', color: '#7c3aed', bg: '#ede9fe' },
};

const ROLE_COLORS = {
    doctor: { color: '#7c3aed', bg: '#ede9fe' },
    nurse: { color: '#0ea5e9', bg: '#e0f2fe' },
    admin: { color: '#dc2626', bg: '#fee2e2' },
    patient: { color: '#059669', bg: '#d1fae5' },
};

const ActionBadge = ({ action }) => {
    const meta = ACTION_LABELS[action] || { label: action, color: '#64748b', bg: '#f1f5f9' };
    return (
        <span style={{
            display: 'inline-block',
            padding: '0.2rem 0.65rem',
            borderRadius: '2rem',
            fontSize: '0.73rem',
            fontWeight: 600,
            letterSpacing: '0.01em',
            color: meta.color,
            background: meta.bg,
            whiteSpace: 'nowrap',
        }}>
            {meta.label}
        </span>
    );
};

const RoleBadge = ({ role }) => {
    const c = ROLE_COLORS[role] || { color: '#64748b', bg: '#f1f5f9' };
    return (
        <span style={{
            display: 'inline-block',
            padding: '0.15rem 0.5rem',
            borderRadius: '2rem',
            fontSize: '0.68rem',
            fontWeight: 700,
            textTransform: 'capitalize',
            color: c.color,
            background: c.bg,
        }}>
            {role}
        </span>
    );
};

const DetailsCell = ({ details }) => {
    const [open, setOpen] = useState(false);
    if (!details || Object.keys(details).length === 0) return <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>;
    return (
        <div>
            <button
                onClick={() => setOpen(o => !o)}
                style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--primary-color)', fontSize: '0.78rem', fontWeight: 600, padding: 0,
                }}
            >
                {open ? 'Hide ▲' : 'Show ▼'}
            </button>
            {open && (
                <pre style={{
                    marginTop: '0.4rem', padding: '0.5rem 0.75rem',
                    background: 'var(--hover-bg)', borderRadius: '0.4rem',
                    fontSize: '0.72rem', color: 'var(--text-muted)',
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    maxWidth: 260,
                }}>
                    {JSON.stringify(details, null, 2)}
                </pre>
            )}
        </div>
    );
};

// ── Main Component ────────────────────────────────────────────────────────────
const AuditLog = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [actionFilter, setActionFilter] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (search) params.append('search', search);
            if (actionFilter) params.append('action', actionFilter);
            if (dateFrom) params.append('date_from', dateFrom);
            if (dateTo) params.append('date_to', dateTo);
            const res = await api.get(`/admin/audit-log/?${params.toString()}`);
            setLogs(Array.isArray(res.data) ? res.data : res.data.results || []);
        } catch (err) {
            console.error('Failed to fetch audit log', err);
        } finally {
            setLoading(false);
        }
    }, [search, actionFilter, dateFrom, dateTo]);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    const clearFilters = () => {
        setSearch('');
        setActionFilter('');
        setDateFrom('');
        setDateTo('');
    };

    const hasFilters = search || actionFilter || dateFrom || dateTo;

    return (
        <div className="fade-in">
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                <ShieldCheck size={26} color="var(--primary-color)" />
                <h1 style={{ margin: 0 }}>Audit Log</h1>
            </div>
            <p className="text-muted mb-2">
                A tamper-evident record of every clinical action taken in the system.
            </p>

            {/* Filters */}
            <div className="card mb-2" style={{ padding: '1rem 1.25rem' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
                    {/* Search */}
                    <div style={{ flex: '1 1 200px' }}>
                        <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem', color: 'var(--text-muted)' }}>
                            <Search size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                            Search actor / patient
                        </label>
                        <input
                            className="form-control"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Name or username…"
                        />
                    </div>

                    {/* Action filter */}
                    <div style={{ flex: '1 1 190px' }}>
                        <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem', color: 'var(--text-muted)' }}>
                            <Filter size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                            Action type
                        </label>
                        <select className="form-control" value={actionFilter} onChange={e => setActionFilter(e.target.value)}>
                            <option value="">All actions</option>
                            {Object.entries(ACTION_LABELS).map(([key, { label }]) => (
                                <option key={key} value={key}>{label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Date From */}
                    <div style={{ flex: '1 1 145px' }}>
                        <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem', color: 'var(--text-muted)' }}>
                            <Clock size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                            From date
                        </label>
                        <input type="date" className="form-control" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                    </div>

                    {/* Date To */}
                    <div style={{ flex: '1 1 145px' }}>
                        <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem', color: 'var(--text-muted)' }}>
                            <Clock size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                            To date
                        </label>
                        <input type="date" className="form-control" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                    </div>

                    {hasFilters && (
                        <button
                            onClick={clearFilters}
                            style={{
                                alignSelf: 'flex-end',
                                background: 'var(--hover-bg)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '0.5rem',
                                padding: '0.5rem 0.9rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                fontSize: '0.82rem',
                            }}
                        >
                            <X size={14} /> Clear
                        </button>
                    )}
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <LoadingSkeleton />
            ) : logs.length === 0 ? (
                <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <ShieldCheck size={40} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
                    <p>No audit log entries found{hasFilters ? ' for the selected filters' : ''}.</p>
                </div>
            ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead>
                                <tr style={{ background: 'var(--hover-bg)', borderBottom: '1px solid var(--border-color)' }}>
                                    {['Timestamp', 'Action', 'Performed By', 'Patient', 'Details'].map(h => (
                                        <th key={h} style={{
                                            padding: '0.75rem 1rem',
                                            textAlign: 'left',
                                            fontWeight: 700,
                                            fontSize: '0.75rem',
                                            color: 'var(--text-muted)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            whiteSpace: 'nowrap',
                                        }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((log, idx) => (
                                    <tr
                                        key={log.id}
                                        style={{
                                            borderBottom: '1px solid var(--border-color)',
                                            background: idx % 2 === 0 ? 'transparent' : 'var(--hover-bg)',
                                            transition: 'background 0.15s',
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-light, #eff6ff)'}
                                        onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'var(--hover-bg)'}
                                    >
                                        {/* Timestamp */}
                                        <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                                            <div style={{ fontWeight: 600, color: 'var(--text-color)' }}>
                                                {new Date(log.timestamp).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </div>
                                            <div>{new Date(log.timestamp).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}</div>
                                        </td>

                                        {/* Action */}
                                        <td style={{ padding: '0.75rem 1rem' }}>
                                            <ActionBadge action={log.action} />
                                        </td>

                                        {/* Actor */}
                                        <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <User size={14} color="var(--text-muted)" />
                                                <div>
                                                    <div style={{ fontWeight: 600 }}>{log.actor_name}</div>
                                                    <RoleBadge role={log.actor_role} />
                                                </div>
                                            </div>
                                        </td>

                                        {/* Patient */}
                                        <td style={{ padding: '0.75rem 1rem', color: log.patient_name ? 'var(--text-color)' : 'var(--text-muted)', fontStyle: log.patient_name ? 'normal' : 'italic' }}>
                                            {log.patient_name || '—'}
                                        </td>

                                        {/* Details */}
                                        <td style={{ padding: '0.75rem 1rem' }}>
                                            <DetailsCell details={log.details} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer count */}
                    <div style={{
                        padding: '0.6rem 1.25rem',
                        borderTop: '1px solid var(--border-color)',
                        fontSize: '0.78rem',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                    }}>
                        <Activity size={13} />
                        Showing <strong>{logs.length}</strong> {logs.length === 1 ? 'entry' : 'entries'}
                        {hasFilters && ' (filtered)'}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AuditLog;

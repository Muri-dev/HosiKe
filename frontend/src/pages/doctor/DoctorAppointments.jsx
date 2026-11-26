import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { Search, Filter, Calendar, Clock, ArrowRight, CheckCircle, AlertCircle, Zap, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';

// ── Urgency config ────────────────────────────────────────────────────────────
const URGENCY_CONFIG = {
    emergency: { label: 'Emergency', color: '#dc2626', bg: 'rgba(220,38,38,0.08)', border: '#dc2626', icon: Zap, pulse: true },
    urgent: { label: 'Urgent', color: '#ea580c', bg: 'rgba(234,88,12,0.08)', border: '#ea580c', icon: AlertTriangle, pulse: false },
    normal: { label: 'Normal', color: '#16a34a', bg: 'rgba(22,163,74,0.06)', border: 'transparent', icon: null, pulse: false },
};

const UrgencyBadge = ({ urgency }) => {
    const cfg = URGENCY_CONFIG[urgency] || URGENCY_CONFIG.normal;
    const Icon = cfg.icon;
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
            background: cfg.bg, color: cfg.color,
            border: `1px solid ${cfg.color}`,
            borderRadius: '1rem', padding: '0.15rem 0.6rem',
            fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
            {Icon && <Icon size={11} />}
            {cfg.label}
            {cfg.pulse && <span className="urgency-pulse" />}
        </span>
    );
};

// ── Status badge ──────────────────────────────────────────────────────────────
const STATUS_COLORS = {
    pending: 'secondary', approved: 'primary',
    in_progress: 'warning', completed: 'success', cancelled: 'danger',
};

const StatusBadge = ({ status }) => (
    <span className={`badge badge-${STATUS_COLORS[status] || 'secondary'} flex-center gap-1 uppercase tracking-wide text-xs`}>
        {status.replace('_', ' ')}
    </span>
);

// ── Main component ────────────────────────────────────────────────────────────
const DoctorAppointments = () => {
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const [filters, setFilters] = useState({
        status: '',
        date: 'all',
        search: '',
        urgency: 'all',
        triage_ready: false,
    });

    const fetchAppointments = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.status) params.append('status', filters.status);
            if (filters.date) params.append('date', filters.date);
            if (filters.search) params.append('search', filters.search);
            if (filters.urgency && filters.urgency !== 'all') params.append('urgency', filters.urgency);
            if (filters.triage_ready) params.append('triage_ready', 'true');

            const response = await api.get('/doctor/appointments/?' + params.toString());
            setAppointments(response.data);
        } catch (error) {
            console.error('Failed to fetch appointments', error);
        }
        setLoading(false);
    };

    useEffect(() => { fetchAppointments(); }, [filters]);

    // ── Emergency count badge ─────────────────────────────────────────────────
    const emergencyCount = appointments.filter(a => a.urgency === 'emergency').length;
    const urgentCount = appointments.filter(a => a.urgency === 'urgent').length;

    return (
        <div className="fade-in">
            {/* ── Header ─────────────────────────────────────────────────────── */}
            <div className="flex-between mb-2">
                <div>
                    <h1>Patient Queue</h1>
                    <p className="text-muted">Manage your appointments and consultations.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {emergencyCount > 0 && (
                        <span style={{
                            background: 'rgba(220,38,38,0.1)', color: '#dc2626',
                            border: '1px solid #dc2626', borderRadius: '1rem',
                            padding: '0.3rem 0.9rem', fontWeight: 700, fontSize: '0.85rem',
                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                        }}>
                            <Zap size={14} /> {emergencyCount} Emergency
                        </span>
                    )}
                    {urgentCount > 0 && (
                        <span style={{
                            background: 'rgba(234,88,12,0.1)', color: '#ea580c',
                            border: '1px solid #ea580c', borderRadius: '1rem',
                            padding: '0.3rem 0.9rem', fontWeight: 700, fontSize: '0.85rem',
                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                        }}>
                            <AlertTriangle size={14} /> {urgentCount} Urgent
                        </span>
                    )}
                    <button className="btn-outline" onClick={fetchAppointments}>Refresh List</button>
                </div>
            </div>

            {/* ── Status Tabs ────────────────────────────────────────────────── */}
            <div className="flex-start gap-1 mb-2">
                <button
                    className={`btn-${filters.status === 'pending_approval' ? 'primary' : 'outline'}`}
                    onClick={() => setFilters({ ...filters, status: 'pending_approval', urgency: 'all' })}
                >
                    Requests{' '}
                    {filters.status === 'pending_approval' && (
                        <span className="badge bg-white text-primary ml-0_5">{appointments.length}</span>
                    )}
                </button>
                <button
                    className={`btn-${filters.status === '' ? 'primary' : 'outline'}`}
                    onClick={() => setFilters({ ...filters, status: '' })}
                >
                    All Appointments
                </button>
                <button
                    className={`btn-${filters.date === 'today' ? 'primary' : 'outline'}`}
                    onClick={() => setFilters({ ...filters, date: 'today', status: '' })}
                >
                    Today's Schedule
                </button>
            </div>

            {/* ── Urgency Quick-Filter Tabs ───────────────────────────────────── */}
            <div className="flex-start gap-0_5 mb-2">
                {['all', 'emergency', 'urgent', 'normal'].map(u => {
                    const cfg = URGENCY_CONFIG[u] || {};
                    const isActive = filters.urgency === u;
                    const count = u === 'all'
                        ? appointments.length
                        : appointments.filter(a => a.urgency === u).length;
                    return (
                        <button
                            key={u}
                            onClick={() => setFilters({ ...filters, urgency: u })}
                            style={{
                                padding: '0.3rem 0.85rem',
                                borderRadius: '1.5rem',
                                border: `1px solid ${isActive ? (cfg.color || 'var(--primary)') : 'var(--border-color)'}`,
                                background: isActive ? (cfg.bg || 'rgba(var(--primary-rgb),0.1)') : 'transparent',
                                color: isActive ? (cfg.color || 'var(--primary)') : 'var(--text-muted)',
                                fontWeight: isActive ? 700 : 400,
                                fontSize: '0.82rem',
                                cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '0.35rem',
                                transition: 'all 0.15s',
                            }}
                        >
                            {u === 'all' ? 'All Urgency' : cfg.label}
                            <span style={{
                                background: isActive ? cfg.color : 'var(--border-color)',
                                color: isActive ? '#fff' : 'var(--text-muted)',
                                borderRadius: '1rem', padding: '0 0.35rem',
                                fontSize: '0.72rem', fontWeight: 700,
                            }}>{count}</span>
                        </button>
                    );
                })}
            </div>

            {/* ── Search / Filter Bar ─────────────────────────────────────────── */}
            {filters.status !== 'pending_approval' && (
                <div className="card mb-2 p-1">
                    <div className="filter-grid">
                        <div className="search-box">
                            <Search size={18} className="text-muted" />
                            <input
                                placeholder="Search patient name..."
                                value={filters.search}
                                onChange={e => setFilters({ ...filters, search: e.target.value })}
                            />
                        </div>

                        <select
                            value={filters.date}
                            onChange={e => setFilters({ ...filters, date: e.target.value })}
                            className="form-select"
                        >
                            <option value="today">Today's Schedule</option>
                            <option value="upcoming">Upcoming</option>
                            <option value="all">All History</option>
                        </select>

                        <select
                            value={filters.status}
                            onChange={e => setFilters({ ...filters, status: e.target.value })}
                            className="form-select"
                        >
                            <option value="">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                        </select>

                        <label className={`toggle-btn ${filters.triage_ready ? 'active' : ''}`}>
                            <input
                                type="checkbox"
                                checked={filters.triage_ready}
                                onChange={e => setFilters({ ...filters, triage_ready: e.target.checked })}
                                style={{ display: 'none' }}
                            />
                            <Filter size={16} /> Triaged Only
                        </label>
                    </div>
                </div>
            )}

            {/* ── Appointment List ─────────────────────────────────────────────── */}
            {loading ? <LoadingSkeleton count={3} /> : (
                <div className="appointment-list">
                    {appointments.length === 0 ? (
                        <div className="text-center p-4 text-muted card">
                            <Calendar size={48} className="mb-1 opacity-25" />
                            <h3>No appointments found</h3>
                            <p>Try adjusting your filters.</p>
                        </div>
                    ) : (
                        appointments.map(appt => {
                            const ucfg = URGENCY_CONFIG[appt.urgency] || URGENCY_CONFIG.normal;
                            const isEmergency = appt.urgency === 'emergency';
                            return (
                                <div
                                    key={appt.id}
                                    className="card appointment-card flex-between p-1_5 mb-1 hover-shadow"
                                    style={{
                                        borderLeft: `4px solid ${ucfg.color}`,
                                        background: isEmergency ? ucfg.bg : undefined,
                                        transition: 'all 0.2s',
                                    }}
                                >
                                    <div className="flex-start gap-1_5">
                                        {/* Avatar */}
                                        <div
                                            className="avatar-placeholder rounded-circle flex-center"
                                            style={{
                                                width: '50px', height: '50px',
                                                fontSize: '1.2rem', fontWeight: 700,
                                                background: ucfg.bg || 'var(--bg-secondary)',
                                                color: ucfg.color || 'var(--primary)',
                                                border: `2px solid ${ucfg.color}`,
                                            }}
                                        >
                                            {appt.patient_name.charAt(0)}
                                        </div>

                                        <div>
                                            {/* Name row */}
                                            <div className="flex-start gap-1 mb-0_5">
                                                <h3 className="mb-0">{appt.patient_name}</h3>
                                                <StatusBadge status={appt.status} />
                                                <UrgencyBadge urgency={appt.urgency || 'normal'} />
                                            </div>
                                            {/* Meta row */}
                                            <div className="text-muted text-sm flex-start gap-1">
                                                <span className="flex-center gap-0_5">
                                                    <Clock size={14} /> {new Date(appt.date_time).toLocaleString()}
                                                </span>
                                                <span className="flex-center gap-0_5">
                                                    <AlertCircle size={14} /> {appt.reason}
                                                </span>
                                            </div>

                                            {/* Approve/Reject actions */}
                                            {appt.status === 'pending_approval' && (
                                                <div className="mt-1 flex-start gap-1">
                                                    <button
                                                        className="btn-success btn-sm"
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            try {
                                                                await api.post(`/doctor/appointments/${appt.id}/approve/`);
                                                                fetchAppointments();
                                                            } catch { alert('Failed to approve'); }
                                                        }}
                                                    >
                                                        <CheckCircle size={14} /> Approve
                                                    </button>
                                                    <button
                                                        className="btn-danger btn-sm"
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            if (!window.confirm('Reject this appointment?')) return;
                                                            try {
                                                                await api.post(`/doctor/appointments/${appt.id}/reject/`, { reason: 'Schedule conflict' });
                                                                fetchAppointments();
                                                            } catch { alert('Failed to reject'); }
                                                        }}
                                                    >
                                                        Reject
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <button className="btn-primary" onClick={() => navigate(`/doctor/appointments/${appt.id}`)}>
                                        Open Workbench <ArrowRight size={16} className="ml-0_5" />
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            <style>{`
                .filter-grid {
                    display: grid;
                    grid-template-columns: 2fr 1fr 1fr auto;
                    gap: 1rem;
                    align-items: center;
                }
                .search-box {
                    display: flex;
                    align-items: center;
                    background: var(--bg-secondary);
                    padding: 0.5rem 1rem;
                    border-radius: var(--radius);
                    gap: 0.5rem;
                }
                .search-box input {
                    border: none;
                    background: transparent;
                    width: 100%;
                    outline: none;
                }
                .form-select {
                    padding: 0.5rem;
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius);
                    background: white;
                }
                .toggle-btn {
                    padding: 0.5rem 1rem;
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    transition: all 0.2s;
                }
                .toggle-btn.active {
                    background: rgba(var(--primary-rgb), 0.1);
                    border-color: var(--primary);
                    color: var(--primary);
                    font-weight: 500;
                }
                .appointment-card {
                    transition: transform 0.2s;
                }
                .hover-shadow:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 5px 15px rgba(0,0,0,0.07);
                }
                /* Pulsing dot for emergency */
                .urgency-pulse {
                    display: inline-block;
                    width: 7px; height: 7px;
                    border-radius: 50%;
                    background: #dc2626;
                    animation: pulse-ring 1.2s ease infinite;
                    vertical-align: middle;
                }
                @keyframes pulse-ring {
                    0%   { box-shadow: 0 0 0 0 rgba(220,38,38,0.5); }
                    70%  { box-shadow: 0 0 0 6px rgba(220,38,38,0); }
                    100% { box-shadow: 0 0 0 0 rgba(220,38,38,0); }
                }
                @media (max-width: 768px) {
                    .filter-grid { grid-template-columns: 1fr; }
                    .appointment-card { flex-direction: column; align-items: flex-start; gap: 1rem; }
                    .appointment-card button { width: 100%; }
                }
            `}</style>
        </div>
    );
};

export default DoctorAppointments;

import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { Search, Filter, Calendar, User, Clock, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';

const DoctorAppointments = () => {
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const [filters, setFilters] = useState({
        status: '',
        date: 'all',
        search: '',
        triage_ready: false
    });

    const fetchAppointments = async () => {
        setLoading(true);
        try {
            let url = '/doctor/appointments/?';
            const params = new URLSearchParams();
            if (filters.status) params.append('status', filters.status);
            if (filters.date) params.append('date', filters.date);
            if (filters.search) params.append('search', filters.search);
            if (filters.triage_ready) params.append('triage_ready', 'true');

            const response = await api.get(url + params.toString());
            setAppointments(response.data);
        } catch (error) {
            console.error("Failed to fetch appointments", error);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchAppointments();
    }, [filters]);

    // Helper for status badge
    const StatusBadge = ({ status }) => {
        const colors = {
            pending: 'secondary',
            approved: 'primary',
            in_progress: 'warning',
            completed: 'success',
            cancelled: 'danger'
        };
        const color = colors[status] || 'secondary';
        return (
            <span className={`badge badge-${color} flex-center gap-1 uppercase tracking-wide text-xs`}>
                {status.replace('_', ' ')}
            </span>
        );
    };

    return (
        <div className="fade-in">
            <div className="flex-between mb-2">
                <div>
                    <h1>Patient Queue</h1>
                    <p className="text-muted">Manage your appointments and consultations.</p>
                </div>
                <button className="btn-outline" onClick={fetchAppointments}>Refresh List</button>
            </div>

            {/* Dashboard Tabs/Status Filter */}
            <div className="flex-start gap-1 mb-2">
                <button
                    className={`btn-${filters.status === 'pending_approval' ? 'primary' : 'outline'}`}
                    onClick={() => setFilters({ ...filters, status: 'pending_approval' })}
                >
                    Requests {filters.status === 'pending_approval' && <span className="badge bg-white text-primary ml-0_5">{appointments.length}</span>}
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

            {/* Filter Bar (Conditional) */}
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

            {/* List Content */}
            {loading ? <LoadingSkeleton count={3} /> : (
                <div className="appointment-list">
                    {appointments.length === 0 ? (
                        <div className="text-center p-4 text-muted card">
                            <Calendar size={48} className="mb-1 opacity-25" />
                            <h3>No appointments found</h3>
                            <p>Try adjusting your filters.</p>
                        </div>
                    ) : (
                        appointments.map(appt => (
                            <div key={appt.id} className="card appointment-card flex-between p-1_5 mb-1 hover-shadow">
                                <div className="flex-start gap-1_5">
                                    <div className="avatar-placeholder bg-light text-primary rounded-circle flex-center" style={{ width: '50px', height: '50px', fontSize: '1.2rem', fontWeight: 700 }}>
                                        {appt.patient_name.charAt(0)}
                                    </div>
                                    <div>
                                        <div className="flex-start gap-1 mb-0_5">
                                            <h3 className="mb-0">{appt.patient_name}</h3>
                                            <StatusBadge status={appt.status} />
                                        </div>
                                        <div className="text-muted text-sm flex-start gap-1">
                                            <span className="flex-center gap-0_5"><Clock size={14} /> {new Date(appt.date_time).toLocaleString()}</span>
                                            <span className="flex-center gap-0_5"><AlertCircle size={14} /> {appt.reason}</span>
                                        </div>
                                        {appt.status === 'pending_approval' && (
                                            <div className="mt-1 flex-start gap-1">
                                                <button
                                                    className="btn-success btn-sm"
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        try {
                                                            await api.post(`/doctor/appointments/${appt.id}/approve/`);
                                                            fetchAppointments();
                                                        } catch (err) { alert('Failed to approve'); }
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
                                                        } catch (err) { alert('Failed to reject'); }
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
                        ))
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
                    box-shadow: 0 5px 15px rgba(0,0,0,0.05);
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

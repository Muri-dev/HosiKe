import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { Users, UserPlus, Calendar, Clock, Activity, TrendingUp, Pill } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const AdminDashboard = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await api.get('/admin/overview/');
                setStats(response.data);
            } catch (error) {
                console.error("Failed to fetch stats", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) return <div className="loading-spinner">Loading Dashboard...</div>;
    if (!stats) return <div className="error-banner">Failed to load dashboard data.</div>;

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

    return (
        <div>
            <h1 className="flex-between">Hospital Overview</h1>

            {/* KPI Cards */}
            <div className="kpi-grid">
                <div className="card">
                    <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
                        <h3>Patients</h3>
                        <Users size={20} className="text-muted" />
                    </div>
                    <div className="value">{stats.kpis.total_patients}</div>
                </div>
                <div className="card">
                    <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
                        <h3>Staff</h3>
                        <UserPlus size={20} className="text-muted" />
                    </div>
                    <div className="value">{stats.kpis.total_doctors + stats.kpis.total_nurses}</div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{stats.kpis.total_doctors} Docs, {stats.kpis.total_nurses} Nurses</p>
                </div>
                <div className="card">
                    <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
                        <h3>Today's Appts</h3>
                        <Calendar size={20} className="text-muted" />
                    </div>
                    <div className="value">{stats.kpis.appointments_today}</div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{stats.kpis.completed_today} Completed</p>
                </div>
                <div className="card">
                    <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
                        <h3>Pending</h3>
                        <Clock size={20} className="text-red" />
                    </div>
                    <div className="value" style={{ color: '#c2410c' }}>{stats.kpis.pending_appointments}</div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{stats.kpis.unassigned_appointments} Unassigned Today</p>
                </div>
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                <div className="card hover-scale" onClick={() => navigate('/admin/remote-referrals')} style={{ cursor: 'pointer', borderLeft: '4px solid #f59e0b', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ padding: '0.5rem', borderRadius: '50%', background: '#fef3c7', color: '#d97706' }}><Activity size={24} /></div>
                    <div>
                        <h3 style={{ margin: 0 }}>Remote Referrals</h3>
                        <p className="text-muted text-sm" style={{ margin: 0 }}>Assign patient vitals</p>
                    </div>
                </div>
                <div className="card hover-scale" onClick={() => navigate('/admin/inpatient-orders')} style={{ cursor: 'pointer', borderLeft: '4px solid #10b981', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ padding: '0.5rem', borderRadius: '50%', background: '#dcfce7', color: '#16a34a' }}><Pill size={24} /></div>
                    <div>
                        <h3 style={{ margin: 0 }}>Pharmacy Orders</h3>
                        <p className="text-muted text-sm" style={{ margin: 0 }}>Manage inpatient medications</p>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                {/* Appointment Trend Chart */}
                <div className="card" style={{ height: '400px' }}>
                    <div className="flex-between">
                        <h3>Appointment Trends (Last 7 Days)</h3>
                        <TrendingUp size={18} className="text-muted" />
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.trend}>
                            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Bar dataKey="count" fill="var(--primary-color)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Status Distribution */}
                <div className="card" style={{ height: '400px' }}>
                    <h3>Status Distribution</h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={stats.status_distribution}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="count"
                                nameKey="status"
                            >
                                {stats.status_distribution.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                    <div style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        {stats.status_distribution.map((entry, index) => (
                            <span key={index} style={{ marginRight: '10px' }}>
                                <span style={{ display: 'inline-block', width: '10px', height: '10px', backgroundColor: COLORS[index % COLORS.length], marginRight: '5px', borderRadius: '50%' }}></span>
                                {entry.status} ({entry.count})
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                {/* Recent Activity */}
                <div className="card">
                    <div className="flex-between">
                        <h3>Recent Activity</h3>
                        <Activity size={18} className="text-muted" />
                    </div>
                    <div>
                        {stats.recent_activity.length > 0 ? (
                            <ul style={{ listStyle: 'none', padding: 0 }}>
                                {stats.recent_activity.map((act, i) => (
                                    <li key={i} style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '0.75rem', fontSize: '0.9rem' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary-color)', marginTop: '6px' }}></div>
                                        <div>
                                            <p style={{ margin: 0 }}>{act.message}</p>
                                            <small className="text-muted">{new Date(act.created_at).toLocaleString()}</small>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : <p className="text-muted">No recent activity.</p>}
                    </div>
                </div>

                {/* Doctor Workload */}
                <div className="card">
                    <h3>Doctor Workload (Today)</h3>
                    {stats.doctor_workload.length > 0 ? (
                        <ul style={{ listStyle: 'none', padding: 0 }}>
                            {stats.doctor_workload.map((doc, i) => (
                                <li key={i} className="flex-between" style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--border-color)' }}>
                                    <span>Dr. {doc.assigned_doctor__first_name} {doc.assigned_doctor__last_name}</span>
                                    <span className="badge">{doc.count} Appts</span>
                                </li>
                            ))}
                        </ul>
                    ) : <p className="text-muted">No appointments assigned today.</p>}
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;

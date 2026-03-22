import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { Calendar, Activity, CheckCircle, Clock, Users, ArrowRight, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import Toast from '../../components/common/Toast';

const DoctorDashboard = () => {
    const [stats, setStats] = useState(null);
    const [schedule, setSchedule] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                const response = await api.get('/doctor/dashboard/');
                setStats(response.data.kpis);
                setSchedule(response.data.schedule);
            } catch (error) {
                console.error("Failed to fetch dashboard", error);
            } finally {
                setLoading(false);
            }
        };
        fetchDashboard();
    }, []);

    if (loading) return <LoadingSkeleton />;

    const KPICard = ({ title, value, icon: Icon, color, subtext }) => (
        <div className="card hover-scale" style={{
            borderLeft: `4px solid var(--${color})`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1.5rem'
        }}>
            <div>
                <p className="text-muted text-sm uppercase tracking-wide mb-1">{title}</p>
                <h2 className={`text-${color} mb-0`} style={{ fontSize: '2rem' }}>{value}</h2>
                {subtext && <p className="text-xs text-muted mt-1">{subtext}</p>}
            </div>
            <div style={{
                background: `rgba(var(--${color}-rgb), 0.1)`,
                padding: '1rem',
                borderRadius: '50%',
                color: `var(--${color})`
            }}>
                <Icon size={24} />
            </div>
        </div>
    );

    return (
        <div className="fade-in">
            <header className="mb-2 flex-between">
                <div>
                    <h1 className="mb-0">Welcome Back, Doctor</h1>
                    <p className="text-muted">Here's your clinical overview for today.</p>
                </div>
                <button className="btn-primary" onClick={() => navigate('/doctor/appointments')}>
                    View All Appointments <ArrowRight size={16} style={{ marginLeft: '0.5rem' }} />
                </button>
            </header>

            {/* KPI Grid */}
            <div className="grid-4 gap-2 mb-3">
                <KPICard
                    title="Appointments Today"
                    value={stats?.appointments_today || 0}
                    icon={Calendar}
                    color="primary"
                    subtext="Scheduled visits"
                />
                <KPICard
                    title="Waiting / Triaged"
                    value={stats?.triaged_ready || 0}
                    icon={Users}
                    color="warning"
                    subtext="Ready for consultation"
                />
                <KPICard
                    title="In Progress"
                    value={stats?.in_progress || 0}
                    icon={Activity}
                    color="info"
                    subtext="Currently being seen"
                />
                <KPICard
                    title="Completed"
                    value={stats?.completed_today || 0}
                    icon={CheckCircle}
                    color="success"
                    subtext="Successfully discharged"
                />
            </div>

            <div className="grid-3 gap-2" style={{ gridTemplateColumns: '2fr 1fr' }}>
                {/* Main: Today's Timeline */}
                <div className="card" style={{ gridColumn: 'span 2' }}>
                    <div className="flex-between mb-2 pb-1 border-bottom">
                        <h3>Today's Schedule</h3>
                        <span className="text-muted text-sm">{new Date().toLocaleDateString()}</span>
                    </div>

                    {schedule.length === 0 ? (
                        <div className="text-center p-4 text-muted">
                            <Calendar size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                            <p>No appointments scheduled for today.</p>
                        </div>
                    ) : (
                        <div className="timeline-list">
                            {schedule.map((appt, idx) => {
                                const time = new Date(appt.date_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                const isPast = new Date(appt.date_time) < new Date();
                                const isCompleted = appt.status === 'completed';

                                return (
                                    <div key={appt.id} className="timeline-item hover-bg p-1 rounded mb-1 flex-between" style={{ borderLeft: `3px solid var(--${isCompleted ? 'success' : 'primary'})` }}>
                                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                            <div className="text-center" style={{ minWidth: '60px' }}>
                                                <strong className="d-block text-lg">{time}</strong>
                                                <span className="text-xs text-muted">{appt.status}</span>
                                            </div>
                                            <div>
                                                <h4 className="mb-0">{appt.patient_name}</h4>
                                                <p className="text-sm text-muted mb-0">{appt.reason}</p>
                                            </div>
                                        </div>
                                        <button
                                            className={`btn-${isCompleted ? 'outline' : 'primary'} btn-sm`}
                                            onClick={() => navigate(`/doctor/appointments/${appt.id}`)}
                                        >
                                            {isCompleted ? 'View' : 'Open'}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Sidebar: Quick Stats / Notifications */}
                <div className="card bg-gradient-primary text-white">
                    <h3>Weekly Insight</h3>
                    <p className="mb-2 opacity-75">You have {stats?.upcoming_7_days || 0} upcoming appointments in the next 7 days.</p>

                    <div className="mt-2 pt-2 border-top" style={{ borderColor: 'rgba(255,255,255,0.2)' }}>
                        <h4 className="flex-start gap-0_5 mb-0_5" style={{ cursor: 'pointer' }} onClick={() => navigate('/doctor/remote-monitoring')}>
                            <Activity size={20} /> Remote Monitoring <ArrowRight size={16} />
                        </h4>
                        <p className="text-sm opacity-75">Review patient vitals</p>
                    </div>
                </div>
            </div>

            <style>{`
                .hover-scale { transition: transform 0.2s, box-shadow 0.2s; }
                .hover-scale:hover { transform: translateY(-3px); box-shadow: 0 10px 20px rgba(0,0,0,0.1); }
                .hover-bg { transition: background 0.2s; }
                .hover-bg:hover { background: var(--bg-secondary); }
                .bg-gradient-primary { 
                    background: linear-gradient(135deg, var(--primary), #2563eb); 
                    color: white;
                }
                .text-light { color: #f8f9fa !important; }
                .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); }
                @media (max-width: 900px) {
                    .grid-3 { grid-template-columns: 1fr !important; }
                    .card[style*="span 2"] { grid-column: span 1 !important; }
                }
            `}</style>
        </div>
    );
};

export default DoctorDashboard;

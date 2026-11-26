import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import {
    LayoutDashboard,
    Users,
    Calendar,
    Activity,
    LogOut,
    Menu,
    X,
    FileText,
    PieChart,
    Bed,
    Clipboard,
    CheckSquare,
    MessageSquare,
    Search,
    ShieldCheck,
    Wifi,
    Sparkles,
    HeartPulse,
    UserCircle,
    Bell
} from 'lucide-react';
import AIAssistant from './AIAssistant';

const ROLE_TITLES = {
    admin: 'Hospital Administration Portal',
    doctor: 'Doctor Clinical Station',
    nurse: 'Nurse Care & Triage Unit',
    patient: 'Patient Health Portal',
};

const Sidebar = ({ user, isOpen, toggleSidebar, notifications, setNotifications }) => {
    const location = useLocation();
    const { logout } = useAuth();
    const role = user?.role;

    const handleNavClick = (path) => {
        const badgeKey = getBadgeKey(path);
        if (badgeKey && setNotifications) {
            setNotifications(prev => ({ ...prev, [badgeKey]: 0 }));
        }
        if (window.innerWidth <= 768) toggleSidebar();
    };

    const getBadgeKey = (path) => {
        if (path === '/messages') return 'messages';
        if (path === '/admin/appointments' || path === '/doctor/requests') return 'appointments';
        if (path === '/admin/remote-referrals' || path === '/doctor/remote-monitoring') return 'remote_referrals';
        if (path === '/nurse/medications') return 'medications';
        return null;
    };

    const isActive = (path) => {
        if (path === '/patient/me' && location.pathname === '/patient/me') return true;
        if (path === '/admin/overview' && location.pathname === '/admin/overview') return true;
        if (path === '/doctor' && location.pathname === '/doctor') return true;
        if (path === '/nurse/queue' && location.pathname === '/nurse/queue') return true;
        return location.pathname.startsWith(path);
    };

    const links = {
        admin: [
            { path: '/admin/overview', label: 'Overview', icon: LayoutDashboard },
            { path: '/admin/users', label: 'Staff & Users', icon: Users },
            { path: '/admin/patients', label: 'Patient Directory', icon: Search },
            { path: '/admin/remote-patients', label: 'Remote Patients', icon: Wifi },
            { path: '/admin/admissions', label: 'Ward Admissions', icon: Bed },
            { path: '/admin/appointments', label: 'Appointments', icon: Calendar },
            { path: '/admin/inpatient-orders', label: 'Inpatient Orders', icon: Clipboard },
            { path: '/admin/reports', label: 'Analytics & Reports', icon: PieChart },
            { path: '/admin/audit-log', label: 'System Audit Log', icon: ShieldCheck },
            { path: '/messages', label: 'Messages', icon: MessageSquare },
            { path: '/profile', label: 'My Account', icon: UserCircle },
        ],
        doctor: [
            { path: '/doctor', label: 'Dashboard', icon: LayoutDashboard },
            { path: '/doctor/requests', label: 'Pending Requests', icon: CheckSquare },
            { path: '/doctor/patients', label: 'Patient Directory', icon: Search },
            { path: '/doctor/appointments', label: 'Clinical Schedule', icon: Calendar },
            { path: '/doctor/inpatients', label: 'Inpatient Ward', icon: Bed },
            { path: '/doctor/remote-monitoring', label: 'Remote Care Referrals', icon: Activity },
            { path: '/messages', label: 'Messages', icon: MessageSquare },
            { path: '/profile', label: 'My Account', icon: UserCircle },
        ],
        nurse: [
            { path: '/nurse/queue', label: 'Triage Queue', icon: LayoutDashboard },
            { path: '/nurse/medications', label: 'Medication Roster', icon: CheckSquare },
            { path: '/nurse/vitals/add', label: 'Record Vitals', icon: Activity },
            { path: '/messages', label: 'Messages', icon: MessageSquare },
            { path: '/profile', label: 'My Account', icon: UserCircle },
        ],
        patient: [
            { path: '/patient/me', label: 'My Health Summary', icon: LayoutDashboard },
            { path: '/patient/appointments', label: 'Appointments', icon: Calendar },
            { path: '/patient/vitals', label: 'Vitals & Telemetry', icon: Activity },
            { path: '/patient/feedback', label: 'Doctor Notes', icon: FileText },
            { path: '/patient/book', label: 'Book Appointment', icon: Calendar },
            { path: '/messages', label: 'Messages', icon: MessageSquare },
            { path: '/profile', label: 'My Account', icon: UserCircle },
        ]
    };

    const roleLinks = links[role] || [];

    const getBadge = (path) => {
        if (!notifications) return 0;
        if (path === '/messages') return notifications.messages;
        if (path === '/admin/appointments') return notifications.appointments;
        if (path === '/doctor/requests') return notifications.appointments;
        if (path === '/admin/remote-referrals' || path === '/doctor/remote-monitoring') return notifications.remote_referrals;
        if (path === '/nurse/medications') return notifications.medications;
        return 0;
    };

    return (
        <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
            <div className="sidebar-header">
                <div className="brand-wrapper">
                    <div className="brand-icon-box">
                        <HeartPulse size={20} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h2 className="brand-title">HosiKe</h2>
                        <span className="brand-subtitle">Kenya Health OS</span>
                    </div>
                </div>
                <button
                    className="mobile-only"
                    onClick={toggleSidebar}
                    aria-label="Close menu"
                    style={{
                        background: 'transparent',
                        color: 'var(--text-muted)',
                        padding: '0.4rem',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                    }}
                >
                    <X size={20} />
                </button>
            </div>

            <nav className="sidebar-nav">
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-light)', padding: '0.2rem 0.5rem 0.4rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Menu Navigation
                </div>
                {roleLinks.map((link) => {
                    const badgeCount = getBadge(link.path);
                    const active = isActive(link.path);
                    return (
                        <Link
                            key={link.path}
                            to={link.path}
                            className={`nav-item ${active ? 'active' : ''}`}
                            onClick={() => handleNavClick(link.path)}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <link.icon size={18} strokeWidth={active ? 2.5 : 2} />
                                <span>{link.label}</span>
                            </div>
                            {badgeCount > 0 && (
                                <span
                                    style={{
                                        fontSize: '0.7rem',
                                        fontWeight: 700,
                                        padding: '0.15rem 0.5rem',
                                        borderRadius: '9999px',
                                        background: '#fff1f2',
                                        color: '#e11d48',
                                        border: '1px solid #fecdd3',
                                        minWidth: '1.25rem',
                                        textAlign: 'center',
                                    }}
                                >
                                    {badgeCount}
                                </span>
                            )}
                        </Link>
                    );
                })}
            </nav>

            <div className="sidebar-footer">
                <div className="sidebar-user-pill">
                    <div className="user-avatar-circle">
                        {user?.avatar ? (
                            <img src={user.avatar} alt="avatar" />
                        ) : (
                            <UserCircle size={22} />
                        )}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {user?.first_name ? `${user.first_name} ${user.last_name}` : user?.username}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                            <span style={{ textTransform: 'capitalize' }}>{user?.role}</span>
                        </div>
                    </div>
                </div>
                <button onClick={logout} className="logout-btn">
                    <LogOut size={16} />
                    <span>Sign Out</span>
                </button>
            </div>
        </aside>
    );
};

const Topbar = ({ user, toggleSidebar, onToggleAI }) => {
    const role = user?.role || 'patient';
    const roleTitle = ROLE_TITLES[role] || 'Hospital Management System';

    return (
        <header className="topbar">
            <div className="topbar-left">
                <button
                    className="mobile-only"
                    onClick={toggleSidebar}
                    aria-label="Open menu"
                    style={{
                        background: 'transparent',
                        color: 'var(--text-main)',
                        padding: '0.4rem',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Menu size={22} />
                </button>

                {/* Mobile Brand Emblem */}
                <div className="mobile-only" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--primary-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                        <HeartPulse size={16} />
                    </div>
                    <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--primary-dark)', letterSpacing: '-0.02em' }}>HosiKe</span>
                </div>

                {/* Desktop Portal Title */}
                <div className="desktop-only" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        HosiKe Portal
                    </span>
                    <span style={{ color: 'var(--border-strong)', fontSize: '0.8rem' }}>/</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        {roleTitle}
                    </span>
                </div>
            </div>

            <div className="topbar-right">
                {/* HosiKe AI Quick Launcher */}
                <button
                    onClick={onToggleAI}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        background: 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)',
                        color: '#0f766e',
                        border: '1px solid #99f6e4',
                        padding: '0.45rem 0.85rem',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '0.8125rem',
                        fontWeight: 700,
                        boxShadow: '0 2px 6px rgba(13, 148, 136, 0.12)',
                        transition: 'var(--transition)',
                    }}
                >
                    <Sparkles size={15} color="#0d9488" />
                    <span>HosiKe AI</span>
                </button>

                {/* Desktop User Info Pill */}
                <div className="desktop-only" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: '0.25rem' }}>
                    <div style={{ textAlign: 'right', lineHeight: 1.25 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-main)' }}>
                            {user?.first_name ? `${user.first_name} ${user.last_name}` : user?.username}
                        </div>
                        <span className="badge" style={{ padding: '0.15rem 0.55rem', fontSize: '0.7rem', marginTop: '0.15rem' }}>
                            {user?.role}
                        </span>
                    </div>
                    <div className="user-avatar-circle" style={{ width: 38, height: 38 }}>
                        {user?.avatar ? (
                            <img src={user.avatar} alt="" />
                        ) : (
                            <UserCircle size={24} />
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};

const MobileBottomBar = ({ user, onToggleAI }) => {
    const location = useLocation();
    const role = user?.role || 'patient';

    const roleNavItems = {
        patient: [
            { path: '/patient/me', label: 'Summary', icon: LayoutDashboard },
            { path: '/patient/appointments', label: 'Appts', icon: Calendar },
            { path: '/patient/vitals', label: 'Vitals', icon: Activity },
            { path: '/messages', label: 'Chat', icon: MessageSquare },
        ],
        doctor: [
            { path: '/doctor', label: 'Home', icon: LayoutDashboard },
            { path: '/doctor/requests', label: 'Requests', icon: CheckSquare },
            { path: '/doctor/appointments', label: 'Schedule', icon: Calendar },
            { path: '/messages', label: 'Chat', icon: MessageSquare },
        ],
        nurse: [
            { path: '/nurse/queue', label: 'Queue', icon: LayoutDashboard },
            { path: '/nurse/medications', label: 'Meds', icon: CheckSquare },
            { path: '/nurse/vitals/add', label: 'Vitals', icon: Activity },
            { path: '/messages', label: 'Chat', icon: MessageSquare },
        ],
        admin: [
            { path: '/admin/overview', label: 'Overview', icon: LayoutDashboard },
            { path: '/admin/users', label: 'Users', icon: Users },
            { path: '/admin/patients', label: 'Patients', icon: Search },
            { path: '/messages', label: 'Chat', icon: MessageSquare },
        ],
    };

    const items = roleNavItems[role] || roleNavItems.patient;

    return (
        <nav className="mobile-bottom-bar" aria-label="Mobile Bottom Navigation">
            {items.map((item) => {
                const active = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
                return (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={`mobile-bottom-item ${active ? 'active' : ''}`}
                    >
                        <item.icon size={20} strokeWidth={active ? 2.5 : 2} />
                        <span>{item.label}</span>
                    </Link>
                );
            })}
            {/* Center / Right AI Quick Button */}
            <button
                type="button"
                onClick={onToggleAI}
                className="mobile-bottom-item"
                style={{ color: '#0d9488', background: 'none' }}
                aria-label="Ask HosiKe AI"
            >
                <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #0d9488, #0f766e)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(13, 148, 136, 0.35)'
                }}>
                    <Sparkles size={16} />
                </div>
                <span style={{ fontWeight: 700 }}>AI</span>
            </button>
        </nav>
    );
};

const Layout = () => {
    const { user } = useAuth();
    const location = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [aiOpen, setAiOpen] = useState(false);
    const [notifications, setNotifications] = useState({ messages: 0, appointments: 0, remote_referrals: 0, medications: 0 });

    const fetchNotifications = async () => {
        try {
            const res = await api.get('/notifications/');
            setNotifications(res.data);
        } catch (e) {
            // Silently ignore if not authorized or network issue
        }
    };

    useEffect(() => {
        fetchNotifications();
    }, [location.pathname]);

    useEffect(() => {
        const interval = setInterval(fetchNotifications, 20000);
        return () => clearInterval(interval);
    }, []);

    // Close mobile sidebar on route change
    useEffect(() => {
        setSidebarOpen(false);
    }, [location.pathname]);

    return (
        <div className="app-layout">
            {/* Mobile Backdrop */}
            {sidebarOpen && (
                <div
                    className="mobile-backdrop"
                    onClick={() => setSidebarOpen(false)}
                    aria-hidden="true"
                />
            )}

            <Sidebar
                user={user}
                isOpen={sidebarOpen}
                toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                notifications={notifications}
                setNotifications={setNotifications}
            />

            <div className="main-content">
                <Topbar
                    user={user}
                    toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
                    onToggleAI={() => setAiOpen((prev) => !prev)}
                />
                <main className="page-content">
                    <Outlet />
                </main>
            </div>

            {/* Mobile Bottom Navigation */}
            <MobileBottomBar
                user={user}
                onToggleAI={() => setAiOpen((prev) => !prev)}
            />

            {/* AI Clinical Assistant Drawer / Modal */}
            <AIAssistant user={user} isOpen={aiOpen} setIsOpen={setAiOpen} />
        </div>
    );
};

export default Layout;

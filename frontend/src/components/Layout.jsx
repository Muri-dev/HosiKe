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
    ShieldCheck
} from 'lucide-react';

const Sidebar = ({ user, isOpen, toggleSidebar }) => {
    const location = useLocation();
    const { logout } = useAuth();
    const role = user?.role;
    const [notifications, setNotifications] = useState({ messages: 0, appointments: 0, remote_referrals: 0, medications: 0 });

    const fetchNotifications = async () => {
        try {
            const res = await api.get('/notifications/');
            setNotifications(res.data);
        } catch (e) { console.error(e); }
    };

    // Re-fetch immediately on every route change so badges clear as soon as you land on the page
    useEffect(() => {
        fetchNotifications();
    }, [location.pathname]);

    // Also keep a background poll for new notifications that arrive while you're on a page
    useEffect(() => {
        const interval = setInterval(fetchNotifications, 15000);
        return () => clearInterval(interval);
    }, []);

    // Optimistically zero out the badge for a path the moment the user clicks it
    const handleNavClick = (path) => {
        const badgeKey = getBadgeKey(path);
        if (badgeKey) {
            setNotifications(prev => ({ ...prev, [badgeKey]: 0 }));
        }
        if (window.innerWidth < 768) toggleSidebar();
    };

    const getBadgeKey = (path) => {
        if (path === '/messages') return 'messages';
        if (path === '/admin/appointments' || path === '/doctor/requests') return 'appointments';
        if (path === '/admin/remote-referrals' || path === '/doctor/remote-monitoring') return 'remote_referrals';
        if (path === '/nurse/medications') return 'medications';
        return null;
    };

    const isActive = (path) => location.pathname.startsWith(path);

    const links = {
        admin: [
            { path: '/admin/overview', label: 'Overview', icon: LayoutDashboard },
            { path: '/admin/users', label: 'Users', icon: Users },
            { path: '/admin/patients', label: 'Patient Records', icon: Search },
            { path: '/admin/admissions', label: 'Admissions', icon: Bed },
            { path: '/admin/appointments', label: 'Appointments', icon: Calendar },
            { path: '/admin/inpatient-orders', label: 'Inpatient Orders', icon: Clipboard },
            { path: '/admin/reports', label: 'Reports', icon: PieChart },
            { path: '/admin/audit-log', label: 'Audit Log', icon: ShieldCheck },
            { path: '/messages', label: 'Messages', icon: FileText },
            { path: '/profile', label: 'My Profile', icon: Users },
        ],
        doctor: [
            { path: '/doctor', label: 'Dashboard', icon: LayoutDashboard },
            { path: '/doctor/requests', label: 'Requests', icon: CheckSquare },
            { path: '/doctor/patients', label: 'Patient Records', icon: Search },
            { path: '/doctor/appointments', label: 'My Schedule', icon: Calendar },
            { path: '/doctor/inpatients', label: 'Inpatient Ward', icon: Bed },
            { path: '/doctor/remote-monitoring', label: 'Remote Referrals', icon: Activity },
            { path: '/messages', label: 'Messages', icon: FileText },
            { path: '/profile', label: 'My Profile', icon: Users },
        ],
        nurse: [
            { path: '/nurse/queue', label: 'My Queue', icon: LayoutDashboard },
            { path: '/nurse/medications', label: 'Medications', icon: CheckSquare },
            { path: '/nurse/vitals/add', label: 'Add Vitals', icon: Activity },
            { path: '/messages', label: 'Messages', icon: FileText },
            { path: '/profile', label: 'My Profile', icon: Users },
        ],
        patient: [
            { path: '/patient/me', label: 'Dashboard', icon: LayoutDashboard },
            { path: '/patient/appointments', label: 'My Appointments', icon: Calendar },
            { path: '/patient/vitals', label: 'My Vitals', icon: Activity },
            { path: '/patient/feedback', label: 'Doctor Feedback', icon: MessageSquare },
            { path: '/patient/book', label: 'Book Appointment', icon: FileText },
            { path: '/messages', label: 'Messages', icon: FileText },
            { path: '/profile', label: 'My Profile', icon: Users },
        ]
    };

    const roleLinks = links[role] || [];

    const getBadge = (path) => {
        if (path === '/messages') return notifications.messages;
        if (path === '/admin/appointments') return notifications.appointments;
        // Doctor: 'appointments' notification count (which counts pending approvals) should go to the Requests tab now
        if (path === '/doctor/requests') return notifications.appointments;
        if (path === '/admin/remote-referrals' || path === '/doctor/remote-monitoring') return notifications.remote_referrals;
        if (path === '/nurse/medications') return notifications.medications;
        return 0;
    };

    return (
        <div className={`sidebar ${isOpen ? 'open' : ''}`}>
            <div className="sidebar-header">
                <div>
                    <h2 style={{ margin: 0 }}>HosiKe</h2>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>Kenya Health System</span>
                </div>
                <button className="close-btn mobile-only" onClick={toggleSidebar}><X size={24} /></button>
            </div>
            <nav className="sidebar-nav">
                {roleLinks.map((link) => {
                    const badgeCount = getBadge(link.path);
                    return (
                        <Link
                            key={link.path}
                            to={link.path}
                            className={`nav-item ${isActive(link.path) ? 'active' : ''}`}
                            onClick={() => handleNavClick(link.path)}
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <link.icon size={20} />
                                <span>{link.label}</span>
                            </div>
                            {badgeCount > 0 && (
                                <span className="badge bg-danger" style={{ fontSize: '0.7rem', padding: '0.2rem 0.6rem', borderRadius: '1rem' }}>
                                    {badgeCount}
                                </span>
                            )}

                        </Link>
                    );
                })}
            </nav>
            <div className="sidebar-footer">
                {/* User mini-card */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem', padding: '0.5rem' }}>
                    <div style={{
                        width: 38, height: 38, borderRadius: '50%', overflow: 'hidden',
                        background: 'var(--hover-bg)', flexShrink: 0,
                        border: '2px solid var(--primary-color)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        {user?.avatar
                            ? <img src={user.avatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <Users size={18} color="var(--primary-color)" />
                        }
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {user?.first_name ? `${user.first_name} ${user.last_name}` : user?.username}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{user?.role}</div>
                    </div>
                </div>
                <button onClick={logout} className="logout-btn">
                    <LogOut size={20} />
                    <span>Logout</span>
                </button>
            </div>
        </div>
    );
};

const Topbar = ({ user, toggleSidebar }) => {
    return (
        <header className="topbar">
            <button className="menu-btn mobile-only" onClick={toggleSidebar}><Menu size={24} /></button>
            <div className="user-info" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ textAlign: 'right' }}>
                    <div className="user-name" style={{ fontWeight: 600 }}>
                        {user?.first_name ? `${user.first_name} ${user.last_name}` : user?.username}
                    </div>
                    <div className="user-role badge" style={{ textTransform: 'capitalize' }}>{user?.role}</div>
                </div>
                <div style={{
                    width: 38, height: 38, borderRadius: '50%', overflow: 'hidden',
                    background: '#f3f4f6', flexShrink: 0,
                    border: '2px solid var(--border-color)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    {user?.avatar
                        ? <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <Users size={18} color="var(--text-muted)" />
                    }
                </div>
            </div>
        </header>
    );
};

const Layout = () => {
    const { user } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="app-layout">
            <Sidebar user={user} isOpen={sidebarOpen} toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
            <div className="main-content">
                <Topbar user={user} toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
                <main className="page-content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default Layout;

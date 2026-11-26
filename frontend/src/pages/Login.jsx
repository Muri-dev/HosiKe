import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
    HeartPulse,
    ShieldCheck,
    User,
    Lock,
    Eye,
    EyeOff,
    ArrowRight,
    Sparkles,
    AlertCircle,
    CheckCircle2
} from 'lucide-react';

const DEMO_ACCOUNTS = [
    { role: 'Patient', username: 'patient1', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
    { role: 'Doctor', username: 'doctor1', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
    { role: 'Nurse', username: 'nurse1', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
    { role: 'Admin', username: 'admin1', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
];

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSelectDemo = (acc) => {
        setUsername(acc.username);
        setPassword('pass1234');
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const user = await login(username, password);
            // Navigate based on role
            switch (user.role) {
                case 'admin': navigate('/admin/overview'); break;
                case 'doctor': navigate('/doctor/appointments'); break;
                case 'nurse': navigate('/nurse/queue'); break;
                case 'patient': navigate('/patient/me'); break;
                default: navigate('/unauthorized');
            }
        } catch (err) {
            console.error('Login error:', err);
            let msg;
            if (err.response) {
                if (err.response.status === 401) {
                    msg = err.response.data?.detail || 'Invalid username or password';
                } else if (err.response.status === 404) {
                    msg = 'API endpoint not found (404). Please restart your Vite dev server (Ctrl+C then npm run dev) so the /api proxy takes effect, and ensure Django is running on port 8000.';
                } else if (err.response.status >= 500) {
                    msg = err.response.data?.detail || err.response.data?.error || `Backend server error (${err.response.status}). Please check your Django terminal logs.`;
                } else {
                    msg = err.response.data?.detail || err.response.data?.error || `Request failed with status ${err.response.status}.`;
                }
            } else {
                msg = 'Cannot connect to backend server. Please make sure Django is running: python manage.py runserver';
            }
            setError(msg);
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                {/* Brand Header */}
                <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 56,
                        height: 56,
                        borderRadius: '16px',
                        background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
                        color: '#ffffff',
                        boxShadow: '0 8px 20px rgba(13, 148, 136, 0.3)',
                        marginBottom: '0.85rem'
                    }}>
                        <HeartPulse size={30} strokeWidth={2.4} />
                    </div>
                    <h1 style={{
                        margin: 0,
                        fontSize: '1.65rem',
                        fontWeight: 800,
                        letterSpacing: '-0.03em',
                        color: 'var(--text-main)'
                    }}>
                        HosiKe Portal
                    </h1>
                    <p style={{
                        margin: '0.35rem 0 0 0',
                        fontSize: '0.85rem',
                        color: 'var(--text-muted)',
                        fontWeight: 500
                    }}>
                        Kenya National Health Management System
                    </p>

                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        marginTop: '0.65rem',
                        padding: '0.2rem 0.65rem',
                        borderRadius: '9999px',
                        background: '#f0fdfa',
                        border: '1px solid #ccfbf1',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        color: '#0f766e'
                    }}>
                        <ShieldCheck size={13} />
                        <span>MOH Kenya • 256-bit Encrypted</span>
                    </div>
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="error-banner">
                        <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                        <div style={{ flex: 1 }}>{error}</div>
                    </div>
                )}

                {/* Login Form */}
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <User size={14} color="var(--text-muted)" />
                            <span>Username</span>
                        </label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="e.g. patient1, doctor1, nurse1"
                            autoComplete="username"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Lock size={14} color="var(--text-muted)" />
                            <span>Password</span>
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                autoComplete="current-password"
                                required
                                style={{ paddingRight: '2.5rem' }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute',
                                    right: '0.75rem',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--text-muted)',
                                    display: 'flex',
                                    padding: '0.2rem',
                                }}
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn-primary"
                        disabled={loading}
                        style={{
                            width: '100%',
                            padding: '0.8rem 1.25rem',
                            marginTop: '0.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            fontSize: '0.95rem'
                        }}
                    >
                        {loading ? (
                            <span>Authenticating...</span>
                        ) : (
                            <>
                                <span>Sign In to Portal</span>
                                <ArrowRight size={17} />
                            </>
                        )}
                    </button>
                </form>

                {/* Quick Demo Switcher */}
                <div style={{
                    marginTop: '1.75rem',
                    paddingTop: '1.25rem',
                    borderTop: '1px solid var(--border-light)'
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '0.65rem'
                    }}>
                        <span style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em'
                        }}>
                            Quick Demo Sign-In
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>
                            pass1234
                        </span>
                    </div>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: '0.5rem'
                    }}>
                        {DEMO_ACCOUNTS.map((acc) => (
                            <button
                                key={acc.role}
                                type="button"
                                onClick={() => handleSelectDemo(acc)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '0.45rem 0.65rem',
                                    borderRadius: 'var(--radius)',
                                    background: acc.bg,
                                    border: `1px solid ${acc.border}`,
                                    color: acc.color,
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    transition: 'var(--transition)',
                                    textAlign: 'left'
                                }}
                            >
                                <span>{acc.role}</span>
                                <span style={{ opacity: 0.7, fontWeight: 500, fontSize: '0.7rem' }}>
                                    {acc.username}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{
                    textAlign: 'center',
                    marginTop: '1.5rem',
                    fontSize: '0.72rem',
                    color: 'var(--text-light)'
                }}>
                    © 2026 Republic of Kenya • Ministry of Health
                </div>
            </div>
        </div>
    );
};

export default Login;

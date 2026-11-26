import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldOff, ArrowLeft } from 'lucide-react';

const Unauthorized = () => {
    return (
        <div className="login-container">
            <div className="login-card" style={{ textAlign: 'center', maxWidth: 420 }}>
                <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 56,
                    height: 56,
                    borderRadius: '16px',
                    background: '#fff1f2',
                    color: '#e11d48',
                    marginBottom: '1rem'
                }}>
                    <ShieldOff size={28} />
                </div>
                <h1 style={{
                    color: '#e11d48',
                    fontSize: '1.5rem',
                    fontWeight: 800,
                    marginBottom: '0.5rem'
                }}>
                    Access Restricted
                </h1>
                <p style={{
                    color: 'var(--text-muted)',
                    fontSize: '0.9rem',
                    marginBottom: '1.5rem',
                    lineHeight: 1.5
                }}>
                    You don't have authorization to view this page.
                    Please sign in with an account that has the required permissions.
                </p>
                <Link
                    to="/login"
                    className="btn-primary"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        width: 'auto',
                        padding: '0.65rem 1.25rem'
                    }}
                >
                    <ArrowLeft size={16} />
                    <span>Back to Sign In</span>
                </Link>
            </div>
        </div>
    );
};

export default Unauthorized;

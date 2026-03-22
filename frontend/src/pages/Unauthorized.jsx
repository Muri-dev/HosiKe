import React from 'react';
import { Link } from 'react-router-dom';

const Unauthorized = () => {
    return (
        <div className="login-container">
            <div className="login-card" style={{ textAlign: 'center' }}>
                <h1 style={{ color: '#ef4444' }}>Access Denied</h1>
                <p>You do not have permission to view this page.</p>
                <Link to="/login" className="btn-primary" style={{ display: 'inline-block', marginTop: '1rem', width: 'auto' }}>
                    Return to Login
                </Link>
            </div>
        </div>
    );
};

export default Unauthorized;

import React from 'react';
import { AlertCircle, X } from 'lucide-react';

const ErrorBanner = ({ message, onClose }) => {
    if (!message) return null;

    return (
        <div className="error-banner fade-in" style={{
            backgroundColor: '#fee2e2',
            color: '#dc2626',
            padding: '1rem',
            borderRadius: 'var(--radius)',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            border: '1px solid #fca5a5'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={20} />
                <span>{message}</span>
            </div>
            {onClose && (
                <button onClick={onClose} style={{
                    background: 'none',
                    border: 'none',
                    color: 'inherit',
                    cursor: 'pointer',
                    padding: '0.25rem'
                }}>
                    <X size={20} />
                </button>
            )}
        </div>
    );
};

export default ErrorBanner;

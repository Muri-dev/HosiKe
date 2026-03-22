import React, { useEffect } from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';

const Toast = ({ message, type = 'success', onClose, duration = 3000 }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, duration);
        return () => clearTimeout(timer);
    }, [duration, onClose]);

    return (
        <div className={`toast ${type}`}>
            {type === 'success' ? <CheckCircle size={20} /> : <XCircle size={20} />}
            <span>{message}</span>
            <button onClick={onClose} className="toast-close"><X size={16} /></button>
        </div>
    );
};

export default Toast;

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

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
                <h1>HosiKe Portal</h1>
                <p style={{ margin: '-0.5rem 0 1rem', color: '#888', fontSize: '0.85rem' }}>Kenya Health Management System</p>
                {error && <div className="error-banner">{error}</div>}
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? 'Logging in...' : 'Login'}
                    </button>
                </form>

            </div>
        </div>
    );
};

export default Login;

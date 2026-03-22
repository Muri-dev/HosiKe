import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
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
            setError('Invalid username or password');
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
                    <button type="submit" className="btn-primary">Login</button>
                </form>

            </div>
        </div>
    );
};

export default Login;

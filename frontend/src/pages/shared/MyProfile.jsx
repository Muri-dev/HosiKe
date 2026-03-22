import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import AvatarUpload from '../../components/common/AvatarUpload';
import api from '../../api/axios';
import Toast from '../../components/common/Toast';
import { User, Mail, Phone, Shield, Lock } from 'lucide-react';

const fieldStyle = {
    width: '100%', padding: '0.65rem 0.75rem',
    border: '1px solid var(--border-color)', borderRadius: 'var(--radius)',
    fontSize: '0.9rem', boxSizing: 'border-box', background: 'white',
    fontFamily: 'inherit', color: 'var(--text-main)',
};

const lockedStyle = {
    ...fieldStyle,
    background: '#f4f7f9',
    color: 'var(--text-muted)',
    cursor: 'not-allowed',
    border: '1px solid #e2e8f0',
};

export default function MyProfile() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const [form, setForm] = useState({
        first_name: user?.first_name || '',
        last_name: user?.last_name || '',
        email: user?.email || '',
    });
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);
    const [avatar, setAvatar] = useState(user?.avatar || null);

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            // Non-admins can only update email
            const payload = isAdmin ? form : { email: form.email };
            await api.patch('/me/', payload);
            setToast({ message: 'Profile updated', type: 'success' });
        } catch {
            setToast({ message: 'Update failed', type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div>
            <h1 style={{ margin: '0 0 0.25rem' }}>My Profile</h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Manage your personal information and profile photo</p>

            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.5rem', alignItems: 'start' }}>
                {/* ── Avatar card ── */}
                <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
                    <AvatarUpload
                        currentAvatar={avatar}
                        size={110}
                        onUpdate={(url) => setAvatar(url)}
                    />
                    <div style={{ marginTop: '1rem', fontWeight: 700, fontSize: '1.1rem' }}>
                        {user?.first_name ? `${user.first_name} ${user.last_name}` : user?.username}
                    </div>
                    <div style={{
                        display: 'inline-block', marginTop: '0.4rem',
                        background: 'var(--primary-light)', color: 'var(--primary-color)',
                        padding: '0.25rem 0.75rem', borderRadius: '999px',
                        fontSize: '0.8rem', fontWeight: 600, textTransform: 'capitalize',
                    }}>
                        {user?.role}
                    </div>
                    <div style={{ marginTop: '0.75rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        @{user?.username}
                    </div>
                </div>

                {/* ── Details form ── */}
                <div className="card" style={{ padding: '1.75rem' }}>
                    <h2 style={{ margin: '0 0 1.25rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <User size={18} /> Personal Information
                    </h2>
                    <form onSubmit={handleSave}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 600, fontSize: '0.82rem' }}>
                                    First Name {!isAdmin && <Lock size={11} style={{ verticalAlign: 'middle', opacity: 0.5 }} />}
                                </label>
                                <input
                                    style={isAdmin ? fieldStyle : lockedStyle}
                                    value={form.first_name}
                                    disabled={!isAdmin}
                                    onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                                />
                                {!isAdmin && <p style={{ margin: '0.2rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>Managed by admin</p>}
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 600, fontSize: '0.82rem' }}>
                                    Last Name {!isAdmin && <Lock size={11} style={{ verticalAlign: 'middle', opacity: 0.5 }} />}
                                </label>
                                <input
                                    style={isAdmin ? fieldStyle : lockedStyle}
                                    value={form.last_name}
                                    disabled={!isAdmin}
                                    onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                                />
                                {!isAdmin && <p style={{ margin: '0.2rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>Managed by admin</p>}
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 600, fontSize: '0.82rem' }}>
                                <Mail size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Email
                            </label>
                            <input type="email" style={fieldStyle} value={form.email}
                                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                        </div>

                        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 600, fontSize: '0.82rem' }}>
                                <Shield size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Username
                            </label>
                            <input style={{ ...fieldStyle, background: '#f9f9f9', color: 'var(--text-muted)' }}
                                value={user?.username} disabled title="Username cannot be changed" />
                            <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                Username cannot be changed
                            </p>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button type="submit" className="btn-primary" disabled={saving}>
                                {saving ? 'Saving…' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
}

import React, { useRef, useState } from 'react';
import api from '../../api/axios';
import { Camera, Trash2, User } from 'lucide-react';

/**
 * AvatarUpload — reusable circular avatar picker.
 *
 * Props:
 *   currentAvatar  : string | null   — existing avatar URL (absolute)
 *   size           : number (px)     — ring diameter, default 96
 *   uploadUrl      : string          — POST endpoint, default '/me/avatar/'
 *   deleteUrl      : string          — DELETE endpoint, default '/me/avatar/'
 *   onUpdate       : (url|null) => void — called after upload/remove
 */
export default function AvatarUpload({
    currentAvatar,
    size = 96,
    uploadUrl = '/me/avatar/',
    deleteUrl = '/me/avatar/',
    onUpdate,
}) {
    const [preview, setPreview] = useState(currentAvatar || null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const inputRef = useRef();

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validate file size (max 5 MB)
        if (file.size > 5 * 1024 * 1024) {
            setError('File too large — max 5 MB.');
            return;
        }

        // Instant local preview while uploading
        const localUrl = URL.createObjectURL(file);
        setPreview(localUrl);
        setError('');
        setLoading(true);

        try {
            const form = new FormData();
            form.append('avatar', file);
            const res = await api.post(uploadUrl, form, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            // Server returns absolute URL via request context
            const serverUrl = res.data.avatar;
            setPreview(serverUrl);
            onUpdate?.(serverUrl);
        } catch (err) {
            const msg = err.response?.data?.detail || 'Upload failed. Try a smaller image.';
            setError(msg);
            setPreview(currentAvatar || null);
        } finally {
            setLoading(false);
            e.target.value = '';
        }
    };

    const handleRemove = async () => {
        setLoading(true);
        setError('');
        try {
            await api.delete(deleteUrl);
            setPreview(null);
            onUpdate?.(null);
        } catch {
            setError('Could not remove avatar.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem' }}>
            {/* ── Avatar ring ────────────────────────────────── */}
            <div
                style={{
                    position: 'relative', width: size, height: size,
                    borderRadius: '50%', overflow: 'hidden',
                    border: '3px solid var(--primary-color)',
                    cursor: loading ? 'default' : 'pointer',
                    background: '#f3f4f6',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s',
                }}
                onClick={() => !loading && inputRef.current.click()}
                title="Click to change photo"
            >
                {preview
                    ? <img src={preview} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <User size={size * 0.45} color="var(--text-muted)" />
                }

                {/* Camera hover overlay */}
                <div
                    style={{
                        position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: 0, transition: 'opacity 0.18s', borderRadius: '50%',
                    }}
                    onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = 1; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = 0; }}
                >
                    {loading
                        ? <div style={{ width: 20, height: 20, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                        : <Camera size={size * 0.28} color="white" />
                    }
                </div>
            </div>

            {/* ── Buttons ─────────────────────────────────────── */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                    type="button"
                    onClick={() => !loading && inputRef.current.click()}
                    disabled={loading}
                    style={{
                        fontSize: '0.75rem', padding: '0.3rem 0.75rem',
                        borderRadius: '999px', border: '1px solid var(--primary-color)',
                        background: 'transparent', color: 'var(--primary-color)',
                        cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600,
                    }}
                >
                    {loading ? 'Uploading…' : preview ? 'Change Photo' : 'Upload Photo'}
                </button>

                {preview && !loading && (
                    <button
                        type="button"
                        onClick={handleRemove}
                        style={{
                            fontSize: '0.75rem', padding: '0.3rem 0.5rem',
                            borderRadius: '999px', border: '1px solid #ef4444',
                            background: 'transparent', color: '#ef4444',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem',
                        }}
                    >
                        <Trash2 size={12} /> Remove
                    </button>
                )}
            </div>

            {error && <p style={{ color: '#ef4444', fontSize: '0.75rem', margin: 0 }}>{error}</p>}

            <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                style={{ display: 'none' }}
                onChange={handleFileChange}
            />

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}

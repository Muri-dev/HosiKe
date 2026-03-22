import React, { useState } from 'react';
import api from '../../api/axios';
import Modal from '../../components/common/Modal';

const GENDERS = ['male', 'female', 'other'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

const field = { width: '100%', padding: '0.6rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.9rem', outline: 'none' };

export default function PatientProfileEditModal({ profile, isOpen, onClose, onSaved }) {
    const [form, setForm] = useState({
        first_name: profile?.first_name || '',
        last_name: profile?.last_name || '',
        email: profile?.email || '',
        date_of_birth: profile?.date_of_birth || '',
        gender: profile?.gender || '',
        blood_group: profile?.blood_group || '',
        contact_number: profile?.contact_number || '',
        address: profile?.address || '',
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            const res = await api.patch('/patient/me/', form);
            onSaved(res.data);
            onClose();
        } catch (err) {
            const d = err.response?.data;
            setError(typeof d === 'string' ? d : JSON.stringify(d) || 'Failed to save.');
        } finally {
            setSaving(false);
        }
    };

    const lbl = { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginBottom: '0.25rem' };
    const grp = { marginBottom: '1rem' };
    const row = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Edit Profile">
            {error && <div style={{ background: '#fee2e2', color: '#dc2626', padding: '0.65rem 0.9rem', borderRadius: 8, marginBottom: '1rem', fontSize: '0.85rem' }}>{error}</div>}
            <form onSubmit={handleSave}>
                <div style={row}>
                    <div style={grp}><label style={lbl}>First Name</label><input style={field} value={form.first_name} onChange={set('first_name')} required /></div>
                    <div style={grp}><label style={lbl}>Last Name</label><input style={field} value={form.last_name} onChange={set('last_name')} required /></div>
                </div>
                <div style={grp}><label style={lbl}>Email</label><input type="email" style={field} value={form.email} onChange={set('email')} /></div>
                <div style={row}>
                    <div style={grp}><label style={lbl}>Date of Birth</label><input type="date" style={field} value={form.date_of_birth} onChange={set('date_of_birth')} /></div>
                    <div style={grp}>
                        <label style={lbl}>Gender</label>
                        <select style={field} value={form.gender} onChange={set('gender')}>
                            <option value="">— select —</option>
                            {GENDERS.map(g => <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>)}
                        </select>
                    </div>
                </div>
                <div style={row}>
                    <div style={grp}>
                        <label style={lbl}>Blood Group</label>
                        <select style={field} value={form.blood_group} onChange={set('blood_group')}>
                            <option value="">— select —</option>
                            {BLOOD_GROUPS.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </div>
                    <div style={grp}><label style={lbl}>Contact Number</label><input style={field} value={form.contact_number} onChange={set('contact_number')} /></div>
                </div>
                <div style={grp}><label style={lbl}>Address</label><textarea style={{ ...field, minHeight: 70, resize: 'vertical' }} value={form.address} onChange={set('address')} /></div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <button type="button" onClick={onClose} style={{ padding: '0.55rem 1.2rem', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                    <button type="submit" disabled={saving} style={{ padding: '0.55rem 1.4rem', borderRadius: 8, border: 'none', background: 'var(--primary-color)', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
                        {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

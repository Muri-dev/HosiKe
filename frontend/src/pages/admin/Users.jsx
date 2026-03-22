import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { Plus, Edit2, Trash2, Power, Search, Key, User, Stethoscope, Heart } from 'lucide-react';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import Toast from '../../components/common/Toast';
import AvatarUpload from '../../components/common/AvatarUpload';

// ─── Role-specific profile fields ───────────────────────────────────────────
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

const emptyProfile = {
    patient: { date_of_birth: '', gender: '', blood_group: '', contact_number: '', address: '' },
    doctor: { specialization: '', department: '', license_number: '', phone: '', bio: '' },
    nurse: { department: '', phone: '' },
    admin: {},
};

const fieldStyle = {
    width: '100%', padding: '0.65rem 0.75rem',
    border: '1px solid var(--border-color)', borderRadius: 'var(--radius)',
    fontSize: '0.9rem', boxSizing: 'border-box', fontFamily: 'inherit',
    background: 'white', color: 'var(--text-main)',
};

const SectionHeader = ({ icon: Icon, label }) => (
    <div style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        margin: '1.25rem 0 0.75rem', paddingBottom: '0.4rem',
        borderBottom: '1px solid var(--border-color)',
        color: 'var(--primary-color)', fontSize: '0.8rem',
        fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
    }}>
        <Icon size={15} /> {label}
    </div>
);

// ─── Field helpers ───────────────────────────────────────────────────────────
const Field = ({ label, children, half }) => (
    <div className="form-group" style={{ marginBottom: '0.85rem', ...(half && {}) }}>
        <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }}>
            {label}
        </label>
        {children}
    </div>
);

const Row2 = ({ children }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {children}
    </div>
);

// ─── Profile section per role ────────────────────────────────────────────────
const PatientFields = ({ profile, setProfile }) => {
    const set = (k, v) => setProfile(p => ({ ...p, [k]: v }));
    return (
        <>
            <SectionHeader icon={Heart} label="Patient Details" />
            <Row2>
                <Field label="Date of Birth">
                    <input type="date" style={fieldStyle} value={profile.date_of_birth || ''} onChange={e => set('date_of_birth', e.target.value)} />
                </Field>
                <Field label="Gender">
                    <select style={fieldStyle} value={profile.gender || ''} onChange={e => set('gender', e.target.value)}>
                        <option value="">— Select —</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                    </select>
                </Field>
            </Row2>
            <Row2>
                <Field label="Blood Group">
                    <select style={fieldStyle} value={profile.blood_group || ''} onChange={e => set('blood_group', e.target.value)}>
                        <option value="">— Select —</option>
                        {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                    </select>
                </Field>
                <Field label="Contact Number">
                    <input style={fieldStyle} placeholder="+254 7XX XXX XXX" value={profile.contact_number || ''} onChange={e => set('contact_number', e.target.value)} />
                </Field>
            </Row2>
            <Field label="Address">
                <textarea style={{ ...fieldStyle, resize: 'vertical', minHeight: '60px' }} placeholder="Street, Estate, Nairobi / County" value={profile.address || ''} onChange={e => set('address', e.target.value)} />
            </Field>
        </>
    );
};

const DoctorFields = ({ profile, setProfile }) => {
    const set = (k, v) => setProfile(p => ({ ...p, [k]: v }));
    return (
        <>
            <SectionHeader icon={Stethoscope} label="Doctor Details" />
            <Row2>
                <Field label="Specialization">
                    <input style={fieldStyle} placeholder="e.g. Cardiology" value={profile.specialization || ''} onChange={e => set('specialization', e.target.value)} />
                </Field>
                <Field label="Department">
                    <input style={fieldStyle} placeholder="e.g. Internal Medicine" value={profile.department || ''} onChange={e => set('department', e.target.value)} />
                </Field>
            </Row2>
            <Row2>
                <Field label="License Number">
                    <input style={fieldStyle} placeholder="MDL-12345" value={profile.license_number || ''} onChange={e => set('license_number', e.target.value)} />
                </Field>
                <Field label="Phone">
                    <input style={fieldStyle} placeholder="+254 7XX XXX XXX" value={profile.phone || ''} onChange={e => set('phone', e.target.value)} />
                </Field>
            </Row2>
            <Field label="Bio / About">
                <textarea style={{ ...fieldStyle, resize: 'vertical', minHeight: '70px' }} placeholder="Short professional bio…" value={profile.bio || ''} onChange={e => set('bio', e.target.value)} />
            </Field>
        </>
    );
};

const NurseFields = ({ profile, setProfile }) => {
    const set = (k, v) => setProfile(p => ({ ...p, [k]: v }));
    return (
        <>
            <SectionHeader icon={User} label="Nurse Details" />
            <Row2>
                <Field label="Department">
                    <input style={fieldStyle} placeholder="e.g. ICU" value={profile.department || ''} onChange={e => set('department', e.target.value)} />
                </Field>
                <Field label="Phone">
                    <input style={fieldStyle} placeholder="+254 7XX XXX XXX" value={profile.phone || ''} onChange={e => set('phone', e.target.value)} />
                </Field>
            </Row2>
        </>
    );
};

// ─── Main page ───────────────────────────────────────────────────────────────
const UsersPage = () => {
    const [activeTab, setActiveTab] = useState('patient');
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalMode, setModalMode] = useState('create');
    const [showModal, setShowModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [toast, setToast] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    // Form state
    const [formData, setFormData] = useState({
        username: '', password: '', email: '', first_name: '', last_name: '', role: 'patient'
    });
    const [profileData, setProfileData] = useState({ ...emptyProfile.patient });
    const [resetPass, setResetPass] = useState('');

    const fetchUsers = async () => {
        setLoading(true);
        try {
            let url = `/admin/users/?role=${activeTab}`;
            if (searchQuery) url += `&search=${searchQuery}`;
            if (statusFilter !== 'all') url += `&is_active=${statusFilter === 'active'}`;
            const response = await api.get(url);
            setUsers(response.data);
        } catch {
            setToast({ message: 'Failed to fetch users', type: 'error' });
        }
        setLoading(false);
    };

    useEffect(() => {
        const timer = setTimeout(fetchUsers, 500);
        return () => clearTimeout(timer);
    }, [activeTab, searchQuery, statusFilter]);

    const handleOpenModal = (mode, user = null) => {
        setModalMode(mode);
        if (mode === 'edit' && user) {
            setSelectedUser(user);
            setFormData({
                username: user.username, password: '',
                email: user.email || '', first_name: user.first_name || '',
                last_name: user.last_name || '', role: user.role,
            });
            // Pre-fill profile from FullUserSerializer response
            setProfileData({ ...(emptyProfile[user.role] || {}), ...(user.profile || {}) });
        } else if (mode === 'password' && user) {
            setSelectedUser(user);
            setResetPass('');
        } else {
            setSelectedUser(null);
            setFormData({ username: '', password: '', email: '', first_name: '', last_name: '', role: activeTab });
            setProfileData({ ...(emptyProfile[activeTab] || {}) });
        }
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (modalMode === 'create') {
                await api.post('/admin/users/', { ...formData, role: activeTab, profile: profileData });
                setToast({ message: 'User created successfully', type: 'success' });
            } else if (modalMode === 'edit') {
                const data = { ...formData };
                if (!data.password) delete data.password;
                // Send user fields + profile separately
                await api.patch(`/admin/users/${selectedUser.id}/`, { ...data, profile: profileData });
                setToast({ message: 'User updated successfully', type: 'success' });
            } else if (modalMode === 'password') {
                await api.post(`/admin/users/${selectedUser.id}/reset-password/`, { password: resetPass });
                setToast({ message: 'Password reset successfully', type: 'success' });
            }
            setShowModal(false);
            fetchUsers();
        } catch (error) {
            const msg = error.response?.data?.detail || JSON.stringify(error.response?.data) || 'Unknown error';
            setToast({ message: `Operation failed: ${msg}`, type: 'error' });
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this user?')) return;
        try {
            await api.delete(`/admin/users/${id}/`);
            setToast({ message: 'User deleted', type: 'success' });
            fetchUsers();
        } catch {
            setToast({ message: 'Failed to delete user', type: 'error' });
        }
    };

    const handleToggleActive = async (user) => {
        const action = user.is_active ? 'deactivate' : 'activate';
        if (!window.confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} this user?`)) return;
        try {
            await api.patch(`/admin/users/${user.id}/`, { is_active: !user.is_active });
            setToast({ message: `User ${action}d`, type: 'success' });
            fetchUsers();
        } catch {
            setToast({ message: 'Failed to update status', type: 'error' });
        }
    };

    // Role-specific extra column
    const extraColumn = () => {
        if (activeTab === 'patient') return {
            header: 'Blood / Contact',
            render: row => {
                const p = row.profile;
                return p ? (
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {p.blood_group || '—'} &nbsp;·&nbsp; {p.contact_number || '—'}
                    </span>
                ) : <span style={{ color: 'var(--text-muted)' }}>—</span>;
            }
        };
        if (activeTab === 'doctor') return {
            header: 'Specialization',
            render: row => <span style={{ fontSize: '0.82rem' }}>{row.profile?.specialization || '—'}</span>
        };
        if (activeTab === 'nurse') return {
            header: 'Department',
            render: row => <span style={{ fontSize: '0.82rem' }}>{row.profile?.department || '—'}</span>
        };
        return null;
    };

    const extra = extraColumn();
    const columns = [
        {
            header: 'Name', render: row => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: '50%', overflow: 'hidden',
                        background: '#f3f4f6', flexShrink: 0, border: '2px solid var(--border-color)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        {row.avatar
                            ? <img src={row.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <User size={16} color="var(--text-muted)" />
                        }
                    </div>
                    <div>
                        <div style={{ fontWeight: 600 }}>
                            {row.first_name || row.last_name ? `${row.first_name} ${row.last_name}`.trim() : row.username}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>@{row.username}</div>
                    </div>
                </div>
            )
        },
        { header: 'Email', accessor: 'email' },
        ...(extra ? [extra] : []),
        {
            header: 'Status', render: row =>
                row.is_active
                    ? <span className="status completed">Active</span>
                    : <span className="status cancelled">Inactive</span>
        },
        {
            header: 'Actions', render: row => (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => handleOpenModal('edit', row)} title="Edit" style={btnGhost}>
                        <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleOpenModal('password', row)} title="Reset Password" style={btnGhost}>
                        <Key size={16} />
                    </button>
                    <button onClick={() => handleToggleActive(row)} title={row.is_active ? 'Deactivate' : 'Activate'}
                        style={{ ...btnGhost, color: row.is_active ? '#ef4444' : '#10b981' }}>
                        <Power size={16} />
                    </button>
                    <button onClick={() => handleDelete(row.id)} title="Delete" style={{ ...btnGhost, color: '#ef4444' }}>
                        <Trash2 size={16} />
                    </button>
                </div>
            )
        }
    ];

    const roleLabel = activeTab.charAt(0).toUpperCase() + activeTab.slice(1);

    return (
        <div>
            <div className="flex-between">
                <div>
                    <h1 style={{ margin: 0 }}>User Management</h1>
                    <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        Manage staff and patient accounts with full profile details
                    </p>
                </div>
                <button onClick={() => handleOpenModal('create')} className="btn-primary"
                    style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <Plus size={18} /> Add {roleLabel}
                </button>
            </div>

            {/* Filters */}
            <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text" placeholder="Search users…"
                            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                            style={{ ...fieldStyle, paddingLeft: '2.2rem' }}
                        />
                    </div>
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...fieldStyle, width: 'auto' }}>
                        <option value="all">All Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                </div>
            </div>

            {/* Tabs */}
            <div className="tabs" style={{ marginBottom: '1.5rem' }}>
                {['patient', 'doctor', 'nurse', 'admin'].map(role => (
                    <button key={role} className={`tab ${activeTab === role ? 'active' : ''}`}
                        onClick={() => setActiveTab(role)}>
                        {role.charAt(0).toUpperCase() + role.slice(1)}s
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="loading-spinner">Loading…</div>
            ) : (
                <div className="card">
                    <DataTable columns={columns} data={users} />
                </div>
            )}

            {/* Create / Edit Modal */}
            <Modal
                isOpen={showModal && modalMode !== 'password'}
                onClose={() => setShowModal(false)}
                title={modalMode === 'create' ? `Add ${roleLabel}` : `Edit ${selectedUser?.first_name || selectedUser?.username}`}
            >
                <form onSubmit={handleSubmit}>
                    {/* Avatar picker — only in edit mode (admin changes avatar on behalf of user) */}
                    {modalMode === 'edit' && selectedUser && (
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
                            <AvatarUpload
                                currentAvatar={selectedUser.avatar || null}
                                size={88}
                                uploadUrl={`/admin/users/${selectedUser.id}/avatar/`}
                                deleteUrl={`/admin/users/${selectedUser.id}/avatar/`}
                                onUpdate={(url) => {
                                    setSelectedUser(u => ({ ...u, avatar: url }));
                                    fetchUsers();
                                }}
                            />
                        </div>
                    )}
                    {/* ── Account Section ── */}
                    <SectionHeader icon={User} label="Account Info" />
                    <Row2>
                        <Field label="First Name">
                            <input style={fieldStyle} required value={formData.first_name}
                                onChange={e => setFormData({ ...formData, first_name: e.target.value })} />
                        </Field>
                        <Field label="Last Name">
                            <input style={fieldStyle} required value={formData.last_name}
                                onChange={e => setFormData({ ...formData, last_name: e.target.value })} />
                        </Field>
                    </Row2>
                    <Row2>
                        <Field label="Username">
                            <input style={fieldStyle} required value={formData.username}
                                disabled={modalMode === 'edit'}
                                onChange={e => setFormData({ ...formData, username: e.target.value })} />
                        </Field>
                        <Field label="Email">
                            <input type="email" style={fieldStyle} value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })} />
                        </Field>
                    </Row2>
                    {modalMode === 'create' && (
                        <Field label="Password">
                            <input type="password" style={fieldStyle} required value={formData.password}
                                onChange={e => setFormData({ ...formData, password: e.target.value })} />
                        </Field>
                    )}

                    {/* ── Role-specific profile section ── */}
                    {activeTab === 'patient' && <PatientFields profile={profileData} setProfile={setProfileData} />}
                    {activeTab === 'doctor' && <DoctorFields profile={profileData} setProfile={setProfileData} />}
                    {activeTab === 'nurse' && <NurseFields profile={profileData} setProfile={setProfileData} />}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                        <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                        <button type="submit" className="btn-primary">
                            {modalMode === 'create' ? `Create ${roleLabel}` : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Reset Password Modal */}
            <Modal
                isOpen={showModal && modalMode === 'password'}
                onClose={() => setShowModal(false)}
                title={`Reset Password — ${selectedUser?.username}`}
            >
                <form onSubmit={handleSubmit}>
                    <Field label="New Password">
                        <input type="password" style={fieldStyle} required value={resetPass}
                            onChange={e => setResetPass(e.target.value)} placeholder="Enter new password" />
                    </Field>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.25rem' }}>
                        <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                        <button type="submit" className="btn-primary">Reset Password</button>
                    </div>
                </form>
            </Modal>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

const btnGhost = {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--text-muted)', padding: '0.25rem', display: 'flex', alignItems: 'center',
};

export default UsersPage;

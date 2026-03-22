import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { Calendar, User, UserPlus, CheckCircle, Clock, Filter, Eye, X, Plus } from 'lucide-react';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import Toast from '../../components/common/Toast';

const AppointmentsPage = () => {
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [doctors, setDoctors] = useState([]);
    const [nurses, setNurses] = useState([]);

    // Filters
    const [filters, setFilters] = useState({
        status: 'all',
        date_from: '',
        date_to: '',
        doctor_id: '',
        search: ''
    });

    // Modal State
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [selectedAppt, setSelectedAppt] = useState(null);
    const [assignType, setAssignType] = useState('doctor'); // 'doctor' or 'nurse'
    const [selectedStaffId, setSelectedStaffId] = useState('');

    // Drawer State
    const [showDrawer, setShowDrawer] = useState(false);
    const [drawerAppt, setDrawerAppt] = useState(null); // Full details

    // Create Modal State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createForm, setCreateForm] = useState({
        patient_id: '',
        doctor_id: '',
        nurse_id: '',
        date_time: '',
        reason: '',
        notes: '',
        status: 'pending'
    });
    // Patient search for create modal
    const [patientSearch, setPatientSearch] = useState('');
    const [patients, setPatients] = useState([]); // For dropdown

    const [toast, setToast] = useState(null);

    const fetchAppointments = async () => {
        setLoading(true);
        try {
            let url = '/admin/appointments/?';
            const params = new URLSearchParams();
            if (filters.status !== 'all') params.append('status', filters.status);
            if (filters.date_from) params.append('date_from', filters.date_from);
            if (filters.date_to) params.append('date_to', filters.date_to);
            if (filters.doctor_id) params.append('doctor_id', filters.doctor_id);
            if (filters.search) params.append('search', filters.search);

            const response = await api.get(url + params.toString());
            setAppointments(response.data);
        } catch (error) {
            console.error("Failed to fetch appointments", error);
            setToast({ message: "Failed to fetch appointments", type: 'error' });
        }
        setLoading(false);
    };

    const fetchStaff = async () => {
        try {
            const [docsRes, nursesRes] = await Promise.all([
                api.get('/admin/users/?role=doctor'),
                api.get('/admin/users/?role=nurse')
            ]);
            setDoctors(docsRes.data);
            setNurses(nursesRes.data);
        } catch (error) {
            console.error("Failed to fetch staff", error);
        }
    };

    useEffect(() => {
        // Debounce fetch
        const timer = setTimeout(() => {
            fetchAppointments();
        }, 500);
        return () => clearTimeout(timer);
    }, [filters]);

    useEffect(() => {
        fetchStaff();
    }, []);

    useEffect(() => {
        const fetchPatients = async () => {
            if (!patientSearch) {
                setPatients([]);
                return;
            }
            try {
                const response = await api.get(`/search/users/?q=${patientSearch}`);
                setPatients(response.data);
            } catch (error) {
                console.error("Failed to search patients", error);
            }
        };

        const timer = setTimeout(() => {
            fetchPatients();
        }, 300);
        return () => clearTimeout(timer);
    }, [patientSearch]);

    const openAssignModal = (appt, type) => {
        setSelectedAppt(appt);
        setAssignType(type);
        setSelectedStaffId(''); // Reset selection
        setShowAssignModal(true);
    };

    const handleCreateSubmit = async (e) => {
        e.preventDefault();

        if (!createForm.patient_id) {
            setToast({ message: "Please select a patient from the search results.", type: 'error' });
            return;
        }

        try {
            const payload = { ...createForm };
            if (!payload.doctor_id) delete payload.doctor_id;
            if (!payload.nurse_id) delete payload.nurse_id;

            await api.post('/admin/appointments/', payload);
            setToast({ message: "Appointment schedule created", type: 'success' });
            setShowCreateModal(false);
            setCreateForm({
                patient_id: '',
                doctor_id: '',
                nurse_id: '',
                date_time: '',
                reason: '',
                notes: '',
                status: 'pending'
            });
            setPatientSearch('');
            fetchAppointments();
        } catch (error) {
            console.error("Creation error:", error);
            let msg = "Failed to schedule appointment";
            if (error.response && error.response.data) {
                if (error.response.data.detail) {
                    msg += ": " + error.response.data.detail;
                } else {
                    // Handle field errors (e.g. { patient_id: ["Required"] })
                    const fieldErrors = Object.entries(error.response.data)
                        .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : val}`)
                        .join(' | ');
                    if (fieldErrors) msg += ": " + fieldErrors;
                }
            }
            setToast({ message: msg, type: 'error' });
        }
    };

    const handleAssign = async (e) => {
        e.preventDefault();
        try {
            const endpoint = assignType === 'doctor' ? 'assign-doctor' : 'assign-nurse';
            const payload = assignType === 'doctor' ? { doctor_id: selectedStaffId } : { nurse_id: selectedStaffId };

            await api.patch(`/admin/appointments/${selectedAppt.id}/${endpoint}/`, payload);

            setToast({ message: `${assignType === 'doctor' ? 'Doctor' : 'Nurse'} assigned successfully`, type: 'success' });
            setShowAssignModal(false);
            fetchAppointments();
        } catch (error) {
            setToast({ message: "Assignment failed", type: 'error' });
        }
    };

    const handleViewDetails = (appt) => {
        setDrawerAppt(appt);
        setShowDrawer(true);
    };

    const handleCancelAppt = async (appt) => {
        const reason = prompt("Enter cancellation reason:");
        if (!reason) return;
        try {
            await api.patch(`/admin/appointments/${appt.id}/status/`, { status: 'cancelled' });
            // Note: ideally utilize a specific cancel endpoint with reason, using generic status update for now as per backend availability
            setToast({ message: "Appointment cancelled", type: 'success' });
            fetchAppointments();
        } catch (error) {
            setToast({ message: "Failed to cancel", type: 'error' });
        }
    };

    const columns = [
        { header: 'Date & Time', render: (row) => new Date(row.date_time).toLocaleString() },
        { header: 'Patient', accessor: 'patient_name' },
        { header: 'Doctor', render: (row) => row.doctor_name || <button className="btn-xs btn-outline" onClick={() => openAssignModal(row, 'doctor')}>Assign Dr.</button> },
        { header: 'Nurse', render: (row) => row.nurse_name || <button className="btn-xs btn-outline" onClick={() => openAssignModal(row, 'nurse')}>Assign Nurse</button> },
        { header: 'Status', render: (row) => <span className={`status ${row.status}`}>{row.status.replace('_', ' ')}</span> },
        {
            header: 'Actions', render: (row) => (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="text-muted" onClick={() => handleViewDetails(row)} title="View Details"><Eye size={18} /></button>
                    {row.status !== 'cancelled' && row.status !== 'completed' && (
                        <button className="text-red" onClick={() => handleCancelAppt(row)} title="Cancel"><X size={18} /></button>
                    )}
                </div>
            )
        }
    ];

    return (
        <div>
            <div className="flex-between">
                <h1>Appointment Management</h1>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="btn-primary" onClick={() => setShowCreateModal(true)} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <Plus size={18} /> Schedule Appt
                    </button>
                    <button className="btn-outline" onClick={fetchAppointments}>Refresh</button>
                </div>
            </div>

            {/* Filters */}
            <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <input
                    type="text" placeholder="Search Patient..."
                    value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value })}
                    style={{ padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)' }}
                />
                <select
                    value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}
                    style={{ padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)' }}
                >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="pending_approval">Pending Doctor Approval</option>
                    <option value="approved">Approved</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                </select>
                <select
                    value={filters.doctor_id} onChange={e => setFilters({ ...filters, doctor_id: e.target.value })}
                    style={{ padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)' }}
                >
                    <option value="">All Doctors</option>
                    {doctors.map(d => <option key={d.id} value={d.id}>Dr. {d.last_name}</option>)}
                </select>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input type="date" value={filters.date_from} onChange={e => setFilters({ ...filters, date_from: e.target.value })} style={{ padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', flex: 1 }} />
                    <input type="date" value={filters.date_to} onChange={e => setFilters({ ...filters, date_to: e.target.value })} style={{ padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', flex: 1 }} />
                </div>
            </div>

            <div className="card">
                <DataTable
                    columns={columns}
                    data={appointments}
                />
            </div>

            {/* Create Method */}
            <Modal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                title="Schedule New Appointment"
            >
                <form onSubmit={handleCreateSubmit}>
                    <div className="form-group" style={{ position: 'relative' }}>
                        <label>Patient (Search by Username, Name or ID)</label>
                        <input
                            type="text"
                            placeholder="Type Username, Name or ID..."
                            value={patientSearch}
                            onChange={(e) => {
                                setPatientSearch(e.target.value);
                                // Clear selection if user clears search
                                if (e.target.value === '') {
                                    setCreateForm({ ...createForm, patient_id: '' });
                                }
                            }}
                            autoComplete="off"
                        />
                        {patients.length > 0 && patientSearch && createForm.patient_id === '' && (
                            <div className="search-results">
                                {patients.map(p => (
                                    <div
                                        key={p.id}
                                        className="result-item"
                                        onClick={() => {
                                            setCreateForm({ ...createForm, patient_id: p.id });
                                            setPatientSearch(`${p.username} (${p.first_name} ${p.last_name})`);
                                            setPatients([]); // Hide results
                                        }}
                                    >
                                        <strong>{p.username}</strong> <br />
                                        <small className="text-muted">#{p.id} - {p.first_name} {p.last_name}</small>
                                    </div>
                                ))}
                            </div>
                        )}
                        {(!patientSearch && createForm.patient_id === '') && (
                            <small className="text-muted">Start typing to find a patient</small>
                        )}
                        {/* Hidden input to ensure required validation works if needed, or handle in submit */}
                    </div>

                    <div className="form-group">
                        <label>Date & Time</label>
                        <input
                            type="datetime-local"
                            required
                            value={createForm.date_time}
                            onChange={e => setCreateForm({ ...createForm, date_time: e.target.value })}
                        />
                    </div>

                    <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group">
                            <label>Assigned Doctor (Optional)</label>
                            <select
                                className="form-control"
                                value={createForm.doctor_id}
                                onChange={e => setCreateForm({ ...createForm, doctor_id: e.target.value })}
                            >
                                <option value="">-- Unassigned --</option>
                                {doctors.map(d => (
                                    <option key={d.id} value={d.id}>Dr. {d.last_name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Assigned Nurse (Optional)</label>
                            <select
                                className="form-control"
                                value={createForm.nurse_id}
                                onChange={e => setCreateForm({ ...createForm, nurse_id: e.target.value })}
                            >
                                <option value="">-- Unassigned --</option>
                                {nurses.map(n => (
                                    <option key={n.id} value={n.id}>{n.first_name} {n.last_name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Reason</label>
                        <textarea
                            required
                            rows="2"
                            value={createForm.reason}
                            onChange={e => setCreateForm({ ...createForm, reason: e.target.value })}
                        ></textarea>
                    </div>

                    <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group">
                            <label>Status</label>
                            <select
                                className="form-control"
                                value={createForm.status}
                                onChange={e => setCreateForm({ ...createForm, status: e.target.value })}
                            >
                                <option value="pending">Pending</option>
                                <option value="approved">Approved</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Internal Notes</label>
                            <input
                                value={createForm.notes}
                                onChange={e => setCreateForm({ ...createForm, notes: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="flex-between" style={{ marginTop: '1.5rem', justifyContent: 'flex-end', gap: '1rem' }}>
                        <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary">Cancel</button>
                        <button type="submit" className="btn-primary">Schedule Appointment</button>
                    </div>
                </form>
            </Modal>

            {/* Assignment Modal */}
            <Modal
                isOpen={showAssignModal}
                onClose={() => setShowAssignModal(false)}
                title={`Assign ${assignType === 'doctor' ? 'Doctor' : 'Nurse'} to Appt #${selectedAppt?.id}`}
            >
                <form onSubmit={handleAssign}>
                    <div className="form-group">
                        <label>Select {assignType === 'doctor' ? 'Doctor' : 'Nurse'}</label>
                        <select
                            className="form-control"
                            value={selectedStaffId}
                            onChange={(e) => setSelectedStaffId(e.target.value)}
                            required
                        >
                            <option value="">-- Select Staff --</option>
                            {(assignType === 'doctor' ? doctors : nurses).map(staff => (
                                <option key={staff.id} value={staff.id}>
                                    {staff.first_name} {staff.last_name} ({staff.username})
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex-between" style={{ marginTop: '1.5rem', justifyContent: 'flex-end', gap: '1rem' }}>
                        <button type="button" onClick={() => setShowAssignModal(false)} className="btn-secondary">Cancel</button>
                        <button type="submit" className="btn-primary">Assign</button>
                    </div>
                </form>
            </Modal>

            {/* Details Drawer (Simulated with Modal for now, typically a side panel) */}
            <Modal
                isOpen={showDrawer}
                onClose={() => setShowDrawer(false)}
                title="Appointment Details"
            >
                {drawerAppt && (
                    <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                            <div>
                                <p><strong>Patient:</strong> {drawerAppt.patient_name}</p>
                                <p><strong>Date:</strong> {new Date(drawerAppt.date_time).toLocaleString()}</p>
                                <p><strong>Status:</strong> <span className={`status ${drawerAppt.status}`}>{drawerAppt.status}</span></p>
                            </div>
                            <div>
                                <p><strong>Doctor:</strong> {drawerAppt.doctor_name || 'Unassigned'}</p>
                                <p><strong>Nurse:</strong> {drawerAppt.nurse_name || 'Unassigned'}</p>
                                <p><strong>Reason:</strong> {drawerAppt.reason}</p>
                            </div>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <h4>Vitals Recorded</h4>
                            {drawerAppt.vitals && drawerAppt.vitals.length > 0 ? (
                                <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem' }}>
                                    {drawerAppt.vitals.map((v, i) => (
                                        <div key={i} style={{ fontSize: '0.9rem' }}>
                                            <p style={{ margin: '0.25rem 0' }}><strong>BP:</strong> {v.blood_pressure} | <strong>Temp:</strong> {v.temperature}°C | <strong>HR:</strong> {v.heart_rate}</p>
                                            <p style={{ margin: '0.25rem 0', color: 'var(--text-muted)' }}><small>Recorded by {v.recorder_name} on {new Date(v.created_at).toLocaleDateString()}</small></p>
                                        </div>
                                    ))}
                                </div>
                            ) : <p className="text-muted">No vitals recorded.</p>}
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <h4>Consultation Notes</h4>
                            {drawerAppt.consultation ? (
                                <div style={{ background: '#eff6ff', padding: '0.75rem', borderRadius: '0.5rem' }}>
                                    <p><strong>Diagnosis:</strong> {drawerAppt.consultation.diagnosis}</p>
                                    <p><strong>Notes:</strong> {drawerAppt.consultation.notes}</p>
                                    {drawerAppt.consultation.prescription && (
                                        <div style={{ marginTop: '0.75rem', borderTop: '1px solid #dbeafe', paddingTop: '0.5rem' }}>
                                            <strong>Prescription:</strong>
                                            <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
                                                {drawerAppt.consultation.prescription.items.map((item, i) => (
                                                    <li key={i}>{item.medicine_name} ({item.dosage}) - {item.instructions}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            ) : <p className="text-muted">No consultation records.</p>}
                        </div>
                    </div>
                )}
                <div style={{ marginTop: '1rem', textAlign: 'right' }}>
                    <button onClick={() => setShowDrawer(false)} className="btn-secondary">Close</button>
                </div>
            </Modal>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

export default AppointmentsPage;

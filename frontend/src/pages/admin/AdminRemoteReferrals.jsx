import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import DataTable from '../../components/common/DataTable';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import Toast from '../../components/common/Toast';
import Modal from '../../components/common/Modal';
import { UserPlus, CheckCircle, Clock } from 'lucide-react';

const AdminRemoteReferrals = () => {
    const [vitals, setVitals] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);
    const [selectedVital, setSelectedVital] = useState(null);
    const [selectedDoctor, setSelectedDoctor] = useState('');
    const [showAssignModal, setShowAssignModal] = useState(false);

    useEffect(() => {
        fetchData();
        fetchDoctors();
    }, []);

    const fetchData = async () => {
        try {
            const res = await api.get('/admin/remote-vitals/');
            setVitals(res.data);
        } catch (error) {
            console.error("Failed to fetch vitals", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchDoctors = async () => {
        try {
            const res = await api.get('/search/users/?role=doctor');
            setDoctors(res.data);
        } catch (error) {
            console.error("Failed to fetch doctors", error);
        }
    };

    const handleAssignClick = (vital) => {
        setSelectedVital(vital);
        // Pre-select current doctor if assigned
        setSelectedDoctor(vital.assigned_to || '');
        setShowAssignModal(true);
    };

    const handleAssignSubmit = async (e) => {
        e.preventDefault();
        if (!selectedDoctor) return;

        try {
            await api.post(`/admin/remote-vitals/${selectedVital.id}/assign/`, { doctor_id: selectedDoctor });
            setToast({ message: "Referral assigned successfully", type: 'success' });
            setShowAssignModal(false);
            fetchData(); // Refresh list
        } catch (error) {
            setToast({ message: "Failed to assign referral", type: 'error' });
        }
    };

    const columns = [
        { header: 'Date', render: (row) => new Date(row.created_at).toLocaleString() },
        { header: 'Patient', render: (row) => row.patient_name || `Patient #${row.patient}` },
        {
            header: 'Status', render: (row) => (
                <span className={`badge ${row.status === 'pending' ? 'bg-warning' : row.status === 'assigned' ? 'bg-info' : 'bg-success'}`}>
                    {row.status.toUpperCase()}
                </span>
            )
        },
        {
            header: 'Assigned To', render: (row) => {
                const doc = doctors.find(d => d.id === row.assigned_to);
                return doc ? `Dr. ${doc.first_name} ${doc.last_name}` : '-';
            }
        },
        { header: 'Symptoms', accessor: 'symptoms' },
        {
            header: 'Actions', render: (row) => (
                <button className="btn-sm btn-primary" onClick={() => handleAssignClick(row)}>
                    {row.assigned_to ? 'Reassign' : 'Assign'}
                </button>
            )
        }
    ];

    if (loading) return <LoadingSkeleton />;

    return (
        <div className="fade-in">
            <h1>Remote Referrals Triage</h1>
            <p className="text-muted mb-2">Review patient-submitted vitals and assign them to doctors.</p>

            <div className="card">
                <DataTable columns={columns} data={vitals} />
            </div>

            <Modal
                isOpen={showAssignModal}
                onClose={() => setShowAssignModal(false)}
                title="Assign Referral to Doctor"
            >
                <form onSubmit={handleAssignSubmit}>
                    <p>Assigning patient <strong>{selectedVital?.patient_name}</strong>'s referral.</p>
                    <div className="form-group">
                        <label>Select Doctor</label>

                        {/* Search Input */}
                        <div className="flex-start gap-0_5 mb-1">
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Type to search doctor..."
                                onChange={(e) => {
                                    const val = e.target.value;
                                    // Debounce or just call API?
                                    // For simplicity, let's just trigger a search if length > 2 or empty
                                    if (val.length === 0) fetchDoctors();
                                    else if (val.length > 1) {
                                        api.get(`/search/users/?role=doctor&q=${val}`)
                                            .then(res => setDoctors(res.data))
                                            .catch(console.error);
                                    }
                                }}
                            />
                        </div>

                        <select
                            className="form-control"
                            value={selectedDoctor}
                            onChange={e => setSelectedDoctor(e.target.value)}
                            required
                            size={5} // Show multiple items to look like a list
                        >
                            <option value="">-- Select Doctor --</option>
                            {doctors.map(doc => (
                                <option key={doc.id} value={doc.id}>
                                    Dr. {doc.first_name} {doc.last_name} ({doc.is_active ? 'Available' : 'Unavailable'})
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex-end gap-1 mt-2">
                        <button type="button" className="btn-secondary" onClick={() => setShowAssignModal(false)}>Cancel</button>
                        <button type="submit" className="btn-primary">Assign</button>
                    </div>
                </form>
            </Modal>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

export default AdminRemoteReferrals;

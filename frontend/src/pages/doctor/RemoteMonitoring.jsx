import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { useNavigate } from 'react-router-dom';
import { Activity, MessageSquare, Pill, ArrowLeft, Calendar } from 'lucide-react';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import Toast from '../../components/common/Toast';

const RemoteMonitoring = () => {
    const navigate = useNavigate();
    const [vitals, setVitals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [selectedVital, setSelectedVital] = useState(null);
    const [feedback, setFeedback] = useState('');

    useEffect(() => {
        const fetchVitals = async () => {
            try {
                const response = await api.get('/doctor/remote-vitals/');
                setVitals(response.data);
            } catch (error) {
                console.error("Failed to fetch remote vitals", error);
                setToast({ message: "Failed to load data", type: 'error' });
            } finally {
                setLoading(false);
            }
        };
        fetchVitals();
    }, []);

    const handleReviewClick = (vital) => {
        setSelectedVital(vital);
        setFeedback(vital.doctor_feedback || '');
        setShowReviewModal(true);
    };

    const handleFeedbackSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/doctor/remote-vitals/${selectedVital.id}/submit_feedback/`, { feedback });
            setToast({ message: "Feedback submitted successfully", type: 'success' });
            setShowReviewModal(false);
            // Refresh list
            const response = await api.get('/doctor/remote-vitals/');
            setVitals(response.data);
        } catch (error) {
            setToast({ message: "Failed to submit feedback", type: 'error' });
        }
    };

    const columns = [
        { header: 'Date', render: (row) => new Date(row.created_at).toLocaleString() },
        { header: 'Patient', render: (row) => row.patient_name || `Patient #${row.patient}` },
        {
            header: 'Recorded By', render: (row) => (
                <div style={{ fontSize: '0.82rem' }}>
                    <div style={{ fontWeight: 600 }}>{row.recorder_name || '—'}</div>
                    {row.recorder_role && (
                        <span style={{
                            display: 'inline-block', marginTop: '0.15rem',
                            padding: '0.05rem 0.4rem', borderRadius: 999,
                            fontSize: '0.65rem', fontWeight: 700, textTransform: 'capitalize',
                            background: row.recorder_role === 'nurse' ? '#e0f2fe' : row.recorder_role === 'patient' ? '#d1fae5' : '#ede9fe',
                            color: row.recorder_role === 'nurse' ? '#0ea5e9' : row.recorder_role === 'patient' ? '#059669' : '#7c3aed',
                        }}>{row.recorder_role}</span>
                    )}
                </div>
            )
        },
        {
            header: 'Vitals', render: (row) => (
                <div className="text-sm">
                    {row.temperature && <div>T: {row.temperature}°C </div>}
                    {row.blood_pressure && <div>BP: {row.blood_pressure} </div>}
                    {row.weight && <div>Wt: {row.weight}kg</div>}
                    {row.heart_rate && <div>HR: {row.heart_rate}bpm</div>}
                </div>
            )
        },
        { header: 'Symptoms', accessor: 'symptoms' },
        {
            header: 'Status', render: (row) => (
                <span className={`badge ${row.status === 'reviewed' ? 'bg-success' : 'bg-info'}`}>
                    {row.status}
                </span>
            )
        },
        {
            header: 'Actions', render: (row) => (
                <button className="btn-sm btn-primary" onClick={() => handleReviewClick(row)}>
                    {row.status === 'reviewed' ? 'Edit Feedback' : 'Review'}
                </button>
            )
        }
    ];

    if (loading) return <LoadingSkeleton />;

    return (
        <div className="fade-in">
            <header className="flex-between mb-2">
                <div className="flex-start gap-1">
                    <button className="btn-icon" onClick={() => navigate('/doctor')}><ArrowLeft /></button>
                    <div>
                        <h1>Assigned Remote Patients</h1>
                        <p className="text-muted">Review vitals and symptoms assigned to you.</p>
                    </div>
                </div>
            </header>

            <div className="card">
                <DataTable columns={columns} data={vitals} />
            </div>

            {/* Review Modal */}
            {selectedVital && (
                <Modal
                    isOpen={showReviewModal}
                    onClose={() => setShowReviewModal(false)}
                    title={`Review Patient: ${selectedVital.patient_name || 'Unknown'}`}
                >
                    <div className="mb-2">
                        <p><strong>Date:</strong> {new Date(selectedVital.created_at).toLocaleString()}</p>
                        {selectedVital.recorder_name && (
                            <p style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', margin: '0.35rem 0' }}>
                                <strong>Recorded by:</strong>
                                <span style={{ fontWeight: 600 }}>{selectedVital.recorder_name}</span>
                                {selectedVital.recorder_role && (
                                    <span style={{
                                        padding: '0.05rem 0.45rem', borderRadius: 999,
                                        fontSize: '0.65rem', fontWeight: 700, textTransform: 'capitalize',
                                        background: selectedVital.recorder_role === 'nurse' ? '#e0f2fe' : selectedVital.recorder_role === 'patient' ? '#d1fae5' : '#ede9fe',
                                        color: selectedVital.recorder_role === 'nurse' ? '#0ea5e9' : selectedVital.recorder_role === 'patient' ? '#059669' : '#7c3aed',
                                    }}>{selectedVital.recorder_role}</span>
                                )}
                            </p>
                        )}
                        <p><strong>Symptoms:</strong> {selectedVital.symptoms || 'None'}</p>
                        <hr className="my-1" />
                        <div className="grid-2 gap-1">
                            <div><strong>Temp:</strong> {selectedVital.temperature ? `${selectedVital.temperature}°C` : '-'}</div>
                            <div><strong>BP:</strong> {selectedVital.blood_pressure || '-'}</div>
                            <div><strong>HR:</strong> {selectedVital.heart_rate ? `${selectedVital.heart_rate} bpm` : '-'}</div>
                            <div><strong>Weight:</strong> {selectedVital.weight ? `${selectedVital.weight} kg` : '-'}</div>
                        </div>
                    </div>

                    <form onSubmit={handleFeedbackSubmit} className="mt-2">
                        <div className="form-group">
                            <label>Doctor's Feedback / Instructions</label>
                            <textarea
                                className="form-control"
                                rows="4"
                                value={feedback}
                                onChange={(e) => setFeedback(e.target.value)}
                                placeholder="Enter advice, prescription notes, or next steps..."
                                required
                            ></textarea>
                        </div>
                        <div className="flex-end gap-1 mt-2">
                            <button type="button" className="btn-secondary" onClick={() => setShowReviewModal(false)}>Cancel</button>
                            <button type="submit" className="btn-primary">Submit Feedback</button>
                        </div>
                    </form>
                </Modal>
            )}

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

export default RemoteMonitoring;

import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { Activity, User, Clock, AlertCircle, Pill, Power, Wifi } from 'lucide-react';
import Modal from '../../components/common/Modal';
import DataTable from '../../components/common/DataTable';
import PrescriptionsPanel from './PrescriptionsPanel';
import NurseMedications from './NurseMedications';
import Toast from '../../components/common/Toast';

const NurseDashboard = () => {
    const [activeTab, setActiveTab] = useState('queue'); // queue | medications | prescriptions
    const [queue, setQueue] = useState([]);
    const [loadingQueue, setLoadingQueue] = useState(true);
    const [selectedAppt, setSelectedAppt] = useState(null);
    const [vitals, setVitals] = useState({ temperature: '', blood_pressure: '', heart_rate: '', weight: '', symptoms: '' });
    const [showModal, setShowModal] = useState(false);
    const [toast, setToast] = useState(null);
    const [onDuty, setOnDuty] = useState(null);  // null = loading
    const [dutyToggling, setDutyToggling] = useState(false);

    // Fetch if nurse is currently on duty
    useEffect(() => {
        api.get('/me/').then(r => {
            setOnDuty(r.data.is_on_duty ?? false);
        }).catch(() => setOnDuty(false));
    }, []);

    const toggleDuty = async () => {
        setDutyToggling(true);
        try {
            const res = await api.patch('/me/availability/');
            setOnDuty(res.data.is_on_duty);
            setToast({ message: res.data.detail, type: res.data.is_on_duty ? 'success' : 'info' });
        } catch {
            setToast({ message: 'Failed to update shift status', type: 'error' });
        }
        setDutyToggling(false);
    };


    const fetchQueue = async () => {
        setLoadingQueue(true);
        try {
            const response = await api.get('/nurse/queue/');
            setQueue(response.data);
        } catch (error) {
            console.error("Failed to fetch queue", error);
        } finally {
            setLoadingQueue(false);
        }
    };

    useEffect(() => {
        fetchQueue();
    }, []);

    const openVitalsModal = (appt) => {
        setSelectedAppt(appt);
        // Reset vitals form
        setVitals({ temperature: '', blood_pressure: '', heart_rate: '', weight: '', symptoms: '' });
        setShowModal(true);
    };

    const handleSubmitVitals = async (e) => {
        e.preventDefault();
        try {
            await api.post('/nurse/vitals/add/', {
                ...vitals,
                patient_id: selectedAppt.patient,
                appointment_id: selectedAppt.id
            });
            setToast({ message: "Vitals recorded successfully", type: 'success' });
            setShowModal(false);
            // Optionally update status to approved or something if not already
        } catch (error) {
            setToast({ message: "Failed to record vitals", type: 'error' });
        }
    };

    const queueColumns = [
        { header: 'Time', render: (row) => new Date(row.date_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
        { header: 'Patient', accessor: 'patient_name' },
        { header: 'Reason', accessor: 'reason' },
        { header: 'Status', render: (row) => <span className={`status ${row.status}`}>{row.status}</span> },
        {
            header: 'Vitals', render: (row) => {
                const latest = row.vitals && row.vitals.length > 0 ? row.vitals[row.vitals.length - 1] : null;
                if (!latest) {
                    return (
                        <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontStyle: 'italic' }}>Not recorded</span>
                    );
                }
                return (
                    <div style={{ fontSize: '0.78rem' }}>
                        <div style={{ color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Activity size={12} /> Done
                        </div>
                        <div style={{ color: '#64748b', marginTop: '0.1rem' }}>
                            by <strong>{latest.recorder_name || 'Unknown'}</strong>
                            {latest.recorder_role && (
                                <span style={{
                                    marginLeft: '0.25rem', padding: '0.02rem 0.35rem', borderRadius: 999,
                                    fontSize: '0.6rem', fontWeight: 700, textTransform: 'capitalize',
                                    background: latest.recorder_role === 'nurse' ? '#e0f2fe' : latest.recorder_role === 'patient' ? '#d1fae5' : '#ede9fe',
                                    color: latest.recorder_role === 'nurse' ? '#0ea5e9' : latest.recorder_role === 'patient' ? '#059669' : '#7c3aed',
                                }}>{latest.recorder_role}</span>
                            )}
                        </div>
                    </div>
                );
            }
        },
        {
            header: 'Actions', render: (row) => (
                <button
                    className="btn-primary btn-sm"
                    onClick={() => openVitalsModal(row)}
                >
                    <Activity size={16} /> Vitals
                </button>
            )
        }
    ];

    return (
        <div className="fade-in">
            {/* ── Header ── */}
            <div className="flex-between" style={{ marginBottom: '1.25rem' }}>
                <div>
                    <h1 style={{ margin: 0 }}>Nurse Station</h1>
                    <p className="text-muted" style={{ margin: '0.25rem 0 0' }}>Manage patient triage queue and active medications</p>
                </div>

                {/* Shift status toggle */}
                <button
                    onClick={toggleDuty}
                    disabled={dutyToggling || onDuty === null}
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                        padding: '0.5rem 1.1rem', borderRadius: 9999, border: 'none', cursor: 'pointer',
                        fontWeight: 700, fontSize: '0.85rem', transition: 'all 0.2s',
                        background: onDuty ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#94a3b8',
                        color: '#fff',
                        boxShadow: onDuty ? '0 0 0 4px rgba(16, 185, 129, 0.2)' : 'none',
                    }}
                >
                    <Power size={15} />
                    <span>{dutyToggling ? 'Updating…' : onDuty ? '🟢 On Duty' : '🔴 Off Duty'}</span>
                </button>
            </div>

            {/* ── Navigation Tabs ── */}
            <div className="tabs" style={{ marginBottom: '1.5rem' }}>
                <button
                    className={`tab ${activeTab === 'queue' ? 'active' : ''}`}
                    onClick={() => setActiveTab('queue')}
                >
                    <Activity size={16} /> <span>Patient Queue ({queue.length})</span>
                </button>
                <button
                    className={`tab ${activeTab === 'medications' ? 'active' : ''}`}
                    onClick={() => setActiveTab('medications')}
                >
                    <Pill size={16} /> <span>Medication Roster</span>
                </button>
                <button
                    className={`tab ${activeTab === 'prescriptions' ? 'active' : ''}`}
                    onClick={() => setActiveTab('prescriptions')}
                >
                    <User size={16} /> <span>Prescriptions & Orders</span>
                </button>
            </div>

            {activeTab === 'queue' ? (
                <div className="card">
                    <DataTable
                        columns={queueColumns}
                        data={queue}
                        isLoading={loadingQueue}
                    />
                </div>
            ) : activeTab === 'medications' ? (
                <div className="card" style={{ padding: '1.5rem' }}>
                    <NurseMedications />
                </div>
            ) : (
                <div className="card">
                    <PrescriptionsPanel />
                </div>
            )}

            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={`Record Vitals for ${selectedAppt?.patient_name}`}
            >
                <form onSubmit={handleSubmitVitals}>
                    <div className="form-group grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label>Temperature (°C)</label>
                            <input type="number" step="0.1" required value={vitals.temperature} onChange={e => setVitals({ ...vitals, temperature: e.target.value })} />
                        </div>
                        <div>
                            <label>Blood Pressure</label>
                            <input type="text" placeholder="120/80" required value={vitals.blood_pressure} onChange={e => setVitals({ ...vitals, blood_pressure: e.target.value })} />
                        </div>
                        <div>
                            <label>Heart Rate (bpm)</label>
                            <input type="number" required value={vitals.heart_rate} onChange={e => setVitals({ ...vitals, heart_rate: e.target.value })} />
                        </div>
                        <div>
                            <label>Weight (kg)</label>
                            <input type="number" step="0.1" required value={vitals.weight} onChange={e => setVitals({ ...vitals, weight: e.target.value })} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Symptoms / Triage Notes</label>
                        <textarea
                            rows="3"
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}
                            value={vitals.symptoms}
                            onChange={e => setVitals({ ...vitals, symptoms: e.target.value })}
                        ></textarea>
                    </div>
                    <div className="flex-between" style={{ marginTop: '1.5rem', justifyContent: 'flex-end', gap: '1rem' }}>
                        <button type="button" onClick={() => setShowModal(false)} className="btn-secondary" style={{ padding: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '0.5rem', background: 'white' }}>Cancel</button>
                        <button type="submit" className="btn-primary">Save Vitals</button>
                    </div>
                </form>
            </Modal>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

export default NurseDashboard;

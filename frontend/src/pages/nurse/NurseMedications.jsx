import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import Toast from '../../components/common/Toast';

const NurseMedications = () => {
    const [queue, setQueue] = useState([]);
    const [filter, setFilter] = useState('due'); // due | upcoming
    const [toast, setToast] = useState(null);

    const fetchQueue = async () => {
        try {
            const res = await api.get(`/nurse/med-queue/?scope=${filter}`);
            setQueue(res.data);
        } catch (e) { console.error(e); }
    };

    useEffect(() => { fetchQueue(); }, [filter]);

    const administer = async (id) => {
        try {
            await api.patch(`/nurse/med-queue/${id}/administer/`);
            setToast({ message: "Administered!", type: 'success' });
            fetchQueue();
        } catch (e) { setToast({ message: "Failed", type: 'error' }); }
    };

    return (
        <div className="fade-in">
            <div className="flex-between mb-2">
                <h1>Medication Queue</h1>
                <div className="tabs">
                    <button className={`tab ${filter === 'due' ? 'active' : ''}`} onClick={() => setFilter('due')}>Due Now</button>
                    <button className={`tab ${filter === 'upcoming' ? 'active' : ''}`} onClick={() => setFilter('upcoming')}>Upcoming</button>
                </div>
            </div>

            {queue.length === 0 ? <p className="text-center text-muted">No medications in this queue.</p> : (
                <div className="grid-2 gap-1">
                    {queue.map(task => (
                        <div key={task.id} className="card p-1_5 border-left-primary">
                            <div className="flex-between mb-1">
                                <h3 className="mb-0">{task.medicine_name} {task.dosage}</h3>
                                <span className="badge badge-warning">{task.status}</span>
                            </div>
                            <div className="text-sm text-muted mb-1">
                                <p><strong>Patient:</strong> {task.patient_name} (Bed {task.bed})</p>
                                <p><strong>Route:</strong> {task.route}</p>
                                <p className="flex-start gap-0_5"><Clock size={14} /> Scheduled: {new Date(task.scheduled_time).toLocaleTimeString()}</p>
                            </div>
                            <button className="btn-success full-width flex-center gap-0_5" onClick={() => administer(task.id)}>
                                <CheckCircle size={16} /> Mark Administered
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

export default NurseMedications;

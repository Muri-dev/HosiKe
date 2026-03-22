import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import {
    User, Activity, FileText, Pill, MessageSquare, Save, CheckCircle,
    ArrowLeft, ClipboardList, History as HistoryIcon, AlertCircle,
    Send, Calendar, Thermometer, Heart, Bed
} from 'lucide-react';
import LoadingSkeleton from '../../components/common/LoadingSkeleton.jsx';
import Toast from '../../components/common/Toast';

const DoctorWorkbench = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [appointment, setAppointment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);
    const [activeTab, setActiveTab] = useState('summary');

    // Clinical Forms
    const [consultation, setConsultation] = useState({
        chief_complaint: '', diagnosis: '', clinical_notes: '',
        treatment_plan: '', lab_results: '', follow_up_notes: ''
    });

    // Rx & Tasks State
    const [prescriptionItems, setPrescriptionItems] = useState([]);
    const [newItem, setNewItem] = useState({ medicine_name: '', dosage: '', route: 'Oral', frequency: '', duration: '', active_until: '', instructions: '' });
    const [tasks, setTasks] = useState([]);
    const [newTask, setNewTask] = useState({ task_type: 'Observation', details: '', priority: 'normal' });

    // History & Vitals
    const [history, setHistory] = useState([]);
    const [vitalsHistory, setVitalsHistory] = useState([]);

    // Messages
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [conversationId, setConversationId] = useState(null);
    const messagesEndRef = useRef(null);

    // Initial Data Load
    const fetchDetails = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/doctor/appointments/${id}/`);
            setAppointment(response.data);

            // Populate Forms if exist
            if (response.data.consultation) {
                setConsultation({ ...consultation, ...response.data.consultation });
                if (response.data.consultation.prescription?.items) {
                    setPrescriptionItems(response.data.consultation.prescription.items);
                }
            }
            if (response.data.nurse_tasks) setTasks(response.data.nurse_tasks);
            if (response.data.vitals) setVitalsHistory(response.data.vitals);

            // Fetch generic history
            try {
                const hist = await api.get(`/doctor/appointments/patients/${response.data.patient}/history/`);
                setHistory(hist.data);
            } catch (e) { console.warn("History error", e); }

        } catch (error) {
            setToast({ message: "Failed to load patient data", type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    // Chat Logic
    const fetchMessages = async () => {
        if (!appointment?.patient) return;
        try {
            // Auto-start/get conversation
            let convId = conversationId;
            if (!convId) {
                const startRes = await api.post('/conversations/start/', { recipient_id: appointment.patient });
                convId = startRes.data.id;
                setConversationId(convId);
            }
            const msgRes = await api.get(`/conversations/${convId}/messages/`);
            setMessages(msgRes.data);
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        } catch (e) { console.error("Chat error", e); }
    };

    const sendMessage = async () => {
        if (!newMessage.trim() || !conversationId) return;
        try {
            await api.post(`/conversations/${conversationId}/messages/`, { content: newMessage });
            setNewMessage('');
            fetchMessages();
        } catch (e) { setToast({ message: "Failed to send", type: 'error' }); }
    };

    useEffect(() => { fetchDetails(); }, [id]);
    useEffect(() => { if (activeTab === 'messages') { fetchMessages(); const i = setInterval(fetchMessages, 5000); return () => clearInterval(i); } }, [activeTab, appointment]);

    // Handlers
    const saveConsultation = async (statusUpdate = null) => {
        try {
            const payload = { ...consultation, status_update: statusUpdate };
            await api.post(`/doctor/appointments/${id}/consultation/`, payload);
            setToast({ message: "Consultation Saved", type: 'success' });
            if (statusUpdate === 'completed') navigate('/doctor/appointments');
            else fetchDetails();
        } catch (e) { setToast({ message: "Save Failed", type: 'error' }); }
    };

    const addRxItem = () => {
        if (!newItem.medicine_name) return setToast({ message: "Medicine Name required", type: 'error' });
        setPrescriptionItems([...prescriptionItems, newItem]);
        setNewItem({ medicine_name: '', dosage: '', route: 'Oral', frequency: '', duration: '', active_until: '', instructions: '' });
    };

    const saveRx = async () => {
        const newItems = prescriptionItems.filter(i => !i.id);
        if (!newItems.length) return;
        try {
            await api.post(`/doctor/appointments/${id}/prescriptions/`, { items: newItems });
            setToast({ message: "Rx Saved", type: 'success' });
            fetchDetails();
        } catch (e) { setToast({ message: "Rx Save Failed", type: 'error' }); }
    };

    const addTask = async () => {
        if (!newTask.details) return;
        try {
            await api.post(`/doctor/appointments/${id}/nurse-tasks/`, newTask);
            setToast({ message: "Order Sent", type: 'success' });
            setNewTask({ task_type: 'Observation', details: '', priority: 'normal' });
            fetchDetails();
        } catch (e) { setToast({ message: "Order Failed", type: 'error' }); }
    };

    if (loading) return <LoadingSkeleton />;
    if (!appointment) return <div className="p-4 text-center">Not Found</div>;

    // Render Helpers

    return (
        <div className="fade-in workbench-container">
            {/* Top Bar */}
            <div className="top-bar card flex-between mb-1 p-1 sticky-top z-10">
                <div className="flex-start gap-1">
                    <button className="btn-icon" aria-label="Go back to appointments" onClick={() => navigate('/doctor/appointments')}><ArrowLeft /></button>
                    <div>
                        <h2 className="mb-0">{appointment.patient_name}</h2>
                        <div className="text-sm text-muted flex-start gap-1">
                            <span>{appointment.patient_details?.gender}</span>
                            <span>{appointment.patient_details?.dob}</span>
                            <span className="badge badge-secondary">{appointment.status}</span>
                        </div>
                    </div>
                </div>
                {appointment.status !== 'completed' && (
                    <button className="btn-success" onClick={() => saveConsultation('completed')}>
                        <CheckCircle size={18} className="mr-0_5" /> Finalize & Discharge
                    </button>
                )}
            </div>

            <div className="main-layout">
                {/* Left Sidebar: Patient Overview */}
                <div className="sidebar card">
                    <div className="section">
                        <h4 className="flex-start gap-0_5 text-primary"><User size={18} /> Profile</h4>
                        <div className="data-row"><strong>Phone:</strong> {appointment.patient_details?.phone || '--'}</div>
                        <div className="data-row"><strong>Blood:</strong> {appointment.patient_details?.blood_group || '--'}</div>
                        <div className="data-row"><strong>Allergies:</strong> <span className="text-danger">None</span></div>
                    </div>
                    <hr />
                    <div className="section">
                        <h4 className="flex-start gap-0_5 text-primary"><Activity size={18} /> Recent Vitals</h4>
                        {vitalsHistory.length > 0 ? (
                            <div className="vitals-grid">
                                <div className="vital-box">
                                    <span className="label">BP</span>
                                    <span className="value">{vitalsHistory[0].blood_pressure}</span>
                                </div>
                                <div className="vital-box">
                                    <span className="label">HR</span>
                                    <span className="value flex-center gap-0_5"><Heart size={12} className="text-danger" /> {vitalsHistory[0].heart_rate}</span>
                                </div>
                                <div className="vital-box">
                                    <span className="label">Temp</span>
                                    <span className="value">{vitalsHistory[0].temperature}°C</span>
                                </div>
                                <div className="vital-box">
                                    <span className="label">Weight</span>
                                    <span className="value">{vitalsHistory[0].weight}kg</span>
                                </div>
                                <div className="text-xs text-muted mt-0_5 w-100" style={{ gridColumn: 'span 2' }}>
                                    {new Date(vitalsHistory[0].created_at).toLocaleTimeString()}
                                    {vitalsHistory[0].recorder_name && (
                                        <span style={{ marginLeft: '0.4rem' }}>
                                            · <span style={{ fontWeight: 600, color: 'var(--text-color)' }}>{vitalsHistory[0].recorder_name}</span>
                                            {vitalsHistory[0].recorder_role && (
                                                <span style={{
                                                    marginLeft: '0.3rem', padding: '0.05rem 0.35rem',
                                                    borderRadius: 999, fontSize: '0.62rem', fontWeight: 700,
                                                    textTransform: 'capitalize',
                                                    background: vitalsHistory[0].recorder_role === 'nurse' ? '#e0f2fe' : vitalsHistory[0].recorder_role === 'patient' ? '#d1fae5' : '#ede9fe',
                                                    color: vitalsHistory[0].recorder_role === 'nurse' ? '#0ea5e9' : vitalsHistory[0].recorder_role === 'patient' ? '#059669' : '#7c3aed',
                                                }}>{vitalsHistory[0].recorder_role}</span>
                                            )}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ) : <p className="text-muted text-sm">No recent vitals.</p>}
                    </div>
                    <hr />
                    <div className="section">
                        <h4 className="flex-start gap-0_5 text-primary"><Calendar size={18} /> Visit Info</h4>
                        <p className="text-sm"><strong>Reason:</strong> {appointment.reason}</p>
                        <p className="text-sm"><strong>Notes:</strong> {appointment.notes}</p>
                    </div>
                </div>

                {/* Right Content: Tabs */}
                <div className="content-area card">
                    <div className="tabs-nav" role="tablist">
                        <button role="tab" aria-selected={activeTab === 'summary'} onClick={() => setActiveTab('summary')} className={`tab-btn ${activeTab === 'summary' ? 'active' : ''}`}><FileText size={18} /> Clinical Note</button>
                        <button role="tab" aria-selected={activeTab === 'tabs_rx'} onClick={() => setActiveTab('tabs_rx')} className={`tab-btn ${activeTab === 'tabs_rx' ? 'active' : ''}`}><Pill size={18} /> Prescriptions</button>
                        <button role="tab" aria-selected={activeTab === 'orders'} onClick={() => setActiveTab('orders')} className={`tab-btn ${activeTab === 'orders' ? 'active' : ''}`}><ClipboardList size={18} /> Orders</button>
                        <button role="tab" aria-selected={activeTab === 'history'} onClick={() => setActiveTab('history')} className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}><HistoryIcon size={18} /> History</button>
                        <button role="tab" aria-selected={activeTab === 'messages'} onClick={() => setActiveTab('messages')} className={`tab-btn ${activeTab === 'messages' ? 'active' : ''}`}><MessageSquare size={18} /> Chat</button>
                    </div>

                    <div className="tab-body p-1_5">
                        {activeTab === 'summary' && (
                            <div className="form-grid">
                                <div className="form-group full-width">
                                    <label>Chief Complaint</label>
                                    <input className="form-control" value={consultation.chief_complaint} onChange={e => setConsultation({ ...consultation, chief_complaint: e.target.value })} placeholder="Main reason for visit..." />
                                </div>
                                <div className="form-group full-width">
                                    <label>Clinical Observations & Notes</label>
                                    <textarea className="form-control" rows={6} value={consultation.clinical_notes} onChange={e => setConsultation({ ...consultation, clinical_notes: e.target.value })} placeholder="Enter detailed notes here..." />
                                </div>
                                <div className="form-group">
                                    <label>Diagnosis (ICD-10)</label>
                                    <input className="form-control" value={consultation.diagnosis} onChange={e => setConsultation({ ...consultation, diagnosis: e.target.value })} placeholder="e.g., Acute Bronchitis" />
                                </div>
                                <div className="form-group">
                                    <label>Treatment Plan</label>
                                    <input className="form-control" value={consultation.treatment_plan} onChange={e => setConsultation({ ...consultation, treatment_plan: e.target.value })} placeholder="Plan details..." />
                                </div>
                                <div className="text-right full-width mt-1">
                                    <button className="btn-primary" onClick={() => saveConsultation()}><Save size={18} className="mr-0_5" /> Save Draft</button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'tabs_rx' && (
                            <div className="rx-section">
                                <div className="rx-list mb-2">
                                    <h4 className="mb-1">Current Prescriptions</h4>
                                    {prescriptionItems.length === 0 ? <p className="text-muted">No items added.</p> : (
                                        <table className="data-table">
                                            <thead><tr><th>Drug</th><th>Dose</th><th>Route</th><th>Freq</th><th>Status</th></tr></thead>
                                            <tbody>
                                                {prescriptionItems.map((item, i) => (
                                                    <tr key={i}>
                                                        <td>{item.medicine_name}</td>
                                                        <td>{item.dosage}</td>
                                                        <td>{item.route}</td>
                                                        <td>{item.frequency}</td>
                                                        <td><span className={`badge badge-${item.status === 'active' ? 'success' : 'secondary'}`}>{item.status}</span></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                                <div className="add-rx-form bg-light p-1 rounded">
                                    <h4 className="mb-1">Add Medication</h4>
                                    <div className="grid-3 gap-1 mb-1">
                                        <input className="form-control" placeholder="Medicine Name" value={newItem.medicine_name} onChange={e => setNewItem({ ...newItem, medicine_name: e.target.value })} />
                                        <input className="form-control" placeholder="Dosage (e.g. 500mg)" value={newItem.dosage} onChange={e => setNewItem({ ...newItem, dosage: e.target.value })} />
                                        <select className="form-control" value={newItem.route} onChange={e => setNewItem({ ...newItem, route: e.target.value })}>
                                            <option>Oral</option><option>IV</option><option>IM</option><option>Sublingual</option>
                                        </select>
                                    </div>
                                    <div className="grid-3 gap-1 mb-1">
                                        <input className="form-control" placeholder="Frequency (e.g. BID)" value={newItem.frequency} onChange={e => setNewItem({ ...newItem, frequency: e.target.value })} />
                                        <input className="form-control" placeholder="Duration (e.g. 5 days)" value={newItem.duration} onChange={e => setNewItem({ ...newItem, duration: e.target.value })} />
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Active Until (Optional)</span>
                                            <input type="date" className="form-control" title="Active Until" value={newItem.active_until} min={new Date().toISOString().split('T')[0]} onChange={e => setNewItem({ ...newItem, active_until: e.target.value })} />
                                        </div>
                                    </div>
                                    <div className="flex-between">
                                        <button className="btn-secondary" onClick={addRxItem}>+ Add Item</button>
                                        <button className="btn-primary" onClick={saveRx}>Save All Prescriptions</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'orders' && (
                            <div>
                                <h4 className="mb-1">Nurse Orders</h4>
                                <ul className="list-group mb-2">
                                    {tasks.map(t => (
                                        <li key={t.id} className="list-item p-1 border rounded mb-0_5 flex-between bg-white">
                                            <div>
                                                <strong>{t.task_type}</strong>
                                                <div className="text-sm">{t.details}</div>
                                            </div>
                                            <span className={`badge badge-${t.status === 'pending' ? 'warning' : 'success'}`}>{t.status}</span>
                                        </li>
                                    ))}
                                </ul>
                                <div className="bg-light p-1 rounded">
                                    <div className="grid-2 gap-1 mb-1">
                                        <select className="form-control" value={newTask.task_type} onChange={e => setNewTask({ ...newTask, task_type: e.target.value })}>
                                            <option>Observation</option><option>Vitals Check</option><option>Injection</option><option>Lab Request</option>
                                        </select>
                                        <select className="form-control" value={newTask.priority} onChange={e => setNewTask({ ...newTask, priority: e.target.value })}>
                                            <option value="normal">Normal</option><option value="urgent">Urgent</option><option value="stat">STAT</option>
                                        </select>
                                    </div>
                                    <textarea className="form-control mb-1" placeholder="Instructions..." value={newTask.details} onChange={e => setNewTask({ ...newTask, details: e.target.value })} />
                                    <button className="btn-primary" onClick={addTask}>Send Order</button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'messages' && (
                            <div className="chat-container" style={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
                                <div className="messages-box flex-grow-1 overflow-auto p-1 bg-light rounded mb-1">
                                    {messages.map((m, i) => (
                                        <div key={i} className={`msg-bubble mb-1 ${m.sender === appointment.patient ? 'left' : 'right'}`} style={{
                                            textAlign: m.sender === appointment.patient ? 'left' : 'right'
                                        }}>
                                            <div style={{
                                                display: 'inline-block', padding: '0.5rem 1rem', borderRadius: '15px',
                                                background: m.sender === appointment.patient ? '#e2e8f0' : 'var(--primary)',
                                                color: m.sender === appointment.patient ? '#333' : 'white'
                                            }}>
                                                {m.content}
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={messagesEndRef} />
                                </div>
                                <div className="chat-input flex-between gap-1">
                                    <input className="form-control" placeholder="Type message..." value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyPress={e => e.key === 'Enter' && sendMessage()} />
                                    <button className="btn-primary btn-icon" aria-label="Send Message" onClick={sendMessage}><Send size={18} /></button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'history' && (
                            <table className="data-table">
                                <thead><tr><th>Date</th><th>Reason</th><th>Status</th></tr></thead>
                                <tbody>
                                    {history.map(h => (
                                        <tr key={h.id}><td>{new Date(h.date_time).toLocaleDateString()}</td><td>{h.reason}</td><td>{h.status}</td></tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <style>{`
                .workbench-container { max-width: 1400px; margin: 0 auto; }
                .top-bar { background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
                .main-layout { display: grid; grid-template-columns: 300px 1fr; gap: 1.5rem; align-items: start; }
                @media (max-width: 1024px) { .main-layout { grid-template-columns: 1fr; } .sidebar { display: none; } }
                
                .sidebar { position: sticky; top: 80px; }
                .vitals-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
                .vital-box { background: var(--bg-secondary); padding: 0.5rem; borderRadius: var(--radius); text-align: center; }
                .vital-box .label { font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); display: block; }
                .vital-box .value { font-weight: 700; font-size: 1.1rem; color: var(--text-color); }
                
                .tabs-nav { display: flex; border-bottom: 1px solid var(--border-color); overflow-x: auto; -webkit-overflow-scrolling: touch; }
                .tab-btn { padding: 1rem 1.5rem; border: none; background: transparent; cursor: pointer; color: var(--text-muted); font-weight: 500; display: flex; align-items: center; gap: 0.5rem; white-space: nowrap; border-bottom: 2px solid transparent; transition: all 0.2s; }
                .tab-btn:hover { color: var(--primary); background: var(--bg-secondary); }
                .tab-btn.active { color: var(--primary); border-bottom-color: var(--primary); background: transparent; }
                
                .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
                .full-width { grid-column: span 2; }
                textarea.form-control { resize: vertical; }
            `}</style>
        </div>
    );
};

export default DoctorWorkbench;

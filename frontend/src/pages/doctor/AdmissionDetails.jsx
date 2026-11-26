import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { ArrowLeft, Plus, Save, Clock, Trash2, Pill } from 'lucide-react';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';
import Toast from '../../components/common/Toast';
import Modal from '../../components/common/Modal';

const AdmissionDetails = () => {
    const { id } = useParams();
    console.log("AdmissionDetails Mounted. ID:", id);
    const navigate = useNavigate();
    const [admission, setAdmission] = useState(null);
    const [loading, setLoading] = useState(true);


    const [toast, setToast] = useState(null);
    const [showOrderModal, setShowOrderModal] = useState(false);

    // Order Form State
    const [orderForm, setOrderForm] = useState({ priority: 'routine', notes: '', medication_items: [] });
    const [orders, setOrders] = useState([]);
    const [vitals, setVitals] = useState([]);
    const [curItem, setCurItem] = useState({
        medicine_name: '', dosage: '', route: 'PO', 
        morning: true, afternoon: false, evening: true,
        duration_days: 1, instructions: ''
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                // 1. Fetch Admission Details
                const admRes = await api.get(`/admissions/${id}/`);
                setAdmission(admRes.data);

                // 2. Fetch Active Orders
                const ordersRes = await api.get(`/inpatient-orders/?admission=${id}`);
                setOrders(ordersRes.data);

                // 3. Fetch Vitals (using patient ID from admission)
                if (admRes.data.patient) {
                    const vitalsRes = await api.get(`/vitals/?patient=${admRes.data.patient}`);
                    setVitals(vitalsRes.data);
                }

            } catch (error) {
                console.error("Error fetching admission data:", error);
                setToast({ message: "Failed to load patient data", type: "error" });
            } finally {
                setLoading(false);
            }
        };

        if (id) fetchData();
    }, [id]);

    const addItem = () => {
        if (!curItem.medicine_name) return setToast({ message: "Medicine Name required", type: 'error' });

        setOrderForm({ ...orderForm, medication_items: [...orderForm.medication_items, curItem] });
        setCurItem({
            medicine_name: '', dosage: '', route: 'PO', 
            morning: true, afternoon: false, evening: true,
            duration_days: 1, instructions: ''
        });
    };

    const submitOrder = async () => {
        if (orderForm.medication_items.length === 0) {
            return setToast({ message: "Add at least one medication", type: "error" });
        }

        try {
            const payload = {
                admission: id,
                ...orderForm
            };

            await api.post('/inpatient-orders/', payload);
            setToast({ message: "Order submitted successfully", type: "success" });
            setShowOrderModal(false);
            setOrderForm({ priority: 'routine', notes: '', medication_items: [] });

            // Refresh orders
            const ordersRes = await api.get(`/inpatient-orders/?admission=${id}`);
            setOrders(ordersRes.data);

        } catch (error) {
            console.error("Submit Order Error:", error);
            setToast({ message: "Failed to submit order", type: "error" });
        }
    };

    if (loading) return (
        <div className="fade-in p-4 text-center">
            <div className="loading-spinner">Loading Patient Data...</div>
        </div>
    );

    if (!admission) return <div className="p-4 text-center"><h3>Patient Not Found</h3><button className="btn-primary" onClick={() => navigate('/doctor/inpatients')}>Back to Ward</button></div>;

    return (
        <div className="fade-in">
            <button className="btn-icon mb-1" onClick={() => navigate('/doctor/inpatients')}><ArrowLeft /> Back to Ward</button>
            <div className="card flex-between mb-2">
                <div>
                    <h1>{admission.patient_name}</h1>
                    <p className="text-muted">Admitted {new Date(admission.admitted_at).toLocaleDateString()} • {admission.ward}</p>
                </div>
                <button className="btn-primary" onClick={() => setShowOrderModal(true)}><Plus size={18} /> New Medication Order</button>
            </div>

            <div className="grid-2 gap-1 mb-2">
                <div className="card">
                    <h3>Active Orders</h3>
                    {orders.length === 0 ? (
                        <p className="text-muted">No active orders yet.</p>
                    ) : (
                        <div className="flex-col gap-1">
                            {orders.map(order => (
                                <div key={order.id} className="border p-1 rounded">
                                    <div className="flex-between">
                                        <h4 className="mb-0_5">Order #{order.id} <span className={`badge badge-${order.priority === 'urgent' ? 'danger' : 'secondary'}`}>{order.priority}</span></h4>
                                        <span className="text-xs text-muted">{new Date(order.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <div className="text-sm mt-0_5">
                                        {order.medication_items.map((item, idx) => {
                                            const start = new Date(order.created_at || Date.now());
                                            const end = new Date(start);
                                            end.setDate(end.getDate() + item.duration_days);

                                            const scheduleStr = [
                                                item.morning ? 'Morning' : null,
                                                item.afternoon ? 'Afternoon' : null,
                                                item.evening ? 'Evening' : null
                                            ].filter(Boolean).join(', ') || 'PRN (As Needed)';

                                            return (
                                                <div key={idx} style={{ marginBottom: '0.6rem', padding: '0.4rem', background: '#f8fafc', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                                                    <div>• {item.medicine_name} - <strong>{item.dosage}</strong> ({item.route}) <span className="text-primary font-medium" style={{ fontSize: '0.85rem' }}>[{scheduleStr}]</span></div>
                                                    <div className="text-xs text-muted" style={{ paddingLeft: '0.8rem', marginTop: '0.2rem' }}>
                                                        Duration: {item.duration_days} Days (Ends ~{end.toLocaleDateString()})
                                                    </div>
                                                    {item.instructions && <div className="text-xs text-muted" style={{ paddingLeft: '0.8rem', marginTop: '0.2rem', fontStyle: 'italic' }}>Note: {item.instructions}</div>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="mt-0_5 text-xs text-muted">Status: {order.status}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="card">
                    <h3>Recent Vitals</h3>
                    {vitals.length === 0 ? (
                        <p className="text-muted">No vitals recorded.</p>
                    ) : (
                        <div className="flex-col gap-0_5">
                            {vitals.slice(0, 5).map(vital => (
                                <div key={vital.id} className="flex-between border-bottom p-0_5">
                                    <span>BP: {vital.blood_pressure} | HR: {vital.heart_rate} | T: {vital.temperature}°C</span>
                                    <span className="text-xs text-muted">{new Date(vital.created_at).toLocaleDateString()}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <Modal isOpen={showOrderModal} onClose={() => setShowOrderModal(false)} title="New Inpatient Order">
                <div className="form-group mb-1">
                    <label>Order Priority</label>
                    <select className="form-control" value={orderForm.priority} onChange={e => setOrderForm({ ...orderForm, priority: e.target.value })}>
                        <option value="routine">Routine</option>
                        <option value="urgent">Urgent</option>
                        <option value="stat">STAT</option>
                    </select>
                </div>

                <div className="bg-light p-1 rounded mb-1" style={{ border: '1px solid #e2e8f0', background: '#ffffff', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <h4 className="flex-start gap-0_5 text-primary text-sm uppercase m-0 mb-1" style={{ letterSpacing: '0.05em' }}><Pill size={16} /> Add Medication Items</h4>
                    <div className="grid-2 gap-0_5 mb-0_5">
                        <input className="form-control" placeholder="Medicine Name (e.g. Paracetamol)" value={curItem.medicine_name} onChange={e => setCurItem({ ...curItem, medicine_name: e.target.value })} style={{ padding: '0.75rem', borderRadius: 8, border: '1px solid #cbd5e1', transition: 'border-color 0.2s' }} />
                        <input className="form-control" placeholder="Dosage (e.g. 500mg)" value={curItem.dosage} onChange={e => setCurItem({ ...curItem, dosage: e.target.value })} style={{ padding: '0.75rem', borderRadius: 8, border: '1px solid #cbd5e1', transition: 'border-color 0.2s' }} />
                    </div>
                    <div className="grid-2 gap-0_5 mb-1">
                        <div>
                            <label className="text-xs text-muted block mb-0_25 font-bold uppercase" style={{ fontSize: '0.7rem' }}>Route</label>
                            <select className="form-control" value={curItem.route} onChange={e => setCurItem({ ...curItem, route: e.target.value })} style={{ padding: '0.75rem', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff' }}>
                                <option value="PO">Oral (PO)</option>
                                <option value="IV">Intravenous (IV)</option>
                                <option value="IM">Intramuscular (IM)</option>
                                <option value="Topical">Topical</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-muted block mb-0_25 font-bold uppercase" style={{ fontSize: '0.7rem' }}>Period (Days) - Auto calculates end date</label>
                            <input className="form-control" type="number" placeholder="Duration (Days)" min="1" value={curItem.duration_days} onChange={e => setCurItem({ ...curItem, duration_days: parseInt(e.target.value) || 1 })} style={{ padding: '0.75rem', borderRadius: 8, border: '1px solid #cbd5e1' }} />
                        </div>
                    </div>
                    <label className="text-sm font-bold text-muted uppercase block mb-0_5" style={{ fontSize: '0.75rem', letterSpacing: '0.04em' }}>Schedule (Check all that apply)</label>
                    <div className="flex-start gap-1 mb-1 bg-white p-0_5 rounded" style={{ border: '1px solid #cbd5e1', padding: '0.75rem', borderRadius: 8 }}>
                         <label className="flex-center gap-0_5 cursor-pointer" style={{ cursor: 'pointer' }}>
                             <input type="checkbox" checked={curItem.morning} onChange={(e) => setCurItem({...curItem, morning: e.target.checked})} style={{ width: '16px', height: '16px', cursor: 'pointer' }} /> 
                             <span className="text-sm font-bold text-dark">Morning</span>
                         </label>
                         <label className="flex-center gap-0_5 cursor-pointer" style={{ cursor: 'pointer' }}>
                             <input type="checkbox" checked={curItem.afternoon} onChange={(e) => setCurItem({...curItem, afternoon: e.target.checked})} style={{ width: '16px', height: '16px', cursor: 'pointer' }} /> 
                             <span className="text-sm font-bold text-dark">Afternoon</span>
                         </label>
                         <label className="flex-center gap-0_5 cursor-pointer" style={{ cursor: 'pointer' }}>
                             <input type="checkbox" checked={curItem.evening} onChange={(e) => setCurItem({...curItem, evening: e.target.checked})} style={{ width: '16px', height: '16px', cursor: 'pointer' }} /> 
                             <span className="text-sm font-bold text-dark">Evening</span>
                         </label>
                    </div>
                    
                    <input className="form-control mb-1" placeholder="Instructions/Notes (Optional)" value={curItem.instructions} onChange={e => setCurItem({ ...curItem, instructions: e.target.value })} style={{ padding: '0.75rem', borderRadius: 8, border: '1px solid #cbd5e1', width: '100%', boxSizing: 'border-box' }} />

                    <button className="btn-primary btn-sm full-width flex-center gap-0_5 font-bold" onClick={addItem} style={{ padding: '0.75rem', borderRadius: 8, transition: 'transform 0.1s' }} onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'} onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                        <Plus size={16}/> Add to Order List
                    </button>
                </div>

                {orderForm.medication_items.length > 0 && (
                    <div className="mb-1">
                        <h4>Items to Order ({orderForm.medication_items.length})</h4>
                        <ul className="list-group">
                            {orderForm.medication_items.map((item, i) => (
                                <li key={i} className="list-item flex-between p-0_5 border-bottom" style={{ borderRadius: 6, marginBottom: '0.2rem', background: '#f8fafc' }}>
                                    <div>
                                        <strong>{item.medicine_name}</strong> {item.dosage} ({item.route})
                                        {item.instructions && <div className="text-xs text-muted">Note: {item.instructions}</div>}
                                    </div>
                                    <button className="text-danger btn-icon" onClick={() => setOrderForm({ ...orderForm, medication_items: orderForm.medication_items.filter((_, idx) => idx !== i) })}><Trash2 size={14} /></button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <div className="form-group mb-1">
                    <label>Overall Clinical Notes</label>
                    <textarea className="form-control" placeholder="Clinical Notes..." value={orderForm.notes} onChange={e => setOrderForm({ ...orderForm, notes: e.target.value })} style={{ padding: '0.75rem', borderRadius: 8, border: '1px solid #cbd5e1', minHeight: '80px', width: '100%', boxSizing: 'border-box' }} />
                </div>

                <div className="flex-end gap-1">
                    <button onClick={() => setShowOrderModal(false)} className="btn-secondary">Cancel</button>
                    <button onClick={submitOrder} className="btn-primary">Submit Order</button>
                </div>
            </Modal>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

export default AdmissionDetails;

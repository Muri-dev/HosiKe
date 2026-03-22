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
        medicine_name: '', dosage: '', route: 'PO', frequency: 'q8h',
        start_datetime: new Date().toISOString().slice(0, 16),
        duration_days: 1
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
        if (!curItem.start_datetime) return setToast({ message: "Start time required", type: 'error' });

        setOrderForm({ ...orderForm, medication_items: [...orderForm.medication_items, curItem] });
        setCurItem({
            medicine_name: '', dosage: '', route: 'PO', frequency: 'q8h',
            start_datetime: new Date().toISOString().slice(0, 16),
            duration_days: 1
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
                                    <div className="text-sm">
                                        {order.medication_items.map((item, idx) => (
                                            <div key={idx}>• {item.medicine_name} {item.dosage} ({item.frequency})</div>
                                        ))}
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

                <div className="bg-light p-1 rounded mb-1">
                    <h4 className="flex-start gap-0_5"><Pill size={16} /> Add Medication</h4>
                    <div className="grid-2 gap-0_5 mb-0_5">
                        <input className="form-control" placeholder="Medication Name" value={curItem.medicine_name} onChange={e => setCurItem({ ...curItem, medicine_name: e.target.value })} />
                        <input className="form-control" placeholder="Dosage (e.g. 500mg)" value={curItem.dosage} onChange={e => setCurItem({ ...curItem, dosage: e.target.value })} />
                    </div>
                    <div className="grid-3 gap-0_5 mb-0_5">
                        <select className="form-control" value={curItem.route} onChange={e => setCurItem({ ...curItem, route: e.target.value })}><option>PO</option><option>IV</option></select>
                        <input className="form-control" placeholder="Freq (q8h)" value={curItem.frequency} onChange={e => setCurItem({ ...curItem, frequency: e.target.value })} />
                        <input className="form-control" type="number" placeholder="Days" value={curItem.duration_days} onChange={e => setCurItem({ ...curItem, duration_days: parseInt(e.target.value) })} />
                    </div>
                    <input className="form-control mb-0_5" type="datetime-local" value={curItem.start_datetime} onChange={e => setCurItem({ ...curItem, start_datetime: e.target.value })} />
                    <button className="btn-secondary btn-sm full-width" onClick={addItem}>+ Add to Schedule</button>
                </div>

                {orderForm.medication_items.length > 0 && (
                    <div className="mb-1">
                        <h4>Items to Order ({orderForm.medication_items.length})</h4>
                        <ul className="list-group">
                            {orderForm.medication_items.map((item, i) => (
                                <li key={i} className="list-item flex-between p-0_5 border-bottom">
                                    <span>{item.medicine_name} {item.dosage}</span>
                                    <button className="text-danger btn-icon" onClick={() => setOrderForm({ ...orderForm, medication_items: orderForm.medication_items.filter((_, idx) => idx !== i) })}><Trash2 size={14} /></button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <textarea className="form-control mb-1" placeholder="Clinical Notes..." value={orderForm.notes} onChange={e => setOrderForm({ ...orderForm, notes: e.target.value })} />

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

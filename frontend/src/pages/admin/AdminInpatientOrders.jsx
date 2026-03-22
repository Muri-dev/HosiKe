import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import DataTable from '../../components/common/DataTable';
import Toast from '../../components/common/Toast';
import Modal from '../../components/common/Modal';

const AdminInpatientOrders = () => {
    const [orders, setOrders] = useState([]);
    const [nurses, setNurses] = useState([]);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [selectedNurse, setSelectedNurse] = useState('');
    const [toast, setToast] = useState(null);

    const fetchOrders = async () => {
        const res = await api.get('/inpatient-orders/');
        setOrders(res.data);
    };

    useEffect(() => {
        fetchOrders();
        api.get('/admin/users/?role=nurse').then(res => setNurses(res.data));
    }, []);

    const handleApprove = async (id) => {
        try {
            await api.patch(`/inpatient-orders/${id}/approve/`);
            setToast({ message: "Order Approved", type: 'success' });
            fetchOrders();
        } catch (e) { setToast({ message: "Failed", type: 'error' }); }
    };

    const handleAllocate = async () => {
        try {
            await api.post(`/inpatient-orders/${selectedOrder.id}/allocate/`, { nurse_id: selectedNurse });
            setToast({ message: `Allocated to Nurse`, type: 'success' });
            setSelectedOrder(null);
            fetchOrders();
        } catch (e) { setToast({ message: "Allocation Failed", type: 'error' }); }
    };

    const columns = [
        { header: 'Date', render: r => new Date(r.created_at).toLocaleDateString() },
        { header: 'Patient', accessor: 'patient_name' },
        { header: 'Location', render: r => `${r.ward} / ${r.bed_number}` },
        { header: 'Doctor', accessor: 'doctor_name' },
        { header: 'Status', render: r => <span className={`badge badge-${r.status === 'approved' ? 'success' : r.status === 'completed' ? 'primary' : 'warning'}`}>{r.status}</span> },
        {
            header: 'Action', render: r => (
                <div className="flex-start gap-0_5">
                    {r.status === 'pending_review' && <button className="btn-success btn-sm" onClick={() => handleApprove(r.id)}>Approve</button>}
                    {r.status === 'approved' && <button className="btn-primary btn-sm" onClick={() => setSelectedOrder(r)}>Allocate</button>}
                    {r.status === 'completed' && (
                        <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                            background: '#dcfce7', color: '#15803d',
                            padding: '0.25rem 0.65rem', borderRadius: '999px',
                            fontSize: '0.78rem', fontWeight: 600
                        }}>
                            ✓ Nurse Allocated
                        </span>
                    )}
                </div>
            )
        }
    ];

    return (
        <div className="fade-in">
            <h1>Inpatient Orders Review</h1>
            <div className="card">
                <DataTable columns={columns} data={orders} />
            </div>

            <Modal isOpen={!!selectedOrder} onClose={() => setSelectedOrder(null)} title="Allocate Nurse">
                <p>Assign a nurse to administer this medication plan.</p>
                <div className="form-group">
                    <label>Select Nurse</label>
                    <select className="form-control" value={selectedNurse} onChange={e => setSelectedNurse(e.target.value)}>
                        <option value="">-- Choose Nurse --</option>
                        {nurses.map(n => <option key={n.id} value={n.id}>{n.first_name} {n.last_name}</option>)}
                    </select>
                </div>
                <button className="btn-primary full-width" onClick={handleAllocate}>Confirm Allocation</button>
            </Modal>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

export default AdminInpatientOrders;

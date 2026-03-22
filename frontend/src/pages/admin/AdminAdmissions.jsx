import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import DataTable from '../../components/common/DataTable';
import { Bed, LogOut, Edit2 } from 'lucide-react';
import Toast from '../../components/common/Toast';
import Modal from '../../components/common/Modal';

const AdminAdmissions = () => {
    const [admissions, setAdmissions] = useState([]);
    const [selectedAdm, setSelectedAdm] = useState(null); // For editing
    const [toast, setToast] = useState(null);
    const [formData, setFormData] = useState({ ward: '', bed_number: '' });

    const fetchAdmissions = async () => {
        try {
            const res = await api.get('/admissions/?status=admitted');
            setAdmissions(res.data);
        } catch (e) { console.error(e); }
    };

    useEffect(() => { fetchAdmissions(); }, []);

    const handleDischarge = async (id) => {
        if (!window.confirm("Discharge this patient?")) return;
        try {
            await api.patch(`/admissions/${id}/`, { status: 'discharged', discharged_at: new Date().toISOString() });
            setToast({ message: "Patient Discharged", type: 'success' });
            fetchAdmissions();
        } catch (e) { setToast({ message: "Failed", type: 'error' }); }
    };

    const handleEdit = (adm) => {
        setSelectedAdm(adm);
        setFormData({ ward: adm.ward, bed_number: adm.bed_number });
    };

    const saveEdit = async () => {
        try {
            await api.patch(`/admissions/${selectedAdm.id}/`, formData);
            setToast({ message: "Updated Admission", type: 'success' });
            setSelectedAdm(null);
            fetchAdmissions();
        } catch (e) { setToast({ message: "Update Failed", type: 'error' }); }
    };

    const columns = [
        { header: 'Patient', accessor: 'patient_name' },
        { header: 'Doctor', accessor: 'doctor_name' },
        { header: 'Ward', accessor: 'ward' },
        { header: 'Bed', accessor: 'bed_number' },
        { header: 'Admitted At', render: r => new Date(r.admitted_at).toLocaleDateString() },
        {
            header: 'Actions', render: r => (
                <div className="flex-start gap-0_5">
                    <button className="btn-icon text-primary" aria-label="Edit Admission" onClick={() => handleEdit(r)}><Edit2 size={16} /></button>
                    <button className="btn-icon text-danger" aria-label="Discharge Patient" onClick={() => handleDischarge(r.id)}><LogOut size={16} /></button>
                </div>
            )
        }
    ];

    return (
        <div className="fade-in">
            <header className="flex-between mb-2">
                <h1>Current Admissions</h1>
                <div className="badge badge-primary">{admissions.length} Admitted</div>
            </header>

            <div className="card">
                <DataTable columns={columns} data={admissions} />
            </div>

            <Modal isOpen={!!selectedAdm} onClose={() => setSelectedAdm(null)} title="Edit Admission">
                <div className="form-group">
                    <label>Ward</label>
                    <select className="form-control" value={formData.ward} onChange={e => setFormData({ ...formData, ward: e.target.value })}>
                        <option value="General">General Ward</option>
                        <option value="ICU">ICU</option>
                        <option value="Emergency">Emergency</option>
                        <option value="Maternity">Maternity</option>
                    </select>
                </div>
                <div className="form-group">
                    <label>Bed Number</label>
                    <input className="form-control" value={formData.bed_number} onChange={e => setFormData({ ...formData, bed_number: e.target.value })} />
                </div>
                <button className="btn-primary full-width" onClick={saveEdit}>Save Changes</button>
            </Modal>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

export default AdminAdmissions;

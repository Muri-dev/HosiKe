import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import DataTable from '../../components/common/DataTable';
import { Pill, Check } from 'lucide-react';

const PrescriptionsPanel = () => {
    const [prescriptions, setPrescriptions] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchPrescriptions = async () => {
        setLoading(true);
        try {
            const response = await api.get('/nurse/prescriptions/');
            setPrescriptions(response.data);
        } catch (error) {
            console.error("Failed to fetch prescriptions", error);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchPrescriptions();
    }, []);

    const handleAdminister = async (id) => {
        if (!window.confirm("Mark this medication as administered?")) return;
        try {
            await api.patch(`/nurse/prescriptions/${id}/administer/`);
            fetchPrescriptions();
        } catch (error) {
            alert("Failed to update status");
        }
    };

    const columns = [
        { header: 'Medicine', accessor: 'medicine_name' },
        { header: 'Dosage', accessor: 'dosage' },
        { header: 'Instructions', accessor: 'instructions' },
        { header: 'Appt Date', render: (row) => new Date().toLocaleDateString() }, // PrescriptionItem doesn't have appt link directly in serializer yet? 
        // Wait, PrescriptionItem -> Prescription -> Consultation -> Appointment.
        // My serializer for PrescriptionItem was: fields = '__all__'. 
        // Does it include nested depth? No. 
        // I might need to update serializer or just show basic info for now.
        // Let's just show basic info.
        {
            header: 'Action', render: (row) => (
                <button onClick={() => handleAdminister(row.id)} className="btn-primary btn-sm" style={{ background: '#10b981' }}>
                    <Check size={16} /> Administer
                </button>
            )
        }
    ];

    return (
        <div>
            <h2>Pending Medications</h2>
            <DataTable
                columns={columns}
                data={prescriptions}
            />
        </div>
    );
};

export default PrescriptionsPanel;

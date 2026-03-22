import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import DataTable from '../../components/common/DataTable';
import Spinner from '../../components/common/Spinner';

const PatientHistory = ({ patientId }) => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            if (!patientId) return;
            setLoading(true);
            try {
                const response = await api.get(`/doctor/appointments/patients/${patientId}/history/`);
                setHistory(response.data);
            } catch (error) {
                console.error("Failed to fetch history", error);
            }
            setLoading(false);
        };
        fetchHistory();
    }, [patientId]);

    const columns = [
        { header: 'Date', render: (row) => new Date(row.date_time).toLocaleDateString() },
        { header: 'Reason', accessor: 'reason' },
        { header: 'Diagnosis', render: (row) => row.consultation?.diagnosis || '-' },
        { header: 'Prescription', render: (row) => row.consultation?.prescription_text || (row.consultation?.prescription?.items?.length ? `${row.consultation.prescription.items.length} items` : '-') },
        { header: 'Status', render: (row) => <span className={`status ${row.status}`}>{row.status}</span> },
    ];

    if (loading) return <Spinner />;

    return (
        <div>
            <h3>Patient Appointment History</h3>
            <DataTable columns={columns} data={history} />
        </div>
    );
};

export default PatientHistory;

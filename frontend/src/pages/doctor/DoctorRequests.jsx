import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { Calendar, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';

const DoctorRequests = () => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const response = await api.get('/doctor/appointments/?status=pending_approval');
            setRequests(response.data);
        } catch (error) {
            console.error("Failed to fetch requests", error);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const handleApprove = async (id) => {
        try {
            await api.post(`/doctor/appointments/${id}/approve/`);
            fetchRequests(); // Refresh list
        } catch (err) { alert('Failed to approve'); }
    };

    const handleReject = async (id) => {
        if (!window.confirm('Reject this appointment assignment?')) return;
        try {
            const reason = prompt("Reason for rejection:") || "Schedule conflict";
            await api.post(`/doctor/appointments/${id}/reject/`, { reason });
            fetchRequests();
        } catch (err) { alert('Failed to reject'); }
    };

    return (
        <div className="fade-in">
            <div className="mb-2">
                <h1>Appointment Requests</h1>
                <p className="text-muted">Manage new appointment assignments requiring your approval.</p>
            </div>

            {loading ? <LoadingSkeleton count={3} /> : (
                <div className="request-list">
                    {requests.length === 0 ? (
                        <div className="text-center p-4 text-muted card">
                            <CheckCircle size={48} className="mb-1 opacity-25" />
                            <h3>All Caught Up</h3>
                            <p>No new appointment requests.</p>
                        </div>
                    ) : (
                        requests.map(req => (
                            <div key={req.id} className="card p-1_5 mb-1 hover-shadow flex-between">
                                <div className="flex-start gap-1_5">
                                    <div className="avatar-placeholder bg-light text-primary rounded-circle flex-center" style={{ width: '50px', height: '50px', fontSize: '1.2rem', fontWeight: 700 }}>
                                        {req.patient_name.charAt(0)}
                                    </div>
                                    <div>
                                        <h3 className="mb-0_5">{req.patient_name}</h3>
                                        <div className="text-muted text-sm flex-start gap-1 mb-0_5">
                                            <span className="flex-center gap-0_5"><Clock size={14} /> {new Date(req.date_time).toLocaleString()}</span>
                                        </div>
                                        <div className="flex-start gap-0_5 text-sm">
                                            <AlertCircle size={14} className="text-primary" />
                                            <span className="text-dark">{req.reason}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-end gap-1">
                                    <button
                                        className="btn-danger-outline"
                                        onClick={() => handleReject(req.id)}
                                    >
                                        <XCircle size={18} className="mr-0_5" /> Reject
                                    </button>
                                    <button
                                        className="btn-success"
                                        onClick={() => handleApprove(req.id)}
                                    >
                                        <CheckCircle size={18} className="mr-0_5" /> Accept
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default DoctorRequests;

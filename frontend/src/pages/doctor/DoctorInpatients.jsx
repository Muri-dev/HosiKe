import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import { useNavigate, Link } from 'react-router-dom';
import { User, MapPin, Activity, ArrowRight, Bed, Clipboard } from 'lucide-react';
import LoadingSkeleton from '../../components/common/LoadingSkeleton';

const DoctorInpatients = () => {
    const [admissions, setAdmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchAdmissions = async () => {
            try {
                const response = await api.get('/admissions/?status=admitted');
                console.log("Admissions Data:", response.data);
                setAdmissions(response.data);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchAdmissions();
    }, []);

    if (loading) return <LoadingSkeleton />;

    return (
        <div className="fade-in">
            <header className="mb-2">
                <h1>Inpatient Ward</h1>
                <p className="text-muted">Admitted patients under your care.</p>
            </header>

            {admissions.length === 0 ? (
                <div className="card text-center p-4">
                    <Bed size={48} className="text-muted opacity-50 mb-1" />
                    <h3>No active admissions</h3>
                    <p>There are currently no patients admitted to your ward.</p>
                </div>
            ) : (
                <div className="grid-3 gap-1">
                    {admissions.map(adm => (
                        <div key={adm.id} className="card hover-shadow p-1_5">
                            <div className="flex-between mb-1">
                                <div className="flex-start gap-1">
                                    <div className="avatar-placeholder rounded-circle bg-primary-light text-primary flex-center" style={{ width: 40, height: 40 }}>
                                        {adm.patient_name[0]}
                                    </div>
                                    <div>
                                        <h4 className="mb-0">{adm.patient_name}</h4>
                                        <span className="text-xs text-muted">{adm.patient_details?.gender} • {adm.patient_details?.dob}</span>
                                    </div>
                                </div>
                                <span className="badge badge-success">Admitted</span>
                            </div>

                            <div className="info-grid text-sm mb-1_5">
                                <div className="flex-start gap-0_5"><MapPin size={14} className="text-muted" /> {adm.ward} - Bed {adm.bed_number}</div>
                                <div className="flex-start gap-0_5"><Clipboard size={14} className="text-muted" /> {new Date(adm.admitted_at).toLocaleDateString()}</div>
                            </div>

                            <Link to={`/doctor/inpatients/${adm.id}`} className="btn-primary full-width flex-center gap-0_5 text-decoration-none" style={{ display: 'flex', textDecoration: 'none' }}>
                                View Chart & Orders <ArrowRight size={16} />
                            </Link>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default DoctorInpatients;

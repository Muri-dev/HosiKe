import React, { useState, useCallback } from 'react';
import api from '../../api/axios';
import {
    Search, User, Calendar, Activity, Bed,
    ChevronRight, X, ArrowLeft, ClipboardList,
    Phone, Mail, MapPin, Droplet, Heart, Thermometer, Weight
} from 'lucide-react';

// ─── Helper badge ───────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => (
    <span className={`status ${status?.toLowerCase().replace(/ /g, '_')}`}>
        {status}
    </span>
);

// ─── Vitals row ─────────────────────────────────────────────────────────────
const VitalRow = ({ v }) => (
    <div style={styles.vitalRow}>
        <div style={styles.vitalDate}>{new Date(v.created_at).toLocaleDateString()}</div>
        <div style={styles.vitalGrid}>
            {v.temperature && <div style={styles.vitalItem}><Thermometer size={14} /> {v.temperature}°C</div>}
            {v.blood_pressure && <div style={styles.vitalItem}><Heart size={14} /> {v.blood_pressure} mmHg</div>}
            {v.heart_rate && <div style={styles.vitalItem}><Activity size={14} /> {v.heart_rate} bpm</div>}
            {v.weight && <div style={styles.vitalItem}><Weight size={14} /> {v.weight} kg</div>}
        </div>
        {v.symptoms && <p style={styles.symptoms}>Symptoms: {v.symptoms}</p>}
    </div>
);

// ─── Appointment card ────────────────────────────────────────────────────────
const AppointmentCard = ({ appt }) => {
    const [open, setOpen] = useState(false);
    const cons = appt.consultation;
    return (
        <div style={styles.apptCard}>
            <div style={styles.apptHeader} onClick={() => setOpen(o => !o)}>
                <div>
                    <span style={styles.apptDate}>
                        {new Date(appt.date_time).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span style={styles.apptDoctor}>
                        {appt.doctor_name ? `Dr. ${appt.doctor_name}` : 'Unassigned'}
                    </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <StatusBadge status={appt.status} />
                    <ChevronRight size={16} style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                </div>
            </div>
            {open && (
                <div style={styles.apptBody}>
                    <p style={styles.apptReason}><strong>Reason:</strong> {appt.reason}</p>
                    {appt.notes && <p style={styles.apptReason}><strong>Notes:</strong> {appt.notes}</p>}
                    {cons && (
                        <div style={styles.consultBox}>
                            <h5 style={styles.sectionLabel}>Consultation</h5>
                            {cons.chief_complaint && <p><strong>Complaint:</strong> {cons.chief_complaint}</p>}
                            {cons.diagnosis && <p><strong>Diagnosis:</strong> {cons.diagnosis}</p>}
                            {cons.clinical_notes && <p><strong>Notes:</strong> {cons.clinical_notes}</p>}
                            {cons.treatment_plan && <p><strong>Treatment:</strong> {cons.treatment_plan}</p>}
                            {cons.prescription?.items?.length > 0 && (
                                <>
                                    <h5 style={styles.sectionLabel}>Prescription</h5>
                                    <table style={styles.rxTable}>
                                        <thead>
                                            <tr>
                                                <th>Medicine</th><th>Dosage</th><th>Frequency</th><th>Duration</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {cons.prescription.items.map(item => (
                                                <tr key={item.id}>
                                                    <td>{item.medicine_name}</td>
                                                    <td>{item.dosage}</td>
                                                    <td>{item.frequency}</td>
                                                    <td>{item.duration}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </>
                            )}
                        </div>
                    )}
                    {appt.vitals?.length > 0 && (
                        <>
                            <h5 style={styles.sectionLabel}>Vitals</h5>
                            {appt.vitals.map(v => <VitalRow key={v.id} v={v} />)}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

// ─── Patient Record Panel ────────────────────────────────────────────────────
const PatientRecord = ({ patient, record, onBack }) => {
    const [tab, setTab] = useState('appointments');
    const p = record.patient;

    return (
        <div>
            {/* Back button */}
            <button onClick={onBack} style={styles.backBtn}>
                <ArrowLeft size={16} /> Back to Search
            </button>

            {/* Patient Header */}
            <div style={styles.patientHeader}>
                <div style={styles.patientAvatar}>
                    {(p.first_name?.[0] || p.username?.[0] || '?').toUpperCase()}
                </div>
                <div style={styles.patientInfo}>
                    <h2 style={styles.patientName}>
                        {p.first_name || p.last_name
                            ? `${p.first_name} ${p.last_name}`.trim()
                            : p.username}
                    </h2>
                    <div style={styles.patientMeta}>
                        {p.email && <span><Mail size={14} /> {p.email}</span>}
                        {p.profile?.date_of_birth && (
                            <span><Calendar size={14} /> DOB: {p.profile.date_of_birth}</span>
                        )}
                        {p.profile?.address && <span><MapPin size={14} /> {p.profile.address}</span>}
                    </div>
                </div>

                <div style={styles.statPills}>
                    <div style={styles.statPill}>
                        <span style={styles.statNum}>{record.appointments.length}</span>
                        <span style={styles.statLabel}>Visits</span>
                    </div>
                    <div style={styles.statPill}>
                        <span style={styles.statNum}>{record.vitals.length}</span>
                        <span style={styles.statLabel}>Vitals</span>
                    </div>
                    <div style={styles.statPill}>
                        <span style={styles.statNum}>{record.admissions.length}</span>
                        <span style={styles.statLabel}>Admissions</span>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="tabs">
                {[
                    { id: 'appointments', label: 'Appointments', icon: Calendar },
                    { id: 'vitals', label: 'Vitals', icon: Activity },
                    { id: 'admissions', label: 'Admissions', icon: Bed },
                ].map(t => (
                    <button
                        key={t.id}
                        className={`tab ${tab === t.id ? 'active' : ''}`}
                        onClick={() => setTab(t.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                    >
                        <t.icon size={15} /> {t.label}
                        <span style={styles.tabCount}>
                            {t.id === 'appointments' ? record.appointments.length
                                : t.id === 'vitals' ? record.vitals.length
                                    : record.admissions.length}
                        </span>
                    </button>
                ))}
            </div>

            {/* Tab content */}
            {tab === 'appointments' && (
                record.appointments.length === 0
                    ? <p style={styles.empty}>No appointments found.</p>
                    : record.appointments.map(a => <AppointmentCard key={a.id} appt={a} />)
            )}

            {tab === 'vitals' && (
                record.vitals.length === 0
                    ? <p style={styles.empty}>No standalone vitals recorded.</p>
                    : record.vitals.map(v => <VitalRow key={v.id} v={v} />)
            )}

            {tab === 'admissions' && (
                record.admissions.length === 0
                    ? <p style={styles.empty}>No hospital admissions on record.</p>
                    : record.admissions.map(adm => (
                        <div key={adm.id} style={styles.admissionCard}>
                            <div style={styles.admissionHeader}>
                                <div>
                                    <strong>Ward:</strong> {adm.ward}
                                    {adm.bed_number && <span style={{ marginLeft: '1rem' }}><strong>Bed:</strong> {adm.bed_number}</span>}
                                </div>
                                <StatusBadge status={adm.status} />
                            </div>
                            <p style={{ margin: '0.25rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                Admitted {new Date(adm.admitted_at).toLocaleDateString()}
                                {adm.discharged_at && ` · Discharged ${new Date(adm.discharged_at).toLocaleDateString()}`}
                                {adm.doctor_name && ` · Dr. ${adm.doctor_name}`}
                            </p>
                            {adm.notes && <p style={styles.symptoms}>{adm.notes}</p>}
                        </div>
                    ))
            )}
        </div>
    );
};

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function PatientSearch() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [loadingRecord, setLoadingRecord] = useState(false);
    const [error, setError] = useState('');

    const search = useCallback(async (q) => {
        if (!q.trim()) { setResults([]); return; }
        setSearching(true);
        setError('');
        try {
            const res = await api.get('/patients/', { params: { q } });
            setResults(res.data);
        } catch {
            setError('Search failed. Please try again.');
        } finally {
            setSearching(false);
        }
    }, []);

    const handleInputChange = (e) => {
        const val = e.target.value;
        setQuery(val);
        search(val);
    };

    const openRecord = async (patient) => {
        setLoadingRecord(true);
        setError('');
        try {
            const res = await api.get(`/patients/${patient.id}/record/`);
            setSelectedRecord(res.data);
        } catch {
            setError('Could not load patient record.');
        } finally {
            setLoadingRecord(false);
        }
    };

    const clearSearch = () => {
        setQuery('');
        setResults([]);
        setError('');
    };

    if (loadingRecord) {
        return (
            <div style={styles.page}>
                <div className="loading-spinner">Loading patient record…</div>
            </div>
        );
    }

    if (selectedRecord) {
        return (
            <div style={styles.page}>
                <PatientRecord
                    record={selectedRecord}
                    onBack={() => setSelectedRecord(null)}
                />
            </div>
        );
    }

    return (
        <div style={styles.page}>
            {/* Page header */}
            <div className="flex-between">
                <div>
                    <h1 style={styles.pageTitle}>Patient Records</h1>
                    <p style={styles.pageSubtitle}>Search and view comprehensive patient medical history</p>
                </div>
            </div>

            {/* Search bar */}
            <div style={styles.searchBar}>
                <Search size={20} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <input
                    type="text"
                    id="patient-search-input"
                    value={query}
                    onChange={handleInputChange}
                    placeholder="Search by name, username or patient ID…"
                    style={styles.searchInput}
                    autoFocus
                />
                {query && (
                    <button onClick={clearSearch} style={styles.clearBtn}>
                        <X size={16} />
                    </button>
                )}
            </div>

            {error && <div className="error-banner">{error}</div>}

            {/* Empty / initial state */}
            {!query && !searching && (
                <div style={styles.emptyState}>
                    <ClipboardList size={48} style={{ color: 'var(--border-color)' }} />
                    <p>Start typing a patient's name to search records</p>
                </div>
            )}

            {/* Searching indicator */}
            {searching && <div className="loading-spinner">Searching…</div>}

            {/* Results */}
            {!searching && query && results.length === 0 && (
                <div style={styles.emptyState}>
                    <User size={40} style={{ color: 'var(--border-color)' }} />
                    <p>No patients found matching "<strong>{query}</strong>"</p>
                </div>
            )}

            {results.length > 0 && (
                <div style={styles.resultsGrid}>
                    {results.map(p => (
                        <button
                            key={p.id}
                            id={`patient-card-${p.id}`}
                            style={styles.patientCard}
                            onClick={() => openRecord(p)}
                        >
                            <div style={styles.cardAvatar}>
                                {(p.first_name?.[0] || p.username?.[0] || '?').toUpperCase()}
                            </div>
                            <div style={styles.cardBody}>
                                <div style={styles.cardName}>
                                    {p.first_name || p.last_name
                                        ? `${p.first_name} ${p.last_name}`.trim()
                                        : p.username}
                                </div>
                                <div style={styles.cardMeta}>
                                    <span>@{p.username}</span>
                                    {p.email && <span><Mail size={12} /> {p.email}</span>}
                                </div>
                            </div>
                            <ChevronRight size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Inline styles ───────────────────────────────────────────────────────────
const styles = {
    page: { maxWidth: '900px' },
    pageTitle: { margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)' },
    pageSubtitle: { margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' },

    searchBar: {
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        background: 'white', border: '2px solid var(--border-color)',
        borderRadius: '0.75rem', padding: '0.75rem 1rem',
        marginBottom: '1.5rem', boxShadow: 'var(--shadow-sm)',
        transition: 'border-color 0.2s',
    },
    searchInput: {
        flex: 1, border: 'none', outline: 'none',
        fontSize: '1rem', background: 'transparent', color: 'var(--text-main)',
    },
    clearBtn: {
        background: 'none', border: 'none', cursor: 'pointer',
        color: 'var(--text-muted)', padding: '0.25rem', display: 'flex', alignItems: 'center',
    },

    emptyState: {
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: '0.75rem', padding: '4rem 0', color: 'var(--text-muted)',
    },

    resultsGrid: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
    patientCard: {
        display: 'flex', alignItems: 'center', gap: '1rem',
        background: 'white', border: '1px solid var(--border-color)',
        borderRadius: '0.75rem', padding: '1rem 1.25rem',
        cursor: 'pointer', textAlign: 'left', width: '100%',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        boxShadow: 'var(--shadow-sm)',
    },
    cardAvatar: {
        width: 44, height: 44, borderRadius: '50%',
        background: 'var(--primary-color)', color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: '1.1rem', flexShrink: 0,
    },
    cardBody: { flex: 1 },
    cardName: { fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' },
    cardMeta: { display: 'flex', gap: '0.75rem', color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem', flexWrap: 'wrap' },

    // Record view
    backBtn: {
        display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
        background: 'none', border: '1px solid var(--border-color)',
        color: 'var(--text-muted)', padding: '0.4rem 0.9rem',
        borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem',
        marginBottom: '1.25rem', transition: 'background 0.2s',
    },
    patientHeader: {
        background: 'white', border: '1px solid var(--border-color)',
        borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '1.5rem',
        display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap',
        boxShadow: 'var(--shadow-sm)',
    },
    patientAvatar: {
        width: 60, height: 60, borderRadius: '50%',
        background: 'var(--primary-color)', color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: '1.5rem', flexShrink: 0,
    },
    patientInfo: { flex: 1 },
    patientName: { margin: '0 0 0.4rem', fontSize: '1.25rem', fontWeight: 700 },
    patientMeta: { display: 'flex', gap: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem', flexWrap: 'wrap', alignItems: 'center' },

    statPills: { display: 'flex', gap: '1rem', marginLeft: 'auto', flexWrap: 'wrap' },
    statPill: {
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        background: '#f3e8ff', borderRadius: '0.5rem', padding: '0.5rem 1rem',
        minWidth: 60,
    },
    statNum: { fontWeight: 700, fontSize: '1.25rem', color: 'var(--primary-color)' },
    statLabel: { fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' },

    tabCount: {
        background: '#f3e8ff', color: 'var(--primary-color)',
        fontSize: '0.7rem', fontWeight: 600,
        borderRadius: '1rem', padding: '0.1rem 0.4rem',
    },

    // Appointments
    apptCard: {
        background: 'white', border: '1px solid var(--border-color)',
        borderRadius: '0.75rem', marginBottom: '0.75rem',
        overflow: 'hidden', boxShadow: 'var(--shadow-sm)',
    },
    apptHeader: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0.9rem 1.25rem', cursor: 'pointer',
        transition: 'background 0.15s',
    },
    apptDate: { fontWeight: 600, fontSize: '0.9rem', display: 'block', color: 'var(--text-main)' },
    apptDoctor: { fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem', display: 'block' },
    apptBody: { padding: '0 1.25rem 1rem', borderTop: '1px solid var(--border-color)', fontSize: '0.875rem' },
    apptReason: { color: 'var(--text-main)', margin: '0.5rem 0' },
    consultBox: { background: '#faf5ff', borderRadius: '0.5rem', padding: '0.75rem', margin: '0.5rem 0', fontSize: '0.85rem' },
    sectionLabel: { margin: '0.75rem 0 0.25rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--primary-color)' },
    rxTable: { width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' },

    // Vitals
    vitalRow: {
        background: 'white', border: '1px solid var(--border-color)',
        borderRadius: '0.5rem', padding: '0.75rem 1rem', marginBottom: '0.5rem',
    },
    vitalDate: { fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.4rem' },
    vitalGrid: { display: 'flex', flexWrap: 'wrap', gap: '0.75rem' },
    vitalItem: { display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem', fontWeight: 500 },
    symptoms: { margin: '0.4rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' },

    // Admissions
    admissionCard: {
        background: 'white', border: '1px solid var(--border-color)',
        borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '0.75rem',
    },
    admissionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' },

    empty: { color: 'var(--text-muted)', padding: '2rem 0', textAlign: 'center' },
};

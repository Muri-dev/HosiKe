import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { Download, FileText, Filter } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import Toast from '../../components/common/Toast';

const ReportsPage = () => {
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState(null);
    const [dateRange, setDateRange] = useState({ from: '', to: '' });
    const [toast, setToast] = useState(null);

    const fetchReportData = async () => {
        setLoading(true);
        try {
            // For now, re-using overview stats, but in a real app this would be a dedicated reports endpoint
            // receiving date ranges to recalculate aggregates.
            // Since we implemented date filtering on appointments, we could fetch raw appointments 
            // and calculate stats client-side for this demo, or just use the overview stats.
            // Let's use overview stats for the charts, and mimic a report generation.

            const response = await api.get('/admin/overview/');
            setStats(response.data);

        } catch (error) {
            console.error(error);
            setToast({ message: "Failed to generate report", type: 'error' });
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchReportData();
    }, []);

    const handleExport = (type) => {
        // Mock CSV export
        const csvContent = "data:text/csv;charset=utf-8,"
            + "Date,Total Appointments,Completed,Pending\n"
            + stats?.trend?.map(row => `${row.date},${row.count},0,0`).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `hospital_report_${type}_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setToast({ message: "Report downloaded successfully", type: 'success' });
    };

    return (
        <div>
            <h1 className="flex-between">Reports & Analytics</h1>

            <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Date From</label>
                        <input type="date" value={dateRange.from} onChange={e => setDateRange({ ...dateRange, from: e.target.value })} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label>Date To</label>
                        <input type="date" value={dateRange.to} onChange={e => setDateRange({ ...dateRange, to: e.target.value })} />
                    </div>
                    <button className="btn-primary" onClick={fetchReportData} disabled={loading}>
                        {loading ? 'Generating...' : 'Generate Report'}
                    </button>
                    <div style={{ flex: 1 }}></div>
                    <button className="btn-outline" onClick={() => handleExport('appointments')} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <Download size={18} /> Export CSV
                    </button>
                </div>
            </div>

            {stats && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    <div className="card">
                        <h3>Appointments by Status</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={stats.status_distribution}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="status" />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="count" fill="#8884d8" name="Count" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="card">
                        <h3>Appointments Trend</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={stats.trend}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="count" fill="#82ca9d" name="Appointments" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="card" style={{ gridColumn: 'span 2' }}>
                        <h3>Doctor Performance</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={stats.doctor_workload} layout="vertical" margin={{ left: 50 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" />
                                <YAxis dataKey="assigned_doctor__last_name" type="category" />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="count" fill="#ffc658" name="Appointments Assigned" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

export default ReportsPage;

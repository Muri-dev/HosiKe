import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

const PrescriptionBuilder = ({ items, setItems }) => {
    const [newItem, setNewItem] = useState({ 
        medicine_name: '', dosage: '', route: 'PO', duration: 1, 
        morning: true, afternoon: false, evening: true, instructions: '' 
    });

    const handleAdd = () => {
        if (!newItem.medicine_name || !newItem.dosage) return alert("Medicine and dosage required");
        setItems([...items, newItem]);
        setNewItem({ 
            medicine_name: '', dosage: '', route: 'PO', duration: 1, 
            morning: true, afternoon: false, evening: true, instructions: '' 
        });
    };

    const handleRemove = (index) => {
        setItems(items.filter((_, i) => i !== index));
    };

    return (
        <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.5rem', marginTop: '1rem' }}>
            <h4>Rx: Prescription</h4>
            <div className="prescription-list">
                {items.map((item, idx) => {
                    const schedule = [
                        item.morning ? 'Morning' : null,
                        item.afternoon ? 'Afternoon' : null,
                        item.evening ? 'Evening' : null
                    ].filter(Boolean).join(', ') || 'PRN';

                    return (
                        <div key={idx} className="flex-between" style={{ background: 'white', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '0.5rem', border: '1px solid #e2e8f0' }}>
                            <div>
                                <strong>{item.medicine_name}</strong> - {item.dosage} ({item.route})
                                <div className="text-sm mt-0_5">
                                    <span style={{ color: 'var(--primary-color)', fontWeight: 600 }}>{schedule}</span> for {item.duration} days
                                </div>
                                {item.instructions && <div className="text-muted text-sm mt-0_5">{item.instructions}</div>}
                            </div>
                            <button type="button" onClick={() => handleRemove(idx)} className="text-red btn-icon"><Trash2 size={16} /></button>
                        </div>
                    );
                })}
            </div>

            <div className="bg-light p-1 rounded mt-1" style={{ border: '1px solid #e2e8f0', background: '#fff' }}>
                <div className="grid-2 gap-0_5 mb-0_5">
                    <input placeholder="Medicine Name" value={newItem.medicine_name} onChange={e => setNewItem({ ...newItem, medicine_name: e.target.value })} className="form-input" />
                    <input placeholder="Dosage (e.g. 500mg)" value={newItem.dosage} onChange={e => setNewItem({ ...newItem, dosage: e.target.value })} className="form-input" />
                </div>
                <div className="grid-2 gap-0_5 mb-1">
                    <div>
                        <label className="text-xs text-muted block mb-0_25 font-bold uppercase" style={{ fontSize: '0.7rem' }}>Route</label>
                        <select value={newItem.route} onChange={e => setNewItem({ ...newItem, route: e.target.value })} className="form-input w-100">
                            <option value="PO">Oral (PO)</option>
                            <option value="IV">Intravenous (IV)</option>
                            <option value="IM">Intramuscular (IM)</option>
                            <option value="Topical">Topical</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs block mb-0_25 font-bold uppercase" style={{ fontSize: '0.7rem', color: '#3b82f6' }}>Period (Days - Auto-calculates End Date)</label>
                        <input type="number" min="1" placeholder="Duration (Days)" title="System will automatically calculate the end date from this period" value={newItem.duration} onChange={e => setNewItem({ ...newItem, duration: parseInt(e.target.value) || 1 })} className="form-input w-100" style={{ borderColor: '#bfdbfe' }} />
                    </div>
                </div>
                <label className="text-sm font-bold text-muted uppercase block mb-0_5" style={{ fontSize: '0.75rem', letterSpacing: '0.04em' }}>Schedule Timeline (Check all that apply)</label>
                <div className="flex-start gap-1 mb-1 bg-white p-0_5 rounded" style={{ border: '1px solid #cbd5e1', padding: '0.75rem', borderRadius: 8 }}>
                    <label className="flex-center gap-0_5 cursor-pointer" style={{ cursor: 'pointer' }}>
                        <input type="checkbox" checked={newItem.morning} onChange={(e) => setNewItem({...newItem, morning: e.target.checked})} style={{ width: '16px', height: '16px', cursor: 'pointer' }} /> 
                        <span className="text-sm font-bold text-dark">Morning</span>
                    </label>
                    <label className="flex-center gap-0_5 cursor-pointer" style={{ cursor: 'pointer' }}>
                        <input type="checkbox" checked={newItem.afternoon} onChange={(e) => setNewItem({...newItem, afternoon: e.target.checked})} style={{ width: '16px', height: '16px', cursor: 'pointer' }} /> 
                        <span className="text-sm font-bold text-dark">Afternoon</span>
                    </label>
                    <label className="flex-center gap-0_5 cursor-pointer" style={{ cursor: 'pointer' }}>
                        <input type="checkbox" checked={newItem.evening} onChange={(e) => setNewItem({...newItem, evening: e.target.checked})} style={{ width: '16px', height: '16px', cursor: 'pointer' }} /> 
                        <span className="text-sm font-bold text-dark">Evening</span>
                    </label>
                </div>
                <input placeholder="Special Instructions (Optional)" value={newItem.instructions} onChange={e => setNewItem({ ...newItem, instructions: e.target.value })} className="form-input mb-1" />
                <button type="button" onClick={handleAdd} className="btn-secondary btn-sm full-width flex-center gap-0_5 font-bold">
                    <Plus size={16} /> Add Medication
                </button>
            </div>
        </div>
    );
};

export default PrescriptionBuilder;

import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

const PrescriptionBuilder = ({ items, setItems }) => {
    const [newItem, setNewItem] = useState({ medicine_name: '', dosage: '', frequency: '', duration: '', instructions: '' });

    const handleAdd = () => {
        if (!newItem.medicine_name || !newItem.dosage) return alert("Medicine and dosage required");
        setItems([...items, newItem]);
        setNewItem({ medicine_name: '', dosage: '', frequency: '', duration: '', instructions: '' });
    };

    const handleRemove = (index) => {
        setItems(items.filter((_, i) => i !== index));
    };

    return (
        <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.5rem', marginTop: '1rem' }}>
            <h4>Rx: Prescription</h4>
            <div className="prescription-list">
                {items.map((item, idx) => (
                    <div key={idx} className="flex-between" style={{ background: 'white', padding: '0.5rem', borderRadius: '0.25rem', marginBottom: '0.5rem', border: '1px solid #e2e8f0' }}>
                        <div>
                            <strong>{item.medicine_name}</strong> - {item.dosage} ({item.frequency} for {item.duration})
                            {item.instructions && <div className="text-muted text-sm">{item.instructions}</div>}
                        </div>
                        <button type="button" onClick={() => handleRemove(idx)} className="text-red"><Trash2 size={16} /></button>
                    </div>
                ))}
            </div>

            <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '1rem' }}>
                <input placeholder="Medicine Name" value={newItem.medicine_name} onChange={e => setNewItem({ ...newItem, medicine_name: e.target.value })} className="form-input" />
                <input placeholder="Dosage (e.g. 500mg)" value={newItem.dosage} onChange={e => setNewItem({ ...newItem, dosage: e.target.value })} className="form-input" />
                <input placeholder="Frequency (e.g. 2x daily)" value={newItem.frequency} onChange={e => setNewItem({ ...newItem, frequency: e.target.value })} className="form-input" />
                <input placeholder="Duration (e.g. 5 days)" value={newItem.duration} onChange={e => setNewItem({ ...newItem, duration: e.target.value })} className="form-input" />
                <input placeholder="Instructions" value={newItem.instructions} onChange={e => setNewItem({ ...newItem, instructions: e.target.value })} className="form-input" style={{ gridColumn: 'span 2' }} />
            </div>
            <button type="button" onClick={handleAdd} className="btn-secondary btn-sm" style={{ marginTop: '0.5rem' }}>
                <Plus size={16} /> Add Item
            </button>
        </div>
    );
};

export default PrescriptionBuilder;

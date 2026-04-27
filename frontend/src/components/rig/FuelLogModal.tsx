import { useState } from 'react';
import { X } from 'lucide-react';
import { useToast } from '../ToastProvider';
import api from '../../services/api';

const CN = { bg: '#0F1C35', card: '#162236', gold: '#E8A838', cream: '#F5F0E8', muted: '#8B9BB4', border: '#243552' };

interface Props {
  rigId: string;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function FuelLogModal({ rigId, isOpen, onClose, onSaved }: Props) {
  const { addLocalToast } = useToast();
  const [gallons, setGallons] = useState('');
  const [pricePerGal, setPricePerGal] = useState('');
  const [odometer, setOdometer] = useState('');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const totalCost = gallons && pricePerGal ? (parseFloat(gallons) * parseFloat(pricePerGal)).toFixed(2) : '';

  const handleSubmit = async () => {
    if (!gallons || !pricePerGal) { addLocalToast('Gallons and price are required', 'warning'); return; }
    setSaving(true);
    try {
      await api.post(`/rigs/${rigId}/fuel-logs`, {
        gallons: parseFloat(gallons),
        pricePerGal: parseFloat(pricePerGal),
        totalCost: parseFloat(totalCost),
        odometer: odometer ? parseInt(odometer) : undefined,
        location: location || undefined,
      });
      addLocalToast('Fuel log saved!', 'success');
      onSaved();
      onClose();
      setGallons(''); setPricePerGal(''); setOdometer(''); setLocation('');
    } catch { addLocalToast('Failed to save fuel log', 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl p-6" style={{ background: CN.card, border: `1px solid ${CN.border}` }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold" style={{ color: CN.cream }}>⛽ Log Fuel Stop</h3>
          <button onClick={onClose} style={{ color: CN.muted }}><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs block mb-1" style={{ color: CN.muted }}>Gallons</label>
              <input type="number" step="0.1" value={gallons} onChange={e => setGallons(e.target.value)} placeholder="25.5"
                className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: CN.bg, border: `1px solid ${CN.border}`, color: CN.cream }} />
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: CN.muted }}>Price/gal</label>
              <input type="number" step="0.01" value={pricePerGal} onChange={e => setPricePerGal(e.target.value)} placeholder="3.49"
                className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: CN.bg, border: `1px solid ${CN.border}`, color: CN.cream }} />
            </div>
          </div>
          {totalCost && <p className="text-xs" style={{ color: CN.gold }}>Total: ${totalCost}</p>}
          <div>
            <label className="text-xs block mb-1" style={{ color: CN.muted }}>Odometer</label>
            <input type="number" value={odometer} onChange={e => setOdometer(e.target.value)} placeholder="45,230"
              className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: CN.bg, border: `1px solid ${CN.border}`, color: CN.cream }} />
          </div>
          <div>
            <label className="text-xs block mb-1" style={{ color: CN.muted }}>Location (optional)</label>
            <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="Shell, Rockford IL"
              className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: CN.bg, border: `1px solid ${CN.border}`, color: CN.cream }} />
          </div>
        </div>
        <button onClick={handleSubmit} disabled={saving}
          className="w-full mt-4 py-2.5 rounded-xl text-sm font-bold transition hover:brightness-110 disabled:opacity-50"
          style={{ background: CN.gold, color: CN.bg }}>
          {saving ? 'Saving...' : 'Save Fuel Log'}
        </button>
      </div>
    </div>
  );
}

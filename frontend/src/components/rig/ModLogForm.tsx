import { useState } from 'react';
import { X } from 'lucide-react';
import { useToast } from '../ToastProvider';
import api from '../../services/api';

const CN = { bg: '#0F1C35', card: '#162236', gold: '#E8A838', cream: '#F5F0E8', muted: '#8B9BB4', border: '#243552' };
const CATEGORIES = ['solar', 'towing', 'kitchen', 'comfort', 'tech', 'exterior', 'safety', 'storage', 'other'];

interface Props {
  rigId: string;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  existingMod?: any;
}

export default function ModLogForm({ rigId, isOpen, onClose, onSaved, existingMod }: Props) {
  const { addLocalToast } = useToast();
  const [title, setTitle] = useState(existingMod?.title || '');
  const [description, setDescription] = useState(existingMod?.description || '');
  const [category, setCategory] = useState(existingMod?.category || '');
  const [cost, setCost] = useState(existingMod?.cost?.toString() || '');
  const [beforePhoto, setBeforePhoto] = useState(existingMod?.beforePhoto || '');
  const [afterPhoto, setAfterPhoto] = useState(existingMod?.afterPhoto || '');
  const [productLink, setProductLink] = useState(existingMod?.productLink || '');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!title.trim()) { addLocalToast('Title is required', 'warning'); return; }
    setSaving(true);
    try {
      const body = {
        title: title.trim(),
        description: description.trim() || undefined,
        category: category || undefined,
        cost: cost ? parseFloat(cost) : undefined,
        beforePhoto: beforePhoto || undefined,
        afterPhoto: afterPhoto || undefined,
        productLink: productLink || undefined,
        modDate: new Date().toISOString(),
      };

      if (existingMod?.id) {
        await api.put(`/rigs/${rigId}/mods/${existingMod.id}`, body);
      } else {
        await api.post(`/rigs/${rigId}/mods`, body);
      }
      addLocalToast(existingMod ? 'Mod updated!' : 'Mod logged!', 'success');
      onSaved();
      onClose();
    } catch { addLocalToast('Failed to save mod', 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-6" style={{ background: CN.card, border: `1px solid ${CN.border}` }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold" style={{ color: CN.cream }}>🔧 {existingMod ? 'Edit' : 'Log a'} Mod</h3>
          <button onClick={onClose} style={{ color: CN.muted }}><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs block mb-1" style={{ color: CN.muted }}>Title *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder='e.g. "Added 400W solar panels"'
              className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: CN.bg, border: `1px solid ${CN.border}`, color: CN.cream }} />
          </div>
          <div>
            <label className="text-xs block mb-1" style={{ color: CN.muted }}>Category</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map(c => (
                <button key={c} type="button" onClick={() => setCategory(c === category ? '' : c)}
                  className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition"
                  style={{ background: c === category ? `${CN.gold}20` : 'transparent', color: c === category ? CN.gold : CN.muted, border: `1px solid ${c === category ? CN.gold : CN.border}` }}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs block mb-1" style={{ color: CN.muted }}>Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="What did you add and why?"
              className="w-full px-3 py-2 rounded-lg text-sm resize-none" style={{ background: CN.bg, border: `1px solid ${CN.border}`, color: CN.cream }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs block mb-1" style={{ color: CN.muted }}>Cost ($)</label>
              <input type="number" step="0.01" value={cost} onChange={e => setCost(e.target.value)} placeholder="450.00"
                className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: CN.bg, border: `1px solid ${CN.border}`, color: CN.cream }} />
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: CN.muted }}>Product Link</label>
              <input type="text" value={productLink} onChange={e => setProductLink(e.target.value)} placeholder="https://amazon.com/..."
                className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: CN.bg, border: `1px solid ${CN.border}`, color: CN.cream }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs block mb-1" style={{ color: CN.muted }}>Before Photo URL</label>
              <input type="text" value={beforePhoto} onChange={e => setBeforePhoto(e.target.value)} placeholder="Cloudinary URL"
                className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: CN.bg, border: `1px solid ${CN.border}`, color: CN.cream }} />
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: CN.muted }}>After Photo URL</label>
              <input type="text" value={afterPhoto} onChange={e => setAfterPhoto(e.target.value)} placeholder="Cloudinary URL"
                className="w-full px-3 py-2 rounded-lg text-sm" style={{ background: CN.bg, border: `1px solid ${CN.border}`, color: CN.cream }} />
            </div>
          </div>
        </div>
        <button onClick={handleSubmit} disabled={saving}
          className="w-full mt-4 py-2.5 rounded-xl text-sm font-bold transition hover:brightness-110 disabled:opacity-50"
          style={{ background: CN.gold, color: CN.bg }}>
          {saving ? 'Saving...' : existingMod ? 'Update Mod' : 'Log Mod'}
        </button>
      </div>
    </div>
  );
}

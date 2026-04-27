import { useState } from 'react';
import { X } from 'lucide-react';
import { useToast } from '../ToastProvider';
import api from '../../services/api';

const CN = { bg: '#0F1C35', card: '#162236', gold: '#E8A838', cream: '#F5F0E8', muted: '#8B9BB4', border: '#243552' };
const POST_TYPES = [
  { id: 'trip_recap', label: 'Trip Recap', icon: '🗺️' },
  { id: 'mod_update', label: 'Mod Update', icon: '🔧' },
  { id: 'tip', label: 'Road Tip', icon: '💡' },
  { id: 'road_report', label: 'Road Report', icon: '📡' },
];

interface Props {
  rigId: string;
  isOpen: boolean;
  onClose: () => void;
  onPublished: () => void;
}

export default function RigPostComposer({ rigId, isOpen, onClose, onPublished }: Props) {
  const { addLocalToast } = useToast();
  const [postType, setPostType] = useState('road_report');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [publishing, setPublishing] = useState(false);

  if (!isOpen) return null;

  const handlePublish = async () => {
    if (!body.trim() && !title.trim()) { addLocalToast('Write something first', 'warning'); return; }
    setPublishing(true);
    try {
      await api.post(`/rigs/${rigId}/posts`, {
        postType,
        title: title.trim() || undefined,
        body: body.trim(),
        photos: [],
      });
      addLocalToast('Post published!', 'success');
      onPublished();
      onClose();
      setTitle(''); setBody(''); setPostType('road_report');
    } catch { addLocalToast('Failed to publish', 'error'); }
    finally { setPublishing(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-6 max-h-[85vh] overflow-y-auto" style={{ background: CN.card, border: `1px solid ${CN.border}` }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold" style={{ color: CN.cream }}>New Rig Post</h3>
          <button onClick={onClose} style={{ color: CN.muted }}><X className="w-5 h-5" /></button>
        </div>

        {/* Post type selector */}
        <div className="flex gap-1.5 mb-4 overflow-x-auto">
          {POST_TYPES.map(t => (
            <button key={t.id} onClick={() => setPostType(t.id)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition"
              style={{ background: postType === t.id ? `${CN.gold}20` : 'transparent', color: postType === t.id ? CN.gold : CN.muted, border: `1px solid ${postType === t.id ? CN.gold : CN.border}` }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Title (optional)"
          className="w-full px-3 py-2 rounded-lg text-sm mb-3 focus:outline-none"
          style={{ background: CN.bg, border: `1px solid ${CN.border}`, color: CN.cream }} />

        <textarea value={body} onChange={e => setBody(e.target.value)} rows={6} placeholder="Share your update..."
          className="w-full px-3 py-2 rounded-lg text-sm resize-none focus:outline-none"
          style={{ background: CN.bg, border: `1px solid ${CN.border}`, color: CN.cream }} />

        <button onClick={handlePublish} disabled={publishing}
          className="w-full mt-4 py-2.5 rounded-xl text-sm font-bold transition hover:brightness-110 disabled:opacity-50"
          style={{ background: CN.gold, color: CN.bg }}>
          {publishing ? 'Publishing...' : 'Publish'}
        </button>
      </div>
    </div>
  );
}

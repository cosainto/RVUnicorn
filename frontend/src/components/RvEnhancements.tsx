import { useState, useEffect, useRef } from 'react';
import {
  Plus, ExternalLink, Trash2, Pencil, X,
  Upload, Video, Globe, DollarSign, Eye, EyeOff, ChevronDown, ChevronUp,
} from 'lucide-react';
import api from '../services/api';

interface Enhancement {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  purchaseUrl?: string | null;
  cost?: number | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
  isPublic: boolean;
  createdAt: string;
}

const CATEGORIES = [
  'Solar', 'Kitchen', 'Tech', 'Safety', 'Comfort',
  'Towing', 'Storage', 'Electrical', 'Other',
];

const CATEGORY_COLORS: Record<string, string> = {
  Solar:      'bg-yellow-100 text-yellow-700',
  Kitchen:    'bg-orange-100 text-orange-700',
  Tech:       'bg-blue-100 text-blue-700',
  Safety:     'bg-red-100 text-red-700',
  Comfort:    'bg-purple-100 text-purple-700',
  Towing:     'bg-gray-100 text-gray-700',
  Storage:    'bg-green-100 text-green-700',
  Electrical: 'bg-cyan-100 text-cyan-700',
  Other:      'bg-gray-100 text-gray-500',
};

const EMPTY_FORM = {
  title: '',
  description: '',
  category: '',
  purchaseUrl: '',
  videoUrl: '',
  cost: '',
  isPublic: true,
};

function isEmbeddable(url: string) {
  return url.includes('youtube.com') || url.includes('youtu.be') || url.includes('vimeo.com');
}

function getEmbedUrl(url: string) {
  if (url.includes('youtu.be/')) {
    const id = url.split('youtu.be/')[1]?.split('?')[0];
    return `https://www.youtube.com/embed/${id}`;
  }
  if (url.includes('youtube.com/watch')) {
    try { const id = new URL(url).searchParams.get('v'); return `https://www.youtube.com/embed/${id}`; }
    catch { return url; }
  }
  if (url.includes('vimeo.com/')) {
    const id = url.split('vimeo.com/')[1]?.split('?')[0];
    return `https://player.vimeo.com/video/${id}`;
  }
  return url;
}

export default function RvEnhancements() {
  const [enhancements, setEnhancements] = useState<Enhancement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchEnhancements(); }, []);

  const fetchEnhancements = async () => {
    try {
      const { data } = await api.get('/rv-enhancements');
      setEnhancements(data);
    } catch (err) {
      console.error('Failed to fetch enhancements:', err);
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setImageFile(null);
    setVideoFile(null);
    setImagePreview(null);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (e: Enhancement) => {
    setForm({
      title: e.title,
      description: e.description || '',
      category: e.category || '',
      purchaseUrl: e.purchaseUrl || '',
      videoUrl: e.videoUrl || '',
      cost: e.cost?.toString() || '',
      isPublic: e.isPublic,
    });
    setImagePreview(e.imageUrl || null);
    setImageFile(null);
    setVideoFile(null);
    setEditingId(e.id);
    setShowForm(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setVideoFile(file);
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (imageRef.current) imageRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('title', form.title.trim());
      fd.append('description', form.description);
      fd.append('category', form.category);
      fd.append('purchaseUrl', form.purchaseUrl);
      fd.append('videoUrl', form.videoUrl);
      fd.append('cost', form.cost);
      fd.append('isPublic', String(form.isPublic));
      if (imageFile) fd.append('image', imageFile);
      if (videoFile) fd.append('video', videoFile);

      if (editingId) {
        const { data } = await api.patch(`/rv-enhancements/${editingId}`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setEnhancements(prev => prev.map(e => (e.id === editingId ? data : e)));
      } else {
        const { data } = await api.post('/rv-enhancements', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setEnhancements(prev => [data, ...prev]);
      }
      setShowForm(false);
    } catch (err) {
      console.error('Failed to save enhancement:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this enhancement?')) return;
    try {
      await api.delete(`/rv-enhancements/${id}`);
      setEnhancements(prev => prev.filter(e => e.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch (err) {
      console.error('Failed to delete enhancement:', err);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div>
          <h2 className="text-xl font-bold text-gray-900">🔧 My RV Enhancements</h2>
          <p className="text-sm text-gray-500 mt-0.5">Mods, upgrades &amp; custom builds</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition">
          <Plus className="w-4 h-4" /> Add Enhancement
        </button>
      </div>

      {showForm && (
        <div className="border-b border-gray-100 bg-gray-50 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-800">{editingId ? 'Edit Enhancement' : 'New Enhancement'}</h3>
            <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-gray-400 hover:text-gray-600" /></button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Title *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. 400W Solar Panel System" className="mt-1 w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="mt-1 w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">Select category</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Description / Install Notes</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What you installed, why you chose it, tips for others..." rows={3} className="mt-1 w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1"><Globe className="w-3 h-3" /> Purchase Link</label>
              <input value={form.purchaseUrl} onChange={e => setForm(f => ({ ...f, purchaseUrl: e.target.value }))} placeholder="https://amazon.com/..." className="mt-1 w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1"><DollarSign className="w-3 h-3" /> What I Paid (optional)</label>
              <input type="number" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} placeholder="0.00" min={0} className="mt-1 w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1"><Video className="w-3 h-3" /> Video Link (YouTube / Vimeo)</label>
            <input value={form.videoUrl} onChange={e => setForm(f => ({ ...f, videoUrl: e.target.value }))} placeholder="https://youtube.com/watch?v=..." className="mt-1 w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">📷 Install Photo</label>
              <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              {imagePreview ? (
                <div className="relative">
                  <img src={imagePreview} alt="preview" className="w-full h-28 object-cover rounded-lg border border-gray-200" />
                  <button onClick={clearImage} className="absolute top-1.5 right-1.5 bg-black/50 rounded-full p-0.5"><X className="w-3 h-3 text-white" /></button>
                </div>
              ) : (
                <button onClick={() => imageRef.current?.click()} className="w-full h-28 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-1.5 hover:border-blue-400 hover:bg-blue-50 transition">
                  <Upload className="w-5 h-5 text-gray-400" /><span className="text-xs text-gray-400">Upload photo</span>
                </button>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">🎥 Upload Video File</label>
              <input ref={videoRef} type="file" accept="video/*" className="hidden" onChange={handleVideoChange} />
              <button onClick={() => videoRef.current?.click()} className={`w-full h-28 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1.5 transition ${videoFile ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'}`}>
                <Video className={`w-5 h-5 ${videoFile ? 'text-green-500' : 'text-gray-400'}`} />
                <span className={`text-xs text-center px-2 ${videoFile ? 'text-green-600 font-medium' : 'text-gray-400'}`}>{videoFile ? (videoFile.name.length > 22 ? videoFile.name.slice(0, 22) + '…' : videoFile.name) : 'Upload video file'}</span>
              </button>
            </div>
          </div>

          <button onClick={() => setForm(f => ({ ...f, isPublic: !f.isPublic }))} className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg font-medium transition ${form.isPublic ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {form.isPublic ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            {form.isPublic ? 'Visible on my public profile' : 'Private (only me)'}
          </button>

          <div className="flex gap-2 pt-1">
            <button onClick={handleSubmit} disabled={!form.title.trim() || saving} className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition">
              {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Enhancement'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2.5 border border-gray-300 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition">Cancel</button>
          </div>
        </div>
      )}

      <div className="divide-y divide-gray-50">
        {loading ? (
          <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
        ) : enhancements.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-3xl mb-2">🔧</p>
            <p className="text-sm font-medium text-gray-500">No enhancements yet</p>
            <p className="text-xs text-gray-400 mt-1">Add solar installs, kitchen upgrades, tech builds — anything you've done to your rig</p>
          </div>
        ) : (
          enhancements.map(e => {
            const isExpanded = expandedId === e.id;
            const hasMedia = !!(e.imageUrl || e.videoUrl);
            return (
              <div key={e.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-gray-900">{e.title}</span>
                      {e.category && <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[e.category] ?? CATEGORY_COLORS.Other}`}>{e.category}</span>}
                      {!e.isPublic && <span className="text-xs flex items-center gap-1 text-gray-400"><EyeOff className="w-3 h-3" /> Private</span>}
                    </div>
                    {e.cost != null && <p className="text-xs text-gray-400 mt-0.5">${e.cost.toLocaleString()} spent</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEdit(e)} className="p-1.5 hover:bg-gray-100 rounded-lg transition"><Pencil className="w-3.5 h-3.5 text-gray-400" /></button>
                    <button onClick={() => handleDelete(e.id)} className="p-1.5 hover:bg-red-50 rounded-lg transition"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                  </div>
                </div>
                {e.description && <p className="text-xs text-gray-600 mt-2 leading-relaxed">{e.description}</p>}
                {(e.purchaseUrl || hasMedia) && (
                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    {e.purchaseUrl && <a href={e.purchaseUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"><ExternalLink className="w-3 h-3" /> Where I bought it</a>}
                    {hasMedia && (
                      <button onClick={() => setExpandedId(isExpanded ? null : e.id)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 font-medium">
                        {isExpanded ? <><ChevronUp className="w-3 h-3" /> Hide media</> : <><ChevronDown className="w-3 h-3" /> Show install media</>}
                      </button>
                    )}
                  </div>
                )}
                {isExpanded && (
                  <div className="mt-3 space-y-3">
                    {e.imageUrl && <img src={e.imageUrl} alt={e.title} className="w-full max-h-72 object-cover rounded-lg border border-gray-100" />}
                    {e.videoUrl && (isEmbeddable(e.videoUrl)
                      ? <div className="aspect-video rounded-lg overflow-hidden border border-gray-100"><iframe src={getEmbedUrl(e.videoUrl)} className="w-full h-full" allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" /></div>
                      : <video src={e.videoUrl} controls className="w-full rounded-lg border border-gray-100 max-h-72" />
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

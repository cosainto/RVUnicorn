import { useState } from 'react';
import { X, Camera, Loader2, MapPin } from 'lucide-react';
import api from '../services/api';

interface Props {
  onClose: () => void;
  onSubmit: () => void;
  defaultLat?: number;
  defaultLng?: number;
}

const CATEGORIES = [
  { value: 'TRAIL', label: 'Trail' },
  { value: 'RESTAURANT', label: 'Restaurant' },
  { value: 'ATTRACTION', label: 'Attraction' },
  { value: 'MUSEUM', label: 'Museum' },
  { value: 'MARKET', label: 'Market' },
  { value: 'SCENIC_VIEW', label: 'Scenic View' },
  { value: 'FISHING_SPOT', label: 'Fishing Spot' },
  { value: 'PLAYGROUND', label: 'Playground' },
  { value: 'OTHER', label: 'Other' },
];

export default function AddPlaceModal({ onClose, onSubmit, defaultLat, defaultLng }: Props) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState('OTHER');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || photoUrls.length >= 3) return;
    setUploading(true);
    for (let i = 0; i < Math.min(files.length, 3 - photoUrls.length); i++) {
      try {
        const formData = new FormData();
        formData.append('file', files[i]);
        const { data } = await api.post('/upload/image', formData);
        setPhotoUrls(prev => [...prev, data.url || data.imageUrl]);
      } catch {}
    }
    setUploading(false);
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await api.post('/experiences', {
        name, address, category, description, website, photoUrls,
        latitude: defaultLat, longitude: defaultLng,
      });
      setSubmitted(true);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to submit');
    }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center" onClick={e => e.stopPropagation()}>
          <div className="text-4xl mb-3">🎉</div>
          <h3 className="font-bold text-gray-900 text-lg">Thanks!</h3>
          <p className="text-sm text-gray-500 mt-1">Your place is under review. We'll let you know once it's approved.</p>
          <button onClick={() => { onClose(); onSubmit(); }} className="mt-4 px-6 py-2.5 bg-primary-600 text-white font-semibold rounded-xl">Got it</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between rounded-t-2xl z-10">
          <h3 className="font-bold text-gray-900 flex items-center gap-2"><MapPin className="w-4 h-4 text-primary-500" />Add a Place</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Place Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sunset Point Trail"
              className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Address</label>
            <input value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Main St, City, State"
              className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 bg-white">
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Why is it worth visiting?</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Amazing views, kid-friendly, great food..."
              className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 resize-none" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Website (optional)</label>
            <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://..."
              className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Photos (optional)</label>
            <div className="flex gap-2 flex-wrap">
              {photoUrls.map((url, i) => (
                <div key={i} className="relative w-16 h-16">
                  <img src={url} alt="" className="w-full h-full object-cover rounded-lg" />
                  <button onClick={() => setPhotoUrls(prev => prev.filter((_, j) => j !== i))}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px]">x</button>
                </div>
              ))}
              {photoUrls.length < 3 && (
                <label className="w-16 h-16 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center cursor-pointer hover:border-gray-300">
                  {uploading ? <Loader2 className="w-5 h-5 text-gray-400 animate-spin" /> : <Camera className="w-5 h-5 text-gray-400" />}
                  <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="hidden" />
                </label>
              )}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-3">
          <button onClick={handleSubmit} disabled={!name.trim() || submitting}
            className="w-full py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 disabled:opacity-50 transition">
            {submitting ? 'Submitting...' : 'Submit Place'}
          </button>
        </div>
      </div>
    </div>
  );
}

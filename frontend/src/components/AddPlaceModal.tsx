import { useState } from 'react';
import { X, Camera, Loader2, MapPin } from 'lucide-react';
import api from '../services/api';
import { uploadAndGetUrl } from '../utils/uploadMedia';

interface Props {
  onClose: () => void;
  onSubmit: () => void;
  defaultLat?: number;
  defaultLng?: number;
}

const CATEGORIES = [
  { value: 'RESTAURANT', label: 'Restaurant', emoji: '🍽️' },
  { value: 'ATTRACTION', label: 'Attraction', emoji: '🎪' },
  { value: 'TRAIL', label: 'Hiking', emoji: '🥾' },
  { value: 'PLAYGROUND', label: 'Family Fun', emoji: '👨‍👩‍👧' },
  { value: 'SCENIC_VIEW', label: 'Scenic View', emoji: '🏔️' },
  { value: 'MUSEUM', label: 'Museum', emoji: '🏛️' },
  { value: 'MARKET', label: 'Market', emoji: '🛍️' },
  { value: 'FISHING_SPOT', label: 'Fishing', emoji: '🎣' },
  { value: 'EVENT', label: 'Event', emoji: '📅' },
  { value: 'OTHER', label: 'Other', emoji: '📍' },
];

export default function AddPlaceModal({ onClose, onSubmit, defaultLat, defaultLng }: Props) {
  const [step, setStep] = useState<1 | 2 | 'done'>(1);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || photoUrls.length >= 3) return;
    setUploading(true);
    for (let i = 0; i < Math.min(files.length, 3 - photoUrls.length); i++) {
      try {
        const url = await uploadAndGetUrl(files[i], 'rvunicorn/places');
        setPhotoUrls(prev => [...prev, url]);
      } catch {}
    }
    setUploading(false);
  };

  const handleSubmit = async () => {
    if (!name.trim() || !category || !address.trim()) return;
    setSubmitting(true);
    try {
      await api.post('/experiences', {
        name, address, category, description, website, photoUrls,
        latitude: defaultLat, longitude: defaultLng,
      });
      setStep('done');
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to submit');
    }
    setSubmitting(false);
  };

  // Done state — Hitch confirmation
  if (step === 'done') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center" onClick={e => e.stopPropagation()}>
          <img src="https://res.cloudinary.com/dy6eetmh7/image/upload/w_80,h_80,c_fill/v1775261116/rvunicorn/characters/hitch.png" alt="Hitch" className="w-16 h-16 mx-auto rounded-full mb-3" />
          <h3 className="font-bold text-gray-900 text-lg">Thanks!</h3>
          <p className="text-sm text-gray-600 mt-2">We'll review <strong>{name}</strong> and add it to the map soon.</p>
          <p className="text-xs text-gray-400 mt-2">In the meantime, your submission helps other campers discover great places.</p>
          <button onClick={() => { onClose(); onSubmit(); }} className="mt-4 px-6 py-2.5 bg-primary-600 text-white font-semibold rounded-xl">Got it</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between rounded-t-2xl z-10">
          <h3 className="font-bold text-gray-900 flex items-center gap-2"><MapPin className="w-4 h-4 text-primary-500" />Add a Missing Place</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        {step === 1 && (
          <>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Place Name *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sunset Point Trail"
                  className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Category *</label>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map(c => (
                    <button key={c.value} onClick={() => setCategory(c.value)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition ${
                        category === c.value ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}>
                      <span>{c.emoji}</span>{c.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Address *</label>
                <input value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Main St, City, State"
                  className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5" />
              </div>
            </div>
            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-3">
              <button onClick={() => setStep(2)} disabled={!name.trim() || !category || !address.trim()}
                className="w-full py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 disabled:opacity-50 transition">
                Next
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="px-5 py-4 space-y-4">
              <p className="text-xs text-gray-400">Optional — add more details or skip to submit</p>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">What made this place special?</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                  placeholder="What made this place special for you?"
                  className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 resize-none" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Website</label>
                <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://..."
                  className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Photos (max 3)</label>
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
            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-3 flex gap-3">
              <button onClick={handleSubmit} disabled={submitting}
                className="flex-1 py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 disabled:opacity-50 transition">
                {submitting ? 'Submitting...' : 'Add Details & Submit'}
              </button>
              <button onClick={() => { setDescription(''); setWebsite(''); setPhotoUrls([]); handleSubmit(); }} disabled={submitting}
                className="px-4 py-3 border border-gray-200 text-gray-600 font-semibold rounded-xl text-sm">
                Skip & Submit
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

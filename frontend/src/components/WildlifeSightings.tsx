import { useState, useEffect } from 'react';
import api from '../services/api';
import { formatDistanceToNow } from 'date-fns';
import { Plus, X } from 'lucide-react';

interface Sighting {
  id: string;
  animal: string;
  emoji: string;
  description?: string;
  imageUrl?: string;
  seenAt: string;
  user: { id: string; firstName: string; lastName: string; profilePicture?: string };
}

interface Props {
  campgroundId: string;
}

const COMMON_ANIMALS = ['Deer', 'Bear', 'Turkey', 'Eagle', 'Owl', 'Fox', 'Raccoon', 'Rabbit', 'Squirrel', 'Snake', 'Turtle', 'Alligator', 'Heron', 'Coyote', 'Other'];

export default function WildlifeSightings({ campgroundId }: Props) {
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [animal, setAnimal] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get(`/wildlife/${campgroundId}`)
      .then(({ data }) => setSightings(data.sightings || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [campgroundId]);

  const submit = async () => {
    if (!animal.trim()) return;
    setSubmitting(true);
    try {
      const { data } = await api.post(`/wildlife/${campgroundId}`, { animal, description });
      setSightings(prev => [data.sighting, ...prev]);
      setAnimal('');
      setDescription('');
      setShowForm(false);
    } catch (e) { console.error(e); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🐾</span>
          <span className="font-bold text-sm text-gray-900">Wildlife Spotted</span>
          {sightings.length > 0 && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{sightings.length}</span>}
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1 text-xs bg-green-500 text-white px-3 py-1.5 rounded-lg hover:bg-green-600 transition font-semibold">
          {showForm ? <><X className="w-3 h-3" /> Cancel</> : <><Plus className="w-3 h-3" /> Log Sighting</>}
        </button>
      </div>

      {showForm && (
        <div className="px-4 py-3 bg-green-50 border-b border-green-100 space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1.5 block">What did you see?</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {COMMON_ANIMALS.map(a => (
                <button key={a} onClick={() => setAnimal(a)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition ${animal === a ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-600 border-gray-200 hover:border-green-400'}`}>
                  {a}
                </button>
              ))}
            </div>
            <input value={animal} onChange={e => setAnimal(e.target.value)} placeholder="Or type any animal..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
          </div>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Any details? (optional) — where you saw it, what it was doing..." rows={2}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none" />
          <button onClick={submit} disabled={!animal.trim() || submitting}
            className="w-full bg-green-500 text-white py-2 rounded-xl text-sm font-semibold hover:bg-green-600 disabled:opacity-50 transition">
            {submitting ? 'Logging...' : 'Log Sighting 🐾'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="p-4 space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : sightings.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <div className="text-3xl mb-2">🌿</div>
          <p className="text-sm text-gray-500">No sightings yet — be the first to spot something!</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
          {sightings.map(s => (
            <div key={s.id} className="flex items-start gap-3 px-4 py-3">
              <span className="text-2xl flex-shrink-0">{s.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-gray-900">{s.animal}</span>
                  <span className="text-xs text-gray-400">spotted by {s.user.firstName}</span>
                  <span className="text-xs text-gray-300">{formatDistanceToNow(new Date(s.seenAt), { addSuffix: true })}</span>
                </div>
                {s.description && <p className="text-xs text-gray-500 mt-0.5 italic">"{s.description}"</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

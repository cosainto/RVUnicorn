import { useState } from 'react';
import { Loader, Sparkles } from 'lucide-react';
import api from '../services/api';

interface Props {
  campgroundName?: string;
  location?: string;
  tripTitle?: string;
  onSelect: (caption: string) => void;
}

export default function HitchPhotoCaptions({ campgroundName, location, tripTitle, onSelect }: Props) {
  const [loading, setLoading] = useState(false);
  const [captions, setCaptions] = useState<string[]>([]);
  const [selected, setSelected] = useState('');

  const generate = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/hitch/photo-caption', {
        campgroundName, location, tripTitle
      });
      setCaptions(data.captions || []);
    } catch {}
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-2">
      <button onClick={generate} disabled={loading}
        className="flex items-center gap-1.5 text-xs text-primary-600 font-semibold hover:text-primary-700">
        {loading ? <Loader className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
        {loading ? 'Generating captions...' : '✨ Suggest AI captions'}
      </button>
      {captions.length > 0 && (
        <div className="space-y-1.5">
          {captions.map((caption, i) => (
            <button key={i} onClick={() => { setSelected(caption); onSelect(caption); }}
              className={`w-full text-left text-xs px-3 py-2 rounded-lg border transition ${
                selected === caption ? 'bg-primary-50 border-primary-300 text-primary-700' : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-gray-300'
              }`}>
              {caption}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

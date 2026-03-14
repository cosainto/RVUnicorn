import { useState } from 'react';
import { Loader, Share2, Copy, Check } from 'lucide-react';
import api from '../services/api';

interface Props {
  event: any;
}

export default function HitchTripSummary({ event }: Props) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState('');
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/hitch/trip-summary', {
        eventTitle: event.title,
        campgroundName: event.campground?.name,
        startDate: event.startDate,
        endDate: event.endDate,
        attendeeCount: (event.attendees?.length || 0) + 1,
        activities: event.activities?.map((a: any) => a.title) || [],
      });
      setSummary(data.summary);
    } catch { alert('Hitch had trouble writing your recap. Try again!'); }
    finally { setLoading(false); }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3">
        <img src="/hitch.png" className="w-8 h-8 rounded-full" />
        <div>
          <p className="font-bold text-gray-900">AI Trip Recap</p>
          <p className="text-xs text-gray-500">Let Hitch write your trip story</p>
        </div>
      </div>

      {!summary ? (
        <button onClick={generate} disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-primary-600 to-purple-600 text-white font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 transition">
          {loading ? <><Loader className="w-4 h-4 animate-spin" /> Writing your story...</> : '✨ Generate Trip Recap'}
        </button>
      ) : (
        <div className="space-y-3">
          <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
            {summary}
          </div>
          <div className="flex gap-2">
            <button onClick={copy}
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition text-sm">
              {copied ? <><Check className="w-4 h-4 text-green-600" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy</>}
            </button>
            <button onClick={generate}
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition text-sm">
              ✨ Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

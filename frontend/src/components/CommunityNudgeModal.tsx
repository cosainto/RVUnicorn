import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import api from '../services/api';

const HITCH_IMG = 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261116/rvunicorn/characters/hitch.png';

interface CommunityNudgeProps {
  trigger: 'checkout' | 'trip_complete';
  campgroundName?: string;
  campgroundState?: string;
  campgroundId?: string;
  nightsStayed?: number;
  tripName?: string;
  route?: string;
  totalNights?: number;
  totalMiles?: number;
  campgroundsVisited?: string[];
  userRigClass?: string;
  onShare: (title: string, body: string) => void;
  onDismiss: () => void;
}

export default function CommunityNudgeModal({
  trigger, campgroundName, campgroundState, campgroundId, nightsStayed,
  tripName, route, totalNights, totalMiles, campgroundsVisited, userRigClass,
  onShare, onDismiss,
}: CommunityNudgeProps) {
  const [nudge, setNudge] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Check localStorage throttle
  const throttleKey = `nudge_${trigger}_${campgroundId || tripName || 'general'}`;
  const isThrottled = (() => {
    const stored = localStorage.getItem(throttleKey);
    if (!stored) return false;
    return Date.now() < parseInt(stored);
  })();

  useEffect(() => {
    if (isThrottled) { onDismiss(); return; }
    api.post('/community/generate-nudge', {
      trigger, campgroundName, campgroundState, nightsStayed, tripName, route, totalNights, totalMiles,
    }).then(r => setNudge(r.data.nudge)).catch(() => setNudge('Share your experience with the community!')).finally(() => setLoading(false));
  }, []);

  const handleShare = async () => {
    setGenerating(true);
    try {
      const { data } = await api.post('/community/generate-draft', {
        trigger, campgroundName, campgroundState, nightsStayed, userRigClass,
        tripName, route, totalNights, totalMiles, campgroundsVisited,
      });
      onShare(data.title, data.body);
    } catch { onShare(campgroundName || tripName || 'My Experience', ''); }
    finally { setGenerating(false); }
  };

  const handleDismiss = () => {
    localStorage.setItem(throttleKey, String(Date.now() + 7 * 86400000));
    onDismiss();
  };

  if (isThrottled) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={handleDismiss}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: '#0F1C35', border: '1px solid rgba(232,168,56,0.18)' }} onClick={e => e.stopPropagation()}>
        <div className="p-5">
          <div className="flex items-start gap-3 mb-4">
            <img src={HITCH_IMG} alt="Hitch" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
            <div className="flex-1">
              <p className="text-[11px] font-bold mb-1" style={{ color: '#E8A838' }}>Hitch</p>
              {loading ? (
                <div className="flex gap-1"><span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#E8A838' }} /><span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#E8A838', animationDelay: '0.15s' }} /><span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#E8A838', animationDelay: '0.3s' }} /></div>
              ) : (
                <p className="text-[13px] leading-relaxed" style={{ color: '#F5F0E8' }}>{nudge}</p>
              )}
            </div>
            <button onClick={handleDismiss} className="p-1 hover:opacity-70"><X className="w-4 h-4" style={{ color: 'rgba(245,240,232,0.3)' }} /></button>
          </div>

          <div className="flex gap-2">
            <button onClick={handleShare} disabled={generating}
              className="flex-1 py-2.5 rounded-xl text-[13px] font-bold transition hover:brightness-110 disabled:opacity-50"
              style={{ background: '#E8622A', color: 'white' }}>
              {generating ? 'Writing draft...' : '\u{1F525} Share My Experience'}
            </button>
            <button onClick={handleDismiss} className="px-4 py-2.5 rounded-xl text-[12px] font-medium"
              style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(245,240,232,0.4)' }}>
              Maybe Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

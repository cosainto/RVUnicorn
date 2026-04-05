import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getMostMotivatingProgress } from '../utils/progressMicroBar';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

export default function ProgressMicroBar() {
  const { user } = useAuth() as any;
  const [progress, setProgress] = useState<any>(null);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      api.get(`/sharing/visited-states/${user.id}`).catch(() => ({ data: { count: 0 } })),
      api.get(`/badges/user/${user.id}`).catch(() => ({ data: { count: 0 } })),
    ]).then(([statesRes, badgesRes]) => {
      const p = getMostMotivatingProgress({
        statesVisited: statesRes.data.count || 0,
        campgroundsVisited: statesRes.data.count || 0,
        badgesEarned: badgesRes.data.count || 0,
      });
      setProgress(p);
      setTimeout(() => setAnimated(true), 100);
    });
  }, [user?.id]);

  if (!progress) return null;

  return (
    <Link to={`/profile/${user?.username}`} className="hidden sm:block" style={{ width: '140px' }}>
      <p className="text-[11px] font-medium mb-0.5" style={{ color: '#E8A838' }}>{progress.label}</p>
      <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div className="h-full rounded-full transition-all duration-800 ease-out" style={{ width: animated ? `${progress.percent}%` : '0%', background: 'linear-gradient(to right, #E8A838, #D4621A)' }} />
      </div>
      <p className="text-[9px] mt-0.5" style={{ color: 'rgba(245,240,232,0.3)' }}>{progress.remaining}</p>
    </Link>
  );
}

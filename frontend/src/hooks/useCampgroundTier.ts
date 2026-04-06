import { useState, useEffect } from 'react';
import api from '../services/api';

export function useCampgroundTier(campgroundId: string | undefined) {
  const [tier, setTier] = useState('TRAILHEAD');
  const [status, setStatus] = useState('ACTIVE');
  const [trialEnd, setTrialEnd] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!campgroundId) return;
    api.get(`/stripe/subscription/${campgroundId}`).then(r => {
      const s = r.data.subscription;
      setTier(s.tier || 'TRAILHEAD');
      setStatus(s.status || 'ACTIVE');
      setTrialEnd(s.trialEndDate || null);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [campgroundId]);

  return {
    tier, status, trialEnd, loading,
    isTrailhead: tier === 'TRAILHEAD' || tier === 'FREE',
    isBasecamp: tier === 'BASECAMP' || tier === 'SUMMIT' || tier === 'FOUNDING',
    isSummit: tier === 'SUMMIT' || tier === 'FOUNDING',
    isFounding: tier === 'FOUNDING',
    isTrialing: status === 'TRIALING',
    isPaused: status === 'PAUSED',
  };
}

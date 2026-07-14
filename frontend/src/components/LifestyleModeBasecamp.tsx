import { useState, useEffect } from 'react';
import api from '../services/api';
import RigPulseCardV2 from './basecamp/RigPulseCardV2';
import DiscoveryHub from './basecamp/DiscoveryHub';
import BasecampFeed from './basecamp/BasecampFeed';
import TravelMap from './TravelMap';
import TripIntelligenceHeader from './basecamp/TripIntelligenceHeader';

const CN = {
  bg: '#0F1C35', card: '#162236', cardAlt: '#1A2A45',
  gold: '#E8A838', cream: '#F5F0E8', muted: '#8B9BB4', border: '#243552',
};

interface Props { user: any; }

export default function LifestyleModeBasecamp({ user }: Props) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    api.get('/basecamp/v2/dashboard').then(r => setData(r.data)).catch(() => setError(true));
  }, [user?.id]);

  return (
    <div style={{ background: CN.bg, minHeight: '100vh' }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-12 pt-6">
        <div className="space-y-4">

          {/* ═══ MAP HERO ═══ */}
          {user?.id && (
            <div className="rounded-xl overflow-hidden" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
              <TravelMap userId={user.id} isOwnProfile={true} compact={false} socialMode={true}
                defaultLayers={['visits', 'friendsCheckins', 'recentAlbums', 'upcomingFriendTrips']} />
            </div>
          )}

          {/* ═══ TRIP INTELLIGENCE ═══ */}
          <TripIntelligenceHeader compactMode={false} />

          {/* ═══ RIG PULSE ═══ */}
          <RigPulseCardV2 data={data?.rigPulse || null} />

          {/* ═══ DISCOVERY HUB (sections 1-6) ═══ */}
          <DiscoveryHub />

          {/* ═══ COMMUNITY FEED ═══ */}
          <BasecampFeed />

          {/* Error fallback */}
          {error && !data && (
            <div className="text-center py-8">
              <p className="text-sm" style={{ color: CN.muted }}>Something went wrong loading your dashboard.</p>
              <button onClick={() => { setError(false); api.get('/basecamp/v2/dashboard').then(r => setData(r.data)).catch(() => setError(true)); }}
                className="mt-2 px-4 py-2 rounded-lg text-xs font-semibold" style={{ background: CN.gold, color: CN.bg }}>
                Retry
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import api from '../services/api';
import RigPulseCardV2 from './basecamp/RigPulseCardV2';
import RVCircleCard from './basecamp/RVCircleCard';
import DiscoverCardV2 from './basecamp/DiscoverCardV2';
import DreamingSection from './basecamp/DreamingSection';
import CampKitchenSection from './basecamp/CampKitchenSection';
import CommunityFeedSection from './basecamp/CommunityFeedSection';
import TravelMap from './TravelMap';

const CN = {
  bg: '#0F1C35', card: '#162236', cardAlt: '#1A2A45',
  gold: '#E8A838', orange: '#D4621A', cream: '#F5F0E8',
  muted: '#8B9BB4', border: '#243552',
};

interface Props { user: any; }

export default function LifestyleModeBasecamp({ user }: Props) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    api.get('/basecamp/v2/dashboard')
      .then(r => setData(r.data))
      .catch(() => setError(true));
  }, [user?.id]);

  return (
    <div style={{ background: CN.bg, minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-12 space-y-4 pt-6">

        {/* ═══ SOCIAL MAP (choropleth) ═══ */}
        {user?.id && (
          <div className="rounded-xl overflow-hidden" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
            <TravelMap
              userId={user.id}
              isOwnProfile={true}
              compact={false}
              socialMode={true}
              defaultLayers={['visits', 'friendsCheckins', 'recentAlbums', 'upcomingFriendTrips']}
            />
          </div>
        )}

        {/* ═══ MODULE 1: RIG PULSE (above fold) ═══ */}
        <RigPulseCardV2 data={data?.rigPulse || null} />

        {/* ═══ MODULE 2: YOUR RV CIRCLE (above fold) ═══ */}
        <RVCircleCard data={data?.rvCircle || null} />

        {/* ═══ MODULE 3: DISCOVER (above fold) ═══ */}
        <DiscoverCardV2 data={data?.discover || null} />

        {/* ─── scroll boundary ─── */}

        {/* ═══ SECTION 4: DREAMING (below fold) ═══ */}
        <DreamingSection data={data?.dreaming || null} />

        {/* ═══ SECTION 5: CAMP KITCHEN (below fold) ═══ */}
        <CampKitchenSection data={data?.campKitchen || null} />

        {/* ═══ SECTION 6: COMMUNITY FEED (below fold) ═══ */}
        <CommunityFeedSection data={data?.communityFeed || null} />

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
  );
}

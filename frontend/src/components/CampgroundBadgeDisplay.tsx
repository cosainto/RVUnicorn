import { useState, useEffect } from 'react';
import { Award, Sparkles, Lock } from 'lucide-react';
import api from '../services/api';

interface BadgeAward {
  id: string;
  awardedAt: string;
  campgroundBadge: {
    id: string;
    name: string;
    description: string;
    iconEmoji: string;
    backgroundColor: string;
    isLimitedEdition: boolean;
    maxIssues?: number;
    issuedCount: number;
    expiresAt?: string;
  };
}

export default function CampgroundBadgeDisplay({ campgroundId, userId }: { campgroundId: string; userId?: string }) {
  const [badges, setBadges] = useState<any[]>([]);
  const [myAwards, setMyAwards] = useState<BadgeAward[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [badgeRes, awardRes] = await Promise.all([
          api.get(`/campground-badges/${campgroundId}`),
          userId ? api.get(`/campground-badges/${campgroundId}/my-awards`).catch(() => ({ data: { awards: [] } })) : Promise.resolve({ data: { awards: [] } }),
        ]);
        setBadges((badgeRes.data.badges || []).filter((b: any) => b.status === 'APPROVED'));
        setMyAwards(awardRes.data.awards || []);
      } catch (e) {
        console.error('Load badges error:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [campgroundId, userId]);

  if (loading || badges.length === 0) return null;

  const hasEarned = (badgeId: string) => myAwards.some(a => a.campgroundBadge.id === badgeId);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
        <Award className="w-5 h-5 text-amber-500" />
        Campground Badges
        <span className="text-xs text-gray-400 font-normal">({badges.length})</span>
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {badges.map(badge => {
          const earned = hasEarned(badge.id);
          const soldOut = badge.isLimitedEdition && badge.maxIssues && badge.issuedCount >= badge.maxIssues;
          const expired = badge.isLimitedEdition && badge.expiresAt && new Date() > new Date(badge.expiresAt);

          return (
            <div key={badge.id} className={`text-center p-4 rounded-xl border transition ${
              earned ? 'border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50' : 'border-gray-100 bg-gray-50'
            }`}>
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl mx-auto border-4 shadow-md transition ${
                  earned ? '' : 'grayscale opacity-50'
                }`}
                style={earned ? { backgroundColor: badge.backgroundColor, borderColor: badge.backgroundColor, boxShadow: `0 0 15px ${badge.backgroundColor}30` } : { backgroundColor: '#e5e7eb', borderColor: '#d1d5db' }}
              >
                {earned ? badge.iconEmoji : <Lock className="w-6 h-6 text-gray-400" />}
              </div>
              <p className={`mt-2 text-sm font-semibold ${earned ? 'text-gray-900' : 'text-gray-400'}`}>{badge.name}</p>
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{badge.description}</p>
              {badge.isLimitedEdition && (
                <div className="mt-2">
                  {soldOut ? (
                    <span className="text-[10px] text-red-500 font-medium">Sold Out</span>
                  ) : expired ? (
                    <span className="text-[10px] text-gray-400 font-medium">Expired</span>
                  ) : (
                    <span className="text-[10px] text-amber-600 font-medium flex items-center justify-center gap-0.5">
                      <Sparkles className="w-3 h-3" />
                      {(badge.maxIssues || 0) - badge.issuedCount} of {badge.maxIssues} left
                    </span>
                  )}
                </div>
              )}
              {earned && (
                <p className="text-[10px] text-green-600 font-medium mt-1">✓ Earned</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

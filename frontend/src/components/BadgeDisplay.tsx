// BadgeDisplay.tsx
import ShareButton from './ShareButton';
import { useState, useEffect } from 'react';
import { Award, Lock, ChevronRight, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';

interface Badge {
  id: string;
  slug: string;
  name: string;
  description: string;
  imageUrl: string;
  category: string;
  requirement?: string;
  triggerValue?: number;
  earnedAt?: string;
}

interface BadgeDisplayProps {
  userId?: string;
  showAll?: boolean;
  limit?: number;
  compact?: boolean;
}

export default function BadgeDisplay({ userId, showAll = false, limit = 8, compact = false }: BadgeDisplayProps) {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [availableBadges, setAvailableBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);

  useEffect(() => {
    loadBadges();
  }, [userId]);

  const loadBadges = async () => {
    try {
      setLoading(true);
      
      if (userId) {
        const { data } = await api.get(`/badges/user/${userId}`);
        setBadges(data.badges || []);
      } else {
        const { data } = await api.get('/badges/my');
        setBadges(data.earned || []);
        setAvailableBadges(data.available || []);
      }
    } catch (error) {
      console.error('Load badges error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {badges.slice(0, limit).map((badge) => (
          <div
            key={badge.id}
            className="relative group cursor-pointer"
            onClick={() => setSelectedBadge(badge)}
          >
            <img
              src={badge.imageUrl}
              alt={badge.name}
              className="w-12 h-12 rounded-full object-cover border-2 border-amber-400 shadow-md hover:scale-110 transition-transform"
            />
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10">
              {badge.name}
            </div>
          </div>
        ))}
        {badges.length > limit && (
          <Link
            to={userId ? `/profile/${userId}#badges` : '/badges'}
            className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
          >
            +{badges.length - limit}
          </Link>
        )}
        
        {selectedBadge && (
          <BadgeModal badge={selectedBadge} onClose={() => setSelectedBadge(null)} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            Earned Badges ({badges.length})
          </h3>
          {!showAll && badges.length > limit && (
            <Link to="/badges" className="text-primary-600 hover:text-primary-700 text-sm flex items-center gap-1">
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          )}
        </div>

        {badges.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-6 text-center">
            <Award className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No badges earned yet</p>
            <p className="text-sm text-gray-400 mt-1">Complete activities to earn badges!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {(showAll ? badges : badges.slice(0, limit)).map((badge) => (
              <BadgeCard 
                key={badge.id} 
                badge={badge} 
                earned={true}
                onClick={() => setSelectedBadge(badge)}
              />
            ))}
          </div>
        )}
      </div>

      {!userId && showAll && availableBadges.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <Lock className="w-5 h-5 text-gray-400" />
            Available Badges ({availableBadges.length})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {availableBadges.map((badge) => (
              <BadgeCard 
                key={badge.id} 
                badge={badge} 
                earned={false}
                onClick={() => setSelectedBadge(badge)}
              />
            ))}
          </div>
        </div>
      )}

      {selectedBadge && (
        <BadgeModal 
          badge={selectedBadge} 
          earned={badges.some(b => b.id === selectedBadge.id)}
          onClose={() => setSelectedBadge(null)} 
        />
      )}
    </div>
  );
}

function BadgeCard({ badge, earned, onClick }: { badge: Badge; earned: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`relative bg-white rounded-xl p-4 border-2 cursor-pointer transition-all hover:shadow-lg ${
        earned 
          ? 'border-amber-300 hover:border-amber-400' 
          : 'border-gray-200 hover:border-gray-300 opacity-60'
      }`}
    >
      <div className="flex flex-col items-center text-center">
        <div className={`relative ${!earned && 'grayscale'}`}>
          <img
            src={badge.imageUrl}
            alt={badge.name}
            className="w-16 h-16 rounded-full object-cover"
          />
          {!earned && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-full">
              <Lock className="w-6 h-6 text-white" />
            </div>
          )}
        </div>
        <h4 className="font-semibold text-gray-900 mt-3 text-sm">{badge.name}</h4>
        {earned && badge.earnedAt && (
          <p className="text-xs text-gray-500 mt-1">
            Earned {new Date(badge.earnedAt).toLocaleDateString()}
          </p>
        )}
        {!earned && badge.requirement && (
          <p className="text-xs text-gray-400 mt-1">{badge.requirement}</p>
        )}
      </div>
      
      {earned && (
        <div className="absolute -top-2 -right-2 bg-amber-400 rounded-full p-1">
          <Award className="w-4 h-4 text-white" />
        </div>
      )}
    </div>
  );
}

function BadgeModal({ badge, earned = true, onClose }: { badge: Badge; earned?: boolean; onClose: () => void }) {
  const [progress, setProgress] = useState<{ current: number; required: number; percentage: number } | null>(null);

  useEffect(() => {
    if (!earned && badge.slug) {
      loadProgress();
    }
  }, [badge.slug, earned]);

  const loadProgress = async () => {
    try {
      const { data } = await api.get(`/badges/progress/${badge.slug}`);
      setProgress(data);
    } catch (error) {
      console.error('Load progress error:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <div className={`relative inline-block ${!earned && 'grayscale'}`}>
            <img
              src={badge.imageUrl}
              alt={badge.name}
              className="w-32 h-32 rounded-full object-cover mx-auto border-4 border-amber-400 shadow-lg"
            />
            {!earned && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-full">
                <Lock className="w-12 h-12 text-white" />
              </div>
            )}
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mt-4">{badge.name}</h2>
          <p className="text-gray-600 mt-2">{badge.description}</p>

          {earned && badge.earnedAt && (
            <div className="mt-4 bg-green-50 text-green-700 px-4 py-2 rounded-lg inline-block">
              <Award className="w-4 h-4 inline mr-2" />
              Earned on {new Date(badge.earnedAt).toLocaleDateString()}
            </div>
          )}

          {earned && (
            <ShareButton
              title={`I earned the ${badge.name} badge on RVUnicorn!`}
              text={`Just unlocked the "${badge.name}" badge on RVUnicorn! ${badge.description}`}
              url="/badges"
              variant="button"
              className="mt-3 w-full justify-center"
            />
          )}

          {!earned && (
            <div className="mt-4">
              <p className="text-sm text-gray-500 mb-2">{badge.requirement}</p>
              
              {progress && progress.required > 1 && (
                <div className="mt-3">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Progress</span>
                    <span>{progress.current} / {progress.required}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-gradient-to-r from-amber-400 to-amber-500 h-3 rounded-full transition-all"
                      style={{ width: `${progress.percentage}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <span
            className={`inline-block mt-4 px-3 py-1 rounded-full text-xs font-medium ${
              badge.category === 'SOCIAL' ? 'bg-blue-100 text-blue-700' :
              badge.category === 'CAMPING' ? 'bg-green-100 text-green-700' :
              badge.category === 'ACHIEVEMENT' ? 'bg-purple-100 text-purple-700' :
              'bg-gray-100 text-gray-700'
            }`}
          >
            {badge.category}
          </span>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-gray-700 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}

export { BadgeCard, BadgeModal };

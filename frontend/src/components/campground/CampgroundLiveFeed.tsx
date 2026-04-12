import { useState, useEffect, useCallback } from 'react';
import { Users, ChevronRight, Plus } from 'lucide-react';
import api from '../../services/api';

interface LiveFeedProps {
  campgroundId: string;
}

interface FeedItem {
  type: 'COMPLETION' | 'PLAN';
  id: string;
  timestamp: string;
  user?: { id: string; firstName: string; profilePicture?: string };
  activity?: { title: string; activityType: string };
  note?: string;
  photoUrls?: string[];
  organizer?: { id: string; firstName: string; profilePicture?: string };
  participantCount?: number;
  scheduledTime?: string;
  status?: string;
}

const ACTIVITY_EMOJI: Record<string, string> = {
  HIKE: '🥾', KAYAK: '🚣', SWIM: '🏊', FISH: '🎣', BIKE: '🚲',
  STARGAZING: '🔭', CAMPFIRE: '🔥', PHOTOGRAPHY: '📸',
  WILDLIFE: '🦅', OFFROAD: '🚗', SOCIAL: '👥', FOOD: '🍽️', OTHER: '🎯',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function CampgroundLiveFeed({ campgroundId }: LiveFeedProps) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [checkedInCount, setCheckedInCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadFeed = useCallback(async () => {
    try {
      const { data } = await api.get(`/actionable/campground/${campgroundId}/live-feed`);
      setItems(data.items || []);
      setCheckedInCount(data.checkedInCount || 0);
    } catch (e) {
      console.error('Failed to load live feed:', e);
    } finally {
      setLoading(false);
    }
  }, [campgroundId]);

  useEffect(() => {
    loadFeed();
    const interval = setInterval(loadFeed, 5 * 60 * 1000); // Poll every 5 min
    return () => clearInterval(interval);
  }, [loadFeed]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-gray-100 rounded-lg h-16" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
        <p className="text-gray-500 text-sm mb-3">
          Be the first to share what you're doing here →
        </p>
        <button className="inline-flex items-center gap-1.5 bg-campfire-500 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-campfire-600 transition-colors">
          <Plus size={16} /> Log Activity
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <h3 className="font-semibold text-gray-900">Live Activity</h3>
        {checkedInCount > 0 && (
          <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-medium">
            {checkedInCount} checked in
          </span>
        )}
      </div>

      {/* Feed items */}
      <div className="space-y-2">
        {items.map((item) => (
          <div key={`${item.type}-${item.id}`} className="bg-white rounded-lg border border-gray-100 p-3">
            {item.type === 'COMPLETION' && (
              <div>
                <div className="flex items-center gap-2">
                  {item.user?.profilePicture ? (
                    <img
                      src={item.user.profilePicture}
                      alt=""
                      className="w-7 h-7 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs">
                      {item.user?.firstName?.[0]}
                    </div>
                  )}
                  <span className="text-sm text-gray-600">
                    <span className="font-medium text-gray-900">{item.user?.firstName}</span> just completed
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-900 mt-1 ml-9">
                  {ACTIVITY_EMOJI[item.activity?.activityType || 'OTHER']}{' '}
                  {item.activity?.title} · {timeAgo(item.timestamp)}
                </p>
                {item.note && (
                  <p className="text-sm text-gray-600 italic mt-1 ml-9">"{item.note}"</p>
                )}
                {item.photoUrls && item.photoUrls.length > 0 && (
                  <div className="flex gap-1 mt-2 ml-9">
                    {item.photoUrls.slice(0, 3).map((url, i) => (
                      <img key={i} src={url} alt="" className="w-16 h-16 rounded-lg object-cover" />
                    ))}
                  </div>
                )}
              </div>
            )}

            {item.type === 'PLAN' && (
              <div>
                <div className="flex items-center gap-1.5">
                  <Users size={14} className="text-primary-600" />
                  <span className="text-sm font-medium text-primary-700">
                    {item.participantCount || 1} people planning
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-900 mt-1">
                  {ACTIVITY_EMOJI[item.activity?.activityType || 'OTHER']}{' '}
                  {item.activity?.title}
                  {item.scheduledTime && (
                    <span className="text-gray-500">
                      {' '}· {new Date(item.scheduledTime).toLocaleString([], {
                        weekday: 'short',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </p>
                {item.organizer && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    Organized by {item.organizer.firstName}
                  </p>
                )}
                <button className="mt-2 text-sm font-medium text-primary-600 hover:text-primary-700 flex items-center gap-0.5">
                  Join Them <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

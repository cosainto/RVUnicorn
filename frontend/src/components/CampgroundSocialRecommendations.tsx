import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

interface FriendStay {
  userId: string;
  username: string;
  avatarUrl: string | null;
  firstName: string | null;
  rating: number;
  tipQuote: string | null;
  stayDate: string;
}

interface WishlistFriend {
  userId: string;
  username: string;
  avatarUrl: string | null;
}

interface RigSimilar {
  userId: string;
  username: string;
  avatarUrl: string | null;
  rigClass: string;
  rating: number;
  tipQuote: string | null;
  isFollowing: boolean;
}

interface SocialRecData {
  friendStays: FriendStay[];
  wishlistFriends: WishlistFriend[];
  rigSimilar: RigSimilar[];
}

interface Props {
  campgroundId: string;
  isAdventure?: boolean;
  isNeon?: boolean;
}

export default function CampgroundSocialRecommendations({ campgroundId, isAdventure, isNeon }: Props) {
  const [data, setData] = useState<SocialRecData | null>(null);
  const [loading, setLoading] = useState(true);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());

  const dark = isAdventure || isNeon;

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }

    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(`/campground-features/${campgroundId}/social-recommendations`);
        if (!cancelled) {
          setData(res.data);
          const alreadyFollowing = new Set<string>(
            (res.data?.rigSimilar || []).filter((r: RigSimilar) => r.isFollowing).map((r: RigSimilar) => r.userId)
          );
          setFollowingIds(alreadyFollowing);
        }
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [campgroundId]);

  const handleFollow = async (userId: string) => {
    try {
      await api.post(`/friends/follow/${userId}`);
      setFollowingIds(prev => new Set(prev).add(userId));
    } catch { /* ignore */ }
  };

  if (loading) {
    return (
      <div className={`mb-4 rounded-lg p-4 animate-pulse ${dark ? 'bg-gray-800' : 'bg-gray-50'}`}>
        <div className={`h-5 w-48 rounded ${dark ? 'bg-gray-700' : 'bg-gray-200'} mb-3`} />
        <div className={`h-16 rounded ${dark ? 'bg-gray-700' : 'bg-gray-200'}`} />
      </div>
    );
  }

  if (!data) return null;
  const friendStays = data.friendStays || [];
  const wishlistFriends = data.wishlistFriends || [];
  const rigSimilar = data.rigSimilar || [];
  const hasContent = friendStays.length > 0 || wishlistFriends.length > 0 || rigSimilar.length > 0;
  if (!hasContent) return null;

  const textMain = dark ? 'text-gray-300' : 'text-gray-700';
  const textMuted = dark ? 'text-gray-400' : 'text-gray-500';
  const cardBg = isNeon ? 'bg-gray-900 border border-purple-500/30' : isAdventure ? 'bg-gray-800' : 'bg-white border border-gray-200';

  const Avatar = ({ url, name, size = 8 }: { url: string | null; name: string; size?: number }) => (
    <div className={`w-${size} h-${size} rounded-full bg-gray-300 overflow-hidden flex-shrink-0`}>
      {url ? <img src={url} alt={name} className="w-full h-full object-cover" /> : (
        <div className={`w-full h-full flex items-center justify-center text-xs font-bold ${dark ? 'bg-gray-600 text-gray-200' : 'bg-gray-300 text-gray-600'}`}>
          {name.charAt(0).toUpperCase()}
        </div>
      )}
    </div>
  );

  return (
    <div className={`mb-4 rounded-lg p-4 ${cardBg}`}>
      <h3 className={`text-base font-bold mb-3 ${dark ? 'text-white' : 'text-gray-900'}`}>
        👥 From Your Network
      </h3>

      {/* Friends who stayed */}
      {friendStays.length > 0 && (
        <div className="mb-3">
          <p className={`text-xs font-semibold uppercase mb-2 ${textMuted}`}>Friends Who Stayed</p>
          <div className="space-y-2">
            {friendStays.map(f => (
              <div key={f.userId} className="flex items-start gap-2">
                <Link to={`/profile/${f.username}`}><Avatar url={f.avatarUrl} name={f.firstName || f.username} /></Link>
                <div className="flex-1 min-w-0">
                  <Link to={`/profile/${f.username}`} className={`text-sm font-medium hover:underline ${dark ? 'text-white' : 'text-gray-900'}`}>
                    {f.firstName || f.username}
                  </Link>
                  <span className={`text-xs ml-2 ${textMuted}`}>⭐{f.rating}/5 · {new Date(f.stayDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                  {f.tipQuote && <p className={`text-xs mt-0.5 italic truncate ${textMain}`}>"{f.tipQuote}"</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Friends who wishlisted */}
      {wishlistFriends.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-1">
            <div className="flex -space-x-2">
              {wishlistFriends.slice(0, 4).map(w => (
                <div key={w.userId} className="w-6 h-6 rounded-full border-2 border-white overflow-hidden">
                  <Avatar url={w.avatarUrl} name={w.username} size={6} />
                </div>
              ))}
            </div>
            <span className={`text-xs ml-1 ${textMuted}`}>
              {wishlistFriends.length === 1
                ? `${wishlistFriends[0].username} wants to visit`
                : wishlistFriends.length <= 4
                  ? `${wishlistFriends.length} friends want to visit`
                  : `${wishlistFriends.slice(0, 3).map(w => w.username).join(', ')} + ${wishlistFriends.length - 3} more want to visit`}
            </span>
          </div>
        </div>
      )}

      {/* Rig-similar recommendations */}
      {rigSimilar.length > 0 && (
        <div>
          <p className={`text-xs font-semibold uppercase mb-2 ${textMuted}`}>Similar Rigs Recommend</p>
          <div className="space-y-2">
            {rigSimilar.map(r => (
              <div key={r.userId} className="flex items-start gap-2">
                <Link to={`/profile/${r.username}`}><Avatar url={r.avatarUrl} name={r.username} /></Link>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Link to={`/profile/${r.username}`} className={`text-sm font-medium hover:underline ${dark ? 'text-white' : 'text-gray-900'}`}>@{r.username}</Link>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">{r.rigClass}</span>
                    <span className={`text-xs ${textMuted}`}>⭐{r.rating}/5</span>
                  </div>
                  {r.tipQuote && <p className={`text-xs mt-0.5 italic truncate ${textMain}`}>"{r.tipQuote}"</p>}
                </div>
                {!followingIds.has(r.userId) && (
                  <button
                    onClick={() => handleFollow(r.userId)}
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full border flex-shrink-0 ${
                      isNeon ? 'border-purple-500 text-purple-400 hover:bg-purple-500/20'
                        : dark ? 'border-gray-500 text-gray-300 hover:bg-gray-700'
                          : 'border-gray-300 text-gray-600 hover:bg-gray-100'
                    }`}
                  >Follow</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

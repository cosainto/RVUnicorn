import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, ChevronRight, UserPlus } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface FavoritedByUser {
  userId: string;
  username: string;
  avatarUrl: string | null;
  firstName: string | null;
  rigName: string | null;
  rigSlug: string | null;
  isFriend: boolean;
}

interface RigVisitor {
  rigId: string;
  rigSlug: string;
  rigName: string | null;
  rigEmoji: string | null;
  coverPhotoUrl: string | null;
  ownerUsername: string;
  ownerAvatarUrl: string | null;
  visitedAt: string;
  photoCount: number;
  stopPhotoUrls: string[];
}

interface SocialProofData {
  favoritedBy: FavoritedByUser[];
  rigVisitors: RigVisitor[];
  totalFavorites: number;
  totalRigVisitors: number;
  friendsWhoFavorited: { userId: string; username: string; avatarUrl: string | null; firstName: string | null }[];
}

export default function CampgroundSocialProof({ campgroundId }: { campgroundId: string }) {
  const [data, setData] = useState<SocialProofData | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(`/campgrounds/${campgroundId}/social-proof`);
        if (!cancelled) setData(res.data);
      } catch {
        // Silently fail — social proof is non-critical
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [campgroundId]);

  if (loading || !data) return null;
  // Ensure all arrays are safe — API may omit fields
  if (!data.favoritedBy) data.favoritedBy = [];
  if (!data.rigVisitors) data.rigVisitors = [];
  if (!data.friendsWhoFavorited) data.friendsWhoFavorited = [];
  if (data.totalFavorites === 0 && data.totalRigVisitors === 0) return null;

  const formatVisitDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  return (
    <div className="space-y-5">
      {/* ── WHO LOVES THIS PLACE ── */}
      {data.totalFavorites > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ background: '#0F1C35', border: '1px solid rgba(232,168,56,0.12)' }}>
          <div className="p-4">
            {/* Friends callout */}
            {data.friendsWhoFavorited.length > 0 && (
              <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(232,168,56,0.08)' }}>
                <span className="text-xs font-bold" style={{ color: '#E8A838' }}>Your friends love this place</span>
                <div className="flex -space-x-2 ml-1">
                  {data.friendsWhoFavorited.slice(0, 3).map(f => (
                    <Link key={f.userId} to={`/profile/${f.username}`}>
                      {f.avatarUrl ? (
                        <img src={f.avatarUrl} alt={f.username} className="w-7 h-7 rounded-full object-cover border-2" style={{ borderColor: '#0F1C35' }} />
                      ) : (
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2" style={{ borderColor: '#0F1C35', background: 'rgba(232,168,56,0.2)', color: '#E8A838' }}>
                          {f.firstName?.[0] || '?'}
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
                {data.friendsWhoFavorited.length > 3 && (
                  <span className="text-[11px] ml-1" style={{ color: 'rgba(245,240,232,0.5)' }}>+{data.friendsWhoFavorited.length - 3} more</span>
                )}
              </div>
            )}

            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
              <Heart className="w-4 h-4" style={{ color: '#ef4444' }} fill="#ef4444" />
              <span className="text-sm font-semibold" style={{ color: '#F5F0E8' }}>
                {data.totalFavorites} {data.totalFavorites === 1 ? 'camper has' : 'campers have'} favorited this campground
              </span>
            </div>

            {/* Avatar strip */}
            <div className="flex items-center">
              <div className="flex -space-x-2">
                {data.favoritedBy.slice(0, 8).map(f => (
                  <Link key={f.userId} to={`/profile/${f.username}`} title={f.username} className="relative group">
                    {f.avatarUrl ? (
                      <img src={f.avatarUrl} alt={f.username} className="w-10 h-10 rounded-full object-cover border-2 hover:scale-110 transition-transform" style={{ borderColor: f.isFriend ? '#E8A838' : '#0F1C35' }} />
                    ) : (
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold border-2 hover:scale-110 transition-transform" style={{ borderColor: f.isFriend ? '#E8A838' : '#0F1C35', background: 'rgba(232,168,56,0.15)', color: '#E8A838' }}>
                        {f.firstName?.[0] || '?'}
                      </div>
                    )}
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" style={{ background: '#1a2d4a', color: '#F5F0E8' }}>
                      {f.username}{f.rigName ? ` · ${f.rigName}` : ''}
                    </div>
                  </Link>
                ))}
              </div>
              {data.totalFavorites > 8 && (
                <span className="ml-3 text-xs font-medium" style={{ color: 'rgba(245,240,232,0.5)' }}>
                  +{data.totalFavorites - 8} more
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── RIGS THAT HAVE VISITED ── */}
      {data.rigVisitors.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ background: '#0F1C35', border: '1px solid rgba(232,168,56,0.12)' }}>
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">{'\u{1F690}'}</span>
                <span className="text-sm font-semibold" style={{ color: '#F5F0E8' }}>
                  Rigs that have stayed here
                </span>
              </div>
              {data.totalRigVisitors > 8 && (
                <span className="text-xs flex items-center gap-1 cursor-pointer" style={{ color: '#E8A838' }}>
                  See all {data.totalRigVisitors} <ChevronRight className="w-3 h-3" />
                </span>
              )}
            </div>

            {/* Horizontal scroll row */}
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
              {data.rigVisitors.map(rig => (
                <div
                  key={`${rig.rigId}-${rig.visitedAt}`}
                  className="flex-shrink-0 w-48 rounded-xl overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform"
                  style={{ background: '#1a2d4a', border: '1px solid rgba(255,255,255,0.06)' }}
                  onClick={() => navigate(`/rig/${rig.rigSlug}`)}
                >
                  {/* Photo area */}
                  <div className="h-28 relative">
                    {rig.stopPhotoUrls.length > 0 ? (
                      rig.stopPhotoUrls.length >= 3 ? (
                        <div className="grid grid-cols-2 grid-rows-2 h-full gap-0.5">
                          <img src={rig.stopPhotoUrls[0]} alt="" className="col-span-2 row-span-1 w-full h-full object-cover" />
                          <img src={rig.stopPhotoUrls[1]} alt="" className="w-full h-full object-cover" />
                          <img src={rig.stopPhotoUrls[2]} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <img src={rig.stopPhotoUrls[0]} alt="" className="w-full h-full object-cover" />
                      )
                    ) : rig.coverPhotoUrl ? (
                      <div className="relative w-full h-full">
                        <img src={rig.coverPhotoUrl} alt="" className="w-full h-full object-cover opacity-60" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-3xl">{rig.rigEmoji || '\u{1F690}'}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center" style={{ background: 'rgba(232,168,56,0.08)' }}>
                        <span className="text-3xl">{rig.rigEmoji || '\u{1F690}'}</span>
                      </div>
                    )}
                    {rig.photoCount > 0 && (
                      <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-medium" style={{ background: 'rgba(0,0,0,0.7)', color: '#fff' }}>
                        {rig.photoCount} photo{rig.photoCount !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-sm">{rig.rigEmoji || '\u{1F690}'}</span>
                      <span className="text-xs font-semibold truncate" style={{ color: '#F5F0E8' }}>
                        {rig.rigName || 'Unnamed Rig'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      {rig.ownerAvatarUrl ? (
                        <img src={rig.ownerAvatarUrl} alt="" className="w-4 h-4 rounded-full object-cover" />
                      ) : (
                        <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px]" style={{ background: 'rgba(232,168,56,0.2)', color: '#E8A838' }}>?</div>
                      )}
                      <span className="text-[11px] truncate" style={{ color: 'rgba(200,192,176,0.7)' }}>
                        {rig.ownerUsername}
                      </span>
                    </div>
                    <div className="text-[10px]" style={{ color: 'rgba(200,192,176,0.5)' }}>
                      Stayed {formatVisitDate(rig.visitedAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {data.rigVisitors.length === 0 && (
              <div className="text-center py-6">
                <span className="text-sm" style={{ color: 'rgba(200,192,176,0.5)' }}>
                  Be the first rig to share photos from this campground!
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Truck, MapPin } from 'lucide-react';
import api from '../../services/api';

const CN = { bg: '#0F1C35', body: '#1E2D42', card: '#162236', gold: '#E8A838', cream: '#F5F0E8', muted: '#8B9BB4', border: '#243552' };

export default function ProfileFriendsPage() {
  const { username } = useParams<{ username: string }>();
  const [friends, setFriends] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!username) return;
    Promise.all([
      api.get(`/profile/${username}/friends`).catch(() => ({ data: [] })),
      api.get(`/profile/${username}`).catch(() => ({ data: null })),
    ]).then(([friendsRes, profileRes]) => {
      setFriends(Array.isArray(friendsRes.data) ? friendsRes.data : (friendsRes.data?.friends || []));
      setProfile(profileRes.data);
      setLoading(false);
    });
  }, [username]);

  return (
    <>
      <Helmet>
        <title>{profile?.firstName || username}'s Friends · RVUnicorn</title>
      </Helmet>

      <div style={{ background: CN.body, minHeight: '100vh', color: CN.cream }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-2">
            <Link to={`/profile/${username}`} className="p-2 rounded-lg transition hover:bg-white/5" style={{ color: CN.muted }}>
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>
              {profile?.firstName || username}'s Fellow Campers
            </h1>
          </div>

          <p className="text-xs mb-6 ml-12" style={{ color: CN.muted }}>
            {friends.length} friend{friends.length !== 1 ? 's' : ''}
          </p>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[0, 1, 2, 3, 4, 5].map(i => (
                <div key={i} className="rounded-xl p-4" style={{ background: CN.card }}>
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-full animate-pulse" style={{ background: CN.border }} />
                    <div className="space-y-2 flex-1">
                      <div className="h-4 w-24 rounded animate-pulse" style={{ background: CN.border }} />
                      <div className="h-3 w-32 rounded animate-pulse" style={{ background: CN.border }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : friends.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-lg font-semibold mb-2">No friends yet</p>
              <Link to="/friends" className="inline-block px-6 py-3 rounded-xl text-sm font-bold" style={{ background: CN.gold, color: CN.bg }}>
                Find Friends
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {friends.map((f: any) => (
                <Link
                  key={f.id || f.userId}
                  to={`/profile/${f.username}`}
                  className="rounded-xl p-4 transition hover:brightness-110"
                  style={{ background: CN.card, border: `1px solid ${CN.border}` }}
                >
                  <div className="flex items-center gap-3">
                    {f.profilePicture ? (
                      <img src={f.profilePicture} alt="" className="w-14 h-14 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0" style={{ background: CN.gold, color: CN.bg }}>
                        {f.firstName?.[0]}{f.lastName?.[0]}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate" style={{ color: CN.cream }}>
                        {f.firstName} {f.lastName}
                      </p>
                      {(f.rvType || f.rvModel) && (
                        <p className="text-[11px] flex items-center gap-1 truncate" style={{ color: CN.muted }}>
                          <Truck className="w-3 h-3 flex-shrink-0" />
                          {f.rvType?.replace('_', ' ')}{f.rvModel ? ` · ${f.rvModel}` : ''}
                        </p>
                      )}
                      {f.stateCount > 0 && (
                        <p className="text-[10px] flex items-center gap-1" style={{ color: CN.muted }}>
                          <MapPin className="w-2.5 h-2.5" /> {f.stateCount} states
                        </p>
                      )}
                      {f.mutualFriendCount > 0 && (
                        <p className="text-[10px] mt-0.5" style={{ color: CN.gold }}>
                          {f.mutualFriendCount} mutual friend{f.mutualFriendCount !== 1 ? 's' : ''}
                        </p>
                      )}
                      {f.friendSince && (
                        <p className="text-[9px] mt-0.5" style={{ color: CN.muted }}>
                          Friends since {new Date(f.friendSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

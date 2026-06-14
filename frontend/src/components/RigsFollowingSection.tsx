import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Truck, Heart, Loader2, ChevronRight } from 'lucide-react';
import api from '../services/api';

interface FollowedRig {
  id: string;
  slug: string;
  rigName?: string;
  heroPhoto?: string;
  year?: number;
  make?: string;
  model?: string;
  rigClass?: string;
  followerCount: number;
  totalTripCount?: number;
  totalStatesCount?: number;
  followedAt: string;
  owner: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture?: string;
  };
}

interface RigsFollowingSectionProps {
  userId: string;
  isOwnProfile: boolean;
  className?: string;
}

export default function RigsFollowingSection({ userId, isOwnProfile, className = '' }: RigsFollowingSectionProps) {
  const [rigs, setRigs] = useState<FollowedRig[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadFollowingRigs();
  }, [userId]);

  const loadFollowingRigs = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/rigs/user/${userId}/following?limit=6`);
      setRigs(data.rigs || []);
      setTotal(data.total || 0);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`rounded-2xl p-6 ${className}`} style={{ background: '#162236', border: '1px solid #243552' }}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#E8A838' }} />
        </div>
      </div>
    );
  }

  if (rigs.length === 0) return null;

  return (
    <div className={`rounded-2xl p-6 ${className}`} style={{ background: '#162236', border: '1px solid #243552' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold flex items-center gap-2" style={{ color: '#F5F0E8' }}>
          <Heart className="w-5 h-5" style={{ color: '#E8A838' }} />
          Rigs Following
        </h3>
        <span className="text-sm" style={{ color: '#8B9BB4' }}>{total} rig{total !== 1 ? 's' : ''}</span>
      </div>

      <div className="space-y-3">
        {rigs.map((rig) => {
          const rigTitle = rig.rigName || [rig.year, rig.make, rig.model].filter(Boolean).join(' ') || 'Unnamed Rig';
          return (
            <Link
              key={rig.id}
              to={`/rig/${rig.slug}`}
              className="flex items-center gap-3 p-3 rounded-xl transition hover:brightness-110 group"
              style={{ background: '#1A2A45', border: '1px solid #243552' }}
            >
              {rig.heroPhoto ? (
                <img src={rig.heroPhoto} alt={rigTitle} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(232,168,56,0.12)' }}>
                  <Truck className="w-6 h-6" style={{ color: '#E8A838' }} />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate group-hover:text-[#E8A838] transition" style={{ color: '#F5F0E8' }}>
                  {rigTitle}
                </p>
                <p className="text-[11px] truncate" style={{ color: '#8B9BB4' }}>
                  by {rig.owner.firstName} {rig.owner.lastName?.[0] ? rig.owner.lastName[0] + '.' : ''}
                </p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-[10px]" style={{ color: '#8B9BB4' }}>{rig.followerCount} follower{rig.followerCount !== 1 ? 's' : ''}</span>
                  {rig.totalTripCount ? <span className="text-[10px]" style={{ color: '#8B9BB4' }}>{rig.totalTripCount} trips</span> : null}
                  {rig.totalStatesCount ? <span className="text-[10px]" style={{ color: '#8B9BB4' }}>{rig.totalStatesCount} states</span> : null}
                </div>
              </div>

              <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: '#8B9BB4' }} />
            </Link>
          );
        })}
      </div>

      {total > 6 && (
        <Link
          to={isOwnProfile ? '/following-rigs' : '#'}
          className="block text-center text-xs mt-4 py-2 transition hover:brightness-110"
          style={{ color: '#E8A838' }}
        >
          View all {total} rigs →
        </Link>
      )}
    </div>
  );
}

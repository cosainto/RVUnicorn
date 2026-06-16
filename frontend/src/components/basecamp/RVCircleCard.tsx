import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

const CN = { bg: '#0F1C35', card: '#162236', cardAlt: '#1A2A45', gold: '#E8A838', orange: '#D4621A', cream: '#F5F0E8', muted: '#8B9BB4', border: '#243552' };

const TYPE_EMOJI: Record<string, string> = { PHOTO_UPLOAD: '\u{1F4F8}', CHECKIN: '\u{1F3D5}\uFE0F', NEW_CAMPSITE: '\u2B50', RIG_UPDATE: '\u{1F690}', RECIPE: '\u{1F373}', MOD: '\u{1F527}' };

export interface RVCircleItem {
  type: string;
  actorRigName: string;
  actorRigSlug: string;
  actorOwnerAvatar: string | null;
  description: string;
  previewImageUrl: string | null;
  location: string | null;
  occurredAt: string;
  navigateTo: string;
}

export interface NearbyRig {
  rigName: string;
  rigSlug: string;
  ownerUsername: string;
  ownerAvatar: string | null;
  distanceMiles: number;
  currentLocation: string;
}

interface Props {
  items: RVCircleItem[];
  nearbyRigs: NearbyRig[];
}

export default function RVCircleCard(props: Props | null) {
  const [expanded, setExpanded] = useState(false);

  // Loading skeleton
  if (props === null) {
    return (
      <div className="rounded-2xl overflow-hidden" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
        <div className="p-4 space-y-3">
          <div className="h-5 w-40 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.08)' }} />
          <div className="h-3 w-56 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.05)' }} />
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full animate-pulse" style={{ background: 'rgba(255,255,255,0.08)' }} />
              <div className="flex-1 space-y-1">
                <div className="h-3 w-32 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.08)' }} />
                <div className="h-2 w-48 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.05)' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const { items, nearbyRigs } = props;

  // Empty state
  if (items.length === 0 && nearbyRigs.length === 0) {
    return (
      <div className="rounded-2xl overflow-hidden text-center" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
        <div className="p-6">
          <p className="text-sm font-semibold" style={{ color: CN.cream }}>Your RV Circle is quiet right now</p>
          <p className="text-xs mt-1" style={{ color: CN.muted }}>Follow some rigs to see what they're up to!</p>
          <Link to="/explore" className="inline-block mt-3 px-4 py-1.5 rounded-full text-xs font-bold" style={{ background: CN.gold, color: CN.bg }}>
            Explore Rigs
          </Link>
        </div>
      </div>
    );
  }

  const visibleCount = expanded ? 8 : 5;
  const visibleItems = items.slice(0, visibleCount);
  const canExpand = items.length > 5 && !expanded;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: CN.card, border: `1px solid ${CN.border}`, maxHeight: expanded ? 'none' : 250, overflow: 'hidden' }}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-0.5">
          <p className="text-sm font-bold" style={{ color: CN.cream }}>{'\u{1F465}'} Your RV Circle</p>
          {items.length > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${CN.gold}22`, color: CN.gold }}>{items.length} updates</span>
          )}
        </div>
        <p className="text-xs mb-3" style={{ color: CN.muted }}>What your RV community is up to</p>

        {/* Feed items */}
        <div className="space-y-1">
          {visibleItems.map((item, i) => (
            <Link key={i} to={item.navigateTo} className="flex items-center gap-2.5 rounded-lg px-2 py-1 transition hover:bg-white/5" style={{ height: 48 }}>
              {item.actorOwnerAvatar ? (
                <img src={item.actorOwnerAvatar} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm" style={{ background: CN.cardAlt, color: CN.gold }}>
                  {item.actorRigName[0]}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs truncate" style={{ color: CN.cream }}>
                  <span className="font-bold">{TYPE_EMOJI[item.type] || ''} {item.actorRigName}</span>{' '}
                  <span style={{ color: CN.muted }}>{item.description}</span>
                </p>
                <p className="text-[10px]" style={{ color: CN.muted }}>{formatDistanceToNow(new Date(item.occurredAt), { addSuffix: true })}</p>
              </div>
              {item.previewImageUrl && (
                <img src={item.previewImageUrl} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
              )}
            </Link>
          ))}
        </div>

        {/* Expand / collapse */}
        {canExpand && (
          <button onClick={() => setExpanded(true)} className="w-full text-center text-xs font-semibold mt-2 py-1 rounded-lg transition hover:bg-white/5" style={{ color: CN.gold }}>
            See all
          </button>
        )}
        {expanded && items.length > 5 && (
          <button onClick={() => setExpanded(false)} className="w-full text-center text-xs font-semibold mt-2 py-1 rounded-lg transition hover:bg-white/5" style={{ color: CN.muted }}>
            Show less
          </button>
        )}

        {/* Nearby rigs */}
        {nearbyRigs.length > 0 && (
          <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${CN.border}` }}>
            <p className="text-xs font-bold mb-2" style={{ color: CN.cream }}>{'\u{1F4CD}'} Nearby right now</p>
            <div className="space-y-1">
              {nearbyRigs.map((rig, i) => (
                <Link key={i} to={`/rigs/${rig.rigSlug}`} className="flex items-center gap-2 rounded-lg px-2 py-1 transition hover:bg-white/5">
                  {rig.ownerAvatar ? (
                    <img src={rig.ownerAvatar} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ background: CN.cardAlt, color: CN.gold }}>
                      {rig.rigName[0]}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: CN.cream }}>{rig.rigName}</p>
                    <p className="text-[10px]" style={{ color: CN.muted }}>{rig.currentLocation}</p>
                  </div>
                  <span className="text-[10px] font-semibold flex-shrink-0" style={{ color: CN.gold }}>{rig.distanceMiles} mi</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

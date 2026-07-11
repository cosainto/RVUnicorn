import { Link } from 'react-router-dom';

const CN = { bg: '#0F1C35', card: '#162236', cardAlt: '#1A2A45', gold: '#E8A838', orange: '#D4621A', cream: '#F5F0E8', muted: '#8B9BB4', border: '#243552' };

const TYPE_EMOJI: Record<string, string> = { campground: '\u{1F3D5}\uFE0F', recipe: '\u{1F373}', trail: '\u{1F6B6}', mod: '\u{1F527}', rig: '\u{1F690}' };

export interface DiscoverData {
  cardType: string;
  title: string;
  subtitle: string;
  items: { id: string; name: string; imageUrl: string | null; type: string; distance?: number; friendCount?: number; rating?: number; reviewCount?: number }[];
  reason: string;
}

interface Props {
  data: DiscoverData | null;
}

function itemLink(type: string, id: string): string {
  if (type === 'recipe') return `/recipes/${id}`;
  return `/campgrounds/${id}`;
}

function contextLabel(item: DiscoverData['items'][number]): string {
  if (item.rating != null) {
    const ratingStr = typeof item.rating === 'number' ? item.rating.toFixed(1) : item.rating;
    if (item.reviewCount) return `${ratingStr} \u2B50 (${item.reviewCount})`;
    return `${ratingStr} \u2B50`;
  }
  if (item.friendCount != null) return `${item.friendCount} friends saved`;
  if (item.distance != null) return `${item.distance} mi away`;
  return '';
}

export default function DiscoverCardV2({ data }: Props) {
  // Loading skeleton
  if (data === null) {
    return (
      <div className="rounded-2xl overflow-hidden" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
        <div className="h-1 rounded-t-2xl" style={{ background: `linear-gradient(90deg, ${CN.gold}44, ${CN.orange}44)` }} />
        <div className="p-4 space-y-3">
          <div className="h-4 w-44 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.08)' }} />
          <div className="h-3 w-56 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.05)' }} />
          <div className="flex gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-[100px] flex-shrink-0 space-y-1.5">
                <div className="w-full aspect-[4/3] rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.08)' }} />
                <div className="h-3 w-16 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.05)' }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
      {/* Gradient accent */}
      <div className="h-1 rounded-t-2xl" style={{ background: `linear-gradient(90deg, ${CN.gold}66, ${CN.orange}66)` }} />

      <div className="p-4">
        {/* Title */}
        <p className="text-sm font-bold" style={{ color: CN.cream }}>{data.title}</p>
        <p className="text-xs mb-3" style={{ color: CN.muted }}>{data.subtitle}</p>

        {/* Horizontal scroll row */}
        <div className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}>
          {(data.items || []).map(item => (
            <Link key={item.id} to={itemLink(item.type, item.id)} className="flex-shrink-0 transition hover:opacity-80" style={{ width: 100 }}>
              {item.imageUrl ? (
                <img src={item.imageUrl} alt="" className="w-full rounded-xl object-cover" style={{ height: 70 }} />
              ) : (
                <div className="w-full rounded-xl flex items-center justify-center text-2xl" style={{ height: 70, background: CN.cardAlt }}>
                  {TYPE_EMOJI[item.type] || '\u{1F4CC}'}
                </div>
              )}
              <p className="text-xs mt-1 font-medium leading-tight" style={{ color: CN.cream, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {item.name}
              </p>
              {contextLabel(item) && (
                <p className="text-[10px] mt-0.5" style={{ color: CN.muted }}>{contextLabel(item)}</p>
              )}
            </Link>
          ))}
        </div>

        {/* Footer */}
        <p className="text-[10px] mt-3 text-right" style={{ color: `${CN.muted}99` }}>Powered by Hitch {'\u2728'}</p>
      </div>
    </div>
  );
}

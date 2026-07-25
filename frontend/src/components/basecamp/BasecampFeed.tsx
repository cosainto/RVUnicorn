/**
 * BasecampFeed — restructured feed with desktop sidebar.
 * Desktop: two-column layout (sidebar + network feed)
 * Mobile: tabbed Network / Community
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, ThumbsUp, Users, Sparkles, MapPin } from 'lucide-react';
import api from '../../services/api';
import RigPostFeedCard from '../feed/RigPostFeedCard';

const CN = {
  bg: '#0F1C35', card: '#162236', cardAlt: '#1A2A45',
  gold: '#E8A838', orange: '#D4621A', cream: '#F5F0E8',
  muted: '#8B9BB4', border: '#243552',
};

interface FeedItem {
  postId: string;
  type: string;
  authorUsername: string;
  authorFirstName?: string;
  authorAvatar: string | null;
  isSystem?: boolean;
  preview: string;
  body?: string;
  imageUrl?: string | null;
  likeCount: number;
  commentCount: number;
  createdAt?: string;
  isTrending?: boolean;
  campgroundId?: string;
  campgroundName?: string;
  placeId?: string;
  placeName?: string;
  rigSlug?: string;
  rigName?: string;
  rigPhoto?: string;
  rigId?: string;
  photos?: string[];
  postType?: string;
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function Avatar({ src, name, size = 6 }: { src?: string | null; name?: string; size?: number }) {
  const letter = name?.[0]?.toUpperCase() || '?';
  const px = size * 4;
  if (src) return <img src={src} className="rounded-full object-cover" alt="" style={{ width: px, height: px }} />;
  return (
    <div className="rounded-full flex items-center justify-center font-bold"
      style={{ width: px, height: px, background: CN.border, color: CN.gold, fontSize: px * 0.4 }}>
      {letter}
    </div>
  );
}

function resolveLink(item: FeedItem): string {
  if (item.campgroundId) return `/campgrounds/${item.campgroundId}`;
  if (item.placeId) return `/place/${item.placeId}`;
  if (item.rigSlug) return `/rig/${item.rigSlug}`;
  return '/community';
}

/* ══════════════════════════════════════════════════════════════════
   FEED CARD — fixed photo aspect ratio (max 4:3)
   ══════════════════════════════════════════════════════════════════ */
function FeedCard({ item }: { item: FeedItem }) {
  const hasImage = !!item.imageUrl;
  const href = resolveLink(item);
  const locationName = item.placeName || item.campgroundName;
  const locationLink = item.placeId ? `/place/${item.placeId}` : item.campgroundId ? `/campgrounds/${item.campgroundId}` : null;

  return (
    <div className="cartoon-card" style={{ background: CN.card, maxWidth: 680 }}>
      {/* Author row */}
      <div className="flex items-center gap-2.5 px-4 pt-3 pb-2">
        <Avatar src={item.authorAvatar} name={item.authorFirstName || item.authorUsername} size={8} />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold" style={{ color: CN.cream }}>
            {item.authorFirstName || item.authorUsername}
          </span>
          {locationName ? (
            <span className="text-xs" style={{ color: CN.muted }}>
              {' '}shared a photo at{' '}
              {locationLink ? (
                <Link to={locationLink} className="font-semibold hover:underline" style={{ color: CN.gold }}>{locationName}</Link>
              ) : locationName}
            </span>
          ) : item.type === 'photo' ? (
            <span className="text-xs" style={{ color: CN.muted }}> shared a photo</span>
          ) : null}
        </div>
        {item.createdAt && <span className="text-[10px] flex-shrink-0" style={{ color: CN.muted }}>{timeAgo(item.createdAt)}</span>}
      </div>

      {/* Photo — max 4:3 aspect, no letterbox strips */}
      {hasImage && (
        <Link to={href} className="block">
          <div style={{ maxHeight: 510, overflow: 'hidden' }}>
            <img
              src={item.imageUrl!}
              alt=""
              loading="lazy"
              className="w-full"
              style={{ objectFit: 'cover', maxHeight: 510, width: '100%', aspectRatio: '4/3' }}
              data-feed-photo="true"
              data-photo-index="0"
              data-all-photos={JSON.stringify([item.imageUrl])}
            />
          </div>
        </Link>
      )}

      {/* Location line */}
      {locationName && !hasImage && locationLink && (
        <div className="px-4 pb-1">
          <Link to={locationLink} className="inline-flex items-center gap-1 text-xs hover:underline" style={{ color: CN.gold }}>
            <MapPin style={{ width: 12, height: 12 }} /> {locationName}
          </Link>
        </div>
      )}

      {/* Preview text */}
      {item.preview && (
        <div className="px-4 py-2">
          <p className="text-sm line-clamp-3" style={{ color: CN.cream }}>{item.preview}</p>
        </div>
      )}

      {/* Engagement row */}
      <div className="flex items-center gap-4 px-4 pb-3 pt-1" style={{ borderTop: `1px solid ${CN.border}` }}>
        {item.likeCount > 0 && (
          <span className="flex items-center gap-1 text-xs" style={{ color: CN.muted }}>
            <ThumbsUp className="w-3.5 h-3.5" /> {item.likeCount}
          </span>
        )}
        {item.commentCount > 0 && (
          <span className="flex items-center gap-1 text-xs" style={{ color: CN.muted }}>
            <MessageCircle className="w-3.5 h-3.5" /> {item.commentCount}
          </span>
        )}
        {item.isTrending && (
          <span className="flex items-center gap-1 text-xs" style={{ color: CN.orange }}>
            <Sparkles className="w-3.5 h-3.5" /> Trending
          </span>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   COMMUNITY SIDEBAR (desktop only)
   ══════════════════════════════════════════════════════════════════ */
function CommunitySidebar({ items }: { items: FeedItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="cartoon-card mb-4" style={{ background: CN.card }}>
      <div className="flex items-center justify-between px-4 pt-3 pb-2" style={{ borderBottom: `1px solid ${CN.border}` }}>
        <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: CN.gold }}>
          <MessageCircle className="w-3.5 h-3.5 inline mr-1" /> Community
        </h3>
        <Link to="/community" className="text-[10px] font-semibold" style={{ color: CN.gold }}>See all</Link>
      </div>
      <div className="p-2 space-y-0.5">
        {items.slice(0, 8).map(item => (
          <Link key={item.postId} to={resolveLink(item)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition hover:brightness-110" style={{ background: CN.cardAlt }}>
            <Avatar src={item.authorAvatar} name={item.authorFirstName} size={5} />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] truncate" style={{ color: CN.cream }}>
                <span className="font-semibold">{item.authorFirstName || item.authorUsername}</span>{' '}
                <span style={{ color: CN.muted }}>{item.preview?.slice(0, 50)}</span>
              </p>
            </div>
            {item.createdAt && <span className="text-[9px] flex-shrink-0" style={{ color: CN.muted }}>{timeAgo(item.createdAt)}</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   FAVORITES SIDEBAR (wishlist)
   ══════════════════════════════════════════════════════════════════ */
function FavoritesSidebar() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dream-trips/stops')
      .then(res => setItems(Array.isArray(res.data) ? res.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="cartoon-card" style={{ background: CN.card }}>
      <div className="flex items-center justify-between px-4 pt-3 pb-2" style={{ borderBottom: `1px solid ${CN.border}` }}>
        <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: CN.gold }}>
          <img src="/images/genie-icon-v2.png" alt="" className="w-4 h-4 inline mr-1" style={{ objectFit: 'contain' }} /> Favorite Campsites
        </h3>
      </div>
      <div className="p-2">
        {loading && <div className="h-16 animate-pulse rounded-lg" style={{ background: CN.border }} />}
        {!loading && items.length === 0 && (
          <div className="text-center py-4 px-2">
            <img src="/images/genie-full-v2.png" alt="Genie" className="w-12 h-12 mx-auto mb-2 object-contain" />
            <p className="text-xs font-semibold mb-1" style={{ color: CN.cream }}>Make a wish</p>
            <p className="text-[10px] mb-2" style={{ color: CN.muted }}>Save places you dream of visiting</p>
            <Link to="/campgrounds" className="text-[10px] font-semibold" style={{ color: CN.gold }}>Explore →</Link>
          </div>
        )}
        {!loading && items.slice(0, 5).map((item: any) => (
          <Link key={item.id} to={item.type === 'campground' ? `/campgrounds/${item.id}` : `/place/${item.id}`}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition hover:brightness-110" style={{ background: CN.cardAlt }}>
            {item.imageUrl ? (
              <img src={item.imageUrl} alt="" className="w-8 h-8 rounded-md object-cover flex-shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: CN.border }}>🏕</div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold truncate" style={{ color: CN.cream }}>{item.name}</p>
              {item.city && <p className="text-[9px]" style={{ color: CN.muted }}>{item.city}, {item.state}</p>}
            </div>
          </Link>
        ))}
        {!loading && items.length > 5 && (
          <Link to="/campgrounds?tab=wishlist" className="block text-center text-[10px] font-semibold mt-2 py-1" style={{ color: CN.gold }}>
            View all {items.length} →
          </Link>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════ */
export default function BasecampFeed() {
  const [networkItems, setNetworkItems] = useState<FeedItem[]>([]);
  const [communityItems, setCommunityItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'network' | 'community'>('network');
  const [visibleCount, setVisibleCount] = useState(10);

  useEffect(() => {
    Promise.all([
      api.get('/basecamp/v2/feed?tab=network').catch(() => ({ data: [] })),
      api.get('/basecamp/v2/feed?tab=community').catch(() => ({ data: [] })),
    ]).then(([netRes, comRes]) => {
      setNetworkItems(Array.isArray(netRes.data) ? netRes.data : netRes.data?.items || []);
      setCommunityItems(Array.isArray(comRes.data) ? comRes.data : comRes.data?.items || []);
    }).finally(() => setLoading(false));
  }, []);

  const feedItems = activeTab === 'network' ? networkItems : communityItems;
  const visible = feedItems.slice(0, visibleCount);

  return (
    <div>
      {/* ── DESKTOP: two-column layout ── */}
      <div className="hidden lg:grid gap-6" style={{ gridTemplateColumns: '320px 1fr' }}>
        {/* Sidebar — sticky */}
        <div className="space-y-4" style={{ position: 'sticky', top: 80, alignSelf: 'start' }}>
          <CommunitySidebar items={communityItems} />
          <FavoritesSidebar />
        </div>

        {/* Feed column */}
        <div className="space-y-4" style={{ maxWidth: 680 }}>
          <h3 className="text-sm font-bold" style={{ color: CN.cream }}>
            <Users className="w-4 h-4 inline mr-1.5" style={{ color: CN.gold }} /> Your Network
          </h3>
          {loading && [0, 1, 2].map(i => <div key={i} className="h-48 rounded-xl animate-pulse" style={{ background: CN.border }} />)}
          {/* Empty network: hide entirely per degradation rule */}
          {!loading && networkItems.slice(0, visibleCount).map(item =>
            item.type === 'rig-post' || item.type === 'rig-mod'
              ? <RigPostFeedCard key={item.postId} item={item} />
              : <FeedCard key={item.postId} item={item} />
          )}
          {!loading && networkItems.length > visibleCount && (
            <button onClick={() => setVisibleCount(v => v + 10)}
              className="w-full py-2 text-xs font-semibold rounded-xl" style={{ background: CN.cardAlt, color: CN.gold, border: `1px solid ${CN.border}` }}>
              Show more
            </button>
          )}
        </div>
      </div>

      {/* ── MOBILE: tabbed layout ── */}
      <div className="lg:hidden">
        <div className="cartoon-card overflow-hidden" style={{ background: CN.card }}>
          {/* Tab bar */}
          <div className="flex" style={{ borderBottom: `1px solid ${CN.border}` }}>
            {(['network', 'community'] as const).map(tab => (
              <button key={tab} onClick={() => { setActiveTab(tab); setVisibleCount(10); }}
                className="flex-1 py-2.5 text-xs font-semibold text-center transition"
                style={{
                  color: activeTab === tab ? CN.gold : CN.muted,
                  borderBottom: activeTab === tab ? `2px solid ${CN.gold}` : '2px solid transparent',
                }}>
                {tab === 'network' ? '👥 Network' : '🏕 Community'}
              </button>
            ))}
          </div>

          <div className="p-3 space-y-3">
            {loading && [0, 1, 2].map(i => <div key={i} className="h-12 rounded-lg animate-pulse" style={{ background: CN.border }} />)}
            {/* Empty tabs: hide content entirely per degradation rule */}
            {!loading && visible.map(item =>
              item.type === 'rig-post' || item.type === 'rig-mod'
                ? <RigPostFeedCard key={item.postId} item={item} />
                : <FeedCard key={item.postId} item={item} />
            )}
            {!loading && feedItems.length > visibleCount && (
              <button onClick={() => setVisibleCount(v => v + 10)}
                className="w-full py-2 text-xs font-semibold rounded-lg" style={{ background: CN.cardAlt, color: CN.gold }}>
                Show more
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

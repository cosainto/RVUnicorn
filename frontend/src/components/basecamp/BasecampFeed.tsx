/**
 * BasecampFeed — Network / Community tabbed feed for Basecamp home.
 * Network: real circle activity (friends, followed). No system posts.
 * Community: all public posts including system campfire questions.
 * Unseen badges + freshness-driven default tab on load.
 */
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, ThumbsUp, Users, Sparkles } from 'lucide-react';
import api from '../../services/api';

const CN = {
  bg: '#0F1C35', card: '#162236', cardAlt: '#1A2A45',
  gold: '#E8A838', orange: '#D4621A', cream: '#F5F0E8',
  muted: '#8B9BB4', border: '#243552',
};

interface EnrichmentData {
  friendsVisitedCount?: number;
  friendsVisitedAvatars?: string[];
  friendsWishlistedCount?: number;
  travelersCompletedCount?: number;
  rigFollowerCount?: number;
}

interface FeedItem {
  postId: string;
  type: string;
  sourceKey?: string;
  authorId?: string;
  authorUsername: string;
  authorFirstName?: string;
  authorAvatar: string | null;
  isSystem?: boolean;
  preview: string;
  body?: string;
  imageUrl?: string | null;
  tags?: string[];
  likeCount: number;
  commentCount: number;
  createdAt: string;
  campgroundName?: string | null;
  campgroundState?: string | null;
  rigName?: string | null;
  isActive?: boolean | null;
  isTrending?: boolean;
  isSubscribed?: boolean;
  enrichment?: EnrichmentData | null;
}

type FeedTab = 'network' | 'community';

function timeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function BasecampFeed() {
  const [activeTab, setActiveTab] = useState<FeedTab>('network');
  const [networkItems, setNetworkItems] = useState<FeedItem[]>([]);
  const [communityItems, setCommunityItems] = useState<FeedItem[]>([]);
  const [networkUnseen, setNetworkUnseen] = useState(false);
  const [communityUnseen, setCommunityUnseen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(8);
  const defaultResolved = useRef(false);

  // ── Fetch both feeds + tab state in parallel ──
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [netRes, comRes, stateRes] = await Promise.all([
          api.get('/basecamp/v2/network-feed'),
          api.get('/basecamp/v2/community-feed'),
          api.get('/basecamp/v2/feed-tab-state'),
        ]);

        const netItems: FeedItem[] = netRes.data?.items || [];
        const comItems: FeedItem[] = comRes.data?.items || [];
        setNetworkItems(netItems);
        setCommunityItems(comItems);

        // Compute unseen state
        const state = stateRes.data || {};
        const netNewest = netRes.data?.newestAt;
        const comNewest = comRes.data?.newestAt;
        const netSeen = state.network?.lastSeenAt;
        const comSeen = state.community?.lastSeenAt;

        const netHasUnseen = netNewest && (!netSeen || new Date(netNewest) > new Date(netSeen));
        const comHasUnseen = comNewest && (!comSeen || new Date(comNewest) > new Date(comSeen));
        setNetworkUnseen(!!netHasUnseen);
        setCommunityUnseen(!!comHasUnseen);

        // Freshness-driven default tab (only on first load)
        if (!defaultResolved.current) {
          defaultResolved.current = true;
          const lastTab = localStorage.getItem('rvu_feed_tab') as FeedTab | null;
          if (netHasUnseen) {
            setActiveTab('network');
          } else if (comHasUnseen) {
            setActiveTab('community');
          } else if (lastTab === 'network' || lastTab === 'community') {
            setActiveTab(lastTab);
          }
          // else default stays 'network'
        }
      } catch (e) {
        console.error('[BasecampFeed] load error:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ── Mark tab as seen when switched ──
  const switchTab = (tab: FeedTab) => {
    setActiveTab(tab);
    setVisibleCount(8);
    localStorage.setItem('rvu_feed_tab', tab);
    // Mark seen
    api.post('/basecamp/v2/feed-tab-seen', { tab }).catch(() => {});
    if (tab === 'network') setNetworkUnseen(false);
    else setCommunityUnseen(false);
  };

  // Mark initial tab as seen on mount
  useEffect(() => {
    if (!loading) {
      api.post('/basecamp/v2/feed-tab-seen', { tab: activeTab }).catch(() => {});
      if (activeTab === 'network') setNetworkUnseen(false);
      else setCommunityUnseen(false);
    }
  }, [loading]);

  const items = activeTab === 'network' ? networkItems : communityItems;
  const visible = items.slice(0, visibleCount);

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
      {/* ── Tab bar ── */}
      <div className="flex border-b" style={{ borderColor: CN.border }}>
        <button
          onClick={() => switchTab('network')}
          className="flex-1 py-2.5 text-xs font-semibold text-center transition relative"
          style={{
            color: activeTab === 'network' ? CN.gold : CN.muted,
            borderBottom: activeTab === 'network' ? `2px solid ${CN.gold}` : '2px solid transparent',
          }}
        >
          <span className="flex items-center justify-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            Network
            {networkUnseen && activeTab !== 'network' && (
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: CN.orange }} />
            )}
          </span>
        </button>
        <button
          onClick={() => switchTab('community')}
          className="flex-1 py-2.5 text-xs font-semibold text-center transition relative"
          style={{
            color: activeTab === 'community' ? CN.gold : CN.muted,
            borderBottom: activeTab === 'community' ? `2px solid ${CN.gold}` : '2px solid transparent',
          }}
        >
          <span className="flex items-center justify-center gap-1.5">
            <MessageCircle className="w-3.5 h-3.5" />
            Community
            {communityUnseen && activeTab !== 'community' && (
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: CN.orange }} />
            )}
          </span>
        </button>
      </div>

      {/* ── Feed content ── */}
      <div className="px-3 py-3">
        {loading && (
          <div className="space-y-2">
            {[0, 1, 2].map(i => <div key={i} className="h-12 rounded-lg animate-pulse" style={{ background: CN.border }} />)}
          </div>
        )}

        {!loading && visible.length === 0 && activeTab === 'network' && (
          <div className="py-6 text-center">
            <Users className="w-6 h-6 mx-auto mb-2" style={{ color: CN.muted }} />
            <p className="text-sm font-semibold mb-1" style={{ color: CN.cream }}>Your network is quiet right now</p>
            <p className="text-xs mb-3" style={{ color: CN.muted }}>Add camping buddies to see their check-ins, photos, wishlist picks, and travel updates here.</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Link to="/community" className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: CN.gold, color: CN.bg }}>Find Campers</Link>
              <Link to="/campgrounds" className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: CN.cardAlt, color: CN.cream, border: `1px solid ${CN.border}` }}>Explore Campgrounds</Link>
            </div>
          </div>
        )}

        {!loading && visible.length === 0 && activeTab === 'community' && (
          <div className="py-6 text-center">
            <MessageCircle className="w-6 h-6 mx-auto mb-2" style={{ color: CN.muted }} />
            <p className="text-sm font-semibold mb-1" style={{ color: CN.cream }}>No community updates yet</p>
            <p className="text-xs mb-3" style={{ color: CN.muted }}>Follow rigs, campgrounds, and discussion threads to see their updates here.</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Link to="/community" className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: CN.gold, color: CN.bg }}>Browse Discussions</Link>
              <Link to="/campgrounds" className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: CN.cardAlt, color: CN.cream, border: `1px solid ${CN.border}` }}>Explore Campgrounds</Link>
            </div>
          </div>
        )}

        {!loading && visible.length > 0 && (
          <div className="space-y-1.5">
            {visible.map((item) => (
              <FeedCard key={item.postId} item={item} />
            ))}
          </div>
        )}

        {!loading && items.length > visibleCount && (
          <button
            onClick={() => setVisibleCount(c => c + 8)}
            className="w-full mt-3 py-2 rounded-lg text-xs font-semibold transition hover:brightness-110"
            style={{ background: CN.cardAlt, color: CN.gold, border: `1px solid ${CN.border}` }}
          >
            Load more
          </button>
        )}
      </div>
    </div>
  );
}

// ── Avatar helper ──
function Avatar({ src, name, size = 6 }: { src?: string | null; name?: string; size?: number }) {
  const letter = name?.[0]?.toUpperCase() || '?';
  const px = size * 4;
  if (src) return <img src={src} className={`w-${size} h-${size} rounded-full object-cover`} alt="" style={{ width: px, height: px }} />;
  return (
    <div className={`w-${size} h-${size} rounded-full flex items-center justify-center font-bold`}
      style={{ width: px, height: px, background: CN.border, color: CN.gold, fontSize: px * 0.4 }}>
      {letter}
    </div>
  );
}

// ── Enrichment badge (only renders when enrichment data exists) ──
function EnrichmentBadge({ enrichment }: { enrichment: EnrichmentData }) {
  // Pick the best enrichment to display (priority order)
  if (enrichment.friendsVisitedCount) {
    return (
      <div className="flex items-center gap-1.5 mt-1.5 px-2 py-1 rounded-lg" style={{ background: CN.bg, border: `1px solid ${CN.border}` }}>
        <div className="flex -space-x-1.5">
          {enrichment.friendsVisitedAvatars?.slice(0, 3).map((av, i) => (
            <img key={i} src={av} className="w-4 h-4 rounded-full object-cover" style={{ border: `1px solid ${CN.bg}` }} alt="" />
          ))}
        </div>
        <span className="text-[10px] font-medium" style={{ color: CN.gold }}>
          {enrichment.friendsVisitedCount} in your network visited
        </span>
      </div>
    );
  }

  if (enrichment.friendsWishlistedCount) {
    return (
      <div className="flex items-center gap-1 mt-1.5 px-2 py-1 rounded-lg" style={{ background: CN.bg, border: `1px solid ${CN.border}` }}>
        <Sparkles className="w-3 h-3" style={{ color: CN.gold }} />
        <span className="text-[10px] font-medium" style={{ color: CN.gold }}>
          {enrichment.friendsWishlistedCount} in your network wishlisted this
        </span>
      </div>
    );
  }

  if (enrichment.travelersCompletedCount) {
    return (
      <div className="flex items-center gap-1 mt-1.5 px-2 py-1 rounded-lg" style={{ background: CN.bg, border: `1px solid ${CN.border}` }}>
        <Users className="w-3 h-3" style={{ color: CN.gold }} />
        <span className="text-[10px] font-medium" style={{ color: CN.gold }}>
          {enrichment.travelersCompletedCount} travelers completed this route
        </span>
      </div>
    );
  }

  if (enrichment.rigFollowerCount) {
    return (
      <div className="flex items-center gap-1 mt-1.5 px-2 py-1 rounded-lg" style={{ background: CN.bg, border: `1px solid ${CN.border}` }}>
        <Users className="w-3 h-3" style={{ color: CN.gold }} />
        <span className="text-[10px] font-medium" style={{ color: CN.gold }}>
          Followed by {enrichment.rigFollowerCount} RVUnicorn travelers
        </span>
      </div>
    );
  }

  return null;
}

// ── Source type label ──
function sourceLabel(item: FeedItem): string | null {
  const labels: Record<string, string> = {
    'checkin': 'Check-in',
    'photo': 'Photo',
    'wishlist-add': 'Wishlist',
    'activity': 'Activity',
    'rig-post': 'Rig Update',
    'rig-mod': 'Rig Mod',
    'campground-post': 'Campground',
    'campground-announcement': 'Announcement',
    'thread': 'Discussion',
    'tripkit': 'TripKit',
    'board-post': 'Post',
  };
  return labels[item.type] || null;
}

// ── Differentiated feed card ──
function FeedCard({ item }: { item: FeedItem }) {
  const hasImage = !!item.imageUrl;
  const hasEnrichment = !!item.enrichment;
  const isEnrichedCard = hasImage || hasEnrichment;
  const label = sourceLabel(item);

  // Enriched / rich card (has image or enrichment data)
  if (isEnrichedCard) {
    return (
      <Link to="/community" className="block rounded-xl overflow-hidden transition hover:brightness-110" style={{ background: CN.cardAlt }}>
        {hasImage && (
          <div className="relative">
            <img src={item.imageUrl!} alt="" className="w-full h-28 object-cover" />
            {label && (
              <span className="absolute top-2 left-2 text-[9px] font-semibold px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(15,28,53,0.75)', color: CN.gold }}>
                {label}
              </span>
            )}
          </div>
        )}
        <div className="px-3 py-2.5">
          <div className="flex items-center gap-2 mb-1.5">
            <Avatar src={item.authorAvatar} name={item.authorFirstName || item.authorUsername} />
            <span className="text-[11px] font-semibold" style={{ color: CN.cream }}>
              {item.authorFirstName || item.authorUsername}
            </span>
            {item.createdAt && <span className="text-[10px]" style={{ color: CN.muted }}>{timeAgo(item.createdAt)}</span>}
            {!hasImage && label && (
              <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: CN.border, color: CN.muted }}>
                {label}
              </span>
            )}
          </div>
          <p className="text-xs font-medium line-clamp-2" style={{ color: CN.cream }}>{item.preview}</p>
          {hasEnrichment && <EnrichmentBadge enrichment={item.enrichment!} />}
          <div className="flex items-center gap-3 mt-1.5">
            {item.likeCount > 0 && (
              <span className="flex items-center gap-0.5 text-[10px]" style={{ color: CN.muted }}>
                <ThumbsUp className="w-2.5 h-2.5" /> {item.likeCount}
              </span>
            )}
            {item.commentCount > 0 && (
              <span className="flex items-center gap-0.5 text-[10px]" style={{ color: CN.muted }}>
                <MessageCircle className="w-2.5 h-2.5" /> {item.commentCount}
              </span>
            )}
            {item.isTrending && (
              <span className="flex items-center gap-0.5 text-[10px]" style={{ color: CN.orange }}>
                <Sparkles className="w-2.5 h-2.5" /> Trending
              </span>
            )}
          </div>
        </div>
      </Link>
    );
  }

  // Plain compact row (no image, no enrichment)
  return (
    <Link to="/community" className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition hover:brightness-110" style={{ background: CN.cardAlt }}>
      <div className="flex-shrink-0">
        <Avatar src={item.authorAvatar} name={item.authorFirstName || item.authorUsername} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold" style={{ color: CN.cream }}>
            {item.authorFirstName || item.authorUsername}
          </span>
          {item.createdAt && <span className="text-[10px]" style={{ color: CN.muted }}>{timeAgo(item.createdAt)}</span>}
          {label && (
            <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: CN.border, color: CN.muted }}>
              {label}
            </span>
          )}
        </div>
        <p className="text-[11px] truncate" style={{ color: CN.muted }}>{item.preview}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {item.likeCount > 0 && (
          <span className="flex items-center gap-0.5 text-[10px]" style={{ color: CN.muted }}>
            <ThumbsUp className="w-2.5 h-2.5" /> {item.likeCount}
          </span>
        )}
        {item.commentCount > 0 && (
          <span className="flex items-center gap-0.5 text-[10px]" style={{ color: CN.muted }}>
            <MessageCircle className="w-2.5 h-2.5" /> {item.commentCount}
          </span>
        )}
      </div>
    </Link>
  );
}

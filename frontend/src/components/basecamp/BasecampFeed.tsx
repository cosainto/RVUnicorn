/**
 * BasecampFeed — Network / Community tabbed feed for Basecamp home.
 * Network: real circle activity (friends, followed). No system posts.
 * Community: all public posts including system campfire questions.
 * Unseen badges + freshness-driven default tab on load.
 */
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, ThumbsUp, ChevronRight, Users, Sparkles, Image } from 'lucide-react';
import api from '../../services/api';

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
  tags?: string[];
  likeCount: number;
  commentCount: number;
  createdAt: string;
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
            <div className="text-2xl mb-2">🏕️</div>
            <p className="text-sm font-semibold mb-1" style={{ color: CN.cream }}>Your network is quiet right now</p>
            <p className="text-xs mb-3" style={{ color: CN.muted }}>Follow rigs, find campers, or check in at your next stop — real activity from your circle will show up here.</p>
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
            <p className="text-xs mb-3" style={{ color: CN.muted }}>Follow discussion boards and join conversations to see activity here.</p>
            <Link to="/community" className="px-3 py-1.5 rounded-lg text-xs font-semibold inline-block" style={{ background: CN.gold, color: CN.bg }}>Browse Discussions</Link>
          </div>
        )}

        {!loading && visible.length > 0 && (
          <div className="space-y-1.5">
            {visible.map((item) => (
              <FeedCard key={item.postId} item={item} tab={activeTab} />
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

// ── Differentiated feed card ──
function FeedCard({ item, tab }: { item: FeedItem; tab: FeedTab }) {
  const isRich = tab === 'network' && item.imageUrl;
  const isSystemPost = item.isSystem;

  // Rich card for network posts with images
  if (isRich) {
    return (
      <Link to={`/community`} className="block rounded-xl overflow-hidden transition hover:brightness-110" style={{ background: CN.cardAlt }}>
        <img src={item.imageUrl!} alt="" className="w-full h-28 object-cover" />
        <div className="px-3 py-2.5">
          <div className="flex items-center gap-2 mb-1.5">
            {item.authorAvatar ? (
              <img src={item.authorAvatar} className="w-6 h-6 rounded-full object-cover" alt="" />
            ) : (
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ background: CN.border, color: CN.gold }}>{item.authorFirstName?.[0] || item.authorUsername?.[0]?.toUpperCase() || '?'}</div>
            )}
            <span className="text-[11px] font-semibold" style={{ color: CN.cream }}>{item.authorFirstName || item.authorUsername}</span>
            {item.createdAt && <span className="text-[10px]" style={{ color: CN.muted }}>{timeAgo(item.createdAt)}</span>}
          </div>
          <p className="text-xs font-medium line-clamp-2" style={{ color: CN.cream }}>{item.preview}</p>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="flex items-center gap-0.5 text-[10px]" style={{ color: CN.muted }}><ThumbsUp className="w-2.5 h-2.5" /> {item.likeCount}</span>
            <span className="flex items-center gap-0.5 text-[10px]" style={{ color: CN.muted }}><MessageCircle className="w-2.5 h-2.5" /> {item.commentCount}</span>
          </div>
        </div>
      </Link>
    );
  }

  // Compact row (network text posts + all community posts)
  return (
    <Link to="/community" className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition hover:brightness-110" style={{ background: CN.cardAlt }}>
      {item.authorAvatar ? (
        <img src={item.authorAvatar} className="w-6 h-6 rounded-full object-cover flex-shrink-0" alt="" />
      ) : (
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0" style={{ background: CN.border, color: CN.gold }}>
          {item.authorFirstName?.[0] || item.authorUsername?.[0]?.toUpperCase() || '?'}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold" style={{ color: CN.cream }}>{item.authorFirstName || item.authorUsername}</span>
          {item.createdAt && <span className="text-[10px]" style={{ color: CN.muted }}>{timeAgo(item.createdAt)}</span>}
          {isSystemPost && <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: CN.border, color: CN.muted }}>System</span>}
        </div>
        <p className="text-[11px] truncate" style={{ color: CN.muted }}>{item.preview}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="flex items-center gap-0.5 text-[10px]" style={{ color: CN.muted }}>
          <ThumbsUp className="w-2.5 h-2.5" /> {item.likeCount}
        </span>
        <span className="flex items-center gap-0.5 text-[10px]" style={{ color: CN.muted }}>
          <MessageCircle className="w-2.5 h-2.5" /> {item.commentCount}
        </span>
      </div>
    </Link>
  );
}

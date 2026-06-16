import { useState } from 'react';
import { Link } from 'react-router-dom';

const CN = { bg: '#0F1C35', card: '#162236', cardAlt: '#1A2A45', gold: '#E8A838', orange: '#D4621A', cream: '#F5F0E8', muted: '#8B9BB4', border: '#243552' };

interface CommunityFeedData {
  topItem: { postId: string; type: string; authorUsername: string; authorAvatar: string | null; preview: string; imageUrl: string | null; likeCount: number; commentCount: number } | null;
  recentItems: { postId: string; type: string; authorUsername: string; authorAvatar: string | null; preview: string; body?: string; likeCount: number; commentCount: number; createdAt: string }[];
}

interface Props {
  data: CommunityFeedData | null;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function Avatar({ src, name, size }: { src: string | null; name: string; size: number }) {
  return src ? (
    <img src={src} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />
  ) : (
    <div style={{ width: size, height: size, borderRadius: '50%', background: CN.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, color: CN.bg, fontWeight: 700 }}>{name[0]?.toUpperCase()}</div>
  );
}

function SkeletonFeed() {
  return (
    <div>
      <div style={{ height: 140, borderRadius: 12, background: CN.border, marginBottom: 12, animation: 'pulse 1.5s ease-in-out infinite' }} />
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ height: 48, borderRadius: 8, background: CN.border, marginBottom: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
      ))}
    </div>
  );
}

export default function CommunityFeedSection({ data }: Props) {
  const [activeTab, setActiveTab] = useState<'following' | 'discover'>('following');
  const [visibleCount, setVisibleCount] = useState(10);

  if (data === null) {
    return (
      <div style={{ padding: '24px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ color: CN.cream, fontSize: 20, fontWeight: 700 }}>📰 From Your Network</div>
        </div>
        <SkeletonFeed />
      </div>
    );
  }

  const topItem = data.topItem || null;
  const recentItems = data.recentItems || [];
  const hasContent = topItem || recentItems.length > 0;

  const tabStyle = (active: boolean): React.CSSProperties => ({
    background: active ? CN.gold : CN.cardAlt,
    color: active ? CN.bg : CN.muted,
    border: 'none',
    borderRadius: 99,
    padding: '4px 14px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  });

  const visibleItems = recentItems.slice(0, visibleCount);

  return (
    <div style={{ padding: '24px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ color: CN.cream, fontSize: 20, fontWeight: 700 }}>📰 From Your Network</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setActiveTab('following')} style={tabStyle(activeTab === 'following')}>Following</button>
          <button onClick={() => setActiveTab('discover')} style={tabStyle(activeTab === 'discover')}>Discover</button>
        </div>
      </div>

      {!hasContent ? (
        <div style={{ background: CN.card, borderRadius: 12, padding: 24, textAlign: 'center', color: CN.muted, fontSize: 14 }}>Follow some RVers to fill your feed!</div>
      ) : (
        <>
          {topItem && (
            <Link to="/community" style={{ textDecoration: 'none', display: 'block', marginBottom: 16 }}>
              <div style={{ background: CN.card, borderRadius: 14, border: `1px solid ${CN.border}`, overflow: 'hidden' }}>
                {topItem.imageUrl && <img src={topItem.imageUrl} alt="" style={{ width: '100%', height: 140, objectFit: 'cover' }} />}
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Avatar src={topItem.authorAvatar} name={topItem.authorUsername} size={32} />
                    <span style={{ color: CN.cream, fontSize: 13, fontWeight: 600 }}>{topItem.authorUsername}</span>
                    <span style={{ background: CN.cardAlt, color: CN.gold, fontSize: 10, padding: '2px 8px', borderRadius: 99, marginLeft: 'auto' }}>🔥 Most engaging today</span>
                  </div>
                  <div style={{ color: CN.cream, fontSize: 14, fontWeight: 700, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: 8 }}>{topItem.preview}</div>
                  <div style={{ display: 'flex', gap: 12, color: CN.muted, fontSize: 12 }}>
                    <span>❤️ {topItem.likeCount}</span>
                    <span>💬 {topItem.commentCount}</span>
                  </div>
                </div>
              </div>
            </Link>
          )}

          <div>
            {visibleItems.map((item) => (
              <Link key={item.postId} to="/community" style={{ textDecoration: 'none', display: 'block' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `1px solid ${CN.border}` }}>
                  <Avatar src={item.authorAvatar} name={item.authorUsername} size={28} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: CN.cream, fontSize: 12, fontWeight: 600 }}>{item.authorUsername}</span>
                      <span style={{ color: CN.muted, fontSize: 11 }}>{timeAgo(item.createdAt)}</span>
                    </div>
                    <div style={{ color: CN.muted, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.preview}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, color: CN.muted, fontSize: 11, flexShrink: 0 }}>
                    <span>❤️ {item.likeCount}</span>
                    <span>💬 {item.commentCount}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {recentItems.length > visibleCount && (
            <button
              onClick={() => setVisibleCount((c) => c + 10)}
              style={{ width: '100%', marginTop: 12, padding: '10px 0', background: CN.cardAlt, color: CN.gold, border: `1px solid ${CN.border}`, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Load more
            </button>
          )}
        </>
      )}
    </div>
  );
}

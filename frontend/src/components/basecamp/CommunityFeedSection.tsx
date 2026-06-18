import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, ThumbsUp, ChevronRight } from 'lucide-react';

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

export default function CommunityFeedSection({ data }: Props) {
  const [visibleCount, setVisibleCount] = useState(6);

  if (data === null) {
    return (
      <div className="rounded-xl p-4" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
        <div className="flex items-center gap-2 mb-3">
          <MessageCircle className="w-4 h-4" style={{ color: CN.gold }} />
          <span className="text-sm font-bold" style={{ color: CN.cream }}>From Your Network</span>
        </div>
        <div className="space-y-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-10 rounded-lg animate-pulse" style={{ background: CN.border }} />
          ))}
        </div>
      </div>
    );
  }

  const allItems = [
    ...(data.topItem ? [{
      postId: data.topItem.postId,
      authorUsername: data.topItem.authorUsername,
      authorAvatar: data.topItem.authorAvatar,
      preview: data.topItem.preview,
      likeCount: data.topItem.likeCount,
      commentCount: data.topItem.commentCount,
      createdAt: '',
      isTop: true,
    }] : []),
    ...data.recentItems.map(item => ({ ...item, isTop: false })),
  ];

  if (allItems.length === 0) {
    return (
      <div className="rounded-xl p-4 text-center" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
        <MessageCircle className="w-5 h-5 mx-auto mb-2" style={{ color: CN.muted }} />
        <p className="text-xs" style={{ color: CN.muted }}>Follow some RVers to fill your feed!</p>
      </div>
    );
  }

  const visible = allItems.slice(0, visibleCount);

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
      {/* Compact header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4" style={{ color: CN.gold }} />
          <span className="text-sm font-bold" style={{ color: CN.cream }}>From Your Network</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: CN.cardAlt, color: CN.muted }}>{allItems.length}</span>
        </div>
        <Link to="/community" className="text-[10px] font-semibold flex items-center gap-0.5" style={{ color: CN.gold }}>
          View All <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Compact feed rows */}
      <div className="px-3 pb-3 space-y-1">
        {visible.map((item: any) => (
          <Link key={item.postId} to="/community" className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition hover:brightness-110" style={{ background: CN.cardAlt }}>
            {item.authorAvatar ? (
              <img src={item.authorAvatar} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0" style={{ background: CN.border, color: CN.gold }}>
                {item.authorUsername?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold" style={{ color: CN.cream }}>{item.authorUsername}</span>
                {item.createdAt && <span className="text-[10px]" style={{ color: CN.muted }}>{timeAgo(item.createdAt)}</span>}
                {item.isTop && <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: CN.border, color: CN.gold }}>🔥</span>}
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
        ))}
      </div>

      {/* Load more */}
      {allItems.length > visibleCount && (
        <div className="px-3 pb-3">
          <button
            onClick={() => setVisibleCount(c => c + 6)}
            className="w-full py-2 rounded-lg text-xs font-semibold transition hover:brightness-110"
            style={{ background: CN.cardAlt, color: CN.gold, border: `1px solid ${CN.border}` }}
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}

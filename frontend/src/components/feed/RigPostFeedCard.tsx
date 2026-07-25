/**
 * RigPostFeedCard — rich card for rig posts in the Basecamp feed.
 * Shows rig identity, post type badge, photo grid, and engagement row.
 */
import { Link } from 'react-router-dom';
import { ThumbsUp, MessageCircle, Share2, MapIcon, Wrench } from 'lucide-react';
import AlbumPhotoGrid from '../AlbumPhotoGrid';

const CN = {
  bg: '#0F1C35', card: '#162236', cardAlt: '#1A2A45',
  gold: '#E8A838', cream: '#F5F0E8', muted: '#8B9BB4', border: '#243552',
};

const POST_TYPE_BADGES: Record<string, { label: string; color: string; bg: string }> = {
  trip_recap:   { label: 'Trip Recap',   color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
  mod_update:   { label: 'Mod Update',   color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  tip:          { label: 'Road Tip',     color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
  road_report:  { label: 'Road Report',  color: '#8B5CF6', bg: 'rgba(139,92,246,0.15)' },
};

interface RigPostFeedItem {
  postId: string;
  type: string;
  authorUsername: string;
  authorFirstName?: string;
  authorAvatar: string | null;
  preview: string;
  body?: string;
  imageUrl?: string | null;
  photos?: string[] | null;
  likeCount: number;
  commentCount: number;
  createdAt?: string;
  rigSlug?: string | null;
  rigName?: string | null;
  rigPhoto?: string | null;
  rigId?: string | null;
  postType?: string | null;
  isTrending?: boolean;
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

export default function RigPostFeedCard({ item }: { item: RigPostFeedItem }) {
  const badge = POST_TYPE_BADGES[item.postType || 'road_report'] || POST_TYPE_BADGES.road_report;
  const photos = item.photos || (item.imageUrl ? [item.imageUrl] : []);
  const rigLink = item.rigSlug ? `/rig/${item.rigSlug}` : '#';
  const postLink = item.rigSlug ? `/rig/${item.rigSlug}/posts` : '#';
  const bodyPreview = item.body && item.body.length > 150
    ? item.body.slice(0, 150) + '...'
    : item.body;

  return (
    <div className="cartoon-card overflow-hidden" style={{ background: CN.card, maxWidth: 680 }}>
      {/* HEADER: Rig photo + name + badge + timestamp */}
      <div className="flex items-center gap-2.5 px-4 pt-3 pb-2">
        <Link to={rigLink} className="flex-shrink-0">
          {item.rigPhoto ? (
            <img src={item.rigPhoto} alt="" className="rounded-full object-cover" style={{ width: 40, height: 40 }} />
          ) : (
            <div className="rounded-full flex items-center justify-center font-bold"
              style={{ width: 40, height: 40, background: CN.border, color: CN.gold, fontSize: 16 }}>
              {(item.rigName || 'R')[0].toUpperCase()}
            </div>
          )}
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link to={rigLink} className="text-sm font-semibold hover:underline" style={{ color: CN.cream }}>
              {item.rigName || 'A Rig'}
            </Link>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
              style={{ background: badge.bg, color: badge.color }}>
              {badge.label}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px]" style={{ color: CN.muted }}>
              Posted by {item.authorFirstName || item.authorUsername}
            </span>
            {item.createdAt && (
              <span className="text-[10px]" style={{ color: CN.muted }}> · {timeAgo(item.createdAt)}</span>
            )}
          </div>
        </div>
      </div>

      {/* CONTENT: Title + body */}
      <div className="px-4 pb-2">
        {item.preview && (
          <h4 className="text-sm font-semibold mb-1" style={{ color: CN.cream, fontFamily: 'Playfair Display, serif' }}>
            {item.preview}
          </h4>
        )}
        {bodyPreview && (
          <p className="text-xs leading-relaxed" style={{ color: CN.muted }}>
            {bodyPreview}
            {item.body && item.body.length > 150 && (
              <Link to={postLink} className="ml-1 font-semibold" style={{ color: CN.gold }}>Read more</Link>
            )}
          </p>
        )}
      </div>

      {/* PHOTO GRID */}
      {photos.length > 0 && (
        <div className="px-4 pb-3">
          <AlbumPhotoGrid photos={photos.slice(0, 5)} totalPhotoCount={photos.length} />
        </div>
      )}

      {/* FOOTER: engagement + actions */}
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
        <div className="flex-1" />
        {item.postType === 'trip_recap' && (
          <Link to={postLink} className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: CN.gold }}>
            <MapIcon className="w-3.5 h-3.5" /> View Trip
          </Link>
        )}
        {item.postType === 'mod_update' && (
          <Link to={postLink} className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: CN.gold }}>
            <Wrench className="w-3.5 h-3.5" /> View Mod
          </Link>
        )}
        {item.postType !== 'trip_recap' && item.postType !== 'mod_update' && (
          <Link to={postLink} className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: CN.gold }}>
            <Share2 className="w-3.5 h-3.5" /> View Post
          </Link>
        )}
      </div>
    </div>
  );
}

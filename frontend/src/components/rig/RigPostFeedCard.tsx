import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, MessageCircle, ExternalLink, MapPin, Wrench, Clock } from 'lucide-react';
import AlbumPhotoGrid from '../AlbumPhotoGrid';

interface RigPostFeedCardProps {
  post: {
    id: string;
    title?: string;
    body?: string;
    photos?: string[];
    postType: string;
    tripId?: string;
    createdAt: string;
    author?: {
      id: string;
      firstName: string;
      lastName?: string;
      username: string;
      profilePicture?: string;
    };
  };
  rig: {
    id: string;
    rigName?: string;
    slug: string;
    heroPhoto?: string;
  };
  pilotLabel?: string;
  compact?: boolean;
}

const postTypeBadge: Record<string, { label: string; color: string }> = {
  trip_recap: { label: 'Trip Recap', color: 'bg-blue-100 text-blue-700' },
  mod_update: { label: 'Mod Update', color: 'bg-amber-100 text-amber-700' },
  tip: { label: 'Road Tip', color: 'bg-green-100 text-green-700' },
  road_report: { label: 'Road Report', color: 'bg-purple-100 text-purple-700' },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins + 'm ago';
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + 'h ago';
  const days = Math.floor(hours / 24);
  if (days < 30) return days + 'd ago';
  return new Date(dateStr).toLocaleDateString();
}

export default function RigPostFeedCard({ post, rig, pilotLabel, compact }: RigPostFeedCardProps) {
  const badge = postTypeBadge[post.postType] || postTypeBadge.road_report;
  const truncatedBody = post.body && post.body.length > 150
    ? post.body.slice(0, 150) + '...'
    : post.body;

  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 pb-2">
        <Link to={`/rig/${rig.slug}`}>
          {rig.heroPhoto ? (
            <img src={rig.heroPhoto} alt={rig.rigName || 'Rig'} className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 text-lg">
              🚐
            </div>
          )}
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link to={`/rig/${rig.slug}`} className="font-semibold text-stone-900 truncate hover:text-amber-700">
              {rig.rigName || 'Unnamed Rig'}
            </Link>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.color}`}>
              {badge.label}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-stone-500">
            <Clock className="w-3 h-3" />
            {timeAgo(post.createdAt)}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-3">
        {post.title && (
          <h3 className="font-serif text-lg font-semibold text-stone-900 mb-1">{post.title}</h3>
        )}
        {truncatedBody && (
          <p className="text-stone-600 text-sm leading-relaxed">
            {truncatedBody}
            {post.body && post.body.length > 150 && (
              <Link to={`/rig/${rig.slug}/posts`} className="text-amber-600 ml-1 hover:underline">
                Read more
              </Link>
            )}
          </p>
        )}
      </div>

      {/* Photos */}
      {post.photos && post.photos.length > 0 && (
        <div className="px-4 pb-3">
          <AlbumPhotoGrid
            photos={post.photos.slice(0, 5)}
            totalPhotoCount={post.photos.length}
          />
        </div>
      )}

      {/* Pilot line */}
      {post.author && (
        <div className="px-4 pb-2 flex items-center gap-2">
          <Link to={`/profile/${post.author.username || post.author.id}`}>
            {post.author.profilePicture ? (
              <img src={post.author.profilePicture} alt={post.author.firstName} className="w-6 h-6 rounded-full object-cover" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-[10px] font-bold text-amber-600">
                {post.author.firstName?.[0]}
              </div>
            )}
          </Link>
          <span className="text-xs text-stone-500">
            <Link to={`/profile/${post.author.username || post.author.id}`} className="font-medium text-stone-700 hover:text-amber-600">{post.author.firstName} {post.author.lastName || ''}</Link>
            {pilotLabel && <span> · {pilotLabel}</span>}
          </span>
        </div>
      )}

      {/* Footer */}
      {!compact && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-stone-100">
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-1 text-stone-500 hover:text-red-500 transition-colors text-sm">
              <Heart className="w-4 h-4" />
            </button>
            <button className="flex items-center gap-1 text-stone-500 hover:text-blue-500 transition-colors text-sm">
              <MessageCircle className="w-4 h-4" />
            </button>
            <button className="flex items-center gap-1 text-stone-500 hover:text-amber-600 transition-colors text-sm">
              <ExternalLink className="w-4 h-4" />
              Share
            </button>
          </div>
          <div>
            {post.tripId && (
              <Link
                to={`/rig/${rig.slug}/trips`}
                className="flex items-center gap-1 text-amber-600 hover:text-amber-700 text-sm font-medium"
              >
                <MapPin className="w-4 h-4" />
                View Trip
              </Link>
            )}
            {post.postType === 'mod_update' && (
              <Link
                to={`/rig/${rig.slug}/mods`}
                className="flex items-center gap-1 text-amber-600 hover:text-amber-700 text-sm font-medium"
              >
                <Wrench className="w-4 h-4" />
                View Mod
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

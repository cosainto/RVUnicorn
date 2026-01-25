import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Eye, 
  Clock,
  Globe,
  Users,
  Lock,
  Pin,
  Bookmark,
  BookmarkCheck
} from 'lucide-react';
import { PhotoReactions } from './PhotoReactions'; // Reuse for videos

interface VideoCardProps {
  video: {
    id: string;
    title: string;
    description?: string;
    videoUrl: string;
    thumbnailUrl?: string;
    duration?: number;
    visibility: string;
    isPinned?: boolean;
    viewCount: number;
    user: {
      id: string;
      username: string;
      firstName: string;
      lastName: string;
      profilePicture: string | null;
    };
    reactionCounts?: Record<string, number>;
    userReactions?: string[];
    totalReactions?: number;
    isSaved?: boolean;
    createdAt: string;
  };
  onReact?: (videoId: string, type: string) => void;
  onSave?: (videoId: string) => void;
  compact?: boolean;
  autoplay?: boolean;
}

export const VideoCard: React.FC<VideoCardProps> = ({
  video,
  onReact,
  onSave,
  compact = false,
  autoplay = false,
}) => {
  const [isPlaying, setIsPlaying] = useState(autoplay);
  const [isMuted, setIsMuted] = useState(true);
  const [showControls, setShowControls] = useState(false);
  const [saving, setSaving] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const togglePlay = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (onSave) {
      setSaving(true);
      await onSave(video.id);
      setSaving(false);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getVisibilityIcon = () => {
    switch (video.visibility) {
      case 'PUBLIC': return <Globe size={12} className="text-green-500" />;
      case 'FRIENDS': return <Users size={12} className="text-blue-500" />;
      case 'PRIVATE': return <Lock size={12} className="text-gray-500" />;
      default: return null;
    }
  };

  if (compact) {
    // Compact card for feeds
    return (
      <Link 
        to={`/videos/${video.id}`}
        className="block bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
      >
        <div 
          className="relative aspect-video bg-black"
          onMouseEnter={() => setShowControls(true)}
          onMouseLeave={() => setShowControls(false)}
        >
          {video.thumbnailUrl && !isPlaying ? (
            <img
              src={video.thumbnailUrl}
              alt={video.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <video
              ref={videoRef}
              src={video.videoUrl}
              className="w-full h-full object-cover"
              muted={isMuted}
              loop
              playsInline
              onEnded={() => setIsPlaying(false)}
            />
          )}

          {/* Duration badge */}
          {video.duration && (
            <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
              {formatDuration(video.duration)}
            </div>
          )}

          {/* Play button overlay */}
          {!isPlaying && (
            <button
              onClick={togglePlay}
              className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity"
            >
              <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center">
                <Play size={24} className="text-gray-900 ml-1" />
              </div>
            </button>
          )}

          {/* Controls */}
          {showControls && isPlaying && (
            <div className="absolute bottom-2 left-2 flex gap-2">
              <button
                onClick={togglePlay}
                className="p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70"
              >
                {isPlaying ? <Pause size={14} /> : <Play size={14} />}
              </button>
              <button
                onClick={toggleMute}
                className="p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70"
              >
                {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
            </div>
          )}

          {/* Pinned indicator */}
          {video.isPinned && (
            <div className="absolute top-2 left-2 bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1">
              <Pin size={10} className="fill-current" />
              Pinned
            </div>
          )}
        </div>

        <div className="p-3">
          <div className="flex items-start gap-2">
            {video.user.profilePicture ? (
              <img
                src={video.user.profilePicture}
                alt=""
                className="w-8 h-8 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-medium flex-shrink-0">
                {video.user.firstName?.[0]}{video.user.lastName?.[0]}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-gray-900 truncate">{video.title}</h3>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>{video.user.firstName} {video.user.lastName}</span>
                <span>•</span>
                <span className="flex items-center gap-0.5">
                  <Eye size={12} />
                  {video.viewCount}
                </span>
                {getVisibilityIcon()}
              </div>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  // Full card with reactions
  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm">
      {/* Video player */}
      <div 
        className="relative aspect-video bg-black"
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => setShowControls(false)}
      >
        <video
          ref={videoRef}
          src={video.videoUrl}
          poster={video.thumbnailUrl}
          className="w-full h-full object-contain"
          muted={isMuted}
          playsInline
          onClick={togglePlay}
          onEnded={() => setIsPlaying(false)}
        />

        {/* Duration badge */}
        {video.duration && !isPlaying && (
          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
            <Clock size={12} />
            {formatDuration(video.duration)}
          </div>
        )}

        {/* Play button overlay */}
        {!isPlaying && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/30"
          >
            <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center hover:scale-110 transition-transform">
              <Play size={32} className="text-gray-900 ml-1" />
            </div>
          </button>
        )}

        {/* Controls */}
        {(showControls || isPlaying) && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  onClick={togglePlay}
                  className="p-2 bg-white/20 text-white rounded-full hover:bg-white/30"
                >
                  {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                </button>
                <button
                  onClick={toggleMute}
                  className="p-2 bg-white/20 text-white rounded-full hover:bg-white/30"
                >
                  {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Video Info */}
      <div className="p-4">
        {/* User info */}
        <div className="flex items-center gap-3 mb-3">
          <Link to={`/profile/${video.user.username}`}>
            {video.user.profilePicture ? (
              <img
                src={video.user.profilePicture}
                alt=""
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium">
                {video.user.firstName?.[0]}{video.user.lastName?.[0]}
              </div>
            )}
          </Link>
          <div className="flex-1 min-w-0">
            <Link 
              to={`/videos/${video.id}`}
              className="font-semibold text-gray-900 hover:underline block truncate"
            >
              {video.title}
            </Link>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Link to={`/profile/${video.user.username}`} className="hover:underline">
                {video.user.firstName} {video.user.lastName}
              </Link>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Eye size={14} />
                {video.viewCount} views
              </span>
              {getVisibilityIcon()}
            </div>
          </div>
        </div>

        {/* Description */}
        {video.description && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {video.description}
          </p>
        )}

        {/* Reactions */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          {onReact && (
            <PhotoReactions
              photoId={video.id}
              reactionCounts={video.reactionCounts || {}}
              userReactions={video.userReactions || []}
              totalReactions={video.totalReactions || 0}
              onReact={onReact}
              compact
            />
          )}

          {onSave && (
            <button
              onClick={handleSave}
              disabled={saving}
              className={`
                p-2 rounded-full transition-colors
                ${video.isSaved 
                  ? 'text-amber-600 bg-amber-50 hover:bg-amber-100' 
                  : 'text-gray-500 hover:bg-gray-100'
                }
              `}
            >
              {video.isSaved ? (
                <BookmarkCheck size={20} className="fill-current" />
              ) : (
                <Bookmark size={20} />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoCard;

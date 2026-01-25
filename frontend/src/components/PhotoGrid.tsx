import React, { useState } from 'react';
import { Heart, Eye, Lock, Users, MoreVertical, Pencil, Trash2, Tag } from 'lucide-react';
import { VisibilityBadge } from './VisibilitySelector';
import api from '../services/api';

interface Photo {
  id: string;
  imageUrl: string;
  caption?: string;
  visibility: 'PUBLIC' | 'FRIENDS' | 'PRIVATE';
  likeCount: number;
  isLiked: boolean;
  createdAt: string;
  user: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
  };
  userTags?: Array<{
    user: { id: string; username: string; firstName: string; lastName: string };
  }>;
  campgroundTags?: Array<{
    campground: { id: string; name: string };
  }>;
}

interface PhotoGridProps {
  photos: Photo[];
  currentUserId?: string;
  onPhotoClick?: (photo: Photo) => void;
  onLike?: (photoId: string, liked: boolean, newCount: number) => void;
  onDelete?: (photoId: string) => void;
  onEdit?: (photo: Photo) => void;
  columns?: 2 | 3 | 4;
  showVisibility?: boolean;
  showUser?: boolean;
}

export const PhotoGrid: React.FC<PhotoGridProps> = ({
  photos,
  currentUserId,
  onPhotoClick,
  onLike,
  onDelete,
  onEdit,
  columns = 3,
  showVisibility = true,
  showUser = false,
}) => {
  const [likingPhoto, setLikingPhoto] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [photoStates, setPhotoStates] = useState<Record<string, { isLiked: boolean; likeCount: number }>>({});

  const getPhotoState = (photo: Photo) => {
    return photoStates[photo.id] || { isLiked: photo.isLiked, likeCount: photo.likeCount };
  };

  const handleLike = async (e: React.MouseEvent, photo: Photo) => {
    e.stopPropagation();
    if (likingPhoto === photo.id) return;

    setLikingPhoto(photo.id);
    try {
      const response = await api.post(`/photos/${photo.id}/like`);
      setPhotoStates((prev) => ({
        ...prev,
        [photo.id]: { isLiked: response.data.liked, likeCount: response.data.likeCount },
      }));
      onLike?.(photo.id, response.data.liked, response.data.likeCount);
    } catch (error) {
      console.error('Failed to like photo');
    } finally {
      setLikingPhoto(null);
    }
  };

  const handleDelete = async (photo: Photo) => {
    if (!window.confirm('Are you sure you want to delete this photo?')) return;

    try {
      await api.delete(`/photos/${photo.id}`);
      console.log('Photo deleted');
      onDelete?.(photo.id);
    } catch (error) {
      console.error('Failed to delete photo');
    }
    setMenuOpenId(null);
  };

  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 sm:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
  };

  if (photos.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <Eye className="w-8 h-8 text-gray-400" />
        </div>
        <p className="text-gray-500">No photos yet</p>
      </div>
    );
  }

  return (
    <div className={`grid ${gridCols[columns]} gap-3`}>
      {photos.map((photo) => {
        const state = getPhotoState(photo);
        const isOwner = currentUserId === photo.user.id;
        const hasTags = (photo.userTags?.length || 0) + (photo.campgroundTags?.length || 0) > 0;

        return (
          <div
            key={photo.id}
            className="relative group cursor-pointer aspect-square rounded-lg overflow-hidden bg-gray-100"
            onClick={() => onPhotoClick?.(photo)}
          >
            {/* Photo Image */}
            <img
              src={photo.imageUrl}
              alt={photo.caption || 'Photo'}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />

            {/* Overlay on Hover */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors">
              {/* Top Row - Visibility & Menu */}
              <div className="absolute top-2 left-2 right-2 flex justify-between items-start opacity-0 group-hover:opacity-100 transition-opacity">
                {showVisibility && (
                  <VisibilityBadge visibility={photo.visibility} />
                )}
                
                {isOwner && (
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenId(menuOpenId === photo.id ? null : photo.id);
                      }}
                      className="p-1.5 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
                    >
                      <MoreVertical className="w-4 h-4 text-white" />
                    </button>
                    {menuOpenId === photo.id && (
                      <div className="absolute right-0 top-8 bg-white rounded-lg shadow-lg border py-1 min-w-[120px] z-20">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit?.(photo);
                            setMenuOpenId(null);
                          }}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full"
                        >
                          <Pencil className="w-4 h-4" />
                          Edit
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(photo);
                          }}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 w-full"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Bottom Row - Stats & Like */}
              <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Tags indicator */}
                {hasTags && (
                  <div className="flex items-center gap-1 text-white text-xs bg-black/50 px-2 py-1 rounded-full">
                    <Tag className="w-3 h-3" />
                    {(photo.userTags?.length || 0) + (photo.campgroundTags?.length || 0)}
                  </div>
                )}

                {/* Like Button */}
                <button
                  onClick={(e) => handleLike(e, photo)}
                  disabled={likingPhoto === photo.id}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors ${
                    state.isLiked
                      ? 'bg-red-500 text-white'
                      : 'bg-black/50 text-white hover:bg-black/70'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${state.isLiked ? 'fill-current' : ''}`} />
                  <span className="text-sm font-medium">{state.likeCount}</span>
                </button>
              </div>
            </div>

            {/* Always visible indicators for non-public photos */}
            {!showVisibility && photo.visibility !== 'PUBLIC' && (
              <div className="absolute top-2 left-2">
                {photo.visibility === 'PRIVATE' ? (
                  <div className="p-1.5 bg-gray-900/70 rounded-full">
                    <Lock className="w-3 h-3 text-white" />
                  </div>
                ) : (
                  <div className="p-1.5 bg-blue-600/70 rounded-full">
                    <Users className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// Photo Lightbox component for viewing individual photos
interface PhotoLightboxProps {
  photo: Photo | null;
  photos: Photo[];
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  currentUserId?: string;
  onLike?: (photoId: string, liked: boolean, newCount: number) => void;
}

export const PhotoLightbox: React.FC<PhotoLightboxProps> = ({
  photo,
  photos,
  onClose,
  onNext,
  onPrev,
  currentUserId,
  onLike,
}) => {
  const [isLiked, setIsLiked] = useState(photo?.isLiked || false);
  const [likeCount, setLikeCount] = useState(photo?.likeCount || 0);
  const [liking, setLiking] = useState(false);

  React.useEffect(() => {
    if (photo) {
      setIsLiked(photo.isLiked);
      setLikeCount(photo.likeCount);
    }
  }, [photo?.id]);

  if (!photo) return null;

  const currentIndex = photos.findIndex((p) => p.id === photo.id);
  const hasNext = currentIndex < photos.length - 1;
  const hasPrev = currentIndex > 0;

  const handleLike = async () => {
    if (liking) return;
    setLiking(true);
    try {
      const response = await api.post(`/photos/${photo.id}/like`);
      setIsLiked(response.data.liked);
      setLikeCount(response.data.likeCount);
      onLike?.(photo.id, response.data.liked, response.data.likeCount);
    } catch (error) {
      console.error('Failed to like photo');
    } finally {
      setLiking(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowRight' && hasNext) onNext();
    if (e.key === 'ArrowLeft' && hasPrev) onPrev();
  };

  React.useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex]);

  return (
    <div
      className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 text-white hover:text-gray-300 z-10"
      >
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Navigation */}
      {hasPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 rounded-full text-white hover:bg-white/20 z-10"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
      {hasNext && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 rounded-full text-white hover:bg-white/20 z-10"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Image */}
      <div
        className="max-w-[90vw] max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={photo.imageUrl}
          alt={photo.caption || 'Photo'}
          className="max-w-full max-h-[70vh] object-contain rounded-lg"
        />

        {/* Info bar */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg mt-4 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={photo.user.profilePicture || '/default-avatar.png'}
              alt={photo.user.username}
              className="w-10 h-10 rounded-full object-cover"
            />
            <div>
              <p className="text-white font-medium">
                {photo.user.firstName} {photo.user.lastName}
              </p>
              {photo.caption && (
                <p className="text-white/70 text-sm">{photo.caption}</p>
              )}
            </div>
          </div>

          <button
            onClick={handleLike}
            disabled={liking}
            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${
              isLiked
                ? 'bg-red-500 text-white'
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
          >
            <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
            <span>{likeCount}</span>
          </button>
        </div>

        {/* Counter */}
        <p className="text-white/50 text-center mt-2 text-sm">
          {currentIndex + 1} / {photos.length}
        </p>
      </div>
    </div>
  );
};

export default PhotoGrid;

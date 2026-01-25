import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, Upload, Trash2, Edit2, Play,
  Heart, ThumbsUp, MessageCircle,
  X, ChevronLeft, ChevronRight, Lock, Users, Globe
} from 'lucide-react';
import api from '../services/api';
import PhotoTagger from '../components/PhotoTagger';
import { useAuth } from '../contexts/AuthContext';

interface Media {
  id: string;
  type: 'PHOTO' | 'VIDEO';
  url: string;
  thumbnailUrl: string | null;
  hlsUrl: string | null;
  mp4UrlHd: string | null;
  mp4UrlSd: string | null;
  caption: string | null;
  width: number;
  height: number;
  duration: number | null;
  processingStatus: string | null;
  createdAt: string;
}

interface Album {
  id: string;
  title: string;
  description: string | null;
  defaultVisibility: 'PUBLIC' | 'FRIENDS_ONLY' | 'PRIVATE';
  discoveryEnabled: boolean;
  featured: boolean;
  userId: string;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture: string | null;
  };
  media: Media[];
  mediaCount: number;
}

export default function MediaAlbumDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [album, setAlbum] = useState<Album | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isOwner = user?.id === album?.userId;
  const [isFriend, setIsFriend] = useState(false);

  useEffect(() => {
    const checkFriendship = async () => {
      if (!user || !album || isOwner) return;
      try {
        const { data } = await api.get(`/friends/status/${album.userId}`);
        setIsFriend(data.status === 'ACCEPTED');
      } catch (error) {
        console.log('Could not check friendship status');
      }
    };
    checkFriendship();
  }, [user, album, isOwner]);

  const canTag = isOwner || isFriend;
  console.log('[DEBUG] canTag:', canTag, 'isOwner:', isOwner, 'isFriend:', isFriend);

  useEffect(() => {
    if (id) fetchAlbum();
  }, [id]);

  const fetchAlbum = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/media-albums/${id}`);
      setAlbum(data);
    } catch (error) {
      console.error('Error fetching album:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (files: FileList) => {
    if (!album || files.length === 0) return;

    const formData = new FormData();
    Array.from(files).forEach(file => formData.append('files', file));

    try {
      setUploading(true);
      setUploadProgress(0);
      
      const { data } = await api.post(`/media-albums/${album.id}/media`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        },
      });

      setAlbum(prev => prev ? {
        ...prev,
        media: [...data.media, ...prev.media],
        mediaCount: prev.mediaCount + data.uploaded,
      } : null);
      
      setShowUploadModal(false);
    } catch (error) {
      console.error('Error uploading:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteMedia = async (mediaId: string) => {
    if (!album || !confirm('Delete this item?')) return;

    try {
      await api.delete(`/media-albums/${album.id}/media/${mediaId}`);
      setAlbum(prev => prev ? {
        ...prev,
        media: prev.media.filter(m => m.id !== mediaId),
        mediaCount: prev.mediaCount - 1,
      } : null);
      setSelectedMedia(null);
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  const handleDeleteAlbum = async () => {
    if (!album || !confirm('Delete this entire album? This cannot be undone.')) return;

    try {
      await api.delete(`/media-albums/${album.id}`);
      navigate('/media-albums');
    } catch (error) {
      console.error('Error deleting album:', error);
    }
  };

  const openViewer = (media: Media, index: number) => {
    setSelectedMedia(media);
    setViewerIndex(index);
    // Log impression
    api.post(`/media-albums/media/${media.id}/impressions`, { source: 'ALBUM' }).catch(() => {});
  };

  const navigateViewer = (direction: 'prev' | 'next') => {
    if (!album) return;
    const newIndex = direction === 'prev' 
      ? (viewerIndex - 1 + album.media.length) % album.media.length
      : (viewerIndex + 1) % album.media.length;
    setViewerIndex(newIndex);
    setSelectedMedia(album.media[newIndex]);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!album) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Album not found</h2>
        <Link to="/media-albums" className="text-blue-600 hover:underline">
          Back to albums
        </Link>
      </div>
    );
  }

  const visibilityInfo = {
    PUBLIC: { icon: Globe, label: 'Public', color: 'text-green-600' },
    FRIENDS_ONLY: { icon: Users, label: 'Friends Only', color: 'text-blue-600' },
    PRIVATE: { icon: Lock, label: 'Private', color: 'text-gray-600' },
  };
  const VisIcon = visibilityInfo[album.defaultVisibility].icon;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link to="/media-albums" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="w-5 h-5" />
          Back to albums
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-gray-900">{album.title}</h1>
              <span className={`flex items-center gap-1 text-sm ${visibilityInfo[album.defaultVisibility].color}`}>
                <VisIcon className="w-4 h-4" />
                {visibilityInfo[album.defaultVisibility].label}
              </span>
            </div>
            {album.description && (
              <p className="text-gray-600 mt-2">{album.description}</p>
            )}
            <div className="flex items-center gap-3 mt-3">
              <Link to={`/profile/${album.user.username}`} className="flex items-center gap-2">
                <img
                  src={album.user.profilePicture || '/default-avatar.png'}
                  alt=""
                  className="w-8 h-8 rounded-full"
                />
                <span className="font-medium text-gray-900">
                  {album.user.firstName} {album.user.lastName}
                </span>
              </Link>
              <span className="text-gray-400">•</span>
              <span className="text-gray-500">{album.mediaCount} items</span>
            </div>
          </div>

          {isOwner && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <Upload className="w-5 h-5" />
                Upload
              </button>
              <button
                onClick={() => setShowEditModal(true)}
                className="p-2 border rounded-lg hover:bg-gray-50 transition"
              >
                <Edit2 className="w-5 h-5" />
              </button>
              <button
                onClick={handleDeleteAlbum}
                className="p-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Media Grid */}
      {album.media.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl">
          <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No media yet</h3>
          {isOwner && (
            <>
              <p className="text-gray-600 mb-6">Upload photos and videos to this album</p>
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Upload Media
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
          {album.media.map((media, index) => (
            <div
              key={media.id}
              onClick={() => openViewer(media, index)}
              className="aspect-square relative group cursor-pointer overflow-hidden rounded-lg bg-gray-100"
            >
              <img
                src={media.thumbnailUrl || media.url}
                alt={media.caption || ''}
                className="w-full h-full object-cover transition group-hover:scale-105"
              />
              {media.type === 'VIDEO' && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 bg-black/50 rounded-full flex items-center justify-center">
                    <Play className="w-6 h-6 text-white ml-1" />
                  </div>
                  {media.duration && (
                    <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                      {Math.floor(media.duration / 60)}:{(media.duration % 60).toString().padStart(2, '0')}
                    </span>
                  )}
                </div>
              )}
              {media.processingStatus === 'PROCESSING' && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="text-white text-sm">Processing...</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Upload Media</h2>
              <button onClick={() => setShowUploadModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:border-blue-500 transition"
            >
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">Click to select files or drag and drop</p>
              <p className="text-sm text-gray-400">Photos and videos up to 500MB</p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={(e) => e.target.files && handleUpload(e.target.files)}
              className="hidden"
            />

            {uploading && (
              <div className="mt-4">
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Media Viewer */}
      {selectedMedia && (
        <MediaViewer
          media={selectedMedia}
          album={album}
          isOwner={canTag}
          onClose={() => setSelectedMedia(null)}
          onPrev={() => navigateViewer('prev')}
          onNext={() => navigateViewer('next')}
          onDelete={() => handleDeleteMedia(selectedMedia.id)}
          currentIndex={viewerIndex}
          totalCount={album.media.length}
        />
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <EditAlbumModal
          album={album}
          onClose={() => setShowEditModal(false)}
          onUpdated={(updated) => {
            setAlbum(prev => prev ? { ...prev, ...updated } : null);
            setShowEditModal(false);
          }}
        />
      )}
    </div>
  );
}

function MediaViewer({
  media,
  album,
  isOwner,
  onClose,
  onPrev,
  onNext,
  onDelete,
  currentIndex,
  totalCount,
}: {
  media: Media;
  album: Album;
  isOwner: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onDelete: () => void;
  currentIndex: number;
  totalCount: number;
}) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [_reactions, _setReactions] = useState<{ type: string; count: number; hasReacted: boolean }[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { user } = useAuth();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onPrev, onNext]);

  useEffect(() => {
    fetchComments();
  }, [media.id]);

  const fetchComments = async () => {
    try {
      const { data } = await api.get(`/media-albums/media/${media.id}/comments`);
      setComments(data);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    try {
      const { data } = await api.post(`/media-albums/media/${media.id}/comments`, {
        content: newComment.trim(),
      });
      setComments([data, ...comments]);
      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const handleReaction = async (type: string) => {
    try {
      await api.post(`/media-albums/media/${media.id}/reactions`, { type });
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Navigation */}
      {totalCount > 1 && (
        <>
          <button
            onClick={onPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>
          <button
            onClick={onNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition"
          >
            <ChevronRight className="w-8 h-8" />
          </button>
        </>
      )}

      {/* Counter */}
      <div className="absolute top-4 left-4 z-10 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
        {currentIndex + 1} / {totalCount}
      </div>

      {/* Media Display */}
      <div className="flex-1 flex items-center justify-center p-8">
        {media.type === 'PHOTO' ? (
          <div className="relative max-h-full max-w-full">
            <PhotoTagger mediaId={media.id} isOwner={isOwner}>
              <img
                src={media.url}
                alt={media.caption || ''}
                className="max-h-full max-w-full object-contain"
              />
            </PhotoTagger>
          </div>
        ) : (
          <video
            ref={videoRef}
            src={media.mp4UrlHd || media.mp4UrlSd || media.url}
            poster={media.thumbnailUrl || undefined}
            controls
            autoPlay
            className="max-h-full max-w-full"
          />
        )}
      </div>

      {/* Sidebar */}
      <div className={`w-80 bg-white flex flex-col ${showComments ? '' : 'hidden lg:flex'}`}>
        {/* Header */}
        <div className="p-4 border-b">
          <Link to={`/profile/${album.user.username}`} className="flex items-center gap-3">
            <img
              src={album.user.profilePicture || '/default-avatar.png'}
              alt=""
              className="w-10 h-10 rounded-full"
            />
            <div>
              <span className="font-medium block">
                {album.user.firstName} {album.user.lastName}
              </span>
              <span className="text-sm text-gray-500">{album.title}</span>
            </div>
          </Link>
        </div>

        {/* Caption */}
        {media.caption && (
          <div className="p-4 border-b">
            <p className="text-gray-700">{media.caption}</p>
          </div>
        )}

        {/* Actions */}
        <div className="p-4 border-b flex items-center gap-4">
          <button onClick={() => handleReaction('LIKE')} className="flex items-center gap-1 text-gray-600 hover:text-blue-600">
            <ThumbsUp className="w-5 h-5" />
          </button>
          <button onClick={() => handleReaction('LOVE')} className="flex items-center gap-1 text-gray-600 hover:text-red-600">
            <Heart className="w-5 h-5" />
          </button>
          <button onClick={() => setShowComments(!showComments)} className="flex items-center gap-1 text-gray-600 hover:text-blue-600">
            <MessageCircle className="w-5 h-5" />
            <span className="text-sm">{comments.length}</span>
          </button>
          {isOwner && (
            <button onClick={onDelete} className="ml-auto text-gray-600 hover:text-red-600">
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Comments */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <img
                src={comment.user?.profilePicture || '/default-avatar.png'}
                alt=""
                className="w-8 h-8 rounded-full flex-shrink-0"
              />
              <div>
                <span className="font-medium text-sm">
                  {comment.user?.firstName} {comment.user?.lastName}
                </span>
                <p className="text-gray-700 text-sm">{comment.content}</p>
              </div>
            </div>
          ))}
          {comments.length === 0 && (
            <p className="text-gray-500 text-center py-8">No comments yet</p>
          )}
        </div>

        {/* Add Comment */}
        {user && (
          <div className="p-4 border-t">
            <div className="flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 px-3 py-2 border rounded-lg text-sm"
                onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
              />
              <button
                onClick={handleAddComment}
                disabled={!newComment.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                Post
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EditAlbumModal({
  album,
  onClose,
  onUpdated,
}: {
  album: Album;
  onClose: () => void;
  onUpdated: (album: Partial<Album>) => void;
}) {
  const [title, setTitle] = useState(album.title);
  const [description, setDescription] = useState(album.description || '');
  const [visibility, setVisibility] = useState(album.defaultVisibility);
  const [discoveryEnabled, setDiscoveryEnabled] = useState(album.discoveryEnabled);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      setLoading(true);
      const { data } = await api.patch(`/media-albums/${album.id}`, {
        title: title.trim(),
        description: description.trim() || null,
        defaultVisibility: visibility,
        discoveryEnabled,
      });
      onUpdated(data);
    } catch (error) {
      console.error('Error updating album:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <h2 className="text-xl font-bold mb-4">Edit Album</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Visibility</label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as any)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="PUBLIC">Public</option>
              <option value="FRIENDS_ONLY">Friends Only</option>
              <option value="PRIVATE">Private</option>
            </select>
          </div>
          {visibility === 'PUBLIC' && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={discoveryEnabled}
                onChange={(e) => setDiscoveryEnabled(e.target.checked)}
                className="rounded text-blue-600"
              />
              <span className="text-sm text-gray-700">Enable discovery</span>
            </label>
          )}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

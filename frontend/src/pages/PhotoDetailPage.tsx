import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Globe, 
  Users, 
  Lock, 
  Pin,
  MoreHorizontal,
  Edit,
  Trash2,
  Calendar
} from 'lucide-react';

// Import the new components
import { PhotoReactions, usePhotoReactions } from '../components/PhotoReactions';
import { PhotoTagger, PhotoTagsDisplay } from '../components/PhotoTagger';
import { MentionText } from '../components/MentionInput';
import { PhotoActions } from '../components/PhotoActions';

interface Photo {
  id: string;
  imageUrl: string;
  caption: string;
  visibility: string;
  isPinned: boolean;
  allowDownload: boolean;
  viewCount: number;
  createdAt: string;
  scheduledFor?: string;
  publishedAt?: string;
  user: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    profilePicture: string | null;
  };
  album?: {
    id: string;
    title: string;
  };
  userTags: Array<{
    id: string;
    userId: string;
    xPosition: number | null;
    yPosition: number | null;
    user: {
      id: string;
      username: string;
      firstName: string;
      lastName: string;
      profilePicture: string | null;
    };
  }>;
  reactionCounts: Record<string, number>;
  userReactions: string[];
  totalReactions: number;
  isSaved: boolean;
  saveCount: number;
}

export const PhotoDetailPage: React.FC = () => {
  const { photoId } = useParams<{ photoId: string }>();
  const navigate = useNavigate();
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showEditMenu, setShowEditMenu] = useState(false);
  const [isTagging, setIsTagging] = useState(false);
  
  const { react } = usePhotoReactions();
  const currentUserId = localStorage.getItem('userId');

  useEffect(() => {
    fetchPhoto();
  }, [photoId]);

  const fetchPhoto = async () => {
    try {
      const response = await fetch(`/api/photos/${photoId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (!response.ok) {
        if (response.status === 404) throw new Error('Photo not found');
        if (response.status === 403) throw new Error('You don\'t have permission to view this photo');
        throw new Error('Failed to load photo');
      }

      const data = await response.json();
      setPhoto(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReact = async (photoId: string, type: string) => {
    const result = await react(photoId, type);
    if (result && photo) {
      setPhoto({
        ...photo,
        reactionCounts: result.reactionCounts,
        totalReactions: result.totalReactions,
        userReactions: result.added 
          ? [...photo.userReactions.filter(r => r !== type), type]
          : photo.userReactions.filter(r => r !== type)
      });
    }
  };

  const handleSave = async (photoId: string) => {
    try {
      const response = await fetch(`/api/photos/${photoId}/save`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (response.ok && photo) {
        const result = await response.json();
        setPhoto({
          ...photo,
          isSaved: result.saved,
          saveCount: result.saveCount
        });
      }
    } catch (error) {
      console.error('Error saving photo:', error);
    }
  };

  const handleTagAdded = (newTag: any) => {
    if (photo) {
      setPhoto({
        ...photo,
        userTags: [...photo.userTags, newTag]
      });
    }
  };

  const handleTagRemoved = (tagId: string, userId: string) => {
    if (photo) {
      setPhoto({
        ...photo,
        userTags: photo.userTags.filter(t => t.userId !== userId)
      });
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this photo?')) return;

    try {
      const response = await fetch(`/api/photos/${photoId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (response.ok) {
        navigate(-1);
      }
    } catch (error) {
      console.error('Error deleting photo:', error);
    }
  };

  const handlePin = async () => {
    try {
      const response = await fetch(`/api/photos/${photoId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ isPinned: !photo?.isPinned })
      });

      if (response.ok && photo) {
        const result = await response.json();
        setPhoto({ ...photo, isPinned: result.isPinned });
      }
    } catch (error) {
      console.error('Error pinning photo:', error);
    }
  };

  const getVisibilityIcon = (visibility: string) => {
    switch (visibility) {
      case 'PUBLIC': return <Globe size={16} className="text-green-500" />;
      case 'FRIENDS': return <Users size={16} className="text-blue-500" />;
      case 'PRIVATE': return <Lock size={16} className="text-gray-500" />;
      default: return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !photo) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{error || 'Photo not found'}</h2>
          <button onClick={() => navigate(-1)} className="text-blue-500 hover:underline">
            Go back
          </button>
        </div>
      </div>
    );
  }

  const isOwner = photo.user.id === currentUserId;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <button 
            onClick={() => navigate(-1)} 
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={20} />
            Back
          </button>

          <div className="flex items-center gap-3">
            {getVisibilityIcon(photo.visibility)}
            {photo.isPinned && (
              <span className="flex items-center gap-1 text-amber-600 text-sm">
                <Pin size={14} className="fill-current" />
                Pinned
              </span>
            )}
            
            {isOwner && (
              <div className="relative">
                <button 
                  onClick={() => setShowEditMenu(!showEditMenu)}
                  className="p-2 text-gray-500 hover:bg-gray-100 rounded-full"
                >
                  <MoreHorizontal size={20} />
                </button>

                {showEditMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-30">
                    <button
                      onClick={() => navigate(`/photos/${photo.id}/edit`)}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <Edit size={16} />
                      Edit Photo
                    </button>
                    <button
                      onClick={handlePin}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <Pin size={16} className={photo.isPinned ? 'fill-amber-500 text-amber-500' : ''} />
                      {photo.isPinned ? 'Unpin from Profile' : 'Pin to Profile'}
                    </button>
                    <hr className="my-1" />
                    <button
                      onClick={handleDelete}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={16} />
                      Delete Photo
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {/* Photo with Tags */}
          <div className="relative">
            {isTagging ? (
              <PhotoTagger
                photoId={photo.id}
                imageUrl={photo.imageUrl}
                existingTags={photo.userTags}
                isOwner={isOwner}
                currentUserId={currentUserId || undefined}
                onTagAdded={handleTagAdded}
                onTagRemoved={handleTagRemoved}
              />
            ) : (
              <div className="relative">
                <img
                  src={photo.imageUrl}
                  alt={photo.caption || 'Photo'}
                  className="w-full"
                />
                <PhotoTagsDisplay tags={photo.userTags} showOnHover />
              </div>
            )}
          </div>

          {/* Photo Info */}
          <div className="p-4">
            {/* User Info */}
            <div className="flex items-center gap-3 mb-4">
              <Link to={`/profile/${photo.user.username}`}>
                {photo.user.profilePicture ? (
                  <img
                    src={photo.user.profilePicture}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium">
                    {photo.user.firstName?.[0]}{photo.user.lastName?.[0]}
                  </div>
                )}
              </Link>
              <div>
                <Link 
                  to={`/profile/${photo.user.username}`}
                  className="font-semibold text-gray-900 hover:underline"
                >
                  {photo.user.firstName} {photo.user.lastName}
                </Link>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span>{new Date(photo.createdAt).toLocaleDateString()}</span>
                  {photo.album && (
                    <>
                      <span>•</span>
                      <Link to={`/albums/${photo.album.id}`} className="hover:underline">
                        {photo.album.title}
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Caption with Mentions */}
            {photo.caption && (
              <div className="mb-4">
                <MentionText text={photo.caption} className="text-gray-800 whitespace-pre-wrap" />
              </div>
            )}

            {/* Tagged People */}
            {photo.userTags.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                <span className="text-sm text-gray-500">In this photo:</span>
                {photo.userTags.map(tag => (
                  <Link
                    key={tag.id}
                    to={`/profile/${tag.user.username}`}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-full text-sm hover:bg-gray-200"
                  >
                    {tag.user.profilePicture && (
                      <img src={tag.user.profilePicture} alt="" className="w-4 h-4 rounded-full" />
                    )}
                    {tag.user.firstName} {tag.user.lastName}
                  </Link>
                ))}
              </div>
            )}

            {/* Stats */}
            <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
              <span>{photo.viewCount} views</span>
              <span>{photo.totalReactions} reactions</span>
              <span>{photo.saveCount} saves</span>
            </div>

            {/* Reactions */}
            <div className="border-t border-gray-100 pt-4">
              <PhotoReactions
                photoId={photo.id}
                reactionCounts={photo.reactionCounts}
                userReactions={photo.userReactions}
                totalReactions={photo.totalReactions}
                onReact={handleReact}
              />
            </div>

            {/* Actions */}
            <div className="border-t border-gray-100 pt-4 mt-4">
              <PhotoActions
                photoId={photo.id}
                isSaved={photo.isSaved}
                saveCount={photo.saveCount}
                allowDownload={photo.allowDownload}
                imageUrl={photo.imageUrl}
                visibility={photo.visibility}
                onSave={handleSave}
              />
            </div>

            {/* Tag Button (for owner) */}
            {isOwner && (
              <div className="border-t border-gray-100 pt-4 mt-4">
                <button
                  onClick={() => setIsTagging(!isTagging)}
                  className={`
                    px-4 py-2 rounded-lg text-sm font-medium
                    ${isTagging 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }
                  `}
                >
                  {isTagging ? 'Done Tagging' : 'Tag People'}
                </button>
              </div>
            )}

            {/* Scheduled indicator */}
            {photo.scheduledFor && !photo.publishedAt && (
              <div className="border-t border-gray-100 pt-4 mt-4">
                <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-3 rounded-lg">
                  <Calendar size={18} />
                  <span>Scheduled for {new Date(photo.scheduledFor).toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Click outside to close menu */}
      {showEditMenu && (
        <div className="fixed inset-0 z-10" onClick={() => setShowEditMenu(false)} />
      )}
    </div>
  );
};

export default PhotoDetailPage;

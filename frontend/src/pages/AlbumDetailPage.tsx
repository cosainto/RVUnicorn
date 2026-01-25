import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Camera,
  Heart,
  MessageCircle,
  Trash2,
  Upload,
  X,
  ArrowLeft,
  Lock,
  Users,
  Globe,
  Image as ImageIcon,
  Send,
  Tag,
  UserPlus,
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface PhotoPreview {
  file: File;
  preview: string;
  caption: string;
}

interface Friend {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  profilePicture?: string;
}

interface PhotoTag {
  id: string;
  x: number | null;
  y: number | null;
  taggedBy: string;
  user: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
  };
}

interface CampgroundTag {
  id: string;
  taggedBy: string;
  campground: {
    id: string;
    name: string;
    location: string;
    state: string;
    imageUrl?: string;
  };
}

export default function AlbumDetailPage() {
  const { albumId: id } = useParams<{ albumId: string }>();  
  const { user } = useAuth();
  const navigate = useNavigate();
  const [album, setAlbum] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<any>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [photoPreviews, setPhotoPreviews] = useState<PhotoPreview[]>([]);
  const [uploading, setUploading] = useState(false);
  const [albumCommentText, setAlbumCommentText] = useState("");
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<any[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  
  // Tagging states
  const [taggingMode, setTaggingMode] = useState(false);
  const [showTagSelector, setShowTagSelector] = useState(false);
  const [tagPosition, setTagPosition] = useState<{ x: number; y: number } | null>(null);
  const [hoveredTag, setHoveredTag] = useState<string | null>(null);
  const [photoTags, setPhotoTags] = useState<PhotoTag[]>([]);
  const [campgroundTags, setCampgroundTags] = useState<CampgroundTag[]>([]);
  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const [tagSearchResults, setTagSearchResults] = useState<any[]>([]);
  const [campgroundSearchResults, setCampgroundSearchResults] = useState<any[]>([]);
  const [tagType, setTagType] = useState<'user' | 'campground'>('user');
  const [searchingTags, setSearchingTags] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  // For new album creation
  const [albumForm, setAlbumForm] = useState({
    title: '',
    description: '',
    privacy: 'PUBLIC',
  });

  const isNewAlbum = id === 'new';
  const isOwner = album?.user?.id === user?.id;

  useEffect(() => {
    if (id && id !== 'new') {
      loadAlbum();
    } else if (id === 'new') {
      setLoading(false);
    }
    
    if (user) {
      loadFriends();
    }
  }, [id]);

  // Load tags when a photo is selected
  useEffect(() => {
    if (selectedPhoto) {
      loadPhotoComments(selectedPhoto.id);
      loadPhotoTags(selectedPhoto.id);
    } else {
      setPhotoTags([]);
      setCampgroundTags([]);
    }
  }, [selectedPhoto]);

  const loadPhotoTags = async (photoId: string) => {
    try {
      const { data } = await api.get(`/photo-tags/${photoId}/tags`);
      setPhotoTags(data.userTags || []);
      setCampgroundTags(data.campgroundTags || []);
    } catch (error) {
      console.error('Load photo tags error:', error);
    }
  };

  const loadPhotoComments = async (photoId: string) => {
    try {
      setLoadingComments(true);
      const { data } = await api.get(`/comments?photoId=${photoId}`);
      setComments(data || []);
    } catch (error) {
      console.error("Load photo comments error:", error);
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  };

  const searchForTags = async (query: string) => {
    if (!query.trim()) {
      setTagSearchResults([]);
      setCampgroundSearchResults([]);
      return;
    }
    
    setSearchingTags(true);
    try {
      if (tagType === 'user') {
        const { data } = await api.get(`/photo-tags/search/users?q=${encodeURIComponent(query)}`);
        setTagSearchResults(data);
      } else {
        const { data } = await api.get(`/photo-tags/search/campgrounds?q=${encodeURIComponent(query)}`);
        setCampgroundSearchResults(data);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearchingTags(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (tagSearchQuery) {
        searchForTags(tagSearchQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [tagSearchQuery, tagType]);

  const loadAlbum = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/photo-albums/${id}`);
      console.log('Album data with comments:', data.comments);
      setAlbum(data);
    } catch (error: any) {
      console.error('Load album error:', error);
      if (error.response?.status === 404) {
        alert('Album not found');
        navigate('/albums');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadFriends = async () => {
    try {
      const { data } = await api.get('/friends');
      console.log('Friends data:', data);
      setFriends(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Load friends error:', error);
      setFriends([]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newPreviews: PhotoPreview[] = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      caption: '',
    }));
    setPhotoPreviews([...photoPreviews, ...newPreviews]);
  };

  const removePreview = (index: number) => {
    const newPreviews = [...photoPreviews];
    URL.revokeObjectURL(newPreviews[index].preview);
    newPreviews.splice(index, 1);
    setPhotoPreviews(newPreviews);
  };

  const handleUpload = async () => {
    if (photoPreviews.length === 0) return;

    try {
      setUploading(true);
      
      for (const preview of photoPreviews) {
        const formData = new FormData();
        formData.append('photo', preview.file);
        formData.append('caption', preview.caption);
        
        await api.post(`/photo-albums/${id}/photos`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      // Clean up previews
      photoPreviews.forEach(p => URL.revokeObjectURL(p.preview));
      setPhotoPreviews([]);
      setShowUploadModal(false);
      
      // Reload album
      await loadPhotoComments(selectedPhoto.id);
      alert('Photos uploaded successfully! 🎉');
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload photos');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAlbum = async () => {
    try {
      await api.delete(`/photo-albums/${id}`);
      navigate('/albums');
    } catch (error) {
      console.error('Delete album error:', error);
      alert('Failed to delete album');
    }
  };

  const handleLikePhoto = async (photoId: string) => {
    try {
      const photo = album.photos.find((p: any) => p.id === photoId);
      const isLiked = photo?.likes?.some((like: any) => like.userId === user?.id);

      if (isLiked) {
        await api.delete(`/likes/photo/${photoId}`);
      } else {
        await api.post('/likes', { photoId });
      }

      await loadPhotoComments(selectedPhoto.id);
    } catch (error) {
      console.error('Like error:', error);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !selectedPhoto) return;

    try {
      await api.post('/comments', {
        photoId: selectedPhoto.id,
        content: commentText,
      });
      setCommentText('');
      await loadPhotoComments(selectedPhoto.id);
    } catch (error) {
      console.error('Add comment error:', error);
    }
  };

  const handleAddAlbumComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!albumCommentText.trim()) return;

    try {
      await api.post("/comments", {
        albumId: id,
        content: albumCommentText,
      });
      setAlbumCommentText("");
      await loadAlbum();
    } catch (error) {
      console.error("Add album comment error:", error);
    }
  };

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!taggingMode || !imageRef.current) return;

    const rect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setTagPosition({ x, y });
    setShowTagSelector(true);
  };

  const handleTagUser = async (userId: string) => {
    if (!selectedPhoto) return;

    try {
      await api.post(`/photo-tags/${selectedPhoto.id}/tag/user`, {
        userId,
        x: tagPosition?.x || null,
        y: tagPosition?.y || null,
      });

      await loadPhotoTags(selectedPhoto.id);
      setShowTagSelector(false);
      setTagPosition(null);
      setTaggingMode(false);
      setTagSearchQuery('');
      setTagSearchResults([]);
    } catch (error: any) {
      console.error('Tag user error:', error);
      alert(error.response?.data?.error || 'Failed to tag user');
    }
  };

  const handleTagCampground = async (campgroundId: string) => {
    if (!selectedPhoto) return;

    try {
      await api.post(`/photo-tags/${selectedPhoto.id}/tag/campground`, {
        campgroundId,
      });

      await loadPhotoTags(selectedPhoto.id);
      setShowTagSelector(false);
      setTagSearchQuery('');
      setCampgroundSearchResults([]);
    } catch (error: any) {
      console.error('Tag campground error:', error);
      alert(error.response?.data?.error || 'Failed to tag campground');
    }
  };

  const handleRemoveTag = async (tagId: string, userId: string) => {
    if (!selectedPhoto) return;
    try {
      await api.delete(`/photo-tags/${selectedPhoto.id}/tag/user/${userId}`);
      await loadPhotoTags(selectedPhoto.id);
    } catch (error) {
      console.error('Remove tag error:', error);
      alert('Failed to remove tag');
    }
  };

  const handleRemoveSelfTag = async () => {
    if (!selectedPhoto) return;
    try {
      await api.delete(`/photo-tags/${selectedPhoto.id}/tag/user/self`);
      await loadPhotoTags(selectedPhoto.id);
    } catch (error) {
      console.error('Remove self tag error:', error);
      alert('Failed to remove tag');
    }
  };

  const handleRemoveCampgroundTag = async (campgroundId: string) => {
    if (!selectedPhoto) return;
    try {
      await api.delete(`/photo-tags/${selectedPhoto.id}/tag/campground/${campgroundId}`);
      await loadPhotoTags(selectedPhoto.id);
    } catch (error) {
      console.error('Remove campground tag error:', error);
      alert('Failed to remove tag');
    }
  };

  const isUserTagged = photoTags.some(tag => tag.user.id === user?.id);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <p className="text-gray-600">Loading album...</p>
      </div>
    );
  }

  if (!album && !isNewAlbum) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <p className="text-gray-600">Album not found</p>
        <Link to="/albums" className="text-primary-600 hover:text-primary-700">
          ← Back to Albums
        </Link>
      </div>
    );
  }

  const privacyIcons = {
    PUBLIC: <Globe className="w-4 h-4" />,
    FRIENDS: <Users className="w-4 h-4" />,
    PRIVATE: <Lock className="w-4 h-4" />,
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/albums"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Albums
        </Link>

        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{album.title}</h1>
            {album.description && (
              <p className="text-gray-600 mb-4">{album.description}</p>
            )}
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-1">
                {privacyIcons[album.privacy as keyof typeof privacyIcons]}
                <span>{album.privacy}</span>
              </div>
              <span>•</span>
              <span>{album.photos?.length || 0} photos</span>
              <span>•</span>
              <span>Created {new Date(album.createdAt).toLocaleDateString()}</span>
            </div>
          </div>

          {isOwner && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowUploadModal(true)}
                className="btn btn-primary flex items-center gap-2"
              >
                <Upload className="w-5 h-5" />
                Upload Photos
              </button>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="btn btn-secondary text-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Photos Grid */}
      {album.photos && album.photos.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {album.photos.map((photo: any) => (
            <div
              key={photo.id}
              onClick={() => setSelectedPhoto(photo)}
              className="aspect-square bg-gray-200 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition relative group"
            >
              <img
                src={`${photo.imageUrl}`}
                alt={photo.caption || 'Photo'}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                <div className="flex gap-4 text-white">
                  <div className="flex items-center gap-1">
                    <Heart className="w-5 h-5" />
                    <span>{photo._count?.likes || 0}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MessageCircle className="w-5 h-5" />
                    <span>{photo._count?.comments || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Camera className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No photos yet</h3>
          <p className="text-gray-600 mb-4">Upload your first photo to this album!</p>
          {isOwner && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="btn btn-primary inline-flex items-center gap-2"
            >
              <Upload className="w-5 h-5" />
              Upload Photos
            </button>
          )}
        </div>
      )}

      {/* Comments Section */}
      {/* Always show comments section */}
      {album && (
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Album Comments</h3>
          <form onSubmit={handleAddAlbumComment} className="mb-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={albumCommentText}
                onChange={(e) => setAlbumCommentText(e.target.value)}
                placeholder="Add a comment to this album..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
                Post
              </button>
            </div>
          </form>
          <div className="space-y-4">
            {album.comments && album.comments.length > 0 && album.comments.map((comment: any) => (
              <div key={comment.id} className="flex gap-3">
                <div className="flex-shrink-0">
                  {comment.user.profilePicture ? (
                    <img
                      src={`${comment.user.profilePicture}`}
                      alt={comment.user.firstName}
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                      <Users className="w-5 h-5 text-gray-500" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <Link
                      to={`/profile/${comment.user.username}`}
                      className="font-semibold text-gray-900 hover:text-primary-600"
                    >
                      {comment.user.firstName} {comment.user.lastName}
                    </Link>
                    <p className="text-gray-700 mt-1">{comment.content}</p>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 ml-3">
                    {new Date(comment.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white p-4 rounded-t-lg sticky top-0">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Upload Photos</h2>
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    photoPreviews.forEach(p => URL.revokeObjectURL(p.preview));
                    setPhotoPreviews([]);
                  }}
                  className="text-white hover:text-gray-200"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <label className="block w-full">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary-500 transition cursor-pointer">
                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600">Click to select photos</p>
                    <p className="text-sm text-gray-500 mt-1">
                      or drag and drop
                    </p>
                  </div>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
              </div>

              {photoPreviews.length > 0 && (
                <div className="space-y-4">
                  {photoPreviews.map((preview, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex gap-4">
                        <img
                          src={preview.preview}
                          alt="Preview"
                          className="w-24 h-24 object-cover rounded"
                        />
                        <div className="flex-1">
                          <input
                            type="text"
                            value={preview.caption}
                            onChange={(e) => {
                              const newPreviews = [...photoPreviews];
                              newPreviews[index].caption = e.target.value;
                              setPhotoPreviews(newPreviews);
                            }}
                            placeholder="Add a caption..."
                            className="input mb-2"
                          />
                          <button
                            onClick={() => removePreview(index)}
                            className="text-red-500 hover:text-red-700 text-sm flex items-center gap-1"
                          >
                            <Trash2 className="w-4 h-4" />
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="btn btn-primary w-full"
                  >
                    {uploading ? 'Uploading...' : `Upload ${photoPreviews.length} Photo${photoPreviews.length !== 1 ? 's' : ''}`}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Photo Detail Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
          <div className="max-w-6xl w-full h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                {user && (
                  <button
                    onClick={() => {
                      if (taggingMode) {
                        setTaggingMode(false);
                        setShowTagSelector(false);
                        setTagPosition(null);
                      } else {
                        setTaggingMode(true);
                      }
                    }}
                    className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                      taggingMode
                        ? 'bg-primary-600 text-white'
                        : 'bg-white text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <Tag className="w-5 h-5" />
                    {taggingMode ? 'Done Tagging' : 'Tag Photo'}
                  </button>
                )}
                {taggingMode && (
                  <span className="text-white text-sm">Click on the photo to place a tag</span>
                )}
              </div>
              <button
                onClick={() => {
                  setSelectedPhoto(null);
                  setTaggingMode(false);
                  setShowTagSelector(false);
                }}
                className="text-white hover:text-gray-300"
              >
                <X className="w-8 h-8" />
              </button>
            </div>

            <div className="flex-1 flex gap-4 overflow-hidden">
              <div className="flex-1 flex items-center justify-center relative">
                <img
                  ref={imageRef}
                  src={`${selectedPhoto.imageUrl}`}
                  alt={selectedPhoto.caption || 'Photo'}
                  className="max-w-full max-h-full object-contain cursor-crosshair"
                  onClick={handleImageClick}
                />

                {/* Photo Tags - User tags with position */}
                {photoTags.filter(tag => tag.x !== null && tag.y !== null).map((tag: PhotoTag) => (
                  <div
                    key={tag.id}
                    className="absolute"
                    style={{ left: `${tag.x}%`, top: `${tag.y}%` }}
                    onMouseEnter={() => setHoveredTag(tag.id)}
                    onMouseLeave={() => setHoveredTag(null)}
                  >
                    <div className="w-8 h-8 -ml-4 -mt-4 bg-primary-600 rounded-full border-2 border-white cursor-pointer shadow-lg" />
                    {hoveredTag === tag.id && (
                      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white rounded-lg shadow-lg p-3 whitespace-nowrap z-10">
                        <div className="flex items-center gap-2">
                          {tag.user.profilePicture ? (
                            <img src={`${tag.user.profilePicture}`} alt="" className="w-8 h-8 rounded-full" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                              <span className="text-primary-600 text-sm font-medium">{tag.user.firstName[0]}</span>
                            </div>
                          )}
                          <Link
                            to={`/profile/${tag.user.username}`}
                            className="font-semibold text-gray-900 hover:text-primary-600"
                          >
                            {tag.user.firstName} {tag.user.lastName}
                          </Link>
                          {(isOwner || tag.user.id === user?.id) && (
                            <button
                              onClick={() => handleRemoveTag(tag.id, tag.user.id)}
                              className="text-red-500 hover:text-red-700 ml-2"
                              title="Remove tag"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Tag Selector */}
                {showTagSelector && (
                  <div
                    className="absolute bg-white rounded-lg shadow-xl p-4 w-72 z-20"
                    style={{ 
                      left: tagPosition ? `${Math.min(tagPosition.x, 70)}%` : '50%', 
                      top: tagPosition ? `${Math.min(tagPosition.y, 60)}%` : '50%',
                      transform: tagPosition ? 'none' : 'translate(-50%, -50%)'
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-gray-900">Tag in Photo</h4>
                      <button onClick={() => { setShowTagSelector(false); setTagPosition(null); }} className="text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Tag Type Tabs */}
                    <div className="flex gap-2 mb-3">
                      <button
                        onClick={() => { setTagType('user'); setTagSearchQuery(''); }}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition ${tagType === 'user' ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                      >
                        👤 Person
                      </button>
                      <button
                        onClick={() => { setTagType('campground'); setTagSearchQuery(''); }}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition ${tagType === 'campground' ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                      >
                        🏕️ Campground
                      </button>
                    </div>

                    {/* Search Input */}
                    <input
                      type="text"
                      value={tagSearchQuery}
                      onChange={(e) => setTagSearchQuery(e.target.value)}
                      placeholder={tagType === 'user' ? 'Search people...' : 'Search campgrounds...'}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 mb-2"
                      autoFocus
                    />

                    {/* Search Results */}
                    <div className="max-h-48 overflow-y-auto">
                      {searchingTags && (
                        <div className="text-center py-4 text-gray-500 text-sm">Searching...</div>
                      )}

                      {tagType === 'user' && tagSearchResults.length > 0 && (
                        <div className="space-y-1">
                          {tagSearchResults.map((person) => (
                            <button
                              key={person.id}
                              onClick={() => handleTagUser(person.id)}
                              className="w-full flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition"
                            >
                              {person.profilePicture ? (
                                <img src={`${person.profilePicture}`} alt="" className="w-9 h-9 rounded-full" />
                              ) : (
                                <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center">
                                  <span className="text-primary-600 font-medium">{person.firstName?.[0]}</span>
                                </div>
                              )}
                              <div className="text-left">
                                <div className="font-medium text-gray-900 text-sm">{person.firstName} {person.lastName}</div>
                                <div className="text-xs text-gray-500">@{person.username}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {tagType === 'campground' && campgroundSearchResults.length > 0 && (
                        <div className="space-y-1">
                          {campgroundSearchResults.map((cg) => (
                            <button
                              key={cg.id}
                              onClick={() => handleTagCampground(cg.id)}
                              className="w-full flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition"
                            >
                              {cg.imageUrl ? (
                                <img src={`${cg.imageUrl}`} alt="" className="w-9 h-9 rounded-lg object-cover" />
                              ) : (
                                <div className="w-9 h-9 rounded-lg bg-forest-100 flex items-center justify-center">
                                  <span className="text-forest-600">🏕️</span>
                                </div>
                              )}
                              <div className="text-left">
                                <div className="font-medium text-gray-900 text-sm">{cg.name}</div>
                                <div className="text-xs text-gray-500">{cg.location}, {cg.state}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {tagSearchQuery && !searchingTags && tagType === 'user' && tagSearchResults.length === 0 && (
                        <div className="text-center py-4 text-gray-500 text-sm">No people found</div>
                      )}

                      {tagSearchQuery && !searchingTags && tagType === 'campground' && campgroundSearchResults.length === 0 && (
                        <div className="text-center py-4 text-gray-500 text-sm">No campgrounds found</div>
                      )}

                      {!tagSearchQuery && (
                        <div className="text-center py-4 text-gray-400 text-sm">
                          Type to search {tagType === 'user' ? 'people' : 'campgrounds'}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="w-96 bg-white rounded-lg p-4 overflow-y-auto">
                <div className="mb-4">
                  {selectedPhoto.caption && (
                    <p className="text-gray-900 mb-2">{selectedPhoto.caption}</p>
                  )}
                  <button
                    onClick={() => handleLikePhoto(selectedPhoto.id)}
                    className="flex items-center gap-2 text-gray-600 hover:text-red-500 transition"
                  >
                    <Heart
                      className={`w-6 h-6 ${
                        selectedPhoto.likes?.some((like: any) => like.userId === user?.id)
                          ? 'fill-red-500 text-red-500'
                          : ''
                      }`}
                    />
                    <span>{selectedPhoto._count?.likes || 0} likes</span>
                  </button>
                </div>

                {/* Tagged People & Campgrounds */}
                {(photoTags.length > 0 || campgroundTags.length > 0) && (
                  <div className="border-t border-gray-200 pt-4 mb-4">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Tag className="w-4 h-4" />
                      Tagged in this photo
                    </h4>
                    
                    {/* User Tags */}
                    {photoTags.length > 0 && (
                      <div className="space-y-2 mb-3">
                        {photoTags.map((tag) => (
                          <div key={tag.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-2">
                            <Link to={`/profile/${tag.user.username}`} className="flex items-center gap-2 hover:text-primary-600">
                              {tag.user.profilePicture ? (
                                <img src={`${tag.user.profilePicture}`} alt="" className="w-8 h-8 rounded-full" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                                  <span className="text-primary-600 text-sm font-medium">{tag.user.firstName[0]}</span>
                                </div>
                              )}
                              <span className="text-sm font-medium">{tag.user.firstName} {tag.user.lastName}</span>
                            </Link>
                            {/* Remove tag button - visible to photo owner, tagger, or the tagged person */}
                            {(isOwner || tag.user.id === user?.id || tag.taggedBy === user?.id) && (
                              <button
                                onClick={() => tag.user.id === user?.id ? handleRemoveSelfTag() : handleRemoveTag(tag.id, tag.user.id)}
                                className="text-gray-400 hover:text-red-500 p-1"
                                title={tag.user.id === user?.id ? "Remove yourself from this photo" : "Remove tag"}
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Campground Tags */}
                    {campgroundTags.length > 0 && (
                      <div className="space-y-2">
                        {campgroundTags.map((tag) => (
                          <div key={tag.id} className="flex items-center justify-between bg-forest-50 rounded-lg p-2">
                            <Link to={`/campgrounds/${tag.campground.id}`} className="flex items-center gap-2 hover:text-forest-600">
                              {tag.campground.imageUrl ? (
                                <img src={`${tag.campground.imageUrl}`} alt="" className="w-8 h-8 rounded-lg object-cover" />
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-forest-100 flex items-center justify-center">
                                  <span>🏕️</span>
                                </div>
                              )}
                              <div>
                                <span className="text-sm font-medium block">{tag.campground.name}</span>
                                <span className="text-xs text-gray-500">{tag.campground.location}, {tag.campground.state}</span>
                              </div>
                            </Link>
                            {(isOwner || tag.taggedBy === user?.id) && (
                              <button
                                onClick={() => handleRemoveCampgroundTag(tag.campground.id)}
                                className="text-gray-400 hover:text-red-500 p-1"
                                title="Remove tag"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Remove yourself banner if you're tagged */}
                {isUserTagged && !isOwner && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                    <p className="text-sm text-yellow-800 mb-2">You are tagged in this photo</p>
                    <button
                      onClick={handleRemoveSelfTag}
                      className="text-sm text-yellow-700 hover:text-yellow-900 font-medium flex items-center gap-1"
                    >
                      <X className="w-4 h-4" />
                      Remove yourself from this photo
                    </button>
                  </div>
                )}

                {/* Add tag button */}
                {user && (
                  <button
                    onClick={() => setShowTagSelector(true)}
                    className="w-full py-2 px-3 border border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-primary-500 hover:text-primary-600 text-sm flex items-center justify-center gap-2 mb-4 transition"
                  >
                    <UserPlus className="w-4 h-4" />
                    Tag people or campgrounds
                  </button>
                )}

                <div className="border-t border-gray-200 pt-4">
                  <h4 className="font-semibold mb-4">Comments</h4>
                  <form onSubmit={handleAddComment} className="mb-4">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Add a comment..."
                        className="input flex-1"
                      />
                      <button type="submit" className="btn btn-primary">
                        <Send className="w-5 h-5" />
                      </button>
                    </div>
                  </form>

                  {/* Comments List */}
                  <div className="space-y-3 max-h-48 overflow-y-auto">
                    {loadingComments ? (
                      <p className="text-gray-500 text-sm">Loading comments...</p>
                    ) : comments.length > 0 ? (
                      comments.map((comment: any) => (
                        <div key={comment.id} className="flex gap-2">
                          <img
                            src={comment.user?.profilePicture || "/default-avatar.png"}
                            alt=""
                            className="w-8 h-8 rounded-full object-cover"
                          />
                          <div className="flex-1">
                            <p className="text-sm">
                              <span className="font-semibold">{comment.user?.firstName} {comment.user?.lastName}</span>{" "}
                              {comment.content}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(comment.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 text-sm">No comments yet</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Delete Album?</h3>
            <p className="text-gray-600 mb-6">
              This will permanently delete this album and all its photos. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDeleteAlbum}
                className="btn bg-red-600 text-white hover:bg-red-700 flex-1"
              >
                Delete
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

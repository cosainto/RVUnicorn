import { useState, useEffect } from 'react';
import { Image, Upload, X, Trash2, Heart, Camera } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import ImageUpload from './ImageUpload';
import HitchPhotoCaptions from './HitchPhotoCaptions';

interface EventAlbumProps {
  eventId: string;
  canUpload?: boolean;
  campgroundName?: string;
  eventTitle?: string;
}

interface Photo {
  id: string;
  imageUrl: string;
  caption?: string;
  userId: string;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture?: string;
  };
}

interface PhotosByUser {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture?: string;
  };
  photos: Photo[];
}

export default function EventAlbum({ eventId, canUpload = false, campgroundName, eventTitle }: EventAlbumProps) {
  const { user } = useAuth();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photosByUser, setPhotosByUser] = useState<PhotosByUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [uploadCaption, setUploadCaption] = useState('');
  const [uploadedUrl, setUploadedUrl] = useState('');

  useEffect(() => {
    loadPhotos();
  }, [eventId]);

  const loadPhotos = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/photos/event/${eventId}`);
      setPhotos(data.photos || []);
      setPhotosByUser(data.photosByUser || []);
    } catch (error) {
      console.error('Load photos error:', error);
      // If endpoint doesn't exist yet, just show empty
      setPhotos([]);
      setPhotosByUser([]);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUploaded = (url: string) => {
    setUploadedUrl(url);
  };

  const handleSavePhoto = async () => {
    // Photo is already uploaded and linked via ImageUpload with eventId
    // Just close modal and refresh
    setShowUploadModal(false);
    setUploadCaption('');
    setUploadedUrl('');
    await loadPhotos();
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm('Delete this photo?')) return;
    
    try {
      await api.delete(`/photos/${photoId}`);
      await loadPhotos();
    } catch (error) {
      console.error('Delete photo error:', error);
      alert('Failed to delete photo');
    }
  };

  // Helper to format image URL
  const getImageUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `${url}`;
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Event Photos</h3>
          <p className="text-sm text-gray-600">
            Shared album - everyone can add photos! ({photos.length} photos)
          </p>
        </div>
        <button
          onClick={() => canUpload ? setShowUploadModal(true) : alert('Only trip attendees can upload photos')}
          className="btn btn-primary btn-sm flex items-center gap-2"
        >
          <Upload className="w-4 h-4" />
          {canUpload ? 'Upload Photo' : '🔒 Attendees Only'}
        </button>
      </div>

      {/* Photo Grid */}
      {photos.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="relative group bg-white rounded-lg overflow-hidden shadow-md hover:shadow-xl transition cursor-pointer"
              onClick={() => setSelectedPhoto(photo)}
            >
              {/* Photo */}
              <div className="aspect-square relative">
                <img
                  src={getImageUrl(photo.imageUrl)}
                  alt={photo.caption || 'Event photo'}
                  className="w-full h-full object-cover"
                />
                
                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition flex items-end p-3">
                  <div className="opacity-0 group-hover:opacity-100 transition w-full">
                    {photo.caption && (
                      <p className="text-white text-sm mb-2">{photo.caption}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {photo.user?.profilePicture ? (
                          <img
                            src={getImageUrl(photo.user.profilePicture)}
                            alt={photo.user.firstName}
                            className="w-6 h-6 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xs font-bold">
                            {photo.user?.firstName?.[0] || '?'}
                          </div>
                        )}
                        <span className="text-white text-xs">
                          {photo.user?.firstName || 'Unknown'}
                        </span>
                      </div>
                      {user?.id === photo.userId && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePhoto(photo.id);
                          }}
                          className="text-white hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Date */}
              <div className="p-2">
                <span className="text-xs text-gray-500">
                  {new Date(photo.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Camera className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 mb-2">No photos yet</p>
          <p className="text-sm text-gray-500 mb-4">Be the first to share a photo from this event!</p>
          <button
            onClick={() => canUpload ? setShowUploadModal(true) : alert('Only trip attendees can upload photos')}
            className="btn btn-primary"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload Photo
          </button>
        </div>
      )}

      {/* Photos by User Section */}
      {photosByUser.length > 1 && (
        <div className="mt-8">
          <h4 className="font-semibold text-gray-800 mb-4">Photos by Attendee</h4>
          <div className="flex flex-wrap gap-4">
            {photosByUser.map((group) => (
              <div key={group.user.id} className="flex items-center gap-2 bg-gray-100 rounded-full px-3 py-1">
                {group.user.profilePicture ? (
                  <img
                    src={getImageUrl(group.user.profilePicture)}
                    alt={group.user.firstName}
                    className="w-6 h-6 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center text-white text-xs font-bold">
                    {group.user.firstName[0]}
                  </div>
                )}
                <span className="text-sm text-gray-700">{group.user.firstName}</span>
                <span className="text-xs text-gray-500">({group.photos.length})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white p-4 rounded-t-lg">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Upload Photo</h3>
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadCaption('');
                    setUploadedUrl('');
                  }}
                  className="text-white hover:text-gray-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* ImageUpload with eventId - this automatically links the photo! */}
              <ImageUpload
                onImageUploaded={handleImageUploaded}
                currentImage={uploadedUrl}
                label="Select Photo"
                eventId={eventId}
                caption={uploadCaption}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Caption (Optional)
                </label>
                <textarea
                  value={uploadCaption}
                  onChange={(e) => setUploadCaption(e.target.value)}
                  rows={3}
                  className="input w-full"
                  placeholder="Add a caption..."
                />
                <div className="mt-2">
                  <HitchPhotoCaptions
                    campgroundName={campgroundName}
                    tripTitle={eventTitle}
                    onSelect={(caption) => setUploadCaption(caption)}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSavePhoto}
                  disabled={!uploadedUrl}
                  className="btn btn-primary flex-1"
                >
                  {uploadedUrl ? 'Done' : 'Upload a Photo First'}
                </button>
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadCaption('');
                    setUploadedUrl('');
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Photo Lightbox */}
      {selectedPhoto && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <button
            onClick={() => setSelectedPhoto(null)}
            className="absolute top-4 right-4 text-white hover:text-gray-300"
          >
            <X className="w-8 h-8" />
          </button>
          
          <div className="max-w-4xl max-h-[90vh] relative" onClick={(e) => e.stopPropagation()}>
            <img
              src={getImageUrl(selectedPhoto.imageUrl)}
              alt={selectedPhoto.caption || 'Event photo'}
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
            
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 rounded-b-lg">
              {selectedPhoto.caption && (
                <p className="text-white mb-2">{selectedPhoto.caption}</p>
              )}
              <div className="flex items-center gap-2">
                {selectedPhoto.user?.profilePicture ? (
                  <img
                    src={getImageUrl(selectedPhoto.user.profilePicture)}
                    alt={selectedPhoto.user.firstName}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-sm font-bold">
                    {selectedPhoto.user?.firstName?.[0] || '?'}
                  </div>
                )}
                <div>
                  <p className="text-white font-medium">
                    {selectedPhoto.user?.firstName} {selectedPhoto.user?.lastName}
                  </p>
                  <p className="text-gray-300 text-sm">
                    {new Date(selectedPhoto.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

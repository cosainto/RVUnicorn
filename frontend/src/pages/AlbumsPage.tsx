import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Image, X, Globe, Users, Lock, Upload, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

interface Album {
  id: string;
  title: string;
  description?: string;
  privacy: string;
  createdAt: string;
  coverPhotoUrl?: string | null;
  isShared?: boolean;
  _count: {
    photos: number;
  };
  photos: {
    imageUrl: string;
  }[];
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture?: string;
  };
}

export default function AlbumsPage() {
  const { user } = useAuth();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    privacy: 'PUBLIC'
  });

  useEffect(() => {
    if (user) {
      loadAlbums();
    }
  }, [user]);

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      previewUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  const loadAlbums = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/albums/user/${user?.id}`);
      setAlbums(data);
    } catch (error) {
      console.error('Load albums error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Add new files to existing selection
    setSelectedFiles(prev => [...prev, ...files]);
    
    // Create preview URLs
    const newPreviewUrls = files.map(file => URL.createObjectURL(file));
    setPreviewUrls(prev => [...prev, ...newPreviewUrls]);
  };

  const removeSelectedFile = (index: number) => {
    // Revoke the URL to free memory
    URL.revokeObjectURL(previewUrls[index]);
    
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setFormData({ title: '', description: '', privacy: 'PUBLIC' });
    setSelectedFiles([]);
    previewUrls.forEach(url => URL.revokeObjectURL(url));
    setPreviewUrls([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedFiles.length === 0) {
      alert('Please select at least one photo for your album');
      return;
    }

    if (!formData.title.trim()) {
      alert('Please enter an album title');
      return;
    }

    try {
      setCreating(true);

      // Server accepts up to 100 photos per multipart request, so chunk
      // larger uploads: first chunk creates the album, subsequent chunks
      // append to it via /albums/:id/photos.
      const CHUNK_SIZE = 100;
      const chunks: File[][] = [];
      for (let i = 0; i < selectedFiles.length; i += CHUNK_SIZE) {
        chunks.push(selectedFiles.slice(i, i + CHUNK_SIZE));
      }

      // First chunk — create the album
      const firstChunk = chunks.shift()!;
      const submitData = new FormData();
      submitData.append('title', formData.title);
      submitData.append('description', formData.description);
      submitData.append('privacy', formData.privacy);
      firstChunk.forEach(file => submitData.append('photos', file));

      const { data: createdAlbum } = await api.post('/albums', submitData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // Remaining chunks — append to the new album
      for (let i = 0; i < chunks.length; i++) {
        const chunkData = new FormData();
        chunks[i].forEach(file => chunkData.append('photos', file));
        await api.post(`/albums/${createdAlbum.id}/photos`, chunkData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      setShowCreateModal(false);
      resetForm();
      await loadAlbums();
      alert(`Album created with ${selectedFiles.length} photo${selectedFiles.length === 1 ? '' : 's'}! 🎉`);
    } catch (error) {
      console.error('Create album error:', error);
      alert('Failed to create album');
    } finally {
      setCreating(false);
    }
  };

  const getPrivacyIcon = (privacy: string) => {
    switch (privacy) {
      case 'PUBLIC':
        return <Globe className="w-4 h-4 text-green-600" />;
      case 'FRIENDS':
        return <Users className="w-4 h-4 text-blue-600" />;
      case 'PRIVATE':
        return <Lock className="w-4 h-4 text-gray-600" />;
      default:
        return <Globe className="w-4 h-4 text-green-600" />;
    }
  };

  const getPrivacyLabel = (privacy: string) => {
    switch (privacy) {
      case 'PUBLIC':
        return 'Public';
      case 'FRIENDS':
        return 'Friends Only';
      case 'PRIVATE':
        return 'Private';
      default:
        return 'Public';
    }
  };

  if (!user) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <p className="text-gray-600">Please log in to view albums</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <span className="ml-3 text-gray-600">Loading albums...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900">📸 Photo Albums</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Create Album
        </button>
      </div>

      {albums.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Image className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No albums yet</h3>
          <p className="text-gray-600 mb-4">Create your first photo album to get started!</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary inline-flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Create Album
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {albums.map(album => (
            <Link
              key={album.id}
              to={`/albums/${album.id}`}
              className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow overflow-hidden group"
            >
              <div className="aspect-video bg-gray-200 relative overflow-hidden">
                {(album.coverPhotoUrl || album.photos[0]?.imageUrl) ? (
                  <img
                    src={album.coverPhotoUrl || album.photos[0].imageUrl}
                    alt={album.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Image className="w-12 h-12 text-gray-400" />
                  </div>
                )}
                {/* Photo count badge */}
                <div className="absolute bottom-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
                  {album._count.photos} {album._count.photos === 1 ? 'photo' : 'photos'}
                </div>
                {/* Privacy badge */}
                <div className="absolute top-2 right-2 bg-white bg-opacity-90 px-2 py-1 rounded-full flex items-center gap-1 text-xs">
                  {getPrivacyIcon(album.privacy)}
                  <span className="font-medium">{getPrivacyLabel(album.privacy)}</span>
                </div>
                {album.isShared && (
                  <div className="absolute top-2 left-2 bg-primary-600 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow">
                    SHARED
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="text-xl font-semibold text-gray-900 mb-1">{album.title}</h3>
                {album.description && (
                  <p className="text-sm text-gray-600 line-clamp-2">{album.description}</p>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  {album.isShared && album.user ? `Shared by ${album.user.firstName} ${album.user.lastName} • ` : ''}
                  {new Date(album.createdAt).toLocaleDateString()}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Album Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white p-4 rounded-t-lg sticky top-0">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Image className="w-6 h-6" />
                  Create New Album
                </h2>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="text-white hover:text-gray-200"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateAlbum} className="p-6 space-y-5">
              {/* Album Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Album Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="input"
                  placeholder="Summer Road Trip 2024"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input"
                  rows={3}
                  placeholder="Describe your album..."
                />
              </div>

              {/* Privacy Radio Buttons */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Privacy Setting
                </label>
                <div className="space-y-3">
                  <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="privacy"
                      value="PUBLIC"
                      checked={formData.privacy === 'PUBLIC'}
                      onChange={(e) => setFormData({ ...formData, privacy: e.target.value })}
                      className="mr-3 h-4 w-4 text-green-600"
                    />
                    <Globe className="w-5 h-5 mr-3 text-green-600" />
                    <div>
                      <span className="font-medium text-gray-900">Public</span>
                      <p className="text-xs text-gray-500">Anyone can see this album</p>
                    </div>
                  </label>
                  
                  <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="privacy"
                      value="FRIENDS"
                      checked={formData.privacy === 'FRIENDS'}
                      onChange={(e) => setFormData({ ...formData, privacy: e.target.value })}
                      className="mr-3 h-4 w-4 text-blue-600"
                    />
                    <Users className="w-5 h-5 mr-3 text-blue-600" />
                    <div>
                      <span className="font-medium text-gray-900">Friends Only</span>
                      <p className="text-xs text-gray-500">Only your friends can see this album</p>
                    </div>
                  </label>
                  
                  <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      name="privacy"
                      value="PRIVATE"
                      checked={formData.privacy === 'PRIVATE'}
                      onChange={(e) => setFormData({ ...formData, privacy: e.target.value })}
                      className="mr-3 h-4 w-4 text-gray-600"
                    />
                    <Lock className="w-5 h-5 mr-3 text-gray-600" />
                    <div>
                      <span className="font-medium text-gray-900">Private</span>
                      <p className="text-xs text-gray-500">Only you can see this album</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Photo Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Photos * <span className="text-gray-500 font-normal">(at least 1 required)</span>
                </label>
                
                <div 
                  className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary-500 transition cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Upload className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">
                    <span className="text-primary-600 font-medium">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-gray-500 mt-1">PNG, JPG, GIF up to 50MB each</p>
                </div>

                {/* Selected Photos Preview */}
                {previewUrls.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm text-gray-600 mb-2">
                      {selectedFiles.length} {selectedFiles.length === 1 ? 'photo' : 'photos'} selected
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {previewUrls.map((url, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={url}
                            alt={`Preview ${index + 1}`}
                            className="w-full h-20 object-cover rounded"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeSelectedFile(index);
                            }}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button 
                  type="submit" 
                  disabled={creating || selectedFiles.length === 0}
                  className="btn btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? (
                    <>
                      <span className="animate-spin mr-2">⏳</span>
                      Creating...
                    </>
                  ) : (
                    'Create Album'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

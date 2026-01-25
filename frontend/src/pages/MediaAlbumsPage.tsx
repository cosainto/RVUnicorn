import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Image, Film, Lock, Users, Globe, Grid, List } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface Album {
  id: string;
  title: string;
  description: string | null;
  defaultVisibility: 'PUBLIC' | 'FRIENDS_ONLY' | 'PRIVATE';
  discoveryEnabled: boolean;
  featured: boolean;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture: string | null;
  };
  mediaCount: number;
  previewMedia: Array<{
    id: string;
    url: string;
    thumbnailUrl: string | null;
    type: 'PHOTO' | 'VIDEO';
  }>;
}

export default function MediaAlbumsPage() {
  const { user } = useAuth();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filter, setFilter] = useState<'all' | 'mine' | 'discovery'>('all');

  useEffect(() => {
    fetchAlbums();
  }, [filter, user]);

  const fetchAlbums = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filter === 'mine' && user) params.userId = user.id;
      if (filter === 'discovery') params.discovery = 'true';
      
      const { data } = await api.get('/media-albums', { params });
      setAlbums(data);
    } catch (error) {
      console.error('Error fetching albums:', error);
    } finally {
      setLoading(false);
    }
  };

  const getVisibilityIcon = (visibility: string) => {
    switch (visibility) {
      case 'PUBLIC': return <Globe className="w-4 h-4 text-green-500" />;
      case 'FRIENDS_ONLY': return <Users className="w-4 h-4 text-blue-500" />;
      case 'PRIVATE': return <Lock className="w-4 h-4 text-gray-500" />;
      default: return null;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Media Albums</h1>
          <p className="text-gray-600 mt-1">Photos and videos from the community</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="w-5 h-5" />
          Create Album
        </button>
      </div>

      {/* Filters & View Toggle */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-2">
          {['all', 'mine', 'discovery'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`px-4 py-2 rounded-lg capitalize transition ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {f === 'mine' ? 'My Albums' : f}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white shadow' : ''}`}
          >
            <Grid className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded ${viewMode === 'list' ? 'bg-white shadow' : ''}`}
          >
            <List className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      )}

      {/* Empty State */}
      {!loading && albums.length === 0 && (
        <div className="text-center py-16 bg-gray-50 rounded-xl">
          <Image className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No albums yet</h3>
          <p className="text-gray-600 mb-6">Create your first album to share photos and videos</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Create Album
          </button>
        </div>
      )}

      {/* Albums Grid */}
      {!loading && albums.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {albums.map((album) => (
            <Link
              key={album.id}
              to={`/media-albums/${album.id}`}
              className="group bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition"
            >
              {/* Preview Grid */}
              <div className="aspect-square bg-gray-100 relative">
                {album.previewMedia.length > 0 ? (
                  <div className="grid grid-cols-2 gap-0.5 h-full">
                    {album.previewMedia.slice(0, 4).map((media) => (
                      <div key={media.id} className="relative overflow-hidden">
                        <img
                          src={media.thumbnailUrl || media.url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                        {media.type === 'VIDEO' && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                            <Film className="w-8 h-8 text-white" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Image className="w-12 h-12 text-gray-300" />
                  </div>
                )}
                {/* Media Count Badge */}
                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-sm px-2 py-1 rounded-full">
                  {album.mediaCount} items
                </div>
              </div>

              {/* Info */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition line-clamp-1">
                    {album.title}
                  </h3>
                  {getVisibilityIcon(album.defaultVisibility)}
                </div>
                {album.description && (
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{album.description}</p>
                )}
                <div className="flex items-center gap-2 mt-3">
                  <img
                    src={album.user.profilePicture || '/default-avatar.png'}
                    alt={album.user.firstName}
                    className="w-6 h-6 rounded-full"
                  />
                  <span className="text-sm text-gray-600">
                    {album.user.firstName} {album.user.lastName}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Albums List */}
      {!loading && albums.length > 0 && viewMode === 'list' && (
        <div className="space-y-4">
          {albums.map((album) => (
            <Link
              key={album.id}
              to={`/media-albums/${album.id}`}
              className="flex gap-4 bg-white rounded-xl shadow-sm p-4 hover:shadow-lg transition"
            >
              <div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                {album.previewMedia[0] ? (
                  <img
                    src={album.previewMedia[0].thumbnailUrl || album.previewMedia[0].url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Image className="w-8 h-8 text-gray-300" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900">{album.title}</h3>
                  {getVisibilityIcon(album.defaultVisibility)}
                </div>
                {album.description && (
                  <p className="text-sm text-gray-500 mt-1 line-clamp-1">{album.description}</p>
                )}
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                  <span>{album.mediaCount} items</span>
                  <span>by {album.user.firstName} {album.user.lastName}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateAlbumModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(album) => {
            setAlbums([album, ...albums]);
            setShowCreateModal(false);
          }}
        />
      )}
    </div>
  );
}

function CreateAlbumModal({ onClose, onCreated }: { onClose: () => void; onCreated: (album: Album) => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'PUBLIC' | 'FRIENDS_ONLY' | 'PRIVATE'>('FRIENDS_ONLY');
  const [discoveryEnabled, setDiscoveryEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      setLoading(true);
      const { data } = await api.post('/media-albums', {
        title: title.trim(),
        description: description.trim() || null,
        defaultVisibility: visibility,
        discoveryEnabled,
      });
      onCreated(data);
    } catch (error) {
      console.error('Error creating album:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <h2 className="text-xl font-bold mb-4">Create Album</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My Road Trip 2024"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={3}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Visibility</label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as any)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="PUBLIC">Public - Anyone can see</option>
              <option value="FRIENDS_ONLY">Friends Only</option>
              <option value="PRIVATE">Private - Only you</option>
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
              <span className="text-sm text-gray-700">Enable discovery (appear in explore feeds)</span>
            </label>
          )}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

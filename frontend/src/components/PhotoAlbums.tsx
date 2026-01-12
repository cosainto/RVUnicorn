import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Image, Plus } from 'lucide-react';
import api from '../services/api';

interface PhotoAlbumsProps {
  userId: string;
  isOwnProfile: boolean;
}

interface Album {
  id: string;
  title: string;
  description?: string;
  coverPhotoId?: string;
  photos: { imageUrl: string }[];
  _count: { photos: number };
  createdAt: string;
}

export default function PhotoAlbums({ userId, isOwnProfile }: PhotoAlbumsProps) {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAlbums();
  }, [userId]);

  const loadAlbums = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/photo-albums?userId=${userId}`);
      console.log('Albums response:', data);
      setAlbums(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Load albums error:', error);
      setAlbums([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">Loading albums...</p>
      </div>
    );
  }

  if (albums.length === 0) {
    return (
      <div className="text-center py-12">
        <Image className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No albums yet</h3>
        <p className="text-gray-600 mb-4">
          {isOwnProfile 
            ? 'Create your first photo album to share your adventures!'
            : 'No albums to display yet.'}
        </p>
        {isOwnProfile && (
          <Link to="/albums/new" className="btn btn-primary inline-flex items-center">
            <Plus className="w-5 h-5 mr-2" />
            Create Album
          </Link>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">
          Photo Albums ({albums.length})
        </h3>
        {isOwnProfile && (
          <Link to="/albums/new" className="btn btn-primary btn-sm inline-flex items-center">
            <Plus className="w-4 h-4 mr-2" />
            New Album
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {albums.map((album) => (
          <Link
            key={album.id}
            to={`/albums/${album.id}`}
            className="group relative bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition"
          >
            {album.photos[0] ? (
              <img
                src={`${album.photos[0].imageUrl}`}
                alt={album.title}
                className="w-full h-48 object-cover"
              />
            ) : (
              <div className="w-full h-48 bg-gray-200 flex items-center justify-center">
                <Image className="w-12 h-12 text-gray-400" />
              </div>
            )}
            
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition"></div>
            
            <div className="absolute bottom-0 left-0 right-0 p-4 text-white transform translate-y-full group-hover:translate-y-0 transition">
              <h4 className="font-semibold text-lg mb-1">{album.title}</h4>
              {album.description && (
                <p className="text-sm opacity-90 line-clamp-2">{album.description}</p>
              )}
              <p className="text-sm mt-2">
                {album._count.photos} {album._count.photos === 1 ? 'photo' : 'photos'}
              </p>
            </div>

            <div className="p-4">
              <h4 className="font-semibold text-gray-900 group-hover:text-primary-600 transition">
                {album.title}
              </h4>
              <p className="text-sm text-gray-600 mt-1">
                {album._count.photos} {album._count.photos === 1 ? 'photo' : 'photos'}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

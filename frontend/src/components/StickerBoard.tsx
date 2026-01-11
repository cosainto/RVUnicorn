import { useState, useEffect } from 'react';
import { Award, Star, Lock, Eye, EyeOff, GripVertical } from 'lucide-react';
import api from '../services/api';

interface Sticker {
  id: string;
  name: string;
  description: string;
  artworkUrl: string;
  criteria: string;
  isLimited: boolean;
  maxEarners?: number;
}

interface StickerAward {
  id: string;
  awardedAt: string;
  displayOrder: number;
  visible: boolean;
  sticker: Sticker & {
    campground: {
      id: string;
      name: string;
      slug: string;
    };
  };
}

interface StickerBoardProps {
  username: string;
  isOwnProfile?: boolean;
}

export default function StickerBoard({ username, isOwnProfile = false }: StickerBoardProps) {
  const [awards, setAwards] = useState<StickerAward[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAwards();
  }, [username]);

  const loadAwards = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/stickers/awards/user/${username}`);
      setAwards(data);
    } catch (error) {
      console.error('Load awards error:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleVisibility = async (awardId: string, currentVisibility: boolean) => {
    try {
      await api.put(`/stickers/awards/${awardId}`, {
        visible: !currentVisibility
      });
      await loadAwards();
    } catch (error) {
      console.error('Toggle visibility error:', error);
      alert('Failed to update visibility');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2"></div>
        <p className="text-gray-600">Loading sticker board...</p>
      </div>
    );
  }

  if (awards.length === 0) {
    return (
      <div className="text-center py-12">
        <Award className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600 text-lg mb-2">No stickers earned yet</p>
        <p className="text-gray-500 text-sm">
          {isOwnProfile 
            ? 'Visit campgrounds and complete activities to earn stickers!'
            : 'This user hasn\'t earned any stickers yet.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-gray-900">
          Sticker Board ({awards.length})
        </h3>
        {isOwnProfile && (
          <p className="text-sm text-gray-600">
            Click the eye icon to hide/show stickers
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {awards.map((award) => (
          <div
            key={award.id}
            className="relative group bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition"
          >
            {/* Visibility Toggle (Owner Only) */}
            {isOwnProfile && (
              <button
                onClick={() => toggleVisibility(award.id, award.visible)}
                className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition"
              >
                {award.visible ? (
                  <Eye className="w-4 h-4 text-gray-600" />
                ) : (
                  <EyeOff className="w-4 h-4 text-gray-400" />
                )}
              </button>
            )}

            {/* Sticker Artwork */}
            <div className="aspect-square bg-gradient-to-br from-primary-100 to-primary-200 rounded-lg mb-3 flex items-center justify-center">
              <Award className="w-16 h-16 text-primary-600" />
            </div>

            {/* Sticker Name */}
            <h4 className="font-bold text-gray-900 text-sm text-center mb-1 line-clamp-2">
              {award.sticker.name}
            </h4>

            {/* Campground */}
            <p className="text-xs text-gray-600 text-center mb-2">
              {award.sticker.campground.name}
            </p>

            {/* Limited Badge */}
            {award.sticker.isLimited && (
              <div className="flex items-center justify-center gap-1">
                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                <span className="text-xs text-yellow-600 font-medium">Limited</span>
              </div>
            )}

            {/* Earned Date */}
            <p className="text-xs text-gray-500 text-center mt-2">
              Earned {new Date(award.awardedAt).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

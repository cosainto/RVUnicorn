import { useState, useEffect } from 'react';
import { Award, Star, Users, CheckCircle, Clock, Send, X } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface Sticker {
  id: string;
  name: string;
  description: string;
  artworkUrl: string;
  criteria: string;
  isLimited: boolean;
  maxEarners?: number;
  isActive: boolean;
  _count: {
    awards: number;
    requests: number;
  };
}

interface AvailableStickersProps {
  campgroundId: string;
}

export default function AvailableStickers({ campgroundId }: AvailableStickersProps) {
  const { user } = useAuth();
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedSticker, setSelectedSticker] = useState<Sticker | null>(null);
  const [evidence, setEvidence] = useState('');

  useEffect(() => {
    loadStickers();
  }, [campgroundId]);

  const loadStickers = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/stickers/campground/${campgroundId}?activeOnly=true`);
      setStickers(data);
    } catch (error) {
      console.error('Load stickers error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestSticker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSticker || !user) return;

    try {
      await api.post(`/stickers/${selectedSticker.id}/request`, {
        evidence: evidence.trim() || undefined
      });

      setShowRequestModal(false);
      setSelectedSticker(null);
      setEvidence('');
      alert('Sticker request submitted! 🎖️ The campground will review your request.');
    } catch (error: any) {
      console.error('Request sticker error:', error);
      alert(error.response?.data?.error || 'Failed to request sticker');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2"></div>
        <p className="text-gray-600">Loading stickers...</p>
      </div>
    );
  }

  if (stickers.length === 0) {
    return (
      <div className="text-center py-12">
        <Award className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">No stickers available yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-700">
          🎖️ Complete activities and challenges to earn digital stickers! Click on any sticker to request it once you've met the criteria.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stickers.map((sticker) => {
          const isAtCapacity = !!(sticker.isLimited && sticker.maxEarners && sticker._count.awards >= sticker.maxEarners);
          const spotsLeft = sticker.isLimited && sticker.maxEarners ? sticker.maxEarners - sticker._count.awards : null;

          return (
            <div key={sticker.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition">
              {/* Sticker Artwork */}
              <div className="aspect-square bg-gradient-to-br from-primary-100 to-primary-200 rounded-lg mb-4 flex items-center justify-center">
                <Award className="w-24 h-24 text-primary-600" />
              </div>

              {/* Sticker Info */}
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <h3 className="font-bold text-gray-900 text-lg">{sticker.name}</h3>
                  {sticker.isLimited && (
                    <div className="flex items-center gap-1 bg-yellow-100 px-2 py-1 rounded-full">
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      <span className="text-xs text-yellow-700 font-medium">Limited</span>
                    </div>
                  )}
                </div>

                <p className="text-gray-700 text-sm">{sticker.description}</p>

                <div className="bg-gray-50 rounded p-3 mt-3">
                  <p className="text-xs text-gray-600 font-medium mb-1">How to earn:</p>
                  <p className="text-sm text-gray-700">{sticker.criteria}</p>
                </div>

                {/* Stats */}
                <div className="flex items-center justify-between text-sm text-gray-600 pt-3 border-t">
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    <span>{sticker._count.awards} earned</span>
                  </div>
                  {sticker.isLimited && spotsLeft !== null && (
                    <span className={spotsLeft > 0 ? 'text-green-600' : 'text-red-600'}>
                      {spotsLeft > 0 ? `${spotsLeft} left` : 'Sold out'}
                    </span>
                  )}
                </div>

                {/* Request Button */}
                {user && (
                  <button
                    onClick={() => {
                      setSelectedSticker(sticker);
                      setShowRequestModal(true);
                    }}
                    disabled={isAtCapacity}
                    className={`w-full mt-3 btn ${isAtCapacity ? 'btn-secondary opacity-50 cursor-not-allowed' : 'btn-primary'}`}
                  >
                    {isAtCapacity ? (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        At Capacity
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Request Sticker
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Pending Requests Badge */}
              {sticker._count.requests > 0 && (
                <div className="mt-3 flex items-center gap-2 text-xs text-orange-600 bg-orange-50 px-3 py-2 rounded">
                  <Clock className="w-4 h-4" />
                  <span>{sticker._count.requests} pending request(s)</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Request Modal */}
      {showRequestModal && selectedSticker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full">
            <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white p-6 rounded-t-lg">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Request Sticker</h2>
                <button
                  onClick={() => {
                    setShowRequestModal(false);
                    setSelectedSticker(null);
                  }}
                  className="text-white hover:text-gray-200"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <form onSubmit={handleRequestSticker} className="p-6 space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <Award className="w-8 h-8 text-primary-600" />
                  <h3 className="font-bold text-gray-900">{selectedSticker.name}</h3>
                </div>
                <p className="text-sm text-gray-700 mb-2">{selectedSticker.description}</p>
                <div className="bg-white rounded p-2 mt-2">
                  <p className="text-xs text-gray-600 font-medium">Criteria:</p>
                  <p className="text-sm text-gray-700">{selectedSticker.criteria}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Evidence / Notes (optional)
                </label>
                <textarea
                  value={evidence}
                  onChange={(e) => setEvidence(e.target.value)}
                  rows={4}
                  className="input"
                  placeholder="Tell us why you deserve this sticker or provide any relevant details..."
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <p className="text-sm text-blue-700">
                  Your request will be reviewed by the campground administrators. You'll receive a notification when it's approved or declined.
                </p>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button type="submit" className="btn btn-primary flex-1">
                  <Send className="w-4 h-4 mr-2" />
                  Submit Request
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowRequestModal(false);
                    setSelectedSticker(null);
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

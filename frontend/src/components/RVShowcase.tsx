import { useState } from 'react';
import { Play, X, Eye, EyeOff } from 'lucide-react';

interface RVShowcaseProps {
  showcase: {
    id: string;
    title?: string;
    description?: string;
    photos: string[];
    videoUrl?: string;
    privacy: string;
    user: {
      firstName: string;
      lastName: string;
      rvType?: string;
      rvYear?: number;
      rvMake?: string;
      rvModel?: string;
    };
  };
}

export default function RVShowcase({ showcase }: RVShowcaseProps) {
  const [selectedMedia, setSelectedMedia] = useState<{ type: 'photo' | 'video'; url: string } | null>(null);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold text-gray-900">
            {showcase.title || 'My RV Showcase'}
          </h2>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            {showcase.privacy === 'PRIVATE' ? (
              <>
                <EyeOff className="w-4 h-4" />
                <span>Private</span>
              </>
            ) : (
              <>
                <Eye className="w-4 h-4" />
                <span>Public</span>
              </>
            )}
          </div>
        </div>

        {showcase.user.rvType && (
          <p className="text-gray-700 font-medium">
            {showcase.user.rvYear} {showcase.user.rvMake} {showcase.user.rvModel}
            {showcase.user.rvType && ` - ${showcase.user.rvType}`}
          </p>
        )}

        {showcase.description && (
          <p className="text-gray-600 mt-2">{showcase.description}</p>
        )}
      </div>

      {/* Video */}
      {showcase.videoUrl && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">🎬 Video Tour</h3>
          <div className="relative bg-black rounded-lg overflow-hidden aspect-video cursor-pointer hover:opacity-90 transition">
            <video
              src={`${showcase.videoUrl}`}
              className="w-full h-full"
              controls
              onClick={(e) => {
                e.currentTarget.paused ? e.currentTarget.play() : e.currentTarget.pause();
              }}
            />
            <button
              onClick={() => setSelectedMedia({ type: 'video', url: showcase.videoUrl! })}
              className="absolute top-3 right-3 bg-white bg-opacity-90 rounded-full p-2 hover:bg-opacity-100 transition"
            >
              <Play className="w-5 h-5 text-gray-900" />
            </button>
          </div>
        </div>
      )}

      {/* Photos */}
      {showcase.photos.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            📸 Photos ({showcase.photos.length}/6)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {showcase.photos.map((photo, index) => (
              <div
                key={index}
                onClick={() => setSelectedMedia({ type: 'photo', url: photo })}
                className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition group"
              >
                <img
                  src={`${photo}`}
                  alt={`RV Photo ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition flex items-center justify-center">
                  <Eye className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {selectedMedia && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedMedia(null)}
        >
          <button
            onClick={() => setSelectedMedia(null)}
            className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
          >
            <X className="w-8 h-8" />
          </button>

          <div className="max-w-6xl w-full" onClick={(e) => e.stopPropagation()}>
            {selectedMedia.type === 'photo' ? (
              <img
                src={`${selectedMedia.url}`}
                alt="RV Photo"
                className="w-full h-auto max-h-[90vh] object-contain rounded-lg"
              />
            ) : (
              <video
                src={`${selectedMedia.url}`}
                className="w-full h-auto max-h-[90vh] rounded-lg"
                controls
                autoPlay
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

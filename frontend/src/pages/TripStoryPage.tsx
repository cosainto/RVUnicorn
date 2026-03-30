import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { BookOpen, MapPin, Calendar, Users, Sparkles, ArrowLeft, ExternalLink } from 'lucide-react';
import api from '../services/api';

interface StoryData {
  story: {
    content: string;
    style: string;
    generatedAt: string;
  };
  event: {
    id: string;
    title: string;
    startDate: string;
    endDate: string | null;
    campground: { name: string; state: string | null; location: string | null } | null;
    organizer: { firstName: string; lastName: string; username: string; profilePicture: string | null };
    attendees: { user: { firstName: string; profilePicture: string | null } }[];
    scrapbookPins: { photo: { imageUrl: string; caption: string | null } }[];
  };
}

export default function TripStoryPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [data, setData] = useState<StoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!eventId) return;
    api.get(`/trip-story/${eventId}/public`)
      .then(({ data }) => setData(data))
      .catch(e => setError(e.response?.data?.error || 'Story not found'))
      .finally(() => setLoading(false));
  }, [eventId]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <BookOpen className="w-12 h-12 text-gray-300" />
      <p className="text-gray-500">{error || 'Story not found'}</p>
      <Link to="/" className="text-primary-600 hover:underline text-sm">Back to RVUnicorn</Link>
    </div>
  );

  const { story, event } = data;
  const startDate = new Date(event.startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const endDate = event.endDate ? new Date(event.endDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null;
  const location = event.campground
    ? `${event.campground.name}${event.campground.state ? ', ' + event.campground.state : ''}`
    : null;

  // Interleave photos between story paragraphs
  const paragraphs = story.content.split('\n\n').filter(Boolean);
  const photos = event.scrapbookPins.map(p => p.photo);

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/50 to-white">
      {/* Header */}
      <div className="max-w-2xl mx-auto px-4 pt-8 pb-4">
        <Link to={`/trips/${event.id}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-8">
          <ArrowLeft className="w-4 h-4" /> Back to trip
        </Link>

        {/* Hero */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span className="text-xs text-amber-600 font-medium uppercase tracking-wide">Trip Story</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4 leading-tight">{event.title}</h1>

          <div className="flex flex-wrap gap-4 text-sm text-gray-500">
            {location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                {location}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {startDate}{endDate && endDate !== startDate ? ` – ${endDate}` : ''}
            </span>
            {event.attendees.length > 0 && (
              <span className="flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                {event.attendees.map(a => a.user.firstName).join(', ')}
              </span>
            )}
          </div>
        </div>

        {/* Organizer */}
        <div className="flex items-center gap-3 mb-8 pb-8 border-b border-gray-100">
          {event.organizer.profilePicture ? (
            <img src={event.organizer.profilePicture} alt="" className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center font-semibold text-amber-700">
              {event.organizer.firstName[0]}
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-gray-900">{event.organizer.firstName} {event.organizer.lastName}</p>
            <Link to={`/profile/${event.organizer.username}`} className="text-xs text-primary-600 hover:underline flex items-center gap-1">
              @{event.organizer.username} <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Story with interleaved photos */}
      <div className="max-w-2xl mx-auto px-4 pb-16">
        {paragraphs.map((para, i) => (
          <div key={i}>
            <p className="text-gray-700 text-lg leading-relaxed mb-6">{para}</p>
            {/* Insert a photo after every 2nd paragraph */}
            {photos[Math.floor(i / 2)] && i % 2 === 1 && (
              <div className="mb-8 -mx-4 sm:mx-0">
                <img
                  src={photos[Math.floor(i / 2)].imageUrl}
                  alt={photos[Math.floor(i / 2)].caption || ''}
                  className="w-full sm:rounded-2xl object-cover max-h-80"
                />
                {photos[Math.floor(i / 2)].caption && (
                  <p className="text-sm text-gray-400 text-center mt-2 italic px-4 sm:px-0">
                    {photos[Math.floor(i / 2)].caption}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Remaining photos grid */}
        {photos.length > Math.floor(paragraphs.length / 2) && (
          <div className="grid grid-cols-2 gap-3 mt-4 mb-8">
            {photos.slice(Math.floor(paragraphs.length / 2)).map((photo, i) => (
              <div key={i} className="aspect-square rounded-2xl overflow-hidden">
                <img src={photo.imageUrl} alt={photo.caption || ''} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-gray-100 pt-8 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-amber-600">
            <Sparkles className="w-3.5 h-3.5" />
            Generated by Hitch AI · {new Date(story.generatedAt).toLocaleDateString()}
          </div>
          <Link
            to={`/trips/${event.id}`}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
          >
            View full trip <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

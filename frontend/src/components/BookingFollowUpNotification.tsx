import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, Calendar, MapPin, Check } from 'lucide-react';
import api from '../services/api';

interface BookingFollowUp {
  id: string;
  clickedAt: string;
  campground: {
    id: string;
    name: string;
    location: string;
    state: string;
    imageUrl: string | null;
    campspotSlug: string | null;
  };
}

export default function BookingFollowUpNotification() {
  const [followUps, setFollowUps] = useState<BookingFollowUp[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);

  useEffect(() => {
    checkForFollowUps();
    const interval = setInterval(checkForFollowUps, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const checkForFollowUps = async () => {
    try {
      const { data } = await api.get('/booking-clicks/pending-followups');
      setFollowUps(data);
    } catch (error) {
      console.error('Error checking for follow-ups:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResponse = async (didBook: boolean) => {
    if (!followUps[currentIndex]) return;
    
    setResponding(true);
    try {
      const clickId = followUps[currentIndex].id;
      await api.post(`/booking-clicks/${clickId}/respond`, { didBook });

      if (didBook) {
        const campground = followUps[currentIndex].campground;
        const params = new URLSearchParams({
          campgroundId: campground.id,
          campgroundName: campground.name,
          fromBooking: 'true',
          clickId: clickId
        });
        window.location.href = `/trips/new?${params.toString()}`;
      } else {
        if (currentIndex < followUps.length - 1) {
          setCurrentIndex(currentIndex + 1);
        } else {
          setFollowUps([]);
        }
      }
    } catch (error) {
      console.error('Error responding to follow-up:', error);
    } finally {
      setResponding(false);
    }
  };

  const handleDismiss = async () => {
    if (followUps[currentIndex]) {
      try {
        await api.post(`/booking-clicks/${followUps[currentIndex].id}/respond`, { didBook: null });
      } catch (error) {
        console.error('Error dismissing:', error);
      }
    }
    
    if (currentIndex < followUps.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setFollowUps([]);
    }
  };

  if (loading || followUps.length === 0) return null;

  const currentFollowUp = followUps[currentIndex];
  const campground = currentFollowUp.campground;
  const clickTime = new Date(currentFollowUp.clickedAt);
  const timeAgo = getTimeAgo(clickTime);

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md w-full">
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Calendar className="w-5 h-5" />
            <span className="font-semibold">Did you book?</span>
          </div>
          <button onClick={handleDismiss} className="text-white/80 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          <div className="flex gap-3 mb-4">
            {campground.imageUrl ? (
              <img 
                src={campground.imageUrl.startsWith('http') ? campground.imageUrl : `${campground.imageUrl}`}
                alt={campground.name}
                className="w-16 h-16 rounded-lg object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-green-100 flex items-center justify-center">
                <MapPin className="w-6 h-6 text-green-600" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <Link 
                to={`/campgrounds/${campground.id}`}
                className="font-bold text-gray-900 hover:text-green-600 transition line-clamp-1"
              >
                {campground.name}
              </Link>
              <p className="text-sm text-gray-500 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {campground.location}, {campground.state}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                You clicked "Book on Campspot" {timeAgo}
              </p>
            </div>
          </div>

          <p className="text-gray-700 mb-4">
            Did you complete your booking at <strong>{campground.name}</strong>?
          </p>

          <div className="flex gap-3">
            <button
              onClick={() => handleResponse(false)}
              disabled={responding}
              className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
            >
              No, not yet
            </button>
            <button
              onClick={() => handleResponse(true)}
              disabled={responding}
              className="flex-1 px-4 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              Yes, I booked!
            </button>
          </div>

          <p className="text-xs text-gray-400 text-center mt-3">
            If you booked, we'll help you create a trip to share with friends! 🏕️
          </p>
        </div>

        {followUps.length > 1 && (
          <div className="px-4 pb-3 flex items-center justify-center gap-1">
            {followUps.map((_, idx) => (
              <div 
                key={idx}
                className={`w-2 h-2 rounded-full transition ${idx === currentIndex ? 'bg-green-500' : 'bg-gray-300'}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  
  if (diffHours < 1) return `${diffMins} minutes ago`;
  if (diffHours === 1) return '1 hour ago';
  if (diffHours < 24) return `${diffHours} hours ago`;
  const diffDays = Math.floor(diffHours / 24);
  return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
}

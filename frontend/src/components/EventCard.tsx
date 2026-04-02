import { Link } from 'react-router-dom';
import { Calendar, Users, MapPin } from 'lucide-react';

const TYPE_COLORS: Record<string, string> = {
  RALLY: 'bg-amber-100 text-amber-800',
  MEETUP: 'bg-teal-100 text-teal-800',
  CAMPOUT: 'bg-orange-100 text-orange-800',
  OTHER: 'bg-gray-100 text-gray-700',
};

interface Props {
  event: any;
  onJoin?: (eventId: string) => void;
  isJoined?: boolean;
}

export default function EventCard({ event, onJoin, isJoined }: Props) {
  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg hover:border-orange-200 transition group">
      <Link to={`/events-v2/${event.id}`}>
        <div className="h-32 bg-gradient-to-br from-[#1B2B4B] to-[#2d4a7a] overflow-hidden relative">
          {event.bannerImage ? (
            <img src={event.bannerImage} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" alt="" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl opacity-30">🏕️</div>
          )}
          <span className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${TYPE_COLORS[event.eventType] || TYPE_COLORS.OTHER}`}>
            {event.eventType || 'EVENT'}
          </span>
        </div>
      </Link>
      <div className="p-3">
        <Link to={`/events-v2/${event.id}`} className="font-bold text-gray-900 text-sm hover:text-orange-600 transition line-clamp-1">{event.title}</Link>
        <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
          <Calendar className="w-3 h-3" />
          <span>{formatDate(event.startDate)} – {formatDate(event.endDate)}</span>
        </div>
        {(event.campground?.name || event.locationName) && (
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
            <MapPin className="w-3 h-3" />
            <span className="truncate">{event.campground?.name || event.locationName}</span>
          </div>
        )}
        <div className="flex items-center justify-between mt-2.5">
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Users className="w-3 h-3" />
            <span>{event._count?.attendees || event.attendees?.length || 0} attending</span>
          </div>
          {onJoin && !isJoined && (
            <button onClick={(e) => { e.preventDefault(); onJoin(event.id); }}
              className="text-xs bg-orange-500 text-white px-3 py-1 rounded-lg font-semibold hover:bg-orange-600 transition">
              Join
            </button>
          )}
          {isJoined && (
            <span className="text-xs text-green-600 font-semibold">✓ Joined</span>
          )}
        </div>
      </div>
    </div>
  );
}

import { Link } from 'react-router-dom';
import { Calendar } from 'lucide-react';
import { useState, useEffect } from 'react';

const HITCH_AVATAR = 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261116/rvunicorn/characters/hitch.png';

// Fallback photos by region
const FALLBACK_PHOTOS: Record<string, string> = {
  mountain: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1773960904/rvunicorn/stargazing.png',
  default: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261116/rvunicorn/characters/hitch.png',
};

const MOUNTAIN_STATES = ['MT', 'WY', 'CO', 'ID', 'UT', 'AZ', 'NM'];

interface Badge {
  emoji: string;
  label: string;
  type: string;
}

interface Props {
  event: any;
  badge?: Badge | null;
}

function computeBadge(event: any): Badge {
  const nights = event.startDate && event.endDate
    ? Math.max(1, Math.ceil((new Date(event.endDate).getTime() - new Date(event.startDate).getTime()) / 86400000))
    : 1;

  // Check for long stay
  if (nights >= 7) return { emoji: '🌙', label: `${nights}-night adventure`, type: 'LONG_STAY' };
  // First time at this campground — default for most trips since we lack visit history client-side
  if (event.campground?.name) return { emoji: '🏕', label: 'First time here!', type: 'FIRST_VISIT' };
  return { emoji: '🌟', label: 'Memory made', type: 'MEMORY' };
}

export default function DestinationSnapshotCard({ event, badge: propBadge }: Props) {
  const [badgeVisible, setBadgeVisible] = useState(false);
  const badge = propBadge || computeBadge(event);

  useEffect(() => {
    const t = setTimeout(() => setBadgeVisible(true), 200);
    return () => clearTimeout(t);
  }, []);

  const campground = event.campground;
  const photo = campground?.imageUrl || campground?.coverPhotoUrl || null;
  const hasPhoto = !!photo;

  const dateRange = event.startDate
    ? `${new Date(event.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}${event.endDate && event.endDate !== event.startDate ? `–${new Date(event.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : `, ${new Date(event.startDate).getFullYear()}`}`
    : '';

  const duration = event.startDate && event.endDate
    ? Math.max(1, Math.ceil((new Date(event.endDate).getTime() - new Date(event.startDate).getTime()) / 86400000))
    : null;

  const daysAgo = event.endDate
    ? Math.max(0, Math.floor((Date.now() - new Date(event.endDate).getTime()) / 86400000))
    : null;

  const confirmedAttendees = (event.attendees || []).filter((a: any) =>
    ['ATTENDING', 'attending', 'GOING', 'going'].includes(a.status)
  );

  // Full state name
  const stateMap: Record<string, string> = { TX: 'Texas', IA: 'Iowa', MT: 'Montana', WY: 'Wyoming', FL: 'Florida', AZ: 'Arizona', NM: 'New Mexico', CO: 'Colorado', UT: 'Utah', CA: 'California', OR: 'Oregon', WA: 'Washington', WI: 'Wisconsin', MI: 'Michigan', GA: 'Georgia', NY: 'New York', MA: 'Massachusetts', SD: 'South Dakota', KY: 'Kentucky', IN: 'Indiana', KS: 'Kansas', PA: 'Pennsylvania' };
  const stateFull = campground?.state ? (stateMap[campground.state] || campground.state) : '';
  const locationStr = [campground?.city, stateFull].filter(Boolean).join(', ');

  return (
    <div className="rounded-2xl overflow-hidden relative" style={{ minHeight: 180 }}>
      {/* Background */}
      {hasPhoto ? (
        <>
          <img src={photo} alt={campground?.name || ''} className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(15,28,53,0.2) 0%, rgba(15,28,53,0.88) 100%)' }} />
        </>
      ) : (
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #1B2B4B 0%, #243352 100%)' }}>
          <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-6xl opacity-10">🏕️</span>
        </div>
      )}

      {/* Hitch avatar + days ago */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
        {daysAgo != null && daysAgo > 0 && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(15,28,53,0.6)', color: 'rgba(255,255,255,0.6)' }}>{daysAgo}d ago</span>
        )}
        <img
          src={HITCH_AVATAR}
          alt="Hitch"
          className="w-9 h-9 rounded-full object-cover"
          style={{ border: '2px solid #C9A84C' }}
          title="Hitch remembers this trip 🏕"
        />
      </div>

      {/* Content */}
      <div className="relative z-10 p-5 flex flex-col justify-end" style={{ minHeight: 180 }}>
        {/* Badge + days ago */}
        <div className="mb-auto">
          <span
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-all"
            style={{
              background: 'rgba(201,168,76,0.15)',
              border: '1px solid rgba(201,168,76,0.4)',
              color: '#C9A84C',
              opacity: badgeVisible ? 1 : 0,
              transform: badgeVisible ? 'scale(1)' : 'scale(0.8)',
              transitionDuration: '400ms',
            }}
          >
            {badge.emoji} {badge.label}
          </span>
        </div>

        {/* Bottom info */}
        <div className="mt-auto pt-4">
          {/* Campground name */}
          {campground?.id ? (
            <Link to={`/campgrounds/${campground.id}`} className="text-lg font-bold text-white hover:underline block" style={{ fontFamily: "'Playfair Display', serif" }}>
              {campground.name}
            </Link>
          ) : (
            <p className="text-lg font-bold text-white" style={{ fontFamily: "'Playfair Display', serif" }}>{event.title}</p>
          )}

          {/* Location */}
          {locationStr && (
            <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>{locationStr}</p>
          )}

          {/* Date + duration */}
          {dateRange && (
            <p className="text-xs mt-2 flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
              <Calendar className="w-3 h-3" />
              {dateRange}{duration ? ` · ${duration} night${duration !== 1 ? 's' : ''}` : ''}
            </p>
          )}

          {/* Attendees */}
          {confirmedAttendees.length > 0 && (
            <div className="flex items-center gap-2 mt-2.5">
              <div className="flex -space-x-2">
                {confirmedAttendees.slice(0, 4).map((a: any) => (
                  <div key={a.userId || a.id} className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0" style={{ border: '2px solid rgba(255,255,255,0.8)', background: '#243352' }}>
                    {a.user?.profilePicture
                      ? <img src={a.user.profilePicture} className="w-full h-full object-cover" alt="" />
                      : <span className="w-full h-full flex items-center justify-center text-[10px] font-bold text-white">{a.user?.firstName?.[0]}</span>
                    }
                  </div>
                ))}
                {confirmedAttendees.length > 4 && (
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ background: '#243352', border: '2px solid rgba(255,255,255,0.8)', color: 'rgba(255,255,255,0.7)' }}>+{confirmedAttendees.length - 4}</div>
                )}
              </div>
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{confirmedAttendees.length} camper{confirmedAttendees.length !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

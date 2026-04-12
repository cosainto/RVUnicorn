import { useState, useEffect } from 'react';
import { Calendar, MapPin, Users, CheckCircle2 } from 'lucide-react';
import api from '../../services/api';
import { format } from 'date-fns';

const EVENT_ICONS: Record<string, string> = {
  MEETUP: '🤝', CAMPFIRE_TALK: '🔥', WORKSHOP: '🔧',
  PHOTOGRAPHY_WALK: '📸', QA: '❓', OTHER: '📅',
};

interface CreatorEvent {
  id: string;
  title: string;
  type: string;
  startTime: string;
  endTime?: string;
  maxAttendees?: number;
  campground?: { id: string; name: string; city?: string; state?: string };
  _count: { rsvps: number };
  userHasRsvped?: boolean;
}

export default function CreatorEventsList({ creatorId }: { creatorId: string }) {
  const [events, setEvents] = useState<CreatorEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/creator-events/creator/${creatorId}?status=UPCOMING`).then(({ data }) => setEvents(data.events || [])).catch(() => {}).finally(() => setLoading(false));
  }, [creatorId]);

  async function toggleRsvp(eventId: string) {
    try {
      const { data } = await api.post(`/creator-events/${eventId}/rsvp`);
      setEvents(prev => prev.map(e => e.id === eventId ? { ...e, userHasRsvped: data.rsvped, _count: { ...e._count, rsvps: data.rsvpCount } } : e));
    } catch {}
  }

  if (loading) return <div className="animate-pulse h-20 bg-gray-100 rounded-xl" />;
  if (events.length === 0) return null;

  return (
    <div>
      <h3 className="font-bold text-gray-900 text-sm mb-3 flex items-center gap-2">
        <Calendar className="w-4 h-4 text-purple-500" /> Upcoming Events
      </h3>
      <div className="space-y-2">
        {events.map((evt) => {
          const spotsLeft = evt.maxAttendees ? evt.maxAttendees - evt._count.rsvps : null;
          return (
            <div key={evt.id} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3">
              <span className="text-2xl flex-shrink-0">{EVENT_ICONS[evt.type] || '📅'}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm">{evt.title}</p>
                <p className="text-xs text-gray-500">
                  {format(new Date(evt.startTime), 'MMM d · h:mm a')}
                  {evt.campground && <> · <MapPin className="w-3 h-3 inline" /> {evt.campground.name}</>}
                </p>
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                  <span><Users className="w-3 h-3 inline" /> {evt._count.rsvps} going</span>
                  {spotsLeft !== null && <span>{spotsLeft > 0 ? `${spotsLeft} spots left` : 'Full'}</span>}
                </div>
              </div>
              <button onClick={() => toggleRsvp(evt.id)}
                disabled={spotsLeft !== null && spotsLeft <= 0 && !evt.userHasRsvped}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  evt.userHasRsvped
                    ? 'bg-green-100 text-green-700'
                    : 'bg-amber-500 text-white hover:bg-amber-600'
                } disabled:opacity-50`}>
                {evt.userHasRsvped ? <><CheckCircle2 className="w-3 h-3 inline mr-1" />Going</> : 'RSVP'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Plus } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import EventCard from '../components/EventCard';

const TYPE_FILTERS = ['ALL', 'RALLY', 'MEETUP', 'CAMPOUT', 'OTHER'];

export default function EventsDiscoveryPage() {
  const { user } = useAuth() as any;
  const [events, setEvents] = useState<any[]>([]);
  const [myEvents, setMyEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const load = async () => {
      try {
        const params: any = { upcoming: 'true', limit: '30' };
        if (typeFilter !== 'ALL') params.eventType = typeFilter;
        const { data } = await api.get('/events-v2', { params });
        setEvents(data.events || []);

        // Load user's joined events
        if (user) {
          const joined = (data.events || []).filter((e: any) =>
            e.attendees?.some((a: any) => a.userId === user.id) || e.organizerId === user.id
          );
          setMyEvents(joined);
          setJoinedIds(new Set(joined.map((e: any) => e.id)));
        }
      } catch {}
      setLoading(false);
    };
    load();
  }, [typeFilter, user]);

  const handleJoin = async (eventId: string) => {
    try {
      await api.post(`/events-v2/${eventId}/join`, { participationMode: 'FULL' });
      setJoinedIds(prev => new Set(prev).add(eventId));
    } catch {}
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Helmet><title>Events & Rallies — RVUnicorn</title></Helmet>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">🎪 Events & Rallies</h1>
            <p className="text-sm text-gray-500 mt-0.5">Find campouts, meetups, and rallies near you</p>
          </div>
          {user && (
            <Link to="/events-v2/create" className="flex items-center gap-1.5 bg-[#E86C3A] text-white px-4 py-2 rounded-xl font-semibold text-sm hover:bg-orange-600 transition">
              <Plus className="w-4 h-4" /> Create Event
            </Link>
          )}
        </div>

        {/* Type filters */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {TYPE_FILTERS.map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition ${typeFilter === t ? 'bg-[#1B2B4B] text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-orange-300'}`}>
              {t === 'ALL' ? 'All Events' : t.charAt(0) + t.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Your events */}
        {myEvents.length > 0 && (
          <div className="mb-8">
            <h2 className="font-bold text-gray-900 text-sm mb-3">Your Events</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {myEvents.map(e => <EventCard key={e.id} event={e} isJoined />)}
            </div>
          </div>
        )}

        {/* All events */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-48 bg-white rounded-2xl border border-gray-100 animate-pulse" />)}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">🏕️</div>
            <p className="font-semibold text-gray-800 mb-1">No upcoming events</p>
            <p className="text-sm text-gray-500 mb-4">Be the first to organize a rally or meetup!</p>
            {user && <Link to="/events-v2/create" className="bg-[#E86C3A] text-white px-5 py-2 rounded-xl font-semibold text-sm hover:bg-orange-600 transition">Create Event</Link>}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map(e => (
              <EventCard key={e.id} event={e} isJoined={joinedIds.has(e.id)} onJoin={handleJoin} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

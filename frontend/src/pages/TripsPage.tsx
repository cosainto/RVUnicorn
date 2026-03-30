import React from 'react';
import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Calendar, MapPin, Users, Plus, Search, Edit, Trash2 } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import ImageUpload from '../components/ImageUpload';
import CampgroundSelector from '../components/CampgroundSelector';

interface Event {
  roadTripId?: string;
  roadTripColor?: string;
  roadTripTitle?: string;
  stopNumber?: number;
  roadTrip?: { id: string; title: string; color: string; font: string; _count?: { stops: number } };
  organizer?: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture?: string;
  };
  organizer?: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture?: string;
  };
  organizerId?: string;
  isStateVisit?: boolean;
  id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate?: string;
  location?: string;
  imageUrl?: string;
  campground?: {
    id: string;
    name: string;
    location?: string;
    state?: string;
  };
  _count?: {
    attendees: number;
  };
}

interface Friend {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  profilePicture?: string;
}

function RoadTripsEmbed() {
  const [roadTrips, setRoadTrips] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    import('../services/api').then(({ default: api }) => {
      api.get('/road-trips')
        .then(({ data }) => { setRoadTrips(data); setLoading(false); })
        .catch(() => setLoading(false));
    });
  }, []);

  if (loading) return <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Multi-Stop Trips</h2>
          <p className="text-sm text-gray-500 mt-0.5">Plan a route across multiple campgrounds</p>
        </div>
        <a href="/road-trips" className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 transition shadow-sm">
          + New Road Trip
        </a>
      </div>
      {roadTrips.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
          <div className="text-5xl mb-3">🚐</div>
          <p className="font-semibold text-gray-700 mb-1">No multi-stop trips yet</p>
          <p className="text-sm text-gray-400 mb-5">Plan a road trip across multiple campgrounds</p>
          <a href="/road-trips" className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 transition">
            Plan Your First Road Trip
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {roadTrips.map((rt: any) => (
            <a key={rt.id} href={`/road-trips/${rt.id}`}
              className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition group">
              <div className="h-2 rounded-t-2xl" style={{ background: rt.color || '#f97316' }} />
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-bold text-gray-900 group-hover:text-orange-600 transition">{rt.title}</h3>
                  <span className="text-xs bg-orange-50 text-orange-600 border border-orange-200 px-2 py-0.5 rounded-full flex-shrink-0">
                    {rt.stops?.length || 0} stops
                  </span>
                </div>
                {rt.description && <p className="text-xs text-gray-500 mb-3 line-clamp-1">{rt.description}</p>}
                <div className="flex flex-wrap gap-2 text-xs text-gray-400">
                  {rt.stops?.slice(0, 3).map((stop: any, i: number) => (
                    <span key={stop.id} className="flex items-center gap-1">
                      {i > 0 && <span className="text-gray-300">→</span>}
                      📍 {stop.campground?.name?.split(' ')[0] || stop.title?.split(' ')[0] || 'Stop'}
                    </span>
                  ))}
                  {rt.stops?.length > 3 && <span className="text-gray-400">+{rt.stops.length - 3} more</span>}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EventsPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [overnightSpotResults, setOvernightSpotResults] = useState<any[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<"upcoming" | "past" | "discover" | "friends" | "roadtrips" | "wishlist">("upcoming");
  const [wishlistEvents, setWishlistEvents] = React.useState<any[]>([]);
  const [wishlistLoading, setWishlistLoading] = React.useState(false);
  const [discoverEvents, setDiscoverEvents] = useState<Event[]>([]);
  const [friendsEvents, setFriendsEvents] = useState<Event[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  
  // Helper to get date string in YYYY-MM-DD format
  const getDateString = (daysFromNow: number = 0) => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toISOString().split("T")[0];
  };
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startDate: getDateString(0),
    endDate: getDateString(7),
    location: '',
    campgroundId: null as string | null,
    overnightSpotId: null as string | null,
    destinationType: 'CAMPGROUND' as 'CAMPGROUND' | 'OVERNIGHT_SPOT' | 'OTHER',
    imageUrl: '',
    attendeeIds: [] as string[],
    privacy: 'PUBLIC',
    isMultiStop: false,
  });

  // Multi-stop state
  const [multiStops, setMultiStops] = useState<Array<{
    campgroundId: string;
    campgroundName: string;
    campgroundLocation: string;
    campgroundState: string;
    arrivalDate: string;
    departureDate: string;
    latitude?: number;
    longitude?: number;
  }>>([]);
  const [stopSearch, setStopSearch] = useState('');
  const [stopSearchResults, setStopSearchResults] = useState<any[]>([]);
  const [stopSearching, setStopSearching] = useState(false);
  const [addingStopAt, setAddingStopAt] = useState<number | null>(null);
  const [pendingStop, setPendingStop] = useState<any>(null);
  const [pendingDates, setPendingDates] = useState({ arrivalDate: '', departureDate: '' });

  const searchStops = async (q: string) => {
    if (q.length < 2) { setStopSearchResults([]); return; }
    try {
      setStopSearching(true);
      const { data } = await api.get(`/campgrounds?search=${encodeURIComponent(q)}&limit=8`);
      setStopSearchResults(Array.isArray(data) ? data : (data.campgrounds || []));
    } catch (e) { console.error(e); }
    finally { setStopSearching(false); }
  };

  useEffect(() => {
    const t = setTimeout(() => searchStops(stopSearch), 350);
    return () => clearTimeout(t);
  }, [stopSearch]);

  const addMultiStop = () => {
    if (!pendingStop || !pendingDates.arrivalDate) return;

    // Validate: arrival must be after previous stop's departure
    const insertIdx = addingStopAt !== null ? addingStopAt : multiStops.length;
    const prevStop = insertIdx > 0 ? multiStops[insertIdx - 1] : null;
    const nextStop = insertIdx < multiStops.length ? multiStops[insertIdx] : null;

    // Normalize all dates to YYYY-MM-DD for safe string comparison (strips timestamps)
    const toDate = (d: string) => d ? d.slice(0, 10) : '';

    if (prevStop) {
      const prevEnd = toDate(prevStop.departureDate || prevStop.arrivalDate);
      if (toDate(pendingDates.arrivalDate) < prevEnd) {
        alert(`Arrival date must be after ${prevStop.campgroundName}'s departure (${new Date(prevEnd + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})`);
        return;
      }
    }

    if (pendingDates.departureDate && toDate(pendingDates.departureDate) < toDate(pendingDates.arrivalDate)) {
      alert('Departure date cannot be before arrival date');
      return;
    }

    if (nextStop && pendingDates.departureDate && toDate(pendingDates.departureDate) >= toDate(nextStop.arrivalDate)) {
      alert(`Departure must be before the next stop's arrival (${new Date(toDate(nextStop.arrivalDate) + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})`);
      return;
    }

    const newStop = {
      campgroundId: pendingStop.id,
      campgroundName: pendingStop.name,
      campgroundLocation: pendingStop.location || '',
      campgroundState: pendingStop.state || '',
      arrivalDate: pendingDates.arrivalDate,
      departureDate: pendingDates.departureDate,
      latitude: pendingStop.latitude,
      longitude: pendingStop.longitude,
    };
    if (addingStopAt !== null) {
      const updated = [...multiStops];
      updated.splice(addingStopAt, 0, newStop);
      setMultiStops(updated);
    } else {
      setMultiStops(prev => [...prev, newStop]);
    }
    setPendingStop(null);
    setStopSearch('');
    setStopSearchResults([]);
    setPendingDates({ arrivalDate: '', departureDate: '' });
    setAddingStopAt(null);
  };

  const removeMultiStop = (idx: number) => {
    setMultiStops(prev => prev.filter((_, i) => i !== idx));
  };

  // Handle wishlist create params
  useEffect(() => {
    const createFromWishlist = searchParams.get('createFromWishlist');
    const campgroundId = searchParams.get('campgroundId');
    const campgroundName = searchParams.get('campgroundName');
    const startDateParam = searchParams.get('startDate');
    const createParam = searchParams.get('create');
    if (createParam === 'true' && startDateParam) {
      setFormData(prev => ({ ...prev, startDate: startDateParam, endDate: startDateParam }));
      setShowCreateModal(true);
    }
    
    if (createFromWishlist === 'true' && campgroundId) {
      // Fetch campground to get its banner image
      api.get(`/campgrounds/${campgroundId}`).then(({ data: cg }) => {
        const bannerImage = cg.imageUrl || cg.bannerImage || cg.photos?.[0]?.imageUrl || '';
        setFormData(prev => ({
          ...prev,
          campgroundId,
          title: campgroundName ? `Trip to ${campgroundName}` : `From ${user?.firstName || 'My'}'s Wishlist`,
          imageUrl: bannerImage,
        }));
      }).catch(() => {
        setFormData(prev => ({
          ...prev,
          campgroundId,
          title: campgroundName ? `Trip to ${campgroundName}` : `From ${user?.firstName || 'My'}'s Wishlist`,
        }));
      });
      setShowCreateModal(true);
      setSearchParams({});
    }
  }, [searchParams, user]);

  useEffect(() => {
    loadEvents();
    loadFriends();
  }, []);

  useEffect(() => {
    if (activeTab === 'wishlist' && wishlistEvents.length === 0) {
      setWishlistLoading(true);
      api.get('/campground-actions/wishlist')
        .then(({ data }) => {
          // Transform CampgroundWishlist items into displayable format
          const items = (Array.isArray(data) ? data : []).map((item: any) => ({
            id: item.id,
            title: item.campground?.name || 'Wishlist Item',
            campground: item.campground,
            isWishlist: true,
          }));
          setWishlistEvents(items);
        })
        .catch(() => {})
        .finally(() => setWishlistLoading(false));
    }
  }, [activeTab]);

  useEffect(() => {
    filterEvents();
  }, [events, discoverEvents, friendsEvents, searchQuery, activeTab]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/trips/my`);
      // Filter out StateVisits - they're shown on Travel Map, not here
      setEvents(data.filter((e: Event) => !e.isStateVisit));
    } catch (error) {
      console.error('Load events error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFriends = async () => {
    try {
      const { data } = await api.get('/friends');
      setFriends(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Load friends error:', error);
    }
  };

  const loadDiscoverEvents = async () => {
    try {
      const { data } = await api.get('/trips/discover');
      setDiscoverEvents(data);
    } catch (error) {
      console.error('Load discover events error:', error);
    }
  };

  const loadFriendsEvents = async () => {
    try {
      const { data } = await api.get('/trips/friends-events');
      setFriendsEvents(data);
    } catch (error) {
      console.error('Load friends events error:', error);
    }
  };

  const filterEvents = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let filtered = events;

    if (searchQuery) {
      filtered = filtered.filter(e =>
        e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.campground?.name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by tab
    if (activeTab === "discover") {
      filtered = discoverEvents;
    } else if (activeTab === "friends") {
      filtered = friendsEvents;
    } else if (activeTab === "wishlist") {
      filtered = filtered.filter(e => e.isWishlist);
    } else if (activeTab === "upcoming") {
      filtered = filtered.filter(e => {
        if (e.isWishlist) return false;
        const endDate = e.endDate ? new Date(e.endDate) : new Date(e.startDate);
        return endDate >= today;
      });
    } else {
      filtered = filtered.filter(e => {
        if (e.isWishlist) return false;
        const endDate = e.endDate ? new Date(e.endDate) : new Date(e.startDate);
        return endDate < today;
      });
    }

    // Apply search to discover/friends tabs too
    if ((activeTab === "discover" || activeTab === "friends") && searchQuery) {
      filtered = filtered.filter(e =>
        e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.campground?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.organizer?.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.organizer?.lastName?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredEvents(filtered);
  };

  const handleDeleteEvent = async (eventId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this event?")) return;
    try {
      await api.delete(`/events/${eventId}`);
      setEvents(prev => prev.filter(ev => ev.id !== eventId));
    } catch (error: any) {
      alert(error.response?.data?.error || "Failed to delete event");
    }
  };

  const handleCreateEvent = async () => {
    if (!formData.title || !formData.startDate) {
      alert('Please fill in all required fields');
      return;
    }

    // Multi-stop validation
    if (formData.isMultiStop && multiStops.length < 2) {
      alert('Please add at least 2 campground stops for a multi-stop trip');
      return;
    }

    try {
      // For multi-stop: use first stop as anchor, last departure as end date
      const firstStop = formData.isMultiStop ? multiStops[0] : null;
      const lastStop = formData.isMultiStop ? multiStops[multiStops.length - 1] : null;

      const { data } = await api.post('/trips', {
        title: formData.title,
        description: formData.description,
        startDate: formData.isMultiStop ? firstStop!.arrivalDate : formData.startDate,
        endDate: formData.isMultiStop ? (lastStop!.departureDate || lastStop!.arrivalDate) : (formData.endDate || formData.startDate),
        location: formData.isMultiStop ? `${firstStop!.campgroundName} → ${lastStop!.campgroundName}` : formData.location,
        campgroundId: formData.isMultiStop ? firstStop!.campgroundId : (formData.destinationType === 'CAMPGROUND' ? formData.campgroundId : null),
        overnightSpotId: formData.destinationType === 'OVERNIGHT_SPOT' ? formData.overnightSpotId : null,
        destinationType: 'CAMPGROUND',
        bannerImage: formData.imageUrl,
      });

      // For multi-stop: create a TripPlan and PitStops for stops 2..N
      if (formData.isMultiStop && multiStops.length > 1) {
        try {
          // Create the trip plan anchored to this event
          const { data: tripPlan } = await api.post(`/trip-planner/event/${data.id}/plan`, {
            startLocation: `${firstStop!.campgroundName}, ${firstStop!.campgroundLocation}, ${firstStop!.campgroundState}`,
            useHometown: false,
            isDriving: true,
            arrivalDate: firstStop!.arrivalDate,
          });

          // Add stops 2..N as campground pit stops
          for (let i = 1; i < multiStops.length; i++) {
            const stop = multiStops[i];
            await api.post(`/trip-planner/trip/${tripPlan.id}/campground-stop`, {
              campgroundId: stop.campgroundId,
              arrivalDate: stop.arrivalDate,
              departureDate: stop.departureDate || null,
              orderIndex: i - 1,
            });
          }
        } catch (planErr) {
          console.error('Trip plan creation error (non-fatal):', planErr);
        }
      }

      // Invite attendees if any selected
      if (formData.attendeeIds.length > 0) {
        await api.post(`/trips/${data.id}/attendees`, {
          userIds: formData.attendeeIds,
        });
      }

      alert('✅ Event created successfully!');
      setShowCreateModal(false);
      setMultiStops([]);
      setFormData({
        title: '',
        description: '',
        startDate: getDateString(0),
        endDate: getDateString(7),
        location: '',
        campgroundId: null,
        overnightSpotId: null,
        destinationType: 'CAMPGROUND' as 'CAMPGROUND' | 'OVERNIGHT_SPOT' | 'OTHER',
        imageUrl: '',
        attendeeIds: [],
        privacy: 'PUBLIC',
        isMultiStop: false,
      });
      loadEvents();
      loadDiscoverEvents();
      loadFriendsEvents();
    } catch (error) {
      console.error('Create event error:', error);
      alert('Failed to create event');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-r from-green-500 to-blue-500 p-3 rounded-xl shadow-lg">
            <Calendar className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Events</h1>
            <p className="text-gray-600">Discover and join camping events! ⛺</p>
          </div>
        </div>
       

         <button
          onClick={() => {
            setFormData({
              title: '',
              description: '',
              startDate: getDateString(0),
              endDate: getDateString(7),
              location: '',
              campgroundId: null,
        overnightSpotId: null,
        destinationType: 'CAMPGROUND' as 'CAMPGROUND' | 'OVERNIGHT_SPOT' | 'OTHER',
              imageUrl: '',
              attendeeIds: [],
            });
            setShowCreateModal(true);
          }}
          className="btn btn-primary flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition"
        >
          <Plus className="w-5 h-5 mr-2" />
          Create Event
        </button>


      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setActiveTab("upcoming")}
          className={`px-6 py-3 rounded-lg font-semibold transition ${activeTab === "upcoming" ? "bg-primary-600 text-white" : "bg-white text-gray-700 hover:bg-gray-100"}`}
        >
          🗓️ My Upcoming
        </button>
        <button
          onClick={() => setActiveTab("past")}
          className={`px-6 py-3 rounded-lg font-semibold transition ${activeTab === "past" ? "bg-primary-600 text-white" : "bg-white text-gray-700 hover:bg-gray-100"}`}
        >
          ✅ My Past
        </button>
        <button
          onClick={() => setActiveTab("friends")}
          className={`px-6 py-3 rounded-lg font-semibold transition ${activeTab === "friends" ? "bg-primary-600 text-white" : "bg-white text-gray-700 hover:bg-gray-100"}`}
        >
          👥 Friends' Trips
        </button>
        <button
          onClick={() => setActiveTab("discover")}
          className={`px-6 py-3 rounded-lg font-semibold transition ${activeTab === "discover" ? "bg-primary-600 text-white" : "bg-white text-gray-700 hover:bg-gray-100"}`}
        >
          🌎 Discover
        </button>
        <button
          onClick={() => setActiveTab("roadtrips")}
          className={`px-6 py-3 rounded-lg font-semibold transition ${activeTab === "roadtrips" ? "bg-orange-500 text-white" : "bg-white text-gray-700 hover:bg-gray-100"}`}
        >
          🚐 Multi-Stop Trips
        </button>
        <button
          onClick={() => setActiveTab("wishlist")}
          className={`px-6 py-3 rounded-lg font-semibold transition ${activeTab === "wishlist" ? "bg-amber-500 text-white" : "bg-white text-gray-700 hover:bg-gray-100"}`}
        >
          🧞 Wishlist
        </button>
      </div>

      {/* Multi-Stop Trips tab */}
      {activeTab === "roadtrips" && (
        <RoadTripsEmbed />
      )}

      {/* Wishlist tab */}
      {activeTab === "wishlist" && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">🧞 My Wishlist</h2>
              <p className="text-sm text-gray-500 mt-0.5">Campgrounds and destinations you want to visit</p>
            </div>
          </div>
          {wishlistLoading ? (
            <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" /></div>
          ) : wishlistEvents.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
              <div className="text-5xl mb-3">🧞</div>
              <p className="font-semibold text-gray-700 mb-1">Your wishlist is empty</p>
              <p className="text-sm text-gray-400 mb-5">Browse campgrounds and add them to your wishlist for later</p>
              <a href="/campgrounds" className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 transition">
                Browse Campgrounds
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {wishlistEvents.map((event: any) => (
                <a key={event.id} href={`/trips/${event.id}`}
                  className="bg-white rounded-2xl border border-amber-200 overflow-hidden hover:shadow-md transition group">
                  {event.campground?.imageUrl && (
                    <img src={event.campground.imageUrl} alt="" className="w-full h-32 object-cover" />
                  )}
                  <div className="p-4">
                    <div className="flex items-start gap-2 mb-1">
                      <span className="text-amber-500 flex-shrink-0">🧞</span>
                      <h3 className="font-bold text-gray-900 group-hover:text-amber-600 transition text-sm leading-tight">{event.title}</h3>
                    </div>
                    {event.campground && (
                      <p className="text-xs text-gray-500 mt-1">
                        📍 {event.campground.name}{event.campground.city ? `, ${event.campground.city}` : ''}{event.campground.state ? `, ${event.campground.state}` : ''}
                      </p>
                    )}
                    <div className="mt-3 flex gap-2">
                      <a href={`/trips/${event.id}?createFromWishlist=true`}
                        className="flex-1 text-center text-xs py-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition font-medium"
                        onClick={e => e.stopPropagation()}>
                        Plan This Trip
                      </a>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {(activeTab !== "roadtrips" && activeTab !== "wishlist") && (<>
      {/* Search */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search events..."
            className="input w-full pl-10"
          />
        </div>
      </div>

      {/* Events Grid */}
      {filteredEvents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((event) => (
            <div
              key={event.id}
              className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition group relative"
              style={event.roadTrip ? { borderLeft: `4px solid ${event.roadTrip.color}` } : {}}
            >
              <Link to={event.isStateVisit ? `/travel-map` : `/trips/${event.id}`}>
                {/* Event Image */}
                <div className="h-48 bg-gradient-to-br from-green-100 to-blue-100 relative overflow-hidden">
                  {((event.bannerImage && !event.bannerImage.startsWith('/images/')) || event.imageUrl || event.campground?.imageUrl) ? (
                    <img
                      src={(event.bannerImage && !event.bannerImage.startsWith('/images/')) ? event.bannerImage : event.imageUrl || event.campground?.imageUrl}
                      alt={event.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Calendar className="w-16 h-16 text-green-300" />
                    </div>
                  )}
                  {/* Multi-stop ribbon */}
                  {event.location?.includes('→') && (
                    <div className="absolute top-3 left-0 bg-gradient-to-r from-primary-600 to-blue-500 text-white text-xs font-bold px-3 py-1 rounded-r-full shadow-md flex items-center gap-1">
                      🗺️ {event.location.split('→').length}-Stop Road Trip
                    </div>
                  )}
                </div>

                {/* Event Info */}
                <div className="p-4">
                  <h3 className="font-bold text-lg text-gray-900 mb-2 line-clamp-2">
                    {event.title}
                  </h3>
                  {event.roadTrip && (
                    <div className="flex items-center gap-1.5 mb-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: event.roadTrip.color }} />
                      <span className="text-xs font-semibold truncate" style={{ color: event.roadTrip.color }}>
                        {event.roadTrip.title}
                        {event.stopNumber && ` · Stop ${event.stopNumber}`}
                        {event.roadTrip._count && ` of ${event.roadTrip._count.stops}`}
                      </span>
                    </div>
                  )}
                  {event.location?.includes('→') && (
                    <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-primary-50 to-blue-50 border border-primary-200 text-primary-700 text-xs font-semibold px-2.5 py-1 rounded-full mb-2">
                      <span>🗺️</span>
                      <span>Multi-Stop Trip</span>
                      <span className="text-primary-400">·</span>
                      <span className="text-primary-500">{event.location.split('→').length} stops</span>
                    </div>
                  )}
                  {(activeTab === "discover" || activeTab === "friends") && event.organizer && (
                    <Link 
                      to={`/profile/${event.organizer.username}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-2 mb-2 hover:bg-gray-50 rounded-lg p-1 -ml-1 transition"
                    >
                      {event.organizer.profilePicture ? (
                        <img src={event.organizer.profilePicture} alt="" className="w-6 h-6 rounded-full object-cover" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center">
                          <span className="text-xs font-medium text-primary-600">
                            {event.organizer.firstName?.[0]}{event.organizer.lastName?.[0]}
                          </span>
                        </div>
                      )}
                      <span className="text-sm text-gray-600">
                        {event.organizer.firstName} {event.organizer.lastName}
                      </span>
                    </Link>
                  )}
                  {event.description && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {event.description}
                    </p>
                  )}

                  {/* Date */}
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                    <Calendar className="w-4 h-4 text-primary-600" />
                    {new Date(event.startDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                    {event.endDate && event.endDate !== event.startDate && (
                      <>
                        {' - '}
                        {new Date(event.endDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </>
                    )}
                  </div>

                  <div className="space-y-2 text-sm text-gray-600">
                    {(event.campground || event.location) && (
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-primary-600 mt-0.5 shrink-0" />
                        {event.location?.includes('→') ? (
                          <div className="flex flex-col gap-0.5">
                            {event.location.split('→').map((stop: string, i: number, arr: string[]) => (
                              <span key={i} className="flex items-center gap-1">
                                <span className="text-xs">{i === 0 ? '🏁' : i === arr.length - 1 ? '🏁' : '🏕️'}</span>
                                <span className="truncate">{stop.trim()}</span>
                              </span>
                            ))}
                          </div>
                        ) : event.campground ? (
                          <span>{event.campground.name}</span>
                        ) : (
                          <span>{event.location}</span>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary-600" />
                      {event._count?.attendees || 0} attendees
                    </div>
                  </div>

                  {event.campground?.location && (
                    <div className="mt-3 pt-3 border-t text-xs text-gray-500">
                      {event.campground.location}{event.campground.state ? `, ${event.campground.state}` : ''}
                    </div>
                  )}
                </div>
              </Link>

              {/* Action Buttons - Top Right (only for organizer) */}
              {user && event.organizerId === user.id && !event.isStateVisit && (
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <Link
                    to={`/trips/${event.id}/edit`}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-white hover:bg-gray-100 p-2 rounded-lg shadow-lg"
                    title="Edit Event"
                  >
                    <Edit className="w-4 h-4 text-gray-700" />
                  </Link>
                  <button
                    onClick={(e) => handleDeleteEvent(event.id, e)}
                    className="bg-white hover:bg-red-100 p-2 rounded-lg shadow-lg"
                    title="Delete Event"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg shadow-md">
          <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No events found</p>
        </div>
      )}

      {/* Create Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-green-500 to-blue-500 text-white p-6 rounded-t-xl sticky top-0 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Calendar className="w-8 h-8" />
                  <h2 className="text-2xl font-bold">Create Event</h2>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Event Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="input w-full"
                  placeholder="Summer Camping Trip 2024"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="input w-full"
                  placeholder="Tell everyone about this event..."
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="input w-full"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="input w-full"
                  />
                </div>
              </div>

              {/* Multi-stop toggle */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
                <div>
                  <p className="text-sm font-semibold text-gray-800">🗺️ Multi-stop road trip?</p>
                  <p className="text-xs text-gray-500">Add multiple campgrounds with dates</p>
                </div>
                <div
                  onClick={() => { setFormData(f => ({ ...f, isMultiStop: !f.isMultiStop })); setMultiStops([]); }}
                  className={`relative w-11 h-6 rounded-full cursor-pointer transition-colors ${formData.isMultiStop ? 'bg-primary-500' : 'bg-gray-300'}`}
                >
                  <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${formData.isMultiStop ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
              </div>

              {/* Single campground selector */}
              {!formData.isMultiStop && (
                <CampgroundSelector
                  selectedCampgroundId={formData.campgroundId}
                  manualLocation={formData.location}
                  onCampgroundSelect={(id, name, location) => {
                    setFormData({ ...formData, campgroundId: id, location: location || name });
                  }}
                  onManualLocationChange={(location) => {
                    setFormData({ ...formData, campgroundId: null, overnightSpotId: null, destinationType: 'CAMPGROUND' as 'CAMPGROUND' | 'OVERNIGHT_SPOT' | 'OTHER', location });
                  }}
                />
              )}

              {/* Multi-stop builder */}
              {formData.isMultiStop && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-gray-700">Campground Stops</p>

                  {/* Existing stops */}
                  {multiStops.map((stop, idx) => (
                    <div key={idx}>
                      <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                        <span className="text-lg mt-0.5">{idx === 0 ? '🏠' : idx === multiStops.length - 1 ? '🏁' : '🏕️'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm truncate">{stop.campgroundName}</p>
                          <p className="text-xs text-gray-500">{stop.campgroundLocation}{stop.campgroundState ? `, ${stop.campgroundState}` : ''}</p>
                          <div className="flex gap-3 mt-1 text-xs text-gray-600">
                            {stop.arrivalDate && <span>📅 Arrive {new Date(stop.arrivalDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                            {stop.departureDate && <span>→ Leave {new Date(stop.departureDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                          </div>
                        </div>
                        <button onClick={() => removeMultiStop(idx)} className="text-gray-300 hover:text-red-400 p-1 shrink-0">✕</button>
                      </div>
                      {/* Insert between stops */}
                      {idx < multiStops.length - 1 && (
                        <div className="flex justify-center my-1">
                          <button
                            onClick={() => setAddingStopAt(idx + 1)}
                            className="text-xs text-primary-500 hover:text-primary-700 border border-dashed border-primary-300 px-3 py-1 rounded-lg hover:bg-primary-50 transition"
                          >
                            + Insert stop here
                          </button>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Add stop form */}
                  {(addingStopAt !== null || multiStops.length === 0 || true) && (
                    <div className="border-2 border-dashed border-gray-200 rounded-xl p-3 space-y-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {addingStopAt !== null ? `Insert stop at position ${addingStopAt + 1}` : 'Add next stop'}
                      </p>
                      {/* Campground search */}
                      {!pendingStop ? (
                        <div className="relative">
                          <input
                            type="text"
                            value={stopSearch}
                            onChange={e => setStopSearch(e.target.value)}
                            placeholder="Search campground..."
                            className="input w-full pl-8 text-sm"
                          />
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                          {stopSearching && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">...</span>}
                          {stopSearchResults.length > 0 && (
                            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-gray-100">
                              {stopSearchResults.map((cg: any) => (
                                <button
                                  key={cg.id}
                                  onClick={() => { setPendingStop(cg); setStopSearch(''); setStopSearchResults([]); }}
                                  className="w-full text-left px-3 py-2 hover:bg-primary-50 transition text-sm"
                                >
                                  <p className="font-medium text-gray-900 truncate">{cg.name}</p>
                                  <p className="text-xs text-gray-500">{cg.location}{cg.state ? `, ${cg.state}` : ''}</p>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 bg-primary-50 border border-primary-200 rounded-lg px-3 py-2">
                          <span className="text-sm font-medium text-gray-900 flex-1 truncate">{pendingStop.name}</span>
                          <button onClick={() => setPendingStop(null)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
                        </div>
                      )}
                      {/* Dates */}
                      {(() => {
                        const insertIdx = addingStopAt !== null ? addingStopAt : multiStops.length;
                        const prevStop = insertIdx > 0 ? multiStops[insertIdx - 1] : null;
                        const nextStop = insertIdx < multiStops.length ? multiStops[insertIdx] : null;
                        const minArrival = prevStop ? (prevStop.departureDate || prevStop.arrivalDate) : undefined;
                        const minDeparture = pendingDates.arrivalDate || minArrival;
                        const maxDeparture = nextStop ? nextStop.arrivalDate : undefined;
                        return (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs text-gray-500 mb-1 block">Arrival *</label>
                              {minArrival && (
                                <p className="text-xs text-amber-600 mb-1">Must be after {new Date(minArrival).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                              )}
                              <input type="date" value={pendingDates.arrivalDate}
                                min={minArrival ? minArrival.slice(0, 10) : undefined}
                                onChange={e => {
                                  const val = e.target.value;
                                  setPendingDates(p => ({
                                    arrivalDate: val,
                                    // Clear departure if it's now before new arrival
                                    departureDate: p.departureDate && p.departureDate < val ? '' : p.departureDate,
                                  }));
                                }}
                                className="input w-full text-sm" />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 mb-1 block">Departure</label>
                              {maxDeparture && (
                                <p className="text-xs text-amber-600 mb-1">Must be before {new Date(maxDeparture).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                              )}
                              <input type="date" value={pendingDates.departureDate}
                                min={minDeparture}
                                max={maxDeparture ? maxDeparture.slice(0, 10) : undefined}
                                onChange={e => setPendingDates(p => ({ ...p, departureDate: e.target.value }))}
                                className="input w-full text-sm" />
                            </div>
                          </div>
                        );
                      })()}
                      <div className="flex gap-2">
                        <button
                          onClick={addMultiStop}
                          disabled={!pendingStop || !pendingDates.arrivalDate}
                          className="btn btn-primary btn-sm flex-1 disabled:opacity-50 text-sm"
                        >
                          Add Stop
                        </button>
                        {addingStopAt !== null && (
                          <button
                            onClick={() => { setAddingStopAt(null); setPendingStop(null); setPendingDates({ arrivalDate: '', departureDate: '' }); }}
                            className="btn btn-secondary btn-sm text-sm"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {multiStops.length >= 2 && (
                    <p className="text-xs text-gray-500 text-center">
                      {multiStops.length} stops · {multiStops[0].arrivalDate && multiStops[multiStops.length-1].departureDate
                        ? `${new Date(multiStops[0].arrivalDate).toLocaleDateString('en-US',{month:'short',day:'numeric'})} → ${new Date(multiStops[multiStops.length-1].departureDate).toLocaleDateString('en-US',{month:'short',day:'numeric'})}`
                        : ''}
                    </p>
                  )}
                </div>
              )}

              {/* Image Upload */}
              <ImageUpload
                onImageUploaded={(url) => setFormData({ ...formData, imageUrl: url })}
                currentImage={formData.imageUrl}
                label="Cover Image"
              />

              {/* Tag Friends */}
              {friends.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Invite Friends (Optional)
                  </label>
                  <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                    {friends.map((friend) => (
                      <label
                        key={friend.id}
                        className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={formData.attendeeIds.includes(friend.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                attendeeIds: [...formData.attendeeIds, friend.id]
                              });
                            } else {
                              setFormData({
                                ...formData,
                                attendeeIds: formData.attendeeIds.filter(id => id !== friend.id)
                              });
                            }
                          }}
                          className="rounded text-primary-600"
                        />
                        <div className="flex items-center gap-2 flex-1">
                          {friend.profilePicture ? (
                            <img
                              src={`${friend.profilePicture}`}
                              alt={friend.firstName}
                              className="w-6 h-6 rounded-full"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                              <Users className="w-3 h-3 text-gray-500" />
                            </div>
                          )}
                          <span className="text-sm">{friend.firstName} {friend.lastName}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Privacy */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Privacy
                </label>
                <select
                  value={formData.privacy}
                  onChange={(e) => setFormData({ ...formData, privacy: e.target.value })}
                  className="input w-full"
                >
                  <option value="PUBLIC">🌍 Public - Anyone can see this event</option>
                  <option value="FRIENDS">👥 Friends - Only friends can see this event</option>
                  <option value="PRIVATE">🔒 Private - Only you and invited attendees</option>
                </select>
              </div>

              {/* Submit */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={handleCreateEvent}
                  className="btn btn-primary flex-1"
                  disabled={!formData.title || !formData.startDate}
                >
                  ✨ Create Event
                </button>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>)}
    </div>
  );
}
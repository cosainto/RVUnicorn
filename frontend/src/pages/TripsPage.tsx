import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Calendar, MapPin, Users, Plus, Search, Edit, Trash2 } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import ImageUpload from '../components/ImageUpload';
import CampgroundSelector from '../components/CampgroundSelector';

interface Event {
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

export default function EventsPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<"upcoming" | "past" | "discover" | "friends">("upcoming");
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
    imageUrl: '',
    attendeeIds: [] as string[],
    privacy: 'PUBLIC',
  });

  // Handle wishlist create params
  useEffect(() => {
    const createFromWishlist = searchParams.get('createFromWishlist');
    const campgroundId = searchParams.get('campgroundId');
    const campgroundName = searchParams.get('campgroundName');
    
    if (createFromWishlist === 'true' && campgroundId) {
      setFormData(prev => ({
        ...prev,
        campgroundId,
        title: `From ${user?.firstName || 'My'}'s Wishlist`
      }));
      setShowCreateModal(true);
      // Clear the params
      setSearchParams({});
    }
  }, [searchParams, user]);

  useEffect(() => {
    loadEvents();
    loadFriends();
  }, []);

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
    } else if (activeTab === "upcoming") {
      filtered = filtered.filter(e => {
        const endDate = e.endDate ? new Date(e.endDate) : new Date(e.startDate);
        return endDate >= today;
      });
    } else {
      filtered = filtered.filter(e => {
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

    try {
      const { data } = await api.post('/trips', {
        title: formData.title,
        description: formData.description,
        startDate: formData.startDate,
        endDate: formData.endDate || formData.startDate,
        location: formData.location,
        campgroundId: formData.campgroundId,
        imageUrl: formData.imageUrl,
      });

      // Invite attendees if any selected
      if (formData.attendeeIds.length > 0) {
        await api.post(`/trips/${data.id}/attendees`, {
          userIds: formData.attendeeIds,
        });
      }

      alert('✅ Event created successfully!');
      setShowCreateModal(false);
      setFormData({
        title: '',
        description: '',
        startDate: getDateString(0),
        endDate: getDateString(7),
        location: '',
        campgroundId: null,
        imageUrl: '',
        attendeeIds: [],
        privacy: 'PUBLIC',
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
      </div>

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
            >
              <Link to={event.isStateVisit ? `/travel-map` : `/trips/${event.id}`}>
                {/* Event Image */}
                <div className="h-48 bg-gradient-to-br from-green-100 to-blue-100 relative overflow-hidden">
                  {event.imageUrl ? (
                    <img
                      src={event.imageUrl}
                      alt={event.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Calendar className="w-16 h-16 text-green-300" />
                    </div>
                  )}
                </div>

                {/* Event Info */}
                <div className="p-4">
                  <h3 className="font-bold text-lg text-gray-900 mb-2 line-clamp-2">
                    {event.title}
                  </h3>
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
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-primary-600" />
                        {event.campground ? (
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

              {/* Campground Selector */}
              <CampgroundSelector
                selectedCampgroundId={formData.campgroundId}
                manualLocation={formData.location}
                onCampgroundSelect={(id, name, location) => {
                  setFormData({
                    ...formData,
                    campgroundId: id,
                    location: location || name,
                  });
                }}
                onManualLocationChange={(location) => {
                  setFormData({
                    ...formData,
                    campgroundId: null,
                    location,
                  });
                }}
              />

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
    </div>
  );
}

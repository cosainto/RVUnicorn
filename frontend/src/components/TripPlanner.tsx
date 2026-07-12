import { useState, useEffect } from 'react';
import { Plus, X, MapPin, Calendar, Edit2, Trash2, Navigation, DollarSign, Star, Users, MessageSquare, CheckCircle, Image as ImageIcon, Send, UserPlus } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { uploadAndGetUrl } from '../utils/uploadMedia';

interface Trip {
  id: string;
  title: string;
  description?: string;
  startLocation: string;
  endLocation: string;
  startDate?: string;
  endDate?: string;
  status: string;
  privacy: string;
  totalDistance?: number;
  stops: TripStop[];
  createdAt: string;
}

interface TripStop {
  id: string;
  stopType: string;
  name: string;
  address: string;
  city?: string;
  state?: string;
  orderIndex: number;
  arrivalDate?: string;
  departureDate?: string;
  notes?: string;
  rating?: number;
  cost?: number;
  photos: StopPhoto[];
  campground?: {
    id: string;
    name: string;
    slug: string;
  };
}

interface StopPhoto {
  id: string;
  imageUrl: string;
  caption?: string;
}

interface Collaborator {
  id: string;
  role: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture?: string;
  };
}

interface TripUpdate {
  id: string;
  type: string;
  content?: string;
  imageUrl?: string;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture?: string;
  };
  stop?: {
    id: string;
    name: string;
    stopType: string;
    city?: string;
    state?: string;
  };
}

const STOP_TYPES = [
  { value: 'CAMPGROUND', label: 'Campground', icon: '🏕️' },
  { value: 'RV_PARK', label: 'RV Park', icon: '🚐' },
  { value: 'HOTEL', label: 'Hotel/Motel', icon: '🏨' },
  { value: 'HARVEST_HOST', label: 'Harvest Host', icon: '🌾' },
  { value: 'BOONDOCKING', label: 'Boondocking', icon: '⛺' },
  { value: 'PARKING_LOT', label: 'Parking Lot', icon: '🅿️' },
  { value: 'REST_AREA', label: 'Rest Area', icon: '🛑' },
  { value: 'OTHER', label: 'Other', icon: '📍' },
];

const TRIP_STATUS = [
  { value: 'PLANNING', label: 'Planning', color: 'bg-blue-100 text-blue-700' },
  { value: 'IN_PROGRESS', label: 'In Progress', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'COMPLETED', label: 'Completed', color: 'bg-green-100 text-green-700' },
];

export default function TripPlanner() {
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddStopModal, setShowAddStopModal] = useState(false);
  const [showCollaboratorsModal, setShowCollaboratorsModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [editingStop, setEditingStop] = useState<TripStop | null>(null);
  const [selectedStopForCheckIn, setSelectedStopForCheckIn] = useState<TripStop | null>(null);
  const [collaborators, setCollaborators] = useState<{ owner: any; collaborators: Collaborator[] } | null>(null);
  const [updates, setUpdates] = useState<TripUpdate[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<{ homeCity?: string; homeState?: string; homeZipCode?: string } | null>(null);

  const [checkInData, setCheckInData] = useState({
    content: '',
    image: null as File | null,
  });

  const [newTrip, setNewTrip] = useState({
    title: '',
    description: '',
    startLocation: '',
    endLocation: '',
    startDate: '',
    endDate: '',
    privacy: 'PUBLIC',
    tripMode: 'ONE_WAY' as 'ONE_WAY' | 'ROUND_TRIP',
    tripType: 'CAMPING',
  });
  const [instantMiles, setInstantMiles] = useState<{ oneWay: number; roundTrip: number } | null>(null);
  const [loadingMiles, setLoadingMiles] = useState(false);

  const [newStop, setNewStop] = useState({
    stopType: 'CAMPGROUND',
    name: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    arrivalDate: '',
    departureDate: '',
    notes: '',
    rating: '',
    cost: '',
  });

  useEffect(() => {
    loadTrips();
    loadFriends();
    loadUserProfile();
  }, []);

  useEffect(() => {
    if (selectedTrip) {
      loadCollaborators(selectedTrip.id);
      loadUpdates(selectedTrip.id);
    }
  }, [selectedTrip]);

  const loadTrips = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/trips');
      setTrips(data);
      if (data.length > 0 && !selectedTrip) {
        loadTripDetails(data[0].id);
      }
    } catch (error) {
      console.error('Load trips error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTripDetails = async (tripId: string) => {
    try {
      const { data } = await api.get(`/trips/${tripId}`);
      setSelectedTrip(data);
    } catch (error) {
      console.error('Load trip details error:', error);
    }
  };

  const loadCollaborators = async (tripId: string) => {
    try {
      const { data } = await api.get(`/trips/${tripId}/collaborators`);
      setCollaborators(data);
    } catch (error) {
      console.error('Load collaborators error:', error);
    }
  };

  const loadUpdates = async (tripId: string) => {
    try {
      const { data } = await api.get(`/trips/${tripId}/updates`);
      setUpdates(data);
    } catch (error) {
      console.error('Load updates error:', error);
    }
  };

  const loadFriends = async () => {
    try {
      const { data } = await api.get('/friends');
      setFriends(data.filter((f: any) => f.status === 'accepted'));
    } catch (error) {
      console.error('Load friends error:', error);
    }
  };

  const loadUserProfile = async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUserProfile(data);
    } catch (error) {
      console.error('Load user profile error:', error);
    }
  };

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newTrip.title.trim() || !newTrip.startLocation.trim() || !newTrip.endLocation.trim()) {
      alert('Please fill in required fields');
      return;
    }

    try {
      const { data } = await api.post('/trips', newTrip);
      await loadTrips();
      setSelectedTrip(data);
      setShowCreateModal(false);
      setNewTrip({
        title: '',
        description: '',
        startLocation: '',
        endLocation: '',
        startDate: '',
        endDate: '',
        privacy: 'PUBLIC',
        tripMode: 'ONE_WAY',
        tripType: 'CAMPING',
      });
      setInstantMiles(null);
      alert('Trip created! 🗺️');
    } catch (error) {
      console.error('Create trip error:', error);
      alert('Failed to create trip');
    }
  };

  const handleAddStop = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedTrip || !newStop.name.trim() || !newStop.address.trim()) {
      alert('Please fill in required fields');
      return;
    }

    try {
      if (editingStop) {
        await api.put(`/trips/stops/${editingStop.id}`, newStop);
        alert('Stop updated! ✅');
      } else {
        await api.post(`/trips/${selectedTrip.id}/stops`, newStop);
        alert('Stop added! 📍');
      }

      await loadTripDetails(selectedTrip.id);
      setShowAddStopModal(false);
      setEditingStop(null);
      setNewStop({
        stopType: 'CAMPGROUND',
        name: '',
        address: '',
        city: '',
        state: '',
        zipCode: '',
        arrivalDate: '',
        departureDate: '',
        notes: '',
        rating: '',
        cost: '',
      });
    } catch (error) {
      console.error('Add stop error:', error);
      alert('Failed to add stop');
    }
  };

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedTrip || !selectedStopForCheckIn) return;

    try {
      let imageUrl: string | undefined;
      if (checkInData.image) {
        imageUrl = await uploadAndGetUrl(checkInData.image, 'rvunicorn/trip-updates');
      }

      await api.post(`/trips/${selectedTrip.id}/updates`, {
        type: 'CHECK_IN',
        content: checkInData.content,
        stopId: selectedStopForCheckIn.id,
        imageUrl,
      });

      setShowCheckInModal(false);
      setSelectedStopForCheckIn(null);
      setCheckInData({ content: '', image: null });
      await loadUpdates(selectedTrip.id);
      alert('Checked in! ✅ Your update has been shared with collaborators and posted to your feed.');
    } catch (error) {
      console.error('Check-in error:', error);
      alert('Failed to check in');
    }
  };

  const handleInviteCollaborator = async (friendId: string, role: string) => {
    if (!selectedTrip) return;

    try {
      await api.post(`/trips/${selectedTrip.id}/collaborators`, {
        userId: friendId,
        role,
      });

      await loadCollaborators(selectedTrip.id);
      alert('Collaborator invited! 🎉');
    } catch (error) {
      console.error('Invite collaborator error:', error);
      alert('Failed to invite collaborator');
    }
  };

  const handleDeleteTrip = async (tripId: string) => {
    if (!confirm('Delete this trip and all its stops?')) return;

    try {
      await api.delete(`/trips/${tripId}`);
      await loadTrips();
      setSelectedTrip(null);
      alert('Trip deleted');
    } catch (error) {
      console.error('Delete trip error:', error);
      alert('Failed to delete trip');
    }
  };

  const handleDeleteStop = async (stopId: string) => {
    if (!confirm('Delete this stop?')) return;

    try {
      await api.delete(`/trips/stops/${stopId}`);
      if (selectedTrip) {
        await loadTripDetails(selectedTrip.id);
      }
      alert('Stop deleted');
    } catch (error) {
      console.error('Delete stop error:', error);
      alert('Failed to delete stop');
    }
  };

  const handleUpdateTripStatus = async (status: string) => {
    if (!selectedTrip) return;

    try {
      await api.put(`/trips/${selectedTrip.id}`, { status });
      await loadTripDetails(selectedTrip.id);
      await loadTrips();
    } catch (error) {
      console.error('Update status error:', error);
      alert('Failed to update status');
    }
  };

  const getStopTypeIcon = (type: string) => {
    const stopType = STOP_TYPES.find(st => st.value === type);
    return stopType ? stopType.icon : '📍';
  };

  const getStopTypeLabel = (type: string) => {
    const stopType = STOP_TYPES.find(st => st.value === type);
    return stopType ? stopType.label : type;
  };

  const getUpdateIcon = (type: string) => {
    switch (type) {
      case 'CHECK_IN': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'COMMENT': return <MessageSquare className="w-5 h-5 text-blue-600" />;
      case 'PHOTO': return <ImageIcon className="w-5 h-5 text-purple-600" />;
      default: return <Navigation className="w-5 h-5 text-gray-600" />;
    }
  };

  const isOwner = selectedTrip?.userId === user?.id;

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading trips...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Trip Planner</h2>
          <p className="text-gray-600">Plan routes, collaborate, and track your journey</p>
        </div>
        <button
          onClick={() => {
          // Pre-fill start location with home base if available
          if (userProfile?.homeCity && userProfile?.homeState) {
            setNewTrip(prev => ({
              ...prev,
              startLocation: `${userProfile.homeCity}, ${userProfile.homeState}`,
            }));
          }
          setShowCreateModal(true);
        }}
          className="btn btn-primary flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Trip
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trips List */}
        <div className="lg:col-span-1 bg-white rounded-lg shadow-md p-4">
          <h3 className="font-bold text-gray-900 mb-4">My Trips</h3>
          
          {trips.length > 0 ? (
            <div className="space-y-2">
              {trips.map((trip) => (
                <button
                  key={trip.id}
                  onClick={() => loadTripDetails(trip.id)}
                  className={`w-full text-left p-3 rounded-lg transition ${
                    selectedTrip?.id === trip.id
                      ? 'bg-primary-50 border-2 border-primary-600'
                      : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                  }`}
                >
                  <p className="font-medium text-gray-900">{trip.title}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    {trip.startLocation} → {trip.endLocation}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      TRIP_STATUS.find(s => s.value === trip.status)?.color
                    }`}>
                      {TRIP_STATUS.find(s => s.value === trip.status)?.label}
                    </span>
                    <span className="text-xs text-gray-600">
                      {trip.stops?.length || 0} stops
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Navigation className="w-12 h-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600">No trips yet</p>
            </div>
          )}
        </div>

        {/* Trip Details */}
        <div className="lg:col-span-2">
          {selectedTrip ? (
            <div className="bg-white rounded-lg shadow-md p-6">
              {/* Trip Header */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{selectedTrip.title}</h3>
                  {selectedTrip.description && (
                    <p className="text-gray-600 mb-4">{selectedTrip.description}</p>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">From:</p>
                      <p className="font-medium text-gray-900">{selectedTrip.startLocation}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">To:</p>
                      <p className="font-medium text-gray-900">{selectedTrip.endLocation}</p>
                    </div>
                    {selectedTrip.startDate && (
                      <div>
                        <p className="text-gray-600">Start:</p>
                        <p className="font-medium text-gray-900">
                          {new Date(selectedTrip.startDate).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                    {selectedTrip.endDate && (
                      <div>
                        <p className="text-gray-600">End:</p>
                        <p className="font-medium text-gray-900">
                          {new Date(selectedTrip.endDate).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  {isOwner && (
                    <>
                      <button
                        onClick={() => setShowCollaboratorsModal(true)}
                        className="btn btn-secondary flex items-center text-sm"
                      >
                        <UserPlus className="w-4 h-4 mr-1" />
                        Invite
                      </button>
                      <button
                        onClick={() => setShowActivityModal(true)}
                        className="btn btn-secondary flex items-center text-sm"
                      >
                        <MessageSquare className="w-4 h-4 mr-1" />
                        Activity
                        {updates.length > 0 && (
                          <span className="ml-1 bg-primary-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                            {updates.length}
                          </span>
                        )}
                      </button>
                    </>
                  )}
                  <select
                    value={selectedTrip.status}
                    onChange={(e) => handleUpdateTripStatus(e.target.value)}
                    className="input text-sm"
                    disabled={!isOwner}
                  >
                    {TRIP_STATUS.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                  {isOwner && (
                    <button
                      onClick={() => handleDeleteTrip(selectedTrip.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded transition"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Collaborators Badge */}
              {collaborators && collaborators.collaborators.length > 0 && (
                <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
                  <Users className="w-4 h-4" />
                  <span>{collaborators.collaborators.length} collaborator(s)</span>
                </div>
              )}

              {/* Add Stop Button */}
              <button
                onClick={() => {
                  setEditingStop(null);
                  setNewStop({
                    stopType: 'CAMPGROUND',
                    name: '',
                    address: '',
                    city: '',
                    state: '',
                    zipCode: '',
                    arrivalDate: '',
                    departureDate: '',
                    notes: '',
                    rating: '',
                    cost: '',
                  });
                  setShowAddStopModal(true);
                }}
                className="btn btn-primary mb-4 w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Stop
              </button>

              {/* Stops List */}
              <div className="space-y-4">
                {selectedTrip.stops && selectedTrip.stops.length > 0 ? (
                  selectedTrip.stops.map((stop, index) => (
                    <div key={stop.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="text-2xl">{getStopTypeIcon(stop.stopType)}</div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-gray-900">Stop {index + 1}:</span>
                              <span className="font-medium text-gray-900">{stop.name}</span>
                            </div>
                            <p className="text-sm text-gray-600">{getStopTypeLabel(stop.stopType)}</p>
                            <p className="text-sm text-gray-600 mt-1">{stop.address}</p>
                            {stop.city && stop.state && (
                              <p className="text-sm text-gray-600">{stop.city}, {stop.state}</p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              setSelectedStopForCheckIn(stop);
                              setShowCheckInModal(true);
                            }}
                            className="btn btn-primary btn-sm"
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Check In
                          </button>
                          {isOwner && (
                            <>
                              <button
                                onClick={() => {
                                  setEditingStop(stop);
                                  setNewStop({
                                    stopType: stop.stopType,
                                    name: stop.name,
                                    address: stop.address,
                                    city: stop.city || '',
                                    state: stop.state || '',
                                    zipCode: '',
                                    arrivalDate: stop.arrivalDate?.split('T')[0] || '',
                                    departureDate: stop.departureDate?.split('T')[0] || '',
                                    notes: stop.notes || '',
                                    rating: stop.rating?.toString() || '',
                                    cost: stop.cost?.toString() || '',
                                  });
                                  setShowAddStopModal(true);
                                }}
                                className="p-1 text-gray-600 hover:text-primary-600 transition"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteStop(stop.id)}
                                className="p-1 text-gray-600 hover:text-red-600 transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Stop Details */}
                      <div className="grid grid-cols-2 gap-4 text-sm mt-3 pt-3 border-t border-gray-200">
                        {stop.arrivalDate && (
                          <div>
                            <p className="text-gray-600">Arrival:</p>
                            <p className="font-medium text-gray-900">
                              {new Date(stop.arrivalDate).toLocaleDateString()}
                            </p>
                          </div>
                        )}
                        {stop.departureDate && (
                          <div>
                            <p className="text-gray-600">Departure:</p>
                            <p className="font-medium text-gray-900">
                              {new Date(stop.departureDate).toLocaleDateString()}
                            </p>
                          </div>
                        )}
                        {stop.rating && (
                          <div>
                            <p className="text-gray-600">Rating:</p>
                            <div className="flex items-center gap-1">
                              {Array.from({ length: stop.rating }).map((_, i) => (
                                <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                              ))}
                            </div>
                          </div>
                        )}
                        {stop.cost && (
                          <div>
                            <p className="text-gray-600">Cost:</p>
                            <p className="font-medium text-gray-900 flex items-center gap-1">
                              <DollarSign className="w-4 h-4" />
                              {stop.cost.toFixed(2)}
                            </p>
                          </div>
                        )}
                      </div>

                      {stop.notes && (
                        <div className="mt-3 p-3 bg-gray-50 rounded">
                          <p className="text-sm text-gray-700">{stop.notes}</p>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-600">
                    <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p>No stops added yet</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <Navigation className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Select a trip to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Trip Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white p-6 rounded-t-lg">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Create New Trip</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-white hover:text-gray-200"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateTrip} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Trip Title *
                </label>
                <input
                  type="text"
                  value={newTrip.title}
                  onChange={(e) => setNewTrip({ ...newTrip, title: e.target.value })}
                  className="input"
                  required
                  placeholder="Summer Road Trip 2024"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={newTrip.description}
                  onChange={(e) => setNewTrip({ ...newTrip, description: e.target.value })}
                  rows={3}
                  className="input"
                  placeholder="Tell us about your trip..."
                />
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Location *
                    </label>
                    <input
                      type="text"
                      value={newTrip.startLocation}
                      onChange={(e) => setNewTrip({ ...newTrip, startLocation: e.target.value })}
                      className="input"
                      required
                      placeholder="Chicago, IL"
                    />
                    {userProfile?.homeCity && userProfile?.homeState && newTrip.startLocation !== `${userProfile.homeCity}, ${userProfile.homeState}` && (
                      <button
                        type="button"
                        onClick={() => setNewTrip({ ...newTrip, startLocation: `${userProfile.homeCity}, ${userProfile.homeState}` })}
                        className="text-xs text-primary-600 hover:text-primary-700 mt-1"
                      >
                        📍 Use home: {userProfile.homeCity}, {userProfile.homeState}
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Destination *
                    </label>
                    <input
                      type="text"
                      value={newTrip.endLocation}
                      onChange={(e) => {
                        setNewTrip({ ...newTrip, endLocation: e.target.value });
                        setInstantMiles(null);
                      }}
                      onBlur={async () => {
                        if (newTrip.startLocation && newTrip.endLocation && newTrip.startLocation !== newTrip.endLocation) {
                          setLoadingMiles(true);
                          try {
                            const { data } = await api.post('/road-trips/drive-time', { origin: newTrip.startLocation, destination: newTrip.endLocation });
                            setInstantMiles({ oneWay: data.distanceMiles || 0, roundTrip: (data.distanceMiles || 0) * 2 });
                          } catch { setInstantMiles(null); }
                          setLoadingMiles(false);
                        }
                      }}
                      className="input"
                      required
                      placeholder="47 Racquet Club Dr, Pawleys Island, SC"
                    />
                    {userProfile?.homeCity && userProfile?.homeState && newTrip.endLocation !== `${userProfile.homeCity}, ${userProfile.homeState}` && (
                      <button
                        type="button"
                        onClick={() => setNewTrip({ ...newTrip, endLocation: `${userProfile.homeCity}, ${userProfile.homeState}` })}
                        className="text-xs text-primary-600 hover:text-primary-700 mt-1"
                      >
                        🏠 Use home: {userProfile.homeCity}, {userProfile.homeState}
                      </button>
                    )}
                  </div>
                </div>

                {/* Instant mileage */}
                {(instantMiles || loadingMiles) && (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary-50 border border-primary-200">
                    <Navigation className="w-5 h-5 text-primary-600" />
                    {loadingMiles ? (
                      <span className="text-sm text-gray-500">Calculating distance...</span>
                    ) : instantMiles && (
                      <div className="text-sm">
                        <span className="font-bold text-primary-700">{instantMiles.oneWay.toLocaleString()} miles</span>
                        <span className="text-gray-500"> one way</span>
                        {newTrip.tripMode === 'ROUND_TRIP' && (
                          <span className="text-gray-500"> · <span className="font-bold text-primary-700">{instantMiles.roundTrip.toLocaleString()} miles</span> round trip</span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* One-way / Round-trip toggle + Trip type */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Trip Direction</label>
                    <div className="flex rounded-lg border border-gray-300 overflow-hidden">
                      <button type="button" onClick={() => setNewTrip({ ...newTrip, tripMode: 'ONE_WAY' })}
                        className={`flex-1 py-2 text-sm font-semibold transition ${newTrip.tripMode === 'ONE_WAY' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                        One Way →
                      </button>
                      <button type="button" onClick={() => setNewTrip({ ...newTrip, tripMode: 'ROUND_TRIP' })}
                        className={`flex-1 py-2 text-sm font-semibold transition ${newTrip.tripMode === 'ROUND_TRIP' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                        Round Trip ↔
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Trip Type</label>
                    <select value={newTrip.tripType} onChange={e => setNewTrip({ ...newTrip, tripType: e.target.value })} className="input">
                      <option value="CAMPING">🏕️ Camping Trip</option>
                      <option value="BOONDOCKING">⛺ Boondocking</option>
                      <option value="TRANSIT">🚐 Travel Day</option>
                      <option value="FAMILY_PERSONAL">🏠 Family / Personal</option>
                      <option value="STORAGE_SERVICE">🔒 Storage / Service</option>
                      <option value="OTHER">📍 Other</option>
                    </select>
                  </div>
                </div>
                
                {/* Reverse Trip Button */}
                {(newTrip.startLocation || newTrip.endLocation) && (
                  <button
                    type="button"
                    onClick={() => setNewTrip({ 
                      ...newTrip, 
                      startLocation: newTrip.endLocation,
                      endLocation: newTrip.startLocation 
                    })}
                    className="flex items-center gap-2 text-sm text-gray-600 hover:text-primary-600 transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                    Reverse trip (swap start ↔ end)
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={newTrip.startDate}
                    onChange={(e) => setNewTrip({ ...newTrip, startDate: e.target.value })}
                    className="input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={newTrip.endDate}
                    onChange={(e) => setNewTrip({ ...newTrip, endDate: e.target.value })}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Privacy
                </label>
                <select
                  value={newTrip.privacy}
                  onChange={(e) => setNewTrip({ ...newTrip, privacy: e.target.value })}
                  className="input"
                >
                  <option value="PUBLIC">Public - Anyone can see</option>
                  <option value="FRIENDS">Friends Only</option>
                  <option value="PRIVATE">Private - Only me & collaborators</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button type="submit" className="btn btn-primary flex-1">
                  Create Trip
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Stop Modal */}
      {showAddStopModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white p-6 rounded-t-lg">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">
                  {editingStop ? 'Edit Stop' : 'Add Stop'}
                </h2>
                <button
                  onClick={() => {
                    setShowAddStopModal(false);
                    setEditingStop(null);
                  }}
                  className="text-white hover:text-gray-200"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <form onSubmit={handleAddStop} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Stop Type *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {STOP_TYPES.map((type) => (
                    <label
                      key={type.value}
                      className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition ${
                        newStop.stopType === type.value
                          ? 'border-primary-600 bg-primary-50'
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        value={type.value}
                        checked={newStop.stopType === type.value}
                        onChange={(e) => setNewStop({ ...newStop, stopType: e.target.value })}
                        className="sr-only"
                      />
                      <span className="text-xl">{type.icon}</span>
                      <span className="text-sm font-medium">{type.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={newStop.name}
                  onChange={(e) => setNewStop({ ...newStop, name: e.target.value })}
                  className="input"
                  required
                  placeholder="Grand Canyon KOA"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address *
                </label>
                <input
                  type="text"
                  value={newStop.address}
                  onChange={(e) => setNewStop({ ...newStop, address: e.target.value })}
                  className="input"
                  required
                  placeholder="123 Main Street"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={newStop.city}
                    onChange={(e) => setNewStop({ ...newStop, city: e.target.value })}
                    className="input"
                    placeholder="Williams"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    value={newStop.state}
                    onChange={(e) => setNewStop({ ...newStop, state: e.target.value })}
                    className="input"
                    placeholder="AZ"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ZIP Code
                  </label>
                  <input
                    type="text"
                    value={newStop.zipCode}
                    onChange={(e) => setNewStop({ ...newStop, zipCode: e.target.value })}
                    className="input"
                    placeholder="86046"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Arrival Date
                  </label>
                  <input
                    type="date"
                    value={newStop.arrivalDate}
                    onChange={(e) => setNewStop({ ...newStop, arrivalDate: e.target.value })}
                    className="input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Departure Date
                  </label>
                  <input
                    type="date"
                    value={newStop.departureDate}
                    onChange={(e) => setNewStop({ ...newStop, departureDate: e.target.value })}
                    className="input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rating (1-5)
                  </label>
                  <select
                    value={newStop.rating}
                    onChange={(e) => setNewStop({ ...newStop, rating: e.target.value })}
                    className="input"
                  >
                    <option value="">Not rated</option>
                    <option value="1">⭐ 1 Star</option>
                    <option value="2">⭐⭐ 2 Stars</option>
                    <option value="3">⭐⭐⭐ 3 Stars</option>
                    <option value="4">⭐⭐⭐⭐ 4 Stars</option>
                    <option value="5">⭐⭐⭐⭐⭐ 5 Stars</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cost ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newStop.cost}
                    onChange={(e) => setNewStop({ ...newStop, cost: e.target.value })}
                    className="input"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={newStop.notes}
                  onChange={(e) => setNewStop({ ...newStop, notes: e.target.value })}
                  rows={3}
                  className="input"
                  placeholder="Any notes about this stop..."
                />
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button type="submit" className="btn btn-primary flex-1">
                  {editingStop ? 'Save Changes' : 'Add Stop'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddStopModal(false);
                    setEditingStop(null);
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

      {/* Check-In Modal */}
      {showCheckInModal && selectedStopForCheckIn && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full">
            <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-6 rounded-t-lg">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <CheckCircle className="w-6 h-6" />
                  Check In
                </h2>
                <button
                  onClick={() => {
                    setShowCheckInModal(false);
                    setSelectedStopForCheckIn(null);
                  }}
                  className="text-white hover:text-gray-200"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <form onSubmit={handleCheckIn} className="p-6 space-y-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="font-medium text-gray-900">{selectedStopForCheckIn.name}</p>
                <p className="text-sm text-gray-600">{selectedStopForCheckIn.address}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Share your experience
                </label>
                <textarea
                  value={checkInData.content}
                  onChange={(e) => setCheckInData({ ...checkInData, content: e.target.value })}
                  rows={3}
                  className="input"
                  placeholder="How's this stop? What are you up to?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Add a photo (optional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setCheckInData({ ...checkInData, image: e.target.files?.[0] || null })}
                  className="input"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-700">
                <p>✨ Your check-in will be shared with trip collaborators and posted to your feed!</p>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button type="submit" className="btn btn-primary flex-1">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Check In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCheckInModal(false);
                    setSelectedStopForCheckIn(null);
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

      {/* Collaborators Modal */}
      {showCollaboratorsModal && selectedTrip && collaborators && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white p-6 rounded-t-lg">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Trip Collaborators</h2>
                <button
                  onClick={() => setShowCollaboratorsModal(false)}
                  className="text-white hover:text-gray-200"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Owner */}
              <div>
                <h3 className="font-bold text-gray-900 mb-3">Owner</h3>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  {collaborators.owner.profilePicture ? (
                    <img
                      src={`${collaborators.owner.profilePicture}`}
                      alt={collaborators.owner.firstName}
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary-200 flex items-center justify-center">
                      <Users className="w-5 h-5 text-primary-600" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-gray-900">
                      {collaborators.owner.firstName} {collaborators.owner.lastName}
                    </p>
                    <p className="text-sm text-gray-600">@{collaborators.owner.username}</p>
                  </div>
                </div>
              </div>

              {/* Current Collaborators */}
              {collaborators.collaborators.length > 0 && (
                <div>
                  <h3 className="font-bold text-gray-900 mb-3">Collaborators</h3>
                  <div className="space-y-2">
                    {collaborators.collaborators.map((collab) => (
                      <div key={collab.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          {collab.user.profilePicture ? (
                            <img
                              src={`${collab.user.profilePicture}`}
                              alt={collab.user.firstName}
                              className="w-10 h-10 rounded-full"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                              <Users className="w-5 h-5 text-gray-500" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-gray-900">
                              {collab.user.firstName} {collab.user.lastName}
                            </p>
                            <p className="text-sm text-gray-600">@{collab.user.username}</p>
                          </div>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          collab.role === 'PLANNER'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {collab.role}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Invite Friends */}
              {isOwner && friends.length > 0 && (
                <div>
                  <h3 className="font-bold text-gray-900 mb-3">Invite Friends</h3>
                  <div className="space-y-2">
                    {friends
                      .filter(f => 
                        f.friend.id !== user?.id &&
                        !collaborators.collaborators.some(c => c.user.id === f.friend.id)
                      )
                      .map((friend) => (
                        <div key={friend.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            {friend.friend.profilePicture ? (
                              <img
                                src={`${friend.friend.profilePicture}`}
                                alt={friend.friend.firstName}
                                className="w-10 h-10 rounded-full"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                                <Users className="w-5 h-5 text-gray-500" />
                              </div>
                            )}
                            <div>
                              <p className="font-medium text-gray-900">
                                {friend.friend.firstName} {friend.friend.lastName}
                              </p>
                              <p className="text-sm text-gray-600">@{friend.friend.username}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleInviteCollaborator(friend.friend.id, 'PLANNER')}
                              className="btn btn-primary btn-sm"
                            >
                              Invite as Planner
                            </button>
                            <button
                              onClick={() => handleInviteCollaborator(friend.friend.id, 'VIEWER')}
                              className="btn btn-secondary btn-sm"
                            >
                              Viewer
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Activity Modal */}
      {showActivityModal && selectedTrip && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white p-6 rounded-t-lg">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Trip Activity</h2>
                <button
                  onClick={() => setShowActivityModal(false)}
                  className="text-white hover:text-gray-200"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {updates.length > 0 ? (
                <div className="space-y-4">
                  {updates.map((update) => (
                    <div key={update.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        {update.user.profilePicture ? (
                          <img
                            src={`${update.user.profilePicture}`}
                            alt={update.user.firstName}
                            className="w-10 h-10 rounded-full"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                            <Users className="w-5 h-5 text-gray-500" />
                          </div>
                        )}
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-gray-900">
                              {update.user.firstName} {update.user.lastName}
                            </p>
                            {getUpdateIcon(update.type)}
                            <span className="text-xs text-gray-500">
                              {new Date(update.createdAt).toLocaleDateString()}
                            </span>
                          </div>

                          {update.stop && (
                            <p className="text-sm text-gray-600 mb-2">
                              at {update.stop.name}, {update.stop.city} {update.stop.state}
                            </p>
                          )}

                          {update.content && (
                            <p className="text-gray-700">{update.content}</p>
                          )}

                          {update.imageUrl && (
                            <img
                              src={`${update.imageUrl}`}
                              alt="Update"
                              className="mt-2 rounded-lg max-h-64 w-auto"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-600">
                  <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p>No activity yet</p>
                  <p className="text-sm mt-1">Check in at stops to share updates!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

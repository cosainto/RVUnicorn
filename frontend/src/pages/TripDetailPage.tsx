import ShareButton from '../components/ShareButton';
import NavigationButtons from '../components/NavigationButtons';
import OdometerProjection from '../components/OdometerProjection';
import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import { Calendar, MapPin, Users, Edit, ArrowLeft, UserPlus, X, Car, Check, XCircle, Image, Clock, Navigation, ExternalLink, ChefHat, Package, Map, Copy, Star, Plus, Trash2, Coffee, Fuel, Wrench, Moon, Utensils, Dog, Play, Footprints, Camera, Upload, DollarSign} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
// @ts-ignore
import TripCopilot from '../components/TripCopilot'; // eslint-disable-line
// @ts-ignore
import AITripRecap from '../components/AITripRecap'; // eslint-disable-line
import MealPlanner from '../components/MealPlanner';
import TripItineraryTab from '../components/TripItineraryTab';
import TripTabEmptyState from '../components/TripTabEmptyState';
import DraggableBanner from '../components/DraggableBanner';
import HitchPackingSuggestions from '../components/HitchPackingSuggestions';
import HitchMealSuggestions from '../components/HitchMealSuggestions';
import HitchTripSummary from '../components/HitchTripSummary';
import HitchTripCostEstimator from '../components/HitchTripCostEstimator';
import TripPlannerTab from '../components/TripPlannerTab';
import EventPackList from '../components/EventPackList';
import PackUp from "../components/PackUp";
import InventoryPackingModal from '../components/InventoryPackingModal';
import EventSchedule from '../components/EventSchedule';
import EventAlbum from '../components/EventAlbum';
import SmartStops from '../components/SmartStops';
import EventCommentWall from '../components/EventCommentWall';
import EventActivities from '../components/EventActivities';
import ThingsToDoSection from '../components/ThingsToDoSection';
import EventSettingsPanel from '../components/EventSettingsPanel';

interface Event {
  id: string;
  organizerId: string;
  title: string;
  description?: string;
  startDate: string;
  endDate?: string;
  location?: string;
  imageUrl?: string;
  bannerImage?: string;
  isWishlist?: boolean;
  organizer?: { id: string; firstName: string; lastName: string; username: string; profilePicture?: string };
  campground?: { id: string; name: string; location?: string; state?: string; latitude?: number; longitude?: number };
  attendees?: Attendee[];
  _count?: { attendees: number; meals: number };
}

interface Attendee {
  id: string;
  userId: string;
  status: string;
  user: { id: string; firstName: string; lastName: string; username: string; profilePicture?: string };
}

interface Friend {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  profilePicture?: string;
}

interface PitStop {
  id: string;
  name: string;
  location?: string;
  stopType: string;
  notes?: string;
  estimatedDuration?: number;
  orderIndex: number;
}

const STOP_TYPES = [
  { id: 'OVERNIGHT', label: 'Overnight', emoji: '🌙', icon: Moon },
  { id: 'NAP', label: 'Nap', emoji: '😴', icon: Moon },
  { id: 'SNACK', label: 'Snack', emoji: '🍿', icon: Coffee },
  { id: 'LUNCH', label: 'Lunch', emoji: '🥪', icon: Utensils },
  { id: 'FOOD', label: 'Food', emoji: '🍔', icon: Utensils },
  { id: 'GAS', label: 'Gas', emoji: '⛽', icon: Fuel },
  { id: 'REPAIR', label: 'Repair', emoji: '🔧', icon: Wrench },
  { id: 'WALK', label: 'Walk', emoji: '🚶', icon: Footprints },
  { id: 'PLAY', label: 'Play', emoji: '🎮', icon: Play },
  { id: 'DOG', label: 'Dog Break', emoji: '🐕', icon: Dog },
  { id: 'OTHER', label: 'Other', emoji: '📍', icon: MapPin },
];

export default function EventDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [checkInLoading, setCheckInLoading] = useState(false);

  const handleCheckIn = async () => {
    if (!event?.campground?.id || !user) return;
    setCheckInLoading(true);
    try {
      if (isCheckedIn) {
        await api.delete('/checkins/active');
        setIsCheckedIn(false);
      } else {
        await api.post('/checkins', { campgroundId: event.campground.id });
        setIsCheckedIn(true);
      }
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Failed');
    } finally {
      setCheckInLoading(false);
    }
  };

  // Check active check-in on load

  const [userRvMpg, setUserRvMpg] = useState<number>(10);
  const [userRvTankGallons, setUserRvTankGallons] = useState<number>(50);
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(() => window.location.hash.replace('#', '') || 'details');
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('scrollTo') === 'meals') {
      setTimeout(() => {
        const el = document.getElementById('meal-calendar');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 500);
    }
  }, [location.search]);
  const [showPackingModal, setShowPackingModal] = useState(false);
  const [userAttendee, setUserAttendee] = useState<Attendee | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [tripAlbums, setTripAlbums] = useState<any[]>([]);
  const [myAlbums, setMyAlbums] = useState<any[]>([]);
  const [showAlbumModal, setShowAlbumModal] = useState(false);
  const [albumModalTab, setAlbumModalTab] = useState<'create' | 'link'>('create');
  const [newAlbumTitle, setNewAlbumTitle] = useState('');
  const [newAlbumDesc, setNewAlbumDesc] = useState('');
  const [albumPrivacy, setAlbumPrivacy] = useState('PUBLIC');
  const [selectedAlbumId, setSelectedAlbumId] = useState('');
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [showPackUpReminder, setShowPackUpReminder] = useState(false);
  const [bannerPosition, setBannerPosition] = useState('50% 50%');
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [copying, setCopying] = useState(false);
  const [tripPlan, setTripPlan] = useState<any>(null);
  const [tripLoading, setTripLoading] = useState(false);
  const [showTripModal, setShowTripModal] = useState(false);
  const [showPitStopModal, setShowPitStopModal] = useState(false);
  const [editingFrom, setEditingFrom] = useState(false);
  const [editFromValue, setEditFromValue] = useState('');
  const [tripForm, setTripForm] = useState({
    startLocation: '',
    useHometown: true,
    isDriving: true,
    ridingWithId: '',
    routePreference: 'FASTEST',
    avoidTolls: false,
    avoidHighways: false,
    arrivalDate: '',
  });
  const [pitStopForm, setPitStopForm] = useState({
    name: '',
    location: '',
    stopType: 'GAS',
    notes: '',
    estimatedDuration: 15,
  });

  const [showDiscoverStopsModal, setShowDiscoverStopsModal] = useState(false);
  const [scheduleRefreshKey, setScheduleRefreshKey] = useState(0);
  const [discoveredStops, setDiscoveredStops] = useState<any>({ attractions: [], restaurants: [], gasStations: [] });
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [copyForm, setCopyForm] = useState({
    startDate: '',
    endDate: '',
    isWishlist: false,
    copyMealPlan: true,
  });

  const [userHomeLocation, setUserHomeLocation] = useState<string | null>(null);
  const [showAIPlanner, setShowAIPlanner] = useState(false);

  // Helper to build default arrival datetime string (event start date at 2pm)
  const getDefaultArrivalDate = () => {
    if (!event?.startDate) return '';
    const d = new Date(event.startDate);
    // Format as YYYY-MM-DDT14:00 for datetime-local input
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}T14:00`;
  };

  // Check if user is currently checked in at this campground
  useEffect(() => {
    if (!event?.campground?.id || !user) return;
    api.get('/checkins/active')
      .then(r => {
        const active = r.data?.checkIn;
        setIsCheckedIn(active?.campgroundId === event.campground?.id);
      })
      .catch(() => {});
  }, [event?.campground?.id, user]);

  useEffect(() => {
    // Fetch user RV specs for gas calculations
    api.get('/auth/me').then(({ data }) => {
      if (data.rvMpg) setUserRvMpg(data.rvMpg);
      const tankByType: Record<string, number> = {
        CLASS_A: 100, CLASS_B: 25, CLASS_C: 55, FIFTH_WHEEL: 50,
        TRAVEL_TRAILER: 0, TRUCK_CAMPER: 35, VAN_CONVERSION: 25,
      };
      if (data.rvType && tankByType[data.rvType]) setUserRvTankGallons(tankByType[data.rvType]);
    }).catch(() => {});
    // Auto-process mileage logs for trips whose dates have passed
    api.post('/trip-planner/process-auto-mileage', {}).catch(() => {});
  }, []);

  useEffect(() => {
    loadEvent();
    loadFriends();
    loadTripAlbums();
    if (user) {
      loadTripPlan();
      loadHomeLocation();
    }
  }, [id, user]);

  const loadHomeLocation = async () => {
    try {
      const { data } = await api.get('/onboarding/home-location');
      if (data.formattedAddress) {
        setUserHomeLocation(data.formattedAddress);
      }
    } catch (error) {
      console.error('Load home location error:', error);
    }
  };

  const loadTripPlan = async () => {
    if (!id || !user) return;
    try {
      setTripLoading(true);
      const { data } = await api.get(`/trip-planner/event/${id}/my-trip`);
      setTripPlan(data);
    } catch (error) {
      console.error('Load trip plan error:', error);
    } finally {
      setTripLoading(false);
    }
  };

  const handleCreateTripPlan = async () => {
    if (!id) return;
    try {
      setTripLoading(true);
      const payload = {
        ...tripForm,
        arrivalDate: tripForm.arrivalDate || getDefaultArrivalDate(),
      };
      const { data } = await api.post(`/trip-planner/event/${id}/plan`, payload);
      setTripPlan(data);
      setShowTripModal(false);
      alert('✅ Trip plan saved!');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create trip plan');
    } finally {
      setTripLoading(false);
    }
  };

  // Open trip modal with current values pre-filled
  const openTripModal = () => {
    if (tripPlan) {
      // Pre-fill form with existing trip plan values
      const arrivalStr = tripPlan.arrivalDate
        ? new Date(tripPlan.arrivalDate).toISOString().slice(0, 16)
        : getDefaultArrivalDate();
      setTripForm({
        startLocation: tripPlan.startLocation || '',
        useHometown: tripPlan.useHometown ?? true,
        isDriving: tripPlan.isDriving ?? true,
        ridingWithId: tripPlan.ridingWithId || '',
        routePreference: tripPlan.routePreference || 'FASTEST',
        avoidTolls: tripPlan.avoidTolls ?? false,
        avoidHighways: tripPlan.avoidHighways ?? false,
        arrivalDate: arrivalStr,
      });
    } else {
      // Default for new trip
      setTripForm({
        startLocation: '',
        useHometown: true,
        isDriving: true,
        ridingWithId: '',
        routePreference: 'FASTEST',
        avoidTolls: false,
        avoidHighways: false,
        arrivalDate: getDefaultArrivalDate(),
      });
    }
    setShowTripModal(true);
  };

  // Inline edit "From" — save immediately
  const handleSaveFrom = async () => {
    if (!id || !editFromValue.trim()) {
      setEditingFrom(false);
      return;
    }
    try {
      setTripLoading(true);
      const { data } = await api.post(`/trip-planner/event/${id}/plan`, {
        startLocation: editFromValue.trim(),
        useHometown: false,
        isDriving: tripPlan?.isDriving ?? true,
        ridingWithId: tripPlan?.ridingWithId || '',
        routePreference: tripPlan?.routePreference || 'FASTEST',
        avoidTolls: tripPlan?.avoidTolls ?? false,
        avoidHighways: tripPlan?.avoidHighways ?? false,
        arrivalDate: tripPlan?.arrivalDate || getDefaultArrivalDate(),
      });
      setTripPlan(data);
      setEditingFrom(false);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update start location');
    } finally {
      setTripLoading(false);
    }
  };

  const handleDiscoverStops = async () => {
    if (!tripPlan?.startLatitude || !tripPlan?.endLatitude) {
      alert('Trip must have start and end locations with coordinates');
      return;
    }
    setDiscoverLoading(true);
    setShowDiscoverStopsModal(true);
    try {
      const { data: routeData } = await api.post('/drive-planner/google-route', {
        origin: { lat: tripPlan.startLatitude, lng: tripPlan.startLongitude },
        destination: { lat: tripPlan.endLatitude, lng: tripPlan.endLongitude },
      });
      const { data: attractions } = await api.post('/drive-planner/attractions-along-route', {
        routePoints: routeData.routePoints,
        maxDistanceMiles: 10,
      });
      setDiscoveredStops(attractions);
    } catch (err) {
      console.error('Discover stops error:', err);
    } finally {
      setDiscoverLoading(false);
    }
  };

  const handleAddDiscoveredStop = async (place: any, stopType: string) => {
    if (!tripPlan) return;
    try {
      await api.post(`/trip-planner/trip/${tripPlan.id}/pit-stop`, {
        name: place.name,
        location: place.address,
        stopType,
        notes: place.rating ? `Rating: ${place.rating}` : '',
        estimatedDuration: stopType === 'FOOD' ? 45 : 15,
      });
      loadTripPlan();
    } catch (err) {
      console.error('Add discovered stop error:', err);
    }
  };

  const handleAddPitStop = async () => {
    if (!tripPlan) return;
    try {
      await api.post(`/trip-planner/trip/${tripPlan.id}/pit-stop`, pitStopForm);
      setShowPitStopModal(false);
      setPitStopForm({ name: '', location: '', stopType: 'GAS', notes: '', estimatedDuration: 15 });
      loadTripPlan();
      alert('✅ Pit stop added!');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to add pit stop');
    }
  };

  const handleDeletePitStop = async (pitStopId: string) => {
    if (!confirm('Delete this pit stop?')) return;
    try {
      await api.delete(`/trip-planner/pit-stop/${pitStopId}`);
      loadTripPlan();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete pit stop');
    }
  };

  const handleDeleteEvent = async () => {
    if (!confirm('Are you sure you want to delete this event? This action cannot be undone.')) return;
    try {
      await api.delete(`/events/${id}`);
      alert('Event deleted successfully');
      navigate('/trips');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete event');
    }
  };

  const handleCompleteTrip = async () => {
    if (!tripPlan) return;
    const actualMiles = prompt('Enter actual miles driven (or leave blank to use estimated):', tripPlan.distanceMiles?.toString() || '');
    if (actualMiles === null) return;
    
    try {
      await api.post(`/trip-planner/trip/${tripPlan.id}/complete`, {
        actualMiles: actualMiles ? parseFloat(actualMiles) : null
      });
      loadTripPlan();
      alert('✅ Trip completed! Miles have been logged.');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to complete trip');
    }
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} min`;
    if (mins === 0) return `${hours} hr`;
    return `${hours} hr ${mins} min`;
  };

  const getStopTypeInfo = (type: string) => {
    return STOP_TYPES.find(s => s.id === type) || STOP_TYPES[STOP_TYPES.length - 1];
  };

  const getEventDestination = () => {
    if (event?.campground) {
      const parts = [event.campground.name];
      if (event.campground.location) parts.push(event.campground.location);
      if (event.campground.state) parts.push(event.campground.state);
      return parts.join(', ');
    }
    return event?.location || 'Not set';
  };

  const formatArrivalDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
      ' at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const loadEvent = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/events/${id}`);
      setEvent(data);
      if (data.attendees && user) {
        const attendee = data.attendees.find((a: Attendee) => a.userId === user.id);
        setUserAttendee(attendee || null);
      }
    } catch (error) {
      console.error('Load event error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFriends = async () => {
    try {
      const { data } = await api.get('/friends');
      setFriends(data);
    } catch (error) {
      console.error('Load friends error:', error);
    }
  };

  const loadTripAlbums = async () => {
    if (!event?.id) return;
    try {
      const [albumsRes, myRes] = await Promise.all([
        api.get(`/events/${event.id}/albums`),
        api.get('/albums?limit=50'),
      ]);
      setTripAlbums(albumsRes.data);
      setMyAlbums(myRes.data?.albums || myRes.data || []);
    } catch {}
  };

  const handleCreateTripAlbum = async () => {
    if (!newAlbumTitle.trim()) return;
    try {
      const { data } = await api.post(`/events/${event.id}/albums`, {
        title: newAlbumTitle,
        description: newAlbumDesc,
        privacy: albumPrivacy,
      });
      setTripAlbums(prev => [data, ...prev]);
      setShowAlbumModal(false);
      setNewAlbumTitle('');
      setNewAlbumDesc('');
    } catch { alert('Failed to create album'); }
  };

  const handleLinkAlbum = async () => {
    if (!selectedAlbumId) return;
    try {
      const { data } = await api.post(`/events/${event.id}/albums/link`, { albumId: selectedAlbumId });
      setTripAlbums(prev => [data, ...prev]);
      setShowAlbumModal(false);
      setSelectedAlbumId('');
    } catch { alert('Failed to link album'); }
  };

  const handleUnlinkAlbum = async (albumId: string) => {
    if (!confirm('Remove this album from the trip?')) return;
    try {
      await api.delete(`/events/${event.id}/albums/${albumId}/unlink`);
      setTripAlbums(prev => prev.filter(a => a.id !== albumId));
    } catch { alert('Failed to unlink album'); }
  };

  const handleInvite = async () => {
    try {
      await api.post(`/events/${id}/attendees`, { userIds: selectedFriends });
      setShowInviteModal(false);
      setSelectedFriends([]);
      await loadEvent();
      alert('Invitations sent! 🎉');
    } catch (error) {
      console.error('Invite error:', error);
      alert('Failed to send invitations');
    }
  };

  const handleRSVP = async (status: string) => {
    try {
      if (userAttendee) {
        await api.put(`/events/${id}/attendees/${userAttendee.id}`, { status });
      }
      await loadEvent();
    } catch (error) {
      console.error('RSVP error:', error);
    }
  };

  const handleAddToTravelMap = async () => {
    if (!event?.campground) return;
    try {
      await api.post('/travel-map/visits', {
        state: event.campground.state,
        startDate: event.startDate,
        endDate: event.endDate || event.startDate,
        eventId: event.id,
        campsiteId: event.campground.id,
        notes: `${event.title} at ${event.campground.name}`,
      });
      alert('✅ Added to your Travel Map!');
    } catch (error: any) {
      if (error.response?.status === 400) {
        alert('This trip is already on your Travel Map!');
      } else {
        alert('Failed to add to travel map');
      }
    }
  };

  const handleCopyEvent = async () => {
    if (!copyForm.isWishlist && !copyForm.startDate) {
      alert('Please set a start date or mark as wishlist');
      return;
    }
    setCopying(true);
    try {
      const { data } = await api.post(`/events/${id}/copy`, {
        startDate: copyForm.isWishlist ? null : copyForm.startDate,
        endDate: copyForm.isWishlist ? null : copyForm.endDate,
        isWishlist: copyForm.isWishlist,
        copyMealPlan: copyForm.copyMealPlan,
      });
      setShowCopyModal(false);
      alert('🎉 Event copied to your events!');
      navigate(`/events/${data.id}`);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to copy event');
    } finally {
      setCopying(false);
    }
  };

  const handleRemoveAttendee = async (attendeeId: string) => {
    if (!confirm('Remove this attendee?')) return;
    try {
      await api.delete(`/events/${id}/attendees/${attendeeId}`);
      await loadEvent();
    } catch (error) {
      console.error('Remove attendee error:', error);
    }
  };

  const calculateDuration = () => {
    if (!event?.startDate || event.isWishlist) return '';
    const start = new Date(event.startDate);
    const end = event.endDate ? new Date(event.endDate) : start;
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays === 1 ? '1 day' : `${diffDays} days`;
  };

  const getDaysUntilEvent = () => {
    if (!event?.startDate) return null;
    if (event.isWishlist) return { text: '⭐ Wishlist', color: 'text-yellow-600' };
    const start = new Date(event.startDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { text: 'Event has passed', color: 'text-gray-500' };
    if (diffDays === 0) return { text: 'Today! 🎉', color: 'text-green-600' };
    if (diffDays === 1) return { text: 'Tomorrow!', color: 'text-green-600' };
    return { text: `In ${diffDays} days`, color: diffDays <= 7 ? 'text-blue-600' : 'text-gray-600' };
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div></div>;
  if (!event) return <div className="max-w-4xl mx-auto px-4 py-8"><p className="text-gray-600">Event not found</p></div>;

  const isOrganizer = user?.id === event.organizerId;
  const isPastTrip = event?.endDate ? new Date(event.endDate) < new Date() : event?.startDate ? new Date(event.startDate) < new Date() : false;

  const handlePrivacyChange = async (newPrivacy: string) => {
    try {
      await api.put(`/events/${id}`, { privacy: newPrivacy });
      setEvent({ ...event, privacy: newPrivacy });
    } catch (error) {
      console.error('Failed to update privacy:', error);
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingBanner(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      
      const uploadRes = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const bannerImage = uploadRes.data.url;
      await api.put(`/events/${id}`, { bannerImage });
      setEvent({ ...event, bannerImage });
    } catch (error) {
      console.error('Failed to upload banner:', error);
      alert('Failed to upload banner image');
    } finally {
      setUploadingBanner(false);
    }
  };

  const daysUntil = getDaysUntilEvent();

  const tabs = [
    { id: 'details', label: 'Details', icon: Calendar },
    { id: 'trip', label: 'Trip Planner', icon: Car },
    { id: 'schedule', label: 'Schedule', icon: Clock },
    { id: 'photos', label: 'Photos', icon: Image },
    { id: 'meals', label: 'Meal Plan', icon: ChefHat },
    { id: 'pack', label: 'Pack List', icon: Package },
    { id: 'packup', label: 'Pack Up', icon: Check },
    { id: 'cost', label: '💰 Trip Cost', icon: DollarSign },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <button onClick={() => navigate('/events')} className="flex items-center text-gray-600 hover:text-gray-900 mb-4">
        <ArrowLeft className="w-5 h-5 mr-2" />Back to Events
      </button>

      {event.isWishlist && (
        <div className="bg-gradient-to-r from-yellow-100 to-amber-100 border-2 border-yellow-300 rounded-lg p-4 mb-4 flex items-center gap-3">
          <Star className="w-6 h-6 text-yellow-600 fill-yellow-400" />
          <div>
            <p className="font-semibold text-yellow-800">Wishlist Event</p>
            <p className="text-sm text-yellow-700">This trip is on your wishlist - set dates when you're ready!</p>
          </div>
          {isOrganizer && <Link to={`/trips/${event.id}/edit`} className="ml-auto btn btn-primary btn-sm">Set Dates</Link>}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
        <div className="h-64 bg-gradient-to-br from-green-100 to-blue-100 relative group">
          {(() => {
            const img = (event.bannerImage && !event.bannerImage.startsWith('/images/')) ? event.bannerImage : (event.imageUrl && !event.imageUrl.startsWith('/images/')) ? event.imageUrl : event.campground?.imageUrl;
            return img ? (
              <DraggableBanner
                imageUrl={img}
                altText={event.title}
                position={bannerPosition}
                canEdit={isOrganizer}
                onPositionChange={async (pos) => {
                  setBannerPosition(pos);
                  try { await api.patch(`/trips/${event.id}/banner-position`, { bannerPosition: pos }); } catch {}
                }}
                className="w-full h-full"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center"><Calendar className="w-24 h-24 text-green-300" /></div>
            );
          })()}
          {isOrganizer && (
            <label className={`absolute bottom-4 left-4 flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-all ${event.bannerImage ? 'bg-black/50 text-white opacity-0 group-hover:opacity-100' : 'bg-white shadow-lg text-gray-700 hover:bg-gray-50'}`}>
              {uploadingBanner ? (
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Camera className="w-5 h-5" />
              )}
              <span className="font-medium">{event.bannerImage ? 'Change Banner' : 'Add Banner Image'}</span>
              <input type="file" accept="image/*" onChange={handleBannerUpload} className="hidden" disabled={uploadingBanner} />
            </label>
          )}
          {daysUntil && (
            <div className={`absolute top-4 right-4 px-4 py-2 rounded-full shadow-lg ${event.isWishlist ? 'bg-yellow-100 border-2 border-yellow-300' : 'bg-white'}`}>
              <span className={`font-semibold ${daysUntil.color}`}>{daysUntil.text}</span>
            </div>
          )}
        </div>

        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {event.title}
                {event.isWishlist && <Star className="w-6 h-6 text-yellow-500 fill-yellow-400 inline ml-2" />}
              </h1>
              <ShareButton
                title={`${event.title} - RVUnicorn`}
                text={`Check out this trip/event: ${event.title}${event.campground ? ` at ${event.campground.name}` : ""}!`}
                url={`/events/${event.id}`}
                variant="icon"
              />
              </div>
              {event.organizer && (
                <Link to={`/profile/${event.organizer.username}`} className="text-sm text-gray-600 hover:text-primary-600 mb-2 inline-block">
                  Organized by {event.organizer.firstName} {event.organizer.lastName}
                </Link>
              )}
              {!event.isWishlist && (
                <div className="flex items-center gap-2 text-gray-600 mb-2">
                  <Calendar className="w-5 h-5 text-primary-600" />
                  <span>
                    {new Date(event.startDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    {event.endDate && event.endDate !== event.startDate && ` - ${new Date(event.endDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`}
                  </span>
                  <span className="text-sm text-gray-500">({calculateDuration()})</span>
                </div>
              )}
              <div className="flex items-center gap-4 mt-4">
                <div className="flex items-center gap-1 text-gray-600"><Users className="w-5 h-5" /><span>{event._count?.attendees || 0} attending</span></div>
              </div>
            </div>
            <div className="flex gap-2">
              {!isOrganizer && user && (
                <button onClick={() => { setCopyForm({ startDate: '', endDate: '', isWishlist: false, copyMealPlan: true }); setShowCopyModal(true); }} className="btn btn-secondary btn-sm flex items-center gap-2">
                  <Copy className="w-4 h-4" />Copy Event
                </button>
              )}
              {isOrganizer && <button onClick={() => setShowInviteModal(true)} className="btn btn-secondary btn-sm flex items-center gap-2"><UserPlus className="w-4 h-4" />{isPastTrip ? 'Tag People' : 'Invite'}</button>}
              {isOrganizer && <Link to={`/trips/${event.id}/edit`} className="btn btn-primary btn-sm flex items-center gap-2"><Edit className="w-4 h-4" />Edit Event</Link>}
              {isOrganizer && <button onClick={handleDeleteEvent} className="btn btn-sm flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white"><Trash2 className="w-4 h-4" />Delete</button>}
              {isOrganizer && (
                <select
                  value={(event as any).privacy || 'PUBLIC'}
                  onChange={(e) => handlePrivacyChange(e.target.value)}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="PUBLIC">🌍 Public</option>
                  <option value="FRIENDS">👥 Friends Only</option>
                  <option value="PRIVATE">🔒 Private</option>
                </select>
              )}
            </div>
          </div>

          {userAttendee && userAttendee.status === 'invited' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-700 mb-3">You've been invited to this event. Will you attend?</p>
              <div className="flex gap-2">
                <button onClick={() => handleRSVP('going')} className="btn btn-primary btn-sm flex items-center gap-2"><Check className="w-4 h-4" />Going</button>
                <button onClick={() => handleRSVP('maybe')} className="btn btn-secondary btn-sm">Maybe</button>
                <button onClick={() => handleRSVP('not_going')} className="btn btn-secondary btn-sm flex items-center gap-2"><XCircle className="w-4 h-4" />Can't Go</button>
              </div>
            </div>
          )}

          {userAttendee && userAttendee.status !== 'invited' && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 flex items-center justify-between">
              <span className="text-sm text-green-700">You're {userAttendee.status === 'going' ? 'attending' : userAttendee.status === 'maybe' ? 'maybe attending' : 'not attending'} this event</span>
              <button onClick={() => handleRSVP('invited')} className="text-sm text-gray-600 hover:text-gray-900">Change RSVP</button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="border-b border-gray-200">
          <div className="flex gap-4 px-6 overflow-x-auto">
            {tabs.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 py-4 px-2 border-b-2 transition whitespace-nowrap ${activeTab === tab.id ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>
                {tab.icon && <tab.icon className="w-5 h-5" />}{tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'details' && (
            <div className="space-y-6">
              {isOrganizer && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div><h4 className="font-semibold text-gray-900">Event Settings</h4><p className="text-sm text-gray-600">Update event details</p></div>
                    <Link to={`/trips/${event.id}/edit`} className="btn btn-primary flex items-center gap-2"><Edit className="w-4 h-4" />Edit Event</Link>
                  </div>
                </div>
              )}

              <EventSettingsPanel eventId={event.id} isOrganizer={isOrganizer} />

              {event.description && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">📝 About This Event</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{event.description}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3"><Calendar className="w-5 h-5 text-blue-600" /><h4 className="font-semibold text-gray-900">Event Dates</h4></div>
                  {event.isWishlist ? (
                    <div className="text-center py-4"><Star className="w-8 h-8 text-yellow-500 fill-yellow-400 mx-auto mb-2" /><p className="text-gray-600">Dates not set yet</p></div>
                  ) : (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-gray-600">Start:</span><span className="font-medium">{new Date(event.startDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">End:</span><span className="font-medium">{new Date(event.endDate || event.startDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span></div>
                      <div className="flex justify-between pt-2 border-t border-blue-200"><span className="text-gray-600">Duration:</span><span className="font-semibold text-blue-700">{calculateDuration()}</span></div>
                    </div>
                  )}
                </div>

                <div className="bg-gradient-to-br from-green-50 to-teal-50 border border-green-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3"><MapPin className="w-5 h-5 text-green-600" /><h4 className="font-semibold text-gray-900">Location</h4></div>
                  {event.campground ? (
                    <div className="space-y-3">
                      <div>{event.campground.id ? <Link to={`/campgrounds/${event.campground.id}`} className="font-semibold text-primary-600 hover:underline">{event.campground.name}</Link> : <p className="font-semibold text-gray-900">{event.campground.name}</p>}<p className="text-sm text-gray-600">{event.campground.location}{event.campground.state ? `, ${event.campground.state}` : ''}</p></div>
                      <div className="flex flex-wrap gap-2">
                        <Link to={`/campgrounds/${event.campground.id}`} className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"><ExternalLink className="w-4 h-4" />View Campground</Link>
                        {user && event.campground && (() => {
                          const now = new Date();
                          const start = new Date(event.startDate);
                          const end = event.endDate ? new Date(event.endDate) : new Date(event.startDate);
                          end.setDate(end.getDate() + 1);
                          const isActive = now >= start && now <= end;
                          if (!isActive) return null;
                          return (
                            <button onClick={handleCheckIn} disabled={checkInLoading}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${isCheckedIn ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-primary-600 text-white hover:bg-primary-700'} disabled:opacity-50`}>
                              {checkInLoading ? '...' : isCheckedIn ? '🏕️ Check Out' : '📍 Check In Here'}
                            </button>
                          );
                        })()}
                        {!event.isWishlist && <button onClick={handleAddToTravelMap} className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"><Map className="w-4 h-4" />Add to Map</button>}
                        {event.campground.latitude && event.campground.longitude && (
                          <NavigationButtons lat={event.campground.latitude} lng={event.campground.longitude} name={event.campground.name} />
                        )}
                      </div>
                    </div>
                  ) : event.location ? (
                    <div className="space-y-3">
                      <p className="text-gray-900">{event.location}</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                      <a href={`https://waze.com/ul?q=${encodeURIComponent(event.location)}&navigate=yes`} target="_blank" rel="noopener noreferrer" title="Open in Waze" className="w-10 h-10 rounded-xl flex items-center justify-center bg-white border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all shadow-sm">🚗</a>
                      <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`} target="_blank" rel="noopener noreferrer" title="Open in Google Maps" className="w-10 h-10 rounded-xl flex items-center justify-center bg-white border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all shadow-sm">📍</a>
                      <a href={`https://maps.apple.com/?q=${encodeURIComponent(event.location)}&dirflg=d`} target="_blank" rel="noopener noreferrer" title="Open in Apple Maps" className="w-10 h-10 rounded-xl flex items-center justify-center bg-white border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all shadow-sm">🗺️</a>
                    </div>
                    </div>
                  ) : (
                    <p className="text-gray-500 italic">No location set</p>
                  )}
                </div>
              </div>

              {event.attendees && user && (
                <EventCommentWall
                  eventId={event.id}
                  currentUserId={user.id}
                  isOrganizer={isOrganizer || (userAttendee?.status === 'going')}
                  attendees={event.attendees}
                />
              )}

              {event.attendees && event.attendees.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">👥 Attendees ({event.attendees.length})</h3>
                    {isOrganizer && <button onClick={() => setShowInviteModal(true)} className="btn btn-secondary btn-sm flex items-center gap-2"><UserPlus className="w-4 h-4" />{isPastTrip ? 'Tag More People' : 'Invite More'}</button>}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {event.attendees.map((attendee) => (
                      <div key={attendee.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
                        <Link to={`/profile/${attendee.user.username}`} className="flex items-center gap-3 flex-1">
                          {attendee.user.profilePicture ? <img src={`${attendee.user.profilePicture}`} alt="" className="w-10 h-10 rounded-full" /> : <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center"><span className="text-primary-700 font-semibold">{attendee.user.firstName[0]}</span></div>}
                          <div>
                            <p className="font-semibold text-gray-900">{attendee.user.firstName} {attendee.user.lastName}{attendee.userId === event.organizerId && <span className="ml-2 text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">Organizer</span>}</p>
                            <p className="text-sm text-gray-600">{attendee.status === 'going' && '✅ Going'}{attendee.status === 'maybe' && '🤔 Maybe'}{attendee.status === 'not_going' && '❌ Not Going'}{attendee.status === 'invited' && '📨 Invited'}</p>
                          </div>
                        </Link>
                        {isOrganizer && attendee.userId !== event.organizerId && <button onClick={() => handleRemoveAttendee(attendee.id)} className="text-red-500 hover:text-red-700 text-sm">Remove</button>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {event.campground && (
                <div className="border-t pt-6">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">📍</span>
                    <h3 className="text-lg font-semibold text-gray-900">Things to Do Nearby</h3>
                  </div>
                  <p className="text-sm text-gray-500 mb-4 ml-7">Discover attractions, trails, and restaurants near {event.campground.name}</p>
                  <ThingsToDoSection
                    campgroundId={event.campground.id}
                    campgroundName={event.campground.name}
                    isAdmin={false}
                    eventId={event.id}
                    onActivityAdded={() => setScheduleRefreshKey(k => k + 1)}
                  />
                </div>
              )}
            </div>
          )}

          {activeTab === 'trip' && (
            <div className="space-y-4">
              <TripPlannerTab
                eventId={id}
                eventTitle={event?.title}
                homeLocation={userHomeLocation || ''}
                campground={event?.campground}
                arrivalDate={event?.startDate ? new Date(event.startDate).toISOString().split('T')[0] : undefined}
                tripPlan={tripPlan}
                tripLoading={tripLoading}
                onEditTrip={openTripModal}
                onReload={loadTripPlan}
                rvFuelType={(user as any)?.rvFuelType || 'gas'}
              />
              {false && <div className="bg-white rounded-lg border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold flex items-center gap-2"><Car className="w-6 h-6" />My Trip</h3>
                  <div className="flex items-center gap-3">
                    {tripPlan && !tripPlan.status?.includes('COMPLETED') && (
                      <button onClick={openTripModal} className="btn btn-secondary btn-sm flex items-center gap-1"><Edit className="w-4 h-4" />Edit Trip</button>
                    )}
                    {!tripPlan && <button onClick={openTripModal} className="btn btn-primary btn-sm">Plan My Trip</button>}
                    <label className="flex items-center gap-2 cursor-pointer select-none ml-2">
                      <span className="text-sm font-medium text-gray-500">✨ AI Plan</span>
                      <div onClick={() => setShowAIPlanner(v => !v)}
                        className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${showAIPlanner ? 'bg-primary-500' : 'bg-gray-200'}`}>
                        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${showAIPlanner ? 'translate-x-5' : 'translate-x-0'}`} />
                      </div>
                    </label>
                  </div>
                </div>

                {tripLoading ? (
                  <div className="text-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" /></div>
                ) : tripPlan ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* FROM - clickable to edit */}
                      <div className="bg-gray-50 rounded-lg p-4 group relative">
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-gray-500">From</p>
                          {!editingFrom && (
                            <button
                              onClick={() => { setEditFromValue(tripPlan.startLocation || ''); setEditingFrom(true); }}
                              className="text-gray-400 hover:text-primary-600 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Edit starting location"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        {editingFrom ? (
                          <div className="mt-1">
                            <input
                              type="text"
                              value={editFromValue}
                              onChange={(e) => setEditFromValue(e.target.value)}
                              className="input w-full text-sm"
                              placeholder="City, State or Address"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveFrom();
                                if (e.key === 'Escape') setEditingFrom(false);
                              }}
                            />
                            <div className="flex gap-2 mt-2">
                              <button onClick={handleSaveFrom} className="text-xs bg-primary-600 text-white px-3 py-1 rounded hover:bg-primary-700">Save</button>
                              <button onClick={() => setEditingFrom(false)} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="font-semibold">{tripPlan.startLocation || 'Not set'}</p>
                            {tripPlan.useHometown && <span className="text-xs text-gray-400">(Using hometown)</span>}
                          </>
                        )}
                      </div>

                      {/* TO */}
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-500">To</p>
                        <p className="font-semibold">{tripPlan.endLocation || getEventDestination()}</p>
                      </div>

                      {/* ARRIVAL DATE */}
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-500">Arrival</p>
                        <p className="font-semibold">
                          {tripPlan.arrivalDate
                            ? formatArrivalDate(tripPlan.arrivalDate)
                            : event.startDate
                              ? formatArrivalDate(new Date(new Date(event.startDate).setHours(14, 0, 0, 0)).toISOString())
                              : 'Not set'}
                        </p>
                      </div>

                      {/* DISTANCE */}
                      <div className="bg-primary-50 rounded-lg p-4">
                        <p className="text-sm text-primary-600">Estimated Distance</p>
                        <p className="text-2xl font-bold text-primary-700">{tripPlan.distanceMiles ? `${tripPlan.distanceMiles} mi` : 'Calculating...'}</p>
                        {tripPlan.durationMinutes && <p className="text-sm text-primary-600">{formatDuration(tripPlan.durationMinutes)}</p>}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 text-sm">
                      <span className={`px-2 py-1 rounded ${tripPlan.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{tripPlan.status}</span>
                      {tripPlan.isDriving ? <span className="px-2 py-1 rounded bg-gray-100 text-gray-700">🚗 Driving</span> : <span className="px-2 py-1 rounded bg-gray-100 text-gray-700">🚐 Riding with {tripPlan.ridingWith?.firstName}</span>}
                      <span className="px-2 py-1 rounded bg-gray-100 text-gray-700">Route: {tripPlan.routePreference}</span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-2 border-t pt-4">
                      {tripPlan.endLatitude && tripPlan.endLongitude && (
                        <a href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(tripPlan.startLocation)}&destination=${tripPlan.endLatitude},${tripPlan.endLongitude}`} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm flex items-center gap-1">
                          <Navigation className="w-4 h-4" />Open in Google Maps
                        </a>
                      )}
                    </div>

                    {/* Smart RV Stops */}
                    <div className="pt-4 border-t">
                      <SmartStops tripPlan={tripPlan} eventId={event.id} event={event} onAddPitStop={() => loadTripPlan()} userMpg={userRvMpg} userTankGallons={userRvTankGallons} />

                    {/* Odometer Projection */}
                    <OdometerProjection tripPlan={tripPlan} event={event} />
                    </div>

                    {/* Pit Stops Section */}
                    <div className="border-t pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                          <MapPin className="w-5 h-5" />
                          Pit Stops ({tripPlan.pitStops?.length || 0})
                        </h4>
                        <button onClick={() => setShowPitStopModal(true)} className="btn btn-secondary btn-sm flex items-center gap-1">
                          <Plus className="w-4 h-4" />Add Stop
                        </button>
                      </div>

                      {tripPlan.pitStops && tripPlan.pitStops.length > 0 ? (
                        <div className="space-y-2">
                          {tripPlan.pitStops.map((stop: PitStop, index: number) => {
                            const stopInfo = getStopTypeInfo(stop.stopType);
                            return (
                              <div key={stop.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white border-2 border-gray-200">
                                  <span className="text-xl">{stopInfo.emoji}</span>
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium">{stop.name}</p>
                                  <div className="flex flex-wrap gap-2 text-sm text-gray-500">
                                    <span className="bg-gray-100 px-2 py-0.5 rounded">{stopInfo.label}</span>
                                    {stop.location && <span>📍 {stop.location}</span>}
                                    {stop.estimatedDuration && <span>⏱️ {stop.estimatedDuration} min</span>}
                                  </div>
                                  {stop.notes && <p className="text-sm text-gray-600 mt-1">{stop.notes}</p>}
                                </div>
                                <button onClick={() => handleDeletePitStop(stop.id)} className="text-red-500 hover:text-red-700 p-1">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-6 bg-gray-50 rounded-lg">
                          <MapPin className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                          <p className="text-gray-500 text-sm">No pit stops planned</p>
                          <button onClick={() => setShowPitStopModal(true)} className="text-primary-600 hover:text-primary-700 text-sm mt-1">+ Add your first stop</button>
                        </div>
                      )}
                    </div>

                    {tripPlan.status === 'COMPLETED' && tripPlan.actualMiles && (
                      <div className="bg-green-50 rounded-lg p-4 mt-4">
                        <p className="text-green-700 font-medium">🎉 Trip Completed!</p>
                        <p className="text-green-600">Logged {tripPlan.actualMiles * 2} miles (round trip)</p>
                      </div>
                    )}

                  </div>
                ) : (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <Car className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-gray-600 mb-2">Plan your personal route to this event</p>
                    <button onClick={openTripModal} className="btn btn-primary">Plan My Trip</button>
                  </div>
                )}
              </div>}
            </div>
          )}

          {activeTab === 'cost' && (
            <div className="p-4">
              <HitchTripCostEstimator
                eventId={event.id}
                destination={event.campground?.name || event.location}
                startDate={event.startDate}
                endDate={event.endDate}
              />
            </div>
          )}
          {activeTab === 'schedule' && (
            <div className="space-y-8">
              <EventSchedule key={scheduleRefreshKey} eventId={event.id} eventStartDate={event.startDate} eventEndDate={event.endDate || event.startDate} />
              {event.campground && (
                <div className="border-t pt-8">
                  <ThingsToDoSection 
                    campgroundId={event.campground.id} 
                    campgroundName={event.campground.name}
                    isAdmin={isOrganizer}
                    onActivityAdded={() => setScheduleRefreshKey(k => k + 1)}
                  />
                </div>
              )}
            </div>
          )}
          {activeTab === 'photos' && <EventAlbum eventId={event.id} canUpload={isOrganizer || userAttendee?.status === 'going'} campgroundName={event.campground?.name} eventTitle={event.title} emptyState={
            <TripTabEmptyState
              icon="📸"
              title="No photos yet — be the first!"
              description="Capture the memories! Add photos from your trip and share the adventure with everyone."
              tips={["Add photos before, during, and after the trip", "Tag fellow campers in your shots", "Photos here are shared with all attendees"]}
            />
          } />}
          {activeTab === 'albums' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-900">Trip Albums</h3>
                {isOrganizer && (
                  <button onClick={() => setShowAlbumModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold hover:bg-primary-700">
                    <span>+</span> {isPastTrip ? 'Add Album' : 'Create Album'}
                  </button>
                )}
              </div>
              {tripAlbums.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <span className="text-4xl block mb-2">🗂️</span>
                  <p className="font-medium">No albums yet</p>
                  {isOrganizer && <p className="text-sm mt-1">Create an album or link an existing one to this trip</p>}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {tripAlbums.map((album: any) => (
                    <div key={album.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                      <div className="h-32 bg-gray-100 relative overflow-hidden grid grid-cols-2 gap-0.5">
                        {album.photos?.slice(0, 4).map((p: any, i: number) => (
                          <img key={i} src={p.imageUrl} className="w-full h-full object-cover" />
                        ))}
                        {(!album.photos || album.photos.length === 0) && (
                          <div className="col-span-2 w-full h-full flex items-center justify-center text-3xl">📷</div>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="font-semibold text-sm text-gray-900 truncate">{album.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{album._count?.photos || 0} photos • by {album.user?.firstName}</p>
                        <div className="flex gap-2 mt-2">
                          <a href={'/albums/' + album.id} className="text-xs text-primary-600 hover:underline">View →</a>
                          {isOrganizer && (
                            <button onClick={() => handleUnlinkAlbum(album.id)} className="text-xs text-red-400 hover:text-red-600 ml-auto">Remove</button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {activeTab === 'meals' && (
            <div id="meal-calendar" className="space-y-4">
              <HitchMealSuggestions
                eventId={event.id}
                destination={event.campground?.name || event.location}
                startDate={event.startDate}
                endDate={event.endDate}
                groupSize={(event.attendees?.length || 0) + 1}
              />
              <MealPlanner eventId={event.id} startDate={event.startDate} endDate={event.endDate || event.startDate} isOrganizer={isOrganizer || (userAttendee?.status === 'going')} emptyState={
            <TripTabEmptyState
              icon="🍳"
              title="No meals planned yet"
              description="Plan your campfire meals so everyone knows what to expect and what to bring!"
              tips={["Plan meals by day so shopping is easy", "Assign a chef for each night", "Don't forget s'mores 🍫"]}
            />
          } />
            </div>
          )}
          {activeTab === 'pack' && (
            <div className="space-y-4">
              <HitchPackingSuggestions
                eventId={event.id}
                destination={event.campground?.name || event.location}
                startDate={event.startDate}
                endDate={event.endDate}
                groupSize={(event.attendees?.length || 0) + 1}
              />
              <EventPackList eventId={event.id} />
            </div>
          )}
          {activeTab === 'packup' && (
            <div className="space-y-4">
              <HitchTripSummary event={event} />
              <PackUp eventId={event.id} eventTitle={event.title} endDate={event.endDate || event.startDate} />
            </div>
          )}
        </div>
      </div>


      {/* Album Modal */}
      {showAlbumModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="bg-gradient-to-r from-primary-600 to-purple-600 text-white p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">🗂️ Trip Album</h2>
                <button onClick={() => setShowAlbumModal(false)} className="text-white hover:text-gray-200"><X className="w-6 h-6" /></button>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => setAlbumModalTab('create')}
                  className={'px-3 py-1 rounded-full text-sm font-medium ' + (albumModalTab === 'create' ? 'bg-white text-primary-600' : 'text-white/70 hover:text-white')}>
                  Create New
                </button>
                <button onClick={() => setAlbumModalTab('link')}
                  className={'px-3 py-1 rounded-full text-sm font-medium ' + (albumModalTab === 'link' ? 'bg-white text-primary-600' : 'text-white/70 hover:text-white')}>
                  Link Existing
                </button>
              </div>
            </div>
            <div className="p-4">
              {albumModalTab === 'create' ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-semibold text-gray-700">Album Title *</label>
                    <input value={newAlbumTitle} onChange={e => setNewAlbumTitle(e.target.value)}
                      placeholder={isPastTrip ? `${event.title} Photos` : 'Trip Photos'}
                      className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-700">Description</label>
                    <textarea value={newAlbumDesc} onChange={e => setNewAlbumDesc(e.target.value)}
                      placeholder="Memories from this trip..."
                      className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-400" rows={2} />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-700">Privacy</label>
                    <select value={albumPrivacy} onChange={e => setAlbumPrivacy(e.target.value)}
                      className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400">
                      <option value="PUBLIC">🌍 Public</option>
                      <option value="FRIENDS">👥 Friends Only</option>
                      <option value="PRIVATE">🔒 Private</option>
                    </select>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={handleCreateTripAlbum} disabled={!newAlbumTitle.trim()}
                      className="flex-1 py-2.5 bg-primary-600 text-white rounded-lg font-semibold text-sm disabled:opacity-50 hover:bg-primary-700">
                      Create Album
                    </button>
                    <button onClick={() => setShowAlbumModal(false)} className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">Select one of your existing albums to link to this trip:</p>
                  {myAlbums.filter((a: any) => a.eventId !== event.id).length === 0 ? (
                    <p className="text-center py-6 text-gray-400 text-sm">No albums available to link</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {myAlbums.filter((a: any) => a.eventId !== event.id).map((album: any) => (
                        <label key={album.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg cursor-pointer hover:bg-gray-50">
                          <input type="radio" name="albumSelect" value={album.id}
                            checked={selectedAlbumId === album.id}
                            onChange={() => setSelectedAlbumId(album.id)} />
                          {album.coverPhotoUrl && <img src={album.coverPhotoUrl} className="w-10 h-10 rounded object-cover" />}
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{album.title}</p>
                            <p className="text-xs text-gray-400">{album._count?.photos || 0} photos</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <button onClick={handleLinkAlbum} disabled={!selectedAlbumId}
                      className="flex-1 py-2.5 bg-primary-600 text-white rounded-lg font-semibold text-sm disabled:opacity-50 hover:bg-primary-700">
                      Link Album
                    </button>
                    <button onClick={() => setShowAlbumModal(false)} className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white p-4 rounded-t-lg">
              <div className="flex items-center justify-between"><h2 className="text-xl font-bold">{isPastTrip ? '🏷️ Tag Trip Members' : 'Invite Friends'}</h2><button onClick={() => setShowInviteModal(false)} className="text-white hover:text-gray-200"><X className="w-6 h-6" /></button></div>
            </div>
            <div className="p-6">
              <p className="text-gray-600 mb-4">{isPastTrip ? 'Tag friends who were on this trip with you. They will be automatically added as going.' : 'Select friends to invite:'}</p>
              {friends.length > 0 ? (
                <div className="max-h-96 overflow-y-auto space-y-2 mb-4">
                  {friends.filter(friend => !event.attendees?.some(a => a.userId === friend.id)).map((friend) => (
                    <label key={friend.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                      <input type="checkbox" checked={selectedFriends.includes(friend.id)} onChange={(e) => e.target.checked ? setSelectedFriends([...selectedFriends, friend.id]) : setSelectedFriends(selectedFriends.filter(fid => fid !== friend.id))} className="rounded text-primary-600" />
                      {friend.profilePicture ? <img src={`${friend.profilePicture}`} alt="" className="w-10 h-10 rounded-full" /> : <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center"><Users className="w-5 h-5 text-gray-500" /></div>}
                      <span className="font-medium">{friend.firstName} {friend.lastName}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600 text-center py-8">No friends to invite</p>
              )}
              <div className="flex gap-3">
                <button onClick={handleInvite} disabled={selectedFriends.length === 0} className="btn btn-primary flex-1">{isPastTrip ? 'Tag' : 'Invite'} {selectedFriends.length > 0 && `(${selectedFriends.length})`}</button>
                <button onClick={() => setShowInviteModal(false)} className="btn btn-secondary">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Copy Event Modal */}
      {showCopyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white p-4 rounded-t-lg">
              <div className="flex items-center justify-between"><h2 className="text-xl font-bold flex items-center gap-2"><Copy className="w-5 h-5" />Copy Event</h2><button onClick={() => setShowCopyModal(false)} className="text-white hover:text-gray-200"><X className="w-6 h-6" /></button></div>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-600">Copy <strong>"{event.title}"</strong> to your events.</p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-2"><Star className={`w-5 h-5 ${copyForm.isWishlist ? 'text-yellow-500 fill-yellow-400' : 'text-gray-400'}`} /><div><span className="font-medium text-gray-900">Add to Wishlist</span><p className="text-xs text-gray-600">Save for later!</p></div></div>
                  <div onClick={() => setCopyForm({ ...copyForm, isWishlist: !copyForm.isWishlist })} className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${copyForm.isWishlist ? 'bg-yellow-500' : 'bg-gray-300'}`}><div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${copyForm.isWishlist ? 'translate-x-7' : 'translate-x-1'}`} /></div>
                </label>
              </div>
              {!copyForm.isWishlist && (
                <div className="space-y-3">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label><input type="date" value={copyForm.startDate} onChange={(e) => setCopyForm({ ...copyForm, startDate: e.target.value })} className="input w-full" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">End Date</label><input type="date" value={copyForm.endDate} onChange={(e) => setCopyForm({ ...copyForm, endDate: e.target.value })} className="input w-full" min={copyForm.startDate} /></div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Include:</label>
                <label className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"><input type="checkbox" checked={copyForm.copyMealPlan} onChange={(e) => setCopyForm({ ...copyForm, copyMealPlan: e.target.checked })} className="rounded text-primary-600" /><ChefHat className="w-4 h-4 text-gray-500" /><span>Meal Plan</span></label>
              </div>
              <div className="flex gap-3 pt-4 border-t">
                <button onClick={handleCopyEvent} disabled={copying || (!copyForm.isWishlist && !copyForm.startDate)} className="btn btn-primary flex-1 disabled:opacity-50">{copying ? 'Copying...' : copyForm.isWishlist ? 'Add to Wishlist' : 'Copy Event'}</button>
                <button onClick={() => setShowCopyModal(false)} className="btn btn-secondary">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trip Plan Modal */}
      {showTripModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4"><h3 className="text-xl font-bold">Plan Your Trip</h3><button onClick={() => setShowTripModal(false)} className="text-gray-500 hover:text-gray-700"><X className="w-6 h-6" /></button></div>
            <div className="space-y-4">
              {/* Destination Preview */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Destination</p>
                {event.campground ? (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-green-800">{event.campground.name}</p>
                      <p className="text-sm text-gray-600">{event.campground.location}{event.campground.state ? `, ${event.campground.state}` : ''}</p>
                    </div>
                  </div>
                ) : event.location ? (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <p className="font-semibold text-green-800">{event.location}</p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">No destination set for this event</p>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="useHometown" checked={tripForm.useHometown} onChange={(e) => setTripForm({ ...tripForm, useHometown: e.target.checked })} />
                  <label htmlFor="useHometown" className="text-sm text-gray-700">Use my hometown as starting point</label>
                </div>
                {tripForm.useHometown && userHomeLocation && (
                  <p className="text-sm text-primary-600 mt-1 ml-6">📍 {userHomeLocation}</p>
                )}
                {tripForm.useHometown && !userHomeLocation && (
                  <p className="text-sm text-amber-600 mt-1 ml-6">⚠️ No hometown set. <a href="/my-rv" className="underline">Add it in your profile</a></p>
                )}
              </div>
              {!tripForm.useHometown && <div><label className="block text-sm font-medium text-gray-700 mb-1">Starting Location</label><input type="text" value={tripForm.startLocation} onChange={(e) => setTripForm({ ...tripForm, startLocation: e.target.value })} className="input w-full" placeholder="City, State or Address" /></div>}

              {/* Arrival Date & Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Clock className="w-4 h-4 inline mr-1" />
                  Planned Arrival
                </label>
                <input
                  type="datetime-local"
                  value={tripForm.arrivalDate}
                  onChange={(e) => setTripForm({ ...tripForm, arrivalDate: e.target.value })}
                  className="input w-full"
                />
                <p className="text-xs text-gray-400 mt-1">Defaults to event start date at 2:00 PM</p>
              </div>

              <div><label className="block text-sm font-medium text-gray-700 mb-1">Route Preference</label><select value={tripForm.routePreference} onChange={(e) => setTripForm({ ...tripForm, routePreference: e.target.value })} className="input w-full"><option value="FASTEST">Fastest Route</option><option value="SHORTEST">Shortest Distance</option><option value="RV_FRIENDLY">RV-Friendly</option></select></div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2"><input type="checkbox" checked={tripForm.avoidTolls} onChange={(e) => setTripForm({ ...tripForm, avoidTolls: e.target.checked })} /><span className="text-sm">Avoid Tolls</span></label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={tripForm.avoidHighways} onChange={(e) => setTripForm({ ...tripForm, avoidHighways: e.target.checked })} /><span className="text-sm">Avoid Highways</span></label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Transportation</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2"><input type="radio" name="transport" checked={tripForm.isDriving} onChange={() => setTripForm({ ...tripForm, isDriving: true })} /><span className="text-sm">🚗 I'm Driving</span></label>
                  <label className="flex items-center gap-2"><input type="radio" name="transport" checked={!tripForm.isDriving} onChange={() => setTripForm({ ...tripForm, isDriving: false })} /><span className="text-sm">🚐 Riding With Someone</span></label>
                </div>
              </div>
              {!tripForm.isDriving && <div><label className="block text-sm font-medium text-gray-700 mb-1">Riding With</label><select value={tripForm.ridingWithId} onChange={(e) => setTripForm({ ...tripForm, ridingWithId: e.target.value })} className="input w-full"><option value="">Select traveler...</option>{event.attendees?.filter(a => a.userId !== user?.id && a.status === 'going').map((attendee) => <option key={attendee.userId} value={attendee.userId}>{attendee.user.firstName} {attendee.user.lastName}</option>)}</select></div>}
            </div>
            <div className="flex gap-3 mt-6"><button onClick={() => setShowTripModal(false)} className="btn btn-secondary flex-1">Cancel</button><button onClick={handleCreateTripPlan} disabled={tripLoading} className="btn btn-primary flex-1">{tripLoading ? 'Saving...' : tripPlan ? 'Update Trip Plan' : 'Save Trip Plan'}</button></div>
          </div>
        </div>
      )}

      {/* Pit Stop Modal */}
      {showPitStopModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4"><h3 className="text-xl font-bold">Add Pit Stop</h3><button onClick={() => setShowPitStopModal(false)} className="text-gray-500 hover:text-gray-700"><X className="w-6 h-6" /></button></div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stop Type *</label>
                <div className="grid grid-cols-4 gap-2">
                  {STOP_TYPES.map((type) => (
                    <button key={type.id} onClick={() => setPitStopForm({ ...pitStopForm, stopType: type.id })} className={`p-2 rounded-lg border-2 text-center transition ${pitStopForm.stopType === type.id ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <span className="text-xl block">{type.emoji}</span>
                      <span className="text-xs text-gray-600">{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Name *</label><input type="text" value={pitStopForm.name} onChange={(e) => setPitStopForm({ ...pitStopForm, name: e.target.value })} className="input w-full" placeholder="e.g., Love's Travel Stop" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Location</label><input type="text" value={pitStopForm.location} onChange={(e) => setPitStopForm({ ...pitStopForm, location: e.target.value })} className="input w-full" placeholder="City, State or Address" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Estimated Duration (minutes)</label><input type="number" value={pitStopForm.estimatedDuration} onChange={(e) => setPitStopForm({ ...pitStopForm, estimatedDuration: parseInt(e.target.value) || 0 })} className="input w-full" min="5" step="5" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Notes</label><textarea value={pitStopForm.notes} onChange={(e) => setPitStopForm({ ...pitStopForm, notes: e.target.value })} className="input w-full" rows={2} placeholder="Any notes about this stop..." /></div>
            </div>
            <div className="flex gap-3 mt-6"><button onClick={() => setShowPitStopModal(false)} className="btn btn-secondary flex-1">Cancel</button><button onClick={handleAddPitStop} disabled={!pitStopForm.name} className="btn btn-primary flex-1 disabled:opacity-50">Add Pit Stop</button></div>
          </div>

      {/* Smart RV Stops Modal */}
      {showDiscoverStopsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-xl font-bold">Smart RV Stops Along Your Route</h3>
              <button onClick={() => setShowDiscoverStopsModal(false)} className="text-gray-500 hover:text-gray-700"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {discoverLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
                  <span className="ml-3 text-gray-600">Finding stops along your route...</span>
                </div>
              ) : (
                <div className="space-y-6">
                  {discoveredStops.gasStations?.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2"><Fuel className="w-4 h-4" /> Gas Stations ({discoveredStops.gasStations.length})</h4>
                      <div className="space-y-2">
                        {discoveredStops.gasStations.slice(0, 8).map((place: any) => (
                          <div key={place.placeId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                            <div className="flex-1">
                              <p className="font-medium">{place.name}</p>
                              <p className="text-sm text-gray-500">{place.address}</p>
                              {place.rating && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">★ {place.rating}</span>}
                            </div>
                            <button onClick={() => handleAddDiscoveredStop(place, 'GAS')} className="btn btn-sm btn-primary">+ Add</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {discoveredStops.restaurants?.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2"><Utensils className="w-4 h-4" /> Restaurants ({discoveredStops.restaurants.length})</h4>
                      <div className="space-y-2">
                        {discoveredStops.restaurants.slice(0, 8).map((place: any) => (
                          <div key={place.placeId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                            {place.photo && <img src={place.photo} alt={place.name} className="w-12 h-12 rounded object-cover" />}
                            <div className="flex-1">
                              <p className="font-medium">{place.name}</p>
                              <p className="text-sm text-gray-500">{place.address}</p>
                              <div className="flex gap-2">
                                {place.rating && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">★ {place.rating}</span>}
                                {place.priceLevel && <span className="text-xs text-green-600">{'$'.repeat(place.priceLevel)}</span>}
                              </div>
                            </div>
                            <button onClick={() => handleAddDiscoveredStop(place, 'FOOD')} className="btn btn-sm btn-primary">+ Add</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {discoveredStops.attractions?.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2"><Camera className="w-4 h-4" /> Attractions ({discoveredStops.attractions.length})</h4>
                      <div className="space-y-2">
                        {discoveredStops.attractions.slice(0, 8).map((place: any) => (
                          <div key={place.placeId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                            {place.photo && <img src={place.photo} alt={place.name} className="w-12 h-12 rounded object-cover" />}
                            <div className="flex-1">
                              <p className="font-medium">{place.name}</p>
                              <p className="text-sm text-gray-500">{place.address}</p>
                              {place.rating && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">★ {place.rating}</span>}
                            </div>
                            <button onClick={() => handleAddDiscoveredStop(place, 'ATTRACTION')} className="btn btn-sm btn-primary">+ Add</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {!discoveredStops.gasStations?.length && !discoveredStops.restaurants?.length && !discoveredStops.attractions?.length && (
                    <div className="text-center py-8 text-gray-500">
                      <MapPin className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p>No stops found along your route</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
        </div>
      )}
      {/* Pack Up Reminder Popup */}
      {showPackUpReminder && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-6 text-center">
              <div className="text-6xl mb-2">😭🏕️</div>
              <h2 className="text-2xl font-bold text-white">Nooooo... It's Almost Over!</h2>
            </div>
            <div className="p-6 text-center">
              <p className="text-gray-700 text-lg mb-2 font-medium">
                Your trip ends in less than 2 days.
              </p>
              <p className="text-gray-500 mb-4 text-sm italic">
                The campfire is dying, the s'mores are gone, and real life is lurking around the corner like a bear at the dumpster. 🐻
              </p>
              <p className="text-gray-600 mb-6">
                Time to start thinking about packing up so you're not doing the "throwing everything in a bag at 6am" dance. Again.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowPackUpReminder(false); setActiveTab('packup'); }}
                  className="flex-1 px-4 py-3 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600 transition"
                >
                  📦 Start Packing Up
                </button>
                <button
                  onClick={() => setShowPackUpReminder(false)}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-600 rounded-xl font-semibold hover:bg-gray-200 transition"
                >
                  😤 5 More Minutes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

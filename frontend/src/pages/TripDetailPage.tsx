import { useToast } from '../components/ToastProvider';
import ShareButton from '../components/ShareButton';
import NavigationButtons from '../components/NavigationButtons';
import OdometerProjection from '../components/OdometerProjection';
import { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import { Calendar, ShoppingCart, MapPin, Users, Edit, ArrowLeft, UserPlus, X, Car, Check, XCircle, Image, Clock, Navigation, ExternalLink, ChefHat, Package, Map, Copy, Star, Plus, Trash2, Coffee, Fuel, Wrench, Moon, Utensils, Dog, Play, Footprints, Camera, Upload, DollarSign, CalendarDays} from 'lucide-react';
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
import EventWeatherStrip from '../components/EventWeatherStrip';
import SupplyList from '../components/SupplyList';
import EventAlbum from '../components/EventAlbum';
import TripScrapbook from '../components/TripScrapbook';
import SmartStops from '../components/SmartStops';
import SmartTripSummary from '../components/SmartTripSummary';
import SmartConnector from '../components/SmartConnector';
import InlineAddStop from '../components/InlineAddStop';
import AddStopModal from '../components/AddStopModal';
import EventCommentWall from '../components/EventCommentWall';
import EventActivities from '../components/EventActivities';
import ThingsToDoSection from '../components/ThingsToDoSection';
import EventSettingsPanel from '../components/EventSettingsPanel';
import CampMarket from '../components/CampMarket';
import CampfireTips from '../components/CampfireTips';
import EventCampgroundMap from '../components/EventCampgroundMap';
import NowBar from '../components/NowBar';
import TripStaySurveyModal from '../components/TripStaySurveyModal';
import CampBoard from '../components/CampBoard';
import { useTripState } from '../hooks/useTripState';

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
  { id: 'CAMPGROUND', label: 'Campground', emoji: '🏕️', icon: MapPin },
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
  const { addLocalToast } = useToast();
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
      addLocalToast(e?.response?.data?.error || 'Failed', 'error');
    } finally {
      setCheckInLoading(false);
    }
  };

  // Check active check-in on load

  const [userRvMpg, setUserRvMpg] = useState<number>(10);
  const [userRvTankGallons, setUserRvTankGallons] = useState<number>(50);
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(() => new URLSearchParams(window.location.search).get('tab') || window.location.hash.replace('#', '') || 'details');
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('scrollTo') === 'planner') {
      setActiveTab('trip');
      if (params.get('from')) setPlannerFrom(params.get('from')!);
      if (params.get('to')) setPlannerTo(params.get('to')!);
      setTimeout(() => {
        const plannerEl = document.getElementById('trip-planner-section');
        if (plannerEl) {
          plannerEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        }
      }, 400);
    }
    if (params.get('scrollTo') === 'meals') {
      setTimeout(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }, 500);
    }
    // ?openPhase=plan|travel|prepare|camp|remember — open the named phase accordion
    // and scroll to it. Used by Basecamp planning panel deep-links.
    const openPhase = params.get('openPhase');
    if (openPhase && ['plan','travel','prepare','camp','remember'].includes(openPhase)) {
      userToggledPhases.current = true;
      setOpenPhases(prev => new Set([...prev, openPhase]));
      setTimeout(() => {
        const el = document.getElementById(`phase-${openPhase}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 250);
    }
  }, [location.search]);
  const [showPackingModal, setShowPackingModal] = useState(false);
  const [plannerFrom, setPlannerFrom] = useState<string>('');
  const [plannerTo, setPlannerTo] = useState<string>('');
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
  const [siteForm, setSiteForm] = useState({ siteNumber: '', confirmationNumber: '', notes: '', siteVisibility: 'PRIVATE' });
  const [savingSite, setSavingSite] = useState(false);
  const [siteMsg, setSiteMsg] = useState('');
  const [showSiteForm, setShowSiteForm] = useState(false);
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
  const [legSuggestions, setLegSuggestions] = useState<any[]>([]);
  const [legSuggestionsLoading, setLegSuggestionsLoading] = useState(false);
  const [tripSummaryLegs, setTripSummaryLegs] = useState<any[]>([]);
  const [scheduleRefreshKey, setScheduleRefreshKey] = useState(0);
  const [packRefreshKey, setPackRefreshKey] = useState(0);
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
      // Load leg suggestions and summary for leg info
      if (data?.id) {
        loadLegSuggestions(data.id);
        loadTripSummaryLegs(data.id);
      }
    } catch (error) {
      console.error('Load trip plan error:', error);
    } finally {
      setTripLoading(false);
    }
  };

  const loadLegSuggestions = async (planId: string) => {
    setLegSuggestionsLoading(true);
    try {
      const { data } = await api.post(`/smart-trip/${planId}/leg-suggestions`);
      setLegSuggestions(data || []);
    } catch {
      setLegSuggestions([]);
    } finally {
      setLegSuggestionsLoading(false);
    }
  };

  const loadTripSummaryLegs = async (planId: string) => {
    try {
      // Fetch cached summary — but only use if it has valid data
      let { data } = await api.get(`/smart-trip/${planId}/summary`);
      if (!data || !data.legs || data.totalMiles === 0) {
        // No valid cache — force recalculate
        const calc = await api.post(`/smart-trip/${planId}/calculate-summary`);
        data = calc.data;
      }
      setTripSummaryLegs(data?.legs || []);
    } catch {
      setTripSummaryLegs([]);
    }
  };

  const handleDismissSuggestion = async (legIndex: number, suggestionId: string) => {
    if (!tripPlan) return;
    try {
      await api.post(`/smart-trip/${tripPlan.id}/dismiss-suggestion`, { legIndex, suggestionId });
      // Reload suggestions
      loadLegSuggestions(tripPlan.id);
    } catch {}
  };

  const handleAddSuggestionToTrip = async () => {
    if (!tripPlan) return;
    addLocalToast('Stop added to your trip!', 'success');
    await loadTripPlan();
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
      addLocalToast('✅ Trip plan saved!', 'success');
    } catch (error: any) {
      addLocalToast(error.response?.data?.error || 'Failed to create trip plan', 'error');
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
      // Default for new trip — use plannerFrom if coming from road trip link
      setTripForm({
        startLocation: plannerFrom || '',
        useHometown: !plannerFrom,
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
      addLocalToast(error.response?.data?.error || 'Failed to update start location', 'error');
    } finally {
      setTripLoading(false);
    }
  };

  const handleDiscoverStops = async () => {
    if (!tripPlan?.startLatitude || !tripPlan?.endLatitude) {
      addLocalToast('Trip must have start and end locations with coordinates', 'warning');
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

  const handleAddPitStop = async (directData?: any) => {
    // Use directly-passed data if available (from AddStopModal.confirmAdd),
    // otherwise fall back to pitStopForm (for manual/generic form entry)
    const formData = directData || pitStopForm;
    try {
      let planId = tripPlan?.id;
      if (!planId && id) {
        try {
          const { data: newPlan } = await api.post(`/trip-planner/event/${id}/plan`, {
            startLocation: event?.location || event?.campground?.name || '',
            useHometown: true,
            isDriving: true,
          });
          setTripPlan(newPlan);
          planId = newPlan.id;
        } catch {
          await api.post(`/trips/${id}/stops`, {
            stopType: formData.stopType || 'OTHER',
            name: formData.name,
            address: formData.location || '',
            notes: formData.notes || '',
          });
          setShowPitStopModal(false);
          setPitStopForm({ name: '', location: '', stopType: 'GAS', notes: '', estimatedDuration: 15 });
          addLocalToast('✅ Stop added!', 'success');
          return;
        }
      }
      if (!planId) {
        addLocalToast('Unable to add stop — trip plan could not be created', 'error');
        return;
      }
      console.log('[AddStop] Saving pit stop:', JSON.stringify(formData));
      await api.post(`/trip-planner/trip/${planId}/pit-stop`, formData);
      setShowPitStopModal(false);
      setPitStopForm({ name: '', location: '', stopType: 'GAS', notes: '', estimatedDuration: 15 });
      setSummaryRefreshKey(k => k + 1);
      loadTripPlan();
      addLocalToast(`${formData.name || 'Stop'} added to your trip!`, 'success');
    } catch (error: any) {
      addLocalToast(error.response?.data?.error || 'Failed to add pit stop', 'error');
    }
  };

  const [removedStopId, setRemovedStopId] = useState<string | null>(null);
  const [summaryRefreshKey, setSummaryRefreshKey] = useState(0);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDeletePitStop = async (pitStopId: string) => {
    // Find stop name for toast
    const stop = tripPlan?.pitStops?.find((s: any) => s.id === pitStopId);
    const stopName = stop?.name || 'Stop';
    // Capture the trip plan id before the timeout (avoid stale closure)
    const planId = tripPlan?.id;

    // Optimistic: hide the stop immediately
    setRemovedStopId(pitStopId);

    // Show undo toast
    addLocalToast(`${stopName} removed`, 'success');

    // Set a timer to actually delete after 3 seconds (undo window)
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(async () => {
      try {
        // 1. Delete the stop from the database
        await api.delete(`/trip-planner/pit-stop/${pitStopId}`);
        setRemovedStopId(null);
        // 2. Recalculate summary FIRST (stop is already deleted in DB)
        if (planId) {
          try {
            const { data: newSummary } = await api.post(`/smart-trip/${planId}/calculate-summary`);
            console.log('[SmartTrip] Recalculated after delete:', newSummary?.totalMiles, 'mi');
          } catch (e) {
            console.error('[SmartTrip] Recalculate failed:', e);
          }
        }
        // 3. Reload everything with fresh data
        setSummaryRefreshKey(k => k + 1);
        await loadTripPlan();
      } catch (error: any) {
        setRemovedStopId(null);
        addLocalToast(error.response?.data?.error || 'Could not remove stop — try again', 'error');
      }
    }, 3000);
  };

  const handleUndoRemove = () => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setRemovedStopId(null);
    addLocalToast('Stop restored', 'success');
  };

  const saveSiteDetails = async () => {
    setSavingSite(true);
    try {
      await api.put(`/trips/${event.id}/my-site`, siteForm);
      setSiteMsg('Campsite details saved ✅');
      setTimeout(() => setSiteMsg(''), 3000);
      setShowSiteForm(false);
    } catch (e: any) {
      setSiteMsg(e?.response?.data?.error || 'Failed to save');
    } finally { setSavingSite(false); }
  };



  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferToUser, setTransferToUser] = useState<{ id: string; firstName: string; lastName: string } | null>(null);
  const [transferring, setTransferring] = useState(false);

  const handleTransferOrganizer = async () => {
    if (!transferToUser) return;
    if (!confirm(`Transfer trip ownership to ${transferToUser.firstName} ${transferToUser.lastName}? You will lose organizer rights.`)) return;
    setTransferring(true);
    try {
      await api.put(`/events/${id}/transfer-organizer`, { newOrganizerId: transferToUser.id });
      addLocalToast(`Ownership transferred to ${transferToUser.firstName}!`, 'success');
      setShowTransferModal(false);
      setTransferToUser(null);
      window.location.reload();
    } catch (err: any) {
      addLocalToast(err.response?.data?.error || 'Failed to transfer ownership', 'error');
    } finally {
      setTransferring(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!confirm('Are you sure you want to delete this event? This action cannot be undone.')) return;
    try {
      await api.delete(`/events/${id}`);
      addLocalToast('Event deleted successfully', 'success');
      navigate('/trips');
    } catch (error: any) {
      addLocalToast(error.response?.data?.error || 'Failed to delete event', 'error');
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
      addLocalToast('✅ Trip completed! Miles have been logged.', 'success');
    } catch (error: any) {
      addLocalToast(error.response?.data?.error || 'Failed to complete trip', 'error');
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
    } catch { addLocalToast('Failed to create album', 'error'); }
  };

  const handleLinkAlbum = async () => {
    if (!selectedAlbumId) return;
    try {
      const { data } = await api.post(`/events/${event.id}/albums/link`, { albumId: selectedAlbumId });
      setTripAlbums(prev => [data, ...prev]);
      setShowAlbumModal(false);
      setSelectedAlbumId('');
    } catch { addLocalToast('Failed to link album', 'error'); }
  };

  const handleUnlinkAlbum = async (albumId: string) => {
    if (!confirm('Remove this album from the trip?')) return;
    try {
      await api.delete(`/events/${event.id}/albums/${albumId}/unlink`);
      setTripAlbums(prev => prev.filter(a => a.id !== albumId));
    } catch { addLocalToast('Failed to unlink album', 'error'); }
  };

  const handleInvite = async () => {
    try {
      await api.post(`/events/${id}/attendees`, { userIds: selectedFriends });
      setShowInviteModal(false);
      setSelectedFriends([]);
      await loadEvent();
      addLocalToast('Invitations sent! 🎉', 'success');
    } catch (error) {
      console.error('Invite error:', error);
      addLocalToast('Failed to send invitations', 'error');
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
      addLocalToast('✅ Added to your Travel Map!', 'success');
    } catch (error: any) {
      if (error.response?.status === 400) {
        addLocalToast('This trip is already on your Travel Map!', 'warning');
      } else {
        addLocalToast('Failed to add to travel map', 'error');
      }
    }
  };

  const handleCopyEvent = async () => {
    if (!copyForm.isWishlist && !copyForm.startDate) {
      addLocalToast('Please set a start date or mark as wishlist', 'warning');
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
      addLocalToast('🎉 Event copied to your events!', 'success');
      navigate(`/events/${data.id}`);
    } catch (error: any) {
      addLocalToast(error.response?.data?.error || 'Failed to copy event', 'error');
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

  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [copyAttendees, setCopyAttendees] = useState(false);
  const [openPhases, setOpenPhases] = useState<Set<string>>(new Set(['plan']));
  // Post-trip survey modal — opened from the Echo NowBar's "How was it?"
  // button, and auto-opened when the URL has ?survey=open (Hitch's 24h
  // follow-up notification deep-links here).
  const [showSurveyModal, setShowSurveyModal] = useState(false);

  // Pulse: state-aware trip lifecycle
  const pulse = useTripState({
    startDate: event?.startDate,
    endDate: event?.endDate,
    campgroundLat: event?.campground?.latitude,
    campgroundLng: event?.campground?.longitude,
    isCheckedIn,
  });

  // Auto-expand the relevant phase based on trip state
  const statePhaseMap: Record<string, string> = {
    'blueprint': 'plan', 'load-out': 'prepare', 'in-motion': 'travel', 'on-site': 'camp', 'echo': 'remember',
  };
  const VISIBLE_PHASES: Record<string, string[]> = {
    'blueprint': ['plan'],
    'load-out': ['plan', 'prepare'],
    'in-motion': ['plan', 'prepare', 'travel'],
    'on-site': ['plan', 'prepare', 'travel', 'camp'],
    'echo': ['plan', 'prepare', 'travel', 'camp', 'remember'],
  };
  const [showAllPhases, setShowAllPhases] = useState(false);
  const userToggledPhases = useRef(false);

  useEffect(() => {
    if (!userToggledPhases.current && pulse.tripState) {
      const phase = statePhaseMap[pulse.tripState];
      if (phase) setOpenPhases(new Set([phase]));
    }
  }, [pulse.tripState]);

  // Auto-open the post-trip survey when Hitch's notification deep-links
  // here with ?survey=open. We wait until the event has loaded so the
  // modal can render the campground name in its header.
  useEffect(() => {
    if (!event?.campground?.id) return;
    const params = new URLSearchParams(location.search);
    if (params.get('survey') === 'open') {
      setShowSurveyModal(true);
    }
  }, [event?.campground?.id, location.search]);

  // Echo NowBar action: open the Remember phase and scroll to it.
  // The Remember phase is the photos/scrapbook section; setting it open
  // also causes the EventAlbum and Trip Albums to render.
  const handleOpenScrapbook = () => {
    userToggledPhases.current = true;
    setOpenPhases((prev) => new Set([...prev, 'remember']));
    // Wait a tick for the phase content to mount, then scroll into view
    setTimeout(() => {
      const el = document.getElementById('phase-remember');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const handleOpenSurvey = () => setShowSurveyModal(true);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div></div>;
  if (!event) return (
    <div className="max-w-4xl mx-auto px-4 py-16 text-center">
      <span className="text-4xl block mb-3">🏕️</span>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Trip not found</h2>
      <p className="text-sm text-gray-500 mb-4">This trip may have been deleted or the link may be incorrect.</p>
      <Link to="/trips" className="text-primary-600 font-semibold hover:underline">Browse your trips →</Link>
    </div>
  );

  const isOrganizer = user?.id === event.organizerId;

  const handleDuplicate = async () => {
    setDuplicating(true);
    try {
      const { data } = await api.post(`/events/${event.id}/duplicate`, { copyAttendees });
      setShowDuplicateModal(false);
      navigate(`/trips/${data.event.id}`);
    } catch (e: any) {
      addLocalToast(e.response?.data?.error || 'Failed to duplicate trip', 'error');
    } finally {
      setDuplicating(false);
    }
  };
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
      addLocalToast('Failed to upload banner image', 'error');
    } finally {
      setUploadingBanner(false);
    }
  };

  const exportToCalendar = () => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const toICS = (d: Date) =>
      d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) +
      'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z';

    const start = new Date(event.startDate);
    const end = event.endDate ? new Date(event.endDate) : new Date(event.startDate);
    // For all-day events, end date in .ics must be the day AFTER
    end.setDate(end.getDate() + 1);

    const location = [
      event.campground?.name,
      event.campground?.location,
      event.campground?.state,
    ].filter(Boolean).join(', ') || event.location || '';

    const description = [
      event.description || '',
      event.campground ? `Campground: ${event.campground.name}` : '',
      `Organized by ${event.organizer?.firstName || 'RVUnicorn'}`,
      `View trip: ${window.location.href}`,
    ].filter(Boolean).join('\n');

    const uid = `rvunicorn-${event.id}@rvunicorn.com`;
    const now = toICS(new Date());

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//RVUnicorn//Trip Export//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${start.getUTCFullYear()}${pad(start.getUTCMonth()+1)}${pad(start.getUTCDate())}`,
      `DTEND;VALUE=DATE:${end.getUTCFullYear()}${pad(end.getUTCMonth()+1)}${pad(end.getUTCDate())}`,
      `SUMMARY:${event.title}`,
      location ? `LOCATION:${location.split(',').join('\\,')}` : '',
      `DESCRIPTION:${description.split(String.fromCharCode(10)).join('\\n').split(',').join('\\,')}`,
      'BEGIN:VALARM',
      'TRIGGER:-P1D',
      'ACTION:DISPLAY',
      `DESCRIPTION:Reminder: ${event.title} starts tomorrow!`,
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean).join('\r\n');

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const daysUntil = getDaysUntilEvent();

  const togglePhase = (id: string) => { userToggledPhases.current = true; setOpenPhases(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  }); };

  return (
    <div>
      {/* Pulse NowBar */}
      {event && (
        <NowBar
          tripState={pulse.tripState}
          stateLabel={pulse.stateLabel}
          stateEmoji={pulse.stateEmoji}
          stateColor={pulse.stateColor}
          daysUntilTrip={pulse.daysUntilTrip}
          hoursUntilTrip={pulse.hoursUntilTrip}
          distanceMiles={pulse.distanceMiles}
          eventTitle={event.title}
          campgroundName={event.campground?.name}
          attendeeCount={event.attendees?.length || 0}
          photoCount={tripAlbums.reduce((sum: number, a: any) => sum + (a._count?.photos || 0), 0)}
          mealCount={event._count?.meals || 0}
          onOpenScrapbook={handleOpenScrapbook}
          onOpenSurvey={event.campground?.id ? handleOpenSurvey : undefined}
        />
      )}
      {event?.campground?.id && (
        <TripStaySurveyModal
          open={showSurveyModal}
          onClose={() => setShowSurveyModal(false)}
          campgroundId={event.campground.id}
          campgroundName={event.campground.name}
          visitDate={event.endDate || event.startDate}
        />
      )}
      <div className="max-w-7xl mx-auto px-4 py-8">
      {/* ═══ TRIP OVERVIEW CARD (single source of truth) ═══ */}
      {event && (
        <div className="mb-4 rounded-xl overflow-hidden" style={{ background: '#1B2B4B', borderLeft: '3px solid #C9A84C' }}>
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: '#F5F0E8' }}>
                <span>🚐</span>
                <span>{event.location || event.campground?.name ? `${tripPlan?.startLocation || 'Home'} → ${event.campground?.name || event.location || 'Destination'}` : event.title}</span>
              </div>
              {isOrganizer && (
                <button onClick={() => setShowTripModal(true)} className="text-xs px-2 py-0.5 rounded" style={{ color: '#C9A84C', border: '1px solid rgba(201,168,76,0.3)' }}>Edit</button>
              )}
            </div>
            <div className="flex flex-wrap gap-3 mt-1 text-xs" style={{ color: 'rgba(245,240,232,0.5)' }}>
              {event.startDate && (
                <span>📅 {new Date(String(event.startDate)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{event.endDate ? `–${new Date(String(event.endDate)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}</span>
              )}
              <span>📍 {tripPlan?.pitStops?.length || 0} stop{(tripPlan?.pitStops?.length || 0) !== 1 ? 's' : ''}</span>
              {tripPlan?.distanceMiles && <span>🛣 {tripPlan.distanceMiles} mi</span>}
              {tripPlan?.durationMinutes && <span>⏱ {Math.floor(tripPlan.durationMinutes / 60)}h {tripPlan.durationMinutes % 60}m</span>}
            </div>
          </div>
        </div>
      )}

      {/* Road Trip Banner */}
      {event.roadTrip && (
        <div className="mb-4 rounded-xl overflow-hidden shadow-md">
          <div className="px-4 py-3 flex items-center justify-between text-white text-sm font-semibold"
            style={{ background: 'linear-gradient(135deg, ' + event.roadTrip.color + ', ' + event.roadTrip.color + 'cc)' }}>
          <div className="flex items-center gap-2">
            <span>🗺️</span>
            <span>Part of <span className="underline">{event.roadTrip.title}</span></span>
            {event.stopNumber && event.roadTrip._count && (
              <span className="opacity-80">· Stop {event.stopNumber} of {event.roadTrip._count.stops}</span>
            )}
          </div>
          <a href={`/road-trips/${event.roadTrip.id}`}
            className="text-white/90 hover:text-white text-xs border border-white/30 px-3 py-1 rounded-lg hover:bg-white/10 transition">
            View Road Trip →
          </a>
          </div>
          {/* Inline stop list in banner */}
          {event.roadTrip.stops && event.roadTrip.stops.length > 1 && (
            <div className="flex overflow-x-auto scrollbar-hide px-3 py-2 gap-2 bg-black/20">
              {event.roadTrip.stops.map((stop: any, i: number) => (
                <a key={stop.id} href={'/trips/' + stop.id}
                  className={'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ' +
                    (stop.id === event.id ? 'bg-white text-gray-900' : 'bg-white/20 text-white hover:bg-white/30')}>
                  <span className="w-4 h-4 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: stop.id === event.id ? event.roadTrip.color : 'transparent', border: stop.id === event.id ? 'none' : '1px solid white' }}>
                    {stop.stopNumber || i + 1}
                  </span>
                  {stop.campground?.name?.split(' ').slice(0, 2).join(' ') || stop.title?.split(' ')[0]}
                  {stop.startDate && <span className="opacity-70 ml-1">{new Date(stop.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                </a>
              ))}
            </div>
          )}
        </div>
      )}
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
                {event.campground?.id ? (
                  <Link to={`/campgrounds/${event.campground.id}`} className="hover:text-primary-600 hover:underline transition">{event.title}</Link>
                ) : (
                  event.title
                )}
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

              {/* Weather strip */}
              {event.campground?.latitude && event.campground?.longitude && (
                <div className="mt-4">
                  <EventWeatherStrip
                    latitude={event.campground.latitude}
                    longitude={event.campground.longitude}
                    startDate={event.startDate}
                    endDate={event.endDate || event.startDate}
                  />
                </div>
              )}

              {/* Camp Market at destination */}
              {event.campground?.id && (
                <div className="mt-4">
                  <CampfireTips campgroundId={event.campground.id} tripId={event.id} campgroundName={event.campground.name} compact />
                  <CampMarket campgroundId={event.campground.id} compact />
                </div>
              )}

              {/* Campground Presence Map */}
              {event.campground?.id && (
                <div className="mt-4">
                  <details className="group">
                    <summary className="flex items-center gap-2 cursor-pointer list-none text-sm font-bold text-gray-900 mb-2">
                      <span>🏕️ Presence Map</span>
                      <span className="text-xs text-gray-400 font-normal group-open:hidden">Tap to expand</span>
                    </summary>
                    <EventCampgroundMap eventId={event.id} campgroundName={event.campground.name} />
                  </details>
                </div>
              )}

              {/* Attendee RV strip — compact, above tabs — household members share one card */}
              {event.organizer && (() => {
                // Build combined list: organizer + attendees (deduplicated)
                const organizerEntry = { id: 'organizer', user: event.organizer, status: 'ATTENDING' };
                const attendeeList = event.attendees || [];
                const allEntries = [organizerEntry, ...attendeeList];
                const active = allEntries.filter((a: any) =>
                  !['invited','INVITED','not_going','NOT_GOING'].includes(a.status) &&
                  a.user?.id !== undefined
                ).filter((a: any, idx: number, arr: any[]) =>
                  arr.findIndex(b => b.user?.id === a.user?.id) === idx
                );
                // Group by householdId — household members share one card
                const seen = new Set<string>();
                const groups: any[][] = [];
                active.forEach((a: any) => {
                  const u = a.user;
                  if (!u || seen.has(u.id)) return;
                  seen.add(u.id);
                  if (u.householdId) {
                    const partner = active.find((b: any) => b.user?.householdId === u.householdId && b.user?.id !== u.id);
                    if (partner && !seen.has(partner.user.id)) {
                      seen.add(partner.user.id);
                      groups.push([a, partner]);
                      return;
                    }
                  }
                  groups.push([a]);
                });
                return (
                  <div className="mt-4 flex items-center gap-3 flex-wrap">
                    {groups.map((group, gi) => {
                      const users = group.map(a => a.user);
                      const u = users[0];
                      const isHousehold = users.length > 1;
                      const rvLabel = [u.rvYear, u.rvMake, u.rvModel].filter(Boolean).join(' ');
                      const rvPhoto = u.rvShowcase?.photos?.[0] || u.rvPhotoUrl || null;
                      return (
                        <div key={gi} className="flex flex-col bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition" style={{ minWidth: '140px' }}>
                          {/* RV photo */}
                          <div className="relative block">
                            {rvPhoto
                              ? <img src={rvPhoto} alt={rvLabel} className="w-full h-24 object-cover" />
                              : <div className="w-full h-24 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-4xl">🚐</div>
                            }
                            {/* Household badge */}
                            {isHousehold && (
                              <span className="absolute top-1.5 right-1.5 bg-orange-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">🏕️ Household</span>
                            )}
                          </div>
                          {/* Profile info */}
                          <div className="flex items-center gap-2 px-2.5 py-2">
                            {/* Overlapping profile pics for household */}
                            <div className={`flex flex-shrink-0 ${isHousehold ? '-space-x-2' : ''}`}>
                              {users.map(u2 => (
                                <Link key={u2.id} to={'/profile/' + u2.username}>
                                  {u2.profilePicture
                                    ? <img src={u2.profilePicture} alt="" className="w-7 h-7 rounded-full object-cover border-2 border-white shadow-sm" />
                                    : <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-xs font-bold border-2 border-white">{u2.firstName?.[0]}</div>
                                  }
                                </Link>
                              ))}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-gray-900 truncate">
                                {isHousehold ? users.map(u2 => u2.firstName).join(' & ') : `${u.firstName} ${u.lastName}`}
                              </p>
                              {rvLabel && <p className="text-xs text-gray-400 truncate">{rvLabel}</p>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()} 
            </div>
            <div className="flex gap-2">
              {!isOrganizer && user && (
                <button onClick={() => { setCopyForm({ startDate: '', endDate: '', isWishlist: false, copyMealPlan: true }); setShowCopyModal(true); }} className="btn btn-secondary btn-sm flex items-center gap-2">
                  <Copy className="w-4 h-4" />Copy Event
                </button>
              )}
              {isOrganizer && <button onClick={() => setShowInviteModal(true)} className="btn btn-secondary btn-sm flex items-center gap-2"><UserPlus className="w-4 h-4" />{isPastTrip ? 'Tag People' : 'Invite'}</button>}
              {isOrganizer && <Link to={`/trips/${event.id}/edit`} className="btn btn-primary btn-sm flex items-center gap-2"><Edit className="w-4 h-4" />Edit Event</Link>}
              <button onClick={exportToCalendar} className="btn btn-secondary btn-sm flex items-center gap-2" title="Export to Apple/Google Calendar"><CalendarDays className="w-4 h-4" />Add to Calendar</button>
              {isOrganizer && <button onClick={handleDeleteEvent} className="btn btn-sm flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white"><Trash2 className="w-4 h-4" />Delete</button>}
              {isOrganizer && <button onClick={() => setShowDuplicateModal(true)} className="btn btn-sm flex items-center gap-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"><Copy className="w-4 h-4" />Duplicate</button>}
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

      <div className="space-y-3 mb-6">
        {[
          { id: 'plan',     emoji: '🗺️', label: 'Plan',    desc: 'Campground, dates, route, attendees',  bg: '#EAF3DE', color: '#3B6D11' },
          { id: 'travel',   emoji: '🚐', label: 'Travel',  desc: 'Route, drive time, gas stops',          bg: '#FAEEDA', color: '#854F0B' },
          { id: 'prepare',  emoji: '🎒', label: 'Prepare', desc: 'Pack list, supply list, meals',         bg: '#E6F1FB', color: '#185FA5' },
          { id: 'camp',     emoji: '🔥', label: 'Camp',    desc: 'Schedule, activities, pack up',         bg: '#E1F5EE', color: '#0F6E56' },
          { id: 'remember', emoji: '📸', label: 'Remember',desc: 'Photos, scrapbook, trip story',         bg: '#FBEAF0', color: '#993556' },
        ].filter(phase => showAllPhases || (VISIBLE_PHASES[pulse.tripState] || VISIBLE_PHASES['echo']).includes(phase.id)).map(phase => (
          <div key={phase.id} id={`phase-${phase.id}`} className={`bg-white rounded-xl border overflow-hidden shadow-sm transition scroll-mt-32 ${
            statePhaseMap[pulse.tripState] === phase.id ? 'border-emerald-400 ring-1 ring-emerald-200' : 'border-gray-200'
          }`}>
            <button onClick={() => togglePhase(phase.id)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition text-left">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 relative" style={{ background: phase.bg }}>
                  <span style={{ color: phase.color }}>{phase.emoji}</span>
                  {statePhaseMap[pulse.tripState] === phase.id && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white animate-pulse" />
                  )}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{phase.label}</p>
                  <p className="text-xs text-gray-500">{phase.desc}</p>
                </div>
              </div>
              <span className="text-gray-400 text-xs ml-4">{openPhases.has(phase.id) ? '▲' : '▼'}</span>
            </button>
            {openPhases.has(phase.id) && (
              <div className="border-t border-gray-100 p-5 bg-gray-50/30 space-y-6">
          {openPhases.has(phase.id) && phase.id === 'plan' && (
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

              {/* Road Trip Section */}
              {isOrganizer && !event.roadTrip && (
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-4 border border-slate-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-white flex items-center gap-2">🚐 Planning Multiple Stops?</h4>
                      <p className="text-sm text-slate-400 mt-0.5">Chain multiple campground stops into one epic journey</p>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          const { data: rt } = await api.post('/road-trips', {
                            title: event.title + ' Road Trip',
                            color: '#f97316',
                            font: 'playfair',
                          });
                          await api.post('/road-trips/' + rt.id + '/stops', { eventId: event.id });
                          window.location.href = '/road-trips/' + rt.id;
                        } catch (e) { addLocalToast('Failed to create road trip', 'error'); }
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-400 text-white text-sm font-bold rounded-xl hover:opacity-90 transition shadow-lg whitespace-nowrap"
                    >
                      ➕ Add More Campground Stops
                    </button>
                  </div>
                </div>
              )}

              {/* Road Trip stops display */}
              {event.roadTrip && event.roadTrip.stops && event.roadTrip.stops.length >= 1 && (
                <div className="rounded-xl overflow-hidden border border-gray-200">
                  <div className="px-4 py-3 flex items-center justify-between"
                    style={{ backgroundColor: event.roadTrip.color + '15', borderBottom: '1px solid ' + event.roadTrip.color + '30' }}>
                    <h4 className="font-bold text-gray-900 flex items-center gap-2">
                      🗺️ {event.roadTrip.title}
                    </h4>
                    <a href={'/road-trips/' + event.roadTrip.id}
                      className="text-xs font-semibold hover:underline" style={{ color: event.roadTrip.color }}>
                      Manage Road Trip →
                    </a>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {event.roadTrip.stops.map((stop: any, i: number) => (
                      <a key={stop.id} href={'/trips/' + stop.id}
                        className={'flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition ' + (stop.id === event.id ? 'bg-orange-50' : '')}>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: event.roadTrip.color }}>
                          {stop.stopNumber || i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={'text-sm font-semibold truncate ' + (stop.id === event.id ? 'text-orange-700' : 'text-gray-900')}>
                            {stop.id === event.id ? '📍 ' : ''}{stop.campground?.name || stop.title}
                          </p>
                          {stop.campground?.city && (
                            <p className="text-xs text-gray-400">{stop.campground.city}, {stop.campground.state}</p>
                          )}
                        </div>
                        {stop.startDate && (
                          <p className="text-xs text-gray-400 flex-shrink-0">
                            {new Date(stop.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                        )}
                        {stop.id === event.id && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white flex-shrink-0"
                            style={{ backgroundColor: event.roadTrip.color }}>You are here</span>
                        )}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {event.description && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">📝 About This Event</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{event.description}</p>
                </div>
              )}

              {/* My Campsite Details */}
              {(userAttendee || isOrganizer) && (
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">⛺</span>
                      <h3 className="text-base font-bold text-gray-900">My Campsite Details</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                        {siteForm.siteVisibility === 'PRIVATE' ? '🔒 Only me' : siteForm.siteVisibility === 'EVENT' ? '👥 Event members' : '👫 Friends'}
                      </span>
                    </div>
                    <button onClick={() => setShowSiteForm(!showSiteForm)}
                      className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                      {showSiteForm ? 'Cancel' : (siteForm.siteNumber || siteForm.confirmationNumber) ? 'Edit' : '+ Add Details'}
                    </button>
                  </div>

                  {/* Display saved info */}
                  {!showSiteForm && (siteForm.siteNumber || siteForm.confirmationNumber || siteForm.notes) && (
                    <div className="space-y-1.5">
                      {siteForm.siteNumber && <p className="text-sm text-gray-700">🏕️ Site: <span className="font-semibold">{siteForm.siteNumber}</span></p>}
                      {siteForm.confirmationNumber && <p className="text-sm text-gray-700">🎫 Confirmation: <span className="font-semibold">{siteForm.confirmationNumber}</span></p>}
                      {siteForm.notes && <p className="text-sm text-gray-600 italic">{siteForm.notes}</p>}
                    </div>
                  )}
                  {!showSiteForm && !siteForm.siteNumber && !siteForm.confirmationNumber && !siteForm.notes && (
                    <p className="text-sm text-gray-400">No campsite details added yet</p>
                  )}

                  {/* Edit form */}
                  {showSiteForm && (
                    <div className="space-y-3 mt-2">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-gray-600 mb-1 block">Site / Spot #</label>
                          <input type="text" placeholder="e.g. A42" value={siteForm.siteNumber}
                            onChange={e => setSiteForm(f => ({...f, siteNumber: e.target.value}))}
                            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-600 mb-1 block">Confirmation #</label>
                          <input type="text" placeholder="e.g. RES12345" value={siteForm.confirmationNumber}
                            onChange={e => setSiteForm(f => ({...f, confirmationNumber: e.target.value}))}
                            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 mb-1 block">Notes</label>
                        <textarea placeholder="Access code, check-in instructions, etc." value={siteForm.notes}
                          onChange={e => setSiteForm(f => ({...f, notes: e.target.value}))}
                          rows={2} className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm resize-none" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 mb-1 block">🔒 Who can see this?</label>
                        <select value={siteForm.siteVisibility} onChange={e => setSiteForm(f => ({...f, siteVisibility: e.target.value}))}
                          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm">
                          <option value="PRIVATE">🔒 Only me</option>
                          <option value="EVENT">👥 Everyone in this event</option>
                          <option value="FRIENDS">👫 My friends</option>
                        </select>
                      </div>
                      {siteMsg && <p className="text-sm text-green-600 font-medium">{siteMsg}</p>}
                      <button onClick={saveSiteDetails} disabled={savingSite}
                        className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2.5 rounded-xl transition disabled:opacity-50">
                        {savingSite ? 'Saving...' : 'Save Campsite Details'}
                      </button>
                    </div>
                  )}
                </div>
              )}


              {/* Who's Coming moved to header above tabs */}
              {false && event.attendees && event.attendees.length > 0 && (() => {
                const active = event.attendees.filter((a: any) => !['invited','INVITED','not_going','NOT_GOING'].includes(a.status));
                if (active.length === 0) return null;
                return (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                      <h3 className="font-bold text-gray-900">👥 Who's Coming</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">{active.filter((a: any) => ['going','ATTENDING'].includes(a.status)).length} confirmed</span>
                        {isOrganizer && <button onClick={() => setShowInviteModal(true)} className="text-xs text-primary-600 hover:underline font-medium">{isPastTrip ? 'Tag People' : '+ Invite'}</button>}
                      </div>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {active.map((a: any) => {
                        const u = a.user;
                        if (!u) return null;
                        const rvLabel = [u.rvYear, u.rvMake, u.rvModel].filter(Boolean).join(' ');
                        const rvPhoto = u.rvShowcase?.photos?.[0] || u.rvPhotoUrl || null;
                        const isOrg = a.userId === event.organizerId;
                        return (
                          <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                            {/* Profile pic */}
                            <Link to={'/profile/' + u.username} className="flex-shrink-0">
                              {u.profilePicture
                                ? <img src={u.profilePicture} alt="" className="w-9 h-9 rounded-full object-cover" />
                                : <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold">{u.firstName?.[0]}</div>
                              }
                            </Link>
                            {/* Name + RV info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Link to={'/profile/' + u.username} className="text-sm font-semibold text-gray-900 hover:underline">{u.firstName} {u.lastName}</Link>
                                {isOrg && <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">Organizer</span>}
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${['going','ATTENDING'].includes(a.status) ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                  {['going','ATTENDING'].includes(a.status) ? '✓ Going' : '? Maybe'}
                                </span>
                              </div>
                              {rvLabel && (
                                <div className="flex items-center gap-2 mt-1">
                                  <p className="text-xs text-gray-500">🚐 {rvLabel}{u.rvMpg ? ' · ' + u.rvMpg + ' MPG' : ''}</p>
                                </div>
                              )}
                              {(rvPhoto || rvLabel) && (
                                <Link to={'/profile/' + u.username + '#my-rv'} title={"View " + u.firstName + "'s RV"} className="inline-block mt-1.5">
                                  {rvPhoto
                                    ? <img src={rvPhoto} alt={rvLabel} className="w-32 h-20 rounded-xl object-cover border border-gray-200 hover:border-primary-400 hover:shadow-md transition" />
                                    : <div className="w-32 h-20 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex flex-col items-center justify-center border border-gray-200 hover:border-primary-400 transition gap-1">
                                        <span className="text-3xl">🚐</span>
                                        <span className="text-xs text-gray-400">View RV</span>
                                      </div>
                                  }
                                </Link>
                              )}
                            </div>
                            {a.siteVisibility === 'EVENT' && (a.siteNumber || a.confirmationNumber) && a.userId !== user?.id && (
                              <div className="mt-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs text-amber-800 w-full">
                                {a.siteNumber && <p>🏕️ Site: <span className="font-semibold">{a.siteNumber}</span></p>}
                                {a.confirmationNumber && <p>🎫 Conf: <span className="font-semibold">{a.confirmationNumber}</span></p>}
                              </div>
                            )}
                            {isOrganizer && a.userId !== event.organizerId && (
                              <button onClick={() => handleRemoveAttendee(a.id)} className="text-gray-300 hover:text-red-400 transition text-xs flex-shrink-0">✕</button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

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

{/* Old attendees section removed — consolidated into Who's Coming above */}
{/* Things to Do Nearby moved out — now rendered as a standalone section
    BELOW the entire phase list so Travel/Prepare/Camp/Remember sit above it */}
            </div>
          )}

          {openPhases.has(phase.id) && phase.id === 'travel' && (
            <div className="space-y-4">
              <TripPlannerTab
                plannerFrom={plannerFrom || undefined}
                plannerTo={plannerTo || undefined}
                eventId={id}
                tripEventId={id}
                eventTitle={event?.title}
                homeLocation={userHomeLocation || ''}
                campground={event?.campground}
                eventLocation={event?.location || event?.locationName}
                arrivalDate={event?.startDate ? new Date(event.startDate).toISOString().split('T')[0] : undefined}
                eventStartDate={event?.startDate}
                eventEndDate={event?.endDate}
                tripPlan={tripPlan}
                tripLoading={tripLoading}
                onEditTrip={openTripModal}
                onReload={async () => { await loadEvent(); await loadTripPlan(); }}
                rvFuelType={(user as any)?.rvFuelType || 'gas'}
                rvMpg={(user as any)?.rvMpg}
                rvFuelGal={(user as any)?.rvFuelGal}
                rvLength={(user as any)?.rvLength}
                rvType={(user as any)?.rvType}
              />
              {/* ═══ TRIP SUMMARY CARD ═══ */}
              {tripPlan && (
                <SmartTripSummary
                  tripPlanId={tripPlan.id}
                  refreshKey={summaryRefreshKey}
                  onSetMpg={() => {
                    const el = document.getElementById('trip-planner-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                />
              )}

              {/* ═══ JOURNEY TIMELINE ═══ */}
              {tripPlan && (
              <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
                <h4 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
                  <Navigation className="w-5 h-5" /> Trip Itinerary
                </h4>
                <div className="space-y-0">
                  {/* START */}
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-9 h-9 rounded-full bg-blue-100 border-2 border-blue-400 flex items-center justify-center">🏠</div>
                      <div className="w-0.5 flex-1 bg-gray-200 my-1" />
                    </div>
                    <div className="flex-1 pb-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 mb-0.5">Start</p>
                      <p className="font-semibold text-gray-900 text-sm">{tripPlan.startLocation || userHomeLocation || 'Home'}</p>
                      {event.startDate && <p className="text-xs text-gray-400">{new Date(String(event.startDate)).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>}
                    </div>
                  </div>

                  {/* Smart Connector after START (leg 0) */}
                  {legSuggestions.length > 0 && legSuggestions[0] ? (
                    <SmartConnector
                      tripPlanId={tripPlan.id}
                      leg={legSuggestions[0]}
                      onAddStop={handleAddSuggestionToTrip}
                      onDismiss={handleDismissSuggestion}
                      onManualAdd={() => setShowPitStopModal(true)}
                    />
                  ) : (
                    <InlineAddStop
                      tripPlanId={tripPlan.id}
                      legIndex={0}
                      leg={tripSummaryLegs[0] || null}
                      onManualAdd={() => setShowPitStopModal(true)}
                    />
                  )}

                  {/* PIT STOPS with Smart Connectors */}
                  {tripPlan.pitStops?.filter((stop: any) => stop.id !== removedStopId).map((stop: any, stopIdx: number) => {
                    const hasCampground = stop.campgroundId || stop.stopType === 'CAMPGROUND';
                    const si = hasCampground
                      ? { emoji: '🏕️', label: 'Campground' }
                      : (STOP_TYPES.find((s: any) => s.id === stop.stopType) || STOP_TYPES[STOP_TYPES.length - 1]);
                    // Per-type icon colors
                    const iconStyles: Record<string, string> = {
                      CAMPGROUND: 'bg-green-100 border-green-400',
                      OVERNIGHT: 'bg-amber-100 border-amber-400',
                      GAS: 'bg-yellow-100 border-yellow-400',
                      FOOD: 'bg-orange-100 border-orange-400',
                      LUNCH: 'bg-orange-100 border-orange-400',
                      SNACK: 'bg-orange-100 border-orange-400',
                      RELAX: 'bg-teal-100 border-teal-400',
                      WALK: 'bg-teal-100 border-teal-400',
                      PLAY: 'bg-purple-100 border-purple-400',
                      DOG: 'bg-amber-100 border-amber-400',
                      NAP: 'bg-slate-100 border-slate-400',
                      REPAIR: 'bg-red-100 border-red-400',
                    };
                    const labelColors: Record<string, string> = {
                      CAMPGROUND: 'text-green-600',
                      OVERNIGHT: 'text-amber-600',
                      GAS: 'text-yellow-700',
                      FOOD: 'text-orange-600', LUNCH: 'text-orange-600', SNACK: 'text-orange-600',
                      RELAX: 'text-teal-600', WALK: 'text-teal-600',
                      PLAY: 'text-purple-600',
                      DOG: 'text-amber-700',
                      NAP: 'text-slate-600',
                      REPAIR: 'text-red-600',
                    };
                    const stopKey = hasCampground ? 'CAMPGROUND' : (stop.stopType || 'OTHER');
                    const iconStyle = iconStyles[stopKey] || 'bg-amber-50 border-amber-300';
                    const labelColor = labelColors[stopKey] || 'text-amber-600';
                    // Smart duration display
                    const isOvernight = ['CAMPGROUND', 'OVERNIGHT'].includes(stopKey);
                    const formatShortDate = (d: string | Date) => {
                      const date = new Date(d);
                      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    };
                    const overnightNights = stop.estimatedArrival && stop.departureDate
                      ? Math.max(1, Math.round((new Date(stop.departureDate).getTime() - new Date(stop.estimatedArrival).getTime()) / 86400000))
                      : (stop.estimatedDuration && stop.estimatedDuration >= 720 ? Math.round(stop.estimatedDuration / 720) : null);
                    const overnightText = isOvernight
                      ? (stop.estimatedArrival && stop.departureDate
                        ? `Arrive ${formatShortDate(stop.estimatedArrival)} · Leave ${formatShortDate(stop.departureDate)} · ${overnightNights} night${overnightNights !== 1 ? 's' : ''}`
                        : (overnightNights ? `${overnightNights} night${overnightNights !== 1 ? 's' : ''}` : null))
                      : null;
                    const durationText = isOvernight
                      ? overnightText
                      : (stop.estimatedDuration ? (stop.estimatedDuration >= 60 ? `${Math.round(stop.estimatedDuration / 60)} hr${Math.round(stop.estimatedDuration / 60) > 1 ? 's' : ''}` : `${stop.estimatedDuration} min`) : null);
                    // The leg after this stop is at legIndex = stopIdx + 1
                    const nextLeg = legSuggestions.find((l: any) => l.legIndex === stopIdx + 1);
                    // Build address lines from related overnightStop/campground or fall back to stop.location
                    const related = stop.overnightStop || stop.campground;
                    const addressLine1 = related?.address || related?.location || null;
                    const relatedZip = related?.zip || related?.zipCode || null;
                    const cityStateZip = related
                      ? `${related.city || ''}${related.state ? `, ${related.state}` : ''}${relatedZip ? ` ${relatedZip}` : ''}`.trim()
                      : null;
                    const fallbackLocation = !related ? stop.location : null;
                    return (
                      <div key={stop.id}>
                        <div className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className={`w-9 h-9 rounded-full border-2 flex items-center justify-center ${iconStyle}`}>{si.emoji}</div>
                            <div className="w-0.5 flex-1 bg-gray-200 my-1" />
                          </div>
                          <div className="flex-1 pb-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className={`text-[10px] font-bold uppercase tracking-wider ${labelColor} mb-0.5`}>{si.label}</p>
                                <p className="font-semibold text-gray-900 text-sm">{stop.name || 'Unnamed stop'}</p>
                                {addressLine1 && <p className="text-xs text-gray-400">{addressLine1}</p>}
                                {cityStateZip && <p className="text-xs text-gray-400">{cityStateZip}</p>}
                                {fallbackLocation && <p className="text-xs text-gray-400">{fallbackLocation}</p>}
                                {durationText && <p className="text-xs text-gray-400">⏱ {durationText}</p>}
                                {!stop.name && <p className="text-xs text-amber-500 mt-0.5">Tap to add location details</p>}
                              </div>
                              <button
                                onClick={() => handleDeletePitStop(stop.id)}
                                className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1.5 rounded-lg transition flex-shrink-0"
                                title="Remove this stop"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Remove
                              </button>
                            </div>
                          </div>
                        </div>
                        {/* Smart Connector after this stop */}
                        {nextLeg ? (
                          <SmartConnector
                            tripPlanId={tripPlan.id}
                            leg={nextLeg}
                            onAddStop={handleAddSuggestionToTrip}
                            onDismiss={handleDismissSuggestion}
                            onManualAdd={() => setShowPitStopModal(true)}
                          />
                        ) : (
                          <InlineAddStop
                            tripPlanId={tripPlan.id}
                            legIndex={stopIdx + 1}
                            leg={tripSummaryLegs[stopIdx + 1] || null}
                            onManualAdd={() => setShowPitStopModal(true)}
                          />
                        )}
                      </div>
                    );
                  })}

                  {/* Undo bar — shown when a stop is being removed */}
                  {removedStopId && (
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center"><div className="w-0.5 flex-1 bg-gray-200" /></div>
                      <div className="flex-1 py-1">
                        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                          <span className="text-xs text-amber-700">Stop removed</span>
                          <button
                            onClick={handleUndoRemove}
                            className="text-xs font-semibold text-amber-700 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 px-3 py-1 rounded-lg transition"
                          >
                            Undo
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* DESTINATION */}
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-9 h-9 rounded-full bg-green-100 border-2 border-green-400 flex items-center justify-center">🎯</div>
                    </div>
                    <div className="flex-1 pt-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-green-600 mb-0.5">Destination</p>
                      <p className="font-semibold text-gray-900 text-sm">{tripPlan.endLocation || event.location || 'Destination'}</p>
                      {event.endDate && <p className="text-xs text-gray-400">Arriving {new Date(String(event.endDate)).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>}
                    </div>
                  </div>
                </div>
              </div>
              )}


              {/* Trip Cost Estimator now lives inside TripPlannerTab, auto-populated from itinerary */}
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

                    {/* ═══ JOURNEY TIMELINE ═══ */}
                    <div className="border-t pt-4">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                          <Navigation className="w-5 h-5" />
                          Journey Timeline
                        </h4>
                        <button onClick={() => setShowPitStopModal(true)} className="btn btn-secondary btn-sm flex items-center gap-1">
                          <Plus className="w-4 h-4" />Add Stop
                        </button>
                      </div>

                      <div className="space-y-0">
                        {/* START */}
                        <div className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className="w-10 h-10 rounded-full bg-blue-100 border-2 border-blue-400 flex items-center justify-center text-lg">🏠</div>
                            <div className="w-0.5 flex-1 bg-gray-200 my-1" />
                          </div>
                          <div className="flex-1 pb-3">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 mb-0.5">Start</p>
                            <p className="font-semibold text-gray-900">{tripPlan.startLocation || event.location || 'Home'}</p>
                            {event.startDate && <p className="text-xs text-gray-500">{new Date(event.startDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>}
                          </div>
                        </div>

                        {/* + Add Stop Here (before first stop) */}
                        <div className="flex gap-3">
                          <div className="flex flex-col items-center"><div className="w-0.5 flex-1 bg-gray-200" /></div>
                          <div className="flex-1 py-1">
                            <button onClick={() => setShowPitStopModal(true)} className="text-xs text-primary-500 hover:text-primary-700 border border-dashed border-primary-200 px-3 py-1.5 rounded-lg hover:bg-primary-50 transition w-full text-center">
                              + Add Stop Here
                            </button>
                          </div>
                        </div>

                        {/* STOPS */}
                        {tripPlan.pitStops && tripPlan.pitStops.map((stop: PitStop, index: number) => {
                          const stopInfo = getStopTypeInfo(stop.stopType);
                          return (
                            <div key={stop.id}>
                              <div className="flex gap-3">
                                <div className="flex flex-col items-center">
                                  <div className="w-10 h-10 rounded-full bg-amber-50 border-2 border-amber-300 flex items-center justify-center text-lg">{stopInfo.emoji}</div>
                                  <div className="w-0.5 flex-1 bg-gray-200 my-1" />
                                </div>
                                <div className="flex-1 pb-2">
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-0.5">{stopInfo.label}</p>
                                      <p className="font-semibold text-gray-900">{stop.name}</p>
                                      {stop.location && <p className="text-xs text-gray-500">📍 {stop.location}</p>}
                                      <div className="flex gap-2 mt-1 text-xs text-gray-400">
                                        {stop.estimatedDuration && <span>⏱ {stop.estimatedDuration > 60 ? `${Math.round(stop.estimatedDuration / 60)} hrs` : `${stop.estimatedDuration} min`}</span>}
                                        {stop.notes && <span>📝 {stop.notes}</span>}
                                      </div>
                                    </div>
                                    <button onClick={() => handleDeletePitStop(stop.id)} className="text-gray-300 hover:text-red-500 p-1 transition" title="Remove stop">
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                              {/* + Add Stop Here (after this stop) */}
                              <div className="flex gap-3">
                                <div className="flex flex-col items-center"><div className="w-0.5 flex-1 bg-gray-200" /></div>
                                <div className="flex-1 py-1">
                                  <button onClick={() => setShowPitStopModal(true)} className="text-xs text-primary-500 hover:text-primary-700 border border-dashed border-primary-200 px-3 py-1.5 rounded-lg hover:bg-primary-50 transition w-full text-center">
                                    + Add Stop Here
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {/* No stops message */}
                        {(!tripPlan.pitStops || tripPlan.pitStops.length === 0) && (
                          <div className="flex gap-3">
                            <div className="flex flex-col items-center"><div className="w-0.5 flex-1 bg-gray-200" /></div>
                            <div className="flex-1 py-3 text-center">
                              <p className="text-xs text-gray-400 italic">No stops planned yet</p>
                            </div>
                          </div>
                        )}

                        {/* + Add Stop Here (before destination) */}
                        <div className="flex gap-3">
                          <div className="flex flex-col items-center"><div className="w-0.5 flex-1 bg-gray-200" /></div>
                          <div className="flex-1 py-1">
                            <button onClick={() => setShowPitStopModal(true)} className="text-xs text-primary-500 hover:text-primary-700 border border-dashed border-primary-200 px-3 py-1.5 rounded-lg hover:bg-primary-50 transition w-full text-center">
                              + Add Stop Here
                            </button>
                          </div>
                        </div>

                        {/* DESTINATION */}
                        <div className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className="w-10 h-10 rounded-full bg-green-100 border-2 border-green-400 flex items-center justify-center text-lg">🎯</div>
                          </div>
                          <div className="flex-1 pt-1">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-green-600 mb-0.5">Destination</p>
                            <p className="font-semibold text-gray-900">{tripPlan?.endLocation || event.location || event.campground?.name || 'Final Destination'}</p>
                            {event.location && event.location !== event.campground?.name && <p className="text-xs text-gray-500">📍 {event.location}</p>}
                            {!event.location && event.campground && <p className="text-xs text-gray-500">📍 {event.campground.location}{event.campground.state ? `, ${event.campground.state}` : ''}</p>}
                            {event.endDate && <p className="text-xs text-gray-500">Arriving {new Date(String(event.endDate)).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>}
                          </div>
                        </div>
                      </div>
                    </div>

                    {tripPlan.status === 'COMPLETED' && tripPlan.actualMiles && (
                      <div className="bg-green-50 rounded-lg p-4 mt-4">
                        <p className="text-green-700 font-medium">🎉 Trip Completed!</p>
                        <p className="text-green-600">Logged {tripPlan.actualMiles * 2} miles (round trip)</p>
                      </div>
                    )}

                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Minimal timeline even without trip plan */}
                    <div className="border rounded-xl p-4">
                      <h4 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
                        <Navigation className="w-5 h-5" /> Journey
                      </h4>
                      <div className="space-y-0">
                        {/* START */}
                        <div className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className="w-8 h-8 rounded-full bg-blue-100 border-2 border-blue-400 flex items-center justify-center text-sm">🏠</div>
                            <div className="w-0.5 flex-1 bg-gray-200 my-1" />
                          </div>
                          <div className="flex-1 pb-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Start</p>
                            <p className="text-sm font-semibold text-gray-900">{userHomeLocation || 'Home'}</p>
                          </div>
                        </div>
                        {/* DESTINATION */}
                        <div className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className="w-8 h-8 rounded-full bg-green-100 border-2 border-green-400 flex items-center justify-center text-sm">🎯</div>
                          </div>
                          <div className="flex-1 pt-1">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-green-600">Destination</p>
                            <p className="text-sm font-semibold text-gray-900">{event.location || event.campground?.name || 'Destination'}</p>
                            {event.endDate && <p className="text-xs text-gray-500">Arriving {new Date(String(event.endDate)).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>}
                          </div>
                        </div>
                      </div>
                    </div>
                    <button onClick={openTripModal} className="btn btn-primary w-full">Plan My Route</button>
                  </div>
                )}
              </div>}
            </div>
          )}

          {openPhases.has(phase.id) && phase.id === 'prepare' && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <SupplyList eventId={event.id} />
            </div>
          )}

          {openPhases.has(phase.id) && phase.id === 'camp' && (
            <div className="space-y-8">
              {/* CampBoard — shows when On-Site */}
              {pulse.tripState === 'on-site' && event.campground && (
                <CampBoard
                  eventId={event.id}
                  campgroundId={event.campground.id}
                  campgroundName={event.campground.name || ''}
                  isCheckedIn={isCheckedIn}
                  scheduleItems={event.scheduleItems || []}
                />
              )}
              <EventSchedule key={scheduleRefreshKey} eventId={event.id} eventStartDate={event.startDate} eventEndDate={event.endDate || event.startDate} campgroundLat={event.campground?.latitude} campgroundLng={event.campground?.longitude} />
              {/* Things to Do Nearby moved out — now rendered as a standalone
                  section below the phase list. Removed the duplicate that
                  was previously rendered inside both Plan and Camp phases. */}
            </div>
          )}
          {/* EventAlbum removed — merged into TripScrapbook below */}
          {/* Trip Albums section removed — merged into TripScrapbook */}
          {openPhases.has(phase.id) && phase.id === 'prepare' && (
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
          {openPhases.has(phase.id) && phase.id === 'prepare' && (
            <div className="space-y-4">
              <HitchPackingSuggestions
                eventId={event.id}
                destination={event.campground?.name || event.location}
                startDate={event.startDate}
                endDate={event.endDate}
                groupSize={(event.attendees?.length || 0) + 1}
                onAddItems={() => setPackRefreshKey(k => k + 1)}
              />
              <EventPackList eventId={event.id} refreshKey={packRefreshKey} />
            </div>
          )}
          {openPhases.has(phase.id) && phase.id === 'remember' && (
            <TripScrapbook
              eventId={event.id}
              canPin={isOrganizer || !!userAttendee || isPastTrip}
              canUpload={isOrganizer || !!userAttendee || isPastTrip}
              campgroundName={event.campground?.name}
              eventTitle={event.title}
            />
          )}
          {openPhases.has(phase.id) && phase.id === 'camp' && (
            <div className="space-y-4">
              <HitchTripSummary event={event} />
              <PackUp eventId={event.id} eventTitle={event.title} endDate={event.endDate || event.startDate} />
            </div>
          )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Show all phases toggle */}
      {!showAllPhases && pulse.tripState !== 'echo' && (
        <button
          onClick={() => setShowAllPhases(true)}
          className="w-full text-center py-3 text-sm text-gray-400 hover:text-gray-600 transition mb-4"
        >
          Show all trip phases ({5 - (VISIBLE_PHASES[pulse.tripState] || []).length} more)
        </button>
      )}
      {showAllPhases && pulse.tripState !== 'echo' && (
        <button
          onClick={() => setShowAllPhases(false)}
          className="w-full text-center py-3 text-sm text-gray-400 hover:text-gray-600 transition mb-4"
        >
          Show only current phases
        </button>
      )}

      {/* Things to Do Nearby — sits below the phase list so Travel,
          Prepare, Camp, and Remember all appear above it */}
      {event.campground && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
          <ThingsToDoSection
            campgroundId={event.campground.id}
            campgroundName={event.campground.name}
            isAdmin={isOrganizer}
            eventId={event.id}
            onActivityAdded={() => setScheduleRefreshKey(k => k + 1)}
          />
        </div>
      )}

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

      {/* Add Stop Modal */}
      {showPitStopModal && (
        <AddStopModal
          tripPlanId={tripPlan?.id || ''}
          onClose={() => setShowPitStopModal(false)}
          onAddGenericStop={handleAddPitStop}
          onAddCampground={async (cg: any) => {
            if (!tripPlan?.id) return;
            try {
              await api.post(`/trip-planner/trip/${tripPlan.id}/campground-stop`, {
                campgroundId: cg.campgroundId,
                arrivalDate: cg.arrivalDate || null,
                departureDate: cg.departureDate || null,
                notes: cg.notes || null,
              });
              setShowPitStopModal(false);
              addLocalToast(`${cg.name} added to your trip 🏕️`, 'success');
              setSummaryRefreshKey(k => k + 1);
              await loadTripPlan();
            } catch (e: any) {
              addLocalToast(e?.response?.data?.error || 'Failed to add campground', 'error');
            }
          }}
          pitStopForm={pitStopForm}
          setPitStopForm={setPitStopForm}
        />
      )}

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
      {/* Duplicate Trip Modal */}
      {/* Transfer Ownership Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Transfer Trip Ownership</h2>
            <p className="text-sm text-gray-500 mb-4">Select an attendee to become the new trip organizer. You will lose the ability to delete or edit this trip.</p>
            <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
              {event.attendees
                ?.filter((a: any) => a.userId !== user?.id && a.status === 'going')
                .map((a: any) => (
                  <button
                    key={a.userId}
                    onClick={() => setTransferToUser({ id: a.userId, firstName: a.user.firstName, lastName: a.user.lastName })}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition ${
                      transferToUser?.id === a.userId
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {a.user.profilePicture ? (
                      <img src={a.user.profilePicture} className="w-9 h-9 rounded-full object-cover" alt="" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm">
                        {a.user.firstName[0]}
                      </div>
                    )}
                    <div className="text-left">
                      <p className="font-semibold text-sm text-gray-900">{a.user.firstName} {a.user.lastName}</p>
                      <p className="text-xs text-gray-400">@{a.user.username}</p>
                    </div>
                    {transferToUser?.id === a.userId && (
                      <span className="ml-auto text-primary-600 text-xs font-bold">Selected ✓</span>
                    )}
                  </button>
                ))}
            </div>
            {event.attendees?.filter((a: any) => a.userId !== user?.id && a.status === 'going').length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">No confirmed attendees to transfer to. Invite someone first.</p>
            )}
            <div className="flex gap-3">
              <button onClick={() => { setShowTransferModal(false); setTransferToUser(null); }} className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition">
                Cancel
              </button>
              <button
                onClick={handleTransferOrganizer}
                disabled={!transferToUser || transferring}
                className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50"
              >
                {transferring ? 'Transferring...' : 'Transfer Ownership'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDuplicateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Duplicate Trip</h3>
            <p className="text-sm text-gray-500 mb-5">
              Creates a copy of <span className="font-medium text-gray-700">"{event.title}"</span> with the same campground, pack list, and supply list.
            </p>

            <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50 mb-5">
              <input
                type="checkbox"
                checked={copyAttendees}
                onChange={e => setCopyAttendees(e.target.checked)}
                className="w-4 h-4 text-primary-600 rounded"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">Copy attendees</p>
                <p className="text-xs text-gray-500">Re-invite current attendees (they'll get PENDING status)</p>
              </div>
            </label>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDuplicateModal(false)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDuplicate}
                disabled={duplicating}
                className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
              >
                {duplicating ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                {duplicating ? 'Duplicating...' : 'Duplicate Trip'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}

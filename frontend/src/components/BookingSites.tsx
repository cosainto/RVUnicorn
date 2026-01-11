import { useState, useEffect } from 'react';
import { Calendar, Users, DollarSign, Tent, Home, Star, AlertCircle, Link as LinkIcon } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface Site {
  id: string;
  name: string;
  siteNumber: string;
  siteType: string;
  description?: string;
  maxOccupancy: number;
  amenities: string[];
  pricePerNight: number;
  imageUrl?: string;
}

interface Event {
  id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
}

interface BookingSitesProps {
  campgroundId: string;
  campgroundName: string;
}

const SITE_TYPE_ICONS: { [key: string]: any } = {
  TENT: Tent,
  RV: Home,
  CABIN: Home,
  GLAMPING: Star,
  GROUP: Users,
  PRIMITIVE: Tent,
};

const SITE_TYPE_LABELS: { [key: string]: string } = {
  TENT: 'Tent Site',
  RV: 'RV Site',
  CABIN: 'Cabin',
  GLAMPING: 'Glamping',
  GROUP: 'Group Site',
  PRIMITIVE: 'Primitive',
};

export default function BookingSites({ campgroundId, campgroundName }: BookingSitesProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [guests, setGuests] = useState(2);
  const [siteTypeFilter, setSiteTypeFilter] = useState('');
  const [maxPriceFilter, setMaxPriceFilter] = useState('');
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [specialRequests, setSpecialRequests] = useState('');

  // Event linking
  const [userEvents, setUserEvents] = useState<Event[]>([]);
  const [linkToEvent, setLinkToEvent] = useState<'none' | 'existing' | 'new'>('none');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [newEventTitle, setNewEventTitle] = useState('');

  useEffect(() => {
    loadSites();
  }, [campgroundId, checkInDate, checkOutDate, siteTypeFilter, maxPriceFilter]);

  useEffect(() => {
    if (user) {
      loadUserEvents();
    }
  }, [user]);

  const loadSites = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      if (checkInDate) params.append('checkIn', checkInDate);
      if (checkOutDate) params.append('checkOut', checkOutDate);
      if (siteTypeFilter) params.append('siteType', siteTypeFilter);
      if (maxPriceFilter) params.append('maxPrice', maxPriceFilter);

      const { data } = await api.get(`/bookings/campground/${campgroundId}/sites?${params}`);
      setSites(data);
    } catch (error) {
      console.error('Load sites error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserEvents = async () => {
    try {
      const { data } = await api.get('/bookings/user/events');
      setUserEvents(data);
    } catch (error) {
      console.error('Load events error:', error);
    }
  };

  const calculateNights = () => {
    if (!checkInDate || !checkOutDate) return 0;
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    return Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
  };

  const calculateTotal = (pricePerNight: number) => {
    return calculateNights() * pricePerNight;
  };

  const handleBookSite = (site: Site) => {
    if (!user) {
      alert('Please log in to book a campsite');
      navigate('/login');
      return;
    }

    if (!checkInDate || !checkOutDate) {
      alert('Please select check-in and check-out dates');
      return;
    }

    if (guests > site.maxOccupancy) {
      alert(`Maximum occupancy for this site is ${site.maxOccupancy} guests`);
      return;
    }

    setSelectedSite(site);
    setShowBookingModal(true);
  };

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSite) return;

    try {
      const bookingData: any = {
        siteId: selectedSite.id,
        checkInDate,
        checkOutDate,
        guests,
        specialRequests: specialRequests.trim() || undefined,
      };

      // Add event linking if selected
      if (linkToEvent === 'existing' && selectedEventId) {
        bookingData.eventId = selectedEventId;
      } else if (linkToEvent === 'new' && newEventTitle.trim()) {
        bookingData.createEvent = true;
        bookingData.eventTitle = newEventTitle.trim();
      }

      const { data } = await api.post('/bookings', bookingData);

      setShowBookingModal(false);
      setSelectedSite(null);
      setSpecialRequests('');
      setLinkToEvent('none');
      setSelectedEventId('');
      setNewEventTitle('');
      
      alert('Booking created successfully! 🏕️ Your camping trip has been added to your events!');
      navigate(`/events`);
    } catch (error: any) {
      console.error('Create booking error:', error);
      alert(error.response?.data?.error || 'Failed to create booking');
    }
  };

  const nights = calculateNights();

  return (
    <div className="space-y-6">
      {/* Search Filters */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Search Available Sites</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Check-in Date
            </label>
            <input
              type="date"
              value={checkInDate}
              onChange={(e) => setCheckInDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Check-out Date
            </label>
            <input
              type="date"
              value={checkOutDate}
              onChange={(e) => setCheckOutDate(e.target.value)}
              min={checkInDate || new Date().toISOString().split('T')[0]}
              className="input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Guests
            </label>
            <input
              type="number"
              value={guests}
              onChange={(e) => setGuests(parseInt(e.target.value))}
              min={1}
              className="input"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Site Type
            </label>
            <select
              value={siteTypeFilter}
              onChange={(e) => setSiteTypeFilter(e.target.value)}
              className="input"
            >
              <option value="">All Types</option>
              <option value="TENT">Tent Sites</option>
              <option value="RV">RV Sites</option>
              <option value="CABIN">Cabins</option>
              <option value="GLAMPING">Glamping</option>
              <option value="GROUP">Group Sites</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Price/Night
            </label>
            <input
              type="number"
              value={maxPriceFilter}
              onChange={(e) => setMaxPriceFilter(e.target.value)}
              placeholder="Any"
              className="input"
            />
          </div>
        </div>

        {checkInDate && checkOutDate && nights > 0 && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">
              <Calendar className="w-4 h-4 inline mr-1" />
              {nights} night{nights !== 1 ? 's' : ''} • {guests} guest{guests !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>

      {/* Available Sites */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading available sites...</p>
        </div>
      ) : sites.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-md">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 text-lg mb-2">No sites available</p>
          <p className="text-gray-500 text-sm">
            {checkInDate && checkOutDate 
              ? 'Try different dates or adjust your filters'
              : 'Select dates to see availability'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sites.map((site) => {
            const SiteIcon = SITE_TYPE_ICONS[site.siteType] || Tent;
            const total = checkInDate && checkOutDate ? calculateTotal(site.pricePerNight) : 0;

            return (
              <div key={site.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition">
                <div className="bg-gradient-to-br from-primary-100 to-primary-200 h-32 flex items-center justify-center">
                  <SiteIcon className="w-16 h-16 text-primary-600" />
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-bold text-gray-900">{site.name}</h3>
                      <p className="text-sm text-gray-600">{SITE_TYPE_LABELS[site.siteType]}</p>
                    </div>
                    <span className="bg-primary-100 text-primary-700 px-2 py-1 rounded text-sm font-medium">
                      #{site.siteNumber}
                    </span>
                  </div>

                  {site.description && (
                    <p className="text-sm text-gray-700 mb-3">{site.description}</p>
                  )}

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <Users className="w-4 h-4 mr-2" />
                      Max {site.maxOccupancy} guests
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <DollarSign className="w-4 h-4 mr-2" />
                      ${site.pricePerNight}/night
                    </div>
                  </div>

                  {site.amenities.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-medium text-gray-700 mb-1">Amenities:</p>
                      <div className="flex flex-wrap gap-1">
                        {site.amenities.slice(0, 3).map((amenity) => (
                          <span key={amenity} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                            {amenity.replace(/_/g, ' ')}
                          </span>
                        ))}
                        {site.amenities.length > 3 && (
                          <span className="text-xs text-gray-500">
                            +{site.amenities.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {total > 0 && (
                    <div className="mb-3 p-2 bg-green-50 rounded">
                      <p className="text-sm font-bold text-green-700">
                        Total: ${total.toFixed(2)} for {nights} night{nights !== 1 ? 's' : ''}
                      </p>
                    </div>
                  )}

                  <button
                    onClick={() => handleBookSite(site)}
                    disabled={!checkInDate || !checkOutDate || guests > site.maxOccupancy}
                    className="btn btn-primary w-full"
                  >
                    Book Now
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Booking Confirmation Modal */}
      {showBookingModal && selectedSite && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white p-6 rounded-t-lg">
              <h2 className="text-2xl font-bold">Confirm Your Booking</h2>
            </div>

            <form onSubmit={handleSubmitBooking} className="p-6 space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-bold text-gray-900 mb-2">{selectedSite.name}</h3>
                <p className="text-sm text-gray-600 mb-1">{campgroundName}</p>
                <p className="text-sm text-gray-700">{selectedSite.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-700">Check-in</p>
                  <p className="text-gray-900">{new Date(checkInDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Check-out</p>
                  <p className="text-gray-900">{new Date(checkOutDate).toLocaleDateString()}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-700">Nights</p>
                  <p className="text-gray-900">{nights}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Guests</p>
                  <p className="text-gray-900">{guests}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-700">${selectedSite.pricePerNight}/night × {nights} nights</span>
                  <span className="text-gray-900">${(selectedSite.pricePerNight * nights).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg">
                  <span className="text-gray-900">Total</span>
                  <span className="text-primary-600">${calculateTotal(selectedSite.pricePerNight).toFixed(2)}</span>
                </div>
              </div>

              {/* Event Linking Section */}
              <div className="border-t pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <LinkIcon className="w-5 h-5 text-gray-600" />
                  <h3 className="font-bold text-gray-900">Link to Event (Optional)</h3>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="eventLink"
                      checked={linkToEvent === 'none'}
                      onChange={() => setLinkToEvent('none')}
                      className="text-primary-600"
                    />
                    <span className="text-sm text-gray-700">No event linkage</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="eventLink"
                      checked={linkToEvent === 'new'}
                      onChange={() => setLinkToEvent('new')}
                      className="text-primary-600"
                    />
                    <span className="text-sm text-gray-700">Create new camping trip event</span>
                  </label>

                  {linkToEvent === 'new' && (
                    <input
                      type="text"
                      value={newEventTitle}
                      onChange={(e) => setNewEventTitle(e.target.value)}
                      placeholder="Enter event name (e.g., 'Weekend Getaway')"
                      className="input ml-6"
                      required
                    />
                  )}

                  {userEvents.length > 0 && (
                    <>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="eventLink"
                          checked={linkToEvent === 'existing'}
                          onChange={() => setLinkToEvent('existing')}
                          className="text-primary-600"
                        />
                        <span className="text-sm text-gray-700">Link to existing event</span>
                      </label>

                      {linkToEvent === 'existing' && (
                        <select
                          value={selectedEventId}
                          onChange={(e) => setSelectedEventId(e.target.value)}
                          className="input ml-6"
                          required
                        >
                          <option value="">Select an event...</option>
                          {userEvents.map((event) => (
                            <option key={event.id} value={event.id}>
                              {event.title} ({new Date(event.startDate).toLocaleDateString()})
                            </option>
                          ))}
                        </select>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Special Requests (optional)
                </label>
                <textarea
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  rows={3}
                  className="input"
                  placeholder="Any special requests or notes for the campground..."
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <p className="text-sm text-blue-700">
                  {linkToEvent === 'new' 
                    ? '🎉 A new event will be created and this booking will be linked to it!'
                    : linkToEvent === 'existing'
                    ? '🔗 This booking will be linked to your selected event!'
                    : '📅 Your booking will be confirmed once payment is processed.'}
                </p>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button type="submit" className="btn btn-primary flex-1">
                  Confirm Booking
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowBookingModal(false);
                    setSelectedSite(null);
                    setLinkToEvent('none');
                    setSelectedEventId('');
                    setNewEventTitle('');
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
    </div>
  );
}

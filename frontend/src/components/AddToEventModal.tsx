import { useState, useEffect } from 'react';
import { X, Calendar, Plus, Loader2, ChevronRight } from 'lucide-react';
import api from '../services/api';

interface Event {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
}

interface AddToEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  thingToDoId: string;
  thingTitle: string;
  campgroundId: string;
  preselectedEventId?: string;
  onActivityAdded?: () => void;
}

export default function AddToEventModal({ isOpen, onClose, thingToDoId, thingTitle, campgroundId, preselectedEventId, onActivityAdded }: AddToEventModalProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [endTime, setEndTime] = useState('');

  const getDefaultEndTime = (startTime: string) => {
    if (!startTime) return '';
    const [hours, minutes] = startTime.split(':').map(Number);
    const endHours = (hours + 2) % 24;
    return `${String(endHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  const handleStartTimeChange = (time: string) => {
    setSelectedTime(time);
    if (time) {
      setEndTime(getDefaultEndTime(time));
    }
  };
  const [notes, setNotes] = useState('');
  const [success, setSuccess] = useState(false);
  const [loadingActivities, setLoadingActivities] = useState(false);

  useEffect(() => {
    if (isOpen && campgroundId) {
      loadEvents();
      setSelectedEvent(null);
      setSelectedDate('');
      setSelectedTime('');
      setEndTime('');
      setNotes('');
      setSuccess(false);
    }
  }, [isOpen, campgroundId]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/campgrounds/${campgroundId}/my-events`);
      setEvents(data);
      // Auto-select event if preselectedEventId matches or only one event exists
      const match = preselectedEventId
        ? data.find((e: Event) => e.id === preselectedEventId)
        : data.length === 1 ? data[0] : null;
      if (match) {
        handleSelectEvent(match);
      }
    } catch (error) {
      console.error('Load events error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectEvent = async (event: Event) => {
    setSelectedEvent(event);
    setLoadingActivities(true);
    
    try {
      // Fetch existing activities to find the last scheduled date
      const { data: activities } = await api.get(`/events/${event.id}/activities`);
      
      // Find the last scheduled date among existing activities
      const scheduledDates = activities
        .filter((a: any) => a.scheduledDate)
        .map((a: any) => new Date(a.scheduledDate))
        .sort((a: Date, b: Date) => b.getTime() - a.getTime());
      
      if (scheduledDates.length > 0) {
        // Default to the last scheduled activity date
        const lastDate = scheduledDates[0];
        setSelectedDate(lastDate.toISOString().split('T')[0]);
      } else {
        // No activities yet, default to event start date
        setSelectedDate(new Date(event.startDate).toISOString().split('T')[0]);
      }
    } catch (error) {
      // If error, just default to start date
      setSelectedDate(new Date(event.startDate).toISOString().split('T')[0]);
    } finally {
      setLoadingActivities(false);
    }
  };

  const handleAdd = async () => {
    if (!selectedEvent) return;
    
    try {
      setAdding(true);
      await api.post(`/events/${selectedEvent.id}/activities`, {
        thingToDoId,
        scheduledDate: selectedDate || null,
        scheduledTime: selectedTime || null,
        duration: selectedTime && endTime ? (() => {
          const [sh, sm] = selectedTime.split(':').map(Number);
          const [eh, em] = endTime.split(':').map(Number);
          const diff = (eh * 60 + em) - (sh * 60 + sm);
          return diff > 0 ? diff : null;
        })() : null,
        notes: notes || null,
      });
      setSuccess(true);
      if (onActivityAdded) onActivityAdded();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error: any) {
      if (error.response?.data?.error === 'This activity is already added to the event') {
        alert('This activity is already on your trip itinerary');
      } else {
        console.error('Add to event error:', error);
        alert('Failed to add activity');
      }
    } finally {
      setAdding(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-lg">Add to Trip</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4">
          <p className="text-sm text-gray-600 mb-4">
            Add "<span className="font-medium">{thingTitle}</span>" to your trip itinerary
          </p>
          
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-600">No upcoming trips at this campground</p>
              <p className="text-sm text-gray-400 mt-1">Create an event first to add activities</p>
            </div>
          ) : !selectedEvent ? (
            /* Step 1: Select an event */
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase mb-3">Select a trip</p>
              {events.map(event => (
                <button
                  key={event.id}
                  onClick={() => handleSelectEvent(event)}
                  className="w-full flex items-center justify-between p-3 border rounded-lg hover:border-blue-300 hover:bg-blue-50/50 transition text-left"
                >
                  <div>
                    <p className="font-medium text-gray-900">{event.title}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(event.startDate).toLocaleDateString()} - {new Date(event.endDate).toLocaleDateString()}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
              ))}
            </div>
          ) : success ? (
            /* Success state */
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Plus className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-lg font-medium text-gray-900">Added to {selectedEvent.title}!</p>
            </div>
          ) : (
            /* Step 2: Configure date/time */
            <div className="space-y-4">
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                ← Back to trips
              </button>
              
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="font-medium text-gray-900">{selectedEvent.title}</p>
                <p className="text-xs text-gray-500">
                  {new Date(selectedEvent.startDate).toLocaleDateString()} - {new Date(selectedEvent.endDate).toLocaleDateString()}
                </p>
              </div>
              
              {loadingActivities ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                  <span className="ml-2 text-sm text-gray-500">Loading schedule...</span>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-gray-500 uppercase">Schedule</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-500">Date</label>
                        <input
                          type="date"
                          value={selectedDate}
                          onChange={(e) => setSelectedDate(e.target.value)}
                          min={new Date(selectedEvent.startDate).toISOString().split('T')[0]}
                          max={new Date(selectedEvent.endDate).toISOString().split('T')[0]}
                          className="w-full text-sm border rounded-lg px-3 py-2 mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Start Time</label>
                        <input
                          type="time"
                          value={selectedTime}
                          onChange={(e) => handleStartTimeChange(e.target.value)}
                          className="w-full text-sm border rounded-lg px-3 py-2 mt-1"
                        />
                      </div>
                    </div>
                    {selectedTime && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-gray-500">End Time</label>
                          <input
                            type="time"
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                            className="w-full text-sm border rounded-lg px-3 py-2 mt-1"
                          />
                        </div>
                        <div className="flex items-end pb-1">
                          <p className="text-xs text-gray-400">
                            {selectedTime && endTime ? (() => {
                              const [sh, sm] = selectedTime.split(':').map(Number);
                              const [eh, em] = endTime.split(':').map(Number);
                              const diff = (eh * 60 + em) - (sh * 60 + sm);
                              const hrs = Math.floor(diff / 60);
                              const mins = diff % 60;
                              return diff > 0 ? `${hrs > 0 ? hrs + 'h ' : ''}${mins > 0 ? mins + 'm' : ''}` : '';
                            })() : ''}
                          </p>
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="text-xs text-gray-500">Notes (optional)</label>
                      <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="e.g., Make reservations"
                        className="w-full text-sm border rounded-lg px-3 py-2 mt-1"
                      />
                    </div>
                  </div>
                  
                  <button
                    onClick={handleAdd}
                    disabled={adding}
                    className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition flex items-center justify-center gap-2"
                  >
                    {adding ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Plus className="w-5 h-5" />
                        Add to Trip
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { X, Calendar, ChefHat, Plus } from 'lucide-react';
import api from '../services/api';

interface Event {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  location?: string;
}

interface Attendee {
  id: string;
  userId: string;
  status: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
  };
}

interface Recipe {
  id: string;
  title: string;
  ingredients?: string[];
}

interface AddRecipeToEventModalProps {
  recipe: Recipe;
  isOpen: boolean;
  onClose: () => void;
}

const MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'];

const MEAL_ICONS: { [key: string]: string } = {
  'BREAKFAST': '🍳',
  'LUNCH': '🥪',
  'DINNER': '🍽️',
  'SNACK': '🍿'
};

export default function AddRecipeToEventModal({ recipe, isOpen, onClose }: AddRecipeToEventModalProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedMealType, setSelectedMealType] = useState('DINNER');
  const [notes, setNotes] = useState('');
  const [eventDates, setEventDates] = useState<string[]>([]);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [selectedCook, setSelectedCook] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadEvents();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedEventId) {
      const event = events.find(e => e.id === selectedEventId);
      if (event) {
        generateEventDates(event);
        loadAttendees(selectedEventId);
      }
    } else {
      setEventDates([]);
      setSelectedDate('');
      setAttendees([]);
      setSelectedCook('');
    }
  }, [selectedEventId, events]);

  const loadAttendees = async (eventId: string) => {
    try {
      const { data } = await api.get(`/events/${eventId}`);
      const goingAttendees = (data.attendees || []).filter(
        (a: Attendee) => ['going', 'GOING'].includes(a.status)
      );
      // Include organizer
      if (data.organizer) {
        const organizerAsAttendee = {
          id: 'organizer',
          userId: data.organizer.id,
          status: 'going',
          user: data.organizer
        };
        setAttendees([organizerAsAttendee, ...goingAttendees]);
      } else {
        setAttendees(goingAttendees);
      }
    } catch (error) {
      console.error('Load attendees error:', error);
      setAttendees([]);
    }
  };

  const loadEvents = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/events');
      // Filter to upcoming events only
      const now = new Date();
      const upcomingEvents = data.filter((event: Event) => 
        new Date(event.endDate || event.startDate) >= now
      );
      setEvents(upcomingEvents);
    } catch (error) {
      console.error('Load events error:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateEventDates = (event: Event) => {
    const dates: string[] = [];
    const start = new Date(event.startDate);
    const end = new Date(event.endDate || event.startDate);
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d).toISOString().split('T')[0]);
    }
    
    setEventDates(dates);
    if (dates.length > 0) {
      setSelectedDate(dates[0]);
    }
  };

  const handleSubmit = async () => {
    if (!selectedEventId || !selectedDate || !selectedMealType) {
      alert('Please select an event, date, and meal type');
      return;
    }

    try {
      setSubmitting(true);
      
      const { data: meal } = await api.post('/event-meals', {
        eventId: selectedEventId,
        date: selectedDate,
        mealType: selectedMealType,
        recipeId: recipe.id,
        menuItems: [recipe.title],
        ingredients: recipe.ingredients || [],
        notes: notes || null,
        assignedTo: selectedCook || null,
      });

      // If a cook was assigned, send notification
      if (selectedCook && meal.id) {
        await api.post(`/event-meals/${meal.id}/assign-cook`, {
          cookId: selectedCook
        });
      }

      alert('Success! ' + recipe.title + ' added to meal plan!');
      onClose();
      
      // Reset form
      setSelectedEventId('');
      setSelectedDate('');
      setSelectedMealType('DINNER');
      setNotes('');
      setSelectedCook('');
    } catch (error) {
      console.error('Add to event error:', error);
      alert('Failed to add recipe to event');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="bg-gradient-to-r from-green-500 to-teal-500 text-white p-6 rounded-t-xl sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="w-8 h-8" />
              <h2 className="text-2xl font-bold">Add to Event</h2>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Recipe Info */}
          <div className="bg-orange-50 border-2 border-orange-200 p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <ChefHat className="w-5 h-5 text-orange-600" />
              <span className="font-semibold text-gray-900">{recipe.title}</span>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              <p className="text-gray-600 mt-2">Loading events...</p>
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600">No upcoming events found.</p>
              <p className="text-sm text-gray-500 mt-1">Create an event first to add meals!</p>
            </div>
          ) : (
            <>
              {/* Select Event */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  🏕️ Select Event *
                </label>
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="input w-full"
                  required
                >
                  <option value="">Choose an event...</option>
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.title} ({new Date(event.startDate).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>

              {/* Select Date */}
              {selectedEventId && eventDates.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    📅 Select Date *
                  </label>
                  <select
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="input w-full"
                    required
                  >
                    {eventDates.map((date) => (
                      <option key={date} value={date}>
                        {new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Select Meal Type */}
              {selectedEventId && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    🍴 Meal Type *
                  </label>
                  <select
                    value={selectedMealType}
                    onChange={(e) => setSelectedMealType(e.target.value)}
                    className="input w-full"
                    required
                  >
                    {MEAL_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {MEAL_ICONS[type]} {type.charAt(0) + type.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Notes */}
              {selectedEventId && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    📝 Notes (Optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="input w-full"
                    placeholder="Any special instructions..."
                  />
                </div>
              )}

              {/* Assign Cook */}
              {selectedEventId && attendees.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    👨‍🍳 Assign Cook (Optional)
                  </label>
                  <select
                    value={selectedCook}
                    onChange={(e) => setSelectedCook(e.target.value)}
                    className="input w-full"
                  >
                    <option value="">No one assigned yet</option>
                    {attendees.map((attendee) => (
                      <option key={attendee.userId} value={attendee.userId}>
                        {attendee.user.firstName} {attendee.user.lastName}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    The assigned person will be notified and can accept or decline.
                  </p>
                </div>
              )}
            </>
          )}

          {/* Submit */}
          <div className="flex gap-3 pt-4 border-t">
            <button
              onClick={handleSubmit}
              disabled={!selectedEventId || !selectedDate || submitting}
              className="btn btn-primary flex-1 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  Add to Meal Plan
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

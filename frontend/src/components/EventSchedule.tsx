import { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, Users, Plus, Edit2, Trash2, X, Check, ExternalLink, ChefHat, Eye, EyeOff } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface EventScheduleProps {
  eventId: string;
  eventStartDate: string;
  eventEndDate: string;
}

interface Subevent {
  id: string;
  title: string;
  description?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  activityType: string;
  location?: string;
  hostId?: string;
  host?: {
    id: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
  };
  attendees: SubeventAttendee[];
}

interface SubeventAttendee {
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

interface ThingToDo {
  id: string;
  title: string;
  type: string;
  address?: string;
  imageUrl?: string;
  sourceUrl: string;
  sourceName: string;
}

interface EventActivity {
  id: string;
  scheduledDate?: string;
  scheduledTime?: string;
  duration?: number;
  notes?: string;
  status: string;
  thingToDo: ThingToDo;
  addedBy: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
  };
}

interface Meal {
  id: string;
  mealType: string;
  scheduledAt: string;
  notes?: string;
  cookStatus?: string;
  recipe?: {
    id: string;
    title: string;
    imageUrl?: string;
  };
  cook?: {
    id: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
  };
}

const ACTIVITY_TYPES = [
  { value: 'HIKE', label: '🥾 Hike', color: 'bg-green-100 text-green-800' },
  { value: 'SWIM', label: '🏊 Swimming', color: 'bg-blue-100 text-blue-800' },
  { value: 'GAME', label: '🎮 Games', color: 'bg-purple-100 text-purple-800' },
  { value: 'ENTERTAINMENT', label: '🎭 Entertainment', color: 'bg-pink-100 text-pink-800' },
  { value: 'CRAFT', label: '🎨 Crafts', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'RANGER_TALK', label: '🎤 Ranger Talk', color: 'bg-orange-100 text-orange-800' },
  { value: 'OTHER', label: '📌 Other', color: 'bg-gray-100 text-gray-800' },
];

const MEAL_ICONS: Record<string, string> = {
  BREAKFAST: '🍳',
  LUNCH: '🥪',
  DINNER: '🍽️',
  SNACK: '🍿',
};

const MEAL_TIMES: Record<string, string> = {
  BREAKFAST: '8:00 AM',
  LUNCH: '12:00 PM',
  DINNER: '6:00 PM',
  SNACK: '3:00 PM',
};

export default function EventSchedule({ eventId, eventStartDate, eventEndDate }: EventScheduleProps) {
  const { user } = useAuth();
  const [subevents, setSubevents] = useState<Subevent[]>([]);
  const [activities, setActivities] = useState<EventActivity[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSubevent, setEditingSubevent] = useState<Subevent | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [updatingActivityId, setUpdatingActivityId] = useState<string | null>(null);
  const [deletingActivityId, setDeletingActivityId] = useState<string | null>(null);
  const [showMeals, setShowMeals] = useState(true);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    startTime: '',
    endTime: '',
    activityType: 'OTHER',
    location: '',
  });

  // Generate array of dates for the event
  const getEventDates = () => {
    const dates: Date[] = [];
    const start = new Date(eventStartDate);
    const end = new Date(eventEndDate);
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d));
    }
    return dates;
  };

  const eventDates = getEventDates();

  useEffect(() => {
    loadData();
  }, [eventId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load activities
      const activitiesRes = await api.get(`/events/${eventId}/activities`);
      console.log('[Schedule] Loaded activities:', activitiesRes.data);
      setActivities(activitiesRes.data);
      
      // Auto-complete activities that are 1 hour past their end time
      const now = new Date();
      for (const act of activitiesRes.data) {
        if (act.status !== 'PLANNED' || !act.scheduledDate || !act.scheduledTime) continue;
        const dateStr = act.scheduledDate.split('T')[0];
        const duration = act.duration || 120;
        const endTime = new Date(`${dateStr}T${act.scheduledTime}:00`);
        endTime.setMinutes(endTime.getMinutes() + duration + 60);
        if (now > endTime) {
          try {
            await api.patch(`/events/${eventId}/activities/${act.id}`, { status: 'COMPLETED' });
            setActivities(prev => prev.map(a => a.id === act.id ? { ...a, status: 'COMPLETED' } : a));
            console.log('[Schedule] Auto-completed activity:', act.id);
          } catch (e) { console.log('[Schedule] Could not auto-complete', act.id); }
        }
      }
      
      // Try to load subevents
      try {
        const subeventsRes = await api.get(`/events/${eventId}/subevents`);
        console.log('[Schedule] Loaded subevents:', subeventsRes.data);
        setSubevents(subeventsRes.data);
      } catch (e) {
        console.log('[Schedule] Subevents not available');
        setSubevents([]);
      }
      
      // Load meals
      try {
        const mealsRes = await api.get(`/event-meals/${eventId}`);
        console.log('[Schedule] Loaded meals:', mealsRes.data);
        setMeals(mealsRes.data);
      } catch (e) {
        console.log('[Schedule] Meals not available');
        setMeals([]);
      }
    } catch (error) {
      console.error('Load schedule error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubevent = async () => {
    if (!formData.title || !formData.date) {
      alert('Please fill in title and date');
      return;
    }

    try {
      if (editingSubevent) {
        await api.put(`/events/${eventId}/subevents/${editingSubevent.id}`, formData);
      } else {
        await api.post(`/events/${eventId}/subevents`, formData);
      }
      
      setShowCreateModal(false);
      setEditingSubevent(null);
      setFormData({
        title: '',
        description: '',
        date: '',
        startTime: '',
        endTime: '',
        activityType: 'OTHER',
        location: '',
      });
      await loadData();
    } catch (error) {
      console.error('Save subevent error:', error);
      alert('Failed to save activity');
    }
  };

  const handleDeleteSubevent = async (subeventId: string) => {
    if (!confirm('Delete this activity?')) return;
    
    try {
      await api.delete(`/events/${eventId}/subevents/${subeventId}`);
      await loadData();
    } catch (error) {
      console.error('Delete subevent error:', error);
      alert('Failed to delete activity');
    }
  };

  const handleRSVP = async (subeventId: string, status: string) => {
    try {
      await api.post(`/events/${eventId}/subevents/${subeventId}/rsvp`, { status });
      await loadData();
    } catch (error) {
      console.error('RSVP error:', error);
      alert('Failed to update RSVP');
    }
  };

  const handleActivityStatusChange = async (activityId: string, status: string) => {
    try {
      setUpdatingActivityId(activityId);
      await api.patch(`/events/${eventId}/activities/${activityId}`, { status });
      setActivities(prev => prev.map(a => a.id === activityId ? { ...a, status } : a));
    } catch (error) {
      console.error('Update activity status error:', error);
    } finally {
      setUpdatingActivityId(null);
    }
  };

  const handleDeleteActivity = async (activityId: string) => {
    if (!confirm('Remove this activity from the trip?')) return;
    try {
      setDeletingActivityId(activityId);
      await api.delete(`/events/${eventId}/activities/${activityId}`);
      setActivities(prev => prev.filter(a => a.id !== activityId));
    } catch (error) {
      console.error('Delete activity error:', error);
    } finally {
      setDeletingActivityId(null);
    }
  };

  const getUserRSVP = (subevent: Subevent) => {
    return subevent.attendees.find(a => a.userId === user?.id);
  };

  const getActivityTypeInfo = (type: string) => {
    return ACTIVITY_TYPES.find(t => t.value === type) || ACTIVITY_TYPES[ACTIVITY_TYPES.length - 1];
  };

  // Get items for a specific date
  const getItemsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    const daySubevents = subevents.filter(se => se.date.split('T')[0] === dateStr);
    const dayActivities = activities.filter(a => a.scheduledDate && a.scheduledDate.split('T')[0] === dateStr);
    const dayMeals = showMeals ? meals.filter(m => m.scheduledAt || m.date && m.scheduledAt || m.date.split('T')[0] === dateStr) : [];
    return { subevents: daySubevents, activities: dayActivities, meals: dayMeals };
  };

  const totalScheduleItems = subevents.length + activities.length;
  if (!loading && totalScheduleItems === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="text-6xl mb-4">📅</div>
        <h3 className="text-xl font-bold text-gray-800 mb-2">No activities scheduled yet</h3>
        <p className="text-gray-500 max-w-sm mb-6">A great trip doesn't just happen — it's planned! Add activities, excursions, and must-dos to your schedule so the whole crew knows what's coming.</p>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 max-w-sm w-full text-left mb-6">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">💡 Pro Tips</p>
          <ul className="space-y-1 text-sm text-amber-800">
            <li>• Add activities from the Things To Do Nearby section</li>
            <li>• Schedule hikes, tours, meals, and events by day</li>
            <li>• Let attendees RSVP to each activity</li>
            <li>• Leave some free time — you're on vacation! 🏕️</li>
          </ul>
        </div>
      </div>
    );
  }

  // Get unscheduled activities
  const unscheduledActivities = activities.filter(a => !a.scheduledDate);

  // Count total items per date
  const getTotalItemsForDate = (date: Date) => {
    const { subevents, activities, meals } = getItemsForDate(date);
    return subevents.length + activities.length + meals.length;
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Calendar Strip */}
      <div className="bg-gradient-to-r from-primary-50 to-blue-50 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-gray-900">Trip Calendar</h4>
          <div className="flex items-center gap-3">
            {/* Meals Toggle */}
            <button
              onClick={() => setShowMeals(!showMeals)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition ${
                showMeals 
                  ? 'bg-amber-100 text-amber-700 border border-amber-300' 
                  : 'bg-gray-100 text-gray-500 border border-gray-200'
              }`}
            >
              <ChefHat className="w-4 h-4" />
              Meals
              {showMeals ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            </button>
            
            {selectedDate && (
              <button
                onClick={() => setSelectedDate(null)}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                Show all days
              </button>
            )}
          </div>
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-2">
          {eventDates.map((date, idx) => {
            const dateStr = date.toISOString().split('T')[0];
            const totalItems = getTotalItemsForDate(date);
            const isSelected = selectedDate === dateStr;
            const isToday = new Date().toDateString() === date.toDateString();
            
            return (
              <button
                key={idx}
                onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                className={`flex-shrink-0 w-16 py-3 rounded-xl transition text-center ${
                  isSelected
                    ? 'bg-primary-600 text-white shadow-lg'
                    : isToday
                      ? 'bg-white border-2 border-primary-500 text-primary-600'
                      : 'bg-white hover:bg-gray-50 border border-gray-200'
                }`}
              >
                <div className={`text-xs font-medium ${isSelected ? 'text-primary-100' : 'text-gray-500'}`}>
                  {date.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div className={`text-xl font-bold ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                  {date.getDate()}
                </div>
                <div className={`text-xs ${isSelected ? 'text-primary-100' : 'text-gray-500'}`}>
                  {date.toLocaleDateString('en-US', { month: 'short' })}
                </div>
                {totalItems > 0 && (
                  <div className={`mt-1 flex justify-center gap-0.5`}>
                    {Array.from({ length: Math.min(totalItems, 3) }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-1.5 h-1.5 rounded-full ${
                          isSelected ? 'bg-white' : 'bg-primary-500'
                        }`}
                      />
                    ))}
                    {totalItems > 3 && (
                      <span className={`text-xs ${isSelected ? 'text-white' : 'text-primary-600'}`}>+</span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900">
            {selectedDate 
              ? new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
              : 'Trip Schedule'
            }
          </h3>
        </div>
        <button
          onClick={() => {
            setEditingSubevent(null);
            setFormData({
              title: '',
              description: '',
              date: selectedDate || eventStartDate.split('T')[0],
              startTime: '',
              endTime: '',
              activityType: 'OTHER',
              location: '',
            });
            setShowCreateModal(true);
          }}
          className="btn btn-primary btn-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Activity
        </button>
      </div>

      {/* Schedule by Day */}
      <div className="space-y-6">
        {eventDates
          .filter(date => !selectedDate || date.toISOString().split('T')[0] === selectedDate)
          .map((date, idx) => {
            const dateStr = date.toISOString().split('T')[0];
            const { subevents: daySubevents, activities: dayActivities, meals: dayMeals } = getItemsForDate(date);
            const hasItems = daySubevents.length > 0 || dayActivities.length > 0 || dayMeals.length > 0;
            
            // Sort meals by type order
            const sortedMeals = [...dayMeals].sort((a, b) => {
              const order = ['BREAKFAST', 'LUNCH', 'SNACK', 'DINNER'];
              return order.indexOf(a.mealType) - order.indexOf(b.mealType);
            });
            
            return (
              <div key={idx} className="border border-gray-200 rounded-xl overflow-hidden">
                {/* Day Header */}
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-primary-600 text-white rounded-lg flex flex-col items-center justify-center">
                        <span className="text-xs font-medium">{date.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                        <span className="text-lg font-bold leading-none">{date.getDate()}</span>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">
                          {date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                        </h4>
                        <p className="text-sm text-gray-500">
                          {daySubevents.length + dayActivities.length} {daySubevents.length + dayActivities.length === 1 ? 'activity' : 'activities'}
                          {showMeals && dayMeals.length > 0 && `, ${dayMeals.length} ${dayMeals.length === 1 ? 'meal' : 'meals'}`}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setFormData({
                          title: '',
                          description: '',
                          date: dateStr,
                          startTime: '',
                          endTime: '',
                          activityType: 'OTHER',
                          location: '',
                        });
                        setShowCreateModal(true);
                      }}
                      className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" />
                      Add
                    </button>
                  </div>
                </div>
                
                {/* Day Content */}
                <div className="p-4">
                  {hasItems ? (
                    <div className="space-y-3">
                      {/* Meals (if showing) */}
                      {sortedMeals.map((meal) => (
                        <div key={meal.id} className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                          <div className="flex items-center gap-3">
                            <div className="text-2xl">{MEAL_ICONS[meal.mealType] || '🍽️'}</div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                                  {meal.mealType}
                                </span>
                                <span className="text-xs text-gray-500">{MEAL_TIMES[meal.mealType] || ''}</span>
                              </div>
                              <h5 className="font-medium text-gray-900">
                                {meal.recipe?.title || `${meal.mealType.charAt(0) + meal.mealType.slice(1).toLowerCase()}`}
                              </h5>
                              {meal.cook && (
                                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                  <ChefHat className="w-3 h-3" />
                                  {meal.cook.firstName} {meal.cook.lastName}
                                  {meal.cookStatus === 'CONFIRMED' && <span className="text-green-600">✓</span>}
                                </p>
                              )}
                              {meal.notes && <p className="text-xs text-gray-500 italic mt-1">{meal.notes}</p>}
                            </div>
                            {meal.recipe?.imageUrl && (
                              <img src={meal.recipe.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover" />
                            )}
                          </div>
                        </div>
                      ))}
                      
                      {/* Subevents (manual activities) */}
                      {daySubevents
                        .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))
                        .map((subevent) => {
                          const activityType = getActivityTypeInfo(subevent.activityType);
                          const userRSVP = getUserRSVP(subevent);
                          
                          return (
                            <div key={subevent.id} className="bg-white rounded-lg p-4 border border-gray-200 hover:border-primary-200 transition">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${activityType.color}`}>
                                      {activityType.label}
                                    </span>
                                    {subevent.startTime && (
                                      <span className="text-sm text-gray-600 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {subevent.startTime}
                                        {subevent.endTime && ` - ${subevent.endTime}`}
                                      </span>
                                    )}
                                  </div>
                                  <h5 className="font-semibold text-gray-900">{subevent.title}</h5>
                                  {subevent.description && (
                                    <p className="text-sm text-gray-600 mt-1">{subevent.description}</p>
                                  )}
                                  {subevent.location && (
                                    <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                                      <MapPin className="w-3 h-3" />
                                      {subevent.location}
                                    </div>
                                  )}
                                </div>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => {
                                      setEditingSubevent(subevent);
                                      setFormData({
                                        title: subevent.title,
                                        description: subevent.description || '',
                                        date: subevent.date.split('T')[0],
                                        startTime: subevent.startTime || '',
                                        endTime: subevent.endTime || '',
                                        activityType: subevent.activityType,
                                        location: subevent.location || '',
                                      });
                                      setShowCreateModal(true);
                                    }}
                                    className="p-1.5 text-gray-400 hover:text-primary-600 rounded"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSubevent(subevent.id)}
                                    className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                              
                              {/* RSVP */}
                              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                                <span className="text-xs text-gray-500">Going?</span>
                                <div className="flex gap-1">
                                  {['ATTENDING', 'MAYBE', 'NOT_ATTENDING'].map(status => (
                                    <button
                                      key={status}
                                      onClick={() => handleRSVP(subevent.id, status)}
                                      className={`px-2 py-0.5 rounded text-xs font-medium transition ${
                                        userRSVP?.status === status
                                          ? status === 'ATTENDING' ? 'bg-green-500 text-white'
                                            : status === 'MAYBE' ? 'bg-yellow-500 text-white'
                                            : 'bg-red-500 text-white'
                                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                      }`}
                                    >
                                      {status === 'ATTENDING' ? '✓ Yes' : status === 'MAYBE' ? '? Maybe' : '✗ No'}
                                    </button>
                                  ))}
                                </div>
                                {subevent.attendees.filter(a => a.status === 'ATTENDING').length > 0 && (
                                  <span className="text-xs text-gray-500 ml-2">
                                    {subevent.attendees.filter(a => a.status === 'ATTENDING').length} going
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      
                      {/* Trip Activities (from Things to Do) */}
                      {dayActivities.map((activity) => (
                        <div 
                          key={activity.id} 
                          className={`rounded-lg p-4 border transition ${
                            activity.status === 'COMPLETED' 
                              ? 'bg-green-50 border-green-200' 
                              : activity.status === 'SKIPPED'
                                ? 'bg-gray-50 border-gray-200 opacity-60'
                                : 'bg-blue-50 border-blue-200'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {activity.thingToDo.imageUrl && (
                              <img 
                                src={activity.thingToDo.imageUrl} 
                                alt="" 
                                className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                                      📍 Saved Place
                                    </span>
                                    {activity.scheduledTime && (
                                      <span className="text-xs text-gray-500 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {activity.scheduledTime}
                                      </span>
                                    )}
                                  </div>
                                  <h5 className={`font-semibold ${activity.status === 'COMPLETED' ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                                    {activity.thingToDo.title}
                                  </h5>
                                  {activity.thingToDo.address && (
                                    <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                                      <MapPin className="w-3 h-3" />
                                      {activity.thingToDo.address}
                                    </p>
                                  )}
                                  {activity.notes && (
                                    <p className="text-sm text-gray-600 italic mt-1">"{activity.notes}"</p>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  {activity.status !== 'COMPLETED' && (
                                    <button
                                      onClick={() => handleActivityStatusChange(activity.id, 'COMPLETED')}
                                      disabled={updatingActivityId === activity.id}
                                      className="p-1.5 text-green-600 hover:bg-green-100 rounded"
                                      title="Mark complete"
                                    >
                                      <Check className="w-4 h-4" />
                                    </button>
                                  )}
                                  {activity.status === 'COMPLETED' && (
                                    <button
                                      onClick={() => handleActivityStatusChange(activity.id, 'PLANNED')}
                                      disabled={updatingActivityId === activity.id}
                                      className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                                      title="Mark as planned"
                                    >
                                      ↺
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDeleteActivity(activity.id)}
                                    disabled={deletingActivityId === activity.id}
                                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                                    title="Remove"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                  <a 
                                    href={activity.thingToDo.sourceUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="p-1.5 text-gray-400 hover:text-blue-600 rounded"
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </a>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-gray-400">
                      <p className="text-sm">No activities planned</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        
        {/* Unscheduled Activities */}
        {unscheduledActivities.length > 0 && !selectedDate && (
          <div className="border border-dashed border-gray-300 rounded-xl overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <h4 className="font-semibold text-gray-700">📋 Unscheduled</h4>
              <p className="text-sm text-gray-500">These activities haven't been assigned to a day yet</p>
            </div>
            <div className="p-4 space-y-3">
              {unscheduledActivities.map((activity) => (
                <div key={activity.id} className="bg-white rounded-lg p-3 border border-gray-200 flex items-center gap-3">
                  {activity.thingToDo.imageUrl && (
                    <img src={activity.thingToDo.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover" />
                  )}
                  <div className="flex-1">
                    <h5 className="font-medium text-gray-900">{activity.thingToDo.title}</h5>
                    {activity.thingToDo.address && (
                      <p className="text-xs text-gray-500">{activity.thingToDo.address}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteActivity(activity.id)}
                    className="p-1.5 text-red-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl">
            <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white p-4 rounded-t-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">
                  {editingSubevent ? 'Edit Activity' : 'Add Activity'}
                </h3>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingSubevent(null);
                  }}
                  className="text-white hover:text-gray-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Morning hike"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={formData.activityType}
                  onChange={(e) => setFormData({ ...formData, activityType: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  {ACTIVITY_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  min={eventStartDate.split('T')[0]}
                  max={eventEndDate.split('T')[0]}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Meeting point"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleCreateSubevent}
                  className="flex-1 bg-primary-600 text-white py-2.5 rounded-lg font-medium hover:bg-primary-700"
                >
                  {editingSubevent ? 'Save' : 'Add Activity'}
                </button>
                <button
                  onClick={() => { setShowCreateModal(false); setEditingSubevent(null); }}
                  className="px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50"
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

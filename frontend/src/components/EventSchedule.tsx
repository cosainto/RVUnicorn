import { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, Users, Plus, Edit2, Trash2, X } from 'lucide-react';
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

const ACTIVITY_TYPES = [
  { value: 'HIKE', label: '🥾 Hike', color: 'bg-green-100 text-green-800' },
  { value: 'SWIM', label: '🏊 Swimming', color: 'bg-blue-100 text-blue-800' },
  { value: 'GAME', label: '🎮 Games', color: 'bg-purple-100 text-purple-800' },
  { value: 'ENTERTAINMENT', label: '🎭 Entertainment', color: 'bg-pink-100 text-pink-800' },
  { value: 'CRAFT', label: '🎨 Crafts', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'RANGER_TALK', label: '🎤 Ranger Talk', color: 'bg-orange-100 text-orange-800' },
  { value: 'OTHER', label: '📌 Other', color: 'bg-gray-100 text-gray-800' },
];

export default function EventSchedule({ eventId, eventStartDate, eventEndDate }: EventScheduleProps) {
  const { user } = useAuth();
  const [subevents, setSubevents] = useState<Subevent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSubevent, setEditingSubevent] = useState<Subevent | null>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    startTime: '',
    endTime: '',
    activityType: 'OTHER',
    location: '',
  });

  useEffect(() => {
    loadSubevents();
  }, [eventId]);

  const loadSubevents = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/events/${eventId}/subevents`);
      setSubevents(data);
    } catch (error) {
      console.error('Load subevents error:', error);
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
      await loadSubevents();
    } catch (error) {
      console.error('Save subevent error:', error);
      alert('Failed to save activity');
    }
  };

  const handleDelete = async (subeventId: string) => {
    if (!confirm('Delete this activity?')) return;
    
    try {
      await api.delete(`/events/${eventId}/subevents/${subeventId}`);
      await loadSubevents();
    } catch (error) {
      console.error('Delete subevent error:', error);
      alert('Failed to delete activity');
    }
  };

  const handleRSVP = async (subeventId: string, status: string) => {
    try {
      await api.post(`/events/${eventId}/subevents/${subeventId}/rsvp`, { status });
      await loadSubevents();
    } catch (error) {
      console.error('RSVP error:', error);
      alert('Failed to update RSVP');
    }
  };

  const getUserRSVP = (subevent: Subevent) => {
    return subevent.attendees.find(a => a.userId === user?.id);
  };

  const getActivityTypeInfo = (type: string) => {
    return ACTIVITY_TYPES.find(t => t.value === type) || ACTIVITY_TYPES[ACTIVITY_TYPES.length - 1];
  };

  const groupByDate = (subevents: Subevent[]) => {
    const groups: Record<string, Subevent[]> = {};
    subevents.forEach(se => {
      const dateKey = new Date(se.date).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      });
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(se);
    });
    return groups;
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
      </div>
    );
  }

  const groupedSubevents = groupByDate(subevents);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Event Schedule</h3>
          <p className="text-sm text-gray-600">Plan activities and see who's joining</p>
        </div>
        <button
          onClick={() => {
            setEditingSubevent(null);
            setFormData({
              title: '',
              description: '',
              date: eventStartDate.split('T')[0],
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

      {/* Schedule */}
      {Object.keys(groupedSubevents).length > 0 ? (
        <div className="space-y-6">
          {Object.entries(groupedSubevents).map(([date, events]) => (
            <div key={date}>
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary-600" />
                {date}
              </h4>
              <div className="space-y-3">
                {events.map((subevent) => {
                  const activityType = getActivityTypeInfo(subevent.activityType);
                  const userRSVP = getUserRSVP(subevent);
                  
                  return (
                    <div
                      key={subevent.id}
                      className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-xs px-2 py-1 rounded ${activityType.color}`}>
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
                          <h5 className="font-semibold text-gray-900 mb-1">{subevent.title}</h5>
                          {subevent.description && (
                            <p className="text-sm text-gray-600 mb-2">{subevent.description}</p>
                          )}
                          {subevent.location && (
                            <div className="flex items-center gap-1 text-sm text-gray-600">
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
                            className="text-gray-600 hover:text-primary-600"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(subevent.id)}
                            className="text-gray-600 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* RSVP Buttons */}
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm text-gray-700">Going?</span>
                        <button
                          onClick={() => handleRSVP(subevent.id, 'ATTENDING')}
                          className={`btn btn-xs ${
                            userRSVP?.status === 'ATTENDING'
                              ? 'bg-green-500 text-white'
                              : 'btn-secondary'
                          }`}
                        >
                          ✓ Yes
                        </button>
                        <button
                          onClick={() => handleRSVP(subevent.id, 'MAYBE')}
                          className={`btn btn-xs ${
                            userRSVP?.status === 'MAYBE'
                              ? 'bg-yellow-500 text-white'
                              : 'btn-secondary'
                          }`}
                        >
                          ? Maybe
                        </button>
                        <button
                          onClick={() => handleRSVP(subevent.id, 'NOT_ATTENDING')}
                          className={`btn btn-xs ${
                            userRSVP?.status === 'NOT_ATTENDING'
                              ? 'bg-red-500 text-white'
                              : 'btn-secondary'
                          }`}
                        >
                          ✗ No
                        </button>
                      </div>

                      {/* Attendees */}
                      {subevent.attendees.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Users className="w-4 h-4 text-gray-600" />
                            <span className="text-sm font-medium text-gray-700">
                              {subevent.attendees.filter(a => a.status === 'ATTENDING').length} attending
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {subevent.attendees
                              .filter(a => a.status === 'ATTENDING')
                              .map((attendee) => (
                                <div
                                  key={attendee.id}
                                  className="flex items-center gap-1 bg-white rounded-full px-2 py-1 text-xs"
                                >
                                  {attendee.user.profilePicture ? (
                                    <img
                                      src={`${attendee.user.profilePicture}`}
                                      alt={attendee.user.firstName}
                                      className="w-4 h-4 rounded-full"
                                    />
                                  ) : (
                                    <div className="w-4 h-4 rounded-full bg-gray-200" />
                                  )}
                                  <span>{attendee.user.firstName}</span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 mb-2">No activities scheduled yet</p>
          <p className="text-sm text-gray-500">Add activities to plan your event schedule</p>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white p-4 rounded-t-lg">
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

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Activity Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="input w-full"
                  placeholder="Morning hike to the lookout"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type *
                </label>
                <select
                  value={formData.activityType}
                  onChange={(e) => setFormData({ ...formData, activityType: e.target.value })}
                  className="input w-full"
                >
                  {ACTIVITY_TYPES.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="input w-full"
                  min={eventStartDate.split('T')[0]}
                  max={eventEndDate.split('T')[0]}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="input w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="input w-full"
                  placeholder="Trailhead parking lot"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="input w-full"
                  placeholder="Details about this activity..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleCreateSubevent}
                  className="btn btn-primary flex-1"
                >
                  {editingSubevent ? 'Save Changes' : 'Add Activity'}
                </button>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingSubevent(null);
                  }}
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

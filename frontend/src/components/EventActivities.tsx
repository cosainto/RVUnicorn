import { useState, useEffect } from 'react';
import { Calendar, MapPin, Clock, Trash2, Check, X, Loader2, ExternalLink } from 'lucide-react';
import api from '../services/api';

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

interface EventActivitiesProps {
  eventId: string;
  startDate: string;
  endDate: string;
  isOrganizer: boolean;
  isAttendee: boolean;
}

export default function EventActivities({ eventId, startDate, endDate, isOrganizer, isAttendee }: EventActivitiesProps) {
  const [activities, setActivities] = useState<EventActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    loadActivities();
  }, [eventId]);

  const loadActivities = async () => {
    try {
      const { data } = await api.get(`/events/${eventId}/activities`);
      setActivities(data);
    } catch (error) {
      console.error('Load activities error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (activityId: string) => {
    if (!confirm('Remove this activity from the trip?')) return;
    try {
      setDeletingId(activityId);
      await api.delete(`/events/${eventId}/activities/${activityId}`);
      setActivities(prev => prev.filter(a => a.id !== activityId));
    } catch (error) {
      console.error('Delete activity error:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const handleStatusChange = async (activityId: string, status: string) => {
    try {
      setUpdatingId(activityId);
      await api.patch(`/events/${eventId}/activities/${activityId}`, { status });
      setActivities(prev => prev.map(a => a.id === activityId ? { ...a, status } : a));
    } catch (error) {
      console.error('Update status error:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  const canEdit = isOrganizer || isAttendee;

  // Group activities by date
  const groupedActivities = activities.reduce((acc, activity) => {
    const date = activity.scheduledDate 
      ? new Date(activity.scheduledDate).toLocaleDateString() 
      : 'Unscheduled';
    if (!acc[date]) acc[date] = [];
    acc[date].push(activity);
    return acc;
  }, {} as Record<string, EventActivity[]>);

  // Generate trip dates
  const tripDates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    tripDates.push(new Date(d).toLocaleDateString());
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8 bg-gray-50 rounded-xl">
        <Calendar className="w-12 h-12 mx-auto text-gray-300 mb-3" />
        <p className="text-gray-600 font-medium">No activities planned yet</p>
        <p className="text-sm text-gray-400 mt-1">
          Save things to do from the campground page and add them to your trip
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Calendar className="w-5 h-5 text-blue-600" />
        Trip Activities
      </h3>

      {/* Show by date */}
      {tripDates.map(date => {
        const dateActivities = groupedActivities[date] || [];
        if (dateActivities.length === 0 && !groupedActivities['Unscheduled']) return null;
        
        return (
          <div key={date} className="space-y-3">
            <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
              {date === 'Unscheduled' ? date : new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </h4>
            
            {dateActivities.map(activity => (
              <div 
                key={activity.id} 
                className={`flex items-start gap-4 p-4 bg-white border rounded-xl transition ${
                  activity.status === 'COMPLETED' ? 'border-green-200 bg-green-50/50' :
                  activity.status === 'SKIPPED' ? 'border-gray-200 bg-gray-50 opacity-60' :
                  'border-gray-200 hover:border-blue-200'
                }`}
              >
                {activity.thingToDo.imageUrl && (
                  <img 
                    src={activity.thingToDo.imageUrl} 
                    alt={activity.thingToDo.title}
                    className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                  />
                )}
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className={`font-medium ${activity.status === 'COMPLETED' ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                        {activity.thingToDo.title}
                      </h4>
                      {activity.thingToDo.address && (
                        <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" />
                          {activity.thingToDo.address}
                        </p>
                      )}
                    </div>
                    
                    {canEdit && (
                      <div className="flex items-center gap-1">
                        {activity.status !== 'COMPLETED' && (
                          <button
                            onClick={() => handleStatusChange(activity.id, 'COMPLETED')}
                            disabled={updatingId === activity.id}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"
                            title="Mark complete"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        {activity.status !== 'SKIPPED' && activity.status !== 'COMPLETED' && (
                          <button
                            onClick={() => handleStatusChange(activity.id, 'SKIPPED')}
                            disabled={updatingId === activity.id}
                            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"
                            title="Skip"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                        {activity.status !== 'PLANNED' && (
                          <button
                            onClick={() => handleStatusChange(activity.id, 'PLANNED')}
                            disabled={updatingId === activity.id}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="Reset to planned"
                          >
                            ↺
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(activity.id)}
                          disabled={deletingId === activity.id}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          title="Remove"
                        >
                          {deletingId === activity.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    {activity.scheduledTime && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {activity.scheduledTime}
                      </span>
                    )}
                    {activity.duration && (
                      <span>{activity.duration} min</span>
                    )}
                    <a 
                      href={activity.thingToDo.sourceUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-600 flex items-center gap-1"
                    >
                      View <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  
                  {activity.notes && (
                    <p className="text-sm text-gray-600 mt-2 italic">"{activity.notes}"</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      })}
      
      {/* Unscheduled activities */}
      {groupedActivities['Unscheduled']?.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Unscheduled</h4>
          {groupedActivities['Unscheduled'].map(activity => (
            <div 
              key={activity.id} 
              className="flex items-start gap-4 p-4 bg-white border border-dashed border-gray-300 rounded-xl"
            >
              {activity.thingToDo.imageUrl && (
                <img 
                  src={activity.thingToDo.imageUrl} 
                  alt={activity.thingToDo.title}
                  className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                />
              )}
              <div className="flex-1">
                <h4 className="font-medium text-gray-900">{activity.thingToDo.title}</h4>
                {activity.thingToDo.address && (
                  <p className="text-sm text-gray-500">{activity.thingToDo.address}</p>
                )}
              </div>
              {canEdit && (
                <button
                  onClick={() => handleDelete(activity.id)}
                  disabled={deletingId === activity.id}
                  className="p-1.5 text-red-400 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

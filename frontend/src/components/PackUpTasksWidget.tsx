import { useState, useEffect } from 'react';
import { Package, ChevronRight, CheckCircle, Clock, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';

interface PackUpTask {
  id: string;
  name: string;
  category: string;
  quantity: number;
}

interface EventTasks {
  event: {
    id: string;
    title: string;
    startDate: string;
    endDate: string;
    campground?: { name: string };
  };
  items: PackUpTask[];
}

interface PackUpTasksData {
  tasks: EventTasks[];
  totalItems: number;
}

export default function PackUpTasksWidget() {
  const [data, setData] = useState<PackUpTasksData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      const { data } = await api.get('/packup/my-tasks');
      setData(data);
    } catch (error) {
      console.error('Load pack-up tasks error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="animate-pulse">
          <div className="h-5 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (!data || data.totalItems === 0) {
    return null; // Don't show widget if no tasks
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'Trip ended';
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 7) return `In ${diffDays} days`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const isUrgent = (endDate: string) => {
    const date = new Date(endDate);
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 1;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-orange-50 to-amber-50 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-orange-600" />
            <h3 className="font-semibold text-gray-900">Pack-Up Tasks</h3>
          </div>
          <span className="px-2 py-1 bg-orange-100 text-orange-700 text-sm font-medium rounded-full">
            {data.totalItems} item{data.totalItems !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Tasks by event */}
      <div className="divide-y">
        {data.tasks.map(eventTask => (
          <Link
            key={eventTask.event.id}
            to={`/events/${eventTask.event.id}?tab=packup`}
            className="block p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                {/* Event info */}
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-sm font-medium ${isUrgent(eventTask.event.endDate) ? 'text-red-600' : 'text-gray-600'}`}>
                    <Clock className="w-3 h-3 inline mr-1" />
                    {formatDate(eventTask.event.endDate)}
                  </span>
                  {isUrgent(eventTask.event.endDate) && (
                    <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded">
                      Pack up soon!
                    </span>
                  )}
                </div>
                
                <h4 className="font-medium text-gray-900 truncate">
                  {eventTask.event.title}
                </h4>
                
                {eventTask.event.campground && (
                  <div className="flex items-center gap-1 text-sm text-gray-500 mt-0.5">
                    <MapPin className="w-3 h-3" />
                    {eventTask.event.campground.name}
                  </div>
                )}

                {/* Item preview */}
                <div className="mt-2 flex flex-wrap gap-1">
                  {eventTask.items.slice(0, 3).map(item => (
                    <span
                      key={item.id}
                      className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded"
                    >
                      {item.name}
                      {item.quantity > 1 && ` ×${item.quantity}`}
                    </span>
                  ))}
                  {eventTask.items.length > 3 && (
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">
                      +{eventTask.items.length - 3} more
                    </span>
                  )}
                </div>
              </div>

              <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
            </div>
          </Link>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-gray-50 border-t">
        <p className="text-xs text-gray-500 text-center">
          Items assigned to you for pack-up
        </p>
      </div>
    </div>
  );
}

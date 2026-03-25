import { useEffect, useState } from 'react';
import api from '../services/api';

interface Activity {
  emoji: string;
  title: string;
  reason: string;
  duration: string;
}

interface Props {
  lat: number;
  lon: number;
  campgroundName?: string;
  compact?: boolean;
  eventId?: string;
  onThingsToDo?: () => void;
}

export default function WeatherActivities({ lat, lon, campgroundName, compact = false, eventId, onThingsToDo }: Props) {
  const [weather, setWeather] = useState<any>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [addedToSchedule, setAddedToSchedule] = useState<Set<number>>(new Set());
  const [addingIdx, setAddingIdx] = useState<number | null>(null);

  const handleAddToSchedule = async (activity: Activity, idx: number) => {
    if (!eventId || addedToSchedule.has(idx)) return;
    setAddingIdx(idx);
    try {
      await api.post(`/events/${eventId}/schedule-item`, {
        title: activity.title,
        description: activity.reason,
        notes: activity.duration ? `Duration: ${activity.duration}` : undefined,
      });
      setAddedToSchedule(prev => new Set([...prev, idx]));
    } catch {
      alert('Failed to add to schedule');
    }
    setAddingIdx(null);
  };
  const [loading, setLoading] = useState(true);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [showActivities, setShowActivities] = useState(false);

  useEffect(() => {
    api.get('/weather/forecast', { params: { lat, lon } })
      .then(({ data }) => setWeather(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [lat, lon]);

  const fetchActivities = async () => {
    if (activities.length > 0) { setShowActivities(true); return; }
    setLoadingActivities(true);
    setShowActivities(true);
    try {
      const { data } = await api.get('/weather/activities', { params: { lat, lon, campgroundName } });
      setActivities(data.activities || []);
    } catch (e) { console.error(e); }
    finally { setLoadingActivities(false); }
  };

  if (loading) return <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />;
  if (!weather?.current) return null;

  const w = weather.current;
  const isHot = w.temperature > 85;
  const isCold = w.temperature < 45;
  const isRainy = w.shortForecast?.toLowerCase().includes('rain') || w.shortForecast?.toLowerCase().includes('shower');
  const bgGradient = isRainy ? 'from-slate-500 to-slate-600' : isHot ? 'from-orange-400 to-amber-500' : isCold ? 'from-blue-500 to-indigo-600' : 'from-sky-400 to-blue-500';
  const weatherEmoji = isRainy ? '🌧️' : isHot ? '☀️' : isCold ? '🥶' : '⛅';

  if (compact) {
    return (
      <div className={`bg-gradient-to-r ${bgGradient} rounded-xl p-3 text-white`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{weatherEmoji}</span>
            <div>
              <div className="font-bold text-sm">{w.temperature}°{w.temperatureUnit} · {w.shortForecast}</div>
              <div className="text-xs text-white/80">{w.windSpeed} winds</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {onThingsToDo && (
              <button
                onClick={onThingsToDo}
                className="text-xs bg-white/20 hover:bg-white/30 px-2.5 py-1.5 rounded-lg font-semibold transition flex items-center gap-1"
                title="Things To Do Nearby"
              >
                <span>+</span>
                <span>Things To Do</span>
              </button>
            )}
            <button onClick={fetchActivities} className="text-xs bg-white/20 hover:bg-white/30 px-2.5 py-1.5 rounded-lg font-semibold transition">
              Activities →
            </button>
          </div>
        </div>
        {showActivities && (
          <div className="mt-3 space-y-2">
            {loadingActivities ? (
              <div className="text-xs text-white/70 animate-pulse">Finding perfect activities...</div>
            ) : activities.map((a, i) => (
              <div key={i} className="flex items-start gap-2 bg-white/10 rounded-lg px-3 py-2">
                <span className="text-lg flex-shrink-0">{a.emoji}</span>
                <div className="min-w-0">
                  <div className="font-semibold text-sm">{a.title}</div>
                  <div className="text-xs text-white/80">{a.reason} · {a.duration}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className={`bg-gradient-to-r ${bgGradient} px-4 py-3`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{weatherEmoji}</span>
            <div>
              <div className="text-white font-bold">{w.temperature}°{w.temperatureUnit} · {w.name}</div>
              <div className="text-white/80 text-xs">{w.shortForecast}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-white/80 text-xs">{w.windSpeed}</div>
          </div>
        </div>
      </div>

      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <span className="text-sm font-bold text-gray-900">Suggested Activities</span>
        <button onClick={fetchActivities} disabled={loadingActivities}
          className="text-xs text-orange-500 hover:text-orange-600 font-semibold transition disabled:opacity-50">
          {loadingActivities ? 'Loading...' : activities.length > 0 ? 'Refresh' : 'Get suggestions →'}
        </button>
      </div>

      {showActivities && !loadingActivities && activities.length > 0 && (
        <div className="divide-y divide-gray-50">
          {activities.map((a, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3">
              <span className="text-2xl flex-shrink-0">{a.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-gray-900">{a.title}</div>
                <div className="text-xs text-gray-500 mt-0.5">{a.reason}</div>
                <div className="text-xs text-gray-400 mt-0.5">{a.duration}</div>
              </div>
              {eventId && (
                <button
                  onClick={() => handleAddToSchedule(a, i)}
                  disabled={addingIdx === i || addedToSchedule.has(i)}
                  className={`text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0 transition ${
                    addedToSchedule.has(i)
                      ? 'bg-green-100 text-green-700 cursor-default'
                      : 'bg-primary-50 text-primary-700 hover:bg-primary-100'
                  }`}
                >
                  {addedToSchedule.has(i) ? '✓ Added' : addingIdx === i ? '...' : '+ Schedule'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showActivities && loadingActivities && (
        <div className="px-4 py-6 text-center text-sm text-gray-400 animate-pulse">Finding perfect activities for this weather...</div>
      )}

      {!showActivities && (
        <div className="px-4 py-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {weather.forecast?.slice(1, 5).map((p: any, i: number) => (
              <div key={i} className="flex-shrink-0 text-center px-3 py-2 bg-gray-50 rounded-xl min-w-[60px]">
                <div className="text-xs text-gray-500 mb-1">{p.name?.split(' ').slice(-1)[0]}</div>
                <div className="text-sm font-bold text-gray-800">{p.temperature}°</div>
                <div className="text-[10px] text-gray-400 mt-0.5 w-14 truncate">{p.shortForecast}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

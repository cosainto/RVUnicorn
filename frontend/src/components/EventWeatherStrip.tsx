import { useState, useEffect } from 'react';
import api from '../services/api';

interface Props {
  latitude: number;
  longitude: number;
  startDate: string;
  endDate: string;
}

function getWeatherIcon(forecast: string, temp: number): string {
  const f = forecast.toLowerCase();
  if (f.includes('thunder') || f.includes('storm')) return '⛈️';
  if (f.includes('snow') || f.includes('blizzard')) return '❄️';
  if (f.includes('rain') || f.includes('shower') || f.includes('drizzle')) return '🌧️';
  if (f.includes('fog') || f.includes('mist') || f.includes('haze')) return '🌫️';
  if (f.includes('cloud') || f.includes('overcast')) return '☁️';
  if (f.includes('partly')) return '⛅';
  if (temp >= 90) return '🌡️';
  return '☀️';
}

export default function EventWeatherStrip({ latitude, longitude, startDate, endDate }: Props) {
  const [weather, setWeather] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get('/weather/forecast', { params: { lat: latitude, lon: longitude } });
        setWeather(data);
      } catch {}
      finally { setLoading(false); }
    };
    load();
  }, [latitude, longitude]);

  if (loading) return (
    <div className="flex items-center gap-2 text-sm text-gray-400 animate-pulse">
      <span>🌤️</span><span>Loading weather...</span>
    </div>
  );
  if (!weather) return null;

  const now = new Date();
  const tripEnd = new Date(endDate || startDate);
  const current = weather.current;

  // Just show daytime forecast periods (skip tonight/current)
  const tripPeriods = (weather.forecast || weather.periods || []).filter((p: any) => {
    return p.isDaytime && p.name !== 'This Afternoon' && p.name !== 'Today';
  }).slice(0, 5);

  // Build a uniform list: current weather as "Now" + forecast days
  const allDays: { label: string; temp: string; icon: string; condition: string; bgClass: string }[] = [];

  if (current) {
    allDays.push({
      label: 'Now',
      temp: `${current.temperature}°${current.temperatureUnit || 'F'}`,
      icon: getWeatherIcon(current.shortForecast, current.temperature),
      condition: (current.shortForecast || '').split(' ').slice(0, 2).join(' '),
      bgClass: 'bg-blue-50 border-blue-100',
    });
  }

  for (const p of tripPeriods) {
    const isBad = /thunder|heavy rain|storm|snow|blizzard/.test((p.shortForecast || '').toLowerCase());
    const isCaution = !isBad && /rain|shower|wind|fog/.test((p.shortForecast || '').toLowerCase());
    allDays.push({
      label: (p.name || '').split(' ')[0],
      temp: p.temperature ? `${p.temperature}°${p.temperatureUnit || 'F'}` : '',
      icon: getWeatherIcon(p.shortForecast || p.detailedForecast || '', p.temperature),
      condition: (p.shortForecast || '').split(' ').slice(0, 2).join(' '),
      bgClass: isBad ? 'bg-red-50 border-red-200' : isCaution ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100',
    });
  }

  return (
    <div className="flex flex-row gap-3 overflow-x-auto scrollbar-hide">
      {allDays.map((d, i) => (
        <div key={i} className={`flex-1 min-w-[72px] flex flex-col items-center px-2.5 py-2 rounded-xl border text-center ${d.bgClass}`}>
          <p className="text-xs text-gray-500 font-semibold">{d.label}</p>
          <span className="text-xl my-1">{d.icon}</span>
          <p className="text-sm font-bold text-gray-900">{d.temp}</p>
          <p className="text-[10px] text-gray-400 leading-tight">{d.condition}</p>
        </div>
      ))}
    </div>
  );
}

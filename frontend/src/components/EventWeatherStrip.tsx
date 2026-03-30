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

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {current && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
          <span className="text-2xl">{getWeatherIcon(current.shortForecast, current.temperature)}</span>
          <div>
            <p className="text-sm font-bold text-gray-900">{current.temperature}°{current.temperatureUnit}</p>
            <p className="text-xs text-gray-500">{current.shortForecast}</p>
          </div>
        </div>
      )}
      {tripPeriods.map((p: any, i: number) => {
        const icon = getWeatherIcon(p.shortForecast || p.detailedForecast || '', p.temperature);
        const isBad = /thunder|heavy rain|storm|snow|blizzard/.test((p.shortForecast || '').toLowerCase());
        const isCaution = !isBad && /rain|shower|wind|fog/.test((p.shortForecast || '').toLowerCase());
        const bgClass = isBad ? 'bg-red-50 border-red-200' : isCaution ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100';
        const shortDay = (p.name || '').split(' ')[0];
        const shortDate = p.temperature ? p.temperature + '°' + (p.temperatureUnit || 'F') : '';
        return (
          <div key={i} className={"flex flex-col items-center px-2.5 py-1.5 rounded-xl border text-center " + bgClass} style={{ minWidth: '58px' }}>
            <p className="text-xs text-gray-500 font-medium">{shortDay}</p>
            <p className="text-xs text-gray-400" style={{ fontSize: '10px' }}>{shortDate}</p>
            <span className="text-xl my-0.5">{icon}</span>
            <p className="text-xs text-gray-400 leading-tight" style={{ fontSize: '10px' }}>{(p.shortForecast || '').split(' ').slice(0, 2).join(' ')}</p>
          </div>
        );
      })}
    </div>
  );
}

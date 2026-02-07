import { useState, useEffect } from 'react';
import { Cloud, Sun, CloudRain, Wind, Snowflake, CloudLightning, Thermometer } from 'lucide-react';
import api from '../services/api';

interface WeatherProps {
  latitude: number;
  longitude: number;
}

interface WeatherData {
  location: {
    city: string;
    state: string;
  };
  current: {
    name: string;
    temperature: number;
    temperatureUnit: string;
    windSpeed: string;
    windDirection: string;
    shortForecast: string;
    detailedForecast: string;
    icon: string;
    isDaytime: boolean;
  };
  forecast: Array<{
    name: string;
    temperature: number;
    temperatureUnit: string;
    windSpeed: string;
    shortForecast: string;
    icon: string;
    isDaytime: boolean;
  }>;
}

const getWeatherIcon = (forecast: string, isDaytime: boolean) => {
  const f = forecast.toLowerCase();
  if (f.includes('thunder') || f.includes('storm')) return <CloudLightning className="w-8 h-8 text-purple-500" />;
  if (f.includes('snow') || f.includes('flurr')) return <Snowflake className="w-8 h-8 text-blue-300" />;
  if (f.includes('rain') || f.includes('shower')) return <CloudRain className="w-8 h-8 text-blue-500" />;
  if (f.includes('cloud') || f.includes('overcast')) return <Cloud className="w-8 h-8 text-gray-500" />;
  if (f.includes('wind')) return <Wind className="w-8 h-8 text-teal-500" />;
  return isDaytime ? <Sun className="w-8 h-8 text-yellow-500" /> : <Cloud className="w-8 h-8 text-gray-600" />;
};

const getSmallWeatherIcon = (forecast: string, isDaytime: boolean) => {
  const f = forecast.toLowerCase();
  if (f.includes('thunder') || f.includes('storm')) return <CloudLightning className="w-5 h-5 text-purple-500" />;
  if (f.includes('snow') || f.includes('flurr')) return <Snowflake className="w-5 h-5 text-blue-300" />;
  if (f.includes('rain') || f.includes('shower')) return <CloudRain className="w-5 h-5 text-blue-500" />;
  if (f.includes('cloud') || f.includes('overcast')) return <Cloud className="w-5 h-5 text-gray-500" />;
  if (f.includes('wind')) return <Wind className="w-5 h-5 text-teal-500" />;
  return isDaytime ? <Sun className="w-5 h-5 text-yellow-500" /> : <Cloud className="w-5 h-5 text-gray-600" />;
};

export default function CampgroundWeather({ latitude, longitude }: WeatherProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const fetchWeather = async () => {
      if (!latitude || !longitude) {
        setError('Location not available');
        setLoading(false);
        return;
      }
      
      try {
        const { data } = await api.get(`/weather/forecast?lat=${latitude}&lon=${longitude}`);
        setWeather(data);
        setError(null);
      } catch (err: any) {
        console.error('Weather fetch error:', err);
        setError('Weather not available');
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
  }, [latitude, longitude]);

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-sky-100 rounded-xl p-4 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-2"></div>
        <div className="h-10 bg-gray-200 rounded w-1/2"></div>
      </div>
    );
  }

  if (error || !weather?.current) {
    return null; // Don't show anything if weather unavailable
  }

  const { current, forecast } = weather;

  return (
    <div className="bg-gradient-to-br from-blue-50 to-sky-100 rounded-xl p-4 shadow-sm">
      {/* Current Weather */}
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          {getWeatherIcon(current.shortForecast, current.isDaytime)}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold text-gray-800">
                {current.temperature}°{current.temperatureUnit}
              </span>
              <span className="text-gray-600">{current.shortForecast}</span>
            </div>
            <div className="text-sm text-gray-500 flex items-center gap-1">
              <Wind className="w-4 h-4" />
              {current.windSpeed} {current.windDirection}
            </div>
          </div>
        </div>
        <div className="text-gray-400 text-sm">
          {expanded ? '▲' : '▼'}
        </div>
      </div>

      {/* Expanded Forecast */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-blue-200">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">5-Day Forecast</h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {forecast.slice(0, 10).filter((_, i) => i % 2 === 0).map((period, idx) => (
              <div 
                key={idx} 
                className="bg-white/60 rounded-lg p-2 text-center"
              >
                <div className="text-xs text-gray-600 font-medium truncate">{period.name}</div>
                <div className="flex justify-center my-1">
                  {getSmallWeatherIcon(period.shortForecast, period.isDaytime)}
                </div>
                <div className="text-lg font-bold text-gray-800">
                  {period.temperature}°
                </div>
                <div className="text-xs text-gray-500 truncate">{period.shortForecast}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

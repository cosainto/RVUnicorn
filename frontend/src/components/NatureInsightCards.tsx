import { useEffect, useState } from 'react';
import { Sun, Wind, TreePine, Leaf, ChevronDown, ChevronUp, AlertTriangle, X, CloudRain, Cloud, CloudSun, Snowflake, CloudLightning, Droplets, Thermometer, Shield, Navigation } from 'lucide-react';
import SunCalc from 'suncalc';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NatureInsightCardsProps {
  lat: number | null;
  lng: number | null;
  /** Pass existing weather data from Basecamp to avoid duplicate fetches */
  weather?: { temp?: number; humidity?: number; description?: string } | null;
}

interface AqiData {
  aqi: number;
  pm25: number;
  pm10: number;
}

interface GoldenHourData {
  sunrise: string;
  sunset: string;
  goldenHourAM: string;
  goldenHourPM: string;
}

// ─── Character Avatars (placeholder) ──────────────────────────────────────────
// TODO: Replace placeholder circles with real character art when available

function CharacterAvatar({ initial, color, size = 'sm' }: { initial: string; color: string; size?: 'sm' | 'xs' }) {
  const cls = size === 'xs' ? 'w-4 h-4 text-[9px]' : 'w-5 h-5 text-[10px]';
  return (
    <div
      className={`${cls} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}
      style={{ background: color }}
    >
      {initial}
    </div>
  );
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function fmt(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function getUSRegion(lat: number, lng: number): string {
  if (lat > 44) return 'northern';
  if (lat < 33) return 'southern';
  if (lng < -104) return 'western';
  return 'eastern';
}

function getSeason(month: number): 'spring' | 'summer' | 'fall' | 'winter' {
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'fall';
  return 'winter';
}

// ─── Static Data ──────────────────────────────────────────────────────────────

const WILDLIFE_DATA: Record<string, Record<string, { animals: string[]; tip: string }>> = {
  spring: {
    northern: { animals: ['Black Bear (emerging)', 'Moose calves', 'Bald Eagle nesting', 'Wild Turkey'], tip: 'Bears are waking hungry — secure food and trash.' },
    southern: { animals: ['Alligator (active)', 'Armadillo', 'White-tailed Deer fawns', 'Painted Bunting'], tip: 'Gators on the move — keep distance near water.' },
    western: { animals: ['Mule Deer', 'Mountain Lion', 'Hummingbirds arriving', 'Rattlesnake'], tip: 'Rattlesnakes emerge with warmth — watch your step.' },
    eastern: { animals: ['White-tailed Deer', 'Red Fox kits', 'Osprey returning', 'Box Turtle'], tip: 'Fox dens near campsites — leash dogs at dawn/dusk.' },
  },
  summer: {
    northern: { animals: ['Black Bear', 'Moose', 'Loon', 'Mosquitoes (peak)'], tip: 'Moose are aggressive in summer — give 50+ yards.' },
    southern: { animals: ['Alligator', 'Coral Snake', 'Fireflies', 'Armadillo'], tip: 'Peak snake activity — flashlight on night walks.' },
    western: { animals: ['Elk herds', 'Black Bear', 'Marmot', 'Rattlesnake'], tip: 'Elk rut begins late summer — bulls are aggressive.' },
    eastern: { animals: ['Black Bear', 'Copperhead', 'Fireflies', 'White-tailed Deer'], tip: 'Bear encounters peak — bear canisters essential.' },
  },
  fall: {
    northern: { animals: ['Moose (rut)', 'Black Bear (gorging)', 'Bald Eagle', 'Gray Wolf'], tip: 'Moose rut underway — bulls are unpredictable.' },
    southern: { animals: ['Monarch migration', 'White-tailed Deer (rut)', 'Sandhill Crane'], tip: 'Deer rut = more on roads — caution at dusk.' },
    western: { animals: ['Elk (bugling)', 'Grizzly Bear (gorging)', 'Bighorn Sheep', 'Bald Eagle'], tip: 'Bears in hyperphagia — triple-check food storage.' },
    eastern: { animals: ['Black Bear', 'White-tailed Deer (rut)', 'Turkey', 'Hawk migration'], tip: 'Hunting season open — wear blaze orange on hikes.' },
  },
  winter: {
    northern: { animals: ['Snowy Owl', 'Bald Eagle', 'Coyote', 'Snowshoe Hare'], tip: 'Wildlife stressed by cold — observe from distance.' },
    southern: { animals: ['Manatee (warm springs)', 'Whooping Crane', 'Bald Eagle', 'Bobcat'], tip: 'Manatees at warm springs — kayak slowly.' },
    western: { animals: ['Bald Eagle', 'Elk (wintering)', 'Bighorn Sheep', 'Mule Deer'], tip: 'Elk descend to valleys — stay in your vehicle.' },
    eastern: { animals: ['Bald Eagle', 'Coyote', 'Deer (yarding)', 'Great Horned Owl'], tip: 'Great Horned Owls nesting — listen at dusk.' },
  },
};

const FORAGING_DATA: Record<string, Record<string, { finds: string[]; tip: string }>> = {
  spring: {
    northern: { finds: ['Ramps (wild leeks)', 'Fiddlehead ferns', 'Morel mushrooms', 'Dandelion greens'], tip: 'Morels appear 1-2 weeks after last frost near dying elms.' },
    southern: { finds: ['Blackberry blossoms', 'Chickweed', 'Wild onion', 'Redbud flowers'], tip: 'Redbud flowers are edible — great in trail-side salads.' },
    western: { finds: ['Miner\'s lettuce', 'Wild asparagus', 'Morel mushrooms', 'Stinging nettle'], tip: 'Miner\'s lettuce is vitamin-C rich on shady slopes.' },
    eastern: { finds: ['Ramps', 'Morel mushrooms', 'Violet flowers', 'Pawpaw blossoms'], tip: 'Ramps have a short season — harvest leaves only.' },
  },
  summer: {
    northern: { finds: ['Wild blueberries', 'Chanterelle mushrooms', 'Thimbleberry', 'Wild mint'], tip: 'Chanterelles love mossy oak forests after rain.' },
    southern: { finds: ['Muscadine grapes', 'Passion fruit', 'Blackberry', 'Elderflower'], tip: 'Muscadines ripen on vine — look along fence rows.' },
    western: { finds: ['Huckleberry', 'Wild strawberry', 'Pine nuts', 'Elderberry'], tip: 'Huckleberries at elevation — bears want them too.' },
    eastern: { finds: ['Blackberry', 'Wineberry', 'Chanterelle mushrooms', 'Sumac berries'], tip: 'Staghorn sumac makes a lemonade-like drink.' },
  },
  fall: {
    northern: { finds: ['Hen of the woods', 'Cranberry', 'Wild apple', 'Hickory nuts'], tip: 'Hen of the woods fruits at the base of oaks.' },
    southern: { finds: ['Persimmon', 'Pawpaw', 'Pecan', 'Muscadine grapes'], tip: 'Wait for persimmons to fall — unripe ones are brutal.' },
    western: { finds: ['Pine nuts', 'Juniper berries', 'Wild grape', 'Manzanita berries'], tip: 'Piñon pine nut harvest — look for open cones.' },
    eastern: { finds: ['Pawpaw', 'Persimmon', 'Hen of the woods', 'Black walnut'], tip: 'Pawpaws taste like tropical custard — check creek banks.' },
  },
  winter: {
    northern: { finds: ['Birch bark tea', 'Rose hips', 'Dried mushrooms', 'Pine needle tea'], tip: 'Pine needle tea is packed with vitamin C.' },
    southern: { finds: ['Citrus (feral)', 'Saw palmetto berries', 'Chickweed', 'Dandelion'], tip: 'Feral citrus near old homesteads — worth the detour.' },
    western: { finds: ['Pine needle tea', 'Rose hips', 'Juniper berries', 'Dried manzanita'], tip: 'Rose hips sweeten after a hard frost.' },
    eastern: { finds: ['Wintergreen berries', 'Rose hips', 'Pine needle tea', 'Oyster mushrooms'], tip: 'Oyster mushrooms fruit on dead hardwoods after rain.' },
  },
};

// ─── Card Wrapper ─────────────────────────────────────────────────────────────

function InsightCard({
  icon,
  title,
  borderColor,
  headerGradient,
  titleColor,
  avatar,
  badge,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  borderColor: string;
  headerGradient: string;
  titleColor: string;
  avatar: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className={`bg-white rounded-xl border overflow-hidden ${borderColor}`}>
      <div className={`px-3 py-2 border-b flex items-center gap-1.5 ${borderColor} ${headerGradient}`}>
        {avatar}
        <span className="text-base flex-shrink-0">{icon}</span>
        <span className={`font-bold text-xs ${titleColor} truncate`}>{title}</span>
        {badge && <span className="ml-auto mr-1">{badge}</span>}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`ml-auto p-0.5 rounded hover:bg-black/5 transition ${titleColor} opacity-50`}
        >
          {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={() => setDismissed(true)}
          className={`p-0.5 rounded hover:bg-black/5 transition ${titleColor} opacity-40`}
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {!collapsed && (
        <div className="px-3 py-2.5">{children}</div>
      )}
    </div>
  );
}

// ─── Golden Hour Card ─────────────────────────────────────────────────────────

function GoldenHourCard({ lat, lng, weather }: { lat: number; lng: number; weather?: NatureInsightCardsProps['weather'] }) {
  const [data, setData] = useState<GoldenHourData | null>(null);

  useEffect(() => {
    const now = new Date();
    const times = SunCalc.getTimes(now, lat, lng);
    setData({
      sunrise: fmt(times.sunrise),
      sunset: fmt(times.sunset),
      goldenHourAM: fmt(times.goldenHourEnd),
      goldenHourPM: fmt(times.goldenHour),
    });
  }, [lat, lng]);

  if (!data) return null;

  return (
    <InsightCard
      icon={<Sun className="w-3.5 h-3.5 text-amber-500" />}
      title="Golden Hour"
      borderColor="border-amber-200"
      headerGradient="bg-gradient-to-r from-amber-50 to-orange-50"
      titleColor="text-amber-900"
      avatar={/* TODO: Replace with real Hitch character art */ <CharacterAvatar initial="H" color="#7c3aed" />}
    >
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="bg-amber-50/80 rounded-lg px-2 py-1.5 text-center">
          <p className="text-[10px] text-amber-600 font-medium">🌅 Sunrise</p>
          <p className="text-sm font-bold text-amber-900">{data.sunrise}</p>
          <p className="text-[10px] text-amber-400">Golden til {data.goldenHourAM}</p>
        </div>
        <div className="bg-orange-50/80 rounded-lg px-2 py-1.5 text-center">
          <p className="text-[10px] text-orange-600 font-medium">🌇 Sunset</p>
          <p className="text-sm font-bold text-orange-900">{data.sunset}</p>
          <p className="text-[10px] text-orange-400">Golden from {data.goldenHourPM}</p>
        </div>
      </div>
      {weather?.description && (
        <p className="text-[10px] text-amber-600 mb-1">{weather.description}{weather.temp != null ? ` · ${Math.round(weather.temp)}°F` : ''}</p>
      )}
      <p className="text-[10px] text-gray-400 italic mt-1">"Chase the light, not the likes." — Hitch 🦄</p>
    </InsightCard>
  );
}

// ─── Wildlife Activity Card ───────────────────────────────────────────────────

function WildlifeActivityCard({ lat, lng }: { lat: number; lng: number }) {
  const month = new Date().getMonth() + 1;
  const season = getSeason(month);
  const region = getUSRegion(lat, lng);
  const data = WILDLIFE_DATA[season]?.[region];

  if (!data) return null;

  return (
    <InsightCard
      icon="🦌"
      title="Wildlife Activity"
      borderColor="border-green-200"
      headerGradient="bg-gradient-to-r from-green-50 to-emerald-50"
      titleColor="text-green-900"
      avatar={/* TODO: Replace with real Ranger Rick character art */ <CharacterAvatar initial="R" color="#16a34a" />}
    >
      <div className="grid grid-cols-2 gap-1.5 mb-2">
        {data.animals.map((animal) => (
          <div key={animal} className="flex items-center gap-1 bg-green-50/60 rounded px-2 py-1">
            <TreePine className="w-3 h-3 text-green-500 flex-shrink-0" />
            <span className="text-[11px] text-green-900 truncate">{animal}</span>
          </div>
        ))}
      </div>
      <div className="bg-amber-50 rounded px-2 py-1.5 mb-1.5">
        <p className="text-[10px] text-amber-800 font-medium">
          <AlertTriangle className="w-2.5 h-2.5 inline mr-0.5 -mt-0.5" />
          {data.tip}
        </p>
      </div>
      <p className="text-[10px] text-gray-400 italic">"Observe, don't audition." — Ranger Rick 🏕️</p>
    </InsightCard>
  );
}

// ─── Foraging Forecast Card ──────────────────────────────────────────────────

function ForagingForecastCard({ lat, lng }: { lat: number; lng: number }) {
  const month = new Date().getMonth() + 1;
  const season = getSeason(month);
  const region = getUSRegion(lat, lng);
  const data = FORAGING_DATA[season]?.[region];

  if (!data) return null;

  return (
    <InsightCard
      icon={<Leaf className="w-3.5 h-3.5 text-lime-600" />}
      title="Foraging Forecast"
      borderColor="border-lime-200"
      headerGradient="bg-gradient-to-r from-lime-50 to-green-50"
      titleColor="text-lime-900"
      avatar={/* TODO: Replace with real Walter character art */ <CharacterAvatar initial="W" color="#854d0e" />}
    >
      <div className="grid grid-cols-2 gap-1.5 mb-2">
        {data.finds.map((find) => (
          <div key={find} className="flex items-center gap-1 bg-lime-50/60 rounded px-2 py-1">
            <span className="text-[11px]">🌿</span>
            <span className="text-[11px] text-lime-900 font-medium truncate">{find}</span>
          </div>
        ))}
      </div>
      <div className="bg-lime-50 rounded px-2 py-1.5 mb-1.5">
        <p className="text-[10px] text-lime-800">{data.tip}</p>
      </div>
      <p className="text-[10px] text-gray-400 italic">"Nature sets the table — know when to sit." — Walter 🍄</p>
    </InsightCard>
  );
}

// ─── Air Quality Index Card ──────────────────────────────────────────────────

function aqiLabel(aqi: number): { label: string; color: string; bg: string } {
  if (aqi <= 50) return { label: 'Good', color: 'text-green-700', bg: 'bg-green-100' };
  if (aqi <= 100) return { label: 'Moderate', color: 'text-yellow-700', bg: 'bg-yellow-100' };
  if (aqi <= 150) return { label: 'Unhealthy (Sensitive)', color: 'text-orange-700', bg: 'bg-orange-100' };
  if (aqi <= 200) return { label: 'Unhealthy', color: 'text-red-700', bg: 'bg-red-100' };
  return { label: 'Hazardous', color: 'text-red-900', bg: 'bg-red-200' };
}

function AirQualityCard({ lat, lng }: { lat: number; lng: number }) {
  const [data, setData] = useState<AqiData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=us_aqi,pm2_5,pm10`,
      { signal: controller.signal }
    )
      .then((r) => r.json())
      .then((d) => {
        if (d.current) {
          setData({
            aqi: Math.round(d.current.us_aqi ?? 0),
            pm25: d.current.pm2_5 ?? 0,
            pm10: d.current.pm10 ?? 0,
          });
        }
      })
      .catch(() => setError(true));
    return () => controller.abort();
  }, [lat, lng]);

  if (error || !data) return null;

  const info = aqiLabel(data.aqi);
  const isWarning = data.aqi > 100;

  return (
    <InsightCard
      icon={<Wind className="w-3.5 h-3.5 text-sky-500" />}
      title="Air Quality"
      borderColor={isWarning ? 'border-red-300' : 'border-sky-200'}
      headerGradient={isWarning
        ? 'bg-gradient-to-r from-red-50 to-orange-50'
        : 'bg-gradient-to-r from-sky-50 to-blue-50'}
      titleColor={isWarning ? 'text-red-900' : 'text-sky-900'}
      avatar={/* TODO: Replace with real Hitch character art */ <CharacterAvatar initial="H" color="#7c3aed" />}
      badge={isWarning ? (
        <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse flex items-center gap-0.5">
          <AlertTriangle className="w-2.5 h-2.5" /> Warning
        </span>
      ) : undefined}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className={`rounded-lg px-3 py-2 text-center ${info.bg}`}>
          <p className={`text-xl font-bold ${info.color}`}>{data.aqi}</p>
          <p className={`text-[10px] font-medium ${info.color}`}>US AQI</p>
        </div>
        <div className="flex-1 space-y-0.5">
          <p className={`text-xs font-bold ${info.color}`}>{info.label}</p>
          <p className="text-[10px] text-gray-500">PM2.5: {data.pm25.toFixed(1)} · PM10: {data.pm10.toFixed(1)} µg/m³</p>
        </div>
      </div>
      {isWarning && (
        <div className="bg-red-50 rounded px-2 py-1.5 mb-1.5">
          <p className="text-[10px] text-red-800 font-medium">
            <AlertTriangle className="w-2.5 h-2.5 inline mr-0.5 -mt-0.5" />
            Limit outdoor activity. Close windows, AC on recirculate.
          </p>
        </div>
      )}
      <p className="text-[10px] text-gray-400 italic">
        {isWarning ? '"Breathe easy — or don\'t." — Hitch 🦄' : '"Clear skies, clean lungs." — Hitch 🦄'}
      </p>
    </InsightCard>
  );
}

// ─── Weather Card ────────────────────────────────────────────────────────────

interface WeatherData {
  temp: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windGusts: number;
  code: number;
  isDay: boolean;
  precipitation: number;
  high: number;
  low: number;
}

function weatherLabel(code: number): string {
  if (code === 0) return 'Clear sky';
  if (code <= 3) return 'Partly cloudy';
  if (code <= 48) return 'Foggy';
  if (code <= 57) return 'Drizzle';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Rain showers';
  if (code <= 86) return 'Snow showers';
  if (code <= 99) return 'Thunderstorm';
  return 'Unknown';
}

function WeatherIcon({ code, className }: { code: number; className?: string }) {
  const cls = className || 'w-5 h-5';
  if (code === 0) return <Sun className={`${cls} text-yellow-500`} />;
  if (code <= 3) return <CloudSun className={`${cls} text-blue-400`} />;
  if (code <= 48) return <Cloud className={`${cls} text-gray-400`} />;
  if (code <= 67) return <CloudRain className={`${cls} text-blue-500`} />;
  if (code <= 77) return <Snowflake className={`${cls} text-blue-300`} />;
  if (code <= 86) return <Snowflake className={`${cls} text-blue-300`} />;
  if (code <= 99) return <CloudLightning className={`${cls} text-yellow-600`} />;
  return <Cloud className={`${cls} text-gray-400`} />;
}

function WeatherCard({ lat, lng }: { lat: number; lng: number }) {
  const [data, setData] = useState<WeatherData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,is_day&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto&forecast_days=1`,
      { signal: controller.signal }
    )
      .then((r) => r.json())
      .then((d) => {
        if (d.current) {
          setData({
            temp: Math.round(d.current.temperature_2m),
            feelsLike: Math.round(d.current.apparent_temperature),
            humidity: Math.round(d.current.relative_humidity_2m),
            windSpeed: Math.round(d.current.wind_speed_10m),
            windGusts: Math.round(d.current.wind_gusts_10m),
            code: d.current.weather_code,
            isDay: d.current.is_day === 1,
            precipitation: d.current.precipitation,
            high: Math.round(d.daily?.temperature_2m_max?.[0] ?? d.current.temperature_2m),
            low: Math.round(d.daily?.temperature_2m_min?.[0] ?? d.current.temperature_2m),
          });
        }
      })
      .catch(() => setError(true));
    return () => controller.abort();
  }, [lat, lng]);

  if (error || !data) return null;

  const condition = weatherLabel(data.code);
  const isBadWeather = data.code >= 61 || data.windGusts > 40;

  return (
    <InsightCard
      icon={<WeatherIcon code={data.code} className="w-3.5 h-3.5" />}
      title="Weather"
      borderColor={isBadWeather ? 'border-orange-300' : 'border-blue-200'}
      headerGradient={isBadWeather
        ? 'bg-gradient-to-r from-orange-50 to-yellow-50'
        : 'bg-gradient-to-r from-blue-50 to-cyan-50'}
      titleColor={isBadWeather ? 'text-orange-900' : 'text-blue-900'}
      avatar={<CharacterAvatar initial="H" color="#7c3aed" />}
      badge={isBadWeather ? (
        <span className="bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
          <AlertTriangle className="w-2.5 h-2.5" /> Advisory
        </span>
      ) : undefined}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="text-center">
          <WeatherIcon code={data.code} className="w-8 h-8 mx-auto mb-0.5" />
          <p className="text-[10px] text-gray-500 font-medium">{condition}</p>
        </div>
        <div className="flex-1">
          <p className="text-2xl font-bold text-gray-900">{data.temp}°F</p>
          <p className="text-[10px] text-gray-500">Feels like {data.feelsLike}°F · H: {data.high}° L: {data.low}°</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1.5 mb-2">
        <div className="bg-blue-50/60 rounded px-2 py-1 text-center">
          <Droplets className="w-3 h-3 text-blue-400 mx-auto mb-0.5" />
          <p className="text-[11px] font-bold text-blue-900">{data.humidity}%</p>
          <p className="text-[9px] text-blue-500">Humidity</p>
        </div>
        <div className="bg-blue-50/60 rounded px-2 py-1 text-center">
          <Wind className="w-3 h-3 text-blue-400 mx-auto mb-0.5" />
          <p className="text-[11px] font-bold text-blue-900">{data.windSpeed} mph</p>
          <p className="text-[9px] text-blue-500">Wind</p>
        </div>
        <div className="bg-blue-50/60 rounded px-2 py-1 text-center">
          <CloudRain className="w-3 h-3 text-blue-400 mx-auto mb-0.5" />
          <p className="text-[11px] font-bold text-blue-900">{data.precipitation}"</p>
          <p className="text-[9px] text-blue-500">Precip</p>
        </div>
      </div>
      {data.windGusts > 30 && (
        <div className="bg-amber-50 rounded px-2 py-1.5 mb-1.5">
          <p className="text-[10px] text-amber-800 font-medium">
            <AlertTriangle className="w-2.5 h-2.5 inline mr-0.5 -mt-0.5" />
            Wind gusts up to {data.windGusts} mph — secure awnings & outdoor gear.
          </p>
        </div>
      )}
      <p className="text-[10px] text-gray-400 italic">
        {isBadWeather ? '"Bad weather makes the best stories." — Hitch 🦄' : '"Every day outside is a good day." — Hitch 🦄'}
      </p>
    </InsightCard>
  );
}

// ─── Know Before You Go Card ─────────────────────────────────────────────────

interface NWSAlert {
  event: string;
  severity: string;
  headline: string;
  description: string;
  urgency: string;
}

interface TravelAdvisory {
  type: 'warning' | 'caution' | 'info';
  icon: string;
  title: string;
  detail: string;
}

function deriveRVAdvisories(lat: number, lng: number): TravelAdvisory[] {
  const advisories: TravelAdvisory[] = [];
  const month = new Date().getMonth() + 1;
  const hour = new Date().getHours();
  const region = getUSRegion(lat, lng);

  // Time-based advisories
  if (hour >= 16 && hour <= 19) {
    advisories.push({ type: 'caution', icon: '🚗', title: 'Rush Hour Traffic', detail: 'Peak traffic hours — expect delays on major highways near metro areas.' });
  }

  // Seasonal RV-specific
  if (month >= 6 && month <= 8 && region === 'southern') {
    advisories.push({ type: 'caution', icon: '🌡️', title: 'Extreme Heat Zone', detail: 'Temps often exceed 100°F. Run generator for AC, check tire pressure (heat = blowouts), carry extra water.' });
  }
  if (month >= 11 || month <= 3) {
    if (region === 'northern') {
      advisories.push({ type: 'warning', icon: '🧊', title: 'Freeze Risk', detail: 'Overnight temps may drop below freezing. Winterize water lines, disconnect hoses, use heat tape.' });
    }
    if (region === 'western' && lat > 37) {
      advisories.push({ type: 'caution', icon: '⛰️', title: 'Mountain Pass Conditions', detail: 'Chain requirements possible on mountain passes. Check road conditions before heading to elevation.' });
    }
  }
  if (month >= 6 && month <= 9 && region === 'western') {
    advisories.push({ type: 'caution', icon: '🔥', title: 'Wildfire Season', detail: 'Active fire season. Check InciWeb for closures. Have an evacuation plan and keep fuel above half tank.' });
  }
  if (month >= 6 && month <= 11 && region === 'southern' && lng > -90) {
    advisories.push({ type: 'caution', icon: '🌀', title: 'Hurricane Season', detail: 'Atlantic hurricane season active. Monitor NHC advisories and know your evacuation route.' });
  }

  // General RV tips by time
  if (hour >= 6 && hour <= 9) {
    advisories.push({ type: 'info', icon: '🦌', title: 'Wildlife Crossing Hours', detail: 'Dawn is peak wildlife-on-road time. Watch for deer, elk, and moose — especially near forests.' });
  }
  if (hour >= 18 && hour <= 20) {
    advisories.push({ type: 'info', icon: '🌅', title: 'Sun Glare Advisory', detail: 'Low sun angle during golden hour. Keep sunglasses handy and increase following distance.' });
  }

  return advisories;
}

function alertSeverityColor(severity: string): { border: string; bg: string; text: string } {
  switch (severity) {
    case 'Extreme': return { border: 'border-red-400', bg: 'bg-red-50', text: 'text-red-800' };
    case 'Severe': return { border: 'border-red-300', bg: 'bg-red-50', text: 'text-red-700' };
    case 'Moderate': return { border: 'border-orange-300', bg: 'bg-orange-50', text: 'text-orange-700' };
    default: return { border: 'border-yellow-300', bg: 'bg-yellow-50', text: 'text-yellow-700' };
  }
}

function KnowBeforeYouGoCard({ lat, lng }: { lat: number; lng: number }) {
  const [nwsAlerts, setNwsAlerts] = useState<NWSAlert[]>([]);
  const [uvIndex, setUvIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    // Fetch NWS active alerts
    fetch(`https://api.weather.gov/alerts/active?point=${lat},${lng}&limit=5`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'RVUnicorn/1.0 (contact@rvunicorn.com)' },
    })
      .then(r => r.json())
      .then(d => {
        const alerts = (d.features || []).map((f: any) => ({
          event: f.properties?.event || '',
          severity: f.properties?.severity || 'Minor',
          headline: f.properties?.headline || '',
          description: f.properties?.description?.slice(0, 200) || '',
          urgency: f.properties?.urgency || '',
        }));
        setNwsAlerts(alerts);
      })
      .catch(() => {});

    // Fetch UV index from Open-Meteo
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=uv_index_max&timezone=auto&forecast_days=1`,
      { signal: controller.signal }
    )
      .then(r => r.json())
      .then(d => {
        if (d.daily?.uv_index_max?.[0] != null) {
          setUvIndex(Math.round(d.daily.uv_index_max[0]));
        }
      })
      .catch(() => {});

    setLoading(false);

    return () => controller.abort();
  }, [lat, lng]);

  const rvAdvisories = deriveRVAdvisories(lat, lng);

  // Build UV advisory
  const uvAdvisories: TravelAdvisory[] = [];
  if (uvIndex !== null && uvIndex >= 6) {
    uvAdvisories.push({
      type: uvIndex >= 8 ? 'warning' : 'caution',
      icon: '☀️',
      title: `UV Index: ${uvIndex} (${uvIndex >= 11 ? 'Extreme' : uvIndex >= 8 ? 'Very High' : 'High'})`,
      detail: 'Apply SPF 30+, wear hats. Awning shade recommended. Reapply sunscreen every 2 hours.',
    });
  }

  const allAdvisories = [...uvAdvisories, ...rvAdvisories];
  const hasAlerts = nwsAlerts.length > 0;
  const hasAdvisories = allAdvisories.length > 0;
  const isWarning = hasAlerts && nwsAlerts.some(a => a.severity === 'Extreme' || a.severity === 'Severe');

  // Don't render if nothing to show
  if (!loading && !hasAlerts && !hasAdvisories) return null;

  return (
    <InsightCard
      icon={<Shield className="w-3.5 h-3.5 text-indigo-500" />}
      title="Know Before You Go"
      borderColor={isWarning ? 'border-red-300' : hasAlerts ? 'border-orange-200' : 'border-indigo-200'}
      headerGradient={
        isWarning
          ? 'bg-gradient-to-r from-red-50 to-orange-50'
          : hasAlerts
            ? 'bg-gradient-to-r from-orange-50 to-amber-50'
            : 'bg-gradient-to-r from-indigo-50 to-blue-50'
      }
      titleColor={isWarning ? 'text-red-900' : hasAlerts ? 'text-orange-900' : 'text-indigo-900'}
      avatar={<CharacterAvatar initial="H" color="#7c3aed" />}
      badge={hasAlerts ? (
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${
          isWarning ? 'bg-red-500 text-white animate-pulse' : 'bg-orange-500 text-white'
        }`}>
          <AlertTriangle className="w-2.5 h-2.5" />
          {nwsAlerts.length} Alert{nwsAlerts.length > 1 ? 's' : ''}
        </span>
      ) : undefined}
    >
      {/* NWS Weather Alerts */}
      {nwsAlerts.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {nwsAlerts.slice(0, 3).map((alert, i) => {
            const colors = alertSeverityColor(alert.severity);
            return (
              <div key={i} className={`rounded-lg px-2 py-1.5 border-l-3 ${colors.bg} ${colors.text}`} style={{ borderLeftWidth: 3, borderLeftColor: alert.severity === 'Extreme' || alert.severity === 'Severe' ? '#ef4444' : '#f59e0b' }}>
                <p className="text-[11px] font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                  {alert.event}
                </p>
                <p className="text-[10px] mt-0.5 leading-tight opacity-80 line-clamp-2">{alert.headline}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* RV & Travel Advisories */}
      {allAdvisories.length > 0 && (
        <div className="space-y-1 mb-1.5">
          {allAdvisories.slice(0, 3).map((adv, i) => (
            <div key={i} className={`flex items-start gap-1.5 rounded px-2 py-1 ${
              adv.type === 'warning' ? 'bg-red-50' : adv.type === 'caution' ? 'bg-amber-50' : 'bg-blue-50'
            }`}>
              <span className="text-xs flex-shrink-0 mt-0.5">{adv.icon}</span>
              <div className="min-w-0">
                <p className={`text-[10px] font-bold ${
                  adv.type === 'warning' ? 'text-red-800' : adv.type === 'caution' ? 'text-amber-800' : 'text-blue-800'
                }`}>{adv.title}</p>
                <p className={`text-[10px] leading-tight ${
                  adv.type === 'warning' ? 'text-red-600' : adv.type === 'caution' ? 'text-amber-600' : 'text-blue-600'
                }`}>{adv.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* All clear state */}
      {!hasAlerts && !hasAdvisories && !loading && (
        <div className="flex items-center gap-2 py-1">
          <span className="text-green-500 text-xs">✓</span>
          <p className="text-[11px] text-green-700 font-medium">All clear — no active alerts or advisories for this area.</p>
        </div>
      )}

      <p className="text-[10px] text-gray-400 italic mt-1">
        {hasAlerts ? '"Check conditions, not just coordinates." — Hitch 🦄' : '"Smooth roads ahead — stay curious." — Hitch 🦄'}
      </p>
    </InsightCard>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function NatureInsightCards({ lat, lng, weather }: NatureInsightCardsProps) {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    lat && lng ? { lat, lng } : null
  );

  useEffect(() => {
    if (lat && lng) {
      setCoords({ lat, lng });
      return;
    }
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {}
    );
  }, [lat, lng]);

  if (!coords) return null;

  return (
    <div className="grid grid-cols-2 gap-3">
      <WeatherCard lat={coords.lat} lng={coords.lng} />
      <KnowBeforeYouGoCard lat={coords.lat} lng={coords.lng} />
      <GoldenHourCard lat={coords.lat} lng={coords.lng} weather={weather} />
      <WildlifeActivityCard lat={coords.lat} lng={coords.lng} />
      <ForagingForecastCard lat={coords.lat} lng={coords.lng} />
      <AirQualityCard lat={coords.lat} lng={coords.lng} />
    </div>
  );
}

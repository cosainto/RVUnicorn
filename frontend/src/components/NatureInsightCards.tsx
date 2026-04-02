import { useEffect, useState } from 'react';
import { Sun, Wind, TreePine, Leaf, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
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

function CharacterAvatar({ initial, color }: { initial: string; color: string }) {
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
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
    northern: { animals: ['Black Bear (emerging)', 'Moose calves', 'Bald Eagle nesting', 'Wild Turkey'], tip: 'Bears are waking hungry — secure food and trash at all times.' },
    southern: { animals: ['Alligator (active)', 'Armadillo', 'White-tailed Deer fawns', 'Painted Bunting'], tip: 'Gators are on the move during warm spells — keep distance near water.' },
    western: { animals: ['Mule Deer', 'Mountain Lion', 'Hummingbirds arriving', 'Rattlesnake'], tip: 'Rattlesnakes emerge with warm ground temps — watch your step on trails.' },
    eastern: { animals: ['White-tailed Deer', 'Red Fox kits', 'Osprey returning', 'Box Turtle'], tip: 'Fox dens may be near campsites — keep dogs leashed at dawn and dusk.' },
  },
  summer: {
    northern: { animals: ['Black Bear', 'Moose', 'Loon', 'Mosquitoes (peak)'], tip: 'Moose are surprisingly aggressive in summer — give them 50+ yards.' },
    southern: { animals: ['Alligator', 'Coral Snake', 'Fireflies', 'Armadillo'], tip: 'Highest snake activity — use a flashlight on night walks.' },
    western: { animals: ['Elk herds', 'Black Bear', 'Marmot', 'Rattlesnake'], tip: 'Elk rut begins late summer — bulls can be extremely aggressive.' },
    eastern: { animals: ['Black Bear', 'Copperhead', 'Fireflies', 'White-tailed Deer'], tip: 'Bear encounters peak as they forage before fall — bear canisters are essential.' },
  },
  fall: {
    northern: { animals: ['Moose (rut)', 'Black Bear (gorging)', 'Bald Eagle', 'Gray Wolf'], tip: 'Moose rut is underway — bulls are unpredictable, give extra space.' },
    southern: { animals: ['Monarch migration', 'White-tailed Deer (rut)', 'Sandhill Crane'], tip: 'Deer rut means more deer on roads — extra caution driving at dusk.' },
    western: { animals: ['Elk (bugling)', 'Grizzly Bear (gorging)', 'Bighorn Sheep', 'Bald Eagle'], tip: 'Bears are in hyperphagia — eating 20 hours a day. Triple-check food storage.' },
    eastern: { animals: ['Black Bear', 'White-tailed Deer (rut)', 'Turkey', 'Hawk migration'], tip: 'Hunting season is open in many areas — wear blaze orange on hikes.' },
  },
  winter: {
    northern: { animals: ['Snowy Owl', 'Bald Eagle', 'Coyote', 'Snowshoe Hare'], tip: 'Wildlife is stressed by cold — observe from a distance and never feed.' },
    southern: { animals: ['Manatee (warm springs)', 'Whooping Crane', 'Bald Eagle', 'Bobcat'], tip: 'Manatees gather at warm springs — kayak slowly and keep your distance.' },
    western: { animals: ['Bald Eagle', 'Elk (wintering)', 'Bighorn Sheep', 'Mule Deer'], tip: 'Elk herds descend to valleys — great viewing but stay in your vehicle.' },
    eastern: { animals: ['Bald Eagle', 'Coyote', 'Deer (yarding)', 'Great Horned Owl'], tip: 'Great Horned Owls start nesting now — listen for hoots at dusk.' },
  },
};

const FORAGING_DATA: Record<string, Record<string, { finds: string[]; tip: string }>> = {
  spring: {
    northern: { finds: ['Ramps (wild leeks)', 'Fiddlehead ferns', 'Morel mushrooms', 'Dandelion greens'], tip: 'Morels appear 1-2 weeks after the last frost near dying elms and tulip poplars.' },
    southern: { finds: ['Blackberry blossoms', 'Chickweed', 'Wild onion', 'Redbud flowers'], tip: 'Redbud flowers are edible and make beautiful trail-side salads.' },
    western: { finds: ['Miner\'s lettuce', 'Wild asparagus', 'Morel mushrooms', 'Stinging nettle'], tip: 'Miner\'s lettuce is vitamin-C rich and grows on shady slopes.' },
    eastern: { finds: ['Ramps', 'Morel mushrooms', 'Violet flowers', 'Pawpaw blossoms'], tip: 'Ramps have a short season — harvest leaves only, leave the bulb to regrow.' },
  },
  summer: {
    northern: { finds: ['Wild blueberries', 'Chanterelle mushrooms', 'Thimbleberry', 'Wild mint'], tip: 'Chanterelles love mossy oak forests after summer rain — never eat uncertain fungi.' },
    southern: { finds: ['Muscadine grapes', 'Passion fruit', 'Blackberry', 'Elderflower'], tip: 'Muscadines ripen on the vine — look for bronze or purple clusters along fence rows.' },
    western: { finds: ['Huckleberry', 'Wild strawberry', 'Pine nuts', 'Elderberry'], tip: 'Huckleberries grow at elevation — and bears want them too, so make noise.' },
    eastern: { finds: ['Blackberry', 'Wineberry', 'Chanterelle mushrooms', 'Sumac berries'], tip: 'Staghorn sumac berries make a refreshing lemonade-like drink — avoid white-berried sumac.' },
  },
  fall: {
    northern: { finds: ['Hen of the woods', 'Cranberry', 'Wild apple', 'Hickory nuts'], tip: 'Hen of the woods (maitake) fruits at the base of oaks — a prized find.' },
    southern: { finds: ['Persimmon', 'Pawpaw', 'Pecan', 'Muscadine grapes'], tip: 'Wait for persimmons to fall — unripe ones are astringent enough to ruin your day.' },
    western: { finds: ['Pine nuts', 'Juniper berries', 'Wild grape', 'Manzanita berries'], tip: 'Piñon pine nut harvest is a tradition — look for open cones in September.' },
    eastern: { finds: ['Pawpaw', 'Persimmon', 'Hen of the woods', 'Black walnut'], tip: 'Pawpaws taste like tropical custard — look for them along creek banks.' },
  },
  winter: {
    northern: { finds: ['Birch bark tea', 'Rose hips', 'Dried mushrooms (stored)', 'Pine needle tea'], tip: 'Pine needle tea is packed with vitamin C — steep fresh green needles for 10 minutes.' },
    southern: { finds: ['Citrus (wild or feral)', 'Saw palmetto berries', 'Chickweed', 'Dandelion'], tip: 'Feral citrus trees are common near old homesteads — worth the detour.' },
    western: { finds: ['Pine needle tea', 'Rose hips', 'Juniper berries', 'Dried manzanita'], tip: 'Rose hips hold through winter — they\'re sweeter after a hard frost.' },
    eastern: { finds: ['Wintergreen berries', 'Rose hips', 'Pine needle tea', 'Oyster mushrooms'], tip: 'Oyster mushrooms fruit on dead hardwoods even in cold weather — check after rain.' },
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
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={`w-full px-4 py-3 border-b flex items-center gap-2 ${borderColor} ${headerGradient}`}
      >
        {avatar}
        <span className="text-lg flex-shrink-0">{icon}</span>
        <span className={`font-bold text-sm ${titleColor}`}>{title}</span>
        {badge && <span className="ml-auto mr-2">{badge}</span>}
        {collapsed
          ? <ChevronDown className={`w-4 h-4 ml-auto ${titleColor} opacity-50`} />
          : <ChevronUp className={`w-4 h-4 ml-auto ${titleColor} opacity-50`} />}
      </button>
      {!collapsed && (
        <div className="p-4">
          {children}
          <div className="mt-3 pt-2 border-t border-gray-100 flex justify-end">
            <button
              onClick={() => setDismissed(true)}
              className="text-gray-400 hover:text-gray-600 text-xs transition"
            >
              Dismiss
            </button>
          </div>
        </div>
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
      goldenHourAM: fmt(times.goldenHourEnd),   // morning golden hour ends at this time
      goldenHourPM: fmt(times.goldenHour),       // evening golden hour starts at this time
    });
  }, [lat, lng]);

  if (!data) return null;

  return (
    <InsightCard
      icon={<Sun className="w-4 h-4 text-amber-500" />}
      title="Golden Hour"
      borderColor="border-amber-200"
      headerGradient="bg-gradient-to-r from-amber-50 to-orange-50"
      titleColor="text-amber-900"
      avatar={
        // TODO: Replace with real Hitch character art
        <CharacterAvatar initial="H" color="#7c3aed" />
      }
    >
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg p-3 text-center">
          <p className="text-xs text-amber-600 font-medium mb-1">🌅 Sunrise</p>
          <p className="text-lg font-bold text-amber-900">{data.sunrise}</p>
          <p className="text-xs text-amber-500 mt-0.5">Golden til {data.goldenHourAM}</p>
        </div>
        <div className="bg-gradient-to-br from-orange-50 to-rose-50 rounded-lg p-3 text-center">
          <p className="text-xs text-orange-600 font-medium mb-1">🌇 Sunset</p>
          <p className="text-lg font-bold text-orange-900">{data.sunset}</p>
          <p className="text-xs text-orange-500 mt-0.5">Golden from {data.goldenHourPM}</p>
        </div>
      </div>
      {weather?.description && (
        <p className="text-xs text-amber-600 mb-2">Current conditions: {weather.description}{weather.temp != null ? ` · ${Math.round(weather.temp)}°F` : ''}</p>
      )}
      <div className="flex items-center gap-2 mt-2">
        {/* TODO: Replace with real Hitch character art */}
        <CharacterAvatar initial="H" color="#7c3aed" />
        <p className="text-xs text-gray-500 italic">
          "Chase the light, not the likes. But also… get the likes." — Hitch 🦄
        </p>
      </div>
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
      avatar={
        // TODO: Replace with real Ranger Rick character art
        <CharacterAvatar initial="R" color="#16a34a" />
      }
    >
      <div className="space-y-2 mb-3">
        {data.animals.map((animal) => (
          <div key={animal} className="flex items-center gap-2 bg-green-50/60 rounded-lg px-3 py-2">
            <TreePine className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
            <span className="text-sm text-green-900">{animal}</span>
          </div>
        ))}
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
        <p className="text-xs text-amber-800 font-medium">
          <AlertTriangle className="w-3 h-3 inline mr-1 -mt-0.5" />
          {data.tip}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {/* TODO: Replace with real Ranger Rick character art */}
        <CharacterAvatar initial="R" color="#16a34a" />
        <p className="text-xs text-gray-500 italic">
          "Every critter has a story. Your job is to observe, not audition." — Ranger Rick 🏕️
        </p>
      </div>
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
      icon={<Leaf className="w-4 h-4 text-lime-600" />}
      title="Foraging Forecast"
      borderColor="border-lime-200"
      headerGradient="bg-gradient-to-r from-lime-50 to-green-50"
      titleColor="text-lime-900"
      avatar={
        // TODO: Replace with real Walter character art
        <CharacterAvatar initial="W" color="#854d0e" />
      }
    >
      <div className="grid grid-cols-2 gap-2 mb-3">
        {data.finds.map((find) => (
          <div key={find} className="flex items-center gap-1.5 bg-lime-50/60 rounded-lg px-2.5 py-2">
            <span className="text-sm">🌿</span>
            <span className="text-xs text-lime-900 font-medium">{find}</span>
          </div>
        ))}
      </div>
      <div className="bg-lime-50 border border-lime-200 rounded-lg px-3 py-2 mb-3">
        <p className="text-xs text-lime-800">{data.tip}</p>
      </div>
      <div className="flex items-center gap-2">
        {/* TODO: Replace with real Walter character art */}
        <CharacterAvatar initial="W" color="#854d0e" />
        <p className="text-xs text-gray-500 italic">
          "Nature always sets the table — you just need to know when to sit down." — Walter 🍄
        </p>
      </div>
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
      icon={<Wind className="w-4 h-4 text-sky-500" />}
      title="Air Quality"
      borderColor={isWarning ? 'border-red-300' : 'border-sky-200'}
      headerGradient={isWarning
        ? 'bg-gradient-to-r from-red-50 to-orange-50'
        : 'bg-gradient-to-r from-sky-50 to-blue-50'}
      titleColor={isWarning ? 'text-red-900' : 'text-sky-900'}
      avatar={
        // TODO: Replace with real Hitch character art
        <CharacterAvatar initial="H" color="#7c3aed" />
      }
      badge={isWarning ? (
        <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> Hitch Warning
        </span>
      ) : undefined}
    >
      <div className="flex items-center gap-4 mb-3">
        <div className={`rounded-xl px-4 py-3 text-center ${info.bg}`}>
          <p className={`text-3xl font-bold ${info.color}`}>{data.aqi}</p>
          <p className={`text-xs font-medium ${info.color} mt-0.5`}>US AQI</p>
        </div>
        <div className="flex-1 space-y-1.5">
          <p className={`text-sm font-bold ${info.color}`}>{info.label}</p>
          <p className="text-xs text-gray-500">PM2.5: {data.pm25.toFixed(1)} µg/m³</p>
          <p className="text-xs text-gray-500">PM10: {data.pm10.toFixed(1)} µg/m³</p>
        </div>
      </div>
      {isWarning && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
          <p className="text-xs text-red-800 font-medium">
            <AlertTriangle className="w-3 h-3 inline mr-1 -mt-0.5" />
            Consider limiting outdoor activity. Close RV windows and run the AC on recirculate.
          </p>
        </div>
      )}
      <div className="flex items-center gap-2">
        {/* TODO: Replace with real Hitch character art */}
        <CharacterAvatar initial="H" color="#7c3aed" />
        <p className="text-xs text-gray-500 italic">
          {isWarning
            ? '"Breathe easy — or don\'t. That\'s literally what I\'m telling you." — Hitch 🦄'
            : '"Clear skies, clean lungs, good vibes. That\'s the RV Unicorn way." — Hitch 🦄'}
        </p>
      </div>
    </InsightCard>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function NatureInsightCards({ lat, lng, weather }: NatureInsightCardsProps) {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    lat && lng ? { lat, lng } : null
  );

  // Fall back to browser geolocation if no lat/lng from active trip
  useEffect(() => {
    if (lat && lng) {
      setCoords({ lat, lng });
      return;
    }
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {} // silently fail — cards just won't show
    );
  }, [lat, lng]);

  if (!coords) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <GoldenHourCard lat={coords.lat} lng={coords.lng} weather={weather} />
      <WildlifeActivityCard lat={coords.lat} lng={coords.lng} />
      <ForagingForecastCard lat={coords.lat} lng={coords.lng} />
      <AirQualityCard lat={coords.lat} lng={coords.lng} />
    </div>
  );
}

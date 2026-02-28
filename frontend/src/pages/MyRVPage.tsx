import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Truck, Wrench, Save, Upload, X, Trash2, Camera, Video, ChevronDown, ChevronUp, MapPin, Users, PawPrint } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import ImageUpload from '../components/ImageUpload';

const RV_TYPES = [
  { value: '', label: 'Select Type...' },
  { value: 'CLASS_A', label: 'Class A Motorhome' },
  { value: 'CLASS_B', label: 'Class B (Camper Van)' },
  { value: 'CLASS_C', label: 'Class C Motorhome' },
  { value: 'FIFTH_WHEEL', label: 'Fifth Wheel' },
  { value: 'TRAVEL_TRAILER', label: 'Travel Trailer' },
  { value: 'TOY_HAULER', label: 'Toy Hauler' },
  { value: 'POP_UP', label: 'Pop-Up Camper' },
  { value: 'TRUCK_CAMPER', label: 'Truck Camper' },
  { value: 'TEARDROP', label: 'Teardrop Trailer' },
  { value: 'AIRSTREAM', label: 'Airstream' },
  { value: 'SKOOLIE', label: 'Skoolie (Bus Conversion)' },
  { value: 'VAN_CONVERSION', label: 'Van Conversion' },
  { value: 'OTHER', label: 'Other' },
];

const RV_FEATURES = [
  'Full Kitchen', 'Microwave', 'Oven', 'Refrigerator', 'Freezer',
  'Bathroom', 'Shower', 'Toilet', 'Outdoor Shower',
  'Air Conditioning', 'Heating', 'Furnace',
  'Generator', 'Solar Panels', 'Inverter', 'Battery Bank',
  'Washer/Dryer', 'TV', 'WiFi Booster', 'Satellite',
  'Awning', 'Outdoor Kitchen', 'Grill',
  'Leveling Jacks', 'Backup Camera', 'Dash Cam',
  'King Bed', 'Queen Bed', 'Bunk Beds', 'Murphy Bed',
  'Fireplace', 'Ceiling Fan', 'Skylight',
  'Pet Friendly', 'Bike Rack', 'Kayak Rack',
  'Tow Package', 'Hitch', 'Weight Distribution',
];

const MPG_BY_TYPE: Record<string, { min: number; max: number; avg: number }> = {
  'CLASS_A': { min: 6, max: 10, avg: 8 },
  'CLASS_B': { min: 18, max: 25, avg: 20 },
  'CLASS_C': { min: 10, max: 14, avg: 12 },
  'TRUCK_CAMPER': { min: 12, max: 18, avg: 15 },
  'VAN_CONVERSION': { min: 16, max: 22, avg: 18 },
};

const MPG_BY_MAKE: Record<string, number> = {
  'Winnebago': 10, 'Thor': 8, 'Forest River': 9, 'Coachmen': 9,
  'Tiffin': 10, 'Newmar': 10, 'Fleetwood': 8, 'Jayco': 9,
  'Holiday Rambler': 9, 'Entegra': 10, 'Airstream': 18,
  'Roadtrek': 20, 'Pleasure-Way': 22, 'Leisure Travel': 18,
};

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware',
  'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky',
  'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
  'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico',
  'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania',
  'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
  'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'
];

const TRAVEL_PARTY_TYPES = [
  { value: '', label: 'Select...' },
  { value: 'SOLO', label: 'Solo Adventurer' },
  { value: 'COUPLE', label: 'Couple' },
  { value: 'FAMILY', label: 'Family' },
  { value: 'GROUP', label: 'Group/Friends' },
  { value: 'VARIES', label: 'It Varies' },
];

const PET_TYPES = ['Dog', 'Cat', 'Bird', 'Other'];

export default function MyRVPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
  
  const [rvData, setRvData] = useState({
    rvType: '',
    rvYear: '',
    rvMake: '',
    rvModel: '',
    rvLength: '',
    rvSleeps: '',
    rvSlideouts: '',
    rvWeight: '',
    rvMpg: '',
    rvWidth: '',
    rvHeight: '',
    rvDescription: '',
    rvFeatures: [] as string[],
  });

  const [homeData, setHomeData] = useState({
    homeCity: '',
    homeState: '',
    homeZipCode: '',
    travelPartyType: '',
    travelPartySize: '',
    hasPets: false,
    petTypes: [] as string[],
  });

  const [showcase, setShowcase] = useState({
    title: '',
    description: '',
    privacy: 'PUBLIC',
    photos: [] as string[],
    videoUrl: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load user profile for RV specs
      const { data: profile } = await api.get('/auth/me');
      setRvData({
        rvType: profile.rvType || '',
        rvYear: profile.rvYear?.toString() || '',
        rvMake: profile.rvMake || '',
        rvModel: profile.rvModel || '',
        rvLength: profile.rvLength?.toString() || '',
        rvSleeps: profile.rvSleeps?.toString() || '',
        rvSlideouts: profile.rvSlideouts?.toString() || '',
        rvWeight: profile.rvWeight?.toString() || '',
        rvMpg: profile.rvMpg?.toString() || '',
        rvWidth: profile.rvWidth?.toString() || '',
        rvHeight: profile.rvHeight?.toString() || '',
        rvDescription: profile.rvDescription || '',
        rvFeatures: profile.rvFeatures || [],
      });

      setHomeData({
        homeCity: profile.homeCity || '',
        homeState: profile.homeState || '',
        homeZipCode: profile.homeZipCode || '',
        travelPartyType: profile.travelPartyType || '',
        travelPartySize: profile.travelPartySize?.toString() || '',
        hasPets: profile.hasPets || false,
        petTypes: profile.petTypes || [],
      });

      // Load RV showcase for photos/video
      try {
        const { data: showcaseData } = await api.get(`/rv-showcase/user/${profile.id}`);
        setShowcase({
          title: showcaseData.title || '',
          description: showcaseData.description || '',
          privacy: showcaseData.privacy || 'PUBLIC',
          photos: showcaseData.photos || [],
          videoUrl: showcaseData.videoUrl || '',
        });
      } catch (err: any) {
        // Showcase might not exist yet
        if (err.response?.status !== 404) {
          console.error('Load showcase error:', err);
        }
      }
    } catch (error) {
      console.error('Load RV data error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Save RV specs to profile
      await api.put(`/profile/${user?.username}`, {
        rvType: rvData.rvType || null,
        rvYear: rvData.rvYear ? parseInt(rvData.rvYear) : null,
        rvMake: rvData.rvMake || null,        

        rvModel: rvData.rvModel || null,
        rvLength: rvData.rvLength ? parseInt(rvData.rvLength) : null,
        rvSleeps: rvData.rvSleeps ? parseInt(rvData.rvSleeps) : null,
        rvSlideouts: rvData.rvSlideouts ? parseInt(rvData.rvSlideouts) : null,
        rvWeight: rvData.rvWeight ? parseInt(rvData.rvWeight) : null,
        rvMpg: rvData.rvMpg ? parseFloat(rvData.rvMpg) : null,
        rvWidth: rvData.rvWidth ? parseInt(rvData.rvWidth) : null,
        rvHeight: rvData.rvHeight ? parseInt(rvData.rvHeight) : null,
        rvDescription: rvData.rvDescription || null,
        rvFeatures: rvData.rvFeatures,
      });

      // Save showcase (photos/video)
      await api.post('/rv-showcase', showcase);

      alert('RV information saved! 🚐');
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save RV information');
    } finally {
      setSaving(false);
    }
  };

  const toggleFeature = (feature: string) => {
    setRvData(prev => ({
      ...prev,
      rvFeatures: prev.rvFeatures.includes(feature)
        ? prev.rvFeatures.filter(f => f !== feature)
        : [...prev.rvFeatures, feature]
    }));
  };

  const handleAddPhoto = (url: string) => {
    if (!url) return; // Ignore empty URLs
    if (showcase.photos.length >= 6) {
      alert('Maximum 6 photos allowed');
      return;
    }
    setShowcase({ ...showcase, photos: [...showcase.photos, url] });
  };

  const handleRemovePhoto = (index: number) => {
    const newPhotos = showcase.photos.filter((_, i) => i !== index);
    setShowcase({ ...showcase, photos: newPhotos });
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading your RV...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-3 rounded-xl shadow-lg">
            <Truck className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My RV</h1>
            <Link to="/maintenance" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
              <Wrench className="w-4 h-4" />
              Maintenance Log
            </Link>
            <p className="text-gray-600">Manage your rig details and showcase</p>
          </div>
        </div>
      </div>

      {/* Home Location Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-green-600" />
          Home Base & Travel Style
        </h2>
        <p className="text-sm text-gray-500 mb-4">This is used as your default starting point for trip planning.</p>

        <div className="space-y-6">
          {/* City and State */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input
                type="text"
                value={homeData.homeCity}
                onChange={(e) => setHomeData({ ...homeData, homeCity: e.target.value })}
                placeholder="e.g., Denver"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <select
                value={homeData.homeState}
                onChange={(e) => setHomeData({ ...homeData, homeState: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                <option value="">Select state...</option>
                {US_STATES.map(state => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code</label>
              <input
                type="text"
                value={homeData.homeZipCode}
                onChange={(e) => setHomeData({ ...homeData, homeZipCode: e.target.value })}
                placeholder="e.g., 80202"
                maxLength={10}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
          </div>

          {/* Travel Party */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Who do you usually travel with?
              </label>
              <select
                value={homeData.travelPartyType}
                onChange={(e) => setHomeData({ ...homeData, travelPartyType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                {TRAVEL_PARTY_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
            {(homeData.travelPartyType === 'FAMILY' || homeData.travelPartyType === 'GROUP') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Party Size</label>
                <input
                  type="number"
                  value={homeData.travelPartySize}
                  onChange={(e) => setHomeData({ ...homeData, travelPartySize: e.target.value })}
                  placeholder="How many people?"
                  min="1"
                  max="20"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
            )}
          </div>

          {/* Pets */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={homeData.hasPets}
                onChange={(e) => setHomeData({ ...homeData, hasPets: e.target.checked, petTypes: e.target.checked ? homeData.petTypes : [] })}
                className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
              />
              <PawPrint className="w-5 h-5 text-amber-600" />
              <span className="font-medium">I travel with pets</span>
            </label>

            {homeData.hasPets && (
              <div className="mt-3 ml-8 flex flex-wrap gap-2">
                {PET_TYPES.map((pet) => (
                  <button
                    key={pet}
                    type="button"
                    onClick={() => {
                      if (homeData.petTypes.includes(pet)) {
                        setHomeData({ ...homeData, petTypes: homeData.petTypes.filter(p => p !== pet) });
                      } else {
                        setHomeData({ ...homeData, petTypes: [...homeData.petTypes, pet] });
                      }
                    }}
                    className={`px-4 py-2 rounded-full border transition-all ${
                      homeData.petTypes.includes(pet)
                        ? 'border-amber-500 bg-amber-50 text-amber-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {pet}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RV Specs Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Truck className="w-5 h-5 text-blue-600" />
          RV Specifications
        </h2>

        <div className="space-y-6">
          {/* RV Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">RV Type</label>
            <select
              value={rvData.rvType}
              onChange={(e) => setRvData({ ...rvData, rvType: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {RV_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          {/* Year, Make, Model */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
              <input
                type="number"
                value={rvData.rvYear}
                onChange={(e) => setRvData({ ...rvData, rvYear: e.target.value })}
                placeholder="2024"
                min="1950"
                max={new Date().getFullYear() + 1}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Make</label>
              <input
                type="text"
                value={rvData.rvMake}
                onChange={(e) => setRvData({ ...rvData, rvMake: e.target.value })}
                placeholder="e.g., Winnebago"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
              <input
                type="text"
                value={rvData.rvModel}
                onChange={(e) => setRvData({ ...rvData, rvModel: e.target.value })}
                placeholder="e.g., View 24D"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Specs Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Length (ft)</label>
              <input
                type="number"
                value={rvData.rvLength}
                onChange={(e) => setRvData({ ...rvData, rvLength: e.target.value })}
                placeholder="24"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sleeps</label>
              <input
                type="number"
                value={rvData.rvSleeps}
                onChange={(e) => setRvData({ ...rvData, rvSleeps: e.target.value })}
                placeholder="4"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slide-outs</label>
              <input
                type="number"
                value={rvData.rvSlideouts}
                onChange={(e) => setRvData({ ...rvData, rvSlideouts: e.target.value })}
                placeholder="2"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Weight (lbs)</label>
              <input
                type="number"
                value={rvData.rvWeight}
                onChange={(e) => setRvData({ ...rvData, rvWeight: e.target.value })}
                placeholder="12000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Width (ft)</label>
              <input
                type="number"
                value={rvData.rvWidth}
                onChange={(e) => setRvData({ ...rvData, rvWidth: e.target.value })}
                placeholder="8"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Height (ft)</label>
              <input
                type="number"
                value={rvData.rvHeight}
                onChange={(e) => setRvData({ ...rvData, rvHeight: e.target.value })}
                placeholder="11"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* MPG */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ⛽ Fuel Economy (MPG)
              {(() => { const t = MPG_BY_TYPE[rvData.rvType]; const m = MPG_BY_MAKE[rvData.rvMake]; const avg = m || t?.avg; return avg ? <span className="text-xs text-blue-600 font-normal ml-2">Suggested: {t?.min}–{t?.max} mpg, avg {avg}</span> : null; })()}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                step="0.1"
                min="1"
                max="40"
                value={rvData.rvMpg}
                onChange={(e) => setRvData({ ...rvData, rvMpg: e.target.value })}
                placeholder="e.g., 10"
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              {(() => { const t = MPG_BY_TYPE[rvData.rvType]; const m = MPG_BY_MAKE[rvData.rvMake]; const avg = (m || t?.avg)?.toString(); return avg && rvData.rvMpg !== avg ? <button type="button" onClick={() => setRvData(prev => ({ ...prev, rvMpg: avg }))} className="text-xs text-blue-600 hover:text-blue-700">Use suggested ({avg} mpg)</button> : null; })()}
            </div>
            <p className="text-xs text-gray-400 mt-1">Used for fuel cost estimates in the trip planner</p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={rvData.rvDescription}
              onChange={(e) => setRvData({ ...rvData, rvDescription: e.target.value })}
              rows={3}
              placeholder="Tell us about your rig..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Features */}
          <div>
            <button
              type="button"
              onClick={() => setShowFeatures(!showFeatures)}
              className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              {showFeatures ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              Features & Amenities ({rvData.rvFeatures.length} selected)
            </button>
            
            {showFeatures && (
              <div className="mt-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {RV_FEATURES.map(feature => (
                  <label
                    key={feature}
                    className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition ${
                      rvData.rvFeatures.includes(feature)
                        ? 'bg-blue-50 border-2 border-blue-500'
                        : 'bg-gray-50 border-2 border-transparent hover:border-gray-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={rvData.rvFeatures.includes(feature)}
                      onChange={() => toggleFeature(feature)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{feature}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Photos & Video Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Camera className="w-5 h-5 text-pink-600" />
          Photos & Video
        </h2>

        {/* Video Upload */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Video className="w-4 h-4 inline mr-1" />
            Video Tour (45 seconds max)
          </label>
          {showcase.videoUrl ? (
            <div className="relative">
              <video
                src={showcase.videoUrl.startsWith('http') ? showcase.videoUrl : `${showcase.videoUrl}`}
                className="w-full rounded-lg max-h-64"
                controls
              />
              <button
                onClick={() => setShowcase({ ...showcase, videoUrl: '' })}
                className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-2 hover:bg-red-600"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <ImageUpload key={showcase.photos.length}
                onImageUploaded={(url) => setShowcase({ ...showcase, videoUrl: url })}
                currentImage=""
                label="Upload Video"
                accept="video/mp4,video/quicktime"
              />
              <p className="text-sm text-gray-500 mt-2">MP4 or MOV, max 50MB</p>
            </div>
          )}
        </div>

        {/* Photos */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Camera className="w-4 h-4 inline mr-1" />
            Photos ({showcase.photos.length}/6)
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {showcase.photos.map((photo, index) => (
              <div key={index} className="relative aspect-square">
                <img
                  src={photo.startsWith('http') ? photo : `${photo}`}
                  alt={`RV Photo ${index + 1}`}
                  className="w-full h-full object-cover rounded-lg"
                />
                <button
                  onClick={() => handleRemovePhoto(index)}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}

            {showcase.photos.length < 6 && (
              <div className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center hover:border-blue-400 transition">
                <ImageUpload key={showcase.photos.length}
                  onImageUploaded={handleAddPhoto}
                  currentImage=""
                  label=""
                  
                />
              </div>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Add up to 6 photos of your RV (interior, exterior, setup, etc.)
          </p>
        </div>
      </div>

      {/* Showcase Settings */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Showcase Settings</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Showcase Title</label>
            <input
              type="text"
              value={showcase.title}
              onChange={(e) => setShowcase({ ...showcase, title: e.target.value })}
              placeholder="My Adventure Rig"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Privacy</label>
            <select
              value={showcase.privacy}
              onChange={(e) => setShowcase({ ...showcase, privacy: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="PUBLIC">Public - Visible on your profile</option>
              <option value="PRIVATE">Private - Only you can see</option>
            </select>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-8 py-3 rounded-lg font-medium flex items-center gap-2 shadow-lg transition-colors"
        >
          <Save className="w-5 h-5" />
          {saving ? 'Saving...' : 'Save RV Information'}
        </button>
      </div>
    </div>
  );
}

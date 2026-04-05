import { useState, useEffect, useCallback, useRef } from 'react';
import { X, MapPin, Truck, Users, PawPrint, ChevronRight, ChevronLeft, Check, Sparkles, Link as LinkIcon, Globe, Tent, Home, Car } from 'lucide-react';
import api from '../services/api';

interface OnboardingWizardProps {
  onComplete: () => void;
  onSkip: () => void;
}

const RV_TYPES = [
  { id: 'CLASS_A', label: 'Class A Motorhome', emoji: '🚐' },
  { id: 'CLASS_B', label: 'Class B (Camper Van)', emoji: '🚐' },
  { id: 'CLASS_C', label: 'Class C Motorhome', emoji: '🚐' },
  { id: 'TRAVEL_TRAILER', label: 'Travel Trailer', emoji: '🏕️' },
  { id: 'FIFTH_WHEEL', label: 'Fifth Wheel', emoji: '🚛' },
  { id: 'POP_UP', label: 'Pop-Up Camper', emoji: '⛺' },
  { id: 'TRUCK_CAMPER', label: 'Truck Camper', emoji: '🛻' },
  { id: 'TEARDROP', label: 'Teardrop', emoji: '💧' },
  { id: 'TOY_HAULER', label: 'Toy Hauler', emoji: '🏍️' },
  { id: 'OTHER', label: 'Other', emoji: '🏕️' },
];

const CAMPING_STYLES = [
  { id: 'RV', label: 'RV / Motorhome', emoji: '🚐', description: 'Class A, B, C motorhomes' },
  { id: 'TRAILER', label: 'Travel Trailer', emoji: '🏕️', description: 'Fifth wheel, travel trailer, pop-up' },
  { id: 'VAN', label: 'Van Life', emoji: '🚐', description: 'Camper van, converted van' },
  { id: 'TENT', label: 'Tent Camping', emoji: '⛺', description: 'Traditional tent camping' },
  { id: 'CABIN', label: 'Cabin / Glamping', emoji: '🏠', description: 'Cabins, yurts, glamping' },
  { id: 'BACKPACKING', label: 'Backpacking', emoji: '🎒', description: 'Backcountry, hiking trips' },
];

const TRAVEL_PARTY_TYPES = [
  { id: 'SOLO', label: 'Solo Adventurer', emoji: '🧑', description: 'Just me and the open road' },
  { id: 'COUPLE', label: 'Couple', emoji: '👫', description: 'Traveling with my partner' },
  { id: 'FAMILY', label: 'Family', emoji: '👨‍👩‍👧‍👦', description: 'Traveling with kids' },
  { id: 'GROUP', label: 'Group/Friends', emoji: '👥', description: 'Often travel with friends' },
  { id: 'VARIES', label: 'It Varies', emoji: '🔄', description: 'Different trips, different groups' },
];

const PET_TYPES = [
  { id: 'DOG', label: 'Dog(s)', emoji: '🐕' },
  { id: 'CAT', label: 'Cat(s)', emoji: '🐱' },
  { id: 'BIRD', label: 'Bird(s)', emoji: '🦜' },
  { id: 'OTHER', label: 'Other', emoji: '🐾' },
];

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware',
  'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky',
  'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
  'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico',
  'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania',
  'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
  'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'
];

export default function OnboardingWizard({ onComplete, onSkip }: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Hometown
  const [homeCity, setHomeCity] = useState('');
  const [homeState, setHomeState] = useState('');
  const [homeZipCode, setHomeZipCode] = useState('');
  
  // Camping Styles
  const [campingStyles, setCampingStyles] = useState<string[]>([]);
  
  // RV
  const [hasRV, setHasRV] = useState<boolean | null>(null);
  const [rvType, setRvType] = useState('');
  const [rvYear, setRvYear] = useState('');
  const [rvMake, setRvMake] = useState('');
  const [rvModel, setRvModel] = useState('');
  
  // RV Database Search
  const [rvSearchQuery, setRvSearchQuery] = useState('');
  const [rvSearchResults, setRvSearchResults] = useState<any[]>([]);
  const [rvMakes, setRvMakes] = useState<any[]>([]);
  const [rvModels, setRvModels] = useState<any[]>([]);
  const [selectedMakeId, setSelectedMakeId] = useState('');
  const [selectedModel, setSelectedModel] = useState<any>(null);
  const [rvAutofilled, setRvAutofilled] = useState(false);
  const rvSearchTimeout = useRef<NodeJS.Timeout | null>(null);

  // Load makes when RV type is selected
  useEffect(() => {
    if (rvType) {
      api.get(`/rv/makes?type=${encodeURIComponent(rvType)}`).then(({ data }) => {
        setRvMakes(data);
      }).catch(() => {});
    }
  }, [rvType]);

  // Load models when make is selected
  useEffect(() => {
    if (selectedMakeId) {
      api.get(`/rv/makes/${selectedMakeId}/models`).then(({ data }) => {
        setRvModels(data);
      }).catch(() => {});
    }
  }, [selectedMakeId]);

  // Search RV database
  const handleRvSearch = (query: string) => {
    setRvSearchQuery(query);
    if (rvSearchTimeout.current) clearTimeout(rvSearchTimeout.current);
    if (query.length < 2) { setRvSearchResults([]); return; }
    rvSearchTimeout.current = setTimeout(async () => {
      try {
        const { data } = await api.get(`/rv/search?q=${encodeURIComponent(query)}`);
        setRvSearchResults(data.models || []);
      } catch {}
    }, 300);
  };

  // Autofill from selected model
  const handleRvAutofill = async (model: any) => {
    setSelectedModel(model);
    setRvMake(model.make?.name || '');
    setRvModel(model.name || '');
    setRvSearchQuery('');
    setRvSearchResults([]);
    try {
      await api.post('/rv/autofill', { modelId: model.id });
      setRvAutofilled(true);
    } catch {}
  };
  
  // Travel Party
  const [travelPartyType, setTravelPartyType] = useState('');
  const [travelPartySize, setTravelPartySize] = useState('');
  const [hasPets, setHasPets] = useState(false);
  const [petTypes, setPetTypes] = useState<string[]>([]);
  
  // Social Links
  const [website, setWebsite] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [twitterUrl, setTwitterUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [tiktokUrl, setTiktokUrl] = useState('');

  const totalSteps = 4;

  const saveHometown = async () => {
    if (!homeCity || !homeState) return;
    setLoading(true);
    try {
      await api.put('/onboarding/hometown', {
        homeCity,
        homeState,
        homeZipCode,
      });
    } catch (error) {
      console.error('Save hometown error:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveRV = async () => {
    setLoading(true);
    try {
      await api.put('/onboarding/rv', {
        campingStyles,
        hasRV: campingStyles.includes('RV') || campingStyles.includes('TRAILER') || campingStyles.includes('VAN'),
        rvType: hasRV ? rvType : null,
        rvYear: hasRV && rvYear ? parseInt(rvYear) : null,
        rvMake: hasRV ? rvMake : null,
        rvModel: hasRV ? rvModel : null,
      });
    } catch (error) {
      console.error('Save RV error:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveTravelParty = async () => {
    if (!travelPartyType) return;
    setLoading(true);
    try {
      await api.put('/onboarding/travel-party', {
        travelPartyType,
        travelPartySize: travelPartySize ? parseInt(travelPartySize) : null,
        hasPets,
        petTypes: hasPets ? petTypes : [],
      });
    } catch (error) {
      console.error('Save travel party error:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSocialLinks = async () => {
    // Only save if at least one link is provided
    if (!website && !facebookUrl && !instagramUrl && !twitterUrl && !youtubeUrl && !tiktokUrl) return;
    setLoading(true);
    try {
      await api.put('/onboarding/social-links', {
        website,
        facebookUrl,
        instagramUrl,
        twitterUrl,
        youtubeUrl,
        tiktokUrl,
      });
    } catch (error) {
      console.error('Save social links error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = async () => {
    if (step === 1) {
      await saveHometown();
    } else if (step === 2) {
      await saveRV();
    } else if (step === 3) {
      await saveTravelParty();
    } else if (step === 4) {
      await saveSocialLinks();
    }
    
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      await completeOnboarding();
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const completeOnboarding = async () => {
    try {
      await api.put('/onboarding/complete');
      onComplete();
    } catch (error) {
      console.error('Complete onboarding error:', error);
    }
  };

  const handleSkip = async () => {
    try {
      await api.put('/onboarding/skip');
      onSkip();
    } catch (error) {
      console.error('Skip onboarding error:', error);
    }
  };

  const togglePetType = (petType: string) => {
    if (petTypes.includes(petType)) {
      setPetTypes(petTypes.filter(p => p !== petType));
    } else {
      setPetTypes([...petTypes, petType]);
    }
  };

  const toggleCampingStyle = (style: string) => {
    if (campingStyles.includes(style)) {
      setCampingStyles(campingStyles.filter(s => s !== style));
      // If removing RV/TRAILER/VAN, also clear hasRV
      if (['RV', 'TRAILER', 'VAN'].includes(style)) {
        const remaining = campingStyles.filter(s => s !== style);
        if (!remaining.some(s => ['RV', 'TRAILER', 'VAN'].includes(s))) {
          setHasRV(false);
        }
      }
    } else {
      setCampingStyles([...campingStyles, style]);
      // If adding RV/TRAILER/VAN, set hasRV
      if (['RV', 'TRAILER', 'VAN'].includes(style)) {
        setHasRV(true);
      }
    }
  };

  // Check if any RV-related style is selected
  const showRVDetails = campingStyles.some(s => ['RV', 'TRAILER', 'VAN'].includes(s));

  const canProceed = () => {
    if (step === 1) return homeCity && homeState;
    if (step === 2) return campingStyles.length > 0;
    if (step === 3) return travelPartyType;
    if (step === 4) return true; // Social links are optional
    return true;
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6" />
              <h2 className="text-xl font-bold">Welcome to RVUnicorn!</h2>
            </div>
            <button
              onClick={handleSkip}
              className="text-white/70 hover:text-white transition-colors"
              title="Skip for now"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <p className="text-primary-100 text-sm">
            Let's personalize your experience. This helps us connect you with like-minded campers!
          </p>
          
          {/* Progress */}
          <div className="flex gap-2 mt-4">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`flex-1 h-2 rounded-full transition-all ${
                  s <= step ? 'bg-white' : 'bg-white/30'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[50vh]">
          {/* Step 1: Hometown */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Where's home base?</h3>
                  <p className="text-sm text-gray-500">We'll use this as your default starting point for trips</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hometown</label>
                <input
                  type="text"
                  value={homeCity}
                  onChange={(e) => setHomeCity(e.target.value)}
                  placeholder="e.g., Denver"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <select
                  value={homeState}
                  onChange={(e) => setHomeState(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">Select state...</option>
                  {US_STATES.map((state) => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ZIP Code (optional)</label>
                <input
                  type="text"
                  value={homeZipCode}
                  onChange={(e) => setHomeZipCode(e.target.value)}
                  placeholder="e.g., 80202"
                  maxLength={10}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
          )}

          {/* Step 2: Camping Style */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Tent className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">How do you camp?</h3>
                  <p className="text-sm text-gray-500">Select all that apply - we all camp differently!</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {CAMPING_STYLES.map((style) => (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => toggleCampingStyle(style.id)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      campingStyles.includes(style.id)
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl">{style.emoji}</span>
                      {campingStyles.includes(style.id) && (
                        <Check className="w-5 h-5 text-primary-600 ml-auto" />
                      )}
                    </div>
                    <div className="font-medium text-gray-900 text-sm">{style.label}</div>
                    <div className="text-xs text-gray-500">{style.description}</div>
                  </button>
                ))}
              </div>

              {/* RV Details - only show if RV/TRAILER/VAN selected */}
              {showRVDetails && (
                <div className="mt-6 pt-6 border-t space-y-4">
                  <h4 className="font-medium text-gray-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary-500" />
                    Tell us about your rig
                  </h4>
                  
                  {/* Smart Search */}
                  <div className="relative">
                    <input
                      type="text"
                      value={rvSearchQuery}
                      onChange={(e) => handleRvSearch(e.target.value)}
                      placeholder="Search any make or model (e.g. Winnebago Revel)..."
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 pl-10"
                    />
                    <Truck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    {rvSearchResults.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white rounded-lg border border-gray-200 shadow-xl max-h-48 overflow-y-auto">
                        {rvSearchResults.map((model: any) => (
                          <button
                            key={model.id}
                            onClick={() => handleRvAutofill(model)}
                            className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-primary-50 text-left border-b border-gray-50"
                          >
                            <div className="flex-1">
                              <p className="font-medium text-gray-900 text-sm">{model.make?.name} {model.name}</p>
                              <p className="text-xs text-gray-500">
                                {model.type}{model.lengthFt ? ` · ${model.lengthFt}ft` : ''}{model.sleeps ? ` · Sleeps ${model.sleeps}` : ''}
                              </p>
                            </div>
                            <Sparkles className="w-4 h-4 text-primary-400" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Autofill Success */}
                  {rvAutofilled && selectedModel && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-3">
                      <Check className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-emerald-900">
                          {selectedModel.make?.name} {selectedModel.name} specs applied!
                        </p>
                        <p className="text-xs text-emerald-700">
                          {selectedModel.lengthFt && `${selectedModel.lengthFt}ft`}
                          {selectedModel.weightLbs && ` · ${(selectedModel.weightLbs/1000).toFixed(1)}k lbs`}
                          {selectedModel.sleeps && ` · Sleeps ${selectedModel.sleeps}`}
                          {selectedModel.mpg && ` · ${selectedModel.mpg} MPG`}
                        </p>
                      </div>
                      <button onClick={() => { setRvAutofilled(false); setSelectedModel(null); setRvMake(''); setRvModel(''); }} className="text-xs text-emerald-600 hover:underline">Change</button>
                    </div>
                  )}

                  {/* Manual fallback fields */}
                  {!rvAutofilled && (
                    <>
                      <p className="text-xs text-gray-400">Or enter manually:</p>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                        <select
                          value={rvType}
                          onChange={(e) => setRvType(e.target.value)}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        >
                          <option value="">Select type...</option>
                          {RV_TYPES.map((type) => (
                            <option key={type.id} value={type.id}>
                              {type.emoji} {type.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Make dropdown from database */}
                      {rvType && rvMakes.length > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Make</label>
                          <select
                            value={selectedMakeId}
                            onChange={(e) => {
                              setSelectedMakeId(e.target.value);
                              const make = rvMakes.find((m: any) => m.id === e.target.value);
                              if (make) setRvMake(make.name);
                            }}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          >
                            <option value="">Select make...</option>
                            {rvMakes.map((make: any) => (
                              <option key={make.id} value={make.id}>{make.name}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Model dropdown from database */}
                      {selectedMakeId && rvModels.length > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                          <select
                            value={rvModel}
                            onChange={(e) => {
                              setRvModel(e.target.value);
                              const model = rvModels.find((m: any) => m.name === e.target.value);
                              if (model) handleRvAutofill(model);
                            }}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          >
                            <option value="">Select model...</option>
                            {rvModels.map((model: any) => (
                              <option key={model.id} value={model.name}>
                                {model.name}{model.lengthFt ? ` (${model.lengthFt}ft)` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                          <input
                            type="number"
                            value={rvYear}
                            onChange={(e) => setRvYear(e.target.value)}
                            placeholder="2022"
                            min="1950"
                            max={new Date().getFullYear() + 1}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Make</label>
                          <input
                            type="text"
                            value={rvMake}
                            onChange={(e) => setRvMake(e.target.value)}
                            placeholder="Winnebago"
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                          <input
                            type="text"
                            value={rvModel}
                            onChange={(e) => setRvModel(e.target.value)}
                            placeholder="View"
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Travel Party */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <Users className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Who do you travel with?</h3>
                  <p className="text-sm text-gray-500">This helps us suggest the right spots</p>
                </div>
              </div>

              <div className="space-y-2">
                {TRAVEL_PARTY_TYPES.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setTravelPartyType(type.id)}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-center gap-4 ${
                      travelPartyType === type.id
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-3xl">{type.emoji}</span>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{type.label}</div>
                      <div className="text-sm text-gray-500">{type.description}</div>
                    </div>
                    {travelPartyType === type.id && (
                      <Check className="w-6 h-6 text-primary-600" />
                    )}
                  </button>
                ))}
              </div>

              {/* Pets Section */}
              <div className="mt-6 pt-6 border-t">
                <div className="flex items-center gap-3 mb-4">
                  <PawPrint className="w-5 h-5 text-orange-500" />
                  <span className="font-medium text-gray-900">Do you travel with pets?</span>
                </div>

                <div className="flex gap-3 mb-4">
                  <button
                    type="button"
                    onClick={() => setHasPets(true)}
                    className={`flex-1 py-3 rounded-lg border-2 font-medium transition-all ${
                      hasPets === true
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    Yes 🐕
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHasPets(false);
                      setPetTypes([]);
                    }}
                    className={`flex-1 py-3 rounded-lg border-2 font-medium transition-all ${
                      hasPets === false
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    No
                  </button>
                </div>

                {hasPets && (
                  <div className="flex flex-wrap gap-2">
                    {PET_TYPES.map((pet) => (
                      <button
                        key={pet.id}
                        type="button"
                        onClick={() => togglePetType(pet.id)}
                        className={`px-4 py-2 rounded-full border-2 text-sm font-medium transition-all ${
                          petTypes.includes(pet.id)
                            ? 'border-orange-500 bg-orange-50 text-orange-700'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {pet.emoji} {pet.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Social Links */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                  <LinkIcon className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Connect with the community</h3>
                  <p className="text-sm text-gray-500">Add your social links so others can follow your adventures</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Globe className="w-4 h-4 inline mr-1" /> Website
                  </label>
                  <input
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://yourblog.com"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    📘 Facebook
                  </label>
                  <input
                    type="url"
                    value={facebookUrl}
                    onChange={(e) => setFacebookUrl(e.target.value)}
                    placeholder="https://facebook.com/username"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    📸 Instagram
                  </label>
                  <input
                    type="url"
                    value={instagramUrl}
                    onChange={(e) => setInstagramUrl(e.target.value)}
                    placeholder="https://instagram.com/username"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    🐦 Twitter / X
                  </label>
                  <input
                    type="url"
                    value={twitterUrl}
                    onChange={(e) => setTwitterUrl(e.target.value)}
                    placeholder="https://twitter.com/username"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    📺 YouTube
                  </label>
                  <input
                    type="url"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://youtube.com/@channel"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    🎵 TikTok
                  </label>
                  <input
                    type="url"
                    value={tiktokUrl}
                    onChange={(e) => setTiktokUrl(e.target.value)}
                    placeholder="https://tiktok.com/@username"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>

              <p className="text-xs text-gray-500 mt-4">
                All fields are optional. You can always add these later in your profile settings.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50 flex items-center justify-between">
          {step > 1 ? (
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              Back
            </button>
          ) : (
            <button
              onClick={handleSkip}
              className="text-gray-500 hover:text-gray-700 transition-colors text-sm"
            >
              Skip for now
            </button>
          )}

          <button
            onClick={handleNext}
            disabled={!canProceed() || loading}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all ${
              canProceed() && !loading
                ? 'bg-primary-600 text-white hover:bg-primary-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : step === totalSteps ? (
              <>
                <Check className="w-5 h-5" />
                Complete
              </>
            ) : (
              <>
                Next
                <ChevronRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

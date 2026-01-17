import { useState, useEffect } from 'react';
import { X, MapPin, Truck, Users, PawPrint, ChevronRight, ChevronLeft, Check, Sparkles, Link as LinkIcon, Globe } from 'lucide-react';
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
  { id: 'TENT', label: 'Tent Camping', emoji: '⛺' },
  { id: 'OTHER', label: 'Other', emoji: '🏕️' },
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
  
  // RV
  const [hasRV, setHasRV] = useState<boolean | null>(null);
  const [rvType, setRvType] = useState('');
  const [rvYear, setRvYear] = useState('');
  const [rvMake, setRvMake] = useState('');
  const [rvModel, setRvModel] = useState('');
  
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
        hasRV,
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

  const canProceed = () => {
    if (step === 1) return homeCity && homeState;
    if (step === 2) return hasRV !== null && (hasRV === false || rvType);
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
            Let's personalize your experience. This helps us plan better trips for you!
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
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
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

          {/* Step 2: RV */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Truck className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Tell us about your rig</h3>
                  <p className="text-sm text-gray-500">This helps match you with compatible campgrounds</p>
                </div>
              </div>

              <div className="flex gap-4 mb-4">
                <button
                  onClick={() => setHasRV(true)}
                  className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                    hasRV === true
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="text-2xl mb-2 block">🚐</span>
                  <span className="font-medium">Yes, I have an RV</span>
                </button>
                <button
                  onClick={() => setHasRV(false)}
                  className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                    hasRV === false
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="text-2xl mb-2 block">⛺</span>
                  <span className="font-medium">No / Tent Camping</span>
                </button>
              </div>

              {hasRV && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Type of RV</label>
                    <div className="grid grid-cols-2 gap-2">
                      {RV_TYPES.filter(rv => rv.id !== 'TENT').map((rv) => (
                        <button
                          key={rv.id}
                          onClick={() => setRvType(rv.id)}
                          className={`p-3 rounded-lg border text-left transition-all ${
                            rvType === rv.id
                              ? 'border-green-500 bg-green-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <span className="mr-2">{rv.emoji}</span>
                          <span className="text-sm">{rv.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                      <input
                        type="number"
                        value={rvYear}
                        onChange={(e) => setRvYear(e.target.value)}
                        placeholder="2020"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Make</label>
                      <input
                        type="text"
                        value={rvMake}
                        onChange={(e) => setRvMake(e.target.value)}
                        placeholder="Airstream"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                      <input
                        type="text"
                        value={rvModel}
                        onChange={(e) => setRvModel(e.target.value)}
                        placeholder="Basecamp"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                </>
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
                  <p className="text-sm text-gray-500">Help us suggest the right campgrounds and activities</p>
                </div>
              </div>

              <div className="space-y-2">
                {TRAVEL_PARTY_TYPES.map((party) => (
                  <button
                    key={party.id}
                    onClick={() => setTravelPartyType(party.id)}
                    className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                      travelPartyType === party.id
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{party.emoji}</span>
                      <div>
                        <div className="font-medium">{party.label}</div>
                        <div className="text-sm text-gray-500">{party.description}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {(travelPartyType === 'FAMILY' || travelPartyType === 'GROUP') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    How many people typically travel with you?
                  </label>
                  <input
                    type="number"
                    value={travelPartySize}
                    onChange={(e) => setTravelPartySize(e.target.value)}
                    min="1"
                    max="20"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              )}

              <div className="border-t border-gray-200 pt-4 mt-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasPets}
                    onChange={(e) => setHasPets(e.target.checked)}
                    className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
                  />
                  <PawPrint className="w-5 h-5 text-amber-600" />
                  <span className="font-medium">I travel with pets</span>
                </label>

                {hasPets && (
                  <div className="mt-3 ml-8 flex flex-wrap gap-2">
                    {PET_TYPES.map((pet) => (
                      <button
                        key={pet.id}
                        onClick={() => togglePetType(pet.id)}
                        className={`px-4 py-2 rounded-full border transition-all ${
                          petTypes.includes(pet.id)
                            ? 'border-amber-500 bg-amber-50 text-amber-700'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <span className="mr-1">{pet.emoji}</span>
                        {pet.label}
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
                  <h3 className="text-lg font-semibold text-gray-900">Connect your socials</h3>
                  <p className="text-sm text-gray-500">Optional - Share your social links with the community</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Globe className="w-4 h-4 inline mr-1" />
                  Website / Blog
                </label>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://yoursite.com"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <svg className="w-4 h-4 inline mr-1" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  Facebook
                </label>
                <input
                  type="url"
                  value={facebookUrl}
                  onChange={(e) => setFacebookUrl(e.target.value)}
                  placeholder="https://facebook.com/yourpage"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <svg className="w-4 h-4 inline mr-1" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                  Instagram
                </label>
                <input
                  type="url"
                  value={instagramUrl}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                  placeholder="https://instagram.com/yourhandle"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <svg className="w-4 h-4 inline mr-1" fill="currentColor" viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg>
                  Twitter / X
                </label>
                <input
                  type="url"
                  value={twitterUrl}
                  onChange={(e) => setTwitterUrl(e.target.value)}
                  placeholder="https://twitter.com/yourhandle"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <svg className="w-4 h-4 inline mr-1" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                  YouTube
                </label>
                <input
                  type="url"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://youtube.com/@yourchannel"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <svg className="w-4 h-4 inline mr-1" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
                  TikTok
                </label>
                <input
                  type="url"
                  value={tiktokUrl}
                  onChange={(e) => setTiktokUrl(e.target.value)}
                  placeholder="https://tiktok.com/@yourhandle"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <p className="text-xs text-gray-500 text-center mt-4">
                You can always add or update these later in your Basecamp settings
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <button
              onClick={handleBack}
              disabled={step === 1}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                step === 1
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-600 hover:bg-gray-200'
              }`}
            >
              <ChevronLeft className="w-5 h-5" />
              Back
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSkip}
                className="text-gray-500 hover:text-gray-700 text-sm"
              >
                Skip for now
              </button>
              <button
                onClick={handleNext}
                disabled={!canProceed() || loading}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all ${
                  canProceed() && !loading
                    ? 'bg-primary-600 text-white hover:bg-primary-700'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : step === totalSteps ? (
                  <>
                    <Check className="w-5 h-5" />
                    Finish
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
      </div>
    </div>
  );
}

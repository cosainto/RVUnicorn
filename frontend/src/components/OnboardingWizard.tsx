import { useState, useEffect } from 'react';
import { X, MapPin, Truck, Users, PawPrint, ChevronRight, ChevronLeft, Check, Sparkles } from 'lucide-react';
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

  const totalSteps = 3;

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

  const handleNext = async () => {
    if (step === 1) {
      await saveHometown();
    } else if (step === 2) {
      await saveRV();
    } else if (step === 3) {
      await saveTravelParty();
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
            {[1, 2, 3].map((s) => (
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

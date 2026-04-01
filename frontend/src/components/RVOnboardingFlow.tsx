import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, ChevronRight, ChevronLeft, Truck, Users, Link2, Check,
  Copy, QrCode, Mail, X, Sparkles, ArrowRight, UserPlus, Share2
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════
interface RVMake {
  id: string;
  name: string;
  logo?: string;
  website?: string;
  types: string[];
  _count?: { models: number };
}

interface RVModel {
  id: string;
  name: string;
  type: string;
  make?: { name: string };
  lengthFt?: number;
  heightFt?: number;
  weightLbs?: number;
  sleeps?: number;
  slideouts?: number;
  mpg?: number;
  tankGallons?: number;
  features: string[];
  stockImage?: string;
  msrp?: string;
}

interface UserResult {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  profilePicture?: string;
  rvMake?: string;
  rvModel?: string;
  rvType?: string;
}

// ═══════════════════════════════════════════════════════════════
// Main Component — 4-step onboarding
// ═══════════════════════════════════════════════════════════════
export default function RVOnboardingFlow({ onComplete }: { onComplete?: () => void }) {
  const navigate = useNavigate();
  const { user: authUser } = useAuth() as any;
  const [step, setStep] = useState(0); // 0: Persona, 1: Type, 2: Make, 3: Model/Autofill, 4: Co-traveler
  const [userPersona, setUserPersona] = useState<'owner' | 'dreamer' | 'renter' | ''>('');
  const [rvType, setRvType] = useState('');
  const [selectedMake, setSelectedMake] = useState<RVMake | null>(null);
  const [selectedModel, setSelectedModel] = useState<RVModel | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [year, setYear] = useState<number>(new Date().getFullYear());

  // Data
  const [types, setTypes] = useState<string[]>([]);
  const [makes, setMakes] = useState<RVMake[]>([]);
  const [models, setModels] = useState<RVModel[]>([]);
  const [searchResults, setSearchResults] = useState<{ makes: RVMake[]; models: RVModel[] }>({ makes: [], models: [] });
  const [loading, setLoading] = useState(false);
  const [autofilling, setAutofilling] = useState(false);
  const [autofilled, setAutofilled] = useState(false);

  // Co-traveler
  const [coTravelerMode, setCoTravelerMode] = useState<'search' | 'invite' | 'qr' | null>(null);
  const [coTravelerQuery, setCoTravelerQuery] = useState('');
  const [coTravelerResults, setCoTravelerResults] = useState<UserResult[]>([]);
  const [inviteUrl, setInviteUrl] = useState('');
  const [inviteCopied, setInviteCopied] = useState(false);
  const [linkSent, setLinkSent] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Load RV types
  useEffect(() => {
    api.get('/rv/types').then(({ data }) => {
      setTypes(data.map((t: any) => t.name));
    }).catch(() => {
      setTypes([
        'Class A', 'Class B', 'Class B+', 'Class C', 'Travel Trailer',
        'Fifth Wheel', 'Toy Hauler', 'Pop-Up Camper', 'Truck Camper',
        'Teardrop Trailer', 'Airstream', 'Van Conversion', 'Skoolie',
        'Overlander', 'Park Model', 'Hybrid Trailer',
      ]);
    });
  }, []);

  // Load makes when type selected
  useEffect(() => {
    if (!rvType) return;
    setLoading(true);
    api.get(`/rv/makes?type=${encodeURIComponent(rvType)}`).then(({ data }) => {
      setMakes(data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [rvType]);

  // Load models when make selected
  useEffect(() => {
    if (!selectedMake) return;
    setLoading(true);
    api.get(`/rv/makes/${selectedMake.id}/models?type=${encodeURIComponent(rvType)}`).then(({ data }) => {
      setModels(data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [selectedMake, rvType]);

  // Search debounce
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) { setSearchResults({ makes: [], models: [] }); return; }

    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get(`/rv/search?q=${encodeURIComponent(query)}`);
        setSearchResults(data);
      } catch {}
    }, 300);
  }, []);

  // Autofill from selected model
  const handleAutofill = async () => {
    if (!selectedModel) return;
    setAutofilling(true);
    try {
      await api.post('/rv/autofill', { modelId: selectedModel.id });

      // Also set the year
      if (year) {
        await api.put('/auth/profile', { rvYear: year });
      }

      setAutofilled(true);
    } catch (e) {
      console.error('Autofill failed:', e);
    }
    setAutofilling(false);
  };

  // Manual save (skip autofill)
  const handleManualSave = async () => {
    try {
      const data: any = { rvType };
      if (selectedMake) data.rvMake = selectedMake.name;
      if (selectedModel) data.rvModel = selectedModel.name;
      if (year) data.rvYear = year;
      await api.put('/auth/profile', data);
      setStep(4);
    } catch {}
  };

  // Co-traveler search
  const handleCoTravelerSearch = useCallback((query: string) => {
    setCoTravelerQuery(query);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) { setCoTravelerResults([]); return; }

    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await api.post('/rv/link/search', { query });
        setCoTravelerResults(data);
      } catch {}
    }, 300);
  }, []);

  // Generate invite link
  const generateInvite = async () => {
    try {
      const { data } = await api.post('/rv/link/invite');
      setInviteUrl(data.url);
    } catch {}
  };

  // Send link request
  const sendLinkRequest = async (targetUserId: string) => {
    try {
      await api.post('/rv/link/request', { targetUserId, message: `I travel in the same ${rvType || 'RV'}!` });
      setLinkSent(true);
      setTimeout(() => setLinkSent(false), 3000);
    } catch (e) {
      console.error('Link request failed:', e);
    }
  };

  const copyInvite = () => {
    navigator.clipboard.writeText(inviteUrl);
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2000);
  };

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════
  // Persona-aware navigation
  const handlePersonaNext = () => {
    if (userPersona === 'owner') setStep(1);
    else if (userPersona === 'dreamer') setStep(4); // skip rig, go to co-traveler
    else if (userPersona === 'renter') setStep(1); // simplified rig step
  };

  // Save persona on completion
  const savePersona = async () => {
    if (!userPersona) return;
    try {
      const username = authUser?.username;
      if (username) await api.put(`/profile/${username}`, { userPersona });
    } catch {}
  };

  return (
    <div className="max-w-2xl mx-auto">

      {/* ══════════════════════════════════ STEP 0: PERSONA */}
      {step === 0 && (
        <div>
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
              <span>🦄</span> Hitch says...
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Hey{authUser?.firstName ? ` ${authUser.firstName}` : ''}! Before we fire up the campfire —
            </h2>
            <p className="text-gray-500">Where are you on your RV journey?</p>
          </div>

          <div className="space-y-3">
            {([
              ['owner', '🚐', "I own a rig", "Let's get your setup on the road"],
              ['dreamer', '🔍', "I'm shopping or dreaming", "Browse, save dream rigs, no specs needed"],
              ['renter', '🔑', "I rent or borrow", "Plan trips without the ownership hassle"],
            ] as const).map(([val, emoji, title, subtitle]) => (
              <button
                key={val}
                onClick={() => setUserPersona(val)}
                className={`w-full flex items-center gap-4 p-5 rounded-2xl border-2 transition text-left ${userPersona === val ? 'border-orange-500 bg-orange-50 shadow-sm' : 'border-gray-200 bg-white hover:border-orange-300'}`}
              >
                <span className="text-3xl">{emoji}</span>
                <div className="flex-1">
                  <p className={`font-bold text-base ${userPersona === val ? 'text-orange-700' : 'text-gray-900'}`}>{title}</p>
                  <p className="text-sm text-gray-500">{subtitle}</p>
                </div>
                {userPersona === val && <Check className="w-6 h-6 text-orange-500 flex-shrink-0" />}
              </button>
            ))}
          </div>

          <button
            onClick={handlePersonaNext}
            disabled={!userPersona}
            className="mt-8 w-full bg-primary-600 text-white py-3 rounded-xl font-semibold hover:bg-primary-700 disabled:opacity-40 transition flex items-center justify-center gap-2"
          >
            Continue <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Progress Bar — only show on steps 1-4 */}
      {step >= 1 && (
      <div className="flex items-center gap-2 mb-8">
        {(userPersona === 'dreamer' ? [4] : userPersona === 'renter' ? [1, 4] : [1, 2, 3, 4]).map((s, i, arr) => (
          <div key={s} className="flex-1 flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
              s <= step ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-400'
            }`}>
              {s < step ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            {i < arr.length - 1 && (
              <div className={`flex-1 h-1 mx-1 rounded transition-all ${s < step ? 'bg-primary-600' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>
      )}

      {/* ══════════════════════════════════ STEP 1: RV TYPE */}
      {step === 1 && (
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {userPersona === 'renter' ? 'What type of rig do you usually rent?' : 'What kind of rig do you have?'}
          </h2>
          <p className="text-gray-500 mb-6">
            {userPersona === 'renter' ? 'This helps us personalize your experience' : 'Select your RV type to get started'}
          </p>

          {/* Quick Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Or search any make/model directly..."
              className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Search Results */}
          {searchQuery.length >= 2 && (searchResults.makes.length > 0 || searchResults.models.length > 0) && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-lg mb-4 max-h-64 overflow-y-auto">
              {searchResults.models.map(model => (
                <button
                  key={model.id}
                  onClick={() => {
                    setSelectedModel(model);
                    setRvType(model.type);
                    setSearchQuery('');
                    setStep(3);
                  }}
                  className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 border-b border-gray-50 text-left"
                >
                  <Truck className="w-5 h-5 text-primary-500 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-gray-900">{model.make?.name} {model.name}</p>
                    <p className="text-xs text-gray-500">{model.type} · {model.lengthFt}ft · Sleeps {model.sleeps}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 ml-auto" />
                </button>
              ))}
            </div>
          )}

          {/* Type Grid */}
          <div className="grid grid-cols-2 gap-3">
            {types.map(type => (
              <button
                key={type}
                onClick={() => { setRvType(type); setStep(userPersona === 'renter' ? 4 : 2); }}
                className={`p-4 rounded-xl border-2 text-left transition-all hover:shadow-md ${
                  rvType === type ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Truck className="w-6 h-6 text-primary-600 mb-2" />
                <p className="font-semibold text-gray-900 text-sm">{type}</p>
              </button>
            ))}
          </div>

          <button
            onClick={() => setStep(4)}
            className="mt-6 text-sm text-gray-400 hover:text-gray-600"
          >
            Skip — I'll add this later
          </button>
        </div>
      )}

      {/* ══════════════════════════════════ STEP 2: MAKE */}
      {step === 2 && (
        <div>
          <button onClick={() => setStep(1)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
            <ChevronLeft className="w-4 h-4" /> Back to types
          </button>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Who makes your {rvType}?</h2>
          <p className="text-gray-500 mb-6">Select the manufacturer</p>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-2">
              {makes.map(make => (
                <button
                  key={make.id}
                  onClick={() => { setSelectedMake(make); setStep(3); }}
                  className="flex items-center gap-3 w-full p-4 rounded-xl border border-gray-200 hover:border-primary-300 hover:bg-primary-50/30 transition text-left"
                >
                  {make.logo ? (
                    <img src={make.logo} alt="" className="w-10 h-10 rounded-lg object-contain" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
                      <span className="text-primary-700 font-bold text-sm">{make.name.charAt(0)}</span>
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{make.name}</p>
                    <p className="text-xs text-gray-500">{make._count?.models || 0} models</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-300" />
                </button>
              ))}

              {makes.length === 0 && (
                <p className="text-center text-gray-400 py-8">No makes found for {rvType}</p>
              )}
            </div>
          )}

          <button
            onClick={() => { handleManualSave(); }}
            className="mt-6 text-sm text-gray-400 hover:text-gray-600"
          >
            My manufacturer isn't listed — skip
          </button>
        </div>
      )}

      {/* ══════════════════════════════════ STEP 3: MODEL + AUTOFILL */}
      {step === 3 && (
        <div>
          <button onClick={() => setStep(2)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
            <ChevronLeft className="w-4 h-4" /> Back to makes
          </button>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {selectedMake ? `${selectedMake.name} Models` : 'Select Your Model'}
          </h2>
          <p className="text-gray-500 mb-4">Select to autofill your specs</p>

          {/* Year Selector */}
          <div className="flex items-center gap-3 mb-6">
            <label className="text-sm font-medium text-gray-700">Year:</label>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {Array.from({ length: 30 }, (_, i) => new Date().getFullYear() + 1 - i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Selected Model Preview */}
          {selectedModel && (
            <div className="bg-gradient-to-br from-primary-50 to-blue-50 rounded-2xl p-6 mb-6 border border-primary-100">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{selectedModel.make?.name} {selectedModel.name}</h3>
                  <p className="text-sm text-gray-500">{year} · {selectedModel.type}</p>
                </div>
                <Sparkles className="w-6 h-6 text-primary-500" />
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                {selectedModel.lengthFt && (
                  <div className="bg-white/70 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-gray-900">{selectedModel.lengthFt}'</p>
                    <p className="text-[10px] text-gray-500">Length</p>
                  </div>
                )}
                {selectedModel.weightLbs && (
                  <div className="bg-white/70 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-gray-900">{(selectedModel.weightLbs / 1000).toFixed(1)}k</p>
                    <p className="text-[10px] text-gray-500">lbs</p>
                  </div>
                )}
                {selectedModel.sleeps && (
                  <div className="bg-white/70 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-gray-900">{selectedModel.sleeps}</p>
                    <p className="text-[10px] text-gray-500">Sleeps</p>
                  </div>
                )}
                {selectedModel.slideouts != null && (
                  <div className="bg-white/70 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-gray-900">{selectedModel.slideouts}</p>
                    <p className="text-[10px] text-gray-500">Slides</p>
                  </div>
                )}
                {selectedModel.mpg && (
                  <div className="bg-white/70 rounded-lg p-2 text-center">
                    <p className="text-lg font-bold text-gray-900">{selectedModel.mpg}</p>
                    <p className="text-[10px] text-gray-500">MPG</p>
                  </div>
                )}
              </div>

              {selectedModel.features.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {selectedModel.features.map((f, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 bg-white/60 text-gray-600 rounded-full">{f}</span>
                  ))}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleAutofill}
                  disabled={autofilling}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 disabled:opacity-50 transition"
                >
                  {autofilling ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : autofilled ? (
                    <><Check className="w-4 h-4" /> Applied!</>
                  ) : (
                    <><Sparkles className="w-4 h-4" /> Autofill My Profile</>
                  )}
                </button>
                <button
                  onClick={() => { setSelectedModel(null); }}
                  className="px-4 py-3 border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 transition"
                >
                  Choose Different
                </button>
              </div>

              {autofilled && (
                <button
                  onClick={() => setStep(4)}
                  className="mt-3 w-full flex items-center justify-center gap-2 py-3 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition"
                >
                  Continue <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* Model List */}
          {!selectedModel && (
            <>
              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="space-y-2">
                  {models.map(model => (
                    <button
                      key={model.id}
                      onClick={() => setSelectedModel(model)}
                      className="flex items-center gap-3 w-full p-4 rounded-xl border border-gray-200 hover:border-primary-300 hover:bg-primary-50/30 transition text-left"
                    >
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{model.name}</p>
                        <p className="text-xs text-gray-500">
                          {model.type}
                          {model.lengthFt && ` · ${model.lengthFt}ft`}
                          {model.sleeps && ` · Sleeps ${model.sleeps}`}
                          {model.slideouts != null && ` · ${model.slideouts} slides`}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-300" />
                    </button>
                  ))}
                  {models.length === 0 && (
                    <p className="text-center text-gray-400 py-8">No models found — you can still enter specs manually on your profile</p>
                  )}
                </div>
              )}
            </>
          )}

          <button
            onClick={() => { handleManualSave(); }}
            className="mt-6 text-sm text-gray-400 hover:text-gray-600"
          >
            My model isn't listed — skip
          </button>
        </div>
      )}

      {/* ══════════════════════════════════ STEP 4: CO-TRAVELER */}
      {step === 4 && (
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Travel with someone?</h2>
          <p className="text-gray-500 mb-6">Link your accounts to share vehicle info and plan trips together</p>

          {/* Link Methods */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <button
              onClick={() => setCoTravelerMode('search')}
              className={`p-4 rounded-xl border-2 text-center transition ${
                coTravelerMode === 'search' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Search className="w-6 h-6 text-primary-600 mx-auto mb-2" />
              <p className="text-sm font-medium">Search User</p>
            </button>
            <button
              onClick={() => { setCoTravelerMode('invite'); if (!inviteUrl) generateInvite(); }}
              className={`p-4 rounded-xl border-2 text-center transition ${
                coTravelerMode === 'invite' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Link2 className="w-6 h-6 text-primary-600 mx-auto mb-2" />
              <p className="text-sm font-medium">Invite Link</p>
            </button>
            <button
              onClick={() => { setCoTravelerMode('qr'); if (!inviteUrl) generateInvite(); }}
              className={`p-4 rounded-xl border-2 text-center transition ${
                coTravelerMode === 'qr' ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <QrCode className="w-6 h-6 text-primary-600 mx-auto mb-2" />
              <p className="text-sm font-medium">QR Code</p>
            </button>
          </div>

          {/* Search by username */}
          {coTravelerMode === 'search' && (
            <div className="mb-6">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={coTravelerQuery}
                  onChange={(e) => handleCoTravelerSearch(e.target.value)}
                  placeholder="Search by name, username, or email..."
                  className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                {coTravelerResults.map(user => (
                  <div key={user.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200">
                    {user.profilePicture ? (
                      <img src={user.profilePicture} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                        <Users className="w-5 h-5 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-xs text-gray-500">
                        @{user.username}
                        {user.rvMake && ` · ${user.rvMake} ${user.rvModel || ''}`}
                      </p>
                    </div>
                    <button
                      onClick={() => sendLinkRequest(user.id)}
                      className="px-3 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition flex items-center gap-1"
                    >
                      <UserPlus className="w-3.5 h-3.5" /> Link
                    </button>
                  </div>
                ))}
              </div>

              {linkSent && (
                <div className="mt-3 p-3 bg-emerald-50 text-emerald-700 rounded-xl text-sm flex items-center gap-2">
                  <Check className="w-4 h-4" /> Link request sent! They'll be notified.
                </div>
              )}
            </div>
          )}

          {/* Invite Link */}
          {coTravelerMode === 'invite' && (
            <div className="mb-6">
              {inviteUrl ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <input
                      type="text"
                      value={inviteUrl}
                      readOnly
                      className="flex-1 bg-transparent text-sm text-gray-600 outline-none"
                    />
                    <button
                      onClick={copyInvite}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1 ${
                        inviteCopied ? 'bg-emerald-100 text-emerald-700' : 'bg-primary-100 text-primary-700 hover:bg-primary-200'
                      }`}
                    >
                      {inviteCopied ? <><Check className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400">Share this link with your co-traveler. Valid for 7 days.</p>

                  <div className="flex gap-2">
                    <a
                      href={`mailto:?subject=Join my RV on RVUnicorn!&body=I'd like you to join my RV profile on RVUnicorn! Click here: ${inviteUrl}`}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-50 text-blue-700 rounded-xl text-sm font-medium hover:bg-blue-100 transition"
                    >
                      <Mail className="w-4 h-4" /> Send via Email
                    </a>
                    <button
                      onClick={() => {
                        if (navigator.share) {
                          navigator.share({ title: 'Join my RV on RVUnicorn', url: inviteUrl });
                        }
                      }}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-purple-50 text-purple-700 rounded-xl text-sm font-medium hover:bg-purple-100 transition"
                    >
                      <Share2 className="w-4 h-4" /> Share
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          )}

          {/* QR Code */}
          {coTravelerMode === 'qr' && (
            <div className="mb-6 text-center">
              {inviteUrl ? (
                <>
                  <div className="inline-block p-4 bg-white rounded-2xl shadow-lg border border-gray-200 mb-3">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(inviteUrl)}`}
                      alt="QR Code"
                      className="w-48 h-48"
                    />
                  </div>
                  <p className="text-sm text-gray-500">Have your co-traveler scan this code</p>
                </>
              ) : (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          )}

          {/* Dreamer welcome message */}
          {userPersona === 'dreamer' && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
              <p className="text-sm text-orange-800">🦄 <strong>No rig yet? No problem!</strong> Let's find your dream setup and connect you with owners while you shop.</p>
            </div>
          )}

          {/* Complete */}
          <button
            onClick={async () => {
              await savePersona();
              if (onComplete) onComplete();
              else navigate('/basecamp');
            }}
            className="w-full py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition flex items-center justify-center gap-2"
          >
            {coTravelerMode ? 'Finish Setup' : 'Skip — I travel solo'} <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

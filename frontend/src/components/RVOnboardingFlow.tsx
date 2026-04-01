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

  // Magic Rig Reveal state
  const [rigYear, setRigYear] = useState(String(new Date().getFullYear()));
  const [rigMake, setRigMake] = useState('');
  const [rigModel, setRigModel] = useState('');
  const [rigSpecs, setRigSpecs] = useState<any>(null);
  const [rigLooking, setRigLooking] = useState(false);
  const [rigStockImage, setRigStockImage] = useState<string | null>(null);
  const [rigEditMode, setRigEditMode] = useState(false);
  const [customBuildStep, setCustomBuildStep] = useState(0); // for "Other" make flow

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
  const RIG_MAKES = ['Airstream','Coachmen','Forest River','Grand Design','Jayco','Keystone','Monaco','Newmar','Thor','Tiffin','Winnebago','Other'];

  const RIG_TYPE_IMAGES: Record<string, string> = {
    'Class A': 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1774218289/rvunicorn/guides/hitch_guide.png',
    'Class B': 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1774218289/rvunicorn/guides/hitch_guide.png',
    'Class C': 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1774218289/rvunicorn/guides/hitch_guide.png',
  };

  const handleRigLookup = async () => {
    if (!rigMake || !rigModel) return;
    setRigLooking(true);
    try {
      const { data } = await api.post('/rv/lookup', { year: rigYear, make: rigMake, model: rigModel });
      setRigSpecs(data.specs);
      setRigStockImage(data.stockImage || RIG_TYPE_IMAGES[data.specs?.rvType] || null);
      if (data.specs?.rvType) setRvType(data.specs.rvType);
      if (data.specs?.confidence === 'low' || rigMake === 'Other') setCustomBuildStep(1);
    } catch { setRigSpecs(null); setCustomBuildStep(1); }
    finally { setRigLooking(false); }
  };

  const handleConfirmRig = async () => {
    try {
      const username = authUser?.username;
      if (!username) return;
      await api.put(`/profile/${username}`, {
        rvType: rigSpecs?.rvType || rvType || undefined,
        rvMake: rigMake !== 'Other' ? rigMake : undefined,
        rvModel: rigModel || undefined,
        rvYear: rigYear ? parseInt(rigYear) : undefined,
        rvLength: rigSpecs?.lengthFt || undefined,
        rvHeight: rigSpecs?.heightFt || undefined,
        rvWeight: rigSpecs?.weightLbs || undefined,
        rvSleeps: rigSpecs?.sleeps || undefined,
        rvSlideouts: rigSpecs?.slideoutCount || undefined,
        rvMpg: rigSpecs?.mpg || undefined,
        rvFreshWaterGal: rigSpecs?.freshWaterGal || undefined,
        rvGreyWaterGal: rigSpecs?.grayWaterGal || undefined,
        rvBlackWaterGal: rigSpecs?.blackWaterGal || undefined,
        userPersona,
      });
    } catch {}
    setStep(4);
  };

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

      {/* ══════════════════════════════════ STEP 1: MAGIC RIG REVEAL */}
      {step === 1 && !rigSpecs && !rigLooking && customBuildStep === 0 && (
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {userPersona === 'renter' ? 'What type of rig do you usually rent?' : "Let's find your rig"}
          </h2>
          <p className="text-gray-500 mb-6">
            {userPersona === 'renter' ? 'This helps us personalize your experience' : 'Tell us what you drive and Hitch will look up the specs'}
          </p>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Year</label>
              <input type="number" value={rigYear} onChange={e => setRigYear(e.target.value)} min="1970" max="2027" placeholder="2024"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Make</label>
              <select value={rigMake} onChange={e => setRigMake(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white">
                <option value="">Select manufacturer...</option>
                {RIG_MAKES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Model</label>
              <input type="text" value={rigModel} onChange={e => setRigModel(e.target.value)} placeholder="e.g. Montana 3761FL"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>

          <button onClick={handleRigLookup} disabled={!rigMake || !rigModel}
            className="mt-6 w-full bg-primary-600 text-white py-3 rounded-xl font-semibold hover:bg-primary-700 disabled:opacity-40 transition flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4" /> Reveal My Rig
          </button>

          <button onClick={() => setStep(4)} className="mt-3 w-full text-sm text-gray-400 hover:text-gray-600 text-center">
            Skip — I'll add this later
          </button>
        </div>
      )}

      {/* ── Rig Lookup Loading */}
      {step === 1 && rigLooking && (
        <div className="text-center py-12">
          <div className="text-5xl mb-4 animate-bounce">🔍</div>
          <p className="text-gray-700 font-medium animate-pulse">Looking up your {rigYear} {rigMake} {rigModel}...</p>
          <p className="text-sm text-gray-400 mt-2">Hitch is checking the specs database</p>
        </div>
      )}

      {/* ── Magic Rig Reveal Screen */}
      {step === 1 && rigSpecs && !rigLooking && customBuildStep === 0 && (
        <div>
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">We think your {rigYear} {rigMake} {rigModel} has:</h2>
          </div>

          {rigStockImage && (
            <div className="rounded-2xl overflow-hidden mb-4 bg-gray-100 h-40 flex items-center justify-center">
              <img src={rigStockImage} alt="" className="h-full object-contain" />
            </div>
          )}

          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 space-y-2.5 mb-4">
            {[
              rigSpecs.rvType && ['🚐', `${rigSpecs.rvType}`],
              rigSpecs.lengthFt && ['📏', `${rigSpecs.lengthFt} ft length`],
              rigSpecs.weightLbs && ['⚖️', `${rigSpecs.weightLbs.toLocaleString()} lbs`],
              rigSpecs.sleeps && ['🛏️', `Sleeps ${rigSpecs.sleeps}`],
              rigSpecs.slideoutCount > 0 && ['🏠', `${rigSpecs.slideoutCount} slide-out${rigSpecs.slideoutCount > 1 ? 's' : ''}`],
              rigSpecs.freshWaterGal && ['💧', `${rigSpecs.freshWaterGal} gal fresh water`],
              rigSpecs.mpg && ['⛽', `~${rigSpecs.mpg} MPG`],
              rigSpecs.hasSolar && ['☀️', 'Solar equipped'],
              rigSpecs.hasResidentialFridge && ['🧊', 'Residential fridge'],
              rigSpecs.isGoodForBigRigs && ['🦺', 'Big rig friendly'],
            ].filter(Boolean).map((item, i) => {
              const [emoji, label] = item as [string, string];
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-lg">{emoji}</span>
                  <span className="text-sm font-medium text-green-800 flex-1">{label}</span>
                  {rigEditMode ? (
                    <input
                      defaultValue={label.split(' ').find(s => !isNaN(Number(s))) || ''}
                      className="w-20 text-xs border border-green-300 rounded px-2 py-1 text-right"
                    />
                  ) : (
                    <Check className="w-4 h-4 text-green-500" />
                  )}
                </div>
              );
            })}
          </div>

          <button onClick={handleConfirmRig}
            className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition flex items-center justify-center gap-2 mb-3">
            <Check className="w-5 h-5" /> That's my rig!
          </button>
          <button onClick={() => setRigEditMode(!rigEditMode)}
            className="w-full text-sm text-gray-500 hover:text-gray-700 text-center">
            {rigEditMode ? 'Done editing' : "Something's off — let me fix it"}
          </button>
        </div>
      )}

      {/* ── Custom Build Path (for "Other" or low-confidence) */}
      {step === 1 && customBuildStep > 0 && (
        <div>
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-orange-800">🦄 Looks like {rigMake === 'Other' ? 'a custom build' : "a unique rig"} — Hitch will ask you a few quick questions!</p>
          </div>

          {customBuildStep === 1 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">What type of rig is it?</h2>
              <div className="grid grid-cols-2 gap-3">
                {[['🚐','Van/Class B'],['🚌','Bus/Class A'],['🚍','Class C'],['🏠','Fifth Wheel'],['🚗','Travel Trailer'],['⛺','Other']].map(([emoji, label]) => (
                  <button key={label} onClick={() => {
                    setRigSpecs((s: any) => ({ ...(s || {}), rvType: label.split('/')[0] }));
                    setRvType(label.split('/')[0]);
                    setCustomBuildStep(2);
                  }} className="flex items-center gap-2 p-4 rounded-xl border-2 border-gray-200 hover:border-primary-500 transition text-left">
                    <span className="text-xl">{emoji}</span>
                    <span className="font-semibold text-sm text-gray-800">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {customBuildStep === 2 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">How long is your rig?</h2>
              <div className="grid grid-cols-3 gap-3">
                {[['< 20ft', 18], ['20-25ft', 23], ['25-30ft', 28], ['30-35ft', 33], ['35-40ft', 38], ['40ft+', 42]].map(([label, val]) => (
                  <button key={label} onClick={() => {
                    setRigSpecs((s: any) => ({ ...(s || {}), lengthFt: val }));
                    setCustomBuildStep(3);
                  }} className="p-3 rounded-xl border-2 border-gray-200 hover:border-primary-500 transition text-center font-semibold text-sm">{label as string}</button>
                ))}
              </div>
            </div>
          )}

          {customBuildStep === 3 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Sleeps how many?</h2>
              <div className="grid grid-cols-4 gap-3">
                {[1,2,3,4,5,6,7,8].map(n => (
                  <button key={n} onClick={() => {
                    setRigSpecs((s: any) => ({ ...(s || {}), sleeps: n }));
                    setCustomBuildStep(4);
                  }} className="p-3 rounded-xl border-2 border-gray-200 hover:border-primary-500 transition text-center font-bold text-lg">{n}</button>
                ))}
              </div>
            </div>
          )}

          {customBuildStep === 4 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Has solar panels?</h2>
              <div className="grid grid-cols-2 gap-3">
                {[['☀️ Yes', true], ['❌ No', false]].map(([label, val]) => (
                  <button key={String(val)} onClick={() => {
                    setRigSpecs((s: any) => ({ ...(s || {}), hasSolar: val }));
                    setCustomBuildStep(0); // back to reveal
                    if (!rigSpecs?.confidence) setRigSpecs((s: any) => ({ ...s, confidence: 'custom' }));
                  }} className="p-4 rounded-xl border-2 border-gray-200 hover:border-primary-500 transition text-center font-semibold">{label as string}</button>
                ))}
              </div>
            </div>
          )}
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

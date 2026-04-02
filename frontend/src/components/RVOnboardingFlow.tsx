import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, ChevronRight, ChevronLeft, Truck, Users, Link2, Check,
  Copy, QrCode, Mail, X, Sparkles, ArrowRight, UserPlus, Share2
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import RigCard from './RigCard';

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

  // Hitch micro-comments
  const [hitchComment, setHitchComment] = useState('');
  const [slideDir, setSlideDir] = useState<'right' | 'left'>('right');
  const [sliding, setSliding] = useState(false);
  const prevStepRef = useRef(0);

  const HITCH_AVATAR = 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1774218289/rvunicorn/guides/hitch_guide.png';

  // Slide transition on step change
  useEffect(() => {
    if (step !== prevStepRef.current) {
      setSlideDir(step > prevStepRef.current ? 'right' : 'left');
      setSliding(true);
      const t = setTimeout(() => setSliding(false), 300);
      prevStepRef.current = step;
      return () => clearTimeout(t);
    }
  }, [step]);

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
      // Find the user's username for the rig connection request
      const target = coTravelerResults.find(u => u.id === targetUserId);
      if (target) {
        await api.post('/rig-connection/request', { username: target.username });
      } else {
        await api.post('/rv/link/request', { targetUserId, message: `I travel in the same ${rvType || 'RV'}!` });
      }
      setLinkSent(true);
    } catch {}
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
      if (data.specs?.rvType) {
        setRvType(data.specs.rvType);
        setHitchComment(hitchRigComments[data.specs.rvType] || `A ${data.specs.rvType} — solid choice! Let me check those specs...`);
      }
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
  const hitchRigComments: Record<string, string> = {
    'Class A': "Nice rig 👀 — a Class A opens up a lot of premium spots that smaller rigs can't access",
    'Class B': "Van life! You'll go places most RVers can only dream about 🌲",
    'Class C': "Great all-arounder — the C is the sweet spot of the RV world",
    'Fifth Wheel': "Fifth wheels are the kings of comfort. That pin weight though... 😅",
    'Travel Trailer': "Classic choice. You've got the most campground options of anyone",
    'Tent': "Old school respect 🏕️ — you're the real campers",
    'Van': "Van life! You'll go places most RVers can only dream about 🌲",
    'Bus': "Nice rig 👀 — a bus conversion opens up a world of possibilities",
    'Other': "Custom builds are the best builds — every one is unique 🛠️",
  };

  const handlePersonaNext = () => {
    if (userPersona === 'owner') { setHitchComment("Let's get your rig dialed in — this is the fun part 🚐"); setStep(1); }
    else if (userPersona === 'dreamer') { setHitchComment("No rig yet? No problem — let's find your people first 🌟"); setStep(4); }
    else if (userPersona === 'renter') { setHitchComment("Smart — rentals let you try before you buy 🔑"); setStep(1); }
  };

  // Save persona on completion
  const savePersona = async () => {
    if (!userPersona) return;
    try {
      const username = authUser?.username;
      if (username) await api.put(`/profile/${username}`, { userPersona });
    } catch {}
  };

  // Save onboarding progress to backend
  const saveProgress = async (stepNum: number, completed = false) => {
    try {
      await api.patch('/users/me/onboarding-progress', {
        step: stepNum,
        data: { userPersona, rvType, rigMake, rigModel, rigYear },
        completed,
      });
    } catch {}
  };

  // Save progress when step changes
  useEffect(() => {
    if (step > 0) saveProgress(step);
  }, [step]);

  return (
    <div className="max-w-2xl mx-auto relative">
      <style>{`
        @keyframes slideInRight { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes slideInLeft { from { opacity: 0; transform: translateX(-40px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes hitchPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.08); } }
        @keyframes hitchBubbleIn { from { opacity: 0; transform: translateY(8px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .slide-in-right { animation: slideInRight 0.3s ease-out; }
        .slide-in-left { animation: slideInLeft 0.3s ease-out; }
        .hitch-pulse { animation: hitchPulse 2s ease-in-out infinite; }
        .hitch-bubble-in { animation: hitchBubbleIn 0.4s ease-out; }
      `}</style>

      {/* Hitch speech bubble — shown when there's a comment */}
      {hitchComment && step > 0 && (
        <div className="mb-4 flex items-start gap-3 hitch-bubble-in">
          <img src={HITCH_AVATAR} alt="Hitch" className="w-9 h-9 rounded-full object-cover flex-shrink-0 border-2 border-orange-200 hitch-pulse" />
          <div className="bg-orange-50 border border-orange-200 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm text-orange-800 flex-1">
            {hitchComment}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════ STEP 0: PERSONA */}
      {step === 0 && (
        <div className={sliding ? (slideDir === 'right' ? 'slide-in-right' : 'slide-in-left') : ''}>
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

      {/* Progress brain + step dots — only show on steps 1-4 */}
      {step >= 1 && (
      <div className="mb-6">
        <div className="flex items-center justify-center gap-2 mb-3">
          <img src={HITCH_AVATAR} alt="" className="w-6 h-6 rounded-full object-cover hitch-pulse" />
          <span className="text-xs text-gray-400 font-medium">
            {step === 1 ? 'Hitch is learning your rig...' : step === 2 ? 'Building your profile...' : step === 3 ? 'Finding your matches...' : 'Almost there...'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {(userPersona === 'dreamer' ? [4] : userPersona === 'renter' ? [1, 4] : [1, 2, 3, 4]).map((s, i, arr) => (
            <div key={s} className="flex-1 flex items-center">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                s <= step ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-400'
              }`}>
                {s < step ? <Check className="w-3 h-3" /> : i + 1}
              </div>
              {i < arr.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 rounded transition-all ${s < step ? 'bg-primary-600' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>
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
                    const type = label.split('/')[0];
                    setRigSpecs((s: any) => ({ ...(s || {}), rvType: type }));
                    setRvType(type);
                    setHitchComment(hitchRigComments[type] || "Nice — let's get the details right 📋");
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

      {/* ══════════════════════════════════ STEP 4: CO-PILOT */}
      {step === 4 && (
        <div className={sliding ? (slideDir === 'right' ? 'slide-in-right' : 'slide-in-left') : ''}>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Do you travel with a co-pilot?</h2>
          <p className="text-gray-500 mb-6">Link with someone already on RVUnicorn to share your rig profile</p>

          {/* Initial choice — show if not yet searching */}
          {!coTravelerMode && !linkSent && (
            <div className="space-y-3 mb-6">
              <button onClick={() => setCoTravelerMode('search')}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-200 hover:border-primary-500 transition text-left">
                <span className="text-2xl">👫</span>
                <div><p className="font-bold text-gray-900">Yes, find them</p><p className="text-xs text-gray-500">Search by name or username</p></div>
              </button>
              <button onClick={() => { setHitchComment("Solo adventurer — respect! Let's find your tribe 🌲"); setStep(5); }}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-gray-200 hover:border-gray-300 transition text-left">
                <span className="text-2xl">🧑</span>
                <div><p className="font-bold text-gray-900">No, just me</p><p className="text-xs text-gray-500">You can always add a co-pilot later</p></div>
              </button>
              <button onClick={() => { setStep(5); }}
                className="w-full text-sm text-gray-400 hover:text-gray-600 text-center mt-2">
                Skip for now
              </button>
            </div>
          )}

          {/* Co-pilot request sent confirmation */}
          {linkSent && (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center mb-6">
              <div className="text-3xl mb-2">✅</div>
              <p className="font-bold text-green-800">Request sent!</p>
              <p className="text-sm text-green-700 mt-1">You'll get their rig data once they confirm. In the meantime, your rig is set up with what you entered.</p>
            </div>
          )}

          {/* Link Methods — keep invite/QR for legacy support */}
          {coTravelerMode && !linkSent && (
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
          )}

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

          {/* Continue to Find Your People */}
          <button
            onClick={() => { setHitchComment("Now let's find your tribe! 🏕️"); setStep(5); }}
            className="w-full py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition flex items-center justify-center gap-2"
          >
            {linkSent ? 'Continue' : coTravelerMode ? 'Continue' : 'Skip — I travel solo'} <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ══════════════════════════════════ STEP 5: FIND YOUR PEOPLE */}
      {step === 5 && (
        <div className={sliding ? (slideDir === 'right' ? 'slide-in-right' : 'slide-in-left') : ''}>
          <FindYourPeople
            authUser={authUser}
            rigMake={rigMake || (authUser as any)?.rvMake}
            onFollow={(userId: string) => { api.post('/friends/request', { userId }).catch(() => {}); }}
            onContinue={() => { setHitchComment(userPersona === 'dreamer' ? "Where are you dreaming of going? 🌟" : "One more thing — where was your favorite stay? 🏕️"); setStep(6); }}
          />
        </div>
      )}

      {/* ══════════════════════════════════ STEP 6: FAVORITE CAMPGROUND */}
      {step === 6 && (
        <div className={sliding ? (slideDir === 'right' ? 'slide-in-right' : 'slide-in-left') : ''}>
          <FavoriteCampgroundBridge
            isDreamer={userPersona === 'dreamer' || userPersona === 'renter'}
            onComplete={async () => {
              await savePersona();
              setHitchComment('');
              setStep(7);
            }}
          />
        </div>
      )}

      {/* ══════════════════════════════════ STEP 7: RIG CARD */}
      {step === 7 && (
        <div className={sliding ? 'slide-in-right' : ''}>
          <div className="text-center mb-6">
            <div className="text-3xl mb-2">🎉</div>
            <h2 className="text-2xl font-bold text-gray-900">Your rig is officially on the grid!</h2>
            <p className="text-gray-500 text-sm mt-1">
              Share with your RV community to find fellow {rigMake || authUser?.rvMake || 'RV'} owners
            </p>
          </div>
          <div className="flex justify-center mb-4">
            <RigCard
              rig={{
                firstName: authUser?.firstName,
                username: authUser?.username,
                rvYear: rigYear ? parseInt(rigYear) : authUser?.rvYear,
                rvMake: rigMake || authUser?.rvMake,
                rvModel: rigModel || authUser?.rvModel,
                rvType: rigSpecs?.rvType || rvType || authUser?.rvType,
                rvLength: rigSpecs?.lengthFt || authUser?.rvLength,
                rvSleeps: rigSpecs?.sleeps || authUser?.rvSleeps,
                rvSlideouts: rigSpecs?.slideoutCount,
                homeCity: authUser?.homeCity,
                homeState: authUser?.homeState,
                profilePicture: authUser?.profilePicture,
              }}
              onSkip={async () => { await saveProgress(7, true); if (onComplete) onComplete(); else navigate('/basecamp'); }}
            />
          </div>
          <div className="flex justify-center mt-4">
            <button
              onClick={async () => {
                try {
                  const { data } = await api.post('/events', {
                    title: `My First Trip${rigMake ? ` in the ${rigMake}` : ''}`,
                    status: 'DRAFT',
                    startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
                  });
                  navigate(`/trips/${data.id || data.event?.id}`);
                } catch { if (onComplete) onComplete(); else navigate('/basecamp'); }
              }}
              className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-semibold transition"
            >
              🗺️ Start planning my first trip →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Find Your People sub-component
// ═══════════════════════════════════════════════════════════════
function FindYourPeople({ authUser, rigMake, onFollow, onContinue }: {
  authUser: any; rigMake?: string;
  onFollow: (userId: string) => void; onContinue: () => void;
}) {
  const [nearbyUsers, setNearbyUsers] = useState<any[]>([]);
  const [sameRigUsers, setSameRigUsers] = useState<any[]>([]);
  const [sameRigTotal, setSameRigTotal] = useState(0);
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [nearby, rig] = await Promise.all([
          authUser?.homeState ? api.get(`/users/nearby?state=${authUser.homeState}&limit=5`) : null,
          rigMake ? api.get(`/users/same-rig?make=${encodeURIComponent(rigMake)}&limit=5`) : null,
        ]);
        if (nearby?.data?.users) setNearbyUsers(nearby.data.users);
        if (rig?.data) { setSameRigUsers(rig.data.users); setSameRigTotal(rig.data.total); }
      } catch {}
      setLoading(false);
    };
    load();
  }, [authUser?.homeState, rigMake]);

  const handleFollow = (userId: string) => {
    onFollow(userId);
    setFollowed(prev => new Set(prev).add(userId));
  };

  const followAll = () => {
    [...nearbyUsers, ...sameRigUsers].forEach(u => { if (!followed.has(u.id)) handleFollow(u.id); });
  };

  const UserCard = ({ user }: { user: any }) => (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-200">
      {user.profilePicture ? (
        <img src={user.profilePicture} className="w-10 h-10 rounded-full object-cover" alt="" />
      ) : (
        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-sm font-bold text-primary-700">{user.firstName?.[0] || '?'}</div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 text-sm truncate">{user.firstName} {user.lastName}</p>
        <p className="text-xs text-gray-500 truncate">
          {user.homeState && `${user.homeState} · `}{user.rvMake || user.rvType || ''}
        </p>
      </div>
      <button
        onClick={() => handleFollow(user.id)}
        disabled={followed.has(user.id)}
        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${followed.has(user.id) ? 'bg-green-100 text-green-700' : 'bg-primary-600 text-white hover:bg-primary-700'}`}
      >
        {followed.has(user.id) ? '✓ Following' : 'Follow'}
      </button>
    </div>
  );

  if (loading) return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Find Your People</h2>
      <p className="text-gray-500 mb-6">Connect with campers who share your style</p>

      {nearbyUsers.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-bold text-gray-700 mb-2">🏠 RVers near you</h3>
          <div className="space-y-2">{nearbyUsers.map(u => <UserCard key={u.id} user={u} />)}</div>
        </div>
      )}

      {sameRigUsers.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-bold text-gray-700 mb-2">🚐 {sameRigTotal} people with a {rigMake} on RVUnicorn</h3>
          <div className="space-y-2">{sameRigUsers.map(u => <UserCard key={u.id} user={u} />)}</div>
        </div>
      )}

      {nearbyUsers.length === 0 && sameRigUsers.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p className="text-3xl mb-2">🌲</p>
          <p className="text-sm">You're one of the first here — more campers are joining every day!</p>
        </div>
      )}

      <div className="space-y-2 mt-6">
        {(nearbyUsers.length + sameRigUsers.length) > 2 && (
          <button onClick={followAll} className="w-full py-2.5 bg-primary-100 text-primary-700 rounded-xl font-semibold text-sm hover:bg-primary-200 transition">
            Follow All ({nearbyUsers.length + sameRigUsers.length})
          </button>
        )}
        <button onClick={onContinue} className="w-full py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition flex items-center justify-center gap-2">
          Continue <ArrowRight className="w-4 h-4" />
        </button>
        <button onClick={onContinue} className="w-full text-sm text-gray-400 hover:text-gray-600 text-center">Skip for now</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Favorite Campground Bridge sub-component
// ═══════════════════════════════════════════════════════════════
function FavoriteCampgroundBridge({ isDreamer, onComplete }: { isDreamer: boolean; onComplete: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [regulars, setRegulars] = useState<any[]>([]);
  const [regularsTotal, setRegularsTotal] = useState(0);
  const [hitchMsg, setHitchMsg] = useState('');
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const HITCH_AVATAR = 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1774218289/rvunicorn/guides/hitch_guide.png';

  const handleSearch = (q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get(`/campgrounds?search=${encodeURIComponent(q)}&limit=5`);
        setResults(data.campgrounds || data || []);
      } catch { setResults([]); }
    }, 300);
  };

  const handleSelect = async (campground: any) => {
    setSelected(campground);
    setQuery('');
    setResults([]);

    // Mark as visited or wishlisted
    try {
      if (!isDreamer) {
        await api.post('/travel-map/visits', {
          state: campground.state,
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0],
          campsiteId: campground.id,
          notes: 'Added during onboarding',
          visibility: 'PUBLIC',
        });
      } else {
        await api.post(`/campgrounds/${campground.id}/favorite`).catch(() => {});
      }
    } catch {}

    // Fetch regulars
    try {
      const { data } = await api.get(`/campgrounds/${campground.id}/regulars`);
      setRegulars(data.regulars || []);
      setRegularsTotal(data.total || 0);
      if (data.total > 0) {
        setHitchMsg(`Great choice! ${data.total} regulars there would love to connect with you 🏕️`);
      } else {
        setHitchMsg(`${campground.name} looks amazing — you might be the first to check in from RVUnicorn!`);
      }
    } catch {}
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">
        {isDreamer ? 'Where are you dreaming of going?' : 'Where was your favorite stay?'}
      </h2>
      <p className="text-gray-500 mb-6">
        {isDreamer ? "Save it and we'll connect you with campers who've been there" : 'Pick a campground and meet fellow regulars'}
      </p>

      {!selected ? (
        <div>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search campgrounds..."
              className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500"
              autoFocus
            />
          </div>

          {results.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-lg max-h-64 overflow-y-auto">
              {results.map((cg: any) => (
                <button key={cg.id} onClick={() => handleSelect(cg)}
                  className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 border-b border-gray-50 text-left">
                  {cg.imageUrl ? (
                    <img src={cg.imageUrl} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" alt="" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0 text-lg">🏕️</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{cg.name}</p>
                    <p className="text-xs text-gray-500">{cg.city ? `${cg.city}, ` : ''}{cg.state}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          {/* Selected campground card */}
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-4">
            <div className="flex items-center gap-3 mb-3">
              {selected.imageUrl ? (
                <img src={selected.imageUrl} className="w-14 h-14 rounded-xl object-cover" alt="" />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-green-200 flex items-center justify-center text-2xl">🏕️</div>
              )}
              <div>
                <p className="font-bold text-gray-900">{selected.name}</p>
                <p className="text-sm text-gray-500">{selected.city ? `${selected.city}, ` : ''}{selected.state}</p>
              </div>
            </div>
            <p className="text-xs text-green-700">{isDreamer ? '💚 Added to your wishlist' : '✅ Added to your travel map'}</p>
          </div>

          {/* Regulars */}
          {regulars.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">{regularsTotal} other campers love {selected.name}</p>
              <div className="flex -space-x-2 mb-2">
                {regulars.slice(0, 5).map((u: any) => (
                  u.profilePicture ? (
                    <img key={u.id} src={u.profilePicture} className="w-8 h-8 rounded-full border-2 border-white object-cover" alt="" />
                  ) : (
                    <div key={u.id} className="w-8 h-8 rounded-full border-2 border-white bg-primary-200 flex items-center justify-center text-xs font-bold text-primary-700">{u.firstName?.[0]}</div>
                  )
                ))}
              </div>
            </div>
          )}

          {/* Hitch comment */}
          {hitchMsg && (
            <div className="flex items-start gap-3 mb-4 hitch-bubble-in">
              <img src={HITCH_AVATAR} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
              <div className="bg-orange-50 border border-orange-200 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm text-orange-800">{hitchMsg}</div>
            </div>
          )}

          <button onClick={() => setSelected(null)} className="text-xs text-gray-400 hover:text-gray-600 mb-3 block">Choose a different campground</button>
        </div>
      )}

      <div className="mt-6 space-y-2">
        <button onClick={onComplete} className="w-full py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition flex items-center justify-center gap-2">
          {selected ? "Let's go! 🚐" : 'Continue'} <ArrowRight className="w-4 h-4" />
        </button>
        <button onClick={onComplete} className="w-full text-sm text-gray-400 hover:text-gray-600 text-center">Skip</button>
      </div>
    </div>
  );
}

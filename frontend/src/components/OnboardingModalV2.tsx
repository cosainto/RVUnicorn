import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import api from '../services/api';

const HITCH_IMG = 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261116/rvunicorn/characters/hitch.png';

const CAMPER_TYPES = [
  { emoji: '\u{1F5D3}', label: 'Weekend Warrior', value: 'weekend_warrior' },
  { emoji: '\u{1F3E0}', label: 'Full-Timer', value: 'full_timer' },
  { emoji: '\u{1F5FA}', label: 'Planning First Big Trip', value: 'first_big_trip' },
  { emoji: '\u2728', label: 'First Trip Ever', value: 'first_trip_ever' },
];

const REGIONS = [
  { emoji: '\u{1F332}', label: 'Pacific West', value: 'west' },
  { emoji: '\u{1F3D4}', label: 'Mountain', value: 'mountain' },
  { emoji: '\u{1F33E}', label: 'Midwest', value: 'midwest' },
  { emoji: '\u{1F30A}', label: 'Southeast', value: 'south' },
  { emoji: '\u{1F342}', label: 'Northeast', value: 'northeast' },
];

const RIG_TYPES = [
  { emoji: '\u{1F3E0}', label: 'Class A', value: 'CLASS_A' },
  { emoji: '\u{1F690}', label: 'Class B', value: 'CLASS_B' },
  { emoji: '\u{1F68C}', label: 'Class C', value: 'CLASS_C' },
  { emoji: '\u{1F3D5}', label: 'Travel Trailer', value: 'TRAVEL_TRAILER' },
  { emoji: '\u{1F690}', label: 'Van / Other', value: 'VAN' },
];

const HITCH_RESPONSES: Record<string, string> = {
  west: "Chatfield State Park is 20 min south — full hookups, Rockies views, sites available tonight. Want me to add it to your trip? \u{1F3D4}",
  mountain: "Chatfield State Park is 20 min south — full hookups, Rockies views, sites available tonight. Want me to add it to your trip? \u{1F3D4}",
  midwest: "Starved Rock is calling — stunning canyon trails, full hookups, and one of Illinois' best kept secrets. Want me to map it out? \u{1F332}",
  south: "Percy Priest Lake has sites open tonight — waterfront spots, easy Nashville access, perfect for a stopover. Add it? \u{1F30A}",
  northeast: "Acadia's Blackwoods campground has a spot — coastal Maine, incredible stargazing, worth every mile. Want details? \u{1F31F}",
};

const LOCATION_REF: Record<string, string> = { west: 'near Denver', mountain: 'near Denver', midwest: 'near Chicago', south: 'near Nashville', northeast: 'near Boston' };

interface Props { onComplete: () => void; displayName: string; }

export default function OnboardingModalV2({ onComplete, displayName }: Props) {
  const [slide, setSlide] = useState(0);
  const [state, setState] = useState({ camperType: null as string | null, region: null as string | null, rigType: null as string | null, startedAt: Date.now() });
  const [photos, setPhotos] = useState<Record<string, string[]>>({ all: [], west: [], south: [], midwest: [], northeast: [] });
  const [hitchStep, setHitchStep] = useState(0);
  const [exiting, setExiting] = useState(false);
  const navigate = useNavigate();
  const touchStart = useRef(0);
  const totalSlides = 8;

  useEffect(() => { api.get('/onboarding/photos').then(r => setPhotos(r.data)).catch(() => {}); }, []);

  // Slide 6 Hitch animation
  useEffect(() => {
    if (slide !== 5) { setHitchStep(0); return; }
    const t1 = setTimeout(() => setHitchStep(1), 500);
    const t2 = setTimeout(() => setHitchStep(2), 1500);
    const t3 = setTimeout(() => setHitchStep(3), 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [slide]);

  const saveProgress = useCallback(async (data: any) => {
    setState(s => ({ ...s, ...data }));
    api.patch('/onboarding/progress', data).catch(() => {});
  }, []);

  const handleSkip = async () => {
    await api.patch('/onboarding/skip', { slideNumber: slide + 1 }).catch(() => {});
    dismiss();
  };

  const handleComplete = async () => {
    await api.patch('/onboarding/complete', { totalTimeSeconds: Math.round((Date.now() - state.startedAt) / 1000) }).catch(() => {});
    dismiss();
  };

  const dismiss = () => { setExiting(true); setTimeout(() => onComplete(), 250); };

  const canAdvance = () => {
    if (slide === 1) return !!state.camperType;
    if (slide === 2) return !!state.region;
    if (slide === 6) return !!state.rigType;
    return true;
  };

  const next = () => { if (slide < totalSlides - 1) setSlide(s => s + 1); };
  const back = () => { if (slide > 0) setSlide(s => s - 1); };

  // Swipe
  const onTouchStart = (e: React.TouchEvent) => { touchStart.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStart.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) { if (diff > 0 && canAdvance()) next(); else if (diff < 0) back(); }
  };

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && canAdvance()) next();
      if (e.key === 'ArrowLeft') back();
      if (e.key === 'Escape') handleSkip();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [slide, state]);

  const heroImg = (idx: number) => photos.all[idx] || '';
  const regionImg = () => {
    const r = state.region || '';
    return photos[r === 'mountain' ? 'west' : r]?.[0] || photos.all[3] || '';
  };

  // Headlines for Slide 8
  const headlines: Record<string, string> = {
    weekend_warrior: 'Your next escape is closer than you think.',
    full_timer: 'Your next long-term basecamp is waiting.',
    first_big_trip: 'Every great journey starts here.',
    first_trip_ever: 'Everyone starts somewhere. This is yours.',
  };
  const rigBodies: Record<string, string> = {
    CLASS_A: 'Thousands of Class A travelers are already out there. Your spot is open.',
    CLASS_B: 'The best spots are off the beaten path. Let\'s find yours.',
    CLASS_C: 'Adventure-ready and community-first. You\'re going to love it here.',
    TRAVEL_TRAILER: 'Tow it anywhere. Your community goes with you.',
    VAN: 'The best spots are off the beaten path. Let\'s find yours.',
  };

  const OptionCard = ({ emoji, label, selected, onClick }: { emoji: string; label: string; selected: boolean; onClick: () => void }) => (
    <button onClick={onClick} className="relative flex flex-col items-center justify-center gap-2 rounded-xl p-4 transition-all" style={{
      background: selected ? 'rgba(232,168,56,0.12)' : '#1B2E50',
      border: selected ? '2px solid #E8A838' : '1px solid rgba(232,168,56,0.15)',
      height: '90px', transform: selected ? 'scale(1.02)' : 'scale(1)',
    }}>
      <span className="text-2xl">{emoji}</span>
      <span className="text-[13px] font-bold" style={{ color: selected ? '#F5F0E8' : 'rgba(245,240,232,0.7)' }}>{label}</span>
      {selected && <Check className="absolute top-2 right-2 w-4 h-4" style={{ color: '#E8A838' }} />}
    </button>
  );

  const Pill = ({ emoji, label, selected, onClick }: { emoji: string; label: string; selected: boolean; onClick: () => void }) => (
    <button onClick={onClick} className="px-5 py-2.5 rounded-full text-[13px] transition-all" style={{
      background: selected ? 'rgba(232,168,56,0.15)' : '#1B2E50',
      border: selected ? '2px solid #E8A838' : '1px solid rgba(232,168,56,0.15)',
      color: selected ? '#F5F0E8' : 'rgba(245,240,232,0.6)',
      minHeight: '40px',
    }}>{emoji} {label}</button>
  );

  const slides = [
    // 0: Welcome
    { img: heroImg(0), icon: '\u{1F984}', headline: 'Welcome to RVUnicorn', body: 'The campfire community built for the road. Pull up a chair \u2014 you found your people.' },
    // 1: Camper Type
    { img: '', gradient: 'linear-gradient(135deg, #0F1C35, #1a3a2a)', icon: '\u{1F3D5}', headline: 'What kind of camper are you?', body: 'We\'ll make RVUnicorn feel like it was built just for you.' },
    // 2: Region
    { img: '', gradient: 'linear-gradient(135deg, #0F1C35, #0a2a2a)', icon: '\u{1F4CD}', headline: 'Where do you love to roam?', body: 'We\'ll show you campgrounds and communities closest to your heart.' },
    // 3: Basecamp
    { img: '', gradient: 'linear-gradient(135deg, #0F1C35, #2a1a0a)', icon: '\u{1F3D5}', headline: 'Your Basecamp', body: 'Everything you need while you\'re at camp. Check in, track the weather, chat with neighbors, and cook \u2014 all without leaving.' },
    // 4: Check In
    { img: heroImg(1), icon: '\u{1F5FA}', headline: 'Check In. Light Up the Map.', body: 'Over 16,000 campgrounds across North America. Every check-in fills in your personal travel map \u2014 one state at a time.' },
    // 5: Hitch AI
    { img: '/images/family_campfire.png', icon: '\u{1F984}', headline: 'Meet Your RVUnicorn Family', body: 'These characters are here to help you on every trip.' },
    // 6: Rig Type
    { img: '', gradient: 'linear-gradient(135deg, #0F1C35, #2a2000)', icon: '\u{1F690}', headline: 'What\'s your rig?', body: 'Every adventure starts with your home on wheels. Tell us what you\'re rolling in.' },
    // 7: Let's Go
    { img: regionImg(), icon: '\u{1F305}', headline: headlines[state.camperType || ''] || 'The road is waiting.', body: rigBodies[state.rigType || ''] || 'Join thousands of RVers already exploring, connecting, and making memories.' },
  ];

  const s = slides[slide];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.92)', transition: 'opacity 250ms', opacity: exiting ? 0 : 1 }}
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="w-full sm:max-w-[700px] sm:rounded-[20px] overflow-hidden flex flex-col" style={{
        background: '#0F1C35', border: '1px solid rgba(232,168,56,0.2)', maxHeight: '88vh',
        transform: exiting ? 'scale(0.95)' : 'scale(1)', transition: 'transform 250ms',
      }}>
        {/* Progress bar */}
        <div className="h-[3px] w-full" style={{ background: '#1B2E50' }}>
          <div className="h-full transition-all duration-500" style={{ width: `${((slide + 1) / totalSlides) * 100}%`, background: '#E8A838' }} />
        </div>

        {/* Skip */}
        <button onClick={handleSkip} className="absolute top-4 right-4 z-20 text-[13px]" style={{ color: 'rgba(245,240,232,0.3)' }}>Skip</button>

        {/* Hero image */}
        <div className="relative overflow-hidden" style={{ height: '42%', minHeight: '180px', background: s.gradient || '#0F1C35' }}>
          {s.img && <img src={s.img} alt="" className="w-full h-full object-cover" style={{ animation: 'kenBurns 7s ease-in-out infinite' }} />}
          <div className="absolute inset-x-0 bottom-0 h-1/2" style={{ background: 'linear-gradient(to top, #0F1C35, transparent)' }} />
          {/* Icon badge */}
          <div className="absolute bottom-[-12px] left-4 w-12 h-12 rounded-full flex items-center justify-center text-[22px] z-10" style={{ background: 'rgba(232,168,56,0.12)', border: '1px solid rgba(232,168,56,0.25)' }}>{s.icon}</div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pt-5 pb-4">
          <h2 className="text-[26px] font-bold mb-2" style={{ fontFamily: "'Playfair Display',serif", color: '#F5F0E8' }}>{s.headline}</h2>
          <p className="text-[14px] leading-relaxed mb-5" style={{ color: 'rgba(245,240,232,0.65)' }}>{s.body}</p>

          {/* Slide 1: Camper Type Cards */}
          {slide === 1 && (
            <div className="grid grid-cols-2 gap-3">
              {CAMPER_TYPES.map(ct => <OptionCard key={ct.value} {...ct} selected={state.camperType === ct.value} onClick={() => saveProgress({ camperType: ct.value })} />)}
            </div>
          )}

          {/* Slide 2: Region Pills */}
          {slide === 2 && (
            <div className="flex flex-wrap gap-2">
              {REGIONS.map(r => <Pill key={r.value} {...r} selected={state.region === r.value} onClick={() => saveProgress({ region: r.value })} />)}
            </div>
          )}

          {/* Slide 5: Meet Your RVUnicorn Family */}
          {slide === 5 && (
            <div className="space-y-2 mt-1">
              {[
                { img: '/images/char_hitch_walter.png', name: 'Hitch', role: 'Your Trail Guide', desc: 'AI camp host who knows every road', color: '#E8A838' },
                { img: '/images/char_diesel.png', name: 'Diesel Dave', role: 'Big Rig Expert', desc: 'Makes sure your rig fits everywhere', color: '#8BC34A' },
                { img: '/images/char_luna.png', name: 'Luna', role: 'Family & Pets', desc: 'Kid-friendly spots and pet policies', color: '#F48FB1' },
                { img: '/images/char_scout.png', name: 'Scout', role: 'Adventure Guide', desc: 'Trails, hidden gems, and boondocking', color: '#FF7043' },
                { img: '/images/char_rose.png', name: 'Rosé', role: 'Glamping Guru', desc: 'Wineries, scenic views, the finer side', color: '#9C27B0' },
                { img: '/images/char_walter.png', name: 'Walter', role: 'Nature & Stars', desc: 'Stargazing and honest campground takes', color: '#5C6BC0' },
              ].map((char, i) => (
                <div key={char.name} className="flex items-center gap-3 p-2.5 rounded-xl" style={{ background: '#1B2E50', animation: `fadeIn 300ms ease ${i * 100}ms both` }}>
                  <img src={char.img} alt={char.name} className="w-11 h-11 rounded-full object-cover flex-shrink-0 border" style={{ borderColor: char.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-bold" style={{ color: char.color }}>{char.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(245,240,232,0.5)' }}>{char.role}</span>
                    </div>
                    <p className="text-[11px]" style={{ color: 'rgba(245,240,232,0.45)' }}>{char.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Slide 6: Rig Type Pills */}
          {slide === 6 && (
            <>
              <div className="flex flex-wrap gap-2">
                {RIG_TYPES.map(r => <Pill key={r.value} {...r} selected={state.rigType === r.value} onClick={() => saveProgress({ rigType: r.value })} />)}
              </div>
              <p className="text-[12px] text-center mt-3" style={{ color: 'rgba(245,240,232,0.3)' }}>You can add full rig details once you're in.</p>
            </>
          )}

          {/* Slide 7: Memory hook */}
          {slide === 7 && (
            <>
              <p className="text-[13px] italic text-center mt-2" style={{ color: 'rgba(232,168,56,0.5)' }}>This could be your next stop.</p>
              <button onClick={handleComplete} className="w-full mt-5 py-4 rounded-xl text-[16px] font-bold transition hover:brightness-110" style={{ background: '#D4621A', color: '#F5F0E8' }}>
                Start Exploring
              </button>
            </>
          )}

          {/* Skip link for interactive slides */}
          {[1, 2, 6].includes(slide) && !canAdvance() && (
            <button onClick={next} className="text-[12px] mt-3 block mx-auto" style={{ color: 'rgba(245,240,232,0.3)' }}>Skip this →</button>
          )}
        </div>

        {/* Navigation */}
        {slide < 7 && (
          <div className="px-6 pb-5 flex items-center justify-between">
            {slide > 0 ? (
              <button onClick={back} className="px-5 py-2.5 rounded-xl text-[14px] font-medium" style={{ border: '1px solid #E8A838', color: '#E8A838', minHeight: '44px' }}>
                <ChevronLeft className="w-4 h-4 inline mr-1" />Back
              </button>
            ) : <div />}

            {/* Dots */}
            <div className="flex gap-1.5">
              {Array.from({ length: totalSlides }, (_, i) => (
                <div key={i} className="rounded-full transition-all" style={{ width: i === slide ? 10 : 8, height: i === slide ? 10 : 8, background: i === slide ? '#E8A838' : '#1B2E50' }} />
              ))}
            </div>

            <button onClick={next} disabled={!canAdvance()} className="px-5 py-2.5 rounded-xl text-[14px] font-bold disabled:opacity-30 transition" style={{ background: '#E8A838', color: '#0F1C35', minHeight: '44px' }}>
              Next<ChevronRight className="w-4 h-4 inline ml-1" />
            </button>
          </div>
        )}

        {/* Dots only on last slide */}
        {slide === 7 && (
          <div className="flex justify-center gap-1.5 pb-4">
            {Array.from({ length: totalSlides }, (_, i) => (
              <div key={i} className="rounded-full" style={{ width: i === slide ? 10 : 8, height: i === slide ? 10 : 8, background: i === slide ? '#E8A838' : '#1B2E50' }} />
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}} @keyframes kenBurns{0%{transform:scale(1)}100%{transform:scale(1.06)}}`}</style>
    </div>
  );
}

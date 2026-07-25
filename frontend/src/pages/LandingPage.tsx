import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import api from '../services/api';

/* ══════════════════════════════════════════════════════════════════
   CAMPFIRE NIGHT PALETTE — exact existing tokens
   ══════════════════════════════════════════════════════════════════ */
const C = {
  navyDeep: '#0F1C35',
  navy: '#1B2B4B',
  navyLight: '#243352',
  border: '#2A3F5F',
  gold: '#C9A84C',
  orange: '#E8622A',
  cream: '#F5F0E8',
  muted: '#8B9BB4',
  green: '#1D9E75',
};

/* ══════════════════════════════════════════════════════════════════
   CARTOON STYLE TOKENS
   ══════════════════════════════════════════════════════════════════ */

// Thick outlined card — sticker style
const stickerCard = (rotation = 0): React.CSSProperties => ({
  background: C.navy,
  border: `3px solid ${C.cream}`,
  borderRadius: 20,
  boxShadow: `5px 5px 0px ${C.navyDeep}`,
  transform: `rotate(${rotation}deg)`,
  transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease',
});

const stickerHover: React.CSSProperties = {
  transform: 'rotate(0deg) scale(1.03)',
  boxShadow: `6px 6px 0px ${C.navyDeep}`,
};

// Hand-drawn button style
const cartoonButton = (primary = true): React.CSSProperties => ({
  background: primary ? C.gold : 'transparent',
  color: primary ? C.navyDeep : C.cream,
  border: `3px solid ${primary ? C.gold : C.cream}`,
  borderRadius: 16,
  boxShadow: primary ? `4px 4px 0px rgba(0,0,0,0.3)` : 'none',
  fontWeight: 800,
  fontSize: 18,
  padding: '14px 32px',
  cursor: 'pointer',
  transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease',
});

/* ── SVG Accents (hand-drawn style) ────────────────────────────── */

function SquiggleUnderline({ color = C.gold, width = 120 }: { color?: string; width?: number }) {
  return (
    <svg width={width} height="8" viewBox={`0 0 ${width} 8`} fill="none" className="mx-auto mt-1">
      <path d={`M0 4 Q${width * 0.15} 0, ${width * 0.25} 4 T${width * 0.5} 4 T${width * 0.75} 4 T${width} 4`}
        stroke={color} strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function WaveDivider({ flip = false, color = C.navyDeep }: { flip?: boolean; color?: string }) {
  return (
    <div style={{ marginTop: -1, transform: flip ? 'scaleY(-1)' : 'none' }}>
      <svg viewBox="0 0 1440 60" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: 40 }}>
        <path d="M0,30 C240,50 480,10 720,30 C960,50 1200,10 1440,30 L1440,60 L0,60 Z" fill={color} />
      </svg>
    </div>
  );
}

function SparkStar({ className = '' }: { className?: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" className={className} fill={C.gold}>
      <path d="M10 0l2.5 7.5L20 10l-7.5 2.5L10 20l-2.5-7.5L0 10l7.5-2.5z" />
    </svg>
  );
}

/* ── IntersectionObserver for scroll-in ────────────────────────── */
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

/* ── Navbar ────────────────────────────────────────────────────── */
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? 'rgba(15,26,46,0.95)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: scrolled ? `1px solid rgba(201,168,76,0.1)` : 'none',
      }}>
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-3">
          <img src="/images/logo-icon-v2.png" alt="RVUnicorn" className="w-9 h-9 rounded-full" />
          <span style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 22, fontWeight: 700, color: 'white' }}>RVUnicorn</span>
        </Link>
        <div className="hidden md:flex items-center gap-4">
          <Link to="/login" className="px-5 py-2 text-sm font-medium rounded-full transition-all hover:bg-white/5"
            style={{ color: C.cream, border: `2px solid rgba(255,255,255,0.2)`, borderRadius: 12 }}>
            Sign In
          </Link>
          <Link to="/register" className="px-6 py-2.5 text-sm font-semibold rounded-full transition-all hover:brightness-110"
            style={{ ...cartoonButton(true), fontSize: 14, padding: '10px 24px' }}>
            Join Free
          </Link>
        </div>
        <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden text-white p-2">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            {menuOpen ? <path d="M6 6l12 12M6 18L18 6" /> : <><path d="M3 7h18" /><path d="M3 12h18" /><path d="M3 17h18" /></>}
          </svg>
        </button>
      </div>
      {menuOpen && (
        <div className="md:hidden px-6 pb-6 flex flex-col gap-3" style={{ background: C.navyDeep }}>
          <Link to="/login" className="py-3 text-center rounded-xl" style={{ color: C.cream, border: `2px solid ${C.border}` }}>Sign In</Link>
          <Link to="/register" className="py-3 text-center rounded-xl font-bold" style={{ background: C.gold, color: C.navyDeep }}>Join Free</Link>
        </div>
      )}
    </nav>
  );
}

/* ══════════════════════════════════════════════════════════════════
   WIDTH HOOK — JS-based breakpoint, no Tailwind md: dependency
   ══════════════════════════════════════════════════════════════════ */
function useIsNarrow(breakpoint = 768) {
  const [narrow, setNarrow] = useState(
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  );
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < breakpoint);
    onResize();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [breakpoint]);
  return narrow;
}

/* ══════════════════════════════════════════════════════════════════
   SECTION 1 — HERO
   ══════════════════════════════════════════════════════════════════ */
function HeroSection() {
  const narrow = useIsNarrow();

  useEffect(() => {
    if (!narrow) return;
    document.documentElement.style.overflowX = 'hidden';
    document.body.style.overflowX = 'hidden';
    return () => {
      document.documentElement.style.overflowX = '';
      document.body.style.overflowX = '';
    };
  }, [narrow]);

  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden" style={{
      background: `linear-gradient(135deg, ${C.navyDeep} 0%, ${C.navy} 50%, ${C.navyLight} 100%)`,
      ...(narrow ? { flexDirection: 'column' as const, alignItems: 'stretch' } : {}),
    }}>
      {/* Decorative sparks */}
      <SparkStar className="absolute top-24 left-[10%] opacity-30 animate-pulse" />
      <SparkStar className="absolute top-40 right-[15%] opacity-20 animate-pulse" />
      <SparkStar className="absolute bottom-32 left-[25%] opacity-25 animate-pulse" />

      {narrow ? (
        <>
          <style>{`
            [data-mobile-hero] { width: 100% !important; max-width: 100% !important;
              display: flex !important; flex-direction: column !important;
              align-items: center !important; text-align: center !important; }
            [data-mobile-hero] > * { max-width: 100% !important;
              margin-left: auto !important; margin-right: auto !important; }
          `}</style>
          <div data-mobile-hero data-hero-grid style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            width: '100%', maxWidth: '100%', boxSizing: 'border-box',
            padding: '3rem 1.25rem', textAlign: 'center',
          }}>
            <h1 style={{
              fontFamily: "'Fredoka', sans-serif", fontSize: 'clamp(2.2rem, 8vw, 3rem)',
              fontWeight: 700, color: 'white', lineHeight: 1.1,
              width: '100%', margin: '0 auto',
            }}>
              Your Camping Life, <span style={{ color: C.gold }}>All in One Place.</span>
            </h1>
            <SquiggleUnderline width={200} />

            <p style={{
              color: C.muted, maxWidth: '32rem', margin: '1.5rem auto 0',
              fontSize: 16, lineHeight: 1.6,
            }}>
              Plan your next trip, track where you've been, remember every campfire moment, and connect with a community that gets the RV life.
            </p>

            <Link to="/register" style={{
              ...cartoonButton(true),
              display: 'block', width: '100%', maxWidth: '20rem',
              margin: '2rem auto 0', textAlign: 'center', fontSize: 16,
            }}>
              Join RVUnicorn — It's Free
            </Link>

            <a href="#features" style={{
              color: C.gold, display: 'block', margin: '1rem auto 0',
              fontSize: 14, fontWeight: 500, textDecoration: 'underline',
              textUnderlineOffset: 4,
            }}
              onClick={e => { e.preventDefault(); document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' }); }}>
              Explore Features
            </a>

            {/* Mascot */}
            <div className="overflow-hidden rounded-2xl ring-1 ring-[#C9A84C]/20 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6),0_0_80px_-20px_rgba(232,98,42,0.25)]"
              style={{ margin: '2rem auto 0', maxWidth: '60vw' }}>
              <img src="/hitch.png" alt="Hitch the RV Unicorn roasting marshmallows by a campfire"
                className="block w-full aspect-[4/3] object-cover object-[center_60%]" />
            </div>
          </div>
        </>
      ) : (
        <div data-hero-grid className="max-w-[1280px] mx-auto px-6 py-32 md:py-20 grid md:grid-cols-2 gap-12 items-center min-h-[80vh] w-full">
          {/* Left — copy */}
          <div className="text-center md:text-left">
            <h1 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 'clamp(2.8rem, 6.5vw, 4.5rem)', fontWeight: 700, color: 'white', lineHeight: 1.1 }}>
              Your Camping Life,<br />
              <span style={{ color: C.gold }}>All in One Place.</span>
            </h1>
            <SquiggleUnderline width={200} />

            <p className="mt-6 text-lg md:text-xl leading-relaxed mx-auto md:mx-0" style={{ color: C.muted, maxWidth: 500 }}>
              Plan your next trip, track where you've been, remember every campfire moment, and connect with a community that gets the RV life.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row gap-4 items-center justify-center md:justify-start">
              <Link to="/register" style={cartoonButton(true)}
                className="hover:scale-105 active:scale-95 inline-block"
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05) rotate(-1deg)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}>
                Join RVUnicorn — It's Free
              </Link>
              <a href="#features" className="text-sm font-medium underline underline-offset-4" style={{ color: C.gold }}
                onClick={e => { e.preventDefault(); document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' }); }}>
                Explore Features ↓
              </a>
            </div>
          </div>

          {/* Right — hero art */}
          <div className="flex justify-center">
            <div className="overflow-hidden rounded-2xl ring-1 ring-[#C9A84C]/20 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6),0_0_80px_-20px_rgba(232,98,42,0.25)]"
              style={{ width: '100%', maxWidth: 480 }}>
              <img src="/hitch.png" alt="Hitch the RV Unicorn roasting marshmallows by a campfire"
                className="block w-full aspect-[4/3] object-cover object-[center_60%]" />
            </div>
          </div>
        </div>
      )}

      <WaveDivider color={C.navy} />
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════
   SECTION 2 — FEATURE CARDS (5 sticker cards)
   ══════════════════════════════════════════════════════════════════ */
const FEATURES = [
  {
    icon: '🗺️', title: 'Travel Map',
    hook: 'See everywhere you\'ve been — and where you\'re going.',
    copy: 'Your camping history painted across a live map. Track states visited, nights camped, and miles driven with your rig.',
    rotation: -1.5,
  },
  {
    icon: '📋', title: 'Trip Planner',
    hook: 'Plan smarter with campground intel.',
    copy: 'Build multi-stop trips with drive times, campground details, and packing checklists. Hitch AI suggests stops you\'ll love.',
    rotation: 1,
  },
  {
    icon: '🚐', title: 'Rig Profiles',
    hook: 'Your rig\'s story, told in photos and adventures.',
    copy: 'A living journal for your RV — mods, maintenance logs, trip recaps, and a follower feed. Track your rig\'s health milestones.',
    rotation: -0.5,
  },
  {
    icon: '🏕️', title: 'Campgrounds & Places',
    hook: '16,000+ campgrounds with real RVer reviews.',
    copy: 'Find the best sites with community ratings, nearby restaurants, trails, and attractions. Discover places other campers love.',
    rotation: 1.5,
  },
  {
    icon: '🤖', title: 'Hitch AI',
    hook: 'Your campfire copilot.',
    copy: 'Ask Hitch anything — campground recommendations, trip ideas, RV tips, or just a good campfire story. Always riding shotgun.',
    rotation: -1,
  },
];

function FeatureCards() {
  const { ref, inView } = useInView(0.1);
  return (
    <section id="features" className="py-20 px-6" style={{ background: C.navy }} ref={ref}>
      <div className="max-w-6xl mx-auto">
        <h2 className="text-center mb-2" style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', fontWeight: 700, color: 'white' }}>
          Everything for the Open Road
        </h2>
        <SquiggleUnderline width={160} />

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8 mt-14">
          {FEATURES.map((f, i) => (
            <div key={f.title}
              className="p-6 cursor-default group"
              style={{
                ...stickerCard(f.rotation),
                opacity: inView ? 1 : 0,
                transform: `rotate(${f.rotation}deg) translateY(${inView ? 0 : 30}px)`,
                transition: `opacity 0.5s ease ${i * 0.1}s, transform 0.5s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.1}s, box-shadow 0.3s ease`,
              }}
              onMouseEnter={e => { Object.assign(e.currentTarget.style, stickerHover); }}
              onMouseLeave={e => { e.currentTarget.style.transform = `rotate(${f.rotation}deg)`; e.currentTarget.style.boxShadow = `5px 5px 0px ${C.navyDeep}`; }}>
              <span className="text-4xl block mb-3">{f.icon}</span>
              <h3 className="text-lg font-bold mb-1" style={{ color: C.cream, fontFamily: "'Fredoka', sans-serif" }}>{f.title}</h3>
              <p className="text-sm font-semibold mb-2" style={{ color: C.gold }}>{f.hook}</p>
              <p className="text-xs leading-relaxed" style={{ color: C.muted }}>{f.copy}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════
   SECTION 3 — FOUNDING MEMBER
   ══════════════════════════════════════════════════════════════════ */
function FoundingMember() {
  const { ref, inView } = useInView();
  const benefits = [
    { icon: '🏆', text: 'Permanent Founding Member profile badge' },
    { icon: '📜', text: 'Your name on the Founders page — forever' },
    { icon: '🗳️', text: 'Early vote on new features and roadmap priorities' },
    { icon: '🗺️', text: 'Your travel history tracked from day one' },
  ];

  return (
    <section className="py-20 px-6" style={{ background: C.navyDeep }} ref={ref}>
      <div className="max-w-3xl mx-auto text-center">
        <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', fontWeight: 700, color: 'white' }}>
          Help Build the Future of RV Camping
        </h2>
        <SquiggleUnderline width={200} />
        <p className="mt-4 text-base" style={{ color: C.muted }}>
          We're in early access, and every founding member shapes what RVUnicorn becomes. Join now and leave your mark.
        </p>

        <div className="grid sm:grid-cols-2 gap-4 mt-10 text-left">
          {benefits.map((b, i) => (
            <div key={i} className="flex items-start gap-3 p-4 rounded-xl"
              style={{
                background: C.navy, border: `2px solid ${C.border}`,
                opacity: inView ? 1 : 0, transform: `translateY(${inView ? 0 : 20}px)`,
                transition: `all 0.4s ease ${i * 0.1}s`,
              }}>
              <span className="text-2xl flex-shrink-0">{b.icon}</span>
              <p className="text-sm font-medium" style={{ color: C.cream }}>{b.text}</p>
            </div>
          ))}
        </div>

        <Link to="/register" className="inline-block mt-10 hover:scale-105 active:scale-95 transition-transform"
          style={cartoonButton(true)}>
          Become a Founding Member
        </Link>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════
   SECTION 4 — SOCIAL PROOF STRIP (live DB counters)
   ══════════════════════════════════════════════════════════════════ */
function SocialProofStrip() {
  const [stats, setStats] = useState({ campgrounds: 0, places: 0, states: 0 });
  const { ref, inView } = useInView();

  useEffect(() => {
    api.get('/campgrounds/count').then(r => {
      setStats(prev => ({ ...prev, campgrounds: r.data?.count || 16000 }));
    }).catch(() => setStats(prev => ({ ...prev, campgrounds: 16000 })));

    // Place count — use a simple count endpoint or fallback
    api.get('/places/nearby?lat=39&lng=-98&radius=10000').then(res => {
      const places = Array.isArray(res.data) ? res.data.filter((p: any) => p.type === 'place').length : 0;
      setStats(prev => ({ ...prev, places: Math.max(places, 1700) }));
    }).catch(() => setStats(prev => ({ ...prev, places: 1700 })));
  }, []);

  const counters = [
    { value: stats.campgrounds.toLocaleString() + '+', label: 'Campgrounds', icon: '🏕️' },
    { value: stats.places.toLocaleString() + '+', label: 'Places to Discover', icon: '📍' },
    { value: '50', label: 'States Covered', icon: '🗺️' },
  ];

  return (
    <section className="py-14 px-6" style={{ background: C.navy, borderTop: `2px solid ${C.border}`, borderBottom: `2px solid ${C.border}` }} ref={ref}>
      <div className="max-w-4xl mx-auto flex flex-wrap justify-center gap-12">
        {counters.map((c, i) => (
          <div key={i} className="text-center"
            style={{ opacity: inView ? 1 : 0, transform: `translateY(${inView ? 0 : 15}px)`, transition: `all 0.4s ease ${i * 0.15}s` }}>
            <span className="text-3xl block mb-1">{c.icon}</span>
            <p className="text-3xl font-bold" style={{ fontFamily: "'Fredoka', sans-serif", color: C.gold }}>{c.value}</p>
            <p className="text-xs font-medium mt-1" style={{ color: C.muted }}>{c.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════
   SECTION 5 — FINAL CTA + SEO FOOTER
   ══════════════════════════════════════════════════════════════════ */
const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware',
  'Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky',
  'Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi',
  'Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico',
  'New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania',
  'Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont',
  'Virginia','Washington','West Virginia','Wisconsin','Wyoming',
];

function stateToSlug(state: string) {
  return state.toLowerCase().replace(/\s+/g, '-');
}

function FinalCTA() {
  return (
    <section className="py-20 px-6" style={{ background: C.navyDeep }}>
      <div className="max-w-4xl mx-auto text-center">
        <h2 style={{ fontFamily: "'Fredoka', sans-serif", fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', fontWeight: 700, color: 'white' }}>
          Every Adventure Starts Somewhere.
        </h2>
        <SquiggleUnderline width={180} />
        <p className="mt-4 text-base" style={{ color: C.muted }}>
          Start tracking yours today — free forever for founding members.
        </p>
        <Link to="/register" className="inline-block mt-8 hover:scale-105 active:scale-95 transition-transform"
          style={cartoonButton(true)}>
          Join RVUnicorn — It's Free
        </Link>
      </div>

      {/* SEO Directory Strip */}
      <div className="max-w-6xl mx-auto mt-20 pt-12" style={{ borderTop: `1px solid ${C.border}` }}>
        <h3 className="text-sm font-bold mb-4" style={{ color: C.cream }}>Explore campgrounds by state</h3>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {US_STATES.map(state => (
            <Link key={state} to={`/campgrounds/state/${stateToSlug(state)}`}
              className="text-xs hover:underline transition-colors" style={{ color: C.muted }}>
              {state}
            </Link>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-6xl mx-auto mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4" style={{ borderTop: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-2">
          <img src="/images/logo-icon-v2.png" alt="RVUnicorn" className="w-6 h-6 rounded-full" />
          <span className="text-xs font-medium" style={{ color: C.muted }}>© {new Date().getFullYear()} RVUnicorn</span>
        </div>
        <div className="flex gap-6 text-xs" style={{ color: C.muted }}>
          <Link to="/privacy" className="hover:underline">Privacy</Link>
          <Link to="/terms" className="hover:underline">Terms</Link>
          <a href="mailto:support@rvunicorn.com" className="hover:underline">Contact</a>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════════════════ */
export default function LandingPage() {
  return (
    <>
      <Helmet>
        <title>RVUnicorn — Your Camping Life, All in One Place</title>
        <meta name="description" content="Plan trips, track your travels, build your rig's story, and discover 16,000+ campgrounds. Free for founding members." />
        <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </Helmet>

      {/* Reduced motion: disable wobble/rotation */}
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          * { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
        }
      `}</style>

      <Navbar />
      <HeroSection />
      <FeatureCards />
      <WaveDivider flip color={C.navyDeep} />
      <FoundingMember />
      <SocialProofStrip />
      <FinalCTA />
    </>
  );
}

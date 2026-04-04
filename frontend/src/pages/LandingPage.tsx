import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

// ── Hitch image from Cloudinary ──────────────────────────────────────────────
const HITCH_IMG = 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261116/rvunicorn/characters/hitch.png';

// ── Live Activity Strip Messages ─────────────────────────────────────────────
// TODO: Wire to real /campgrounds/pulse-feed endpoint
const ACTIVITY_MESSAGES = [
  '\u{1F3D5} Mike just checked in at Zion National Park',
  '\u{1F5FA} 3 RVers are planning a trip to Moab right now',
  '\u{1F525} Campfire chat is live at Lake Havasu',
  '\u{2B50} Sarah just left a review for Arches Campground',
  '\u{1F985} Eagle sighting reported near Glacier National Park',
  '\u{1F3D5} The Robinsons checked in at Joshua Tree',
  '\u{1F5FA} 7 RVers heading to Yellowstone this weekend',
  '\u{1F525} Trivia night happening at Moab Under Canvas',
];

// ── IntersectionObserver hook for scroll animations ──────────────────────────
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

// ── Navbar ───────────────────────────────────────────────────────────────────
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? 'rgba(15,26,46,0.95)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(201,168,76,0.1)' : 'none',
      }}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-3">
          <img src="/images/Logo_RVUnicorn.webp" alt="RVUnicorn" className="w-9 h-9 rounded-full" />
          <span className="font-playfair text-xl font-bold text-white">RVUnicorn</span>
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-4">
          <Link to="/login" className="px-5 py-2 text-sm font-dm font-medium rounded-full border transition-all hover:bg-white/5"
            style={{ color: 'var(--cream)', borderColor: 'rgba(255,255,255,0.2)' }}>
            Sign In
          </Link>
          <Link to="/register" className="px-6 py-2.5 text-sm font-dm font-semibold rounded-full transition-all hover:brightness-110"
            style={{ background: 'var(--gold)', color: 'var(--navy-deep)' }}>
            Join Free
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden text-white p-2">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {menuOpen
              ? <path d="M6 6l12 12M6 18L18 6" />
              : <><path d="M3 6h18" /><path d="M3 12h18" /><path d="M3 18h18" /></>
            }
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden px-6 pb-6 flex flex-col gap-3" style={{ background: 'var(--navy-deep)' }}>
          <Link to="/login" className="text-center py-3 rounded-xl border text-white/80" style={{ borderColor: 'rgba(255,255,255,0.15)' }}>Sign In</Link>
          <Link to="/register" className="text-center py-3 rounded-xl font-semibold" style={{ background: 'var(--gold)', color: 'var(--navy-deep)' }}>Join Free</Link>
        </div>
      )}
    </nav>
  );
}

// ── Activity Marquee ─────────────────────────────────────────────────────────
function ActivityStrip() {
  const doubled = [...ACTIVITY_MESSAGES, ...ACTIVITY_MESSAGES];
  return (
    <div className="relative overflow-hidden py-3" style={{ background: 'var(--navy-deep)', borderTop: '1px solid rgba(201,168,76,0.15)', borderBottom: '1px solid rgba(201,168,76,0.15)' }}>
      <div className="flex gap-12 w-max animate-marquee">
        {doubled.map((msg, i) => (
          <span key={i} className="whitespace-nowrap text-sm font-dm" style={{ color: 'var(--gold-light)' }}>
            {msg}
            <span className="mx-6" style={{ color: 'rgba(201,168,76,0.3)' }}>&middot;</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Fatigue Ring SVG ─────────────────────────────────────────────────────────
function FatigueRing({ inView }: { inView: boolean }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - 0.82);

  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx="70" cy="70" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
      <circle
        cx="70" cy="70" r={radius} fill="none" strokeWidth="8" strokeLinecap="round"
        stroke="var(--gold)"
        strokeDasharray={circumference}
        strokeDashoffset={inView ? offset : circumference}
        transform="rotate(-90 70 70)"
        style={{ transition: 'stroke-dashoffset 1.5s ease-out' }}
      />
      <text x="70" y="64" textAnchor="middle" fill="white" fontSize="28" fontWeight="700" fontFamily="DM Sans">82</text>
      <text x="70" y="84" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="11" fontFamily="DM Sans">Fatigue Score</text>
    </svg>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// LANDING PAGE
// ═════════════════════════════════════════════════════════════════════════════
export default function LandingPage() {
  const howItWorksRef = useRef<HTMLElement>(null);
  const sec3 = useInView();
  const sec4 = useInView();
  const sec5 = useInView();
  const sec6 = useInView();
  const sec7 = useInView();
  const sec8 = useInView();
  const sec9 = useInView();
  const sec10 = useInView();

  const scrollToHow = () => howItWorksRef.current?.scrollIntoView({ behavior: 'smooth' });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap');

        :root {
          --navy: #1B2B4B;
          --navy-deep: #0F1A2E;
          --gold: #C9A84C;
          --gold-light: #E8C96A;
          --campfire: #E8622A;
          --campfire-glow: rgba(232, 98, 42, 0.15);
          --ember: #F4A460;
          --cream: #FDF6E9;
          --muted: rgba(255,255,255,0.6);
        }

        .font-playfair { font-family: 'Playfair Display', serif; }
        .font-dm { font-family: 'DM Sans', sans-serif; }

        @keyframes fadeUp { from { opacity:0; transform:translateY(24px) } to { opacity:1; transform:translateY(0) } }
        @keyframes float { 0%,100% { transform:translateY(0) } 50% { transform:translateY(-8px) } }
        @keyframes marquee { from { transform:translateX(0) } to { transform:translateX(-50%) } }
        @keyframes campfireGlow { 0%,100% { opacity:0.6 } 50% { opacity:0.8 } }
        @keyframes pulseDot { 0%,100% { opacity:1 } 50% { opacity:0.3 } }
        @keyframes cardGlow { 0%,100% { box-shadow:0 0 40px rgba(232,98,42,0.15) } 50% { box-shadow:0 0 60px rgba(232,98,42,0.25) } }

        .animate-marquee { animation: marquee 35s linear infinite; }
        .animate-float { animation: float 4s ease-in-out infinite; }
        .animate-campfire-glow { animation: campfireGlow 3s ease-in-out infinite; }
        .animate-pulse-dot { animation: pulseDot 1.5s ease-in-out infinite; }
        .animate-card-glow { animation: cardGlow 3s ease-in-out infinite; }

        .fade-up { opacity:0; transform:translateY(24px); transition:opacity 0.7s ease, transform 0.7s ease; }
        .fade-up.visible { opacity:1; transform:translateY(0); }
        .fade-up-d1 { transition-delay:0.1s; }
        .fade-up-d2 { transition-delay:0.2s; }
        .fade-up-d3 { transition-delay:0.3s; }
        .fade-up-d4 { transition-delay:0.4s; }
        .fade-up-d5 { transition-delay:0.5s; }

        .glass-card {
          background: rgba(27,43,75,0.5);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(201,168,76,0.12);
          border-radius: 16px;
        }

        .outcome-card {
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .outcome-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 40px rgba(0,0,0,0.3);
        }
      `}</style>

      <div className="font-dm" style={{ background: 'var(--navy-deep)', color: 'white', minHeight: '100vh' }}>
        <Navbar />

        {/* ═══ HERO ═══ */}
        <section className="relative min-h-screen flex items-center overflow-hidden" style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(232,98,42,0.08) 0%, transparent 60%), var(--navy-deep)' }}>
          <div className="max-w-7xl mx-auto px-6 pt-28 pb-16 w-full">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              {/* Left — Content */}
              <div>
                <p className="text-xs font-dm font-semibold tracking-[0.2em] uppercase mb-6" style={{ color: 'var(--gold)', animation: 'fadeUp 0.6s ease both' }}>
                  THE SOCIAL PLATFORM FOR RV TRAVEL
                </p>
                <h1 className="font-playfair text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.1] mb-6" style={{ animation: 'fadeUp 0.6s ease 0.1s both' }}>
                  Find Your Herd.<br />
                  <span style={{ color: 'var(--cream)' }}>Travel Together.</span>
                </h1>
                <p className="text-lg mb-8 max-w-lg leading-relaxed" style={{ color: 'var(--muted)', animation: 'fadeUp 0.6s ease 0.2s both' }}>
                  Plan RV trips, meet people along the way, and turn every stop into something shared.
                </p>

                <div className="flex flex-wrap gap-4 mb-8" style={{ animation: 'fadeUp 0.6s ease 0.3s both' }}>
                  <Link to="/register" className="px-8 py-3.5 text-base font-semibold rounded-full transition-all hover:brightness-110 hover:scale-105"
                    style={{ background: 'var(--campfire)', color: 'white' }}>
                    {'\u{1F984}'} Join Free
                  </Link>
                  <button onClick={scrollToHow} className="px-8 py-3.5 text-base font-medium rounded-full border transition-all hover:bg-white/5"
                    style={{ color: 'white', borderColor: 'rgba(255,255,255,0.25)' }}>
                    See How It Works
                  </button>
                </div>

                {/* Social proof */}
                <div className="flex items-center gap-3" style={{ animation: 'fadeUp 0.6s ease 0.4s both' }}>
                  <div className="flex -space-x-2">
                    {['MR', 'SJ', 'TR', 'KL', 'WP'].map((initials, i) => (
                      <div key={i} className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2"
                        style={{
                          background: ['#E8622A', '#C9A84C', '#3B82F6', '#10B981', '#8B5CF6'][i],
                          borderColor: 'var(--navy-deep)',
                          color: 'white',
                        }}>
                        {initials}
                      </div>
                    ))}
                  </div>
                  <span className="text-sm" style={{ color: 'var(--muted)' }}>Join 11,000+ RVers already traveling together</span>
                </div>
              </div>

              {/* Right — Trip Mockup Card */}
              <div className="relative flex justify-center lg:justify-end" style={{ animation: 'fadeUp 0.8s ease 0.3s both' }}>
                <div className="relative animate-float">
                  <div className="glass-card p-6 w-full max-w-sm animate-card-glow" style={{ borderTop: '3px solid var(--gold)' }}>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-semibold tracking-wider uppercase" style={{ color: 'var(--gold)' }}>Active Trip</span>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981' }}>Live</span>
                    </div>
                    <h3 className="font-playfair text-xl font-bold mb-4">Chicago → Yellowstone</h3>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {['Starved Rock', 'Badlands', 'Devils Tower', 'Yellowstone'].map(stop => (
                        <span key={stop} className="text-xs px-3 py-1.5 rounded-full" style={{ background: 'rgba(201,168,76,0.12)', color: 'var(--gold-light)', border: '1px solid rgba(201,168,76,0.2)' }}>
                          {stop}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="flex -space-x-1.5">
                        {['#E8622A', '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B'].map((c, i) => (
                          <div key={i} className="w-6 h-6 rounded-full border-2" style={{ background: c, borderColor: 'rgba(27,43,75,0.8)' }} />
                        ))}
                      </div>
                      <span className="text-xs" style={{ color: 'var(--muted)' }}>4 RVers on this trip</span>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'rgba(15,26,46,0.6)', border: '1px solid rgba(201,168,76,0.1)' }}>
                      <img src={HITCH_IMG} alt="Hitch" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--cream)' }}>
                        Great news — no height restrictions on this route! {'\u{1F389}'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Floating stat chips */}
                <div className="absolute -bottom-6 left-0 right-0 flex justify-center gap-3">
                  {[
                    ['\u{1F3D5}', '16,000+ campgrounds'],
                    ['\u{1F5FA}', 'Smart routing'],
                    ['\u{1F525}', 'Live campfire chat'],
                  ].map(([icon, label]) => (
                    <span key={label as string} className="text-xs px-3 py-1.5 rounded-full glass-card" style={{ fontSize: '11px' }}>
                      {icon} {label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ LIVE ACTIVITY STRIP ═══ */}
        <ActivityStrip />

        {/* ═══ SECTION 3: OUTCOME CARDS ═══ */}
        <section ref={sec3.ref} className="py-24 px-6" style={{ background: 'var(--navy)' }}>
          <div className="max-w-6xl mx-auto">
            <h2 className={`font-playfair text-3xl md:text-4xl font-bold text-center mb-16 fade-up ${sec3.inView ? 'visible' : ''}`}>
              Everything you need to travel better — <span style={{ color: 'var(--gold)' }}>together</span>
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {[
                ['\u{1F91D}', 'Never Camp Alone Again', 'See who\'s nearby, join their campfire, and make friends along the road.'],
                ['\u{1F5FA}', 'Plan Trips in Minutes', 'Smart routes built for your rig — height clearances, gas costs, and campground stops included.'],
                ['\u{1F4E1}', 'Know Before You Go', 'Real insights from RVers already there — weather, road conditions, and honest reviews.'],
                ['\u{1F525}', 'Turn Stops into Experiences', 'Meals, meetups, trivia nights, and shared moments — powered by Hitch, your AI camp guide.'],
              ].map(([icon, title, desc], i) => (
                <div key={title as string} className={`glass-card outcome-card p-8 fade-up fade-up-d${i + 1} ${sec3.inView ? 'visible' : ''}`}>
                  <span className="text-3xl mb-4 block">{icon}</span>
                  <h3 className="font-playfair text-xl font-bold mb-3" style={{ color: 'var(--cream)' }}>{title}</h3>
                  <p className="leading-relaxed" style={{ color: 'var(--muted)' }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ SECTION 4: HOW IT WORKS ═══ */}
        <section ref={(el) => { (howItWorksRef as any).current = el; (sec4.ref as any).current = el; }} className="py-24 px-6" style={{ background: 'var(--navy-deep)' }}>
          <div className="max-w-5xl mx-auto">
            <h2 className={`font-playfair text-3xl md:text-4xl font-bold text-center mb-16 fade-up ${sec4.inView ? 'visible' : ''}`}>
              How RVUnicorn works
            </h2>
            <div className="grid md:grid-cols-3 gap-12 relative">
              {/* Connecting line (desktop) */}
              <div className="hidden md:block absolute top-12 left-[20%] right-[20%] h-px" style={{ background: 'linear-gradient(to right, transparent, var(--gold), transparent)' }} />

              {[
                ['1', 'Create Your Profile', 'Tell us about your rig, your travel style, and where you want to go. We handle the rest.'],
                ['2', 'Plan or Join a Trip', 'Build a route solo or with friends. Hitch suggests stops, campgrounds, and fellow travelers nearby.'],
                ['3', 'Arrive & Meet Your Campground', 'Check in and your personal Basecamp activates — live chat, events, trivia, and campers around you.'],
              ].map(([num, title, desc], i) => (
                <div key={num as string} className={`text-center fade-up fade-up-d${i + 1} ${sec4.inView ? 'visible' : ''}`}>
                  <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-playfair font-bold relative z-10"
                    style={{ background: 'var(--navy)', border: '2px solid var(--gold)', color: 'var(--gold)' }}>
                    {num}
                  </div>
                  <h3 className="font-playfair text-xl font-bold mb-3">{title}</h3>
                  <p className="leading-relaxed" style={{ color: 'var(--muted)' }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ SECTION 5: HITCH INTRODUCTION ═══ */}
        <section ref={sec5.ref} className="py-24 px-6 relative overflow-hidden" style={{ background: 'radial-gradient(ellipse 70% 50% at 30% 80%, rgba(232,98,42,0.06) 0%, transparent 60%), var(--navy)' }}>
          <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
            {/* Left — Hitch visual */}
            <div className={`flex justify-center fade-up ${sec5.inView ? 'visible' : ''}`}>
              <div className="relative">
                <div className="absolute inset-0 rounded-full animate-campfire-glow" style={{ background: 'radial-gradient(circle, rgba(232,98,42,0.2), transparent 70%)', transform: 'scale(1.5)' }} />
                <img src={HITCH_IMG} alt="Hitch — AI Camp Guide" className="relative w-64 h-64 rounded-full object-cover border-4" style={{ borderColor: 'var(--gold)' }} />
              </div>
            </div>

            {/* Right — Content */}
            <div>
              <p className={`text-xs font-semibold tracking-[0.2em] uppercase mb-4 fade-up ${sec5.inView ? 'visible' : ''}`} style={{ color: 'var(--gold)' }}>
                MEET YOUR AI CAMP GUIDE
              </p>
              <h2 className={`font-playfair text-3xl md:text-4xl font-bold mb-6 fade-up fade-up-d1 ${sec5.inView ? 'visible' : ''}`}>
                Hitch is already waiting at your campsite.
              </h2>
              <p className={`text-lg leading-relaxed mb-8 fade-up fade-up-d2 ${sec5.inView ? 'visible' : ''}`} style={{ color: 'var(--muted)' }}>
                Hitch is RVUnicorn's AI camp host — part trail guide, part trivia emcee, part safety co-pilot. He knows your rig, watches the weather, and keeps the campfire conversation going.
              </p>

              <div className={`flex flex-wrap gap-3 mb-8 fade-up fade-up-d3 ${sec5.inView ? 'visible' : ''}`}>
                {[
                  ['\u{1F329}', 'Weather warnings'],
                  ['\u{1F3AF}', 'Trivia host'],
                  ['\u{1F6E3}', 'Road safety co-pilot'],
                ].map(([icon, label]) => (
                  <span key={label as string} className="text-sm px-4 py-2 rounded-full" style={{ background: 'rgba(201,168,76,0.1)', color: 'var(--gold-light)', border: '1px solid rgba(201,168,76,0.2)' }}>
                    {icon} {label}
                  </span>
                ))}
              </div>

              {/* Sample Hitch message */}
              <div className={`flex items-start gap-3 p-4 rounded-xl fade-up fade-up-d4 ${sec5.inView ? 'visible' : ''}`}
                style={{ background: 'rgba(15,26,46,0.8)', borderLeft: '3px solid var(--gold)', border: '1px solid rgba(201,168,76,0.15)' }}>
                <img src={HITCH_IMG} alt="Hitch" className="w-8 h-8 rounded-full object-cover flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-bold mb-1 block" style={{ color: 'var(--gold)' }}>Hitch</span>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--cream)' }}>
                    Hey Will — storms rolling in at 6PM at your site. Want me to move tonight's campfire trivia to 4PM? {'\u{1F327}'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ SECTION 6: CAMPING MODE TEASER ═══ */}
        <section ref={sec6.ref} className="py-28 px-6 relative overflow-hidden" style={{ background: 'radial-gradient(ellipse 80% 50% at 50% 100%, rgba(232,98,42,0.07) 0%, transparent 50%), var(--navy-deep)' }}>
          <div className="max-w-5xl mx-auto text-center">
            <p className={`text-xs font-semibold tracking-[0.2em] uppercase mb-4 fade-up ${sec6.inView ? 'visible' : ''}`} style={{ color: 'var(--gold)' }}>
              WHEN YOU ARRIVE, EVERYTHING CHANGES
            </p>
            <h2 className={`font-playfair text-4xl md:text-5xl font-bold mb-4 fade-up fade-up-d1 ${sec6.inView ? 'visible' : ''}`}>
              RVUnicorn turns campgrounds<br />into communities.
            </h2>
            <p className={`text-lg mb-12 fade-up fade-up-d2 ${sec6.inView ? 'visible' : ''}`} style={{ color: 'var(--muted)' }}>
              The moment you check in, your Basecamp activates.
            </p>

            {/* Basecamp Mockup */}
            <div className={`glass-card max-w-lg mx-auto text-left overflow-hidden fade-up fade-up-d3 ${sec6.inView ? 'visible' : ''}`}>
              {/* Header */}
              <div className="flex items-center gap-3 px-5 py-3" style={{ background: 'rgba(232,98,42,0.1)', borderBottom: '1px solid rgba(232,98,42,0.15)' }}>
                <span className="text-lg">{'\u{1F525}'}</span>
                <span className="text-sm font-semibold">Campfire</span>
                <span className="text-xs" style={{ color: 'var(--muted)' }}>&middot; 14 campers here now</span>
                <span className="w-2 h-2 rounded-full ml-auto animate-pulse-dot" style={{ background: '#10B981' }} />
              </div>

              <div className="p-5 space-y-3">
                {/* Ambient event */}
                <div className="text-xs text-center py-1.5 rounded-full" style={{ background: 'rgba(201,168,76,0.08)', color: 'var(--gold-light)' }}>
                  {'\u{2600}'} Sunset at 7:42pm &middot; Clear skies tonight
                </div>

                {/* Hitch message */}
                <div className="flex items-start gap-2.5">
                  <img src={HITCH_IMG} alt="Hitch" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                  <div>
                    <span className="text-[10px] font-bold block" style={{ color: 'var(--gold)' }}>Hitch</span>
                    <div className="text-xs p-2.5 rounded-lg rounded-tl-none" style={{ background: 'rgba(15,26,46,0.8)', borderLeft: '2px solid var(--gold)', color: 'var(--cream)' }}>
                      Tonight's trivia theme: National Parks! Starting in 5 min {'\u{1F3AF}'}
                    </div>
                  </div>
                </div>

                {/* Camper message */}
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ background: '#3B82F6' }}>SJ</div>
                  <div>
                    <span className="text-[10px] font-medium block" style={{ color: 'var(--muted)' }}>Sarah J.</span>
                    <div className="text-xs p-2.5 rounded-lg rounded-tl-none" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--cream)' }}>
                      Anyone have a campfire going at Loop B? We've got s'mores supplies!
                    </div>
                  </div>
                </div>

                {/* Trivia banner */}
                <div className="flex items-center gap-2 p-2.5 rounded-lg" style={{ background: 'rgba(232,98,42,0.1)', border: '1px solid rgba(232,98,42,0.2)' }}>
                  <span>{'\u{1F3AF}'}</span>
                  <span className="text-xs font-semibold" style={{ color: 'var(--ember)' }}>Trivia starts in 5 min</span>
                </div>

                {/* Weather + Event row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <div className="text-xs mb-1" style={{ color: 'var(--muted)' }}>Tonight</div>
                    <div className="text-sm font-semibold">62° Clear</div>
                  </div>
                  <div className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <div className="text-xs mb-1" style={{ color: 'var(--muted)' }}>Next Event</div>
                    <div className="text-sm font-semibold">Potluck 6PM</div>
                    <div className="text-xs" style={{ color: 'var(--muted)' }}>8 going</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating labels */}
            <div className={`flex flex-wrap justify-center gap-3 mt-8 fade-up fade-up-d4 ${sec6.inView ? 'visible' : ''}`}>
              {['Live campfire chat', 'Tonight\'s events', 'Who\'s here now', 'Hitch on duty'].map(label => (
                <span key={label} className="text-xs px-4 py-2 rounded-full" style={{ background: 'rgba(201,168,76,0.08)', color: 'var(--gold-light)', border: '1px solid rgba(201,168,76,0.15)' }}>
                  {label}
                </span>
              ))}
            </div>

            <p className={`text-sm mt-8 fade-up fade-up-d5 ${sec6.inView ? 'visible' : ''}`} style={{ color: 'var(--muted)' }}>
              Available the moment you check in. Free for every camper.
            </p>
          </div>
        </section>

        {/* ═══ SECTION 7: DRIVING MODE TEASER ═══ */}
        <section ref={sec7.ref} className="py-24 px-6" style={{ background: 'var(--navy)' }}>
          <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
            {/* Left — Fatigue mockup */}
            <div className={`flex justify-center fade-up ${sec7.inView ? 'visible' : ''}`}>
              <div className="glass-card p-8 text-center">
                <FatigueRing inView={sec7.inView} />
                <div className="mt-4 space-y-2">
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>Next recommended stop</p>
                  <p className="text-lg font-semibold">47 miles</p>
                </div>
                <div className="flex items-start gap-2.5 mt-5 p-3 rounded-lg text-left" style={{ background: 'rgba(15,26,46,0.6)', borderLeft: '2px solid var(--gold)' }}>
                  <img src={HITCH_IMG} alt="Hitch" className="w-6 h-6 rounded-full object-cover flex-shrink-0 mt-0.5" />
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--cream)' }}>
                    You've been driving 3.5hrs. Cracker Barrel ahead has RV parking {'\u{1F6D1}'}
                  </p>
                </div>
              </div>
            </div>

            {/* Right — Content */}
            <div>
              <p className={`text-xs font-semibold tracking-[0.2em] uppercase mb-4 fade-up ${sec7.inView ? 'visible' : ''}`} style={{ color: 'var(--gold)' }}>
                YOUR SAFETY CO-PILOT
              </p>
              <h2 className={`font-playfair text-3xl md:text-4xl font-bold mb-6 fade-up fade-up-d1 ${sec7.inView ? 'visible' : ''}`}>
                Guardian Mode keeps you sharp on every mile.
              </h2>
              <p className={`text-lg leading-relaxed mb-8 fade-up fade-up-d2 ${sec7.inView ? 'visible' : ''}`} style={{ color: 'var(--muted)' }}>
                RVUnicorn's Driving Mode tracks fatigue, suggests rest stops built for your rig size, and keeps your co-pilot in the loop — even on remote stretches.
              </p>
              <div className={`fade-up fade-up-d3 ${sec7.inView ? 'visible' : ''}`}>
                <Link to="/register" className="inline-block px-6 py-3 text-sm font-medium rounded-full border transition-all hover:bg-white/5"
                  style={{ color: 'white', borderColor: 'rgba(255,255,255,0.25)' }}>
                  Learn More
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ SECTION 8: SOCIAL PROOF ═══ */}
        <section ref={sec8.ref} className="py-24 px-6" style={{ background: 'var(--navy-deep)' }}>
          <div className="max-w-6xl mx-auto">
            <h2 className={`font-playfair text-3xl md:text-4xl font-bold text-center mb-16 fade-up ${sec8.inView ? 'visible' : ''}`}>
              Real RVers. Real trips.
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  initials: 'MR', color: '#E8622A', name: 'Mike R.', meta: 'Checked in at Zion National Park \u00B7 2h ago',
                  text: 'Finally made it! Hitch warned us about the tunnel height restriction — saved us a nightmare \u{1F64F}',
                  likes: 24, comments: 8, tag: '\u{1F3D5} Zion NP',
                },
                {
                  initials: 'SJ', color: '#3B82F6', name: 'Sarah J.', meta: 'Planning a trip \u00B7 Just now',
                  text: 'Chicago \u2192 Badlands \u2192 Yellowstone in our 31\' Class A. Anyone done this route? Hitch has us stopping at Wall Drug \u{1F602}',
                  likes: 12, comments: 15, tag: null,
                },
                {
                  initials: 'TR', color: '#10B981', name: 'The Robinsons', meta: 'Campfire chat at Lake Havasu \u00B7 Tonight',
                  text: 'Won trivia night! Wallet tried to sabotage us with trick questions but we pulled through \u{1F3C6}\u{1F525}',
                  likes: 31, comments: 6, tag: null,
                },
              ].map((post, i) => (
                <div key={post.name} className={`glass-card p-6 fade-up fade-up-d${i + 1} ${sec8.inView ? 'visible' : ''}`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: post.color, color: 'white' }}>
                      {post.initials}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{post.name}</p>
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>{post.meta}</p>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--cream)' }}>{post.text}</p>
                  <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--muted)' }}>
                    <span>{'\u2764'} {post.likes}</span>
                    <span>{'\u{1F4AC}'} {post.comments}</span>
                    {post.tag && <span className="ml-auto">{post.tag}</span>}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-center text-xs mt-8" style={{ color: 'var(--muted)' }}>Posts are from real RVUnicorn community members</p>
          </div>
        </section>

        {/* ═══ SECTION 9: RIG-AWARE CALLOUT ═══ */}
        <section ref={sec9.ref} className="py-16 px-6" style={{ background: 'var(--navy)', borderTop: '1px solid rgba(201,168,76,0.08)', borderBottom: '1px solid rgba(201,168,76,0.08)' }}>
          <div className="max-w-5xl mx-auto text-center">
            <p className={`text-xs font-semibold tracking-[0.2em] uppercase mb-8 fade-up ${sec9.inView ? 'visible' : ''}`} style={{ color: 'var(--gold)' }}>
              BUILT FOR YOUR SPECIFIC RIG
            </p>
            <div className={`flex flex-wrap justify-center gap-4 mb-6 fade-up fade-up-d1 ${sec9.inView ? 'visible' : ''}`}>
              {[
                ['\u{1F68C}', 'Class A routes avoid low bridges'],
                ['\u{1F3D5}', 'Campsite size matched to your rig'],
                ['\u26FD', 'Gas costs calculated for your MPG'],
              ].map(([icon, text]) => (
                <div key={text as string} className="glass-card px-6 py-4 flex items-center gap-3">
                  <span className="text-2xl">{icon}</span>
                  <span className="text-sm font-medium" style={{ color: 'var(--cream)' }}>{text}</span>
                </div>
              ))}
            </div>
            <p className={`text-sm fade-up fade-up-d2 ${sec9.inView ? 'visible' : ''}`} style={{ color: 'var(--muted)' }}>
              Whether you're in a teardrop or a 45' diesel pusher — RVUnicorn knows the difference.
            </p>
          </div>
        </section>

        {/* ═══ SECTION 10: FINAL CTA ═══ */}
        <section ref={sec10.ref} className="py-28 px-6 relative" style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 100%, rgba(232,98,42,0.08) 0%, transparent 50%), var(--navy-deep)' }}>
          <div className="max-w-3xl mx-auto text-center">
            <h2 className={`font-playfair text-4xl md:text-5xl font-bold mb-6 fade-up ${sec10.inView ? 'visible' : ''}`}>
              Your next trip<br />shouldn't feel solo.
            </h2>
            <p className={`text-lg mb-10 fade-up fade-up-d1 ${sec10.inView ? 'visible' : ''}`} style={{ color: 'var(--muted)' }}>
              Join thousands of RVers already planning, connecting, and camping together.
            </p>
            <div className={`flex flex-wrap justify-center gap-4 mb-8 fade-up fade-up-d2 ${sec10.inView ? 'visible' : ''}`}>
              <Link to="/register" className="px-10 py-4 text-lg font-semibold rounded-full transition-all hover:brightness-110 hover:scale-105"
                style={{ background: 'var(--campfire)', color: 'white' }}>
                {'\u{1F984}'} Join Free
              </Link>
              <Link to="/trips/new" className="px-10 py-4 text-lg font-medium rounded-full border transition-all hover:bg-white/5"
                style={{ color: 'white', borderColor: 'rgba(255,255,255,0.25)' }}>
                Start a Trip →
              </Link>
            </div>
            <p className={`text-sm mb-6 fade-up fade-up-d3 ${sec10.inView ? 'visible' : ''}`} style={{ color: 'var(--muted)' }}>
              Free to join · No credit card needed · Works on any device
            </p>
            <div className={`flex items-center justify-center gap-2 fade-up fade-up-d4 ${sec10.inView ? 'visible' : ''}`}>
              <span style={{ color: 'var(--gold)' }}>{'\u2B50\u2B50\u2B50\u2B50\u2B50'}</span>
              <span className="text-sm" style={{ color: 'var(--muted)' }}>Loved by full-timers, weekend warriors, and first-timers alike</span>
            </div>
          </div>
        </section>

        {/* ═══ FOOTER ═══ */}
        <footer className="py-16 px-6" style={{ background: 'var(--navy-deep)', borderTop: '1px solid rgba(201,168,76,0.08)' }}>
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
              {/* Col 1 */}
              <div className="col-span-2 md:col-span-1">
                <div className="flex items-center gap-3 mb-4">
                  <img src="/images/Logo_RVUnicorn.webp" alt="RVUnicorn" className="w-9 h-9 rounded-full" />
                  <span className="font-playfair text-lg font-bold">RVUnicorn</span>
                </div>
                <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>Your Camping Community</p>
              </div>

              {/* Col 2 */}
              <div>
                <h4 className="text-sm font-semibold mb-4" style={{ color: 'var(--gold)' }}>Platform</h4>
                <div className="space-y-2.5">
                  {[
                    ['Campgrounds', '/campgrounds'],
                    ['Trip Planning', '/trips/new'],
                    ['Community', '/community'],
                    ['Basecamp', '/basecamp'],
                  ].map(([label, href]) => (
                    <Link key={label} to={href} className="block text-sm transition-colors hover:text-white" style={{ color: 'var(--muted)' }}>{label}</Link>
                  ))}
                </div>
              </div>

              {/* Col 3 */}
              <div>
                <h4 className="text-sm font-semibold mb-4" style={{ color: 'var(--gold)' }}>Company</h4>
                <div className="space-y-2.5">
                  {[
                    ['About', '/about'],
                    ['Blog', '/blog'],
                    ['Careers', '/careers'],
                    ['Press', '/press'],
                  ].map(([label, href]) => (
                    <Link key={label} to={href} className="block text-sm transition-colors hover:text-white" style={{ color: 'var(--muted)' }}>{label}</Link>
                  ))}
                </div>
              </div>

              {/* Col 4 */}
              <div>
                <h4 className="text-sm font-semibold mb-4" style={{ color: 'var(--gold)' }}>Support</h4>
                <div className="space-y-2.5">
                  {[
                    ['Help Center', '/help'],
                    ['Contact', 'mailto:hello@rvunicorn.com'],
                    ['Privacy Policy', '/privacy'],
                    ['Terms of Service', '/terms'],
                  ].map(([label, href]) => (
                    href.startsWith('mailto')
                      ? <a key={label} href={href} className="block text-sm transition-colors hover:text-white" style={{ color: 'var(--muted)' }}>{label}</a>
                      : <Link key={label} to={href} className="block text-sm transition-colors hover:text-white" style={{ color: 'var(--muted)' }}>{label}</Link>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-8 text-center text-sm" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', color: 'var(--muted)' }}>
              © {new Date().getFullYear()} RVUnicorn · Made with {'\u{1F525}'} for the RV community
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}

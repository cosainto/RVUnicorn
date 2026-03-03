
import React from 'react';
import { Link } from 'react-router-dom';
import { useMemo } from 'react';

// ─── All 30 badges ────────────────────────────────────────────────────────────
const BADGES = [
  { slug: 'founding-member',      name: 'Founding Member',      img: '/images/founding-member.png' },
  { slug: 'rvunicorn-member',     name: 'RVUnicorn Member',     img: '/images/Logo_RVUnicorn.png' },
  { slug: 'first-friend',         name: 'First Friend',         img: '/images/first-friend.png' },
  { slug: 'welcome-to-club',      name: 'Welcome to the Club',  img: '/images/Welcome_to_the_Club.png' },
  { slug: 'social-butterfly',     name: 'Social Butterfly',     img: '/images/social-butterfly.png' },
  { slug: 'camp-buddy',           name: 'Camp Buddy',           img: '/images/you_are_a_top8.png' },
  { slug: 'conversation-starter', name: 'Conversation Starter', img: '/images/conversation-starter.png' },
  { slug: 'first-night-out',      name: 'First Night Out',      img: '/images/first-night-out.png' },
  { slug: 'seasoned-camper',      name: 'Seasoned Camper',      img: '/images/SeasonedCamper.png' },
  { slug: 'weekend-warrior',      name: 'Weekend Warrior',      img: '/images/Weekendwarriorbadge.png' },
  { slug: 'true-camper',          name: 'True Camper',          img: '/images/TruecamperBadge.png' },
  { slug: 'road-warrior',         name: 'Road Warrior',         img: '/images/road-warrior.png' },
  { slug: 'first-trip',           name: 'First Adventure',      img: '/images/first-trip.png' },
  { slug: 'road-tripper',         name: 'Road Tripper',         img: '/images/road-tripper.png' },
  { slug: 'trailblazer',          name: 'Trailblazer',          img: '/images/trailblazer.png' },
  { slug: 'fifty-state',          name: '50 State Explorer',    img: '/images/fifty-state-explorer.png' },
  { slug: 'shutterbug',           name: 'Shutterbug',           img: '/images/Shutterbug.png' },
  { slug: 'storyteller',          name: 'Storyteller',          img: '/images/storyteller.png' },
  { slug: 'album-pro',            name: 'Album Pro',            img: '/images/album-pro.png' },
  { slug: 'rig-registered',       name: 'Rig Registered',       img: '/images/registeredBadge.png' },
  { slug: 'american-heritage',    name: 'American Heritage',    img: '/images/AmericanHeritage.png' },
  { slug: 'pacific-drift',        name: 'Pacific Drift',        img: '/images/pacificDrift.png' },
  { slug: 'helpful-camper',       name: 'Helpful Camper',       img: '/images/helpful-camper.png' },
  { slug: 'maintenance-pro',      name: 'Maintenance Pro',      img: '/images/maintenance_pro.png' },
  { slug: 'recipe-master',        name: 'Recipe Master',        img: '/images/RecipeMaster.png' },
  { slug: 'campground-critic',    name: 'Campground Critic',    img: '/images/Campgroundcritic.png' },
  { slug: 'first-recipe',         name: 'First Recipe',         img: '/images/first-recipe.png' },
  { slug: 'campfire-chef',        name: 'Campfire Chef',        img: '/images/campfirechef.png' },
  { slug: 'first-review',         name: 'First Review',         img: '/images/Firstime_review.png' },
  { slug: 'show-your-rig',        name: 'Show Your Rig',        img: '/images/showusyourrig.png' },
];

// ─── Badge strip ──────────────────────────────────────────────────────────────
function BadgeStrip({
  badges,
  reverse = false,
  speed = 55,
}: {
  badges: typeof BADGES;
  reverse?: boolean;
  speed?: number;
}) {
  // Double is usually enough for seamless feel; keeps DOM lighter than triple.
  const doubled = [...badges, ...badges];

  return (
    <div className="overflow-hidden py-5 badge-strip-wrap">
      <div
        className="flex gap-8 w-max badge-strip-inner"
        style={{ animation: `${reverse ? 'stripLeft' : 'stripRight'} ${speed}s linear infinite` }}
      >
        {doubled.map((b, i) => (
          <div
            key={`${b.slug}-${i}`}
            className="flex-shrink-0 flex flex-col items-center gap-3 group"
            style={{ width: '170px' }}
          >
            <div className="relative">
              <div
                className="absolute -inset-4 rounded-full blur-2xl opacity-0 group-hover:opacity-60 transition-all duration-500"
                style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.45), transparent 70%)' }}
              />
              <div
                className="absolute -inset-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  background:
                    'conic-gradient(from 0deg, rgba(245,158,11,.9), rgba(253,230,138,.85) 30%, rgba(146,64,14,.85) 60%, rgba(252,211,77,.85) 80%, rgba(245,158,11,.9))',
                  animation: 'spinRing 4s linear infinite',
                }}
              />
              <div
                className="relative w-32 h-32 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300"
                style={{
                  background: 'radial-gradient(circle at 32% 28%, #1e3564, #080f25)',
                  border: '2px solid rgba(251,191,36,0.18)',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.13)',
                }}
              >
                <div
                  className="absolute inset-0 rounded-full"
                  style={{ background: 'radial-gradient(circle at 28% 22%, rgba(255,255,255,0.16), transparent 52%)' }}
                />
                <img
                  src={b.img}
                  alt={b.name}
                  loading="lazy"
                  decoding="async"
                  className="w-24 h-24 object-contain z-10 relative group-hover:scale-105 transition-transform duration-300"
                  style={{ filter: 'drop-shadow(0 3px 10px rgba(0,0,0,0.7))' }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/images/Logo_RVUnicorn.png';
                  }}
                />
              </div>
            </div>
            <span
              className="text-sm font-bold text-center leading-tight group-hover:text-amber-200 transition-colors"
              style={{ color: 'rgba(255,255,255,0.58)' }}
            >
              {b.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Stars (memoized positions to avoid re-randomizing) ────────────────────────
function Stars() {
  const stars = useMemo(() => {
    return Array.from({ length: 120 }, () => {
      const r = Math.random();
      const size = r > 0.9 ? 2.5 : r > 0.7 ? 1.5 : 1;
      return {
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 68}%`,
        width: `${size}px`,
        height: `${size}px`,
        opacity: 0.15 + Math.random() * 0.85,
        dur: `${2 + Math.random() * 4}s`,
        delay: `${Math.random() * 7}s`,
      };
    });
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {stars.map((s, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            left: s.left,
            top: s.top,
            width: s.width,
            height: s.height,
            opacity: s.opacity,
            animation: `twinkle ${s.dur} ${s.delay} ease-in-out infinite`,
          }}
        />
      ))}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 80% 25% at 70% 10%, rgba(100,130,220,0.06), transparent)',
        }}
      />
    </div>
  );
}

// ─── Small building blocks ────────────────────────────────────────────────────
function SectionHeading({
  label,
  labelStyle,
  title,
  subtitle,
  desc,
  align = 'left',
}: {
  label: string;
  labelStyle: React.CSSProperties;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  desc?: React.ReactNode;
  align?: 'left' | 'center';
}) {
  return (
    <div className={align === 'center' ? 'text-center' : ''}>
      <span className="section-label" style={labelStyle}>
        {label}
      </span>
      <h2 className="text-4xl md:text-5xl font-extrabold mb-4 leading-tight">
        {title}
        {subtitle ? (
          <>
            <br />
            <span className="font-corm italic font-light text-4xl md:text-5xl" style={{ color: 'rgba(255,255,255,.7)' }}>
              {subtitle}
            </span>
          </>
        ) : null}
      </h2>
      {desc ? (
        <p className="text-base leading-relaxed max-w-2xl mx-auto" style={{ color: 'rgba(255,255,255,.5)' }}>
          {desc}
        </p>
      ) : null}
    </div>
  );
}

function HitchTip({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-4 flex items-start gap-3 glass-card"
      style={{ borderColor: 'rgba(245,158,11,.16)', background: 'rgba(245,158,11,.06)' }}
    >
      <div
        className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0"
        style={{ border: '1.5px solid rgba(245,158,11,.35)' }}
      >
        <img src="/images/hitchpic.png" alt="Hitch" className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      </div>
      <div>
        <div className="text-xs font-black tracking-widest uppercase" style={{ color: 'rgba(245,158,11,.75)' }}>
          Hitch Tip
        </div>
        <div className="text-sm" style={{ color: 'rgba(255,255,255,.62)' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Mock profile card ────────────────────────────────────────────────────────
function ProfileCard({ name, rig, state, trips, img, badge }: any) {
  return (
    <div
      className="flex-shrink-0 w-64 rounded-2xl overflow-hidden group"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.09)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div
        className="h-28 flex items-center justify-center relative overflow-hidden"
        style={{ background: 'radial-gradient(circle at 40% 40%, rgba(30,53,100,0.9), rgba(5,10,30,0.95))' }}
      >
        <img
          src={img}
          alt={name}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/images/Logo_RVUnicorn.png';
          }}
        />
      </div>
      <div className="p-4">
        <div className="font-bold text-white">{name}</div>
        <div className="text-xs mt-0.5 mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>
          {rig} • {state}
        </div>
        <div className="flex items-center justify-between">
          <div className="text-center">
            <div className="text-lg font-extrabold text-amber-300">{trips}</div>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Trips
            </div>
          </div>
          <img
            src={badge}
            alt="badge"
            loading="lazy"
            decoding="async"
            className="w-10 h-10 object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/images/Logo_RVUnicorn.png';
            }}
          />
          <div className="text-center">
            <div className="text-lg font-extrabold text-emerald-300">{Math.floor(Math.random() * 20) + 5}</div>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
              States
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Trip stop pill ───────────────────────────────────────────────────────────
function TripStop({ icon, label, detail, color }: any) {
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl"
      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0"
        style={{ background: `${color}22`, border: `1px solid ${color}44` }}
      >
        {icon}
      </div>
      <div>
        <div className="text-sm font-bold text-white">{label}</div>
        <div className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
          {detail}
        </div>
      </div>
    </div>
  );
}

// ─── Feed post mock ───────────────────────────────────────────────────────────
function FeedPost({ user, content, type, img }: any) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      {img ? (
        <div className="h-32 flex items-center justify-center overflow-hidden" style={{ background: 'rgba(5,10,30,0.8)' }}>
          <img
            src={img}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-28 w-auto object-contain opacity-90"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      ) : null}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-full bg-blue-900 flex items-center justify-center text-xs font-bold text-blue-300">
            {user?.[0] ?? 'R'}
          </div>
          <div>
            <span className="text-sm font-bold text-white">{user}</span>
            <span
              className="text-xs ml-2 px-2 py-0.5 rounded-full"
              style={{
                background: 'rgba(245,158,11,0.10)',
                color: 'rgba(245,158,11,0.95)',
                border: '1px solid rgba(245,158,11,0.18)',
              }}
            >
              {type}
            </span>
          </div>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.58)' }}>
          {content}
        </p>
      </div>
    </div>
  );
}

// ─── Recipe card mock ─────────────────────────────────────────────────────────
function RecipeCard({ title, author, time, emoji }: any) {
  return (
    <div
      className="flex-shrink-0 w-56 rounded-2xl p-5 group hover:-translate-y-1 transition-transform duration-300"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div className="text-4xl mb-3">{emoji}</div>
      <div className="font-bold text-white text-sm mb-1">{title}</div>
      <div className="text-xs mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>
        by {author}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
          ⏱ {time}
        </span>
        <div className="flex gap-0.5">{[1, 2, 3, 4, 5].map((s) => <span key={s} style={{ color: 'rgba(245,158,11,.95)', fontSize: '11px' }}>★</span>)}</div>
      </div>
    </div>
  );
}

// ─── “Quick value” grid ───────────────────────────────────────────────────────
function QuickValueGrid() {
  const items = [
    { icon: '🧑‍🤝‍🧑', title: 'Profiles & Friends', desc: 'Build your RV profile, show off your rig, and connect with your herd.' },
    { icon: '🗺️', title: 'Group Trip Planning', desc: 'Collaborate on routes, stops, ETAs, and overnight meetups—multi-rig friendly.' },
    { icon: '⛽', title: 'Smart Gas Pricing', desc: 'See fuel-aware stop suggestions along your exact route.' },
    { icon: '🍔', title: 'Food & Stops', desc: 'Find great eats, scenic breaks, and must-see roadside gems.' },
    { icon: '🏕️', title: 'Campground Discovery', desc: 'Rig-fit campgrounds, reviews, events, and groups tied to each location.' },
    { icon: '📡', title: 'Basecamp Feed', desc: 'Live check-ins, photos, meetups, and campground communities while you travel.' },
    { icon: '🍲', title: 'Recipe Book', desc: 'Share campfire recipes and browse favorites from the community.' },
    { icon: '🎥', title: 'Creator Tools', desc: 'Post content, grow a following, and build an RV influencer presence.' },
  ];

  return (
    <section className="py-10 px-6 md:px-12 max-w-7xl mx-auto">
      <div
        className="rounded-3xl p-6 md:p-8 glass-card"
        style={{
          background:
            'radial-gradient(ellipse 120% 70% at 20% 0%, rgba(96,165,250,.10), transparent 55%), radial-gradient(ellipse 100% 70% at 80% 0%, rgba(245,158,11,.10), transparent 55%), rgba(255,255,255,.035)',
          borderColor: 'rgba(255,255,255,.10)',
        }}
      >
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-6">
          <div>
            <div className="text-xs font-black tracking-widest uppercase mb-2" style={{ color: 'rgba(255,255,255,.45)' }}>
              What you get
            </div>
            <div className="text-2xl md:text-3xl font-extrabold">
              Everything you need to plan, travel, and stay connected.
            </div>
            <div className="text-sm mt-2 max-w-2xl" style={{ color: 'rgba(255,255,255,.50)' }}>
              Built for RV life: practical tools + community + content. Hitch helps guide the journey.
            </div>
          </div>
          <div className="flex gap-3">
            <Link to="/register" className="cta-gold text-sm px-6 py-3 rounded-full text-center">
              Join Free →
            </Link>
            <Link to="/register" className="cta-ghost text-sm px-6 py-3 rounded-full text-center">
              Start a Group Trip
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {items.map((it) => (
            <div key={it.title} className="rounded-2xl p-4" style={{ background: 'rgba(0,0,0,.18)', border: '1px solid rgba(255,255,255,.08)' }}>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)' }}>
                  {it.icon}
                </div>
                <div className="font-bold">{it.title}</div>
              </div>
              <div className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,.48)' }}>
                {it.desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Itinerary mock UI ────────────────────────────────────────────────────────
function ItineraryMock() {
  return (
    <div className="rounded-3xl overflow-hidden glass-card" style={{ borderColor: 'rgba(255,255,255,.10)' }}>
      <div className="p-5 md:p-6" style={{ background: 'rgba(0,0,0,.18)' }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-black tracking-widest uppercase" style={{ color: 'rgba(255,255,255,.45)' }}>
              Trip Builder
            </div>
            <div className="text-lg font-extrabold">Chicago → Yellowstone (Group Trip)</div>
          </div>
          <span className="text-xs px-3 py-1 rounded-full" style={{ background: 'rgba(52,211,153,.10)', border: '1px solid rgba(52,211,153,.18)', color: 'rgba(110,231,183,.95)' }}>
            3 rigs synced
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          {[
            ['Dates', 'Jun 14 – Jun 22'],
            ['Rig Filter', 'Height 12’6”, 50A, Pull-through'],
            ['Preferences', 'Scenic routes, avoid steep grades'],
            ['Crew Plan', 'Convoy meetups + shared overnights'],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)' }}>
              <div className="text-xs font-bold" style={{ color: 'rgba(255,255,255,.55)' }}>
                {k}
              </div>
              <div className="text-sm font-semibold">{v}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-5 md:p-6">
        <div className="text-xs font-black tracking-widest uppercase mb-3" style={{ color: 'rgba(255,255,255,.45)' }}>
          Today’s Suggested Stops
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            ['⛽', 'Fuel Stop', 'Best price near I-90 • 18 min detour', 'rgba(245,158,11,.18)'],
            ['🍔', 'Food', 'Top-rated roadside diner • fast pull-in', 'rgba(248,113,113,.18)'],
            ['🏕️', 'Overnight', 'RV park w/ 50A • 3 rigs side-by-side', 'rgba(52,211,153,.18)'],
            ['👥', 'Meetup', 'Join campground group • 12 rigs this weekend', 'rgba(96,165,250,.18)'],
          ].map(([icon, title, meta, tint]) => (
            <div key={title} className="rounded-2xl p-4" style={{ background: tint, border: '1px solid rgba(255,255,255,.08)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: 'rgba(0,0,0,.18)', border: '1px solid rgba(255,255,255,.08)' }}>
                  {icon}
                </div>
                <div>
                  <div className="font-bold">{title}</div>
                  <div className="text-xs" style={{ color: 'rgba(255,255,255,.55)' }}>
                    {meta}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <HitchTip>Add your rig height + power needs once. Hitch will keep suggestions RV-safe and crew-friendly.</HitchTip>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const row1 = BADGES.slice(0, 15);
  const row2 = BADGES.slice(15);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700;800;900&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,300;1,500&display=swap');

        @keyframes twinkle   { 0%,100%{opacity:.18;transform:scale(1)} 50%{opacity:1;transform:scale(1.45)} }
        @keyframes stripRight{ from{transform:translateX(0)} to{transform:translateX(-50%)} }
        @keyframes stripLeft { from{transform:translateX(-50%)} to{transform:translateX(0)} }
        @keyframes spinRing  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes fadeUp    { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
        @keyframes floatA    { 0%,100%{transform:translateY(0) rotate(-1.2deg)} 50%{transform:translateY(-14px) rotate(1.2deg)} }
        @keyframes floatB    { 0%,100%{transform:translateY(-6px) rotate(1deg)} 50%{transform:translateY(6px) rotate(-1deg)} }
        @keyframes pulseRing { 0%{transform:scale(1);opacity:.45} 100%{transform:scale(1.7);opacity:0} }
        @keyframes goldShim  { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
        @keyframes slideProf { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        @keyframes glowPulse { 0%,100%{opacity:.55} 50%{opacity:1} }

        .font-sora    { font-family: 'Sora', sans-serif; }
        .font-corm    { font-family: 'Cormorant Garamond', serif; }

        .gold-text {
          background: linear-gradient(135deg, rgba(245,158,11,.95) 0%, rgba(253,230,138,.95) 40%, rgba(217,119,6,.95) 70%, rgba(251,191,36,.95) 100%);
          background-size: 200% 200%;
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
          animation: goldShim 5s ease infinite;
        }
        .cta-gold {
          background: linear-gradient(135deg, rgba(245,158,11,.95), rgba(217,119,6,.95));
          box-shadow: 0 0 38px rgba(245,158,11,.32), 0 6px 24px rgba(0,0,0,.5);
          color: #000; font-weight: 900;
          transition: all .22s ease;
        }
        .cta-gold:hover {
          background: linear-gradient(135deg, rgba(251,191,36,.95), rgba(245,158,11,.95));
          box-shadow: 0 0 58px rgba(245,158,11,.44), 0 10px 32px rgba(0,0,0,.5);
          transform: translateY(-2px) scale(1.02);
        }
        .cta-ghost {
          background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.13);
          color: rgba(255,255,255,.74); font-weight: 700; transition: all .2s ease;
        }
        .cta-ghost:hover { background: rgba(255,255,255,.09); border-color: rgba(255,255,255,.22); color:#fff; }

        .divider { height:1px; background:linear-gradient(90deg,transparent,rgba(255,255,255,.07),transparent); margin: 0 2rem; }

        .badge-strip-wrap:hover .badge-strip-inner { animation-play-state: paused; }

        .section-label {
          display: inline-block;
          font-size: 11px; font-weight: 900; letter-spacing: .18em; text-transform: uppercase;
          padding: 4px 12px; border-radius: 999px; margin-bottom: 14px;
        }

        .glass-card {
          background: rgba(255,255,255,.04);
          border: 1px solid rgba(255,255,255,.09);
          backdrop-filter: blur(12px);
        }
      `}</style>

      <Stars />

      {/* Night sky backdrop */}
      <div
        className="fixed inset-0 z-0"
        style={{
          background: `
            radial-gradient(ellipse 130% 50% at 50% 0%,   #19255c 0%, transparent 55%),
            radial-gradient(ellipse 55%  35% at 88% 6%,   #2e1a62 0%, transparent 50%),
            radial-gradient(ellipse 45%  25% at 12% 8%,   #0d2d62 0%, transparent 45%),
            radial-gradient(ellipse 35%  20% at 50% 40%,  rgba(90,50,170,.07) 0%, transparent 60%),
            linear-gradient(to bottom, #080f2e 0%, #0b1540 18%, #091235 42%, #060a1e 72%, #030610 100%)`,
        }}
      />

      {/* Grain */}
      <div
        className="fixed inset-0 z-[1] pointer-events-none"
        style={{
          opacity: 0.022,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '128px',
        }}
      />

      <div className="relative z-10 font-sora text-white overflow-x-hidden">
        {/* ────────────────────────────────────────────── NAV */}
        <nav className="relative z-30 flex items-center justify-between px-6 md:px-12 py-5 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(255,255,255,.07)', border: '1.5px solid rgba(255,255,255,.15)' }}
            >
              <img src="/images/Logo_RVUnicorn.png" alt="RVUnicorn" className="w-9 h-9 object-contain" loading="lazy" decoding="async" />
            </div>
            <span className="font-extrabold text-lg hidden sm:block tracking-tight">RVUnicorn</span>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="hidden sm:flex items-center gap-1.5 text-xs font-black tracking-widest uppercase px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.18)', color: 'rgba(245,158,11,.95)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-300" style={{ animation: 'twinkle 1.8s ease-in-out infinite' }} />
              Beta
            </span>
            <Link to="/login" className="cta-ghost text-sm px-4 py-2 rounded-full">
              Log in
            </Link>
            <Link to="/register" className="cta-gold text-sm px-5 py-2.5 rounded-full">
              Join Free
            </Link>
          </div>
        </nav>

        {/* ────────────────────────────────────────────── HERO */}
        <section className="relative flex flex-col lg:flex-row items-center gap-0 px-6 md:px-16 pt-4 pb-14 max-w-7xl mx-auto">
          <div
            className="absolute bottom-0 left-0 right-0 h-80 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 80% 100% at 50% 100%, rgba(245,158,11,.08), transparent)' }}
          />

          {/* Left */}
          <div className="flex-1 text-center lg:text-left z-10" style={{ animation: 'fadeUp .7s .1s ease both' }}>
            <div
              className="inline-flex items-center gap-2 text-xs font-bold px-4 py-1.5 rounded-full mb-6"
              style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: 'rgba(255,255,255,.55)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ animation: 'twinkle 2s ease-in-out infinite' }} />
              Now in Beta — early members earn exclusive badges
            </div>

            <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold leading-[.92] tracking-tight mb-6">
              Find Your Herd.
              <br />
              <span className="font-corm italic font-light" style={{ fontSize: '.95em' }}>
                Plan the road
              </span>
              <br />
              <span className="gold-text">together.</span>
            </h1>

            <p className="text-lg md:text-xl leading-relaxed mb-8 max-w-xl mx-auto lg:mx-0" style={{ color: 'rgba(255,255,255,.52)' }}>
              RVUnicorn is your digital basecamp: profiles, group trip planning, smart gas + food stops, overnight meetups, campground
              communities, recipes, creator tools, and badges that celebrate every mile.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-8">
              <Link to="/register" className="cta-gold text-base px-8 py-4 rounded-full text-center">
                Create Your Profile →
              </Link>
              <Link to="/register" className="cta-ghost text-sm px-7 py-4 rounded-full text-center">
                Plan a Group Trip
              </Link>
            </div>

            <div className="flex flex-wrap justify-center lg:justify-start gap-8 md:gap-12">
              {[
                ['11,000+', 'Campgrounds'],
                ['AI', 'Trip Planning'],
                ['Groups', 'Trips + Feeds'],
                ['Free', 'Forever'],
              ].map(([n, l]) => (
                <div key={l} className="text-center lg:text-left">
                  <div className="text-3xl font-extrabold gold-text">{n}</div>
                  <div className="text-xs uppercase tracking-widest mt-1" style={{ color: 'rgba(255,255,255,.30)' }}>
                    {l}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Hitch */}
          <div className="flex-shrink-0 relative flex flex-col items-center justify-center lg:w-[480px]" style={{ animation: 'fadeUp .7s .25s ease both' }}>
            <div
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{ background: 'radial-gradient(circle at 50% 60%, rgba(245,158,11,.14), transparent 65%)', animation: 'glowPulse 3s ease-in-out infinite' }}
            />
            <div className="absolute w-72 h-72 rounded-full" style={{ background: 'rgba(245,158,11,.07)', animation: 'pulseRing 3s ease-out infinite' }} />
            <div className="absolute w-72 h-72 rounded-full" style={{ background: 'rgba(245,158,11,.05)', animation: 'pulseRing 3s ease-out .9s infinite' }} />

            <img
              src="/images/Campfire_hitch.png"
              alt="Hitch — your camp guide"
              className="relative w-72 h-72 md:w-96 md:h-96 object-contain"
              style={{
                animation: 'floatA 7s ease-in-out infinite',
                filter: 'drop-shadow(0 0 55px rgba(245,158,11,.30)) drop-shadow(0 0 18px rgba(245,158,11,.16))',
              }}
              loading="lazy"
              decoding="async"
              onError={(e) => {
                const el = e.target as HTMLImageElement;
                el.src = '/images/Logo_RVUnicorn.png';
                el.className = 'relative w-56 h-56 object-contain';
              }}
            />

            <div
              className="relative mt-4 max-w-[260px] rounded-2xl px-5 py-3 text-xs font-bold text-center"
              style={{
                background: 'rgba(245,158,11,.10)',
                border: '1px solid rgba(245,158,11,.20)',
                color: 'rgba(253,230,138,.95)',
                backdropFilter: 'blur(8px)',
                animation: 'floatB 5s ease-in-out infinite',
              }}
            >
              “Welcome! Let’s plan your next trip — together.” 🏕️
            </div>
          </div>
        </section>

        {/* QUICK VALUE */}
        <QuickValueGrid />

        <div className="divider" />

        {/* ────────────────────────────────────────────── HOW IT WORKS */}
        <section className="py-20 px-6 md:px-12 max-w-7xl mx-auto">
          <SectionHeading
            label="How it works"
            labelStyle={{ background: 'rgba(96,165,250,.10)', border: '1px solid rgba(96,165,250,.18)', color: 'rgba(147,197,253,.95)' }}
            title={
              <>
                Simple to start.
                <br />
                <span className="gold-text">Add your rig, plan, and go.</span>
              </>
            }
            desc="RVUnicorn is designed to be useful on day one — and even better when your herd joins you."
            align="center"
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-10">
            {[
              {
                step: '01',
                title: 'Create your profile',
                desc: 'Show off your rig, your style, your trips, and connect with RVers who match your vibe.',
                icon: '🧑‍🚐',
              },
              {
                step: '02',
                title: 'Plan solo or as a group',
                desc: 'Build a detailed itinerary with gas pricing, food stops, and overnight plans — then invite your crew.',
                icon: '🗺️',
              },
              {
                step: '03',
                title: 'Stay connected on the road',
                desc: 'Use feeds + campground groups for meetups, events, updates, photos, and creator content.',
                icon: '📡',
              },
            ].map((s) => (
              <div key={s.step} className="rounded-3xl p-6 glass-card">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-xs font-black tracking-widest" style={{ color: 'rgba(255,255,255,.35)' }}>
                    STEP {s.step}
                  </div>
                  <div className="text-2xl">{s.icon}</div>
                </div>
                <div className="text-xl font-extrabold mb-2">{s.title}</div>
                <div className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,.52)' }}>
                  {s.desc}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="divider" />

        {/* ────────────────────────────────────────────── TRIP PLANNING (product-y) */}
        <section className="py-24 px-6 md:px-12 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div>
              <span className="section-label" style={{ background: 'rgba(139,92,246,.10)', border: '1px solid rgba(139,92,246,.18)', color: 'rgba(196,181,253,.95)' }}>
                AI + Group Planning
              </span>

              <h2 className="text-4xl md:text-5xl font-extrabold mb-4 leading-tight">
                Plan routes, stops, and overnights
                <br />
                <span className="gold-text">with your crew in real time.</span>
              </h2>

              <p className="text-base leading-relaxed mb-6" style={{ color: 'rgba(255,255,255,.52)' }}>
                This isn’t just “get me there.” RVUnicorn helps your group plan the whole journey: smart gas pricing, places to eat, rig-safe
                campground stops, and coordinated overnight stays with other RVers.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                <TripStop icon="⛽" label="Live Gas Pricing" detail="Fuel-aware stops along your exact route" color="#fbbf24" />
                <TripStop icon="🍔" label="Food Along the Way" detail="Eats near every stop — pull-in friendly" color="#f87171" />
                <TripStop icon="🏕️" label="Overnight Together" detail="Side-by-side spots for multi-rig nights" color="#34d399" />
                <TripStop icon="👥" label="Crew Sync" detail="Invite friends, share ETAs, plan meetups" color="#a78bfa" />
                <TripStop icon="📍" label="Rig-Aware Picks" detail="Height/power/length matched suggestions" color="#60a5fa" />
                <TripStop icon="🤖" label="Hitch Co-Pilot" detail="Road-ready tips + backup plans" color="#fb923c" />
              </div>

              <div className="flex gap-3">
                <Link to="/register" className="cta-gold text-sm px-7 py-3.5 rounded-full inline-block">
                  Start Planning a Trip →
                </Link>
                <Link to="/register" className="cta-ghost text-sm px-7 py-3.5 rounded-full inline-block">
                  Invite Your Herd
                </Link>
              </div>

              <div className="mt-5">
                <HitchTip>Group trips are better when everyone shares the same plan — RVUnicorn keeps routes + stops synced.</HitchTip>
              </div>
            </div>

            <ItineraryMock />
          </div>
        </section>

        <div className="divider" />

        {/* ────────────────────────────────────────────── PROFILES */}
        <section className="py-20">
          <div className="px-6 md:px-12 max-w-7xl mx-auto mb-10">
            <span className="section-label" style={{ background: 'rgba(96,165,250,.10)', border: '1px solid rgba(96,165,250,.18)', color: 'rgba(147,197,253,.95)' }}>
              Your Community
            </span>
            <h2 className="text-4xl md:text-5xl font-extrabold mb-4">
              Profiles that feel alive.
              <br />
              <span className="font-corm italic font-light text-4xl md:text-5xl" style={{ color: 'rgba(255,255,255,.65)' }}>
                Rigs, trips, and friends.
              </span>
            </h2>
            <p className="text-base max-w-2xl" style={{ color: 'rgba(255,255,255,.48)' }}>
              Build a profile that shows your rig, your adventures, your badges, and your plans. Follow others, chat, and plan meetups in groups.
            </p>
          </div>

          <div className="relative overflow-hidden">
            <div className="pointer-events-none absolute left-0 inset-y-0 w-24 z-10" style={{ background: 'linear-gradient(to right, #030610, transparent)' }} />
            <div className="pointer-events-none absolute right-0 inset-y-0 w-24 z-10" style={{ background: 'linear-gradient(to left, #030610, transparent)' }} />

            <div className="flex gap-5 px-6 w-max" style={{ animation: 'slideProf 35s linear infinite' }}>
              {[
                { name: 'Road Runner Mike', rig: '40ft Class A',      state: 'TX', trips: 47, img: '/images/Facebook.png',        badge: '/images/road-warrior.png' },
                { name: 'The Hendersons',   rig: '32ft 5th Wheel',    state: 'CO', trips: 23, img: '/images/Facebook1.png',       badge: '/images/TruecamperBadge.png' },
                { name: 'Solo Sandra',      rig: 'Class B Van',       state: 'CA', trips: 61, img: '/images/Deanna_Roberts.png',  badge: '/images/fifty-state-explorer.png' },
                { name: 'Camp Carters',     rig: '28ft Travel Trailer',state: 'WA',trips: 18, img: '/images/Facebook3.png',       badge: '/images/Weekendwarriorbadge.png' },
                { name: 'NomadNancy',       rig: 'Solo Class C',      state: 'AZ', trips: 34, img: '/images/Mary.png',            badge: '/images/trailblazer.png' },
                { name: 'Road Runner Mike', rig: '40ft Class A',      state: 'TX', trips: 47, img: '/images/Photo1.png',          badge: '/images/road-warrior.png' },
                { name: 'The Hendersons',   rig: '32ft 5th Wheel',    state: 'CO', trips: 23, img: '/images/kid.png',             badge: '/images/TruecamperBadge.png' },
                { name: 'Solo Sandra',      rig: 'Class B Van',       state: 'CA', trips: 61, img: '/images/smores.png',          badge: '/images/fifty-state-explorer.png' },
              ].map((p, i) => <ProfileCard key={i} {...p} />)}
            </div>
          </div>
        </section>

        <div className="divider" />

        {/* ────────────────────────────────────────────── BASECAMP FEED */}
        <section className="py-24 px-6 md:px-12 max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row-reverse gap-12 items-center">
            <div className="flex-shrink-0 relative flex items-center justify-center lg:w-80">
              <div className="absolute inset-0 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(251,146,60,.10), transparent 65%)' }} />
              <img
                src="/images/BBQ_RV.png"
                alt="Community"
                className="w-64 h-64 md:w-80 md:h-80 object-contain"
                style={{ animation: 'floatA 6s ease-in-out infinite', filter: 'drop-shadow(0 0 44px rgba(251,146,60,.18))' }}
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/images/Logo_RVUnicorn.png';
                }}
              />
            </div>

            <div className="flex-1">
              <span className="section-label" style={{ background: 'rgba(251,146,60,.10)', border: '1px solid rgba(251,146,60,.18)', color: 'rgba(253,186,116,.95)' }}>
                Basecamp Feed
              </span>

              <h2 className="text-4xl md:text-5xl font-extrabold mb-4 leading-tight">
                Know what’s happening
                <br />
                <span className="font-corm italic font-light text-4xl md:text-5xl" style={{ color: 'rgba(255,255,255,.70)' }}>
                  at the campground.
                </span>
              </h2>

              <p className="text-base leading-relaxed mb-8" style={{ color: 'rgba(255,255,255,.52)' }}>
                Follow campsites, join groups, and coordinate meetups with other RVers staying there at the same time. Share updates, photos,
                and plans before, during, and after every trip.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                <FeedPost user="Mike & Sandra" type="Check-in" content="Just rolled into Glacier NP — pull-through is perfect for our 40-footer. Hookups are solid. Cell signal 4 bars 📡" img="/images/Campfire_hitch.png" />
                <FeedPost user="Camp Carters" type="Trip Photo" content="Olympic NP sunset last night. This community always finds the best hidden spots 🌅" img="/images/RV_Hiking.png" />
                <FeedPost user="Campground Group" type="Meetup" content="Yellowstone weekend meetup — 12 rigs confirmed. Join the group to coordinate convoy times." img={null} />
                <FeedPost user="NomadNancy" type="Badge Earned" content="Just hit my 50 State Explorer badge after 6 years on the road 🏆" img={null} />
              </div>

              <div className="flex gap-3">
                <Link to="/register" className="cta-gold text-sm px-7 py-3.5 rounded-full inline-block">
                  Join the Community →
                </Link>
                <Link to="/register" className="cta-ghost text-sm px-7 py-3.5 rounded-full inline-block">
                  Follow a Campground
                </Link>
              </div>

              <div className="mt-5">
                <HitchTip>Heading somewhere popular? Follow that campground to see events + who else will be there.</HitchTip>
              </div>
            </div>
          </div>
        </section>

        <div className="divider" />

        {/* ────────────────────────────────────────────── BADGES */}
        <section className="py-20">
          <SectionHeading
            label="Badges"
            labelStyle={{ background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.18)', color: 'rgba(245,158,11,.95)' }}
            title={<>Milestones you’ll actually want to earn.</>}
            subtitle={<>Every mile remembered.</>}
            desc="Badges are earned automatically as you travel, post, plan, review, and connect with your herd."
            align="center"
          />

          <div className="relative mt-10">
            <div className="pointer-events-none absolute left-0 inset-y-0 w-32 z-10" style={{ background: 'linear-gradient(to right, #030610, transparent)' }} />
            <div className="pointer-events-none absolute right-0 inset-y-0 w-32 z-10" style={{ background: 'linear-gradient(to left, #030610, transparent)' }} />
            <BadgeStrip badges={row1} reverse={false} speed={62} />
            <BadgeStrip badges={row2} reverse={true} speed={74} />
          </div>

          <div className="max-w-3xl mx-auto px-6 mt-6">
            <HitchTip>Founding Member is limited to beta — join early to lock it in.</HitchTip>
          </div>
        </section>

        <div className="divider" />

        {/* ────────────────────────────────────────────── RECIPE + CREATOR */}
        <section className="py-24 px-6 md:px-12 max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row gap-12 items-center">
            <div className="flex-shrink-0 relative flex items-center justify-center lg:w-80">
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 55%, rgba(52,211,153,.10), transparent 65%)' }} />
              <img
                src="/images/Hitch_OutsideTV.png"
                alt="Creator tools"
                className="w-64 h-64 md:w-80 md:h-80 object-contain"
                style={{ animation: 'floatB 7s ease-in-out infinite', filter: 'drop-shadow(0 0 44px rgba(52,211,153,.18))' }}
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/images/Logo_RVUnicorn.png';
                }}
              />
            </div>

            <div className="flex-1">
              <span className="section-label" style={{ background: 'rgba(52,211,153,.10)', border: '1px solid rgba(52,211,153,.18)', color: 'rgba(110,231,183,.95)' }}>
                Recipe Book + Creator Tools
              </span>

              <h2 className="text-4xl md:text-5xl font-extrabold mb-4 leading-tight">
                Share the fire.
                <br />
                <span className="gold-text">Become a creator.</span>
              </h2>

              <p className="text-base leading-relaxed mb-6" style={{ color: 'rgba(255,255,255,.52)' }}>
                Share campfire recipes, reviews, and trip stories. Build a following and create influencer-style content inside a community that
                actually lives the RV lifestyle.
              </p>

              <div className="flex gap-4 overflow-hidden mb-6">
                {[
                  { title: 'Dutch Oven Chili', author: 'Mike & Sandra', time: '45 min', emoji: '🍲' },
                  { title: 'Campfire Smash Burgers', author: 'Camp Carters', time: '20 min', emoji: '🍔' },
                  { title: 'Skillet Peach Cobbler', author: 'NomadNancy', time: '30 min', emoji: '🍑' },
                  { title: "S'mores Nachos", author: 'DrifterDave', time: '10 min', emoji: '🍫' },
                ].map((r, i) => <RecipeCard key={i} {...r} />)}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {[
                  ['🎥', 'Creator Pages', 'Your own branded page within RVUnicorn'],
                  ['💰', 'Monetization (Coming Soon)', 'Partnership-ready creator profiles + audiences'],
                  ['📍', 'Content Attached to Campgrounds', 'Your reviews live directly on campground pages'],
                  ['🏆', 'Creator Recognition', 'Badges + visibility for top contributors'],
                ].map(([icon, title, desc]) => (
                  <div key={title} className="flex items-start gap-3 p-3 rounded-xl glass-card">
                    <span className="text-xl flex-shrink-0">{icon}</span>
                    <div>
                      <div className="text-sm font-bold text-white">{title}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,.44)' }}>
                        {desc}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <Link to="/register" className="cta-gold text-sm px-7 py-3.5 rounded-full inline-block">
                  Start Creating →
                </Link>
                <Link to="/register" className="cta-ghost text-sm px-7 py-3.5 rounded-full inline-block">
                  Add a Recipe
                </Link>
              </div>
            </div>
          </div>
        </section>

        <div className="divider" />

        {/* ────────────────────────────────────────────── PHOTO ALBUMS */}
        <section className="py-24 px-6 md:px-12 max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row gap-12 items-center">
            {/* Shutterbug mascot / photo collage mock */}
            <div className="flex-shrink-0 relative flex items-center justify-center lg:w-96">
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 55%, rgba(244,114,182,.10), transparent 65%)' }} />
              {/* Stacked photo card mock */}
              <div className="relative w-72">
                {/* Back card */}
                <div className="absolute inset-0 rounded-2xl rotate-6 opacity-40" style={{ background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.12)' }} />
                {/* Mid card */}
                <div className="absolute inset-0 rounded-2xl rotate-2 opacity-60" style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.10)' }} />
                {/* Front card */}
                <div className="relative rounded-2xl overflow-hidden" style={{ background: 'rgba(15,25,60,.9)', border: '1px solid rgba(244,114,182,.22)' }}>
                  <div className="h-44 flex items-center justify-center overflow-hidden" style={{ background: 'radial-gradient(circle at 40% 40%, rgba(30,53,100,.9), rgba(5,10,30,.95))' }}>
                    <img
                      src="/images/RV_Hiking.png"
                      alt="Trip photo"
                      className="h-40 w-auto object-contain"
                      style={{ filter: 'drop-shadow(0 0 30px rgba(244,114,182,.25))' }}
                      loading="lazy" decoding="async"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/images/Logo_RVUnicorn.png'; }}
                    />
                  </div>
                  <div className="p-4">
                    <div className="font-bold text-sm text-white mb-1">Olympic NP — Summer 2025</div>
                    <div className="text-xs mb-3" style={{ color: 'rgba(255,255,255,.45)' }}>12 photos • 3 tagged campgrounds</div>
                    <div className="flex items-center gap-2">
                      {['/images/Shutterbug.png', '/images/album-pro.png', '/images/storyteller.png'].map((b, i) => (
                        <img key={i} src={b} alt="badge" className="w-7 h-7 object-contain"
                          onError={(e) => { (e.target as HTMLImageElement).src = '/images/Logo_RVUnicorn.png'; }} />
                      ))}
                      <span className="text-xs ml-1" style={{ color: 'rgba(255,255,255,.38)' }}>Badges earned on this trip</span>
                    </div>
                  </div>
                </div>
                {/* Floating reaction pill */}
                <div className="absolute -bottom-4 -right-4 rounded-full px-4 py-2 text-sm font-bold flex items-center gap-2"
                  style={{ background: 'rgba(244,114,182,.14)', border: '1px solid rgba(244,114,182,.3)', backdropFilter: 'blur(8px)', animation: 'floatB 5s ease-in-out infinite' }}>
                  ❤️ <span style={{ color: 'rgba(244,114,182,.95)' }}>47 reactions</span>
                </div>
              </div>
            </div>

            <div className="flex-1">
              <span className="section-label" style={{ background: 'rgba(244,114,182,.10)', border: '1px solid rgba(244,114,182,.20)', color: 'rgba(249,168,212,.95)' }}>
                Photo Albums &amp; Stories
              </span>

              <h2 className="text-4xl md:text-5xl font-extrabold mb-4 leading-tight">
                Every trip deserves
                <br />
                <span className="gold-text">its own story.</span>
              </h2>

              <p className="text-base leading-relaxed mb-8" style={{ color: 'rgba(255,255,255,.52)' }}>
                Build beautiful photo albums for every trip, tag the campgrounds you stayed at, and share your journey with friends, followers,
                and the RVUnicorn community. Your best moments, all in one place.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                {[
                  ['📸', 'Trip Albums', 'Organize every adventure into its own gallery', 'rgba(244,114,182,.18)'],
                  ['📍', 'Tag Campgrounds', 'Pin photos directly to campsites for other RVers to find', 'rgba(96,165,250,.18)'],
                  ['🏆', 'Earn Badges', 'Shutterbug, Storyteller, and Album Pro unlock as you share', 'rgba(245,158,11,.18)'],
                  ['👥', 'Share with Friends', 'Public, friends-only, or group — you control who sees it', 'rgba(52,211,153,.18)'],
                  ['📖', 'Trip Stories', 'Write a full narrative to go with your photos and route', 'rgba(167,139,250,.18)'],
                  ['🔔', 'Community Reactions', 'Get likes, comments, and follows from the herd', 'rgba(251,146,60,.18)'],
                ].map(([icon, title, desc, tint]) => (
                  <div key={title} className="flex items-start gap-3 p-3.5 rounded-xl"
                    style={{ background: tint, border: '1px solid rgba(255,255,255,.07)' }}>
                    <span className="text-xl flex-shrink-0">{icon}</span>
                    <div>
                      <div className="text-sm font-bold text-white">{title}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,.50)' }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <Link to="/register" className="cta-gold text-sm px-7 py-3.5 rounded-full inline-block">
                  Start Your Album →
                </Link>
                <Link to="/register" className="cta-ghost text-sm px-7 py-3.5 rounded-full inline-block">
                  Browse Trip Stories
                </Link>
              </div>

              <div className="mt-5">
                <HitchTip>Photos tagged to campgrounds show up on that campground's page — so your memories help the next RVer plan their trip.</HitchTip>
              </div>
            </div>
          </div>
        </section>

        <div className="divider" />

        {/* ────────────────────────────────────────────── CAMPSITE EXPLORE & BOOK */}
        <section className="py-24 px-6 md:px-12 max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row-reverse gap-12 items-center">
            {/* Right — floating campsite cards cluster */}
            <div className="flex-shrink-0 relative flex items-center justify-center lg:w-[480px] h-[520px] hidden lg:flex">

              {/* Ambient glow behind cluster */}
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(52,211,153,.10), transparent 65%)' }} />

              {/* ── CARD 1 (main, center-left) — Glacier NP ── */}
              <div className="absolute" style={{ top: '60px', left: '0px', animation: 'floatA 7s ease-in-out infinite', zIndex: 3 }}>
                <div className="w-56 rounded-2xl overflow-hidden shadow-2xl"
                  style={{ background: 'rgba(8,18,48,.96)', border: '1px solid rgba(52,211,153,.28)', boxShadow: '0 20px 50px rgba(0,0,0,.7), 0 0 30px rgba(52,211,153,.08)' }}>
                  <div className="h-28 relative flex items-center justify-center overflow-hidden"
                    style={{ background: 'radial-gradient(circle at 35% 50%, rgba(10,40,28,.98), rgba(3,8,25,.99))' }}>
                    <img src="/images/Find_Your_Herd_Default_Poppy.png" alt="Glacier NP"
                      className="h-24 w-auto object-contain"
                      style={{ filter: 'drop-shadow(0 0 20px rgba(52,211,153,.3))' }}
                      loading="lazy" decoding="async"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/images/Logo_RVUnicorn.png'; }} />
                    <div className="absolute top-2 right-2 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
                      style={{ background: 'rgba(52,211,153,.15)', border: '1px solid rgba(52,211,153,.4)', color: 'rgba(110,231,183,.95)' }}>
                      <span className="w-1 h-1 rounded-full bg-emerald-400" style={{ animation: 'twinkle 2s ease-in-out infinite' }} />
                      Open
                    </div>
                  </div>
                  <div className="p-3.5">
                    <div className="font-extrabold text-white text-sm leading-tight">Glacier NP — Apgar</div>
                    <div className="text-xs mt-0.5 mb-2.5" style={{ color: 'rgba(255,255,255,.42)' }}>West Glacier, MT</div>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {['50A', 'Pull-thru', '45ft max'].map(t => (
                        <span key={t} className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(52,211,153,.10)', border: '1px solid rgba(52,211,153,.22)', color: 'rgba(110,231,183,.85)' }}>{t}</span>
                      ))}
                    </div>
                    <div className="flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,.07)', paddingTop: '10px' }}>
                      <div><span className="font-extrabold text-white">$42</span><span className="text-xs ml-1" style={{ color: 'rgba(255,255,255,.38)' }}>/night</span></div>
                      <div className="flex items-center gap-1"><span style={{ color: '#fbbf24', fontSize: '12px' }}>★</span><span className="text-xs font-bold text-amber-300">4.9</span><span className="text-xs" style={{ color: 'rgba(255,255,255,.3)' }}>(312)</span></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── CARD 2 (upper right) — Yellowstone ── */}
              <div className="absolute" style={{ top: '0px', right: '10px', animation: 'floatB 9s ease-in-out infinite', zIndex: 2 }}>
                <div className="w-52 rounded-2xl overflow-hidden shadow-2xl"
                  style={{ background: 'rgba(8,18,48,.96)', border: '1px solid rgba(245,158,11,.22)', boxShadow: '0 20px 50px rgba(0,0,0,.65), 0 0 25px rgba(245,158,11,.07)' }}>
                  <div className="h-24 relative flex items-center justify-center overflow-hidden"
                    style={{ background: 'radial-gradient(circle at 35% 50%, rgba(40,25,5,.98), rgba(3,8,25,.99))' }}>
                    <img src="/images/Campfire_hitch.png" alt="Yellowstone"
                      className="h-20 w-auto object-contain"
                      style={{ filter: 'drop-shadow(0 0 18px rgba(245,158,11,.35))' }}
                      loading="lazy" decoding="async"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/images/Logo_RVUnicorn.png'; }} />
                    <div className="absolute top-2 right-2 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
                      style={{ background: 'rgba(245,158,11,.15)', border: '1px solid rgba(245,158,11,.35)', color: 'rgba(253,230,138,.95)' }}>
                      <span className="w-1 h-1 rounded-full bg-amber-400" style={{ animation: 'twinkle 2.5s ease-in-out infinite' }} />
                      3 left
                    </div>
                  </div>
                  <div className="p-3.5">
                    <div className="font-extrabold text-white text-sm leading-tight">Yellowstone — Madison</div>
                    <div className="text-xs mt-0.5 mb-2.5" style={{ color: 'rgba(255,255,255,.42)' }}>Yellowstone NP, WY</div>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {['30A', 'No sewer', '40ft max'].map(t => (
                        <span key={t} className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(245,158,11,.10)', border: '1px solid rgba(245,158,11,.20)', color: 'rgba(253,230,138,.85)' }}>{t}</span>
                      ))}
                    </div>
                    <div className="flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,.07)', paddingTop: '10px' }}>
                      <div><span className="font-extrabold text-white">$35</span><span className="text-xs ml-1" style={{ color: 'rgba(255,255,255,.38)' }}>/night</span></div>
                      <div className="flex items-center gap-1"><span style={{ color: '#fbbf24', fontSize: '12px' }}>★</span><span className="text-xs font-bold text-amber-300">4.8</span><span className="text-xs" style={{ color: 'rgba(255,255,255,.3)' }}>(198)</span></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── CARD 3 (lower right) — Sedona ── */}
              <div className="absolute" style={{ bottom: '20px', right: '0px', animation: 'floatA 11s 2s ease-in-out infinite', zIndex: 2 }}>
                <div className="w-52 rounded-2xl overflow-hidden shadow-2xl"
                  style={{ background: 'rgba(8,18,48,.96)', border: '1px solid rgba(167,139,250,.22)', boxShadow: '0 20px 50px rgba(0,0,0,.65), 0 0 25px rgba(167,139,250,.07)' }}>
                  <div className="h-24 relative flex items-center justify-center overflow-hidden"
                    style={{ background: 'radial-gradient(circle at 35% 50%, rgba(25,10,40,.98), rgba(3,8,25,.99))' }}>
                    <img src="/images/BBQ_RV.png" alt="Sedona"
                      className="h-20 w-auto object-contain"
                      style={{ filter: 'drop-shadow(0 0 18px rgba(167,139,250,.3))' }}
                      loading="lazy" decoding="async"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/images/Logo_RVUnicorn.png'; }} />
                    <div className="absolute top-2 right-2 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
                      style={{ background: 'rgba(52,211,153,.15)', border: '1px solid rgba(52,211,153,.4)', color: 'rgba(110,231,183,.95)' }}>
                      <span className="w-1 h-1 rounded-full bg-emerald-400" style={{ animation: 'twinkle 1.8s ease-in-out infinite' }} />
                      Open
                    </div>
                  </div>
                  <div className="p-3.5">
                    <div className="font-extrabold text-white text-sm leading-tight">Sedona Pines RV Resort</div>
                    <div className="text-xs mt-0.5 mb-2.5" style={{ color: 'rgba(255,255,255,.42)' }}>Sedona, AZ</div>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {['50A Full', 'Pool', '45ft max'].map(t => (
                        <span key={t} className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(167,139,250,.10)', border: '1px solid rgba(167,139,250,.20)', color: 'rgba(196,181,253,.85)' }}>{t}</span>
                      ))}
                    </div>
                    <div className="flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,.07)', paddingTop: '10px' }}>
                      <div><span className="font-extrabold text-white">$68</span><span className="text-xs ml-1" style={{ color: 'rgba(255,255,255,.38)' }}>/night</span></div>
                      <div className="flex items-center gap-1"><span style={{ color: '#fbbf24', fontSize: '12px' }}>★</span><span className="text-xs font-bold text-amber-300">4.7</span><span className="text-xs" style={{ color: 'rgba(255,255,255,.3)' }}>(87)</span></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── CARD 4 (bottom-left, mini) — Olympic NP ── */}
              <div className="absolute" style={{ bottom: '40px', left: '20px', animation: 'floatB 8s 1s ease-in-out infinite', zIndex: 1 }}>
                <div className="w-44 rounded-2xl overflow-hidden shadow-xl"
                  style={{ background: 'rgba(8,18,48,.94)', border: '1px solid rgba(96,165,250,.20)', boxShadow: '0 16px 40px rgba(0,0,0,.6)' }}>
                  <div className="h-20 relative flex items-center justify-center overflow-hidden"
                    style={{ background: 'radial-gradient(circle at 35% 50%, rgba(5,20,40,.98), rgba(3,8,25,.99))' }}>
                    <img src="/images/RV_Hiking.png" alt="Olympic NP"
                      className="h-16 w-auto object-contain"
                      style={{ filter: 'drop-shadow(0 0 14px rgba(96,165,250,.3))' }}
                      loading="lazy" decoding="async"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/images/Logo_RVUnicorn.png'; }} />
                  </div>
                  <div className="p-3">
                    <div className="font-extrabold text-white text-xs leading-tight">Olympic NP — Hoh</div>
                    <div className="text-xs mt-0.5 mb-2" style={{ color: 'rgba(255,255,255,.38)' }}>Forks, WA</div>
                    <div className="flex items-center justify-between">
                      <div><span className="font-extrabold text-white text-sm">$28</span><span className="text-xs ml-0.5" style={{ color: 'rgba(255,255,255,.35)' }}>/night</span></div>
                      <div className="flex items-center gap-0.5"><span style={{ color: '#fbbf24', fontSize: '11px' }}>★</span><span className="text-xs font-bold text-amber-300">4.6</span></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Floating "11,000+ campgrounds" pill ── */}
              <div className="absolute" style={{ top: '220px', left: '50%', transform: 'translateX(-50%)', animation: 'floatB 6s 3s ease-in-out infinite', zIndex: 4 }}>
                <div className="text-xs font-black tracking-wide px-4 py-2 rounded-full whitespace-nowrap flex items-center gap-2"
                  style={{ background: 'rgba(52,211,153,.12)', border: '1px solid rgba(52,211,153,.3)', color: 'rgba(110,231,183,.95)', backdropFilter: 'blur(8px)' }}>
                  <span>🏕️</span> 11,000+ campgrounds to explore
                </div>
              </div>

            </div>

            {/* Left — content */}
            <div className="flex-1">
              <span className="section-label" style={{ background: 'rgba(52,211,153,.10)', border: '1px solid rgba(52,211,153,.20)', color: 'rgba(110,231,183,.95)' }}>
                Campsite Discovery &amp; Booking
              </span>

              <h2 className="text-4xl md:text-5xl font-extrabold mb-4 leading-tight">
                Find the perfect site.
                <br />
                <span className="gold-text">Book it without leaving RVUnicorn.</span>
              </h2>

              <p className="text-base leading-relaxed mb-8" style={{ color: 'rgba(255,255,255,.52)' }}>
                Browse 11,000+ campgrounds with filters built specifically for RV life — rig height, power hookups, slide clearance, pull-through
                availability, and real reviews from RVers who've actually been there. Find a site you love and book it in one tap.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                {[
                  ['🔍', 'RV-Specific Filters', 'Search by rig length, height, hookup type, and road grade — not just "tent or cabin"'],
                  ['⭐', 'Real RVer Reviews', 'Every review covers hookups, cell signal, road access, and whether big rigs actually fit'],
                  ['📅', 'Live Availability', 'See open sites in real time and book directly through the platform'],
                  ['📍', 'Campground Pages', 'Photos, events, community posts, and who else is camping there this weekend'],
                  ['🗺️', 'Map Discovery', 'Explore campgrounds along your route and add stops to your trip plan instantly'],
                  ['🔖', 'Save Favorites', 'Wishlist campgrounds and get notified when your dates open up'],
                ].map(([icon, title, desc]) => (
                  <div key={title} className="flex items-start gap-3 p-3.5 rounded-xl glass-card">
                    <span className="text-xl flex-shrink-0">{icon}</span>
                    <div>
                      <div className="text-sm font-bold text-white">{title}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,.48)' }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <Link to="/campgrounds" className="cta-gold text-sm px-7 py-3.5 rounded-full inline-block">
                  Explore Campgrounds →
                </Link>
                <Link to="/register" className="cta-ghost text-sm px-7 py-3.5 rounded-full inline-block">
                  Save a Favorite
                </Link>
              </div>

              <div className="mt-5">
                <HitchTip>Add your rig specs to your profile once, and every campground search will automatically filter for sites that actually fit you.</HitchTip>
              </div>
            </div>
          </div>
        </section>

        <div className="divider" />

        {/* ────────────────────────────────────────────── FEATURE GRID */}
        <section className="py-20 px-6 md:px-12">
          <div className="max-w-7xl mx-auto">
            <SectionHeading
              label="Everything at Basecamp"
              labelStyle={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.10)', color: 'rgba(255,255,255,.70)' }}
              title={<>One platform. Every road need.</>}
              desc="Practical tools built for RV life — plus the community that makes the journey better."
              align="center"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-10">
              {[
                { icon: '🔧', title: 'Mechanic Log', desc: 'Track maintenance, reminders, and costs. Protect your investment.' },
                { icon: '⭐', title: 'Campsite Reviews', desc: 'Hookups, road access, cell signal, and real RV feedback.' },
                { icon: '📍', title: 'State Tracker', desc: 'See where you’ve camped and chase the 50-state badge.' },
                { icon: '🚐', title: 'Rig Profiles', desc: 'Add specs once; get campground suggestions that fit.' },
                { icon: '📅', title: 'Campground Events', desc: 'Find meetups and events at places you’re staying.' },
                { icon: '👥', title: 'Groups & Clubs', desc: 'Create clubs, plan caravans, and make the road social.' },
                { icon: '📸', title: 'Albums & Stories', desc: 'Capture trips, tag campgrounds, and share memories.' },
                { icon: '🤖', title: 'AI Trip Assistant', desc: 'Ask anything. Hitch helps plan and adapt on the go.' },
              ].map((f) => (
                <div key={f.title} className="glass-card rounded-2xl p-6 hover:-translate-y-1 transition-transform duration-300 group">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform duration-300" style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.10)' }}>
                    {f.icon}
                  </div>
                  <h3 className="font-bold text-white mb-2">{f.title}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,.44)' }}>
                    {f.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="divider" />

        {/* ────────────────────────────────────────────── FOUNDING CTA */}
        <section className="py-24 px-6 md:px-12">
          <div className="max-w-5xl mx-auto">
            <div
              className="rounded-3xl overflow-hidden relative p-10 md:p-16"
              style={{
                background:
                  'radial-gradient(ellipse 80% 80% at 50% 100%, rgba(245,158,11,.08), transparent), linear-gradient(135deg, #0f1d4a, #0a1628)',
                border: '1px solid rgba(245,158,11,.14)',
              }}
            >
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 55% 40% at 50% 110%, rgba(245,158,11,.10), transparent)' }} />

              <div className="relative flex flex-col md:flex-row items-center gap-10">
                <div className="flex-shrink-0" style={{ animation: 'floatA 5s ease-in-out infinite' }}>
                  <img
                    src="/images/Roaming_Unicorn.png"
                    alt="RVUnicorn"
                    className="w-44 h-44 object-contain"
                    style={{ filter: 'drop-shadow(0 0 44px rgba(245,158,11,.26))' }}
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/images/Logo_RVUnicorn.png';
                    }}
                  />
                </div>

                <div className="flex-1 text-center md:text-left">
                  <span className="inline-flex items-center gap-2 text-xs font-black tracking-widest uppercase px-3 py-1 rounded-full mb-5" style={{ background: 'rgba(245,158,11,.10)', border: '1px solid rgba(245,158,11,.20)', color: 'rgba(245,158,11,.95)' }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-300" style={{ animation: 'twinkle 1.5s ease-in-out infinite' }} />
                    Currently in Beta
                  </span>

                  <h2 className="text-4xl md:text-5xl font-extrabold leading-tight mb-5">
                    Get in early.
                    <br />
                    <span className="gold-text">Shape what RVUnicorn becomes.</span>
                  </h2>

                  <p className="text-base leading-relaxed mb-8" style={{ color: 'rgba(255,255,255,.50)' }}>
                    Join now during beta and lock in the exclusive <strong style={{ color: 'rgba(245,158,11,.95)' }}>Founding Member badge</strong>.
                    Free forever.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
                    <Link to="/register" className="cta-gold text-base px-9 py-4 rounded-full text-center">
                      Claim Your Founding Spot 🦄
                    </Link>
                    <Link to="/login" className="cta-ghost text-sm px-7 py-4 rounded-full text-center">
                      Already a member? Log in
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ────────────────────────────────────────────── FOOTER */}
        <footer className="py-10 px-6" style={{ borderTop: '1px solid rgba(255,255,255,.06)' }}>
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center" style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)' }}>
                <img src="/images/Logo_RVUnicorn.png" alt="" className="w-6 h-6 object-contain" loading="lazy" decoding="async" />
              </div>
              <span className="text-sm" style={{ color: 'rgba(255,255,255,.3)' }}>
                © {new Date().getFullYear()} RVUnicorn
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.18)', color: 'rgba(245,158,11,.75)' }}>
                Beta
              </span>
            </div>

            <div className="flex items-center gap-6 text-sm" style={{ color: 'rgba(255,255,255,.3)' }}>
              <Link to="/privacy" className="hover:text-white transition-colors">
                Privacy
              </Link>
              <Link to="/terms" className="hover:text-white transition-colors">
                Terms
              </Link>
              <Link to="/register" className="hover:text-white transition-colors">
                Creator Program
              </Link>
              <a href="mailto:hello@rvunicorn.com" className="hover:text-white transition-colors">
                Contact
              </a>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}

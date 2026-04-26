import { useState, useEffect } from 'react';
import RigPulseCard from './lifestyle/RigPulseCard';
import WeekendNearYou from './lifestyle/WeekendNearYou';
import HitchDailyDrop from './lifestyle/HitchDailyDrop';
import TriviaStreak from './lifestyle/TriviaStreak';
import FriendsOnRoad from './lifestyle/FriendsOnRoad';
import TrendingVisited from './lifestyle/TrendingVisited';
import SeasonalChecklist from './lifestyle/SeasonalChecklist';
import NextTripCTA from './lifestyle/NextTripCTA';

// ── Campfire Night Design Tokens ──────────────────────────────────────────
const CN = {
  bg: '#0F1C35',
  card: '#162236',
  cardAlt: '#1A2A45',
  gold: '#E8A838',
  orange: '#D4621A',
  cream: '#F5F0E8',
  muted: '#8B9BB4',
  border: '#243552',
  success: '#4CAF82',
  skeleton: '#1E2F4A',
};

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

interface Props {
  user: any;
}

export default function LifestyleModeBasecamp({ user }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <>
      <style>{`
        @keyframes ember-float {
          0%   { transform: translateY(0) translateX(0); opacity: 0; }
          20%  { opacity: 0.3; }
          80%  { opacity: 0.15; }
          100% { transform: translateY(-120px) translateX(20px); opacity: 0; }
        }
        @keyframes stagger-in {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes gold-pulse {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.6; }
        }
        .lifestyle-shimmer {
          background: linear-gradient(90deg, ${CN.card} 25%, ${CN.skeleton} 50%, ${CN.card} 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }
        .lifestyle-module {
          opacity: 0;
          transform: translateY(20px);
        }
        .lifestyle-module.mounted {
          animation: stagger-in 400ms ease-out forwards;
        }
      `}</style>

      <div style={{ background: CN.bg, minHeight: '100vh' }}>
        {/* ── HEADER ────────────────────────────────────────────── */}
        <div className="relative overflow-hidden px-6 pt-8 pb-6">
          {/* Campfire ember particles */}
          {[0, 1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="absolute rounded-full pointer-events-none"
              style={{
                width: 4 + Math.random() * 4,
                height: 4 + Math.random() * 4,
                background: CN.orange,
                left: `${15 + i * 18}%`,
                bottom: '10px',
                opacity: 0,
                animation: `ember-float ${3 + i * 0.7}s ease-out infinite`,
                animationDelay: `${i * 0.8}s`,
              }}
            />
          ))}

          <div className="max-w-4xl mx-auto">
            <p className="text-[10px] font-bold tracking-[2px] uppercase mb-2" style={{ color: CN.gold }}>
              LIFESTYLE MODE
            </p>
            <h1 className="text-2xl md:text-3xl font-bold mb-1" style={{ fontFamily: "'Playfair Display', serif", color: CN.cream }}>
              Good {getGreeting()}, {user?.firstName || 'friend'}.
            </h1>
            <p className="text-sm" style={{ color: CN.muted }}>
              Your RV life doesn't stop between trips.
            </p>
          </div>
        </div>

        {/* ── MODULES ───────────────────────────────────────────── */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-12 space-y-5">
          {/* Above the fold: Rig Pulse, Weekend Near You, Hitch Daily Drop */}
          <div className={`lifestyle-module ${mounted ? 'mounted' : ''}`} style={{ animationDelay: '0ms' }}>
            <RigPulseCard user={user} cn={CN} />
          </div>

          <div className={`lifestyle-module ${mounted ? 'mounted' : ''}`} style={{ animationDelay: '100ms' }}>
            <WeekendNearYou user={user} cn={CN} />
          </div>

          <div className={`lifestyle-module ${mounted ? 'mounted' : ''}`} style={{ animationDelay: '200ms' }}>
            <HitchDailyDrop user={user} cn={CN} />
          </div>

          {/* Mid-feed: Trivia + Friends side by side on desktop */}
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-5 lifestyle-module ${mounted ? 'mounted' : ''}`} style={{ animationDelay: '300ms' }}>
            <TriviaStreak user={user} cn={CN} />
            <FriendsOnRoad user={user} cn={CN} />
          </div>

          {/* Lower feed */}
          <div className={`lifestyle-module ${mounted ? 'mounted' : ''}`} style={{ animationDelay: '400ms' }}>
            <TrendingVisited user={user} cn={CN} />
          </div>

          <div className={`lifestyle-module ${mounted ? 'mounted' : ''}`} style={{ animationDelay: '500ms' }}>
            <SeasonalChecklist cn={CN} />
          </div>

          <div className={`lifestyle-module ${mounted ? 'mounted' : ''}`} style={{ animationDelay: '600ms' }}>
            <NextTripCTA cn={CN} />
          </div>
        </div>
      </div>
    </>
  );
}

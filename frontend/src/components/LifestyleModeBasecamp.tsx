import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import RigPulseCard from './lifestyle/RigPulseCard';
import WeekendNearYou from './lifestyle/WeekendNearYou';
import HitchDailyDrop from './lifestyle/HitchDailyDrop';
import TriviaStreak from './lifestyle/TriviaStreak';
import FriendsOnRoad from './lifestyle/FriendsOnRoad';
import TrendingVisited from './lifestyle/TrendingVisited';
import SeasonalChecklist from './lifestyle/SeasonalChecklist';
import NextTripCTA from './lifestyle/NextTripCTA';
import SocialFeed from './SocialFeed';
import CampgroundUpdatesFeed from './CampgroundUpdatesFeed';
import api from '../services/api';

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
  const [feedTab, setFeedTab] = useState<'friends' | 'community' | 'campgrounds'>('friends');
  const [communityPosts, setCommunityPosts] = useState<any[]>([]);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    api.get('/basecamp/community-posts?limit=10').then(r => setCommunityPosts(r.data?.posts || [])).catch(() => {});
  }, []);

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

          {/* ── SOCIAL FEED ────────────────────────────────────── */}
          <div className={`lifestyle-module ${mounted ? 'mounted' : ''}`} style={{ animationDelay: '100ms' }}>
            <div className="rounded-2xl overflow-hidden" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
              {/* Feed Tab Headers */}
              <div className="flex" style={{ borderBottom: `1px solid ${CN.border}` }}>
                {(['friends', 'community', 'campgrounds'] as const).map(tab => {
                  const labels: Record<string, string> = {
                    friends: '\u{1F465} Friends',
                    community: '\u{1F3D5}\uFE0F Community',
                    campgrounds: '\u{1F4CD} Campgrounds',
                  };
                  return (
                    <button
                      key={tab}
                      onClick={() => setFeedTab(tab)}
                      className="flex-1 px-4 py-3 text-xs font-semibold transition"
                      style={{
                        color: feedTab === tab ? CN.gold : CN.muted,
                        borderBottom: feedTab === tab ? `2px solid ${CN.gold}` : '2px solid transparent',
                        background: feedTab === tab ? 'rgba(232,168,56,0.05)' : 'transparent',
                      }}
                    >
                      {labels[tab]}
                    </button>
                  );
                })}
              </div>

              {/* Feed Content */}
              <div className="p-4">
                {feedTab === 'friends' && (
                  <SocialFeed username={user?.username || ''} isOwnProfile={true} includePacking={true} />
                )}

                {feedTab === 'community' && (
                  <div>
                    {communityPosts.length === 0 ? (
                      <div className="text-center py-8">
                        <span className="text-3xl mb-2 block">{'\u{1F3D5}\uFE0F'}</span>
                        <p className="text-sm mb-2" style={{ color: CN.muted }}>No community posts yet</p>
                        <Link to="/community" className="text-sm font-semibold" style={{ color: CN.gold }}>Start a discussion {'\u2192'}</Link>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {communityPosts.map((post: any) => (
                          <Link key={post.id} to="/community" className="flex gap-3 p-3 rounded-xl transition" style={{ background: CN.cardAlt }}>
                            <div className="flex-shrink-0 w-8 text-center pt-0.5">
                              <span className="text-sm font-bold" style={{ color: CN.gold }}>{post.voteScore}</span>
                              <div className="text-[10px]" style={{ color: CN.muted }}>pts</div>
                            </div>
                            <div className="flex-1 min-w-0">
                              {post.board && (
                                <div className="flex items-center gap-1 mb-0.5">
                                  <span className="text-xs">{post.board.icon}</span>
                                  <span className="text-xs" style={{ color: CN.muted }}>{post.board.name}</span>
                                </div>
                              )}
                              <p className="text-sm font-semibold line-clamp-2 leading-snug" style={{ color: CN.cream }}>{post.title}</p>
                              <span className="text-[10px]" style={{ color: CN.muted }}>
                                {post.author?.firstName} {post.author?.lastName}
                              </span>
                            </div>
                          </Link>
                        ))}
                        <Link to="/community" className="block text-center text-xs font-semibold py-2" style={{ color: CN.gold }}>
                          View all community posts {'\u2192'}
                        </Link>
                      </div>
                    )}
                  </div>
                )}

                {feedTab === 'campgrounds' && (
                  <CampgroundUpdatesFeed />
                )}
              </div>
            </div>
          </div>

          <div className={`lifestyle-module ${mounted ? 'mounted' : ''}`} style={{ animationDelay: '200ms' }}>
            <WeekendNearYou user={user} cn={CN} />
          </div>

          <div className={`lifestyle-module ${mounted ? 'mounted' : ''}`} style={{ animationDelay: '300ms' }}>
            <HitchDailyDrop user={user} cn={CN} />
          </div>

          {/* Mid-feed: Trivia + Friends side by side on desktop */}
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-5 lifestyle-module ${mounted ? 'mounted' : ''}`} style={{ animationDelay: '400ms' }}>
            <TriviaStreak user={user} cn={CN} />
            <FriendsOnRoad user={user} cn={CN} />
          </div>

          {/* Lower feed */}
          <div className={`lifestyle-module ${mounted ? 'mounted' : ''}`} style={{ animationDelay: '500ms' }}>
            <TrendingVisited user={user} cn={CN} />
          </div>

          <div className={`lifestyle-module ${mounted ? 'mounted' : ''}`} style={{ animationDelay: '600ms' }}>
            <SeasonalChecklist cn={CN} />
          </div>

          <div className={`lifestyle-module ${mounted ? 'mounted' : ''}`} style={{ animationDelay: '700ms' }}>
            <NextTripCTA cn={CN} />
          </div>
        </div>
      </div>
    </>
  );
}

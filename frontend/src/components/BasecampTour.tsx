import { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Sparkles, Home, Flame, Map, Calendar,
  MessageCircle, Wrench, Camera, Users, Award, Tent, MapPin, Bell,
  Zap, Heart, Star, Package } from 'lucide-react';
import api from '../services/api';

interface TourStep {
  icon: React.ReactNode;
  emoji: string;
  title: string;
  description: string;
  tip?: string;
  color: string;
  accentColor: string;
  setupAction?: { label: string; href: string };
}

const TOUR_STEPS: TourStep[] = [
  {
    emoji: '🏕️',
    icon: <Home className="w-8 h-8" />,
    title: 'Welcome to Your Basecamp',
    description: 'This is your home on RVUnicorn — your personal hub for everything camping and RV life. Think of it as your campsite dashboard where all your adventures begin.',
    tip: 'Your Basecamp updates in real time as you and your community share experiences.',
    color: '#1a1f2e',
    accentColor: '#f59e0b',
    setupAction: { label: 'Complete Your Profile', href: '/profile' },
  },
  {
    emoji: '📣',
    icon: <Flame className="w-8 h-8" />,
    title: 'Share Your Status',
    description: 'Post what you are up to — share that you are camping, planning a trip, or just got home from an adventure. Tag campgrounds, mention friends, and add photos to your posts.',
    tip: 'Check in at a campground to let the community know where you are parked!',
    color: '#7c2d12',
    accentColor: '#fb923c',
    setupAction: { label: 'Make Your First Post', href: '/basecamp' },
  },
  {
    emoji: '🗺️',
    icon: <Map className="w-8 h-8" />,
    title: 'Travel & Routes',
    description: 'Plan your next road trip with our Travel Map. Find campgrounds along your route, discover overnight stops, browse Harvest Hosts, and use the Drive Planner to map out your journey.',
    tip: 'The Smart Gas Stops feature calculates fuel stops based on your RV\'s actual MPG.',
    color: '#064e3b',
    accentColor: '#34d399',
    setupAction: { label: 'Plan a Route', href: '/travel' },
  },
  {
    emoji: '🏔️',
    icon: <Tent className="w-8 h-8" />,
    title: 'Discover Campgrounds',
    description: 'Browse over 16,000 campgrounds across the US. Filter by state, amenities, and RV size. Follow your favorites, read reviews, check in when you arrive, and earn badges.',
    tip: 'Campgrounds can award their own exclusive badges to loyal visitors!',
    color: '#1e3a5f',
    accentColor: '#60a5fa',
    setupAction: { label: 'Find Campgrounds', href: '/campgrounds' },
  },
  {
    emoji: '📅',
    icon: <Calendar className="w-8 h-8" />,
    title: 'Plan Trips',
    description: 'Create trips and invite your crew. Add campgrounds, build packing lists, plan meals, assign tasks, and keep everyone on the same page — all in one place.',
    tip: 'Hitch, your AI trail guide, will send you a welcome message when you plan your first trip!',
    color: '#4c1d95',
    accentColor: '#a78bfa',
    setupAction: { label: 'Plan Your First Trip', href: '/events' },
  },
  {
    emoji: '🚐',
    icon: <Wrench className="w-8 h-8" />,
    title: 'Manage Your Rig',
    description: 'Track your RV details, maintenance history, fuel logs, and odometer. Set maintenance reminders so you never miss an oil change or tire rotation again.',
    tip: 'Add your RV now so the community knows your setup and you get personalized recommendations.',
    color: '#78350f',
    accentColor: '#fbbf24',
    setupAction: { label: 'Add Your RV', href: '/my-rv' },
  },
  {
    emoji: '🤝',
    icon: <Users className="w-8 h-8" />,
    title: 'Connect with the Community',
    description: 'Find friends, join groups, follow campgrounds, and engage with posts in your Feed. See what fellow RVers are up to and share your own adventures.',
    tip: 'Your activity feed shows posts from friends and campgrounds you follow.',
    color: '#1e3a5f',
    accentColor: '#38bdf8',
    setupAction: { label: 'Find Friends', href: '/friends' },
  },
  {
    emoji: '📸',
    icon: <Camera className="w-8 h-8" />,
    title: 'Albums, Recipes & More',
    description: 'Create photo albums from your trips, share camp recipes with the community, browse gear in the marketplace, build packing lists, and discover Creator Pages for RV content.',
    tip: 'Albums can be shared publicly or kept private — you control who sees your memories.',
    color: '#500724',
    accentColor: '#f472b6',
    setupAction: { label: 'Create an Album', href: '/albums' },
  },
  {
    emoji: '🏆',
    icon: <Award className="w-8 h-8" />,
    title: 'Earn Badges',
    description: 'RVUnicorn rewards your adventures with badges — for joining, planning trips, visiting campgrounds, sharing recipes, and much more. Campgrounds can also award their own exclusive badges.',
    tip: 'Hitch will message you every time you earn a badge and explain what you did to get it!',
    color: '#3b1f0a',
    accentColor: '#f59e0b',
    setupAction: { label: 'View Your Badges', href: '/badges' },
  },
  {
    emoji: '🦄',
    icon: <Sparkles className="w-8 h-8" />,
    title: 'Meet Hitch, Your Trail Guide',
    description: 'Hitch is your AI-powered camping companion. Ask for campground recommendations, route ideas, gear advice, recipe inspiration, or help planning your next adventure.',
    tip: 'Hitch learns your preferences over time and gets smarter the more you use RVUnicorn.',
    color: '#1a1f2e',
    accentColor: '#f59e0b',
    setupAction: { label: 'Chat with Hitch', href: '/basecamp' },
  },
];

interface BasecampTourProps {
  firstName?: string;
  onComplete: () => void;
}

export default function BasecampTour({ firstName, onComplete }: BasecampTourProps) {
  const [step, setStep] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [entering, setEntering] = useState(false);

  const current = TOUR_STEPS[step];
  const isFirst = step === 0;
  const isLast = step === TOUR_STEPS.length - 1;
  const progress = ((step + 1) / TOUR_STEPS.length) * 100;

  const handleClose = async () => {
    try { await api.put('/auth/update-contact', { tourCompleted: true }).catch(() => {}); } catch {}
    onComplete();
  };

  const goTo = (next: number) => {
    setExiting(true);
    setTimeout(() => {
      setStep(next);
      setExiting(false);
      setEntering(true);
      setTimeout(() => setEntering(false), 300);
    }, 200);
  };

  const handleNext = () => { if (isLast) { handleClose(); } else { goTo(step + 1); } };
  const handlePrev = () => { if (!isFirst) goTo(step - 1); };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}>

      <div className="w-full max-w-lg relative"
        style={{
          animation: 'tourIn 0.35s cubic-bezier(0.34,1.56,0.64,1)',
          opacity: exiting ? 0 : 1,
          transform: exiting ? 'translateY(12px) scale(0.97)' : 'translateY(0) scale(1)',
          transition: 'opacity 0.2s, transform 0.2s',
        }}>

        {/* Card */}
        <div className="rounded-3xl overflow-hidden shadow-2xl"
          style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.08)' }}>

          {/* Colorful header */}
          <div className="relative px-8 pt-8 pb-6 overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${current.color} 0%, ${current.color}dd 100%)` }}>

            {/* Decorative circles */}
            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-10"
              style={{ background: current.accentColor }} />
            <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full opacity-10"
              style={{ background: current.accentColor }} />

            {/* Close button */}
            <button onClick={handleClose}
              className="absolute top-4 right-4 p-2 rounded-xl transition-all"
              style={{ color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.1)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)') as any}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)') as any}
            >
              <X className="w-4 h-4" />
            </button>

            {/* Step indicator */}
            <div className="flex items-center gap-1 mb-4">
              {TOUR_STEPS.map((_, i) => (
                <button key={i} onClick={() => goTo(i)}
                  className="h-1.5 rounded-full transition-all duration-300"
                  style={{
                    width: i === step ? '24px' : '6px',
                    background: i === step ? current.accentColor : 'rgba(255,255,255,0.3)',
                  }} />
              ))}
            </div>

            {/* Emoji + Icon */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}>
                {current.emoji}
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-1"
                  style={{ color: current.accentColor }}>
                  Step {step + 1} of {TOUR_STEPS.length}
                </p>
                <h2 className="text-xl font-black text-white leading-tight"
                  style={{ letterSpacing: '-0.02em' }}>
                  {isFirst && firstName ? `Hey ${firstName}! ` : ''}{current.title}
                </h2>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="px-8 py-6">
            <p className="text-gray-700 leading-relaxed text-[15px]">{current.description}</p>

            {current.tip && (
              <div className="mt-4 flex gap-3 p-3.5 rounded-xl"
                style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
                <span className="text-lg flex-shrink-0">💡</span>
                <p className="text-sm text-amber-800 leading-snug">{current.tip}</p>
              </div>
            )}

            {current.setupAction && (
              <a href={current.setupAction.href}
                onClick={handleClose}
                className="inline-flex items-center gap-2 mt-4 text-sm font-semibold transition-all"
                style={{ color: current.color }}>
                <Zap className="w-4 h-4" />
                {current.setupAction.label} →
              </a>
            )}
          </div>

          {/* Footer */}
          <div className="px-8 pb-6 flex items-center justify-between gap-4">
            <button onClick={handlePrev} disabled={isFirst}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-30"
              style={{ color: '#64748b', background: '#f1f5f9' }}
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>

            <button onClick={handleClose}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
              Skip tour
            </button>

            <button onClick={handleNext}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-black text-white transition-all"
              style={{ background: `linear-gradient(135deg, ${current.color}, ${current.accentColor})`, boxShadow: `0 4px 16px ${current.accentColor}44` }}
            >
              {isLast ? '🎉 Let\'s Go!' : 'Next'}
              {!isLast && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>

          {/* Progress bar */}
          <div className="h-1 w-full" style={{ background: '#f1f5f9' }}>
            <div className="h-full transition-all duration-500 rounded-full"
              style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${current.color}, ${current.accentColor})` }} />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes tourIn {
          from { opacity: 0; transform: translateY(24px) scale(0.94); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

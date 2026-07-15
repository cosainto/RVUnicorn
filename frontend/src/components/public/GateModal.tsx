import { Link } from 'react-router-dom';
import { X } from 'lucide-react';

const HEADLINES: Record<string, (ctx: Record<string, string>) => string> = {
  like_post:      (ctx) => `Like ${ctx.targetName || 'this'}'s photo — join to show some love`,
  comment:        () => 'Join to comment on this trip',
  save_trip:      (ctx) => `Save ${ctx.destination || 'this trip'} to your trip list`,
  follow_user:    (ctx) => `Follow ${ctx.targetName || 'this RVer'}'s adventures`,
  view_full_trip: (ctx) => `Plan your own trip to ${ctx.destination || 'this destination'} with Hitch — free to join`,
  view_match:     (ctx) => `See your personal match score for ${ctx.campgroundName || 'this campground'}`,
  vote_thread:    () => 'Join the conversation on RVUnicorn',
  reply:          () => 'Join to reply to this thread',
  check_in:       () => 'Check in and join the campfire — free to join',
  follow_campground: () => 'Follow this campground for updates',
  default:        () => 'Join RVUnicorn to unlock this feature',
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  trigger: string;
  context?: Record<string, string>;
}

export default function GateModal({ isOpen, onClose, trigger, context = {} }: Props) {
  if (!isOpen) return null;

  const getHeadline = HEADLINES[trigger] || HEADLINES.default;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[480px] rounded-[20px] p-6 sm:p-8 text-center"
        style={{ background: '#162236', border: '1px solid #243552' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button onClick={onClose} className="absolute top-4 right-4 p-1 transition" style={{ color: '#8B9BB4' }}>
          <X className="w-5 h-5" />
        </button>

        {/* Logo */}
        <div className="flex justify-center mb-4">
          <img src="/images/logo-icon-v2.png" alt="RVUnicorn" className="w-12 h-12 rounded-full" />
        </div>

        {/* Headline */}
        <h2 className="text-xl font-bold mb-2" style={{ fontFamily: "'Playfair Display', serif", color: '#F5F0E8' }}>
          {getHeadline(context)}
        </h2>

        {/* Subtext */}
        <p className="text-sm mb-6" style={{ color: '#8B9BB4' }}>
          Free to join · Takes 2 minutes · Thousands of RVers already here
        </p>

        {/* CTAs */}
        <div className="space-y-3">
          <Link
            to="/register"
            className="block w-full py-3 rounded-xl text-base font-bold transition hover:brightness-110"
            style={{ background: '#E8A838', color: '#0F1C35' }}
          >
            Create Free Account
          </Link>
          <Link
            to="/login"
            className="block w-full py-3 rounded-xl text-sm font-semibold transition hover:brightness-110"
            style={{ border: '1px solid #E8A838', color: '#E8A838' }}
          >
            Sign In
          </Link>
        </div>

        {/* Footer */}
        <p className="text-xs mt-4" style={{ color: 'rgba(139,155,180,0.6)' }}>
          No credit card required. Cancel anytime.
        </p>
      </div>
    </div>
  );
}

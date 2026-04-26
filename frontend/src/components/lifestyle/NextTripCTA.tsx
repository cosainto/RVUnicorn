import { Link } from 'react-router-dom';

interface Props { cn: Record<string, string>; }

export default function NextTripCTA({ cn }: Props) {
  return (
    <div
      className="rounded-2xl p-6 text-center relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${cn.card} 0%, ${cn.cardAlt} 100%)`,
        border: `1px solid ${cn.border}`,
        boxShadow: `0 -8px 32px ${cn.orange}10`,
      }}
    >
      {/* Subtle glow at bottom */}
      <div
        className="absolute bottom-0 left-0 right-0 h-1"
        style={{ background: `linear-gradient(90deg, ${cn.orange}, ${cn.gold}, ${cn.orange})` }}
      />

      <h2
        className="text-2xl md:text-3xl font-bold mb-2"
        style={{ fontFamily: "'Playfair Display', serif", color: cn.cream }}
      >
        Where are you headed next?
      </h2>
      <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: cn.muted }}>
        Hitch can help you plan it — campgrounds, route, weather, and rig fit in one conversation.
      </p>

      <div className="flex flex-wrap justify-center gap-3">
        <Link
          to="/events-v2/create"
          className="px-6 py-3 rounded-xl text-sm font-bold transition hover:brightness-110"
          style={{ background: cn.gold, color: cn.bg }}
        >
          Start Planning →
        </Link>
        <Link
          to="/hitch"
          className="px-6 py-3 rounded-xl text-sm font-semibold transition hover:brightness-110"
          style={{ border: `1px solid ${cn.gold}`, color: cn.gold }}
        >
          Ask Hitch
        </Link>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Star, Edit, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import RatingForm from './RatingForm';

const CN = { bg: '#0F1C35', card: '#162236', cardAlt: '#1A2B45', gold: '#E8A838', cream: '#F5F0E8', muted: '#8B9BB4', border: '#243552', orange: '#D4621A' };

interface Rating {
  rating: number;
  review?: string | null;
  visitDate?: string | null;
  noise?: string | null;
  levelness?: string | null;
  cellService?: string | null;
  bigRigFriendly?: string | null;
  wouldReturn?: string | null;
}

interface Props {
  campgroundId: string;
  campgroundName: string;
  profileUserId: string;
  profileFirstName: string;
  profileUsername: string;
  existingRating: Rating | null;
  isOwner: boolean;
  onRatingSaved: () => void;
}

function StarDisplay({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className="w-3.5 h-3.5"
          style={{ color: i <= value ? CN.gold : CN.border, fill: i <= value ? CN.gold : 'none' }}
        />
      ))}
      <span className="text-xs font-bold ml-1" style={{ color: CN.gold }}>{value.toFixed(1)}</span>
    </div>
  );
}

export default function CampgroundRatingCard({
  campgroundId, campgroundName, profileUserId, profileFirstName, profileUsername,
  existingRating, isOwner, onRatingSaved,
}: Props) {
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(existingRating);

  const handleSaved = () => {
    setShowForm(false);
    onRatingSaved(); // parent refreshes data
  };

  // STATE A — Owner, no rating
  if (isOwner && !rating && !showForm) {
    return (
      <div className="mt-2 rounded-lg p-3" style={{ border: `1px dashed ${CN.orange}40`, background: `${CN.orange}08` }}>
        <p className="text-[11px] mb-2" style={{ color: CN.muted }}>
          You haven't rated {campgroundName} yet
        </p>
        <button
          onClick={() => setShowForm(true)}
          className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition hover:brightness-110"
          style={{ background: CN.gold, color: CN.bg }}
        >
          Rate This Campground
        </button>
      </div>
    );
  }

  // Rating form (inline expand)
  if (showForm) {
    return (
      <RatingForm
        campgroundId={campgroundId}
        campgroundName={campgroundName}
        existingRating={rating}
        onSaved={handleSaved}
        onCancel={() => setShowForm(false)}
      />
    );
  }

  // STATE B — Owner, has rating
  if (isOwner && rating) {
    return (
      <div className="mt-2 rounded-lg p-3" style={{ background: CN.cardAlt, border: `1px solid ${CN.border}` }}>
        <div className="flex items-center justify-between mb-1">
          <StarDisplay value={rating.rating} />
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 text-[10px] transition hover:brightness-110"
            style={{ color: CN.gold }}
          >
            <Edit className="w-3 h-3" /> Edit
          </button>
        </div>
        {rating.review && (
          <p className="text-[11px] line-clamp-2 mt-1" style={{ color: CN.cream }}>{rating.review}</p>
        )}
        {rating.visitDate && (
          <p className="text-[10px] mt-1" style={{ color: CN.muted }}>
            Visited {new Date(rating.visitDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </p>
        )}
      </div>
    );
  }

  // STATE C — Visitor, owner has rating
  if (!isOwner && rating) {
    return (
      <div className="mt-2 rounded-lg p-3" style={{ background: CN.cardAlt, border: `1px solid ${CN.border}` }}>
        <p className="text-[10px] mb-1" style={{ color: CN.muted }}>{profileFirstName}'s Rating</p>
        <StarDisplay value={rating.rating} />
        {rating.review && (
          <p className="text-[11px] line-clamp-2 mt-1" style={{ color: CN.cream }}>{rating.review}</p>
        )}
        {rating.visitDate && (
          <p className="text-[10px] mt-1" style={{ color: CN.muted }}>
            Visited {new Date(rating.visitDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </p>
        )}
        <Link
          to={`/messages?to=${profileUsername}&subject=${encodeURIComponent(`About ${campgroundName}`)}&body=${encodeURIComponent(`Hey ${profileFirstName}! I saw you visited ${campgroundName} on RVUnicorn — I'm thinking of going and would love to hear what you thought. Any tips?`)}`}
          className="flex items-center gap-1 text-[10px] mt-2 transition hover:brightness-110"
          style={{ color: CN.gold }}
        >
          <MessageCircle className="w-3 h-3" /> Ask {profileFirstName} about their visit
        </Link>
      </div>
    );
  }

  // STATE D — Visitor, no rating
  return (
    <div className="mt-2 rounded-lg p-2" style={{ background: `${CN.border}40` }}>
      <p className="text-[10px]" style={{ color: CN.muted }}>
        {profileFirstName} hasn't rated this campground yet.
      </p>
      <Link
        to={`/messages?to=${profileUsername}&subject=${encodeURIComponent(`About ${campgroundName}`)}&body=${encodeURIComponent(`Hey ${profileFirstName}! I saw you visited ${campgroundName} — what was it like?`)}`}
        className="text-[10px] mt-1 inline-block transition hover:brightness-110"
        style={{ color: CN.gold }}
      >
        Ask {profileFirstName} for their thoughts →
      </Link>
    </div>
  );
}

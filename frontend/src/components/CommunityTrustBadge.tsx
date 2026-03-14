import { useState, useEffect } from 'react';
import api from '../services/api';

interface Props {
  userId: string;
  compact?: boolean;
}

const LEVEL_COLORS: Record<string, string> = {
  'Expert Camper': 'bg-amber-100 text-amber-800 border-amber-300',
  'Experienced Camper': 'bg-green-100 text-green-800 border-green-300',
  'Regular Camper': 'bg-blue-100 text-blue-800 border-blue-300',
  'New Camper': 'bg-gray-100 text-gray-600 border-gray-200',
  'Beginner': 'bg-gray-50 text-gray-500 border-gray-200',
};

const LEVEL_ICONS: Record<string, string> = {
  'Expert Camper': '🏆',
  'Experienced Camper': '⭐',
  'Regular Camper': '🏕️',
  'New Camper': '🌱',
  'Beginner': '🔰',
};

export default function CommunityTrustBadge({ userId, compact = false }: Props) {
  const [trust, setTrust] = useState<any>(null);

  useEffect(() => {
    api.get(`/hitch/trust-score/${userId}`)
      .then(r => setTrust(r.data))
      .catch(() => {});
  }, [userId]);

  if (!trust) return null;

  if (compact) return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${LEVEL_COLORS[trust.level] || LEVEL_COLORS['Beginner']}`}>
      {LEVEL_ICONS[trust.level]} {trust.level}
    </span>
  );

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold ${LEVEL_COLORS[trust.level] || LEVEL_COLORS['Beginner']}`}>
      <span className="text-lg">{LEVEL_ICONS[trust.level]}</span>
      <div>
        <p className="font-bold">{trust.level}</p>
        <p className="text-xs font-normal opacity-70">{trust.score}/100 trust score · {trust.reviewCount} reviews · {trust.verifiedStays} stays</p>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp, Check } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';

const CAMPING_INTERESTS = [
  { value: 'hiking', label: '🥾 Hiking & Trails' },
  { value: 'fishing', label: '🎣 Fishing & Water' },
  { value: 'history', label: '🏛️ History & Culture' },
  { value: 'wildlife', label: '🦌 Wildlife & Nature' },
  { value: 'food', label: '🍽️ Food & Dining' },
  { value: 'photography', label: '📷 Photography' },
  { value: 'kids', label: '👧 Kids Activities' },
  { value: 'dogs', label: '🐾 Dog Friendly' },
  { value: 'sports', label: '🏟️ Sporting Events' },
  { value: 'music', label: '🎵 Music & Live Entertainment' },
  { value: 'themeparks', label: '🎢 Theme Parks & Attractions' },
  { value: 'breweries', label: '🍷 Wineries, Breweries & Distilleries' },
  { value: 'shopping', label: '🛍️ Shopping & Local Markets' },
  { value: 'watersports', label: '🏄 Kayaking & Water Sports' },
  { value: 'climbing', label: '🪨 Rock Climbing & Bouldering' },
  { value: 'stargazing', label: '🌌 Stargazing & Astronomy' },
  { value: 'scenicdrives', label: '🛤️ Scenic Drives & Overlooks' },
  { value: 'spas', label: '🧖 Spas & Hot Springs' },
  { value: 'atv', label: '🚵 ATV & Off-Roading' },
  { value: 'golf', label: '⛳ Golf' },
  { value: 'pickleball', label: '🏓 Pickleball' },
  { value: 'tennis', label: '🎾 Tennis' },
  { value: 'swimming', label: '🏊 Swimming & Beaches' },
  { value: 'biking', label: '🚴 Biking & Cycling' },
  { value: 'skiing', label: '🎿 Skiing & Snow Sports' },
  { value: 'horseback', label: '🏇 Horseback Riding' },
  { value: 'archery', label: '🎯 Archery & Shooting Sports' },
  { value: 'bowling', label: '🎳 Bowling & Mini Golf' },
  { value: 'casino', label: '🃏 Casinos & Gaming' },
];

interface Props {
  username: string;
  initialInterests?: string[];
  onUpdate?: (interests: string[]) => void;
}

export default function CampingInterestsWidget({ username, initialInterests = [], onUpdate }: Props) {
  const [selected, setSelected] = useState<string[]>(initialInterests);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggle = (value: string) => {
    setSelected(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/profile/${username}`, { campingInterests: selected });
      setSaved(true);
      onUpdate?.(selected);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error('Failed to save interests', e);
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = JSON.stringify([...selected].sort()) !== JSON.stringify([...initialInterests].sort());
  const visibleInterests = expanded ? CAMPING_INTERESTS : CAMPING_INTERESTS.slice(0, 6);

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          <div>
            <h3 className="font-bold text-sm">My Camping Interests</h3>
            <p className="text-violet-200 text-xs mt-0.5">Helps Hitch AI personalize your trip stops & campground picks</p>
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-2 gap-2">
          {visibleInterests.map(({ value, label }) => {
            const isSelected = selected.includes(value);
            return (
              <button
                key={value}
                onClick={() => toggle(value)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all text-left ${
                  isSelected
                    ? 'bg-violet-50 border-violet-400 text-violet-700'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-violet-300 hover:bg-violet-50/50'
                }`}
              >
                <span className="text-base leading-none">{label.split(' ')[0]}</span>
                <span className="truncate text-xs">{label.split(' ').slice(1).join(' ')}</span>
                {isSelected && <Check className="w-3 h-3 ml-auto flex-shrink-0 text-violet-500" />}
              </button>
            );
          })}
        </div>

        {CAMPING_INTERESTS.length > 6 && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-violet-600 mt-2 transition"
          >
            {expanded ? <><ChevronUp className="w-3 h-3" />Show less</> : <><ChevronDown className="w-3 h-3" />+{CAMPING_INTERESTS.length - 6} more</>}
          </button>
        )}

        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {selected.length === 0 ? 'Select what you love' : `${selected.length} selected`}
          </span>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              saved
                ? 'bg-green-100 text-green-700 border border-green-300'
                : hasChanges
                ? 'bg-violet-600 text-white hover:bg-violet-700 shadow-sm'
                : 'bg-gray-100 text-gray-400 cursor-default'
            }`}
          >
            {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { Globe, Users, Lock, UserCheck } from 'lucide-react';

export type VisibilityValue = 'PUBLIC' | 'FRIENDS' | 'SELECT_PEOPLE' | 'PRIVATE';
export type Surface = 'PROFILE' | 'RIG' | 'TRIP' | 'CAMPGROUND';

interface VisibilitySelectorProps {
  value: VisibilityValue;
  onChange: (value: VisibilityValue) => void;
  label?: string;
  compact?: boolean;
}

const visibilityOptions = [
  {
    value: 'PUBLIC' as const,
    label: 'Everyone',
    description: 'Anyone can see this',
    icon: Globe,
  },
  {
    value: 'FRIENDS' as const,
    label: 'Friends',
    description: 'Only your friends can see this',
    icon: Users,
  },
  {
    value: 'SELECT_PEOPLE' as const,
    label: 'Select People',
    description: 'Only people you tag can see this',
    icon: UserCheck,
  },
  {
    value: 'PRIVATE' as const,
    label: 'Only Me',
    description: 'Only you can see this',
    icon: Lock,
  },
];

export const VisibilitySelector: React.FC<VisibilitySelectorProps> = ({
  value,
  onChange,
  label = 'Who can see this?',
  compact = false,
}) => {
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">{label}</span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as VisibilityValue)}
          className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
        >
          {visibilityOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {visibilityOptions.map((option) => {
          const Icon = option.icon;
          const isSelected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`flex flex-col items-center p-2.5 rounded-lg border-2 transition-all ${
                isSelected
                  ? 'border-amber-500 bg-amber-50 text-amber-700'
                  : 'border-gray-200 hover:border-gray-300 text-gray-600'
              }`}
            >
              <Icon className={`w-4 h-4 mb-1 ${isSelected ? 'text-amber-500' : ''}`} />
              <span className="text-xs font-medium">{option.label}</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-gray-500">
        {visibilityOptions.find((o) => o.value === value)?.description}
      </p>
    </div>
  );
};

// Surface selector — where photos appear
interface SurfaceSelectorProps {
  value: Surface[];
  onChange: (value: Surface[]) => void;
}

const surfaceOptions: { id: Surface; label: string; emoji: string }[] = [
  { id: 'RIG', label: 'Rig page', emoji: '🚐' },
  { id: 'TRIP', label: 'Trip album', emoji: '🗺️' },
  { id: 'CAMPGROUND', label: 'Campground', emoji: '🏕️' },
  { id: 'PROFILE', label: 'Profile feed', emoji: '👤' },
];

export const SurfaceSelector: React.FC<SurfaceSelectorProps> = ({ value, onChange }) => {
  const toggle = (surface: Surface) => {
    if (value.includes(surface)) {
      onChange(value.filter(s => s !== surface));
    } else {
      onChange([...value, surface]);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">Show on:</label>
      <div className="flex flex-wrap gap-2">
        {surfaceOptions.map(s => {
          const isOn = value.includes(s.id);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => toggle(s.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                isOn
                  ? 'border-amber-400 bg-amber-50 text-amber-700'
                  : 'border-gray-200 bg-gray-50 text-gray-500'
              }`}
            >
              <span>{s.emoji}</span>
              {s.label}
              {isOn && <span className="text-amber-500 ml-0.5">✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// Inline visibility badge for display
interface VisibilityBadgeProps {
  visibility: string;
  size?: 'sm' | 'md';
}

export const VisibilityBadge: React.FC<VisibilityBadgeProps> = ({ visibility, size = 'sm' }) => {
  const config = visibilityOptions.find((o) => o.value === visibility);
  if (!config) return null;

  const Icon = config.icon;
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1';

  const colorClasses: Record<string, string> = {
    PUBLIC: 'bg-green-100 text-green-700',
    FRIENDS: 'bg-blue-100 text-blue-700',
    SELECT_PEOPLE: 'bg-purple-100 text-purple-700',
    PRIVATE: 'bg-gray-100 text-gray-700',
  };

  return (
    <span className={`inline-flex items-center gap-1 rounded-full ${sizeClasses} ${colorClasses[visibility] || 'bg-gray-100 text-gray-700'}`}>
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
      {config.label}
    </span>
  );
};

export default VisibilitySelector;

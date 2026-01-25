import React from 'react';
import { Globe, Users, Lock } from 'lucide-react';

interface VisibilitySelectorProps {
  value: 'PUBLIC' | 'FRIENDS' | 'PRIVATE';
  onChange: (value: 'PUBLIC' | 'FRIENDS' | 'PRIVATE') => void;
  label?: string;
  compact?: boolean;
}

const visibilityOptions = [
  {
    value: 'PUBLIC' as const,
    label: 'Public',
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
    value: 'PRIVATE' as const,
    label: 'Private',
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
          onChange={(e) => onChange(e.target.value as 'PUBLIC' | 'FRIENDS' | 'PRIVATE')}
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
      <div className="grid grid-cols-3 gap-2">
        {visibilityOptions.map((option) => {
          const Icon = option.icon;
          const isSelected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`flex flex-col items-center p-3 rounded-lg border-2 transition-all ${
                isSelected
                  ? 'border-amber-500 bg-amber-50 text-amber-700'
                  : 'border-gray-200 hover:border-gray-300 text-gray-600'
              }`}
            >
              <Icon className={`w-5 h-5 mb-1 ${isSelected ? 'text-amber-500' : ''}`} />
              <span className="text-sm font-medium">{option.label}</span>
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

// Inline visibility badge for display
interface VisibilityBadgeProps {
  visibility: 'PUBLIC' | 'FRIENDS' | 'PRIVATE';
  size?: 'sm' | 'md';
}

export const VisibilityBadge: React.FC<VisibilityBadgeProps> = ({ visibility, size = 'sm' }) => {
  const config = visibilityOptions.find((o) => o.value === visibility);
  if (!config) return null;

  const Icon = config.icon;
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1';

  const colorClasses = {
    PUBLIC: 'bg-green-100 text-green-700',
    FRIENDS: 'bg-blue-100 text-blue-700',
    PRIVATE: 'bg-gray-100 text-gray-700',
  };

  return (
    <span className={`inline-flex items-center gap-1 rounded-full ${sizeClasses} ${colorClasses[visibility]}`}>
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
      {config.label}
    </span>
  );
};

export default VisibilitySelector;

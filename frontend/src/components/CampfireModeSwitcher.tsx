import { useState } from 'react';
import CampfireChat from './CampfireChat';
import CampfireGroupChat from './CampfireGroupChat';
import CampfireAIChat from './CampfireAIChat';

interface Props {
  campgroundId: string;
  campgroundName: string;
  isUserCheckedIn?: boolean;
}

type CampfireMode = 'public' | 'group' | 'ai';

export default function CampfireModeSwitcher({ campgroundId, campgroundName, isUserCheckedIn = true }: Props) {
  const [mode, setMode] = useState<CampfireMode>('public');

  const tabs: { key: CampfireMode; label: string; emoji: string }[] = [
    { key: 'public', label: 'Campfire', emoji: '🔥' },
    { key: 'group', label: 'Group', emoji: '👥' },
    { key: 'ai', label: 'AI Chat', emoji: '🤖' },
  ];

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
      {/* Mode switcher tabs */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setMode(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition ${
              mode === tab.key
                ? tab.key === 'public' ? 'bg-white text-orange-600 border-b-2 border-orange-500 shadow-sm'
                : tab.key === 'group' ? 'bg-white text-slate-700 border-b-2 border-slate-500 shadow-sm'
                : 'bg-white text-amber-700 border-b-2 border-amber-500 shadow-sm'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <span>{tab.emoji}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active mode content */}
      {mode === 'public' && (
        <CampfireChat campgroundId={campgroundId} campgroundName={campgroundName} isUserCheckedIn={isUserCheckedIn} />
      )}
      {mode === 'group' && (
        <CampfireGroupChat campgroundId={campgroundId} campgroundName={campgroundName} />
      )}
      {mode === 'ai' && (
        <CampfireAIChat campgroundId={campgroundId} campgroundName={campgroundName} />
      )}
    </div>
  );
}

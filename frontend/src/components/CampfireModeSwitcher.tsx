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
    <div>
      {/* Sub-tab switcher — nested inside the main Campfire tab */}
      <div className="flex gap-2 mb-3">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setMode(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
              mode === tab.key
                ? tab.key === 'public' ? 'bg-orange-100 text-orange-700 border border-orange-200'
                : tab.key === 'group' ? 'bg-slate-100 text-slate-700 border border-slate-200'
                : 'bg-amber-100 text-amber-700 border border-amber-200'
                : 'bg-gray-50 text-gray-500 border border-gray-100 hover:bg-gray-100 hover:text-gray-700'
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

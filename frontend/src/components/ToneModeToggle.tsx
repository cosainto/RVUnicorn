import { useState } from 'react';
import api from '../services/api';

const MODES = [
  { id: 'friendly', emoji: '🙂', label: 'Friendly', desc: 'Warm and encouraging' },
  { id: 'spicy', emoji: '🔥', label: 'Spicy', desc: 'Banter and trash talk' },
  { id: 'master', emoji: '🤓', label: 'Trivia Master', desc: 'Neutral and educational' },
];

interface Props {
  campgroundId: string;
  currentTone?: string;
  isHost?: boolean;
}

export default function ToneModeToggle({ campgroundId, currentTone = 'friendly', isHost = false }: Props) {
  const [tone, setTone] = useState(currentTone);
  const [saving, setSaving] = useState(false);

  const changeTone = async (newTone: string) => {
    if (!isHost || saving) return;
    setSaving(true);
    try {
      await api.post(`/campfire-phase4/tone/${campgroundId}`, { tone: newTone });
      setTone(newTone);
    } catch { alert('Must be checked in to change tone'); }
    finally { setSaving(false); }
  };

  const current = MODES.find(m => m.id === tone) || MODES[0];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-semibold text-gray-700">Vibe Mode</span>
        <span className="text-lg">{current.emoji}</span>
        <span className="text-xs text-gray-500">{current.label}</span>
        {!isHost && <span className="text-xs text-gray-400 ml-auto">Host controls this</span>}
      </div>
      {isHost && (
        <div className="flex gap-2">
          {MODES.map(m => (
            <button key={m.id} onClick={() => changeTone(m.id)} disabled={saving}
              title={m.desc}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${tone === m.id ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-orange-100'}`}>
              {m.emoji} {m.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

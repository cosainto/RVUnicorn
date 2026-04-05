import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ChevronRight, Check } from 'lucide-react';
import api from '../services/api';

interface NudgeStatus {
  dismissed: boolean; rigCompleted: boolean; homeBaseCompleted: boolean;
  checkinCompleted: boolean; completedCount: number;
}

export default function NudgeCard() {
  const [status, setStatus] = useState<NudgeStatus | null>(null);
  const [hiding, setHiding] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/onboarding/nudge-status').then(r => setStatus(r.data)).catch(() => {});
  }, []);

  if (!status || status.dismissed) return null;

  const items = [
    { key: 'rig', label: 'Add your rig details', sub: 'Show off your home on wheels', done: status.rigCompleted, dest: '/my-rv' },
    { key: 'homebase', label: 'Set your home base', sub: 'Tell us where you\'re from', done: status.homeBaseCompleted, dest: '/settings' },
    { key: 'checkin', label: 'Make your first check-in', sub: 'Find a campground and check in', done: status.checkinCompleted, dest: '/campgrounds' },
  ];

  const completedCount = items.filter(i => i.done).length;
  const allDone = completedCount === 3;

  const handleDismiss = async () => {
    setHiding(true);
    await api.patch('/onboarding/nudge-dismiss').catch(() => {});
    setTimeout(() => setStatus(s => s ? { ...s, dismissed: true } : s), 250);
  };

  // Auto-dismiss when all complete
  useEffect(() => {
    if (allDone) { setTimeout(handleDismiss, 2000); }
  }, [allDone]);

  const subtitleText = completedCount === 0 ? '3 quick things to get you started' : completedCount === 1 ? '2 things left' : completedCount === 2 ? '1 thing left' : 'All done! \u{1F389}';

  return (
    <div className="max-w-[680px] mx-auto transition-all duration-300" style={{ opacity: hiding ? 0 : 1, transform: hiding ? 'translateY(-8px)' : 'translateY(0)' }}>
      <div className="rounded-[14px] p-5" style={{ background: '#1B2E50', border: '1px solid rgba(232,168,56,0.2)' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-lg" style={{ background: 'rgba(232,168,56,0.1)' }}>{'\u{1F525}'}</div>
            <div>
              <p className="text-[14px] font-semibold" style={{ color: '#F5F0E8' }}>Get the most out of RVUnicorn</p>
              <p className="text-[12px] transition-all" style={{ color: 'rgba(245,240,232,0.4)' }}>{subtitleText}</p>
            </div>
          </div>
          <button onClick={handleDismiss} className="w-7 h-7 flex items-center justify-center rounded hover:opacity-60 transition" style={{ color: 'rgba(245,240,232,0.3)' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="h-px mb-3" style={{ background: 'rgba(255,255,255,0.06)' }} />

        {/* Checklist */}
        <div className="space-y-1">
          {items.map(item => (
            <div key={item.key}
              onClick={() => !item.done && navigate(item.dest)}
              className="flex items-center gap-3 px-2 py-2 rounded-lg transition"
              style={{ cursor: item.done ? 'default' : 'pointer', minHeight: '52px', background: 'transparent' }}
              onMouseEnter={e => { if (!item.done) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}>
              {/* Checkbox */}
              <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all" style={{
                background: item.done ? '#E8A838' : 'transparent',
                border: item.done ? 'none' : '1.5px solid rgba(232,168,56,0.3)',
              }}>
                {item.done && <Check className="w-3.5 h-3.5 text-white" />}
              </div>
              {/* Label */}
              <div className="flex-1 min-w-0">
                <p className="text-[14px]" style={{ color: item.done ? 'rgba(245,240,232,0.35)' : '#F5F0E8', textDecoration: item.done ? 'line-through' : 'none' }}>{item.label}</p>
                {!item.done && <p className="text-[12px]" style={{ color: 'rgba(245,240,232,0.4)' }}>{item.sub}</p>}
              </div>
              {/* Chevron */}
              {!item.done && <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'rgba(232,168,56,0.4)' }} />}
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(completedCount / 3) * 100}%`, background: allDone ? '#2ECC71' : '#E8A838' }} />
          </div>
          <span className="text-[11px] flex-shrink-0" style={{ color: 'rgba(245,240,232,0.35)' }}>{completedCount} of 3 complete</span>
        </div>
      </div>
    </div>
  );
}

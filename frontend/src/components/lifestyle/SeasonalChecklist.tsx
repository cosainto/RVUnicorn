import { Wrench } from 'lucide-react';

interface Props { cn: Record<string, string>; }

const SEASONAL_TIPS: Record<string, string> = {
  '0':  'Rig in storage? Check battery tender connection and tire pressure this week.',
  '1':  'Rig in storage? Check battery tender connection and tire pressure this week.',
  '2':  'Spring is 3 weeks out. Time to start your de-winterization checklist.',
  '3':  'First trip season. Has your water system been flushed since winterization?',
  '4':  'First trip season. Has your water system been flushed since winterization?',
  '5':  'Summer heat: check AC filter and roof seals before your next trip.',
  '6':  'Summer heat: check AC filter and roof seals before your next trip.',
  '7':  'Summer heat: check AC filter and roof seals before your next trip.',
  '8':  'Fall is prime season. Awning, slide seals, leveling jacks — quick walkthrough this weekend.',
  '9':  'Winterization window opens soon. Freeze dates in your area avg late October.',
  '10': 'Rig stored for winter? Anti-freeze in water lines, propane off, battery disconnected.',
  '11': 'Rig stored for winter? Anti-freeze in water lines, propane off, battery disconnected.',
};

export default function SeasonalChecklist({ cn }: Props) {
  const month = new Date().getMonth();
  const tip = SEASONAL_TIPS[String(month)];

  return (
    <div className="rounded-2xl p-5" style={{ background: cn.card, border: `1px solid ${cn.border}` }}>
      <div className="flex items-start gap-3">
        <Wrench className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: cn.gold, opacity: 0.7 }} />
        <div className="flex-1">
          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: cn.muted }}>Seasonal Tip</p>
          <p className="text-sm leading-relaxed" style={{ color: cn.cream }}>{tip}</p>
          <button
            onClick={() => {
              // Could integrate with maintenance log or packing list
              // For now, just acknowledge
            }}
            className="mt-3 px-3 py-1.5 rounded-lg text-xs font-semibold transition hover:brightness-110"
            style={{ border: `1px solid ${cn.border}`, color: cn.muted }}
          >
            Add to my checklist
          </button>
        </div>
      </div>
    </div>
  );
}

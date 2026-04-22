import { Shield, Sofa, MapPin, Shuffle } from 'lucide-react';

interface SubScores {
  safety: number;
  comfort: number;
  convenience: number;
  flexibility: number;
}

interface Props {
  subScores: SubScores;
  compact?: boolean;
}

const scoreConfig = [
  { key: 'safety' as const, label: 'Safety', icon: Shield, color: { high: '#22c55e', mid: '#f59e0b', low: '#ef4444' } },
  { key: 'comfort' as const, label: 'Comfort', icon: Sofa, color: { high: '#22c55e', mid: '#f59e0b', low: '#ef4444' } },
  { key: 'convenience' as const, label: 'Convenience', icon: MapPin, color: { high: '#22c55e', mid: '#f59e0b', low: '#ef4444' } },
  { key: 'flexibility' as const, label: 'Flexibility', icon: Shuffle, color: { high: '#22c55e', mid: '#f59e0b', low: '#ef4444' } },
];

function getColor(score: number, config: typeof scoreConfig[0]['color']) {
  if (score >= 80) return config.high;
  if (score >= 50) return config.mid;
  return config.low;
}

export default function SubScoreGauges({ subScores, compact }: Props) {
  return (
    <div className={`grid grid-cols-4 ${compact ? 'gap-2' : 'gap-3'}`}>
      {scoreConfig.map(({ key, label, icon: Icon, color }) => {
        const score = subScores[key];
        const barColor = getColor(score, color);
        const circumference = compact ? 100 : 138;
        const radius = compact ? 16 : 22;
        const strokeWidth = compact ? 3 : 4;
        const size = compact ? 40 : 56;
        const offset = circumference - (score / 100) * circumference;

        return (
          <div key={key} className={`flex flex-col items-center ${compact ? 'gap-0.5' : 'gap-1'}`}>
            <div className="relative" style={{ width: size, height: size }}>
              <svg width={size} height={size} className="-rotate-90">
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke="#1e293b"
                  strokeWidth={strokeWidth}
                />
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={barColor}
                  strokeWidth={strokeWidth}
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <Icon size={compact ? 12 : 16} style={{ color: barColor }} />
              </div>
            </div>
            <span className={`text-white font-bold ${compact ? 'text-xs' : 'text-sm'}`}>{score}</span>
            <span className={`text-slate-400 ${compact ? 'text-[10px]' : 'text-xs'}`}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

import { LucideIcon } from 'lucide-react';

interface Props {
  icon: string;
  title: string;
  description: string;
  ctaLabel?: string;
  onCta?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  tips?: string[];
}

export default function TripTabEmptyState({ icon, title, description, ctaLabel, onCta, secondaryLabel, onSecondary, tips }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="text-6xl mb-4">{icon}</div>
      <h3 className="text-xl font-bold text-gray-800 mb-2">{title}</h3>
      <p className="text-gray-500 max-w-sm mb-6">{description}</p>
      {tips && tips.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 max-w-sm w-full text-left">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">💡 Pro Tips</p>
          <ul className="space-y-1">
            {tips.map((tip, i) => (
              <li key={i} className="text-sm text-amber-800 flex items-start gap-2">
                <span className="mt-0.5">•</span>{tip}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex gap-3 flex-wrap justify-center">
        {ctaLabel && onCta && (
          <button onClick={onCta} className="px-5 py-2.5 bg-primary-600 text-white rounded-full font-semibold text-sm hover:bg-primary-700 transition shadow-sm">
            {ctaLabel}
          </button>
        )}
        {secondaryLabel && onSecondary && (
          <button onClick={onSecondary} className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-full font-semibold text-sm hover:bg-gray-200 transition">
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  );
}

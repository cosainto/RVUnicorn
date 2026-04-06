import { useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';

const HITCH_IMG = 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261116/rvunicorn/characters/hitch.png';

interface Props { trigger: string; message: string; campgroundId: string; }

export default function UpsellNudge({ trigger, message, campgroundId }: Props) {
  const [dismissed, setDismissed] = useState(() => {
    const stored = localStorage.getItem(`upsell_${trigger}_${campgroundId}`);
    return stored ? Date.now() < parseInt(stored) : false;
  });

  if (dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(`upsell_${trigger}_${campgroundId}`, String(Date.now() + 7 * 86400000));
    setDismissed(true);
  };

  return (
    <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: '#1B2E50', border: '1px solid rgba(232,168,56,0.15)' }}>
      <img src={HITCH_IMG} alt="Hitch" className="w-8 h-8 rounded-full object-cover flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-[13px] leading-relaxed mb-3" style={{ color: '#F5F0E8' }}>{message}</p>
        <Link to={`/business/${campgroundId}/upgrade`} className="inline-block px-4 py-2 rounded-lg text-[12px] font-bold" style={{ background: '#E8622A', color: 'white' }}>Upgrade</Link>
      </div>
      <button onClick={handleDismiss} className="flex-shrink-0 hover:opacity-60"><X className="w-4 h-4" style={{ color: 'rgba(245,240,232,0.2)' }} /></button>
    </div>
  );
}

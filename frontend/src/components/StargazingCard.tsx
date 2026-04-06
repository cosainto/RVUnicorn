import { useState } from 'react';
import api from '../services/api';

interface Props {
  content: string;
  metadata: {
    imageUrl: string;
    walterImage?: string;
    campgroundName: string;
    moonPhase: string;
    date: string;
  };
  onOptOut?: () => void;
}

export default function StargazingCard({ content, metadata, onOptOut }: Props) {
  const [optedOut, setOptedOut] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleOptOut = async () => {
    try {
      await api.post('/checkins/stargazing/toggle');
      setOptedOut(true);
      onOptOut?.();
    } catch {}
  };

  if (optedOut) return null;

  const lines = content.split('\n').filter(Boolean);
  const title = lines[0];
  const body = lines.slice(1).join('\n').trim();
  const isLong = body.length > 200;
  const displayBody = expanded || !isLong ? body : body.slice(0, 200) + '…';

  return (
    <div className="rounded-xl overflow-hidden border border-indigo-800/40" style={{
      background: 'linear-gradient(135deg, #0f0c29, #1a1a3e, #0d1b3e)',
    }}>
      {/* Star image — compact */}
      <div className="relative h-24">
        <img
          src={metadata.imageUrl}
          alt="Stargazing"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f0c29] via-transparent to-transparent" />
        <div className="absolute bottom-2 left-3">
          <span className="text-lg">{metadata.moonPhase?.split(' ')[0]}</span>
        </div>
      </div>

      {/* Content */}
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-1.5 mb-1.5">
          {metadata.walterImage
            ? <img src={metadata.walterImage} className="w-4 h-4 rounded-full object-cover flex-shrink-0" alt="Walter" />
            : <div className="w-4 h-4 rounded-full bg-gray-700 flex items-center justify-center text-[10px]">🎭</div>
          }
          <span className="text-indigo-300 text-[10px] font-semibold">Walter · Stargazing Guide</span>
          <span className="text-indigo-600 text-[10px] ml-auto">{new Date(metadata.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
        </div>

        <h3 className="text-white font-bold text-xs mb-1">{title}</h3>
        <p className="text-indigo-200 text-[11px] leading-snug whitespace-pre-line">{displayBody}</p>
        {isLong && (
          <button onClick={() => setExpanded(!expanded)} className="text-indigo-400 hover:text-indigo-300 text-[10px] font-medium mt-1 transition">
            {expanded ? 'Show less' : 'Read more'}
          </button>
        )}

        <div className="mt-2 pt-2 border-t border-indigo-800/40 flex items-center justify-between">
          <span className="text-indigo-400 text-[10px]">{metadata.moonPhase}</span>
          {!showConfirm ? (
            <button
              onClick={() => setShowConfirm(true)}
              className="text-indigo-600 hover:text-indigo-400 text-[10px] transition"
            >
              Stop updates
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-indigo-400 text-[10px]">Stop updates?</span>
              <button onClick={handleOptOut} className="text-red-400 hover:text-red-300 text-[10px] font-medium transition">Yes</button>
              <button onClick={() => setShowConfirm(false)} className="text-indigo-400 hover:text-indigo-300 text-[10px] transition">No</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

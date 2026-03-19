import { useState } from 'react';
import api from '../services/api';

interface Props {
  content: string;
  metadata: {
    imageUrl: string;
    campgroundName: string;
    moonPhase: string;
    date: string;
  };
  onOptOut?: () => void;
}

export default function StargazingCard({ content, metadata, onOptOut }: Props) {
  const [optedOut, setOptedOut] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

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

  return (
    <div className="rounded-2xl overflow-hidden border border-indigo-800/40" style={{
      background: 'linear-gradient(135deg, #0f0c29, #1a1a3e, #0d1b3e)',
    }}>
      {/* Star image */}
      <div className="relative">
        <img
          src={metadata.imageUrl}
          alt="Stargazing"
          className="w-full object-cover"
          style={{ maxHeight: '200px' }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f0c29] via-transparent to-transparent" />
        <div className="absolute bottom-3 left-4">
          <span className="text-2xl">{metadata.moonPhase?.split(' ')[0]}</span>
        </div>
        <div className="absolute top-3 right-3">
          <span className="bg-indigo-900/70 backdrop-blur-sm text-indigo-200 text-xs px-2.5 py-1 rounded-full border border-indigo-700/50">
            🌟 Tonight's Sky
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-sm">🦄</div>
          <span className="text-indigo-300 text-xs font-semibold">Hitch · Stargazing Guide</span>
          <span className="text-indigo-600 text-xs ml-auto">{new Date(metadata.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
        </div>

        <h3 className="text-white font-bold text-sm mb-2">{title}</h3>
        <p className="text-indigo-200 text-sm leading-relaxed">{body}</p>

        <div className="mt-3 pt-3 border-t border-indigo-800/40 flex items-center justify-between">
          <span className="text-indigo-400 text-xs">{metadata.moonPhase}</span>
          {!showConfirm ? (
            <button
              onClick={() => setShowConfirm(true)}
              className="text-indigo-600 hover:text-indigo-400 text-xs transition"
            >
              Stop updates
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-indigo-400 text-xs">Stop stargazing updates?</span>
              <button onClick={handleOptOut} className="text-red-400 hover:text-red-300 text-xs font-medium transition">Yes</button>
              <button onClick={() => setShowConfirm(false)} className="text-indigo-400 hover:text-indigo-300 text-xs transition">No</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

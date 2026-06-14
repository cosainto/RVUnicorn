import { useState } from 'react';
import { X } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  stopId: string;
  stopName: string;
  onClose: () => void;
  onSubmitted?: () => void;
}

const FLAG_OPTIONS = [
  { key: 'flagRVFriendly', label: 'RV-friendly confirmed', emoji: '\u2705' },
  { key: 'flagFeltSafe', label: 'Felt safe', emoji: '\u2705' },
  { key: 'flagBigRigOK', label: 'Big rig OK', emoji: '\u2705' },
  { key: 'flagQuietNight', label: 'Quiet night', emoji: '\u2705' },
  { key: 'flagGoodSignal', label: 'Good cell signal', emoji: '\u2705' },
  { key: 'flagTightLot', label: 'Tight lot', emoji: '\u26A0\uFE0F' },
  { key: 'flagPolicyUnclear', label: 'Policy unclear', emoji: '\u26A0\uFE0F' },
  { key: 'flagHasShowers', label: 'Has showers', emoji: '\u{1F6BF}' },
  { key: 'flagHasElectric', label: 'Electric available', emoji: '\u{1F50C}' },
  { key: 'flagHasDump', label: 'Dump station', emoji: '\u{1F5D1}\uFE0F' },
  { key: 'flagWellLit', label: 'Well-lit overnight', emoji: '\u{1F4A1}' },
  { key: 'flagPetFriendly', label: 'Pet-friendly lot', emoji: '\u{1F436}' },
  { key: 'flagAteInside', label: 'Ate/shopped inside', emoji: '\u{1F37D}\uFE0F' },
];

export default function OvernightFeedbackModal({ stopId, stopName, onClose, onSubmitted }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [maxRigLength, setMaxRigLength] = useState('');
  const [tip, setTip] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const toggleFlag = (key: string) => {
    setFlags(prev => {
      const next = { ...prev };
      if (next[key]) delete next[key]; else next[key] = true;
      return next;
    });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload: any = {
        date: new Date().toISOString(),
        nights: 1,
        tip: tip || null,
        maxRigLengthReported: maxRigLength ? parseInt(maxRigLength) : null,
      };
      for (const opt of FLAG_OPTIONS) {
        payload[opt.key] = flags[opt.key] ?? null;
      }
      await api.post(`/overnight-stops/${stopId}/visits`, payload);
      setSubmitted(true);
      setStep(3);
      onSubmitted?.();
    } catch {
      alert('Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div>
            <h2 className="font-bold text-gray-900">
              {step === 3 ? 'Thanks!' : `How was ${stopName}?`}
            </h2>
            {step < 3 && <p className="text-xs text-gray-500">Step {step} of 2</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5">
          {step === 1 && (
            <>
              <p className="text-sm text-gray-600 mb-4">Tap all that apply — helps other RVers!</p>
              <div className="grid grid-cols-2 gap-2">
                {FLAG_OPTIONS.map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => toggleFlag(opt.key)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium border transition ${
                      flags[opt.key]
                        ? 'border-amber-400 bg-amber-50 text-amber-800'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <span>{opt.emoji}</span>
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setStep(2)}
                className="w-full mt-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition"
              >
                Next {'\u2192'}
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Max rig length that fit (ft)</label>
                  <input
                    type="number"
                    value={maxRigLength}
                    onChange={e => setMaxRigLength(e.target.value)}
                    placeholder={user?.rvLength ? String(user.rvLength) : '35'}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Quick tip for other RVers (optional)</label>
                  <textarea
                    value={tip}
                    onChange={e => setTip(e.target.value)}
                    placeholder="Park near the back — quieter and more room to maneuver..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={() => setStep(1)} className="px-4 py-2.5 border border-gray-200 text-gray-600 font-semibold rounded-xl">
                  {'\u2190'} Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold rounded-xl transition"
                >
                  {submitting ? 'Submitting...' : 'Submit Feedback'}
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <div className="text-center py-6">
              <span className="text-4xl block mb-3">{'\u{1F319}'}</span>
              <p className="font-bold text-gray-900 mb-1">Thanks for your feedback!</p>
              <p className="text-sm text-gray-500">Your report helps other RVers who are planning to stop here.</p>
              <button onClick={onClose} className="mt-4 px-6 py-2 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition">
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

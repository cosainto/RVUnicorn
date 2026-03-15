import { useState } from 'react';
import { Flame, Send, Share2 } from 'lucide-react';
import api from '../services/api';
import { getGuide } from '../config/hitchGuides';

interface CampfireMessage {
  guideId: string;
  content: string;
}

interface CampfireResult {
  discussion: CampfireMessage[];
  takeaway: string;
  question: string;
}

interface AskTheCampfireProps {
  campgroundId: string;
  campgroundName: string;
}

const CAMPFIRE_PROMPTS = [
  'Is this a good campground for a big rig?',
  "What\"s the vibe like here?",
  'Is this worth the trip?',
  'What should I know before arriving?',
  'Good for families with kids?',
  'Best time of year to visit?',
];

export default function AskTheCampfire({ campgroundId, campgroundName }: AskTheCampfireProps) {
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<CampfireResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const ask = async (q?: string) => {
    const finalQ = q || question;
    if (!finalQ.trim() || loading) return;
    setQuestion(finalQ);
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const { data } = await api.post('/hitch/campfire', { question: finalQ, campgroundId, campgroundName });
      setResult(data);
    } catch {
      setError('Failed to start the campfire. Try again!');
    } finally {
      setLoading(false);
    }
  };

  const shareResult = () => {
    if (!result) return;
    const text = `🔥 Ask the Campfire about ${campgroundName}:

Q: ${result.question}

${result.discussion.map(m => `${getGuide(m.guideId).emoji} ${getGuide(m.guideId).name}: "${m.content}"`).join("

')}

🏕️ Campfire Takeaway: ${result.takeaway}

via RVUnicorn`;
    navigator.share?.({ text }) || navigator.clipboard?.writeText(text);
  };

  return (
    <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl border border-orange-200 overflow-hidden">
      <div className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Flame className="w-5 h-5 text-orange-500" />
          <h3 className="font-bold text-gray-900">Ask the Campfire</h3>
          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Multi-guide discussion</span>
        </div>
        <p className="text-xs text-gray-500 mb-4">Get a campfire conversation from multiple guides — then a clear takeaway.</p>

        {/* Quick prompts */}
        {!result && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {CAMPFIRE_PROMPTS.map(p => (
              <button key={p} onClick={() => ask(p)}
                className="text-xs bg-white border border-orange-200 text-orange-700 px-2.5 py-1 rounded-full hover:bg-orange-50 transition">
                {p}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="flex gap-2">
          <input value={question} onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && ask()}
            placeholder={`Ask the campfire about ${campgroundName}...`}
            className="flex-1 text-sm border border-orange-200 bg-white rounded-xl px-3 py-2 focus:outline-none focus:border-orange-400" />
          <button onClick={() => ask()} disabled={loading || !question.trim()}
            className="px-3 py-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600 disabled:opacity-40 transition">
            <Send className="w-4 h-4" />
          </button>
        </div>

        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="px-5 pb-5">
          <div className="flex items-center gap-2 text-sm text-orange-600">
            <Flame className="w-4 h-4 animate-pulse" />
            <span>Gathering the guides around the campfire...</span>
          </div>
          <div className="mt-3 space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-14 bg-orange-100 rounded-xl animate-pulse" />)}
          </div>
        </div>
      )}

      {/* Result */}
      {result && !loading && (
        <div className="border-t border-orange-200 px-5 pb-5 pt-4 space-y-3">
          <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide">🔥 Around the campfire...</p>

          {result.discussion.map((msg, i) => {
            const guide = getGuide(msg.guideId);
            return (
              <div key={i} className="flex gap-3">
                <div className={`w-8 h-8 shrink-0 rounded-full bg-gradient-to-br ${guide.bgGradient} flex items-center justify-center text-sm`}>
                  {guide.avatarUrl
                    ? <img src={guide.avatarUrl} alt={guide.name} className="w-full h-full rounded-full object-cover" />
                    : guide.emoji
                  }
                </div>
                <div className="flex-1 bg-white rounded-xl p-3 text-xs leading-relaxed">
                  <span className="font-bold text-gray-800">{guide.name}: </span>
                  <span className="text-gray-700">{msg.content}</span>
                </div>
              </div>
            );
          })}

          {/* Campfire Takeaway */}
          <div className="bg-orange-500 rounded-xl p-4 text-white">
            <p className="text-xs font-bold uppercase tracking-wide mb-1.5">🏕️ Campfire Takeaway</p>
            <p className="text-sm leading-relaxed">{result.takeaway}</p>
          </div>

          <div className="flex items-center justify-between">
            <button onClick={shareResult}
              className="flex items-center gap-1.5 text-xs text-orange-600 hover:text-orange-800 transition font-medium">
              <Share2 className="w-3.5 h-3.5" /> Share this campfire
            </button>
            <button onClick={() => { setResult(null); setQuestion(''); }}
              className="text-xs text-gray-400 hover:text-gray-600 transition">Ask another →</button>
          </div>
        </div>
      )}
    </div>
  );
}

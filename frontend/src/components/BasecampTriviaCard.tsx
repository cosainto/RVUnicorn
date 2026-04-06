import { useEffect, useState, useCallback } from 'react';
import { Trophy, CheckCircle, XCircle, Bell, BellOff, Clock } from 'lucide-react';
import api from '../services/api';

interface TriviaQuestion {
  questionId: string;
  questionNum: number;
  total: number;
  question: string;
  options: { A: string; B: string; C: string; D: string };
  hostCharacter?: string;
  category: string;
  askedAt: string;
}

interface TriviaStats {
  totalAsked: number;
  answered: number;
  correct: number;
  points: number;
  theme: string;
  hostCharacter: string;
}

interface NextSession {
  startsAt: string;
  label: string;
  isActive: boolean;
}

const CHARACTER_IMAGES: Record<string, string> = {
  hitch: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1774218289/rvunicorn/guides/hitch_guide.png',
  wallet: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1774218458/rvunicorn/guides/wallet_guide.png',
  walter: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1773538549/rvunicorn/guides/walter_guide.png',
  rose: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1773538550/rvunicorn/guides/rose_guide.png',
  scout: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1773538551/rvunicorn/guides/scout_guide.png',
  diesel: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1773538552/rvunicorn/guides/diesel_guide.png',
  luna: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1773538554/rvunicorn/guides/luna_guide.png',
};

interface Props {
  campgroundId: string;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Now!';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function BasecampTriviaCard({ campgroundId }: Props) {
  const [question, setQuestion] = useState<TriviaQuestion | null>(null);
  const [stats, setStats] = useState<TriviaStats | null>(null);
  const [nextSession, setNextSession] = useState<NextSession | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<{ isCorrect: boolean; points: number; correctAnswer: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifyMe, setNotifyMe] = useState(() => localStorage.getItem('trivia_notify') === '1');
  const [countdown, setCountdown] = useState('');

  const fetchTrivia = useCallback(async () => {
    try {
      const { data } = await api.get(`/campfire/${campgroundId}/current-trivia`);
      setQuestion(data.question);
      setStats(data.stats);
      setNextSession(data.nextSession);
    } catch {} finally {
      setLoading(false);
    }
  }, [campgroundId]);

  useEffect(() => {
    fetchTrivia();
    const interval = setInterval(fetchTrivia, 15000);
    return () => clearInterval(interval);
  }, [fetchTrivia]);

  // Countdown timer — ticks every second
  useEffect(() => {
    if (!nextSession || nextSession.isActive) { setCountdown(''); return; }
    const tick = () => {
      const ms = new Date(nextSession.startsAt).getTime() - Date.now();
      setCountdown(formatCountdown(ms));

      // Trigger browser notification 3 minutes before if opted in
      if (notifyMe && ms > 0 && ms <= 180000 && ms > 179000) {
        if (Notification.permission === 'granted') {
          new Notification('🎯 Campfire Trivia starting in 3 minutes!', {
            body: `${nextSession.label} session is almost here. Get ready!`,
            icon: '/images/Logo_RVUnicorn.png',
          });
        }
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [nextSession, notifyMe]);

  const toggleNotify = () => {
    if (!notifyMe && Notification.permission === 'default') {
      Notification.requestPermission().then(p => {
        if (p === 'granted') {
          setNotifyMe(true);
          localStorage.setItem('trivia_notify', '1');
        }
      });
    } else {
      const next = !notifyMe;
      setNotifyMe(next);
      localStorage.setItem('trivia_notify', next ? '1' : '0');
    }
  };

  const submitAnswer = async (answer: string) => {
    if (!question || selected) return;
    setSelected(answer);
    try {
      const { data } = await api.post(`/campfire/${campgroundId}/answer`, {
        questionId: question.questionId,
        answer,
        answeredAt: new Date().toISOString(),
      });
      if (data.isCorrect !== undefined) setResult(data);
      setTimeout(() => {
        setSelected(null);
        setResult(null);
        fetchTrivia();
      }, 3000);
    } catch (e) {
      console.error('Answer error:', e);
    }
  };

  if (loading) return null;
  if (!stats && !nextSession) return null;

  const host = stats?.hostCharacter || 'hitch';
  const hostImg = CHARACTER_IMAGES[host];
  const hasActiveSession = nextSession?.isActive;

  return (
    <div className="bg-white rounded-xl border border-purple-200 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-purple-100 bg-gradient-to-r from-purple-50 to-indigo-50 flex items-center gap-2">
        {hostImg ? (
          <img src={hostImg} className="w-6 h-6 rounded-full object-cover border border-purple-200" alt={host} />
        ) : (
          <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center text-white text-[10px] font-bold">
            {host[0].toUpperCase()}
          </div>
        )}
        <span className="font-bold text-xs text-purple-900">Campfire Trivia</span>
        {stats?.theme && <span className="text-[10px] text-purple-400 truncate">{stats.theme}</span>}
        {stats && (
          <div className="ml-auto flex items-center gap-1.5">
            <Trophy className="w-3 h-3 text-amber-500" />
            <span className="text-[11px] font-bold text-amber-600">{stats.points} pts</span>
          </div>
        )}
      </div>

      {/* Progress bar — only when session has started */}
      {stats && stats.totalAsked > 0 && (
        <div className="px-3 pt-2 pb-1">
          <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
            <span>{stats.answered}/{stats.totalAsked} answered</span>
            <span>{stats.correct} correct</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all"
              style={{ width: `${stats.totalAsked > 0 ? (stats.answered / stats.totalAsked) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Active question */}
      {question ? (
        <div className="px-3 py-2">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-1.5 py-0.5 rounded">
              Q{question.questionNum}/{question.total}
            </span>
            <span className="text-[10px] text-gray-400">{question.category}</span>
          </div>
          <p className="text-xs font-medium text-gray-800 mb-2 leading-relaxed">{question.question}</p>
          <div className="grid grid-cols-1 gap-1.5">
            {(Object.entries(question.options) as [string, string][]).map(([key, val]) => {
              const isSelected = selected === key;
              const isCorrect = result?.correctAnswer === key;
              const isWrong = isSelected && result && !result.isCorrect;
              let cls = 'w-full text-left px-3 py-2 rounded-lg border text-[11px] font-medium transition flex items-center gap-2 ';
              if (!selected) cls += 'border-gray-200 bg-gray-50 hover:bg-purple-500 hover:text-white hover:border-purple-500 cursor-pointer';
              else if (!result) cls += isSelected ? 'bg-purple-500 border-purple-600 text-white' : 'border-gray-100 bg-gray-50 text-gray-300';
              else if (isCorrect) cls += 'bg-green-500 border-green-600 text-white';
              else if (isWrong) cls += 'bg-red-500 border-red-600 text-white';
              else cls += 'border-gray-100 bg-gray-50 text-gray-300';
              return (
                <button key={key} onClick={() => submitAnswer(key)} disabled={!!selected} className={cls}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                    !selected ? 'bg-gray-200 text-gray-600' : isCorrect ? 'bg-white/30 text-white' : isWrong ? 'bg-white/30 text-white' : 'bg-gray-100 text-gray-400'
                  }`}>{key}</span>
                  <span className="flex-1 truncate">{val}</span>
                  {isCorrect && <CheckCircle className="w-4 h-4 flex-shrink-0" />}
                  {isWrong && <XCircle className="w-4 h-4 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
          {result && (
            <div className={`mt-2 px-2.5 py-1.5 rounded-lg text-center text-[11px] font-semibold ${
              result.isCorrect ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {result.isCorrect ? `Correct! +${result.points} pts` : `Answer: ${result.correctAnswer}`}
            </div>
          )}
        </div>

      /* All caught up — answered everything this session */
      ) : stats && stats.totalAsked > 0 && hasActiveSession ? (
        <div className="px-3 py-4 text-center">
          <div className="text-2xl mb-1">🎉</div>
          <p className="text-xs font-bold text-gray-800">All caught up!</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{stats.correct}/{stats.answered} correct · {stats.points} pts</p>
        </div>

      /* Countdown to next session */
      ) : (
        <div className="px-3 py-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-purple-400" />
            <p className="text-xs font-bold text-purple-900">
              {nextSession ? `${nextSession.label} Session` : 'Next Session'}
            </p>
          </div>
          {countdown && (
            <div className="text-center mb-3">
              <span className="text-2xl font-bold text-purple-700 font-mono">{countdown}</span>
            </div>
          )}
          <p className="text-[10px] text-gray-400 text-center mb-3">
            Sessions: 7:30 AM · 12:25 PM · 5:30 PM CT
          </p>
          <button
            onClick={toggleNotify}
            className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition ${
              notifyMe
                ? 'bg-purple-100 text-purple-700 border border-purple-200'
                : 'bg-purple-600 text-white hover:bg-purple-700'
            }`}
          >
            {notifyMe ? (
              <><BellOff className="w-3.5 h-3.5" /> Notifications On — Tap to Turn Off</>
            ) : (
              <><Bell className="w-3.5 h-3.5" /> Notify Me 3 Min Before</>
            )}
          </button>
          {stats && stats.points > 0 && (
            <p className="text-[10px] text-amber-600 text-center mt-2 font-medium">
              🏆 {stats.points} pts this week · {stats.correct} correct
            </p>
          )}
        </div>
      )}
    </div>
  );
}

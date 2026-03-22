import { useEffect, useState, useCallback } from 'react';

interface TriviaQuestion {
  questionId: string;
  questionNum: number;
  total: number;
  question: string;
  options: { A: string; B: string; C: string; D: string };
  category: string;
  timeLimit: number;
  askedAt: string;
}

interface LeaderboardEntry {
  rank: number;
  name: string;
  points: number;
  correct: number;
}

interface Winner {
  name: string;
  points: number;
  character: string;
  message: string;
}

interface Props {
  socket: any;
  userId: string;
  campgroundId: string;
}

const OPTION_COLORS = {
  A: 'bg-blue-500 hover:bg-blue-600 border-blue-600',
  B: 'bg-green-500 hover:bg-green-600 border-green-600',
  C: 'bg-amber-500 hover:bg-amber-600 border-amber-600',
  D: 'bg-rose-500 hover:bg-rose-600 border-rose-600',
};

const RESULT_COLORS = {
  correct: 'bg-green-500 border-green-600',
  wrong: 'bg-red-500 border-red-600',
  neutral: '',
};

export default function CampfireTriviaOverlay({ socket, userId, campgroundId }: Props) {
  const [question, setQuestion] = useState<TriviaQuestion | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<{ isCorrect: boolean; points: number; correctAnswer: string } | null>(null);
  const [timeLeft, setTimeLeft] = useState(120);
  const [leaderboard, setLeaderboard] = useState<{ board: LeaderboardEntry[]; isFinal: boolean } | null>(null);
  const [winner, setWinner] = useState<Winner | null>(null);
  const [comeback, setComeback] = useState<string | null>(null);
  const [redemptionMsg, setRedemptionMsg] = useState<string | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // Listen for trivia events
  useEffect(() => {
    if (!socket) return;

    socket.on('trivia:question', (q: TriviaQuestion) => {
      setQuestion(q);
      setSelected(null);
      setResult(null);
      setLeaderboard(null);
      setShowLeaderboard(false);
      setWinner(null);
      const elapsed = Math.floor((Date.now() - new Date(q.askedAt).getTime()) / 1000);
      setTimeLeft(Math.max(0, q.timeLimit - elapsed));
    });

    socket.on('trivia:answer:result', (r: any) => {
      setResult(r);
      // Auto-clear after 5 seconds so next question can appear
      setTimeout(() => {
        setQuestion(null);
        setSelected(null);
        setResult(null);
      }, 5000);
    });

    socket.on('trivia:leaderboard', (data: any) => {
      setLeaderboard(data);
      setShowLeaderboard(true);
      setQuestion(null);
      setTimeout(() => setShowLeaderboard(false), 15000);
    });

    socket.on('trivia:redemption', (data: any) => {
      setRedemptionMsg(data.message);
      setTimeout(() => setRedemptionMsg(null), 8000);
    });

    socket.on('trivia:winner', (w: Winner) => {
      setWinner(w);
      setShowLeaderboard(false);
      setQuestion(null);
    });

    return () => {
      socket.off('trivia:question');
      socket.off('trivia:redemption');
      socket.off('trivia:answer:result');
      socket.off('trivia:leaderboard');
      socket.off('trivia:winner');
    };
  }, [socket]);

  // Poll for active question every 5 seconds as WebSocket fallback
  useEffect(() => {
    if (!campgroundId) return;
    const poll = async () => {
      // Only poll if no question is currently showing
      if (question) return;
      try {
        const token = localStorage.getItem('token') || localStorage.getItem('authToken') || '';
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        const API = (import.meta as any).env?.VITE_API_URL || '';
        const res = await fetch(`${API}/api/campfire/${campgroundId}/active-question`, { headers });
        const data = await res.json();
        if (data.question) {
        // If question has expired, don't show it
        const elapsedSec = Math.floor((Date.now() - new Date(data.question.askedAt).getTime()) / 1000);
        if (elapsedSec >= data.question.timeLimit) return;
          setQuestion(data.question);
          setSelected(null);
          setResult(null);
          setLeaderboard(null);
          setShowLeaderboard(false);
          setWinner(null);
          const elapsed = Math.floor((Date.now() - new Date(data.question.askedAt).getTime()) / 1000);
          setTimeLeft(Math.max(0, data.question.timeLimit - elapsed));
        }
      } catch (e) {
        // silent
      }
    };
    poll(); // immediate check
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [campgroundId, question]);

  // Countdown timer
  // Auto-clear question when timer hits 0
  useEffect(() => {
    if (timeLeft === 0 && question && !result) {
      setTimeout(() => {
        setQuestion(null);
        setSelected(null);
        setResult(null);
      }, 3000);
    }
  }, [timeLeft, question, result]);

  useEffect(() => {
    if (!question || selected || timeLeft <= 0) return;
    const t = setInterval(() => setTimeLeft(s => {
      if (s <= 1) { clearInterval(t); return 0; }
      return s - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [question, selected, timeLeft]);

  const submitAnswer = useCallback((answer: string) => {
    if (!question || selected || !socket) return;
    setSelected(answer);
    socket.emit('trivia:answer', {
      questionId: question.questionId,
      answer,
      answeredAt: new Date().toISOString(),
    });
  }, [question, selected, socket]);

  const timeLimit = question?.timeLimit || 30;
  const timerPct = (timeLeft / timeLimit) * 100;
  const timerColor = timerPct > 60 ? 'bg-green-500' : timerPct > 30 ? 'bg-amber-500' : 'bg-red-500';

  // ── Winner announcement ──────────────────────────────────────
  if (winner) {
    return (
      <div className="rounded-2xl border-2 border-amber-400 bg-gradient-to-br from-amber-50 to-orange-50 p-5 text-center animate-pulse-once">
        <div className="text-4xl mb-2">🏆</div>
        <div className="font-bold text-lg text-gray-800 mb-1">Campfire Champion</div>
        <div className="text-2xl font-bold text-amber-600 mb-3">{winner.name}</div>
        <div className="text-sm text-gray-600 italic leading-relaxed bg-white/60 rounded-xl px-4 py-3">
          "{winner.message}"
        </div>
        <div className="text-xs text-gray-400 mt-3">{winner.points} points this week</div>
        <button onClick={() => setWinner(null)} className="mt-3 text-xs text-gray-400 hover:text-gray-600">Dismiss</button>
      </div>
    );
  }

  // ── Daily leaderboard ────────────────────────────────────────
  if (showLeaderboard && leaderboard) {
    const medals = ['🥇','🥈','🥉','4️⃣','5️⃣'];
    return (
      <div className="rounded-2xl border border-orange-200 bg-white p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">📊</span>
          <div className="font-semibold text-gray-800">{leaderboard.isFinal ? 'Final Weekly Standings' : "Today's Leaderboard"}</div>
        </div>
        <div className="space-y-2">
          {leaderboard.board.map((entry, i) => (
            <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-xl ${i === 0 ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'}`}>
              <div className="flex items-center gap-2">
                <span className="text-lg">{medals[i]}</span>
                <span className="font-medium text-gray-800 text-sm">{entry.name}</span>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-orange-600">{entry.points} pts</div>
                <div className="text-xs text-gray-400">{entry.correct} correct</div>
              </div>
            </div>
          ))}
        </div>
        {leaderboard.isFinal && (
          <div className="text-xs text-center text-gray-400 mt-3">Winner announced at 6:05 PM 🏆</div>
        )}
        <button onClick={() => setShowLeaderboard(false)} className="w-full mt-3 text-xs text-gray-400 hover:text-gray-600">Dismiss</button>
      </div>
    );
  }

  // ── Active question ──────────────────────────────────────────
  if (!question) return null;

  return (
    <div className="rounded-2xl border-2 border-purple-200 bg-white overflow-hidden">
      {/* Redemption message */}
      {redemptionMsg && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-center">
          <p className="text-white text-xs font-semibold animate-pulse">{redemptionMsg}</p>
        </div>
      )}

      {/* Last two questions banner */}
      {question && question.questionNum >= 9 && (
        <div className="bg-gradient-to-r from-red-600 to-orange-600 px-4 py-1.5 text-center">
          <p className="text-white text-xs font-bold">🔥 DOUBLE POINTS — Q{question.questionNum}/10 — COMEBACK TIME!</p>
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-white text-sm">🎯</span>
            <span className="text-white text-sm font-semibold">Question {question.questionNum}/{question.total}</span>
            <span className="text-purple-200 text-xs bg-purple-700/50 px-2 py-0.5 rounded-full">{question.category}</span>
          </div>
          <div className={`text-white font-mono font-bold text-sm px-2 py-0.5 rounded-lg ${timeLeft <= 30 ? 'bg-red-500 animate-pulse' : 'bg-purple-700/50'}`}>
            {timeLeft}s
          </div>
        </div>
        {/* Timer bar */}
        <div className="h-1.5 bg-purple-800/50 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-1000 ${timerColor}`} style={{ width: `${timerPct}%` }} />
        </div>
      </div>

      {/* Question */}
      <div className="px-4 pt-4 pb-2">
        <p className="text-gray-800 font-medium text-sm leading-relaxed">{question.question}</p>
      </div>

      {/* Options */}
      <div className="px-4 pb-4 grid grid-cols-1 gap-2">
        {(Object.entries(question.options) as [string, string][]).map(([key, val]) => {
          const isSelected = selected === key;
          const isCorrect = result?.correctAnswer === key;
          const isWrong = isSelected && result && !result.isCorrect;

          let btnClass = `w-full text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition flex items-center gap-3 `;

          if (!selected) {
            btnClass += `border-gray-200 bg-gray-50 hover:${OPTION_COLORS[key as keyof typeof OPTION_COLORS]} hover:text-white cursor-pointer`;
          } else if (isCorrect && result) {
            btnClass += `bg-green-500 border-green-600 text-white`;
          } else if (isWrong) {
            btnClass += `bg-red-500 border-red-600 text-white`;
          } else {
            btnClass += `border-gray-100 bg-gray-50 text-gray-400 cursor-default`;
          }

          return (
            <button key={key} onClick={() => submitAnswer(key)} disabled={!!selected || timeLeft === 0} className={btnClass}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${!selected ? 'bg-gray-200 text-gray-600' : isCorrect && result ? 'bg-white/30 text-white' : isWrong ? 'bg-white/30 text-white' : 'bg-gray-200 text-gray-400'}`}>{key}</span>
              <span className="flex-1">{val}</span>
            </button>
          );
        })}
      </div>

      {/* Result feedback */}
      {result && (
        <div className={`mx-4 mb-4 px-4 py-3 rounded-xl text-center text-sm font-semibold ${result.isCorrect ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {result.isCorrect
            ? `✅ Correct! +${result.points} points ${result.points > 10 ? '⚡ Speed bonus!' : ''}`
            : `❌ The answer was ${result.correctAnswer}`
          }
        </div>
      )}

      {/* Timed out */}
      {timeLeft === 0 && !selected && (
        <div className="mx-4 mb-4 px-4 py-3 rounded-xl text-center text-sm text-gray-500 bg-gray-50 border border-gray-200">
          ⏰ Time's up!
        </div>
      )}
    </div>
  );
}

import { useEffect, useState, useCallback, useRef } from 'react';

interface TriviaQuestion {
  questionId: string;
  questionNum: number;
  total: number;
  question: string;
  options: { A: string; B: string; C: string; D: string };
  category: string;
  timeLimit: number;
  hostCharacter?: string;
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


const CHARACTER_IMAGES: Record<string, string> = {
  hitch: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1774218289/rvunicorn/guides/hitch_guide.png',
  wallet: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1774218458/rvunicorn/guides/wallet_guide.png',
  walter: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1773538549/rvunicorn/guides/walter_guide.png',
  rose: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1773538550/rvunicorn/guides/rose_guide.png',
  scout: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1773538551/rvunicorn/guides/scout_guide.png',
  diesel: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1773538552/rvunicorn/guides/diesel_guide.png',
  luna: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1773538554/rvunicorn/guides/luna_guide.png',
};

export default function CampfireTriviaOverlay({ socket, userId, campgroundId }: Props) {
  const [question, setQuestion] = useState<TriviaQuestion | null>(null);
  const [teaserQuestion, setTeaserQuestion] = useState<TriviaQuestion | null>(null); // held until user taps
  const [selected, setSelected] = useState<string | null>(null);
  const [pendingResult, setPendingResult] = useState<{ isCorrect: boolean; points: number; correctAnswer: string } | null>(null);
  const [result, setResult] = useState<{ isCorrect: boolean; points: number; correctAnswer: string } | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [postQuestionMsg, setPostQuestionMsg] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<{ board: LeaderboardEntry[]; isFinal: boolean } | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [winner, setWinner] = useState<Winner | null>(null);
  const [redemptionMsg, setRedemptionMsg] = useState<string | null>(null);

  // Use refs to avoid stale closures
  const questionRef = useRef<TriviaQuestion | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerExpiredRef = useRef(false);

  const API = (import.meta as any).env?.VITE_API_URL || '';
  const getToken = () => localStorage.getItem('token') || localStorage.getItem('authToken') || '';

  const clearQuestion = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    timerExpiredRef.current = false;
    questionRef.current = null;
    setQuestion(null);
    setTeaserQuestion(null);
    setSelected(null);
    setResult(null);
    setPendingResult(null);
    setPostQuestionMsg(null);
    setTimeLeft(30);
  }, []);

  // Opens the full question card and starts the timer
  const openQuestion = useCallback((q: TriviaQuestion) => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerExpiredRef.current = false;
    questionRef.current = q;

    const elapsed = Math.floor((Date.now() - new Date(q.askedAt).getTime()) / 1000);
    const remaining = Math.max(0, q.timeLimit - elapsed);

    setTeaserQuestion(null);
    setQuestion(q);
    setSelected(null);
    setResult(null);
    setPendingResult(null);
    setPostQuestionMsg(null);
    setTimeLeft(remaining);

    if (remaining <= 0) return;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Receives question from socket/poll — shows teaser first, not the full card
  const loadQuestion = useCallback((q: TriviaQuestion) => {
    if (questionRef.current?.questionId === q.questionId) return;
    // If already open (user tapped) don't re-tease
    if (question?.questionId === q.questionId) return;
    setTeaserQuestion(q);
  }, [question]);

  // When timer hits 0, reveal result and fetch trash talk
  useEffect(() => {
    if (timeLeft !== 0 || !question || timerExpiredRef.current) return;
    timerExpiredRef.current = true;

    // Reveal pending result
    if (pendingResult) setResult(pendingResult);

    // Fetch results and post trash talk
    const run = async () => {
      try {
        await new Promise(r => setTimeout(r, 1500)); // wait for answers
        const res = await fetch(`${API}/api/campfire/${campgroundId}/question-results/${question.questionId}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const data = await res.json();

        const correctNames = (data.correct || []).map((a: any) => a.user?.firstName).filter(Boolean).slice(0, 3);
        const wrongNames = (data.wrong || []).map((a: any) => a.user?.firstName).filter(Boolean).slice(0, 2);

        let msg = '';
        if (!data.total || data.total === 0) {
          msg = '🌵 Crickets... nobody answered that one!';
        } else if (!data.correct?.length) {
          msg = `😂 Nobody got that right! The answer was ${data.correctAnswer}.`;
        } else if (!data.wrong?.length) {
          msg = `🔥 Everyone got it right! Genius campers around this fire 🏕️`;
        } else {
          const opts = [
            `✅ ${correctNames.join(', ')} nailed it! ${wrongNames.length ? `Meanwhile ${wrongNames.join(' & ')} are still thinking... 😅` : ''}`,
            `🎯 Nice work ${correctNames.join(', ')}! ${wrongNames.length ? `${wrongNames.join(' & ')} — so close! 😬` : ''}`,
            `🔥 ${correctNames.join(', ')} with the right answer! ${wrongNames.length ? `${wrongNames.join(' & ')} will get the next one 💪` : ''}`,
          ];
          msg = opts[Math.floor(Math.random() * opts.length)];
        }

        setPostQuestionMsg(msg);

        // Post to chat
        await fetch(`${API}/api/campfire/${campgroundId}/chat-message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({ content: msg }),
        }).catch(() => {});

      } catch (e) {
        console.error('Results error:', e);
      }

      setTimeout(clearQuestion, 3000);
    };

    run();
  }, [timeLeft, question, pendingResult, campgroundId, clearQuestion]);

  // Socket events
  useEffect(() => {
    if (!socket) return;
    socket.on('trivia:question', loadQuestion);
    socket.on('trivia:sponsored-question', loadQuestion);
    socket.on('trivia:leaderboard', (data: any) => {
      setLeaderboard(data);
      setShowLeaderboard(true);
      clearQuestion();
      setTimeout(() => setShowLeaderboard(false), 15000);
    });
    socket.on('trivia:winner', (w: Winner) => { setWinner(w); clearQuestion(); });
    socket.on('trivia:redemption', (data: any) => {
      setRedemptionMsg(data.message);
      setTimeout(() => setRedemptionMsg(null), 8000);
    });
    return () => {
      socket.off('trivia:question');
      socket.off('trivia:sponsored-question');
      socket.off('trivia:leaderboard');
      socket.off('trivia:winner');
      socket.off('trivia:redemption');
    };
  }, [socket, loadQuestion, clearQuestion]);

  // Polling fallback
  useEffect(() => {
    if (!campgroundId) return;
    const poll = async () => {
      if (questionRef.current) return; // question already showing
      try {
        const res = await fetch(`${API}/api/campfire/${campgroundId}/active-question`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const data = await res.json();
        if (data.question) {
          const elapsedSec = Math.floor((Date.now() - new Date(data.question.askedAt).getTime()) / 1000);
          if (elapsedSec < data.question.timeLimit + 10) {
            loadQuestion(data.question);
          }
        }
      } catch (e) { /* silent */ }
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [campgroundId, loadQuestion]);

  // Cleanup on unmount
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const submitAnswer = useCallback(async (answer: string) => {
    if (!questionRef.current || selected) return;
    setSelected(answer);
    try {
      const res = await fetch(`${API}/api/campfire/${campgroundId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ questionId: questionRef.current.questionId, answer, answeredAt: new Date().toISOString() }),
      });
      const data = await res.json();
      if (data.isCorrect !== undefined) setPendingResult(data);
    } catch (e) { console.error('Answer error:', e); }
  }, [selected, campgroundId]);

  const timeLimit = question?.timeLimit || 30;
  const timerPct = (timeLeft / timeLimit) * 100;
  const timerColor = timerPct > 60 ? 'bg-green-500' : timerPct > 30 ? 'bg-amber-500' : 'bg-red-500';

  if (winner) return (
    <div className="rounded-2xl border-2 border-amber-400 bg-gradient-to-br from-amber-50 to-orange-50 p-5 text-center">
      <div className="text-4xl mb-2">🏆</div>
      <div className="font-bold text-lg text-gray-800 mb-1">Campfire Champion</div>
      <div className="text-2xl font-bold text-amber-600 mb-3">{winner.name}</div>
      <div className="text-sm text-gray-600 italic bg-white/60 rounded-xl px-4 py-3">"{winner.message}"</div>
      <div className="text-xs text-gray-400 mt-3">{winner.points} points this week</div>
      <button onClick={() => setWinner(null)} className="mt-3 text-xs text-gray-400 hover:text-gray-600">Dismiss</button>
    </div>
  );

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
        <button onClick={() => setShowLeaderboard(false)} className="w-full mt-3 text-xs text-gray-400 hover:text-gray-600">Dismiss</button>
      </div>
    );
  }

  // Teaser banner — shown when question arrives but user hasn't tapped yet
  if (!question && teaserQuestion) {
    const elapsed = Math.floor((Date.now() - new Date(teaserQuestion.askedAt).getTime()) / 1000);
    const remaining = Math.max(0, teaserQuestion.timeLimit - elapsed);
    if (remaining <= 0) return null; // expired before they tapped
    return (
      <button
        onClick={() => openQuestion(teaserQuestion)}
        className="w-full flex items-center gap-3 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl px-4 py-3 hover:from-purple-700 hover:to-indigo-700 transition-all group text-left shadow-md"
      >
        <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0 text-lg">🎯</div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm">Trivia time! Think you know your stuff?</p>
          <p className="text-purple-200 text-xs mt-0.5">Q{teaserQuestion.questionNum}/{teaserQuestion.total} · {teaserQuestion.category} · {remaining}s left</p>
        </div>
        <div className="text-white/70 group-hover:text-white text-sm font-medium flex-shrink-0">
          Tap to play →
        </div>
      </button>
    );
  }

  if (!question) return null;

  return (
    <div className="rounded-2xl border-2 border-purple-200 bg-white overflow-hidden">
      {redemptionMsg && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-center">
          <p className="text-white text-xs font-semibold animate-pulse">{redemptionMsg}</p>
        </div>
      )}

      {question.questionNum >= 9 && (
        <div className="bg-gradient-to-r from-red-600 to-orange-600 px-4 py-1.5 text-center">
          <p className="text-white text-xs font-bold">🔥 DOUBLE POINTS — Q{question.questionNum}/10 — COMEBACK TIME!</p>
        </div>
      )}

      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {CHARACTER_IMAGES[question.hostCharacter || 'hitch'] ? (
              <img src={CHARACTER_IMAGES[question.hostCharacter || 'hitch']} className="w-7 h-7 rounded-full object-cover border-2 border-white/30" alt="" />
            ) : (
              <span className="text-white text-sm">🎯</span>
            )}
            <span className="text-white text-sm font-semibold">Question {question.questionNum}/{question.total}</span>
            <span className="text-purple-200 text-xs bg-purple-700/50 px-2 py-0.5 rounded-full">{question.category}</span>
          </div>
          <div className={`text-white font-mono font-bold text-sm px-2 py-0.5 rounded-lg ${timeLeft <= 10 ? 'bg-red-500 animate-pulse' : 'bg-purple-700/50'}`}>
            {timeLeft}s
          </div>
        </div>
        <div className="h-1.5 bg-purple-800/50 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-1000 ${timerColor}`} style={{ width: `${timerPct}%` }} />
        </div>
      </div>

      <div className="px-4 pt-4 pb-2">
        <p className="text-gray-800 font-medium text-sm leading-relaxed">{question.question}</p>
      </div>

      <div className="px-4 pb-4 grid grid-cols-1 gap-2">
        {(Object.entries(question.options) as [string, string][]).map(([key, val]) => {
          const isSelected = selected === key;
          const isCorrect = result && result.correctAnswer === key;
          const isWrong = isSelected && result && !result.isCorrect;

          let btnClass = `w-full text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition flex items-center gap-3 `;
          if (!selected) {
            btnClass += 'border-gray-200 bg-gray-50 hover:bg-orange-400 hover:text-white cursor-pointer';
          } else if (!result) {
            btnClass += isSelected
              ? 'bg-orange-400 border-orange-500 text-white'
              : 'border-gray-100 bg-gray-50 text-gray-400 cursor-default';
          } else if (isCorrect) {
            btnClass += 'bg-green-500 border-green-600 text-white';
          } else if (isWrong) {
            btnClass += 'bg-red-500 border-red-600 text-white';
          } else {
            btnClass += 'border-gray-100 bg-gray-50 text-gray-400 cursor-default';
          }

          return (
            <button key={key} onClick={() => submitAnswer(key)} disabled={!!selected || timeLeft === 0} className={btnClass}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${!selected ? 'bg-gray-200 text-gray-600' : 'bg-white/30 text-white'}`}>{key}</span>
              <span className="flex-1">{val}</span>
            </button>
          );
        })}
      </div>

      {result && (
        <div className={`mx-4 mb-2 px-4 py-3 rounded-xl text-center text-sm font-semibold ${result.isCorrect ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {result.isCorrect
            ? `✅ Correct! +${result.points} points${result.points > 50 ? ' ⚡ Speed bonus!' : ''}`
            : `❌ The answer was ${result.correctAnswer}`}
        </div>
      )}

      {postQuestionMsg && (
        <div className="mx-4 mb-4 px-4 py-3 rounded-xl text-center text-sm font-medium bg-orange-50 border border-orange-200 text-orange-800">
          {postQuestionMsg}
        </div>
      )}

      {timeLeft === 0 && !selected && !postQuestionMsg && (
        <div className="mx-4 mb-4 px-4 py-3 rounded-xl text-center text-sm text-gray-500 bg-gray-50 border border-gray-200">
          ⏰ Time's up!
        </div>
      )}
    </div>
  );
}

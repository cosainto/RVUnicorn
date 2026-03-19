import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const TOPICS = [
  { id: 'general', label: '🎯 Mixed', desc: 'Camping, food, pop culture, nature' },
  { id: 'camping', label: '🏕️ Camping & RV', desc: 'All things RV life' },
  { id: 'nature', label: '🌲 Nature', desc: 'Outdoors, wildlife, geography' },
  { id: 'food', label: '🍳 Food & Cooking', desc: 'Recipes, cuisine, campfire meals' },
  { id: 'sports', label: '🏆 Sports', desc: 'Teams, athletes, championships' },
];

export default function PrivateTriviaRoom() {
  const { user } = useAuth();
  const [view, setView] = useState<'menu' | 'create' | 'join' | 'lobby' | 'game' | 'results'>('menu');
  const [topic, setTopic] = useState('general');
  const [joinCode, setJoinCode] = useState('');
  const [room, setRoom] = useState<any>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [scores, setScores] = useState<any[]>([]);
  const [timeLeft, setTimeLeft] = useState(30);
  const [loading, setLoading] = useState(false);
  const [myPoints, setMyPoints] = useState(0);

  const createRoom = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/campfire-phase4/private/create', { topic });
      setRoom(data.room);
      setView('lobby');
    } catch { alert('Failed to create room'); }
    finally { setLoading(false); }
  };

  const joinRoom = async () => {
    if (!joinCode.trim()) return;
    setLoading(true);
    try {
      const { data } = await api.post('/campfire-phase4/private/join', { code: joinCode });
      setRoom(data.room);
      setView('lobby');
    } catch { alert('Room not found — check your code'); }
    finally { setLoading(false); }
  };

  const startGame = () => {
    setCurrentQ(0);
    setMyPoints(0);
    setScores([]);
    setView('game');
    setTimeLeft(30);
    setSelected(null);
    setResult(null);
  };

  const submitAnswer = useCallback(async (answer: string) => {
    if (!room || selected) return;
    setSelected(answer);
    const q = room.questions[currentQ];
    try {
      const { data } = await api.post(`/campfire-phase4/private/${room.code}/answer`, {
        questionId: q.id,
        answer,
        answeredAt: new Date().toISOString(),
      });
      setResult(data);
      if (data.isCorrect) setMyPoints(p => p + data.points);
    } catch {}
  }, [room, selected, currentQ]);

  const nextQuestion = () => {
    if (currentQ + 1 >= room.questions.length) {
      // End game
      api.post(`/campfire-phase4/private/${room.code}/end`).then(({ data }) => {
        setScores(data.participants || []);
        setView('results');
      }).catch(() => setView('results'));
    } else {
      setCurrentQ(q => q + 1);
      setSelected(null);
      setResult(null);
      setTimeLeft(30);
    }
  };

  // Countdown timer
  useEffect(() => {
    if (view !== 'game' || selected) return;
    if (timeLeft <= 0) { submitAnswer(''); return; }
    const t = setTimeout(() => setTimeLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [view, timeLeft, selected, submitAnswer]);

  // ── Views ──────────────────────────────────────────────────
  if (view === 'menu') return (
    <div className="space-y-4">
      <div className="text-center py-4">
        <div className="text-4xl mb-2">🎮</div>
        <h2 className="text-lg font-bold text-gray-800">Private Trivia</h2>
        <p className="text-sm text-gray-500">Play with friends — no campground required</p>
      </div>
      <button onClick={() => setView('create')} className="w-full py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 transition">
        🎯 Create a Room
      </button>
      <button onClick={() => setView('join')} className="w-full py-3 bg-white border-2 border-orange-300 text-orange-600 font-semibold rounded-xl hover:bg-orange-50 transition">
        🚪 Join with Code
      </button>
    </div>
  );

  if (view === 'create') return (
    <div className="space-y-4">
      <button onClick={() => setView('menu')} className="text-sm text-gray-400 hover:text-gray-600">← Back</button>
      <h3 className="font-bold text-gray-800">Choose a topic</h3>
      <div className="space-y-2">
        {TOPICS.map(t => (
          <button key={t.id} onClick={() => setTopic(t.id)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition ${topic === t.id ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-orange-200'}`}>
            <span className="text-xl">{t.label.split(' ')[0]}</span>
            <div>
              <div className="text-sm font-semibold text-gray-800">{t.label.split(' ').slice(1).join(' ')}</div>
              <div className="text-xs text-gray-400">{t.desc}</div>
            </div>
          </button>
        ))}
      </div>
      <button onClick={createRoom} disabled={loading}
        className="w-full py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 disabled:opacity-50 transition">
        {loading ? 'Generating questions…' : '🎯 Create Room'}
      </button>
    </div>
  );

  if (view === 'join') return (
    <div className="space-y-4">
      <button onClick={() => setView('menu')} className="text-sm text-gray-400 hover:text-gray-600">← Back</button>
      <h3 className="font-bold text-gray-800">Enter room code</h3>
      <input
        value={joinCode}
        onChange={e => setJoinCode(e.target.value.toUpperCase())}
        placeholder="e.g. ABC123"
        maxLength={6}
        className="w-full text-center text-2xl font-mono font-bold border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-400 tracking-widest"
      />
      <button onClick={joinRoom} disabled={loading || joinCode.length < 6}
        className="w-full py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 disabled:opacity-50 transition">
        {loading ? 'Joining…' : '🚪 Join Room'}
      </button>
    </div>
  );

  if (view === 'lobby' && room) return (
    <div className="space-y-4 text-center">
      <div className="text-4xl mb-1">🎮</div>
      <h3 className="font-bold text-gray-800">Room Ready!</h3>
      <div className="bg-gray-100 rounded-xl px-6 py-4">
        <div className="text-xs text-gray-500 mb-1">Share this code</div>
        <div className="text-4xl font-mono font-bold text-orange-600 tracking-widest">{room.code}</div>
      </div>
      <div className="text-sm text-gray-500">{room.participants?.length || 1} player{room.participants?.length !== 1 ? 's' : ''} joined</div>
      <div className="text-xs text-gray-400">Topic: {TOPICS.find(t => t.id === room.topic)?.label || room.topic}</div>
      {(user as any)?.id === room.hostId ? (
        <button onClick={startGame} className="w-full py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 transition">
          🚀 Start Game ({room.questions?.length || 10} questions)
        </button>
      ) : (
        <div className="text-sm text-gray-500 bg-gray-50 rounded-xl py-3">Waiting for host to start…</div>
      )}
    </div>
  );

  if (view === 'game' && room) {
    const q = room.questions[currentQ];
    const timerPct = (timeLeft / 30) * 100;
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Question {currentQ + 1}/{room.questions.length}</span>
          <span className="font-mono font-bold text-lg">{timeLeft}s</span>
          <span>{myPoints} pts</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-1000 ${timeLeft > 15 ? 'bg-green-500' : timeLeft > 8 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${timerPct}%` }} />
        </div>
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="text-xs text-orange-500 font-semibold mb-1">{q.category}</div>
          <p className="text-sm font-medium text-gray-800 leading-relaxed">{q.question}</p>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {(['A','B','C','D'] as const).map(key => {
            const val = q[`option${key}`];
            const isSelected = selected === key;
            const isCorrect = result?.correctAnswer === key;
            const isWrong = isSelected && result && !result.isCorrect;
            let cls = 'w-full text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition flex items-center gap-3 ';
            if (!selected) cls += 'border-gray-200 bg-white hover:border-orange-300 cursor-pointer';
            else if (isCorrect && result) cls += 'bg-green-500 border-green-600 text-white';
            else if (isWrong) cls += 'bg-red-500 border-red-600 text-white';
            else cls += 'border-gray-100 bg-gray-50 text-gray-400 cursor-default';
            return (
              <button key={key} onClick={() => submitAnswer(key)} disabled={!!selected} className={cls}>
                <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold flex-shrink-0">{key}</span>
                {val}
              </button>
            );
          })}
        </div>
        {result && (
          <div className={`text-center py-2 rounded-xl text-sm font-semibold ${result.isCorrect ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {result.isCorrect ? `✅ Correct! +${result.points} pts` : `❌ Answer: ${result.correctAnswer}`}
          </div>
        )}
        {selected && (
          <button onClick={nextQuestion} className="w-full py-2.5 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 transition text-sm">
            {currentQ + 1 >= room.questions.length ? '🏁 See Results' : 'Next Question →'}
          </button>
        )}
      </div>
    );
  }

  if (view === 'results') return (
    <div className="space-y-4 text-center">
      <div className="text-4xl mb-1">🏆</div>
      <h3 className="font-bold text-gray-800">Game Over!</h3>
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <div className="text-sm text-amber-700">Your score</div>
        <div className="text-3xl font-bold text-amber-600">{myPoints} pts</div>
      </div>
      {scores.length > 0 && (
        <div className="space-y-2 text-left">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Final standings</div>
          {scores.map((s, i) => (
            <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-xl ${i === 0 ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'}`}>
              <span>{['🥇','🥈','🥉'][i] || `#${i+1}`}</span>
              <span className="flex-1 text-sm font-medium">{s.user?.firstName || 'Player'}</span>
              <span className="text-sm font-bold text-orange-600">{s.totalPoints} pts</span>
            </div>
          ))}
        </div>
      )}
      <button onClick={() => { setView('menu'); setRoom(null); }} className="w-full py-3 bg-orange-500 text-white font-semibold rounded-xl hover:bg-orange-600 transition">
        Play Again
      </button>
    </div>
  );

  return null;
}

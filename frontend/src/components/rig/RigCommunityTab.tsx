import { useState, useEffect } from 'react';
import { MessageSquare, ThumbsUp, Users, Send, Loader2, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

interface Props { slug: string; rigId: string; rigName: string; isOwner: boolean; }

export default function RigCommunityTab({ slug, rigId, rigName, isOwner }: Props) {
  const { user } = useAuth();
  const [subTab, setSubTab] = useState<'qa' | 'suggestions' | 'polls' | 'guests'>('qa');
  const [questions, setQuestions] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [polls, setPolls] = useState<any[]>([]);
  const [guestMoments, setGuestMoments] = useState<any[]>([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [newSuggestion, setNewSuggestion] = useState('');
  const [answerInputs, setAnswerInputs] = useState<Record<string, string>>({});
  const [guestContent, setGuestContent] = useState('');
  const [guestMetAt, setGuestMetAt] = useState('');

  useEffect(() => {
    if (subTab === 'qa') api.get(`/rigs/${slug}/questions`).then(r => setQuestions(r.data)).catch(() => {});
    if (subTab === 'suggestions') api.get(`/rigs/${slug}/suggestions`).then(r => setSuggestions(r.data)).catch(() => {});
    if (subTab === 'polls') api.get(`/rigs/${slug}/polls`).then(r => setPolls(r.data)).catch(() => {});
    if (subTab === 'guests') api.get(`/rigs/${slug}/guest-moments`).then(r => setGuestMoments(r.data)).catch(() => {});
  }, [subTab, slug]);

  const askQuestion = async () => {
    if (!newQuestion.trim()) return;
    try {
      const { data } = await api.post(`/rigs/${slug}/questions`, { question: newQuestion });
      setQuestions(prev => [data, ...prev]);
      setNewQuestion('');
    } catch {}
  };

  const answerQuestion = async (qId: string) => {
    const answer = answerInputs[qId];
    if (!answer?.trim()) return;
    try {
      await api.post(`/rigs/${slug}/questions/${qId}/answer`, { answer });
      setAnswerInputs(prev => ({ ...prev, [qId]: '' }));
      const { data } = await api.get(`/rigs/${slug}/questions`);
      setQuestions(data);
    } catch {}
  };

  const submitSuggestion = async () => {
    if (!newSuggestion.trim()) return;
    try {
      const { data } = await api.post(`/rigs/${slug}/suggestions`, { content: newSuggestion, type: 'NEXT_STOP' });
      setSuggestions(prev => [data, ...prev]);
      setNewSuggestion('');
    } catch {}
  };

  const upvoteSuggestion = async (id: string) => {
    try {
      await api.post(`/rigs/${slug}/suggestions/${id}/upvote`);
      setSuggestions(prev => prev.map(s => s.id === id ? { ...s, upvotes: s.upvotes + 1 } : s));
    } catch {}
  };

  const votePoll = async (pollId: string, optIdx: number) => {
    try {
      const { data } = await api.post(`/rigs/${slug}/polls/${pollId}/vote`, { optionIndex: optIdx });
      setPolls(prev => prev.map(p => p.id === pollId ? data : p));
    } catch {}
  };

  const submitGuestMoment = async () => {
    if (!guestContent.trim()) return;
    try {
      const { data } = await api.post(`/rigs/${slug}/guest-moments`, { content: guestContent, metAt: guestMetAt || null });
      setGuestMoments(prev => [data, ...prev]);
      setGuestContent(''); setGuestMetAt('');
    } catch {}
  };

  const tabs = [
    { key: 'qa' as const, label: 'Q&A', icon: MessageSquare },
    { key: 'suggestions' as const, label: 'Suggestions', icon: ThumbsUp },
    { key: 'polls' as const, label: 'Polls', icon: BarChart3 },
    { key: 'guests' as const, label: 'Guest Book', icon: Users },
  ];

  return (
    <div>
      <div className="flex gap-1 mb-4 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setSubTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${subTab === t.key ? 'bg-amber-500/20 text-amber-400' : 'text-white/40 hover:text-white/60'}`}>
            <t.icon className="w-3.5 h-3.5" />{t.label}
          </button>
        ))}
      </div>

      {/* Q&A */}
      {subTab === 'qa' && (
        <div className="space-y-3">
          {user && (
            <div className="flex gap-2">
              <input value={newQuestion} onChange={e => setNewQuestion(e.target.value)} placeholder={`Ask ${rigName} a question...`}
                className="flex-1 text-sm bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white placeholder-white/30" />
              <button onClick={askQuestion} disabled={!newQuestion.trim()} className="px-3 py-2 bg-amber-500 text-gray-900 rounded-xl text-sm font-semibold disabled:opacity-50"><Send className="w-4 h-4" /></button>
            </div>
          )}
          {questions.map(q => (
            <div key={q.id} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center gap-2 mb-1">
                {q.asker?.profilePicture ? <img src={q.asker.profilePicture} className="w-5 h-5 rounded-full" /> : null}
                <span className="text-xs font-semibold text-white/60">{q.asker?.firstName}</span>
              </div>
              <p className="text-sm text-white">{q.question}</p>
              {q.answer ? (
                <div className="mt-2 pl-3 border-l-2 border-amber-500/30">
                  <p className="text-sm text-amber-200/80">{q.answer}</p>
                  <span className="text-[10px] text-white/30">Answered {new Date(q.answeredAt).toLocaleDateString()}</span>
                </div>
              ) : isOwner ? (
                <div className="flex gap-2 mt-2">
                  <input value={answerInputs[q.id] || ''} onChange={e => setAnswerInputs(prev => ({ ...prev, [q.id]: e.target.value }))}
                    placeholder="Write your answer..." className="flex-1 text-xs bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white placeholder-white/20" />
                  <button onClick={() => answerQuestion(q.id)} className="text-xs text-amber-400 font-semibold">Answer</button>
                </div>
              ) : (
                <p className="text-[10px] text-white/20 mt-1">Awaiting answer</p>
              )}
            </div>
          ))}
          {questions.length === 0 && <p className="text-center text-sm text-white/30 py-8">No questions yet. Be the first to ask!</p>}
        </div>
      )}

      {/* Suggestions */}
      {subTab === 'suggestions' && (
        <div className="space-y-3">
          {user && (
            <div className="flex gap-2">
              <input value={newSuggestion} onChange={e => setNewSuggestion(e.target.value)} placeholder="Suggest a stop or campground..."
                className="flex-1 text-sm bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white placeholder-white/30" />
              <button onClick={submitSuggestion} disabled={!newSuggestion.trim()} className="px-3 py-2 bg-amber-500 text-gray-900 rounded-xl text-sm font-semibold disabled:opacity-50"><Send className="w-4 h-4" /></button>
            </div>
          )}
          {suggestions.map(s => (
            <div key={s.id} className="flex items-start gap-3 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <button onClick={() => upvoteSuggestion(s.id)} className="flex flex-col items-center pt-1">
                <ThumbsUp className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-amber-400 mt-0.5">{s.upvotes}</span>
              </button>
              <div className="flex-1">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/10 text-white/50">{s.type.replace('_', ' ')}</span>
                <p className="text-sm text-white mt-1">{s.content}</p>
                <span className="text-[10px] text-white/25">{s.suggester?.firstName} · {new Date(s.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
          {suggestions.length === 0 && <p className="text-center text-sm text-white/30 py-8">No suggestions yet</p>}
        </div>
      )}

      {/* Polls */}
      {subTab === 'polls' && (
        <div className="space-y-3">
          {polls.map(p => {
            const votes = p.votes || {};
            const totalVotes = Object.keys(votes).length;
            const myVote = user ? votes[user.id] : undefined;
            const options = Array.isArray(p.options) ? p.options : [];
            return (
              <div key={p.id} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <h4 className="text-sm font-semibold text-white mb-3">{p.question}</h4>
                <div className="space-y-2">
                  {options.map((opt: string, i: number) => {
                    const count = Object.values(votes).filter((v: any) => v === i).length;
                    const pct = totalVotes > 0 ? Math.round(count / totalVotes * 100) : 0;
                    return (
                      <button key={i} onClick={() => votePoll(p.id, i)} disabled={myVote !== undefined}
                        className={`w-full text-left rounded-lg px-3 py-2 text-sm transition relative overflow-hidden ${myVote === i ? 'border border-amber-500/50' : 'border border-white/10 hover:border-white/20'}`}>
                        <div className="absolute inset-0 rounded-lg" style={{ background: 'rgba(232,168,56,0.15)', width: `${pct}%` }} />
                        <span className="relative text-white/80">{opt}</span>
                        {myVote !== undefined && <span className="relative float-right text-xs text-white/40">{pct}%</span>}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-white/25 mt-2">{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</p>
              </div>
            );
          })}
          {polls.length === 0 && <p className="text-center text-sm text-white/30 py-8">No polls yet</p>}
        </div>
      )}

      {/* Guest Book */}
      {subTab === 'guests' && (
        <div className="space-y-3">
          {user && (
            <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-xs font-semibold text-amber-400 mb-2">We met this rig!</p>
              <textarea value={guestContent} onChange={e => setGuestContent(e.target.value)} placeholder="Tell us about meeting this rig..."
                className="w-full text-sm bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/30 resize-none" rows={2} />
              <div className="flex gap-2 mt-2">
                <input value={guestMetAt} onChange={e => setGuestMetAt(e.target.value)} placeholder="Where? (optional)"
                  className="flex-1 text-xs bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white placeholder-white/20" />
                <button onClick={submitGuestMoment} disabled={!guestContent.trim()} className="px-3 py-1.5 bg-amber-500 text-gray-900 rounded-lg text-xs font-semibold disabled:opacity-50">Share</button>
              </div>
            </div>
          )}
          {guestMoments.map(gm => (
            <div key={gm.id} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center gap-2 mb-1">
                {gm.author?.profilePicture ? <img src={gm.author.profilePicture} className="w-5 h-5 rounded-full" /> : null}
                <Link to={`/profile/${gm.author?.username || gm.author?.id}`} className="text-xs font-semibold text-amber-400 hover:underline">{gm.author?.firstName} {gm.author?.lastName}</Link>
                {gm.metAt && <span className="text-[10px] text-white/30">at {gm.metAt}</span>}
              </div>
              <p className="text-sm text-white/80">{gm.content}</p>
              <span className="text-[10px] text-white/20">{new Date(gm.createdAt).toLocaleDateString()}</span>
            </div>
          ))}
          {guestMoments.length === 0 && <p className="text-center text-sm text-white/30 py-8">No guest entries yet</p>}
        </div>
      )}
    </div>
  );
}

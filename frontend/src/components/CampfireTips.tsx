import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ThumbsUp, Bookmark, Heart, ChevronDown, Flame, Send, Sparkles, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface Tip {
  id: string;
  title: string | null;
  content: string;
  category: string | null;
  helpfulCount: number;
  savedCount: number;
  authorVisitCount: number;
  lastVisitedAt: string | null;
  createdAt: string;
  author: { id: string; firstName: string; lastName: string; username: string; profilePicture?: string };
  reactions: { userId: string; type: string }[];
}

interface Props {
  campgroundId: string;
  tripId?: string;
  campgroundName?: string;
  compact?: boolean;
}

function CredibilityBadge({ visitCount, lastVisited }: { visitCount: number; lastVisited?: string | null }) {
  const recency = lastVisited ? Math.floor((Date.now() - new Date(lastVisited).getTime()) / (1000 * 60 * 60 * 24)) : null;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
      {visitCount >= 3 && <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold">Top Contributor</span>}
      {visitCount >= 1 && visitCount < 3 && <span>✅ Stayed here{visitCount > 1 ? ` ${visitCount}x` : ''}</span>}
      {recency !== null && recency < 90 && <span>· 📍 {recency < 7 ? 'This week' : `${Math.floor(recency / 30)}mo ago`}</span>}
    </span>
  );
}

export default function CampfireTips({ campgroundId, tripId, campgroundName, compact = false }: Props) {
  const { user } = useAuth() as any;
  const [tips, setTips] = useState<Tip[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [composerContent, setComposerContent] = useState('');
  const [composerTitle, setComposerTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);

  // Auto-open composer if ?tip=true in URL
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('tip=true') && user) {
      setShowComposer(true);
      loadDraft();
    }
  }, [user]);

  const loadDraft = async () => {
    setDraftLoading(true);
    try {
      const { data } = await api.get(`/campfire-tips/draft/${campgroundId}`);
      if (data.draft) {
        setComposerContent(data.draft);
        setComposerTitle('');
      }
    } catch {}
    finally { setDraftLoading(false); }
  };

  useEffect(() => {
    const endpoint = tripId ? `/campfire-tips/trip/${tripId}` : `/campfire-tips/${campgroundId}`;
    api.get(endpoint)
      .then(({ data }) => setTips(data.tips || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [campgroundId, tripId]);

  const handleReact = async (tipId: string, type: string) => {
    try {
      await api.post(`/campfire-tips/${tipId}/react`, { type });
      // Optimistic update
      setTips(prev => prev.map(t => {
        if (t.id !== tipId) return t;
        const hasReaction = t.reactions.some(r => r.userId === user?.id && r.type === type);
        return {
          ...t,
          helpfulCount: type === 'HELPFUL' ? t.helpfulCount + (hasReaction ? -1 : 1) : t.helpfulCount,
          savedCount: type === 'SAVE' ? t.savedCount + (hasReaction ? -1 : 1) : t.savedCount,
          reactions: hasReaction
            ? t.reactions.filter(r => !(r.userId === user?.id && r.type === type))
            : [...t.reactions, { userId: user?.id, type }],
        };
      }));
    } catch {}
  };

  const loadSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      const { data } = await api.post('/campfire-tips/smart-prompt', { campgroundId });
      setSuggestions(data.suggestions || []);
    } catch {}
    finally { setLoadingSuggestions(false); }
  };

  const handleSubmit = async () => {
    if (!composerContent.trim()) return;
    setSubmitting(true);
    try {
      const { data } = await api.post('/campfire-tips', {
        campgroundId, tripId,
        title: composerTitle.trim() || null,
        content: composerContent.trim(),
      });
      setTips(prev => [data.tip, ...prev]);
      setShowComposer(false);
      setComposerContent(''); setComposerTitle('');
    } catch {}
    finally { setSubmitting(false); }
  };

  const useSuggestion = (s: any) => {
    setComposerTitle(s.title);
    setComposerContent(s.content);
    setSuggestions([]);
  };

  if (loading) return <div className="h-24 bg-gray-100 rounded-xl animate-pulse" />;

  const displayTips = expanded ? tips : tips.slice(0, compact ? 2 : 3);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-red-500 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-white" />
          <h3 className="text-white font-bold text-sm">Campfire Tips</h3>
          {tips.length > 0 && <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">{tips.length}</span>}
        </div>
        {user && (
          <button onClick={() => { setShowComposer(true); if (!composerContent) loadDraft(); if (suggestions.length === 0) loadSuggestions(); }}
            className="flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white px-3 py-1 rounded-lg text-xs font-semibold transition">
            <Send className="w-3 h-3" /> Share a Tip
          </button>
        )}
      </div>

      {/* Composer */}
      {showComposer && (
        <div className="p-4 bg-orange-50 border-b border-orange-200">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-800">Share a Campfire Tip</p>
            <button onClick={() => setShowComposer(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>

          {/* AI Draft loading */}
          {draftLoading && <p className="text-xs text-orange-600 animate-pulse mb-3">🔥 Hitch is drafting a tip based on your visits...</p>}

          {/* AI Suggestions */}
          {loadingSuggestions && !draftLoading && <p className="text-xs text-orange-600 animate-pulse mb-3">Hitch is thinking of suggestions...</p>}
          {suggestions.length > 0 && (
            <div className="space-y-2 mb-3">
              <p className="text-xs text-gray-500 font-medium flex items-center gap-1"><Sparkles className="w-3 h-3" /> Quick suggestions:</p>
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => useSuggestion(s)}
                  className="w-full text-left bg-white border border-orange-200 rounded-lg px-3 py-2 text-xs hover:bg-orange-100 transition">
                  <span className="font-semibold text-orange-700">{s.title}</span>
                  <span className="text-gray-600 ml-1">{s.content}</span>
                </button>
              ))}
            </div>
          )}

          <input value={composerTitle} onChange={e => setComposerTitle(e.target.value)} placeholder="Title (e.g. Watch out for...)"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-orange-400" />
          <textarea value={composerContent} onChange={e => setComposerContent(e.target.value)} placeholder="Your tip..." rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
          <button onClick={handleSubmit} disabled={!composerContent.trim() || submitting}
            className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-600 disabled:opacity-50 transition">
            {submitting ? 'Sharing...' : 'Share Tip 🔥'}
          </button>
        </div>
      )}

      {/* Tips list */}
      <div className="divide-y divide-gray-50">
        {displayTips.length === 0 ? (
          <div className="text-center py-8 px-4">
            <p className="text-2xl mb-2">🔥</p>
            <p className="text-sm text-gray-500">No tips yet — be the first to share!</p>
          </div>
        ) : displayTips.map(tip => (
          <div key={tip.id} className="px-4 py-3">
            <div className="flex items-start gap-3">
              <Link to={`/profile/${tip.author.username}`}>
                {tip.author.profilePicture ? (
                  <img src={tip.author.profilePicture} className="w-8 h-8 rounded-full object-cover flex-shrink-0" alt="" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-orange-200 flex items-center justify-center text-xs font-bold text-orange-700 flex-shrink-0">{tip.author.firstName[0]}</div>
                )}
              </Link>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link to={`/profile/${tip.author.username}`} className="text-sm font-semibold text-gray-800 hover:text-orange-600">{tip.author.firstName}</Link>
                  <CredibilityBadge visitCount={tip.authorVisitCount} lastVisited={tip.lastVisitedAt} />
                  <span className="text-[10px] text-gray-300">{formatDistanceToNow(new Date(tip.createdAt), { addSuffix: true })}</span>
                </div>
                {tip.title && <p className="text-sm font-medium text-gray-900 mt-1">{tip.title}</p>}
                <p className="text-sm text-gray-700 mt-0.5 leading-relaxed">{tip.content}</p>

                {/* Reactions */}
                <div className="flex items-center gap-3 mt-2">
                  <button onClick={() => handleReact(tip.id, 'HELPFUL')}
                    className={`flex items-center gap-1 text-xs transition ${tip.reactions.some(r => r.userId === user?.id && r.type === 'HELPFUL') ? 'text-green-600 font-semibold' : 'text-gray-400 hover:text-green-600'}`}>
                    <ThumbsUp className="w-3.5 h-3.5" /> {tip.helpfulCount > 0 ? tip.helpfulCount : ''} Helpful
                  </button>
                  <button onClick={() => handleReact(tip.id, 'SAVE')}
                    className={`flex items-center gap-1 text-xs transition ${tip.reactions.some(r => r.userId === user?.id && r.type === 'SAVE') ? 'text-blue-600 font-semibold' : 'text-gray-400 hover:text-blue-600'}`}>
                    <Bookmark className="w-3.5 h-3.5" /> Save
                  </button>
                  <button onClick={() => handleReact(tip.id, 'APPRECIATE')}
                    className={`flex items-center gap-1 text-xs transition ${tip.reactions.some(r => r.userId === user?.id && r.type === 'APPRECIATE') ? 'text-red-500 font-semibold' : 'text-gray-400 hover:text-red-500'}`}>
                    <Heart className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Expand */}
      {tips.length > (compact ? 2 : 3) && !expanded && (
        <button onClick={() => setExpanded(true)}
          className="w-full py-2.5 text-xs text-orange-600 font-semibold hover:bg-orange-50 transition flex items-center justify-center gap-1">
          <ChevronDown className="w-3 h-3" /> View all {tips.length} tips
        </button>
      )}
    </div>
  );
}

// Contributor stats badge for profile pages
export function CampfireContributorStats({ userId }: { userId: string }) {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    api.get(`/campfire-tips/user/${userId}/stats`)
      .then(({ data }) => { if (data.tipCount > 0) setStats(data); })
      .catch(() => {});
  }, [userId]);

  if (!stats) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Flame className="w-4 h-4 text-orange-500" />
        <span className="font-semibold text-gray-900 text-sm">Campfire Contributions</span>
      </div>
      <div className="flex gap-4 text-center">
        <div>
          <p className="text-lg font-bold text-gray-900">{stats.tipCount}</p>
          <p className="text-[10px] text-gray-400">Tips shared</p>
        </div>
        <div>
          <p className="text-lg font-bold text-gray-900">{stats.campgroundsHelped}</p>
          <p className="text-[10px] text-gray-400">Locations</p>
        </div>
        <div>
          <p className="text-lg font-bold text-gray-900">{stats.helpfulScore}</p>
          <p className="text-[10px] text-gray-400">Helpful</p>
        </div>
      </div>
      {stats.badges.length > 0 && (
        <div className="flex gap-1.5 mt-3 flex-wrap">
          {stats.badges.map((b: string) => (
            <span key={b} className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">🏅 {b}</span>
          ))}
        </div>
      )}
    </div>
  );
}

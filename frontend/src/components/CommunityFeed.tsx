import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, MessageCircle, Share2, Bell, BellOff, Send, Plus, X, ChevronRight, Tent } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const POST_TYPE_CONFIG: Record<string, { emoji: string; label: string; border?: string }> = {
  GENERAL: { emoji: '\u{1F4DD}', label: 'Post' },
  QUESTION: { emoji: '\u2753', label: 'Question', border: '#378ADD' },
  POLL: { emoji: '\u{1F5F3}\uFE0F', label: 'Poll' },
  TIP: { emoji: '\u{1F4A1}', label: 'Tip' },
  REVIEW: { emoji: '\u2B50', label: 'Review' },
  STORY: { emoji: '\u{1F4D6}', label: 'Story' },
  PHOTO: { emoji: '\u{1F4F8}', label: 'Photos' },
  MOD: { emoji: '\u{1F527}', label: 'Mod' },
  RECIPE: { emoji: '\u{1F373}', label: 'Recipe' },
};

interface Props {
  className?: string;
}

export default function CommunityFeed({ className = '' }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'FOR_YOU' | 'FOLLOWING' | 'TRENDING'>('FOR_YOU');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hotStrip, setHotStrip] = useState<any[]>([]);
  const [activeThreads, setActiveThreads] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activityCount, setActivityCount] = useState(0);

  const loadFeed = useCallback(async (feedTab: string, append = false) => {
    try {
      if (!append) setLoading(true);
      const params = append && cursor ? `&cursor=${cursor}` : '';
      const { data } = await api.get(`/community/feed?tab=${feedTab}&limit=20${params}`);
      if (append) {
        setItems(prev => [...prev, ...(data.items || [])]);
      } else {
        setItems(data.items || []);
      }
      setCursor(data.nextCursor || null);
    } catch { if (!append) setItems([]); }
    finally { setLoading(false); }
  }, [cursor]);

  useEffect(() => {
    loadFeed(tab);
    // Load supplementary data
    api.get('/community/feed/hot-strip').then(r => setHotStrip(r.data || [])).catch(() => {});
    api.get('/community/feed/active-threads').then(r => setActiveThreads(r.data || [])).catch(() => {});
    api.get('/community/suggestions/people').then(r => setSuggestions(r.data || [])).catch(() => {});
    api.get('/community/activity/count').then(r => setActivityCount(r.data?.count || 0)).catch(() => {});
  }, [tab]);

  const handleLike = async (postId: string) => {
    const { data } = await api.post(`/community/posts/${postId}/like`);
    setItems(prev => prev.map(p => p.id === postId ? { ...p, likeCount: data.liked ? p.likeCount + 1 : p.likeCount - 1, _userLiked: data.liked } : p));
  };

  const handleBeenThere = async (postId: string) => {
    const { data } = await api.post(`/community/posts/${postId}/been-there`);
    setItems(prev => prev.map(p => p.id === postId ? { ...p, _userBeenThere: data.beenThere } : p));
  };

  const dismissSuggestion = async (suggestedUserId: string) => {
    await api.post(`/community/suggestions/${suggestedUserId}/dismiss`).catch(() => {});
    setSuggestions(prev => prev.filter(s => s.suggestedUserId !== suggestedUserId));
  };

  return (
    <div className={className}>
      {/* Tab Bar */}
      <div className="flex items-center gap-1 mb-4 bg-gray-100 p-1 rounded-xl sticky top-0 z-10">
        {(['FOR_YOU', 'FOLLOWING', 'TRENDING'] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); setItems([]); setCursor(null); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
            {t === 'FOR_YOU' ? '\u2B50 For You' : t === 'FOLLOWING' ? '\u{1F465} Following' : '\u{1F525} Trending'}
          </button>
        ))}
        {activityCount > 0 && (
          <Link to="/community" className="relative p-2">
            <Bell className="w-4 h-4 text-gray-500" />
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{activityCount > 9 ? '9+' : activityCount}</span>
          </Link>
        )}
      </div>

      {/* Create Post Bar */}
      <button onClick={() => setShowCreateModal(true)}
        className="w-full flex items-center gap-3 p-3 mb-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition text-left">
        {user?.profilePicture ? <img src={user.profilePicture} alt="" className="w-8 h-8 rounded-full object-cover" /> : <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-600">{user?.firstName?.[0]}</div>}
        <span className="text-sm text-gray-400 flex-1">What's on your mind, {user?.firstName}?</span>
        <Plus className="w-4 h-4 text-gray-300" />
      </button>

      {/* Active Threads (For You only) */}
      {tab === 'FOR_YOU' && activeThreads.length > 0 && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-xl">
          <p className="text-xs font-bold text-blue-700 mb-2">{'\u{1F4AC}'} Active in your threads</p>
          {activeThreads.slice(0, 3).map((t: any) => (
            <Link key={t.postId} to={`/community/posts/${t.postId}`} className="flex items-center justify-between py-1.5 border-b border-blue-100 last:border-0">
              <p className="text-xs text-gray-700 truncate flex-1">{t.preview}</p>
              <span className="text-[10px] text-blue-600 font-semibold ml-2 whitespace-nowrap">{t.newReplies} new</span>
            </Link>
          ))}
        </div>
      )}

      {/* Hot Strip (For You only) */}
      {tab === 'FOR_YOU' && hotStrip.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-bold text-gray-500 mb-2">{'\u{1F525}'} Hot right now</p>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
            {hotStrip.map((p: any) => (
              <button key={p.id} onClick={() => navigate(`/community/posts/${p.id}`)}
                className="flex-shrink-0 w-36 p-2.5 bg-white border border-gray-100 rounded-xl hover:shadow-md transition text-left">
                <span className="text-[10px] font-bold text-orange-500">{POST_TYPE_CONFIG[p.postType]?.emoji} {POST_TYPE_CONFIG[p.postType]?.label}</span>
                <p className="text-xs text-gray-800 font-medium line-clamp-2 mt-1">{p.content?.slice(0, 60)}</p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="text-[10px] text-gray-400">{'\u{1F4AC}'} {p.commentCount}</span>
                  {p.author?.profilePicture && <img src={p.author.profilePicture} className="w-4 h-4 rounded-full object-cover ml-auto" alt="" />}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Feed Items */}
      {loading && items.length === 0 ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gray-200 rounded-full" />
                <div className="flex-1"><div className="h-3 bg-gray-200 rounded w-32 mb-1" /><div className="h-2 bg-gray-100 rounded w-20" /></div>
              </div>
              <div className="h-3 bg-gray-200 rounded w-full mb-2" />
              <div className="h-3 bg-gray-200 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <span className="text-4xl block mb-3">{'\u{1F44B}'}</span>
          <p className="font-bold text-gray-900 mb-1">{tab === 'FOLLOWING' ? "You're not following anyone yet" : 'Welcome to the community!'}</p>
          <p className="text-sm text-gray-500 mb-4">{tab === 'FOLLOWING' ? 'Follow some RVers to fill your feed' : 'Follow RVers to see their posts here'}</p>
          {suggestions.length > 0 && (
            <div className="grid grid-cols-3 gap-2 max-w-sm mx-auto mt-4">
              {suggestions.slice(0, 6).map((s: any) => (
                <div key={s.suggestedUserId} className="text-center p-2 bg-gray-50 rounded-lg">
                  {s.user?.profilePicture ? <img src={s.user.profilePicture} className="w-10 h-10 rounded-full object-cover mx-auto mb-1" alt="" /> : <div className="w-10 h-10 rounded-full bg-primary-100 mx-auto mb-1 flex items-center justify-center text-xs font-bold text-primary-600">{s.user?.firstName?.[0]}</div>}
                  <p className="text-[10px] font-semibold text-gray-800 truncate">{s.user?.firstName}</p>
                  <p className="text-[8px] text-gray-400 truncate">{s.reason}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((post: any, idx: number) => {
            const config = POST_TYPE_CONFIG[post.postType] || POST_TYPE_CONFIG.GENERAL;
            const sameRig = user?.rvMake && post.author?.rvMake === user.rvMake && post.author?.rvModel === user.rvModel;

            return (
              <div key={post.id}>
                {/* People suggestion card every 8 items */}
                {idx > 0 && idx % 8 === 0 && suggestions.length > 0 && (
                  <div className="mb-3 p-3 bg-white border border-gray-100 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold text-gray-500">{'\u{1F465}'} People you might know</p>
                      <button onClick={() => setSuggestions([])} className="text-gray-300"><X className="w-3.5 h-3.5" /></button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {suggestions.slice(0, 3).map((s: any) => (
                        <div key={s.suggestedUserId} className="text-center p-2 bg-gray-50 rounded-lg">
                          {s.user?.profilePicture ? <img src={s.user.profilePicture} className="w-10 h-10 rounded-full object-cover mx-auto mb-1" alt="" /> : <div className="w-10 h-10 rounded-full bg-primary-100 mx-auto mb-1" />}
                          <p className="text-[10px] font-semibold truncate">{s.user?.firstName}</p>
                          <p className="text-[8px] text-amber-600 truncate">{s.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Post Card */}
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden"
                  style={post.postType === 'QUESTION' ? { borderLeft: '3px solid #378ADD' } : {}}>
                  <div className="p-4">
                    {/* Signal label */}
                    {post._signal === 'FRIEND_ACTIVITY' && post._friendActivity && (
                      <p className="text-[10px] text-green-600 font-semibold mb-2">{'\u{1F464}'} {post._friendActivity.actorNames.join(' and ')} {post._friendActivity.action} on this</p>
                    )}
                    {post._signal === 'RELEVANCE' && post._reason && (
                      <p className="text-[10px] font-semibold mb-2" style={{ color: '#E8A838' }}>{'\u2B50'} Recommended {'\u00B7'} {post._reason}</p>
                    )}
                    {post._signal === 'TRENDING' && (
                      <p className="text-[10px] text-orange-500 font-semibold mb-2">{'\u{1F525}'} Trending {'\u00B7'} {post._reason}</p>
                    )}

                    {/* Author */}
                    <div className="flex items-center gap-2.5 mb-2">
                      <Link to={`/profile/${post.author?.username}`}>
                        {post.author?.profilePicture ? <img src={post.author.profilePicture} className="w-9 h-9 rounded-full object-cover" alt="" /> : <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-sm font-bold text-primary-600">{post.author?.firstName?.[0]}</div>}
                      </Link>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Link to={`/profile/${post.author?.username}`} className="text-sm font-semibold text-gray-900 hover:underline">{post.author?.firstName} {post.author?.lastName || ''}</Link>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{config.emoji} {config.label}</span>
                        </div>
                        <p className="text-[10px] text-gray-400">{timeAgo(post.createdAt)}</p>
                      </div>
                    </div>

                    {/* Same rig badge */}
                    {sameRig && (
                      <div className="flex items-center gap-1.5 mb-2 px-2 py-1 bg-amber-50 border border-amber-200 rounded-lg">
                        <span className="text-xs">{'\u{1F690}'}</span>
                        <span className="text-[10px] font-semibold text-amber-700">Fellow {post.author.rvMake} {post.author.rvModel} owner</span>
                      </div>
                    )}

                    {/* Content */}
                    <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{post.content}</p>

                    {/* Photos */}
                    {post.photoUrls?.length > 0 && (
                      <div className={`mt-3 grid gap-1 rounded-lg overflow-hidden ${post.photoUrls.length === 1 ? 'grid-cols-1' : post.photoUrls.length === 2 ? 'grid-cols-2' : 'grid-cols-2'}`}>
                        {post.photoUrls.slice(0, 4).map((url: string, i: number) => (
                          <img key={i} src={url} alt="" className="w-full h-40 object-cover" />
                        ))}
                      </div>
                    )}

                    {/* Campground tag */}
                    {post.campgroundId && (
                      <Link to={`/campgrounds/${post.campgroundId}`} className="flex items-center gap-1 mt-2 text-xs text-primary-600 hover:underline">
                        <Tent className="w-3 h-3" /> Tagged campground
                      </Link>
                    )}
                  </div>

                  {/* Action row */}
                  <div className="flex items-center border-t border-gray-50 px-4 py-2">
                    <button onClick={() => handleLike(post.id)} className={`flex items-center gap-1 text-xs mr-4 transition ${post._userLiked ? 'text-red-500' : 'text-gray-400 hover:text-red-400'}`}>
                      <Heart className="w-4 h-4" fill={post._userLiked ? 'currentColor' : 'none'} /> {post.likeCount || ''}
                    </button>
                    <button onClick={() => navigate(`/community/posts/${post.id}`)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-500 mr-4 transition">
                      <MessageCircle className="w-4 h-4" /> {post.commentCount || ''}
                    </button>
                    {post.campgroundId && (
                      <button onClick={() => handleBeenThere(post.id)} className={`flex items-center gap-1 text-xs mr-4 transition ${post._userBeenThere ? 'text-green-600' : 'text-gray-400 hover:text-green-500'}`}>
                        <Tent className="w-4 h-4" /> {post._userBeenThere ? 'Been There \u2713' : 'Been There'}
                      </button>
                    )}
                    <button className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 ml-auto transition">
                      <Share2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Load more */}
          {cursor && (
            <button onClick={() => loadFeed(tab, true)}
              className="w-full py-3 text-sm font-semibold text-primary-600 hover:bg-primary-50 rounded-xl transition">
              Load more
            </button>
          )}
        </div>
      )}

      {/* Create Post Modal */}
      {showCreateModal && <CreatePostModal onClose={() => setShowCreateModal(false)} onCreated={() => { setShowCreateModal(false); loadFeed(tab); }} />}
    </div>
  );
}

// ─── Time ago helper ────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Create Post Modal ─────────────────────────────────────
function CreatePostModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [postType, setPostType] = useState('GENERAL');
  const [content, setContent] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [submitting, setSubmitting] = useState(false);

  const placeholders: Record<string, string> = {
    GENERAL: "What's on your mind?",
    QUESTION: 'Ask the community...',
    TIP: 'Share a tip with fellow RVers...',
    STORY: 'Tell a story from the road...',
    POLL: 'What do you want to ask?',
  };

  const submit = async () => {
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      const body: any = { content, postType };
      if (postType === 'POLL' && pollOptions.filter(o => o.trim()).length >= 2) {
        body.pollOptions = pollOptions.filter(o => o.trim());
        body.pollExpiry = '72'; // 3 days default
      }
      await api.post('/community/posts', body);
      onCreated();
    } catch { alert('Failed to create post'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <h2 className="font-bold text-gray-900">Create Post</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5">
          {/* Post type */}
          <div className="flex gap-1.5 flex-wrap mb-4">
            {Object.entries(POST_TYPE_CONFIG).filter(([k]) => ['GENERAL', 'QUESTION', 'POLL', 'TIP', 'PHOTO', 'STORY'].includes(k)).map(([key, cfg]) => (
              <button key={key} onClick={() => setPostType(key)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${postType === key ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                {cfg.emoji} {cfg.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <textarea value={content} onChange={e => setContent(e.target.value)}
            placeholder={placeholders[postType] || placeholders.GENERAL}
            rows={4} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent" autoFocus />

          {/* Poll options */}
          {postType === 'POLL' && (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-semibold text-gray-500">Poll Options</p>
              {pollOptions.map((opt, i) => (
                <input key={i} value={opt} onChange={e => { const next = [...pollOptions]; next[i] = e.target.value; setPollOptions(next); }}
                  placeholder={`Option ${i + 1}`} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              ))}
              {pollOptions.length < 4 && (
                <button onClick={() => setPollOptions([...pollOptions, ''])} className="text-xs text-primary-600 font-semibold">+ Add option</button>
              )}
            </div>
          )}

          <button onClick={submit} disabled={submitting || !content.trim()}
            className="w-full mt-4 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2">
            <Send className="w-4 h-4" /> {submitting ? 'Posting...' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  );
}

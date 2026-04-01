import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { ChevronUp, ChevronDown, MessageSquare, Plus, X, ArrowLeft, Flame, Clock, Trophy, Award, Search } from 'lucide-react';

interface Board {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  postCount: number;
}

interface Post {
  id: string;
  title: string;
  body: string;
  postType: string;
  voteScore: number;
  commentCount: number;
  tags: string[];
  createdAt: string;
  author: { id: string; firstName: string; lastName: string; username: string; profilePicture?: string };
  board?: { id: string; name: string; slug: string; icon: string; color: string };
  _count?: { comments: number; votes: number };
}

interface Comment {
  id: string;
  body: string;
  voteScore: number;
  createdAt: string;
  isBestAnswer: boolean;
  author: { id: string; firstName: string; lastName: string; username: string; profilePicture?: string };
  replies: Comment[];
}

const POST_TYPES = [
  { value: 'DISCUSSION', label: '💬 Discussion' },
  { value: 'QUESTION', label: '❓ Question' },
  { value: 'PHOTO', label: '📸 Photo' },
  { value: 'TRIP_REPORT', label: '🗺️ Trip Report' },
  { value: 'RECIPE', label: '🍳 Recipe' },
  { value: 'UPGRADE', label: '🔧 Upgrade' },
  { value: 'HUMOR', label: '😂 Humor' },
];

function Avatar({ user, size = 8 }: { user: any; size?: number }) {
  if (user?.profilePicture) {
    return <img src={user.profilePicture} className={`w-${size} h-${size} rounded-full object-cover flex-shrink-0`} alt="" />;
  }
  return (
    <div className={`w-${size} h-${size} rounded-full bg-orange-200 flex items-center justify-center text-sm font-bold text-orange-700 flex-shrink-0`}>
      {user?.firstName?.[0] || '?'}
    </div>
  );
}

function VoteButtons({ score, onVote }: { score: number; onVote: (v: number) => void }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <button onClick={() => onVote(1)} className="p-1 rounded hover:bg-orange-100 text-gray-400 hover:text-orange-500 transition">
        <ChevronUp className="w-4 h-4" />
      </button>
      <span className="text-xs font-bold text-gray-700 min-w-[20px] text-center">{score}</span>
      <button onClick={() => onVote(-1)} className="p-1 rounded hover:bg-blue-100 text-gray-400 hover:text-blue-500 transition">
        <ChevronDown className="w-4 h-4" />
      </button>
    </div>
  );
}

function PostCard({ post, showBoard = false, onClick }: { post: Post; showBoard?: boolean; onClick?: () => void }) {
  const [score, setScore] = useState(post.voteScore);

  const handleVote = async (value: number) => {
    try {
      const { data } = await api.post(`/boards/post/${post.id}/vote`, { value });
      setScore(data.voteScore);
    } catch (e) { console.error(e); }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 hover:border-orange-200 transition overflow-hidden">
      <div className="flex gap-3 p-4">
        <VoteButtons score={score} onVote={handleVote} />
        <div className="flex-1 min-w-0">
          {showBoard && post.board && (
            <Link to={`/community/${post.board.slug}`} className="inline-flex items-center gap-1 text-xs font-semibold mb-1.5 hover:underline" style={{ color: post.board.color }}>
              <span>{post.board.icon}</span>
              <span>{post.board.name}</span>
            </Link>
          )}
          <button onClick={onClick} className="text-left w-full">
            <h3 className="font-semibold text-gray-900 text-sm leading-snug hover:text-orange-600 transition line-clamp-2">{post.title}</h3>
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{post.body}</p>
          </button>
          <div className="flex items-center gap-3 mt-2.5 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Avatar user={post.author} size={5} />
              <span className="text-xs text-gray-500">{post.author.firstName} {post.author.lastName}</span>
            </div>
            <span className="text-xs text-gray-400">{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}</span>
            <button onClick={onClick} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{post.commentCount || post._count?.comments || 0} comments</span>
            </button>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{POST_TYPES.find(t => t.value === post.postType)?.label || post.postType}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreatePostModal({ boards, defaultSlug, onClose, onCreated }: { boards: Board[]; defaultSlug?: string; onClose: () => void; onCreated: (post: Post) => void }) {
  const [slug, setSlug] = useState(defaultSlug || '');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [postType, setPostType] = useState('DISCUSSION');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!slug || !title.trim() || !body.trim()) return;
    setSubmitting(true);
    try {
      const { data } = await api.post(`/boards/${slug}/posts`, { title, body, postType });
      onCreated(data.post);
      onClose();
    } catch (e) { console.error(e); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">New Post</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Board</label>
            <select value={slug} onChange={e => setSlug(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
              <option value="">Choose a board...</option>
              {boards.map(b => <option key={b.slug} value={b.slug}>{b.icon} {b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Post Type</label>
            <div className="flex flex-wrap gap-2">
              {POST_TYPES.map(t => (
                <button key={t.value} onClick={() => setPostType(t.value)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition ${postType === t.value ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" maxLength={200}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
          <div>
            <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="What's on your mind?" rows={5}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
          </div>
          <button onClick={handleSubmit} disabled={!slug || !title.trim() || !body.trim() || submitting}
            className="w-full bg-orange-500 text-white font-semibold py-2.5 rounded-xl hover:bg-orange-600 disabled:opacity-50 transition">
            {submitting ? 'Posting...' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PostDetail({ postId, onBack }: { postId: string; onBack: () => void }) {
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [commentBody, setCommentBody] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const { user } = useAuth() as any;

  useEffect(() => {
    api.get(`/boards/post/${postId}`)
      .then(({ data }) => setPost(data.post))
      .finally(() => setLoading(false));
  }, [postId]);

  const submitComment = async (parentId?: string) => {
    const body = parentId ? replyBody : commentBody;
    if (!body.trim()) return;
    try {
      const { data } = await api.post(`/boards/post/${postId}/comments`, { body, parentId });
      setPost((p: any) => ({
        ...p,
        commentCount: p.commentCount + 1,
        comments: parentId
          ? p.comments.map((c: any) => c.id === parentId ? { ...c, replies: [...c.replies, data.comment] } : c)
          : [...p.comments, { ...data.comment, replies: [] }],
      }));
      if (parentId) { setReplyingTo(null); setReplyBody(''); }
      else setCommentBody('');
    } catch (e) { console.error(e); }
  };

  const voteComment = async (commentId: string, value: number) => {
    try {
      await api.post(`/boards/comment/${commentId}/vote`, { value });
    } catch (e) { console.error(e); }
  };

  if (loading) return <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />;
  if (!post) return <div className="text-gray-500 text-center py-8">Post not found</div>;

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4 transition">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-4">
        <div className="flex gap-3 p-5">
          <VoteButtons score={post.voteScore} onVote={async (v) => {
            const { data } = await api.post(`/boards/post/${postId}/vote`, { value: v });
            setPost((p: any) => ({ ...p, voteScore: data.voteScore }));
          }} />
          <div className="flex-1">
            {post.board && (
              <Link to={`/community/${post.board.slug}`} className="inline-flex items-center gap-1 text-xs font-semibold mb-2 hover:underline" style={{ color: post.board.color }}>
                <span>{post.board.icon}</span><span>{post.board.name}</span>
              </Link>
            )}
            <h1 className="text-lg font-bold text-gray-900 mb-2">{post.title}</h1>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{post.body}</p>
            <div className="flex items-center gap-3 mt-3">
              <Avatar user={post.author} size={5} />
              <span className="text-xs text-gray-500">{post.author.firstName} {post.author.lastName}</span>
              <span className="text-xs text-gray-400">{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Comments */}
      <div className="space-y-3 mb-4">
        {post.comments?.map((comment: Comment) => (
          <div key={comment.id} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex gap-3">
              <VoteButtons score={comment.voteScore} onVote={(v) => voteComment(comment.id, v)} />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Avatar user={comment.author} size={5} />
                  <span className="text-xs font-semibold text-gray-700">{comment.author.firstName}</span>
                  <span className="text-xs text-gray-400">{formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}</span>
                  {comment.isBestAnswer && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">⭐ Best Answer</span>}
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{comment.body}</p>
                <button onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                  className="text-xs text-gray-400 hover:text-orange-500 mt-1.5 transition">Reply</button>

                {replyingTo === comment.id && (
                  <div className="mt-2 flex gap-2">
                    <textarea value={replyBody} onChange={e => setReplyBody(e.target.value)} placeholder="Write a reply..." rows={2}
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
                    <button onClick={() => submitComment(comment.id)} className="px-3 py-1 bg-orange-500 text-white text-xs rounded-xl hover:bg-orange-600 transition self-end">Reply</button>
                  </div>
                )}

                {comment.replies?.length > 0 && (
                  <div className="mt-3 space-y-2 pl-4 border-l-2 border-gray-100">
                    {comment.replies.map((reply: Comment) => (
                      <div key={reply.id} className="flex gap-2">
                        <Avatar user={reply.author} size={5} />
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-semibold text-gray-700">{reply.author.firstName}</span>
                            <span className="text-xs text-gray-400">{formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}</span>
                          </div>
                          <p className="text-sm text-gray-700">{reply.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add comment */}
      {user && (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <textarea value={commentBody} onChange={e => setCommentBody(e.target.value)} placeholder="Add a comment..." rows={3}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none mb-2" />
          <button onClick={() => submitComment()} disabled={!commentBody.trim()}
            className="px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 disabled:opacity-50 transition">
            Comment
          </button>
        </div>
      )}
    </div>
  );
}

export default function CommunityPage() {
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth() as any;

  const [boards, setBoards] = useState<Board[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [activeBoard, setActiveBoard] = useState<Board | null>(null);
  const [sort, setSort] = useState<'hot' | 'new' | 'top'>('hot');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [searchResults, setSearchResults] = useState<Post[] | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    api.get('/boards').then(({ data }) => setBoards(data.boards));
  }, []);

  useEffect(() => {
    if (slug) {
      api.get(`/boards/${slug}`).then(({ data }) => setActiveBoard(data.board));
    } else {
      setActiveBoard(null);
    }
  }, [slug]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      setSearchParams(prev => { prev.delete('q'); return prev; }, { replace: true });
      return;
    }
    const timeout = setTimeout(async () => {
      setSearchParams(prev => { prev.set('q', searchQuery.trim()); return prev; }, { replace: true });
      setSearching(true);
      try {
        const endpoint = slug ? `/boards/${slug}/posts` : '/boards/posts/all';
        const { data } = await api.get(endpoint, { params: { search: searchQuery.trim() } });
        setSearchResults(data.posts);
      } catch (e) { console.error(e); }
      finally { setSearching(false); }
    }, 400);
    return () => clearTimeout(timeout);
  }, [searchQuery, slug]);

  const loadPosts = useCallback(async (cursor?: string) => {
    setLoading(true);
    try {
      const endpoint = slug ? `/boards/${slug}/posts` : '/boards/posts/all';
      const { data } = await api.get(endpoint, { params: { sort, limit: 20, cursor } });
      if (cursor) {
        setPosts(prev => [...prev, ...data.posts]);
      } else {
        setPosts(data.posts);
      }
      setNextCursor(data.nextCursor);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [slug, sort]);

  useEffect(() => {
    setSelectedPostId(null);
    setSearchQuery('');
    setSearchResults(null);
    loadPosts();
  }, [loadPosts]);

  const handlePostCreated = (post: Post) => {
    setPosts(prev => [post, ...prev]);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {activeBoard ? `${activeBoard.icon} ${activeBoard.name}` : '🏕️ Community'}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {activeBoard ? activeBoard.description : 'The RV Unicorn community — share, learn, laugh'}
            </p>
          </div>
          {user && (
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-xl font-semibold text-sm hover:bg-orange-600 transition shadow-sm">
              <Plus className="w-4 h-4" /> New Post
            </button>
          )}
        </div>

        <div className="flex gap-6">
          {/* Left sidebar — boards */}
          <div className="w-56 flex-shrink-0 hidden md:block">
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Boards</span>
              </div>
              <div className="py-1">
                <button
                  onClick={() => { navigate('/community'); setSelectedPostId(null); }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition ${!slug ? 'bg-orange-50 text-orange-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}>
                  <span>🏠</span><span>All Posts</span>
                </button>
                {boards.map(board => (
                  <button key={board.slug}
                    onClick={() => { navigate(`/community/${board.slug}`); setSelectedPostId(null); }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition ${slug === board.slug ? 'bg-orange-50 text-orange-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}>
                    <span>{board.icon}</span>
                    <span className="flex-1 text-left truncate">{board.name}</span>
                    {board.postCount > 0 && <span className="text-xs text-gray-400">{board.postCount}</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Search bar */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setSelectedPostId(null); }}
                placeholder={activeBoard ? `Search ${activeBoard.name}...` : 'Search all posts...'}
                className="w-full pl-10 pr-9 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {selectedPostId ? (
              <PostDetail postId={selectedPostId} onBack={() => setSelectedPostId(null)} />
            ) : searchResults !== null ? (
              /* Search results */
              searching ? (
                <div className="space-y-3">
                  {[1,2,3].map(i => <div key={i} className="h-24 bg-white rounded-xl border border-gray-100 animate-pulse" />)}
                </div>
              ) : searchResults.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                  <div className="text-4xl mb-3">🔍</div>
                  <p className="font-semibold text-gray-800 mb-1">No posts found for "{searchQuery}"</p>
                  <p className="text-sm text-gray-500 mb-4">Be the first to start this conversation!</p>
                  {user && (
                    <button onClick={() => { setShowCreate(true); }} className="bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-orange-600 transition">
                      Create Post
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500 font-semibold">
                    {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{searchQuery}"{activeBoard ? ` in ${activeBoard.name}` : ' across all boards'}
                  </p>
                  {searchResults.map(post => (
                    <PostCard key={post.id} post={post} showBoard={!slug} onClick={() => setSelectedPostId(post.id)} />
                  ))}
                </div>
              )
            ) : (
              <>
                {/* Sort tabs */}
                <div className="flex items-center gap-2 mb-4">
                  {[
                    { key: 'hot', label: 'Hot', icon: <Flame className="w-3.5 h-3.5" /> },
                    { key: 'new', label: 'New', icon: <Clock className="w-3.5 h-3.5" /> },
                    { key: 'top', label: 'Top', icon: <Trophy className="w-3.5 h-3.5" /> },
                  ].map(s => (
                    <button key={s.key} onClick={() => setSort(s.key as any)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition ${sort === s.key ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-orange-300'}`}>
                      {s.icon}{s.label}
                    </button>
                  ))}
                  <Link to="/badges" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition bg-white text-gray-600 border border-gray-200 hover:border-orange-300">
                    <Award className="w-3.5 h-3.5" /> Badges
                  </Link>
                  <Link to="/creators" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition bg-white text-gray-600 border border-gray-200 hover:border-orange-300">
                    <Trophy className="w-3.5 h-3.5" /> Creators
                  </Link>
                </div>

                {loading ? (
                  <div className="space-y-3">
                    {[1,2,3].map(i => <div key={i} className="h-24 bg-white rounded-xl border border-gray-100 animate-pulse" />)}
                  </div>
                ) : posts.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                    <div className="text-4xl mb-3">🔥</div>
                    <p className="font-semibold text-gray-800 mb-1">No posts yet</p>
                    <p className="text-sm text-gray-500 mb-4">Be the first to start the conversation!</p>
                    {user && (
                      <button onClick={() => setShowCreate(true)} className="bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-orange-600 transition">
                        Create First Post
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {posts.map(post => (
                      <PostCard key={post.id} post={post} showBoard={!slug} onClick={() => setSelectedPostId(post.id)} />
                    ))}
                    {nextCursor && (
                      <button onClick={() => loadPosts(nextCursor)} className="w-full py-3 text-sm text-orange-600 font-semibold hover:text-orange-700 transition">
                        Load more...
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {showCreate && (
        <CreatePostModal boards={boards} defaultSlug={slug} onClose={() => setShowCreate(false)} onCreated={handlePostCreated} />
      )}
    </div>
  );
}

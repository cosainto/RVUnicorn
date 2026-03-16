import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Flame, Send, Users, Plus, X, Check, ThumbsUp, MessageCircle, ChevronDown, ChevronUp, Utensils, Footprints, HelpCircle, Megaphone, RefreshCw } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";

// ─── Types ────────────────────────────────────────────────────
type PostType = "chat" | "meal" | "activity" | "rollcall" | "question" | "hitch_pulse" | "host_announcement";

interface CampfirePost {
  id: string;
  postType: PostType;
  content: string;
  metadata: any;
  isPinned: boolean;
  createdAt: string;
  author: { id: string; firstName: string; username: string; profilePicture: string | null; rvType?: string };
  likes: { userId: string }[];
  comments: CampfireComment[];
  rsvps: { userId: string; response: string; user: { firstName: string; profilePicture: string | null } }[];
  _count: { likes: number; comments: number; rsvps: number };
}

interface CampfireComment {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; firstName: string; username: string; profilePicture: string | null };
}

interface CampfireProps {
  campgroundId: string;
  campgroundName: string;
  isCheckedIn?: boolean;
  isAdmin?: boolean;
  onView?: () => void;
}

// ─── Post type config ─────────────────────────────────────────
const POST_TYPES: { type: PostType; emoji: string; label: string; placeholder: string; color: string }[] = [
  { type: "chat",      emoji: "💬", label: "Chat",     placeholder: "What's on your mind?",           color: "bg-gray-100 text-gray-700" },
  { type: "meal",      emoji: "🥘", label: "Cookout",  placeholder: "Hosting a meal? Invite neighbors!", color: "bg-orange-100 text-orange-700" },
  { type: "activity",  emoji: "🥾", label: "Activity", placeholder: "Planning a hike or activity?",    color: "bg-green-100 text-green-700" },
  { type: "rollcall",  emoji: "🙋", label: "Roll Call", placeholder: "Who's at the fire tonight?",    color: "bg-amber-100 text-amber-700" },
  { type: "question",  emoji: "❓", label: "Question", placeholder: "Ask the campground community...", color: "bg-blue-100 text-blue-700" },
];

const TYPE_STYLES: Record<PostType, { border: string; bg: string; badge: string }> = {
  chat:               { border: "border-gray-200",   bg: "bg-white",       badge: "bg-gray-100 text-gray-600" },
  meal:               { border: "border-orange-200", bg: "bg-orange-50",   badge: "bg-orange-100 text-orange-700" },
  activity:           { border: "border-green-200",  bg: "bg-green-50",    badge: "bg-green-100 text-green-700" },
  rollcall:           { border: "border-amber-200",  bg: "bg-amber-50",    badge: "bg-amber-100 text-amber-700" },
  question:           { border: "border-blue-200",   bg: "bg-blue-50",     badge: "bg-blue-100 text-blue-700" },
  hitch_pulse:        { border: "border-purple-200", bg: "bg-purple-50",   badge: "bg-purple-100 text-purple-700" },
  host_announcement:  { border: "border-red-200",    bg: "bg-red-50",      badge: "bg-red-100 text-red-700" },
};

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Post Card ────────────────────────────────────────────────
function PostCard({ post, currentUserId, onLike, onComment, onRsvp, onDelete }: {
  post: CampfirePost;
  currentUserId?: string;
  onLike: (id: string) => void;
  onComment: (id: string, text: string) => void;
  onRsvp: (id: string, response: string) => void;
  onDelete: (id: string) => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [showAllComments, setShowAllComments] = useState(false);
  const style = TYPE_STYLES[post.postType] || TYPE_STYLES.chat;
  const isLiked = post.likes?.some(l => l.userId === currentUserId);
  const myRsvp = post.rsvps?.find(r => r.userId === currentUserId);
  const typeConfig = POST_TYPES.find(t => t.type === post.postType);
  const isOwn = post.author.id === currentUserId;

  const visibleComments = showAllComments ? post.comments : post.comments?.slice(-2);

  return (
    <div className={`rounded-2xl border ${style.border} ${style.bg} overflow-hidden`}>
      {/* Post header */}
      <div className="p-3.5 pb-2">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Link to={`/profile/${post.author.username}`}>
              {post.author.profilePicture
                ? <img src={post.author.profilePicture} className="w-8 h-8 rounded-full object-cover" alt={post.author.firstName} />
                : <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-sm font-bold text-primary-600">{post.author.firstName[0]}</div>
              }
            </Link>
            <div>
              <div className="flex items-center gap-1.5">
                <Link to={`/profile/${post.author.username}`} className="text-sm font-semibold text-gray-800 hover:text-primary-600 transition">{post.author.firstName}</Link>
                {typeConfig && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${style.badge}`}>
                    {typeConfig.emoji} {typeConfig.label}
                  </span>
                )}
                {post.postType === "hitch_pulse" && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-purple-100 text-purple-700">🦄 Hitch Pulse</span>
                )}
                {post.isPinned && <span className="text-xs text-amber-600 font-medium">📌 Pinned</span>}
              </div>
              <p className="text-xs text-gray-400">{timeAgo(post.createdAt)}</p>
            </div>
          </div>
          {isOwn && (
            <button onClick={() => onDelete(post.id)} className="text-gray-300 hover:text-red-400 transition p-1">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Content */}
        <p className="text-sm text-gray-800 leading-relaxed">{post.content}</p>

        {/* Meal/Activity metadata */}
        {(post.postType === "meal" || post.postType === "activity") && post.metadata && (
          <div className="mt-2 flex flex-wrap gap-2">
            {post.metadata.time && (
              <span className="text-xs bg-white border border-gray-200 px-2 py-1 rounded-lg text-gray-600">🕐 {post.metadata.time}</span>
            )}
            {post.metadata.location && (
              <span className="text-xs bg-white border border-gray-200 px-2 py-1 rounded-lg text-gray-600">📍 {post.metadata.location}</span>
            )}
            {post.metadata.spots && (
              <span className="text-xs bg-white border border-gray-200 px-2 py-1 rounded-lg text-gray-600">👥 {post.metadata.spots} spots</span>
            )}
          </div>
        )}

        {/* RSVP section for meal/activity */}
        {(post.postType === "meal" || post.postType === "activity" || post.postType === "rollcall") && (
          <div className="mt-2.5">
            <div className="flex gap-1.5">
              {["going", "maybe"].map(resp => (
                <button key={resp} onClick={() => onRsvp(post.id, resp)}
                  className={`text-xs px-3 py-1 rounded-full border transition font-medium ${myRsvp?.response === resp ? "bg-primary-600 text-white border-primary-600" : "bg-white text-gray-600 border-gray-200 hover:border-primary-300"}`}>
                  {resp === "going" ? "✅ Count me in" : "🤔 Maybe"}
                </button>
              ))}
            </div>
            {post.rsvps?.length > 0 && (
              <div className="flex items-center gap-1.5 mt-2">
                <div className="flex -space-x-1">
                  {post.rsvps.filter(r => r.response === "going").slice(0, 4).map((r, i) => (
                    r.user.profilePicture
                      ? <img key={i} src={r.user.profilePicture} className="w-5 h-5 rounded-full border border-white object-cover" alt="" />
                      : <div key={i} className="w-5 h-5 rounded-full border border-white bg-green-200 flex items-center justify-center text-[9px] font-bold text-green-700">{r.user.firstName[0]}</div>
                  ))}
                </div>
                <span className="text-xs text-gray-500">
                  {post.rsvps.filter(r => r.response === "going").length} going
                  {post.rsvps.filter(r => r.response === "maybe").length > 0 && ` · ${post.rsvps.filter(r => r.response === "maybe").length} maybe`}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-3.5 py-2 border-t border-black/5 flex items-center gap-3">
        <button onClick={() => onLike(post.id)}
          className={`flex items-center gap-1 text-xs transition ${isLiked ? "text-primary-600 font-semibold" : "text-gray-400 hover:text-primary-500"}`}>
          <ThumbsUp className="w-3.5 h-3.5" />
          {post._count?.likes > 0 && <span>{post._count.likes}</span>}
        </button>
        <button onClick={() => setShowComments(s => !s)}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary-500 transition">
          <MessageCircle className="w-3.5 h-3.5" />
          {post._count?.comments > 0 && <span>{post._count.comments}</span>}
        </button>
      </div>

      {/* Comments */}
      {showComments && (
        <div className="px-3.5 pb-3 border-t border-black/5 pt-2 space-y-2">
          {post.comments?.length > 2 && !showAllComments && (
            <button onClick={() => setShowAllComments(true)} className="text-xs text-primary-500 hover:text-primary-700">
              View all {post.comments.length} comments
            </button>
          )}
          {visibleComments?.map(c => (
            <div key={c.id} className="flex gap-2">
              {c.user.profilePicture
                ? <img src={c.user.profilePicture} className="w-6 h-6 rounded-full object-cover shrink-0 mt-0.5" alt="" />
                : <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0 mt-0.5">{c.user.firstName[0]}</div>
              }
              <div className="flex-1 bg-white rounded-xl px-2.5 py-1.5 text-xs">
                <span className="font-semibold text-gray-700">{c.user.firstName} </span>
                <span className="text-gray-600">{c.content}</span>
              </div>
            </div>
          ))}
          <div className="flex gap-2 mt-2">
            <input value={commentText} onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && commentText.trim()) { onComment(post.id, commentText); setCommentText(""); } }}
              placeholder="Add a comment..."
              className="flex-1 text-xs bg-white border border-gray-200 rounded-xl px-3 py-1.5 focus:outline-none focus:border-primary-300" />
            <button onClick={() => { if (commentText.trim()) { onComment(post.id, commentText); setCommentText(""); } }}
              className="p-1.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition">
              <Send className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Hitch Pulse card ─────────────────────────────────────────
function HitchPulseCard({ campgroundId }: { campgroundId: string }) {
  const [pulse, setPulse] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [camperCount, setCamperCount] = useState(0);

  useEffect(() => {
    api.get(`/campfire/${campgroundId}/pulse`)
      .then(r => { setPulse(r.data.pulse || ""); setCamperCount(r.data.camperCount || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [campgroundId]);

  if (loading || !pulse) return null;

  return (
    <div className="bg-gradient-to-r from-purple-600 to-primary-600 rounded-2xl p-4 text-white">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">🦄</span>
        <div>
          <p className="font-bold text-sm">Hitch Pulse</p>
          {camperCount > 0 && <p className="text-white/70 text-xs">{camperCount} camper{camperCount !== 1 ? "s" : ""} here tonight</p>}
        </div>
      </div>
      <p className="text-sm leading-relaxed text-white/90">{pulse}</p>
    </div>
  );
}

// ─── Main Campfire component ──────────────────────────────────
export default function CampfireChannel({ campgroundId, campgroundName, isCheckedIn, isAdmin, onView }: CampfireProps) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<CampfirePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [selectedType, setSelectedType] = useState<PostType>("chat");
  const [content, setContent] = useState("");
  const [metadata, setMetadata] = useState<any>({});
  const [showComposer, setShowComposer] = useState(false);
  const [checkedInCampers, setCheckedInCampers] = useState<any[]>([]);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const pinnedPosts = posts.filter(p => p.isPinned || p.postType === "host_announcement");
  const livePosts = posts.filter(p => !p.isPinned && ["meal", "activity", "rollcall"].includes(p.postType));
  const chatPosts = posts.filter(p => !p.isPinned && ["chat", "question", "hitch_pulse"].includes(p.postType));

  useEffect(() => {
    loadPosts();
    loadCampers();
  }, [campgroundId]);

  const loadPosts = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/campfire/${campgroundId}/posts`);
      setPosts(data.posts || []);
    if (onView) onView();
    } catch {}
    finally { setLoading(false); }
  };

  const loadCampers = async () => {
    try {
      const { data } = await api.get(`/campgrounds/${campgroundId}/campers`);
      setCheckedInCampers(data.currentCampers || []);
    } catch {}
  };

  const handlePost = async () => {
    if (!content.trim() || posting) return;
    setPosting(true);
    try {
      await api.post(`/campfire/${campgroundId}/posts`, { postType: selectedType, content, metadata });
      setContent("");
      setMetadata({});
      setShowComposer(false);
      loadPosts();
    } catch {} finally { setPosting(false); }
  };

  const handleLike = async (postId: string) => {
    try {
      await api.post(`/campfire/${campgroundId}/posts/${postId}/like`);
      setPosts(prev => prev.map(p => {
        if (p.id !== postId) return p;
        const isLiked = p.likes?.some(l => l.userId === (user as any)?.id);
        return {
          ...p,
          likes: isLiked ? p.likes.filter(l => l.userId !== (user as any)?.id) : [...(p.likes || []), { userId: (user as any)?.id }],
          _count: { ...p._count, likes: isLiked ? p._count.likes - 1 : p._count.likes + 1 }
        };
      }));
    } catch {}
  };

  const handleComment = async (postId: string, text: string) => {
    try {
      const { data } = await api.post(`/campfire/${campgroundId}/posts/${postId}/comments`, { content: text });
      setPosts(prev => prev.map(p => p.id === postId
        ? { ...p, comments: [...(p.comments || []), data.comment], _count: { ...p._count, comments: p._count.comments + 1 } }
        : p
      ));
    } catch {}
  };

  const handleRsvp = async (postId: string, response: string) => {
    try {
      await api.post(`/campfire/${campgroundId}/posts/${postId}/rsvp`, { response });
      loadPosts();
    } catch {}
  };

  const handleDelete = async (postId: string) => {
    try {
      await api.delete(`/campfire/${campgroundId}/posts/${postId}`);
      setPosts(prev => prev.filter(p => p.id !== postId));
    } catch {}
  };

  const currentUserId = (user as any)?.id;
  const typeConfig = POST_TYPES.find(t => t.type === selectedType)!;

  return (
    <div className="space-y-4">
      {/* Who's at the fire */}
      {checkedInCampers.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <p className="text-sm font-bold text-gray-800">At the campground now</p>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">{checkedInCampers.length} camper{checkedInCampers.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {checkedInCampers.slice(0, 8).map((c: any, i: number) => (
              <Link key={i} to={`/profile/${c.user.username}`} className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-full px-2.5 py-1 hover:bg-green-100 transition">
                {c.user.profilePicture
                  ? <img src={c.user.profilePicture} className="w-5 h-5 rounded-full object-cover" alt="" />
                  : <div className="w-5 h-5 rounded-full bg-green-200 flex items-center justify-center text-xs font-bold text-green-700">{c.user.firstName[0]}</div>
                }
                <span className="text-xs font-medium text-green-800">{c.user.firstName}</span>
              </Link>
            ))}
            {checkedInCampers.length > 8 && (
              <span className="text-xs text-gray-400 flex items-center">+{checkedInCampers.length - 8} more</span>
            )}
          </div>
        </div>
      )}

      {/* Hitch Pulse */}
      <HitchPulseCard campgroundId={campgroundId} />

      {/* Composer */}
      {user ? (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {!showComposer ? (
            <button onClick={() => { setShowComposer(true); setTimeout(() => composerRef.current?.focus(), 100); }}
              className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition text-left">
              {(user as any).profilePicture
                ? <img src={(user as any).profilePicture} className="w-8 h-8 rounded-full object-cover shrink-0" alt="" />
                : <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-sm font-bold text-primary-600 shrink-0">{(user as any).firstName?.[0]}</div>
              }
              <span className="text-sm text-gray-400">What's happening at {campgroundName}?</span>
            </button>
          ) : (
            <div className="p-4">
              {/* Type selector */}
              <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
                {POST_TYPES.map(t => (
                  <button key={t.type} onClick={() => setSelectedType(t.type)}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full border whitespace-nowrap transition font-medium ${selectedType === t.type ? "bg-primary-600 text-white border-primary-600" : "bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300"}`}>
                    {t.emoji} {t.label}
                  </button>
                ))}
              </div>

              <textarea ref={composerRef} value={content} onChange={e => setContent(e.target.value)}
                placeholder={typeConfig.placeholder} rows={3}
                className="w-full text-sm border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-primary-300 resize-none" />

              {/* Meal/Activity extra fields */}
              {(selectedType === "meal" || selectedType === "activity") && (
                <div className="flex gap-2 mt-2">
                  <input placeholder="Time (e.g. 6pm)" value={metadata.time || ""}
                    onChange={e => setMetadata((m: any) => ({ ...m, time: e.target.value }))}
                    className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-primary-300" />
                  <input placeholder="Location (e.g. Site 14)" value={metadata.location || ""}
                    onChange={e => setMetadata((m: any) => ({ ...m, location: e.target.value }))}
                    className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-primary-300" />
                </div>
              )}

              <div className="flex items-center justify-between mt-3">
                <button onClick={() => { setShowComposer(false); setContent(""); setMetadata({}); }}
                  className="text-xs text-gray-400 hover:text-gray-600 transition">Cancel</button>
                <button onClick={handlePost} disabled={!content.trim() || posting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-xl hover:bg-primary-700 disabled:opacity-40 transition">
                  <Flame className="w-3.5 h-3.5" />
                  {posting ? "Posting..." : "Post to Campfire"}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center text-sm text-amber-800">
          <Link to="/login" className="font-semibold underline">Sign in</Link> to join the campfire at {campgroundName}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      )}

      {/* Zone 1: Pinned / Host Announcements */}
      {pinnedPosts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
            <span>📌</span> Pinned
          </p>
          {pinnedPosts.map(p => (
            <PostCard key={p.id} post={p} currentUserId={currentUserId}
              onLike={handleLike} onComment={handleComment} onRsvp={handleRsvp} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* Zone 2: Live Activity */}
      {livePosts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
            <span>🔥</span> Around the Fire
          </p>
          {livePosts.map(p => (
            <PostCard key={p.id} post={p} currentUserId={currentUserId}
              onLike={handleLike} onComment={handleComment} onRsvp={handleRsvp} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* Zone 3: Conversation */}
      {chatPosts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
            <span>💬</span> Campfire Chat
          </p>
          {chatPosts.map(p => (
            <PostCard key={p.id} post={p} currentUserId={currentUserId}
              onLike={handleLike} onComment={handleComment} onRsvp={handleRsvp} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && posts.length === 0 && (
        <div className="text-center py-12">
          <div className="text-5xl mb-3">🔥</div>
          <p className="font-bold text-gray-700 mb-1">The fire is ready</p>
          <p className="text-sm text-gray-500">Be the first to post at {campgroundName}!</p>
        </div>
      )}

      {/* Refresh */}
      {!loading && posts.length > 0 && (
        <button onClick={loadPosts} className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-gray-400 hover:text-primary-600 transition">
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      )}
    </div>
  );
}

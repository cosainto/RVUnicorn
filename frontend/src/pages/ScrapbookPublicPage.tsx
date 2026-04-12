import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Lock, Send, Play, X } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

const API = import.meta.env.VITE_API_URL || '';
const MOMENT_TAGS: Record<string, { label: string; icon: string }> = {
  BEST_MOMENT: { label: 'Best Moment', icon: '🔥' },
  FUNNIEST: { label: 'Funniest', icon: '😂' },
  MOST_UNEXPECTED: { label: 'Most Unexpected', icon: '😮' },
  BEST_VIEW: { label: 'Best View', icon: '🌅' },
  CAMPFIRE: { label: 'Around the Campfire', icon: '🔥' },
  BREAKDOWN: { label: 'The Breakdown', icon: '🛠️' },
  WILDLIFE: { label: 'Wildlife', icon: '🦅' },
  FOOD: { label: 'Food', icon: '🍽️' },
  FIRST_DAY: { label: 'First Day', icon: '🌅' },
  LAST_DAY: { label: 'Last Night', icon: '🌙' },
};
const EMOJIS = ['❤️', '🔥', '😂', '😮', '🏕️'];

function getVisitorId(): string {
  let id = localStorage.getItem('rv_visitor_id');
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('rv_visitor_id', id); }
  return id;
}

function getSessionToken(token: string): string | null {
  return sessionStorage.getItem(`scrapbook_session_${token}`);
}

function fetchScrapbook(token: string) {
  const headers: Record<string, string> = {};
  const session = getSessionToken(token);
  if (session) headers['Authorization'] = `Bearer ${session}`;
  return fetch(`${API}/api/scrapbook/public/${token}`, { headers });
}

export default function ScrapbookPublicPage() {
  const { token } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Password
  const [needsPassword, setNeedsPassword] = useState(false);
  const [passwordHint, setPasswordHint] = useState('');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [unlocking, setUnlocking] = useState(false);

  // Reactions
  const [reactions, setReactions] = useState<{ overall: Record<string, number>; perPhoto: Record<string, Record<string, number>> }>({ overall: {}, perPhoto: {} });

  // Comments
  const [comments, setComments] = useState<any[]>([]);
  const [commentName, setCommentName] = useState('');
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);

  // Video lightbox
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  useEffect(() => { loadPage(); }, [token]);

  async function loadPage() {
    setLoading(true);
    try {
      const res = await fetchScrapbook(token!);
      if (res.status === 401) {
        const d = await res.json();
        setNeedsPassword(true);
        setPasswordHint(d.hint || '');
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error();
      const d = await res.json();
      setData(d);
      setNeedsPassword(false);
      // Load reactions + comments
      loadReactions();
      loadComments();
    } catch { setError(true); }
    setLoading(false);
  }

  async function handleUnlock() {
    setUnlocking(true);
    setPasswordError('');
    try {
      const res = await fetch(`${API}/api/scrapbook/public/${token}/unlock`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const d = await res.json();
      if (d.unlocked) {
        sessionStorage.setItem(`scrapbook_session_${token}`, d.sessionToken);
        await loadPage();
      } else {
        setPasswordError('Incorrect password');
      }
    } catch { setPasswordError('Failed to unlock'); }
    setUnlocking(false);
  }

  async function loadReactions() {
    try {
      const res = await fetch(`${API}/api/scrapbook/public/${token}/reactions`);
      if (res.ok) setReactions(await res.json());
    } catch {}
  }

  async function loadComments() {
    try {
      const res = await fetch(`${API}/api/scrapbook/public/${token}/comments`);
      if (res.ok) { const d = await res.json(); setComments(d.comments || []); }
    } catch {}
  }

  async function react(emoji: string, photoId?: string) {
    try {
      await fetch(`${API}/api/scrapbook/public/${token}/react`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji, photoId, visitorId: getVisitorId() }),
      });
      loadReactions();
    } catch {}
  }

  async function postComment() {
    if (!commentText.trim() || !commentName.trim()) return;
    setPosting(true);
    try {
      const res = await fetch(`${API}/api/scrapbook/public/${token}/comments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: commentText.trim(), guestName: commentName.trim(), visitorId: getVisitorId() }),
      });
      if (res.ok) {
        setCommentText('');
        loadComments();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to post');
      }
    } catch {}
    setPosting(false);
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0F1C35' }}>
      <div className="text-2xl animate-pulse" style={{ color: '#E8A838' }}>📸</div>
    </div>
  );

  // Password gate
  if (needsPassword) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4" style={{ background: '#0F1C35' }}>
      <Lock className="w-10 h-10" style={{ color: '#E8A838' }} />
      <h1 className="text-lg font-bold" style={{ color: '#F5F0E8' }}>This scrapbook is private</h1>
      <div className="w-full max-w-xs space-y-3">
        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleUnlock()}
          placeholder="Enter password" autoFocus
          className="w-full rounded-xl px-4 py-3 text-sm outline-none" style={{ background: '#1a2d4a', border: '1px solid rgba(232,168,56,0.3)', color: '#F5F0E8' }} />
        {passwordHint && <p className="text-xs text-center" style={{ color: 'rgba(245,240,232,0.5)' }}>Hint: "{passwordHint}"</p>}
        {passwordError && <p className="text-xs text-red-400 text-center">{passwordError}</p>}
        <button onClick={handleUnlock} disabled={unlocking || !password}
          className="w-full py-3 rounded-xl text-sm font-bold transition disabled:opacity-50" style={{ background: '#E8A838', color: '#0F1C35' }}>
          {unlocking ? 'Unlocking...' : 'View Scrapbook →'}
        </button>
      </div>
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: '#0F1C35' }}>
      <p className="text-lg font-semibold" style={{ color: '#F5F0E8' }}>This scrapbook isn't available</p>
      <Link to="/" className="text-sm font-semibold px-4 py-2 rounded-xl" style={{ background: '#E8A838', color: '#0F1C35' }}>Go to RVUnicorn →</Link>
    </div>
  );

  const firstPhoto = data.pins[0]?.photoUrl;
  const dateRange = data.tripDates?.start && data.tripDates?.end
    ? `${format(new Date(data.tripDates.start), 'MMM d')} – ${format(new Date(data.tripDates.end), 'MMM d, yyyy')}`
    : '';

  return (
    <>
      <Helmet>
        <title>{data.tripTitle} — RVUnicorn Scrapbook</title>
        <meta name="description" content={`${data.ownerName}'s trip to ${data.campgroundName || 'the campground'}${data.campgroundState ? ', ' + data.campgroundState : ''} · ${data.totalPins} memories`} />
        <meta property="og:title" content={`${data.tripTitle} — RVUnicorn Scrapbook`} />
        <meta property="og:description" content={`${data.ownerName}'s trip · ${data.totalPins} memories`} />
        {firstPhoto && <meta property="og:image" content={firstPhoto} />}
        <meta property="og:url" content={`https://www.rvunicorn.com/s/${token}`} />
      </Helmet>

      <div className="min-h-screen" style={{ background: '#0F1C35' }}>
        {/* Hero */}
        <div className="relative overflow-hidden" style={{ minHeight: 320 }}>
          {firstPhoto && (
            <div className="absolute inset-0">
              <img src={firstPhoto} className="w-full h-full object-cover" style={{ filter: 'blur(20px) brightness(0.3)' }} alt="" />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(15,28,53,0.6), rgba(15,28,53,0.95))' }} />
            </div>
          )}
          <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 py-16">
            <h1 className="text-3xl sm:text-4xl font-bold mb-2" style={{ fontFamily: "'Playfair Display', serif", color: '#F5F0E8' }}>{data.tripTitle}</h1>
            {data.campgroundName && <p className="text-sm mb-1" style={{ color: 'rgba(245,240,232,0.7)' }}>{data.campgroundName}{data.campgroundState ? `, ${data.campgroundState}` : ''}</p>}
            {dateRange && <p className="text-xs mb-4" style={{ color: 'rgba(245,240,232,0.5)' }}>{dateRange}</p>}
            {data.rigMake && <p className="text-xs mb-4" style={{ color: 'rgba(245,240,232,0.4)' }}>🚐 {data.rigYear ? `${data.rigYear} ` : ''}{data.rigMake}</p>}
            <div className="flex items-center gap-2">
              {data.ownerAvatarUrl ? <img src={data.ownerAvatarUrl} className="w-8 h-8 rounded-full object-cover" style={{ border: '2px solid rgba(232,168,56,0.4)' }} alt="" /> :
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: '#E8A838', color: '#0F1C35' }}>{data.ownerName[0]}</div>}
              <span className="text-sm" style={{ color: 'rgba(245,240,232,0.7)' }}>A scrapbook by {data.ownerName}</span>
            </div>
          </div>
        </div>

        {/* Overall Reactions Bar */}
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3 flex-wrap">
            {EMOJIS.map(e => (
              <button key={e} onClick={() => react(e)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm transition hover:scale-110"
                style={{ background: 'rgba(255,255,255,0.08)', color: '#F5F0E8' }}>
                {e} <span className="text-xs font-semibold">{reactions.overall[e] || 0}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Pins Grid */}
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div style={{ columns: window.innerWidth < 640 ? 2 : 3, columnGap: '12px' }}>
            {data.pins.map((pin: any, i: number) => {
              const tag = pin.momentTag ? MOMENT_TAGS[pin.momentTag] : null;
              const isVideo = pin.mediaType === 'VIDEO';
              return (
                <div key={pin.photoId} className="break-inside-avoid mb-3" style={{ animation: `fadeIn 0.4s ease-out ${i * 0.08}s both` }}>
                  <div className="rounded-xl overflow-hidden relative cursor-pointer group" onClick={() => isVideo && pin.videoUrl ? setVideoUrl(pin.videoUrl) : undefined}>
                    <img src={isVideo && pin.videoThumbUrl ? pin.videoThumbUrl : pin.photoUrl} alt={pin.caption || ''} className="w-full" loading="lazy" />
                    {isVideo && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition">
                        <Play className="w-10 h-10 text-white drop-shadow-lg" fill="white" />
                        {pin.videoDuration && (
                          <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                            {Math.floor(pin.videoDuration / 60)}:{String(pin.videoDuration % 60).padStart(2, '0')}
                          </span>
                        )}
                      </div>
                    )}
                    {tag && (
                      <div className="absolute bottom-2 left-2 rounded-full px-2 py-0.5 text-xs text-white font-semibold backdrop-blur-sm" style={{ background: 'rgba(0,0,0,0.6)' }}>
                        {tag.icon} {tag.label}
                      </div>
                    )}
                  </div>
                  {pin.caption && <p className="text-xs italic mt-1.5 px-1" style={{ color: 'rgba(245,240,232,0.6)' }}>{pin.caption}</p>}
                  {/* Per-photo reactions */}
                  <div className="flex items-center gap-1 mt-1 px-1">
                    {EMOJIS.slice(0, 3).map(e => {
                      const count = reactions.perPhoto[pin.photoId]?.[e] || 0;
                      return count > 0 ? <span key={e} className="text-[10px]" style={{ color: 'rgba(245,240,232,0.4)' }}>{e}{count}</span> : null;
                    })}
                    <button onClick={() => react('❤️', pin.photoId)} className="text-[10px] ml-auto" style={{ color: 'rgba(245,240,232,0.3)' }}>+ React</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Comments Section */}
        <div className="max-w-4xl mx-auto px-4 py-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <h3 className="text-sm font-bold mb-4" style={{ color: '#F5F0E8' }}>💬 Comments ({comments.length})</h3>

          <div className="flex gap-2 mb-4">
            <input value={commentName} onChange={e => setCommentName(e.target.value)} placeholder="Your name"
              className="w-28 text-xs rounded-lg px-3 py-2 outline-none" style={{ background: '#1a2d4a', border: '1px solid rgba(255,255,255,0.1)', color: '#F5F0E8' }} />
            <input value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Leave a comment..."
              onKeyDown={e => e.key === 'Enter' && postComment()}
              className="flex-1 text-xs rounded-lg px-3 py-2 outline-none" style={{ background: '#1a2d4a', border: '1px solid rgba(255,255,255,0.1)', color: '#F5F0E8' }} />
            <button onClick={postComment} disabled={posting || !commentText.trim() || !commentName.trim()}
              className="px-3 py-2 rounded-lg transition disabled:opacity-50" style={{ background: '#E8A838', color: '#0F1C35' }}>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {comments.map((c: any) => (
              <div key={c.id} className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ background: 'rgba(232,168,56,0.2)', color: '#E8A838' }}>
                  {(c.user?.firstName || c.guestName || '?')[0]}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold" style={{ color: '#F5F0E8' }}>{c.user?.firstName || c.guestName}</span>
                    <span className="text-[10px]" style={{ color: 'rgba(245,240,232,0.3)' }}>{formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}</span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(245,240,232,0.7)' }}>{c.content}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer CTA */}
        <div className="text-center py-12 px-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <img src="/images/Logo_RVUnicorn.png" className="w-10 h-10 mx-auto mb-3 opacity-60" alt="RVUnicorn" />
          <p className="text-sm mb-4" style={{ color: 'rgba(245,240,232,0.5)' }}>Create your own RV travel scrapbook</p>
          <Link to="/register" className="inline-block px-6 py-2.5 rounded-xl text-sm font-bold transition hover:brightness-110" style={{ background: '#E8A838', color: '#0F1C35' }}>Join RVUnicorn →</Link>
        </div>
      </div>

      {/* Video Lightbox */}
      {videoUrl && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setVideoUrl(null)}>
          <button className="absolute top-4 right-4 text-white/70 hover:text-white"><X className="w-8 h-8" /></button>
          <video src={videoUrl} controls autoPlay className="max-w-3xl w-full max-h-[80vh] rounded-2xl" onClick={e => e.stopPropagation()} />
        </div>
      )}

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </>
  );
}

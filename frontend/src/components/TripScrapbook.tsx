import { useState, useEffect, useCallback, useRef } from 'react';
import { BookOpen, Pin, PinOff, Plus, X, Edit2, Check, Image, Sparkles, RefreshCw, Trash2, Globe, Lock, ExternalLink, Copy, Share2, Link2, Zap, Upload, Camera, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import ImageUpload from './ImageUpload';

/* ── Hero Photo Viewer — featured tab ── */
const REACTION_EMOJIS = ['❤️', '🔥', '😂', '😍', '🏕️', '🚐', '⭐'];

function HeroPhotoViewer({ photos, pinnedIds, startIndex, canPin, onPin, onUnpin, onTapPhoto, user }: {
  photos: any[]; pinnedIds: Set<string>; startIndex: number; canPin: boolean;
  onPin: (id: string) => void; onUnpin: (id: string) => void; onTapPhoto: (p: any) => void; user: any;
}) {
  const [idx, setIdx] = useState(startIndex);
  const [touchStart, setTouchStart] = useState(0);
  const [reactions, setReactions] = useState<Record<string, number>>({});
  const [myReactions, setMyReactions] = useState<Set<string>>(new Set());
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<any[]>([]);
  const [showComments, setShowComments] = useState(false);
  const photo = photos[idx];
  if (!photo) return null;

  // Load reactions & comments when photo changes
  useEffect(() => {
    setReactions({});
    setMyReactions(new Set());
    setComments([]);
    if (!photo?.id) return;
    api.get(`/photos/${photo.id}/reactions`).then(r => {
      const counts: Record<string, number> = {};
      const mine = new Set<string>();
      (r.data || []).forEach((rx: any) => {
        counts[rx.emoji] = (counts[rx.emoji] || 0) + 1;
        if (rx.userId === user?.id) mine.add(rx.emoji);
      });
      setReactions(counts);
      setMyReactions(mine);
    }).catch(() => {});
    api.get(`/comments?photoId=${photo.id}`).then(r => setComments(r.data || [])).catch(() => {});
  }, [idx, photo?.id]);

  const toggleReaction = async (emoji: string) => {
    if (!photo?.id) return;
    const had = myReactions.has(emoji);
    // Optimistic update
    setMyReactions(prev => { const next = new Set(prev); had ? next.delete(emoji) : next.add(emoji); return next; });
    setReactions(prev => ({ ...prev, [emoji]: Math.max(0, (prev[emoji] || 0) + (had ? -1 : 1)) }));
    try {
      if (had) await api.delete(`/photos/${photo.id}/reactions/${encodeURIComponent(emoji)}`);
      else await api.post(`/photos/${photo.id}/reactions`, { emoji });
    } catch {}
  };

  const heroSubmitRef = useRef(false);
  const submitComment = async () => {
    if (!commentText.trim() || !photo?.id || heroSubmitRef.current) return;
    heroSubmitRef.current = true;
    const text = commentText.trim();
    const tempId = 'temp-' + Date.now();
    setComments(prev => [...prev, { id: tempId, content: text, user: { firstName: user?.firstName, profilePicture: user?.profilePicture, id: user?.id } }]);
    setCommentText('');
    try {
      const { data } = await api.post('/comments', { photoId: photo.id, content: text });
      setComments(prev => prev.map(c => c.id === tempId ? { ...data, user: data.user || { firstName: user?.firstName, profilePicture: user?.profilePicture, id: user?.id } } : c));
    } catch {
      setComments(prev => prev.filter(c => c.id !== tempId));
      setCommentText(text);
    } finally { heroSubmitRef.current = false; }
  };

  const isPinned = pinnedIds.has(photo.id);
  const goNext = () => setIdx(i => (i + 1) % photos.length);
  const goPrev = () => setIdx(i => (i - 1 + photos.length) % photos.length);

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'ArrowRight') goNext(); if (e.key === 'ArrowLeft') goPrev(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div>
      {/* Photo with arrows */}
      <div className="relative rounded-2xl overflow-hidden flex items-center justify-center" style={{ maxHeight: 500, minHeight: 200, background: '#0F1C35' }}
        onTouchStart={e => setTouchStart(e.touches[0].clientX)}
        onTouchEnd={e => { const d = e.changedTouches[0].clientX - touchStart; if (d > 50) goPrev(); if (d < -50) goNext(); }}>
        <img src={photo.imageUrl} alt="" className="cursor-pointer" onClick={() => onTapPhoto(photo)} style={{ maxWidth: '100%', maxHeight: 500, objectFit: 'contain', transition: 'opacity 0.2s' }} />

        {/* Badge */}
        <div className="absolute top-3 left-3">
          {isPinned
            ? <span className="px-2.5 py-1 rounded-full text-[10px] font-bold" style={{ background: 'rgba(201,168,76,0.2)', color: '#C9A84C', border: '1px solid rgba(201,168,76,0.4)' }}>⭐ Featured</span>
            : <span className="px-2.5 py-1 rounded-full text-[10px] font-medium" style={{ background: 'rgba(0,0,0,0.5)', color: 'rgba(255,255,255,0.7)' }}>Photo {idx + 1} of {photos.length}</span>
          }
        </div>

        {/* Arrows */}
        {photos.length > 1 && (<>
          <button onClick={goPrev} className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center transition hover:bg-black/60" style={{ background: 'rgba(0,0,0,0.4)' }}>
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <button onClick={goNext} className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center transition hover:bg-black/60" style={{ background: 'rgba(0,0,0,0.4)' }}>
            <ChevronRight className="w-5 h-5 text-white" />
          </button>
        </>)}
      </div>

      {/* Info + actions */}
      <div className="mt-3 flex items-center justify-between">
        <div>
          <p className="text-xs" style={{ color: '#8B9BB4' }}>
            {photo.caption || <span className="italic opacity-60">No caption</span>}
          </p>
          {photo.user && <p className="text-[10px] mt-0.5" style={{ color: 'rgba(148,163,184,0.5)' }}>📷 {photo.user.firstName || 'Unknown'}</p>}
        </div>
        {canPin && (
          <button onClick={() => isPinned ? onUnpin(photo.id) : onPin(photo.id)}
            className="text-xs px-2.5 py-1 rounded-full transition" style={{
              background: isPinned ? 'rgba(201,168,76,0.15)' : 'rgba(148,163,184,0.1)',
              color: isPinned ? '#C9A84C' : '#8B9BB4',
              border: isPinned ? '1px solid rgba(201,168,76,0.3)' : '1px solid rgba(148,163,184,0.15)',
            }}>
            {isPinned ? '⭐ Featured' : '☆ Feature this'}
          </button>
        )}
      </div>

      {/* Emoji reactions */}
      <div className="flex gap-1.5 flex-wrap mt-3">
        {REACTION_EMOJIS.map(emoji => {
          const count = reactions[emoji] || 0;
          const mine = myReactions.has(emoji);
          return (
            <button key={emoji} onClick={() => toggleReaction(emoji)}
              className="flex items-center gap-1 px-2 py-1 rounded-full text-sm transition"
              style={{
                background: mine ? 'rgba(201,168,76,0.2)' : 'rgba(255,255,255,0.05)',
                border: mine ? '1px solid #C9A84C' : '1px solid rgba(255,255,255,0.1)',
              }}>
              {emoji}{count > 0 && <span className="text-[10px]" style={{ color: mine ? '#C9A84C' : '#8B9BB4' }}>{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Comments */}
      <div className="mt-3">
        <button onClick={() => setShowComments(!showComments)} className="text-xs flex items-center gap-1 mb-2" style={{ color: '#8B9BB4' }}>
          💬 {comments.length > 0 ? `${comments.length} comment${comments.length !== 1 ? 's' : ''}` : 'Add a comment'}
        </button>
        {showComments && (
          <div className="space-y-2">
            {comments.slice(0, 5).map((c: any) => (
              <div key={c.id} className="flex gap-2">
                <div className="w-6 h-6 rounded-full flex-shrink-0 overflow-hidden" style={{ background: '#243352' }}>
                  {c.user?.profilePicture ? <img src={c.user.profilePicture} className="w-full h-full object-cover" alt="" /> : <span className="w-full h-full flex items-center justify-center text-[9px] font-bold" style={{ color: '#8B9BB4' }}>{c.user?.firstName?.[0]}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold" style={{ color: '#C9A84C' }}>{c.user?.firstName || 'User'}</span>
                  <span className="text-xs ml-1.5" style={{ color: '#F5F0E8' }}>{c.content}</span>
                  {c.user?.id === user?.id && <button onClick={async () => { await api.delete(`/comments/${c.id}`).catch(() => {}); setComments(prev => prev.filter(x => x.id !== c.id)); }} className="text-[10px] ml-2" style={{ color: '#EF4444' }}>Delete</button>}
                </div>
              </div>
            ))}
            <div className="flex gap-2 mt-1">
              <input value={commentText} onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitComment()}
                placeholder="Add a comment..." className="flex-1 text-xs rounded-full px-3 py-1.5"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#F5F0E8' }} />
              <button onClick={submitComment} disabled={!commentText.trim()} className="text-xs font-semibold px-3 py-1.5 rounded-full disabled:opacity-30" style={{ background: '#E8622A', color: 'white' }}>Post</button>
            </div>
          </div>
        )}
      </div>

      {/* Dot indicators (max 10) */}
      {photos.length <= 10 ? (
        <div className="flex justify-center gap-1.5 mt-3">
          {photos.map((p, i) => (
            <button key={p.id} onClick={() => setIdx(i)} className="w-2 h-2 rounded-full transition" style={{
              background: i === idx ? '#C9A84C' : pinnedIds.has(p.id) ? 'rgba(201,168,76,0.4)' : 'rgba(148,163,184,0.3)',
            }} />
          ))}
        </div>
      ) : (
        <p className="text-center text-[10px] mt-3" style={{ color: 'rgba(148,163,184,0.4)' }}>{idx + 1} of {photos.length}</p>
      )}
    </div>
  );
}
import HitchPhotoCaptions from './HitchPhotoCaptions';
import EventPhotoTagger from './EventPhotoTagger';

const MOMENT_TAGS = [
  { key: 'BEST_MOMENT', label: 'Best', icon: '🔥' },
  { key: 'FUNNIEST', label: 'Funniest', icon: '😂' },
  { key: 'BEST_VIEW', label: 'View', icon: '🌅' },
  { key: 'MOST_UNEXPECTED', label: 'Unexpected', icon: '😮' },
  { key: 'CAMPFIRE', label: 'Fire', icon: '🔥' },
  { key: 'BREAKDOWN', label: 'Breakdown', icon: '🛠️' },
  { key: 'WILDLIFE', label: 'Wildlife', icon: '🦅' },
  { key: 'FOOD', label: 'Food', icon: '🍽️' },
];

interface Pin {
  id: string;
  photoId: string;
  caption: string | null;
  position: number;
  photo: {
    id: string;
    imageUrl: string;
    caption: string | null;
    createdAt: string;
    user: { id: string; username: string; firstName: string; lastName: string; profilePicture: string | null };
  };
  pinnedBy: { id: string; username: string; firstName: string; profilePicture: string | null };
}

interface EventPhoto {
  id: string;
  imageUrl: string;
  caption: string | null;
  createdAt: string;
  user: { id: string; username: string; firstName: string; profilePicture: string | null };
  scrapbookPins: { id: string }[];
}

/* ── Fullscreen Photo Viewer ── */
function FullscreenPhotoViewer({ photos, startIndex, pinnedIds, canPin, onPin, onUnpin, user, onClose }: {
  photos: any[]; startIndex: number; pinnedIds: Set<string>; canPin: boolean;
  onPin: (id: string) => void; onUnpin: (id: string) => void; user: any; onClose: () => void;
}) {
  const [idx, setIdx] = useState(startIndex);
  const [touchStart, setTouchStart] = useState(0);
  const [reactions, setReactions] = useState<Record<string, number>>({});
  const [myReactions, setMyReactions] = useState<Set<string>>(new Set());
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const submittingRef = useRef(false);
  const photo = photos[idx];

  const goNext = useCallback(() => setIdx(i => (i + 1) % photos.length), [photos.length]);
  const goPrev = useCallback(() => setIdx(i => (i - 1 + photos.length) % photos.length), [photos.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev, onClose]);

  // Load reactions + comments per photo
  useEffect(() => {
    if (!photo?.id) return;
    setReactions({}); setMyReactions(new Set()); setComments([]);
    api.get(`/photos/${photo.id}/reactions`).then(r => {
      const counts: Record<string, number> = {};
      const mine = new Set<string>();
      (r.data || []).forEach((rx: any) => { counts[rx.emoji] = (counts[rx.emoji] || 0) + 1; if (rx.userId === user?.id) mine.add(rx.emoji); });
      setReactions(counts); setMyReactions(mine);
    }).catch(() => {});
    api.get(`/comments?photoId=${photo.id}`).then(r => setComments(r.data || [])).catch(() => {});
  }, [idx, photo?.id]);

  const toggleReaction = async (emoji: string) => {
    const had = myReactions.has(emoji);
    setMyReactions(prev => { const n = new Set(prev); had ? n.delete(emoji) : n.add(emoji); return n; });
    setReactions(prev => ({ ...prev, [emoji]: Math.max(0, (prev[emoji] || 0) + (had ? -1 : 1)) }));
    try { had ? await api.delete(`/photos/${photo.id}/reactions/${encodeURIComponent(emoji)}`) : await api.post(`/photos/${photo.id}/reactions`, { emoji }); } catch {}
  };

  const submitComment = async () => {
    if (!commentText.trim() || submittingRef.current) return;
    submittingRef.current = true;
    const text = commentText.trim();
    const tempId = 'temp-' + Date.now();
    // Optimistic add
    setComments(prev => [...prev, { id: tempId, content: text, user: { firstName: user?.firstName, profilePicture: user?.profilePicture, id: user?.id }, createdAt: new Date().toISOString() }]);
    setCommentText('');
    try {
      const { data } = await api.post('/comments', { photoId: photo.id, content: text });
      // Replace temp with real
      setComments(prev => prev.map(c => c.id === tempId ? { ...data, user: data.user || { firstName: user?.firstName, profilePicture: user?.profilePicture, id: user?.id } } : c));
    } catch {
      setComments(prev => prev.filter(c => c.id !== tempId));
      setCommentText(text);
    } finally {
      submittingRef.current = false;
    }
  };

  if (!photo) return null;
  const isPinned = pinnedIds.has(photo.id);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col" style={{ background: 'rgba(0,0,0,0.95)' }}
      onTouchStart={e => setTouchStart(e.touches[0].clientX)}
      onTouchEnd={e => { const d = e.changedTouches[0].clientX - touchStart; if (d > 50) goPrev(); if (d < -50) goNext(); }}>

      {/* Close */}
      <button onClick={onClose} className="absolute top-4 right-4 z-50 w-11 h-11 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.1)' }}>
        <X className="w-6 h-6 text-white" />
      </button>

      {/* Photo */}
      <div className="flex-1 flex items-center justify-center relative px-16">
        <img src={photo.imageUrl} alt="" className="max-w-[90vw] max-h-[75vh] object-contain rounded-lg" />

        {/* Arrows */}
        {photos.length > 1 && (<>
          <button onClick={goPrev} className="absolute left-4 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full flex items-center justify-center transition hover:bg-white/20" style={{ background: 'rgba(255,255,255,0.1)' }}>
            <ChevronLeft className="w-7 h-7 text-white" />
          </button>
          <button onClick={goNext} className="absolute right-4 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full flex items-center justify-center transition hover:bg-white/20" style={{ background: 'rgba(255,255,255,0.1)' }}>
            <ChevronRight className="w-7 h-7 text-white" />
          </button>
        </>)}
      </div>

      {/* Bottom bar */}
      <div className="px-4 pb-4 pt-2 space-y-2" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)' }}>
        {/* Reactions */}
        <div className="flex gap-1.5 flex-wrap justify-center">
          {REACTION_EMOJIS.map(emoji => (
            <button key={emoji} onClick={() => toggleReaction(emoji)}
              className="flex items-center gap-1 px-2 py-1 rounded-full text-sm transition"
              style={{ background: myReactions.has(emoji) ? 'rgba(201,168,76,0.3)' : 'rgba(255,255,255,0.1)', border: myReactions.has(emoji) ? '1px solid #C9A84C' : '1px solid rgba(255,255,255,0.15)' }}>
              {emoji}{(reactions[emoji] || 0) > 0 && <span className="text-[10px] text-white/70">{reactions[emoji]}</span>}
            </button>
          ))}
        </div>

        {/* Info row */}
        <div className="flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            {photo.user?.profilePicture ? <img src={photo.user.profilePicture} className="w-7 h-7 rounded-full object-cover" alt="" /> : <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: '#243352', color: '#8B9BB4' }}>{photo.user?.firstName?.[0]}</div>}
            <span className="text-xs text-white/70">{photo.user?.firstName}</span>
          </div>
          <span className="text-xs text-white/50">{idx + 1} of {photos.length}</span>
          {canPin && (
            <button onClick={() => isPinned ? onUnpin(photo.id) : onPin(photo.id)} className="text-xs px-2.5 py-1 rounded-full" style={{ background: isPinned ? 'rgba(201,168,76,0.2)' : 'rgba(255,255,255,0.1)', color: isPinned ? '#C9A84C' : 'white', border: isPinned ? '1px solid rgba(201,168,76,0.3)' : 'none' }}>
              {isPinned ? '⭐ Featured' : '☆ Feature'}
            </button>
          )}
        </div>

        {/* Comments — always visible */}
        <div className="rounded-xl px-4 py-2 space-y-1.5" style={{ maxHeight: '20vh', overflowY: 'auto' }}>
          {comments.map((c: any) => (
            <div key={c.id} className="flex gap-2 text-xs">
              <span className="font-semibold flex-shrink-0" style={{ color: '#C9A84C' }}>{c.user?.firstName}</span>
              <span className="text-white/80">{c.content}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2 px-4 pb-1 items-center">
          <input value={commentText} onChange={e => setCommentText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitComment(); } }}
            placeholder="Add a comment..."
            className="flex-1 min-w-0 text-xs rounded-full px-3 py-2" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', color: 'white' }} />
          <button onClick={submitComment} disabled={!commentText.trim()} className="flex-shrink-0 text-xs font-semibold px-4 py-2 rounded-full disabled:opacity-30 whitespace-nowrap" style={{ background: '#E8622A', color: 'white' }}>Post</button>
        </div>
      </div>
    </div>
  );
}

export default function TripScrapbook({ eventId, canPin, canUpload, campgroundName, eventTitle }: {
  eventId: string;
  canPin: boolean;
  canUpload?: boolean;
  campgroundName?: string;
  eventTitle?: string;
}) {
  const { user } = useAuth();
  const [pins, setPins] = useState<Pin[]>([]);
  const [photos, setPhotos] = useState<EventPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [editingPin, setEditingPin] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const [lightbox, setLightbox] = useState<Pin | null>(null);
  const [story, setStory] = useState<{ content: string; style: string; generatedAt: string } | null>(null);
  const [storyLoading, setStoryLoading] = useState(false);
  const [storyStyle, setStoryStyle] = useState<'narrative' | 'postcard' | 'funny'>('narrative');
  const [showStory, setShowStory] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareDone, setShareDone] = useState(false);

  // Scrapbook sharing
  const [shareUrl, setShareUrlState] = useState('');
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);

  // Hitch suggestions
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsHidden, setSuggestionsHidden] = useState(false);

  // Photo upload (merged from EventAlbum)
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadCaption, setUploadCaption] = useState('');
  const [uploadedUrl, setUploadedUrl] = useState('');
  const [viewMode, setViewMode] = useState<'featured' | 'all'>('featured');
  const [selectedPhoto, setSelectedPhoto] = useState<any>(null);

  useEffect(() => {
    loadScrapbook();
  }, [eventId]);

  const loadScrapbook = async () => {
    try {
      setLoading(true);
      const [pinsRes, photosRes, storyRes] = await Promise.all([
        api.get(`/scrapbook/${eventId}`),
        canPin ? api.get(`/scrapbook/${eventId}/photos`) : Promise.resolve({ data: [] }),
        api.get(`/trip-story/${eventId}`).catch(() => ({ data: null })),
      ]);
      setPins(pinsRes.data);
      setPhotos(photosRes.data);
      setStory(storyRes.data);
    } catch (e) {
      console.error('Load scrapbook error:', e);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch suggestions when scrapbook is empty
  useEffect(() => {
    if (!loading && pins.length === 0 && canPin && !suggestionsHidden && photos.length > 0) {
      fetchSuggestions();
    }
  }, [loading, pins.length, photos.length]);

  const fetchSuggestions = async () => {
    setSuggestionsLoading(true);
    try {
      const { data } = await api.post(`/scrapbook/${eventId}/suggest`);
      setSuggestions(data.suggestions || []);
    } catch {}
    setSuggestionsLoading(false);
  };

  const acceptSuggestion = async (photoId: string) => {
    try {
      const { data } = await api.post(`/scrapbook/${eventId}/suggest/${photoId}/accept`);
      setPins(prev => [...prev, data]);
      setSuggestions(prev => prev.filter(s => s.photoId !== photoId));
    } catch (e: any) {
      if (e.response?.status === 400) alert(e.response.data.error);
    }
  };

  const dismissSuggestion = async (photoId: string) => {
    try {
      await api.post(`/scrapbook/${eventId}/suggest/${photoId}/dismiss`);
      setSuggestions(prev => prev.filter(s => s.photoId !== photoId));
    } catch {}
  };

  const acceptAllSuggestions = async () => {
    try {
      const { data } = await api.post(`/scrapbook/${eventId}/suggest/accept-all`);
      await loadScrapbook();
      setSuggestions([]);
    } catch {}
  };

  const handleShare = async () => {
    setShareLoading(true);
    try {
      const { data } = await api.post(`/scrapbook/${eventId}/share`);
      setShareUrlState(data.shareUrl);
      setShowShareSheet(true);
    } catch { alert('Failed to create share link'); }
    setShareLoading(false);
  };

  const handleStopSharing = async () => {
    try {
      await api.delete(`/scrapbook/${eventId}/share`);
      setShareUrlState('');
      setShowShareSheet(false);
    } catch {}
  };

  const copyShareLink = async () => {
    try { await navigator.clipboard.writeText(shareUrl); } catch {
      const el = document.createElement('textarea'); el.value = shareUrl; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el);
    }
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const setMomentTag = async (photoId: string, tag: string | null) => {
    try {
      await api.patch(`/scrapbook/${eventId}/pin/${photoId}/tag`, { momentTag: tag });
      setPins(prev => prev.map(p => p.photoId === photoId ? { ...p, momentTag: tag } : p));
    } catch {}
  };

  // Upload handlers (merged from EventAlbum)
  const handleImageUploaded = (url: string) => setUploadedUrl(url);
  const handleSavePhoto = async () => {
    setShowUploadModal(false);
    setUploadCaption('');
    setUploadedUrl('');
    await loadScrapbook();
  };
  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm('Delete this photo?')) return;
    try { await api.delete(`/photos/${photoId}`); await loadScrapbook(); } catch { alert('Failed to delete photo'); }
  };

  const pinPhoto = async (photoId: string) => {
    try {
      const { data } = await api.post(`/scrapbook/${eventId}/pin`, { photoId });
      setPins(prev => [...prev, data]);
      setPhotos(prev => prev.map(p => p.id === photoId ? { ...p, scrapbookPins: [{ id: data.id }] } : p));
    } catch (e: any) {
      if (e.response?.status === 409) alert('Already pinned!');
    }
  };

  const unpinPhoto = async (photoId: string) => {
    try {
      await api.delete(`/scrapbook/${eventId}/pin/${photoId}`);
      setPins(prev => prev.filter(p => p.photoId !== photoId));
      setPhotos(prev => prev.map(p => p.id === photoId ? { ...p, scrapbookPins: [] } : p));
    } catch {}
  };

  const saveCaption = async (photoId: string) => {
    try {
      await api.patch(`/scrapbook/${eventId}/pin/${photoId}`, { caption: editCaption });
      setPins(prev => prev.map(p => p.photoId === photoId ? { ...p, caption: editCaption } : p));
      setEditingPin(null);
    } catch {}
  };

  const generateStory = async () => {
    setStoryLoading(true);
    try {
      const { data } = await api.post(`/trip-story/${eventId}/generate`, { style: storyStyle });
      setStory(data);
      setShowStory(true);
    } catch (e) {
      console.error('Generate story error:', e);
      alert('Failed to generate story. Please try again.');
    } finally {
      setStoryLoading(false);
    }
  };

  const deleteStory = async () => {
    if (!confirm('Delete this trip story?')) return;
    try {
      await api.delete(`/trip-story/${eventId}`);
      setStory(null);
      setShowStory(false);
    } catch {}
  };

  const copyStoryLink = async () => {
    const url = `${window.location.origin}/trips/${eventId}/story`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const el = document.createElement('textarea');
      el.value = url; document.body.appendChild(el); el.select();
      document.execCommand('copy'); document.body.removeChild(el);
    }
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const shareToFeed = async () => {
    if (!story) return;
    setSharing(true);
    try {
      await api.post('/posts', { content: `Just generated a trip story with Hitch AI! ✨

${story.content.slice(0, 200)}...`, eventId, type: 'TRIP_STORY' });
      setShareDone(true);
      setTimeout(() => setShareDone(false), 3000);
    } catch { alert('Failed to share to feed'); }
    setSharing(false);
  };

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const pinnedIds = new Set(pins.map(p => p.photoId));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
            <Camera className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Trip Photos</h2>
            <p className="text-sm text-gray-500">
              {photos.length} photo{photos.length !== 1 ? 's' : ''}
              {pins.length > 0 && <> · <Star className="w-3 h-3 inline text-amber-400" /> {pins.length} featured</>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canPin && pins.length > 0 && (
            <button onClick={handleShare} disabled={shareLoading}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-gray-200 rounded-xl hover:bg-gray-50 transition disabled:opacity-50">
              <Link2 className="w-4 h-4" /> Share
            </button>
          )}
          {(canUpload || canPin) && (
            <button onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition">
              <Upload className="w-4 h-4" /> Add Photos & Videos
            </button>
          )}
        </div>
      </div>

      {/* Featured / All Photos toggle */}
      {photos.length > 0 && (
        <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg w-fit">
          <button onClick={() => setViewMode('featured')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${viewMode === 'featured' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
            <Star className="w-3 h-3 inline mr-1" />Featured ({pins.length})
          </button>
          <button onClick={() => setViewMode('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${viewMode === 'all' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
            All Photos ({photos.length})
          </button>
        </div>
      )}

      {/* ── FEATURED VIEW ── */}
      {viewMode === 'featured' && (<>

      {/* Photo Picker */}
      {showPicker && (
        <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Image className="w-4 h-4" /> Trip photos — tap to pin/unpin
          </h3>
          {photos.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No photos uploaded to this trip yet</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {photos.map(photo => {
                const isPinned = pinnedIds.has(photo.id);
                return (
                  <button
                    key={photo.id}
                    onClick={() => isPinned ? unpinPhoto(photo.id) : pinPhoto(photo.id)}
                    className={`relative aspect-square rounded-xl overflow-hidden group transition-all ${
                      isPinned ? 'ring-2 ring-primary-500 ring-offset-1' : 'hover:ring-2 hover:ring-gray-300 hover:ring-offset-1'
                    }`}
                  >
                    <img src={photo.imageUrl} alt="" className="w-full h-full object-cover" />
                    <div className={`absolute inset-0 flex items-center justify-center transition ${
                      isPinned ? 'bg-primary-600/40' : 'bg-black/0 group-hover:bg-black/20'
                    }`}>
                      {isPinned
                        ? <PinOff className="w-5 h-5 text-white drop-shadow" />
                        : <Pin className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 drop-shadow" />
                      }
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Share Sheet */}
      {showShareSheet && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <Link2 className="w-5 h-5 text-green-500" />
            <h3 className="font-bold text-gray-900">Your scrapbook is shareable!</h3>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <input readOnly value={shareUrl} className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-gray-700" />
            <button onClick={copyShareLink}
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${linkCopied ? 'bg-green-100 text-green-700' : 'bg-primary-100 text-primary-700 hover:bg-primary-200'}`}>
              {linkCopied ? '✓ Copied!' : 'Copy'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mb-3">Anyone with this link can view your scrapbook.</p>
          <div className="flex items-center gap-3">
            <button onClick={handleStopSharing} className="text-xs text-red-500 hover:text-red-600 font-semibold">Stop Sharing</button>
            <button onClick={() => setShowShareSheet(false)} className="text-xs text-gray-400 hover:text-gray-600 ml-auto">Close</button>
          </div>
        </div>
      )}

      {/* Hitch Suggestions */}
      {suggestions.length > 0 && !suggestionsHidden && (
        <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <img src="/hitch.png" className="w-6 h-6 rounded-full" alt="Hitch" />
            <div>
              <p className="text-sm font-bold text-gray-900">Hitch picked these for you</p>
              <p className="text-xs text-gray-500">Based on your best shots — pin them all?</p>
            </div>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
            {suggestions.map((s: any) => (
              <div key={s.photoId} className="relative group">
                <img src={s.photo?.imageUrl} alt="" className="w-full aspect-square object-cover rounded-xl" />
                <p className="text-[10px] text-amber-800 mt-1 line-clamp-1 italic">"{s.reason}"</p>
                <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
                  <button onClick={() => acceptSuggestion(s.photoId)} className="w-5 h-5 bg-green-500 text-white rounded-full flex items-center justify-center text-xs">✓</button>
                  <button onClick={() => dismissSuggestion(s.photoId)} className="w-5 h-5 bg-gray-400 text-white rounded-full flex items-center justify-center text-xs">✕</button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <button onClick={acceptAllSuggestions} className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 transition">
              <Check className="w-4 h-4" /> Pin All
            </button>
            <button onClick={() => setSuggestionsHidden(true)} className="text-sm text-gray-500 hover:text-gray-700">Start Fresh</button>
          </div>
        </div>
      )}

      {/* Hero Photo Viewer — browse all photos, starting from featured */}
      {photos.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No photos yet</p>
          {canUpload && <p className="text-sm mt-1">Add your first photo to create a featured memory</p>}
        </div>
      ) : (() => {
        const featuredIdx = photos.findIndex(p => pinnedIds.has(p.id));
        const startIdx = featuredIdx >= 0 ? featuredIdx : 0;
        return <HeroPhotoViewer
          photos={photos}
          pinnedIds={pinnedIds}
          startIndex={startIdx}
          canPin={!!canPin}
          onPin={pinPhoto}
          onUnpin={unpinPhoto}
          onTapPhoto={(p: any) => setLightbox(p)}
          user={user}
        />;
      })()}

      {/* Trip Story CTA — when pins exist but no story yet */}
      {canPin && pins.length >= 3 && !story && (
        <div className="rounded-xl p-4 border" style={{ borderLeft: '4px solid #E8A838', background: 'rgba(232,168,56,0.05)', borderColor: '#E8A838' }}>
          <p className="text-sm font-bold text-gray-900 mb-1">✨ Ready to tell the story?</p>
          <p className="text-xs text-gray-500 mb-2">You've pinned {pins.length} memories — Hitch can write your trip story from these.</p>
          <button onClick={generateStory} disabled={storyLoading}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 transition disabled:opacity-50">
            {storyLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Generate Trip Story →
          </button>
        </div>
      )}

      {canPin && story && pins.length >= 3 && (
        <p className="text-xs text-green-600 flex items-center gap-1">
          ✅ Trip Story generated — <button onClick={() => setShowStory(true)} className="underline hover:text-green-700">View it →</button>
        </p>
      )}

      {/* ── Trip Story ─────────────────────────────── */}
      <div className="border-t border-gray-100 pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-gray-900">Trip Story</h3>
            {story && (
              <span className="text-xs text-gray-400">
                Generated {new Date(story.generatedAt).toLocaleDateString()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {story && (
              <button
                onClick={() => setShowStory(!showStory)}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                {showStory ? 'Hide' : 'Read Story'}
              </button>
            )}
            {canPin && story && (
              <button onClick={deleteStory} className="text-gray-300 hover:text-red-400">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {canPin && (
          <div className="flex items-center gap-3 mb-4">
            <select
              value={storyStyle}
              onChange={e => setStoryStyle(e.target.value as any)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="narrative">📖 Narrative Journal</option>
              <option value="postcard">📮 Postcard Style</option>
              <option value="funny">😄 Funny & Light</option>
            </select>
            <button
              onClick={generateStory}
              disabled={storyLoading}
              className="flex items-center gap-2 px-4 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white rounded-lg text-sm font-medium transition"
            >
              {storyLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {story ? 'Regenerate' : 'Generate Story'}
            </button>
          </div>
        )}

        {!story && !canPin && (
          <p className="text-sm text-gray-400 italic">No trip story yet.</p>
        )}

        {!story && canPin && pins.length === 0 && (
          <p className="text-sm text-gray-400">Pin some photos first to make your story richer!</p>
        )}

        {showStory && story && (
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-6 border border-amber-100">
            <div className="prose prose-sm max-w-none">
              {story.content.split('\n\n').map((para, i) => (
                <p key={i} className="text-gray-700 leading-relaxed mb-4 last:mb-0">{para}</p>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-amber-100 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Generated by Hitch AI
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => window.open(`/trips/${eventId}/story`, '_blank')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 transition text-gray-600">
                  <ExternalLink className="w-3.5 h-3.5" /> Full page
                </button>
                <button onClick={copyStoryLink} className={"flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-lg transition " + (linkCopied ? 'border-green-300 bg-green-50 text-green-700' : 'border-gray-200 hover:bg-gray-50 text-gray-600')}>
                  <Copy className="w-3.5 h-3.5" /> {linkCopied ? 'Copied!' : 'Copy link'}
                </button>
                {canPin && (
                  <button onClick={shareToFeed} disabled={sharing || shareDone} className={"flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-lg transition " + (shareDone ? 'border-green-300 bg-green-50 text-green-700' : 'border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-700')}>
                    <Share2 className="w-3.5 h-3.5" /> {shareDone ? 'Posted!' : sharing ? 'Posting...' : 'Post to feed'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      </>)}
      {/* end FEATURED VIEW */}

      {/* ── ALL PHOTOS VIEW ── */}
      {viewMode === 'all' && (
        <div>
          {photos.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-2xl">
              <Camera className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No photos yet</p>
              <p className="text-sm text-gray-400 mt-1">Upload the first photo from this trip!</p>
              {(canUpload || canPin) && (
                <button onClick={() => setShowUploadModal(true)}
                  className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition">
                  <Upload className="w-4 h-4" /> Upload Photo
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {photos.map((photo: any) => {
                const isPinned = pinnedIds.has(photo.id);
                return (
                  <div key={photo.id} className="relative group rounded-xl overflow-hidden bg-gray-100 shadow-sm hover:shadow-md transition">
                    <div className="aspect-square cursor-pointer" onClick={() => setSelectedPhoto(photo)}>
                      <img src={photo.imageUrl} alt={photo.caption || ''} className="w-full h-full object-cover" loading="lazy" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition" />
                    </div>
                    {/* Star/pin toggle */}
                    {canPin && (
                      <button onClick={() => isPinned ? unpinPhoto(photo.id) : pinPhoto(photo.id)}
                        className={`absolute top-2 left-2 w-7 h-7 rounded-full flex items-center justify-center transition shadow ${
                          isPinned ? 'bg-amber-400 text-white' : 'bg-white/80 text-gray-400 opacity-0 group-hover:opacity-100'
                        }`}>
                        <Star className="w-3.5 h-3.5" fill={isPinned ? 'white' : 'none'} />
                      </button>
                    )}
                    {isPinned && (
                      <div className="absolute top-2 right-2">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-400 text-white">Featured</span>
                      </div>
                    )}
                    {/* Delete (own photos only) */}
                    {photo.user?.id === user?.id && (
                      <button onClick={(e) => { e.stopPropagation(); handleDeletePhoto(photo.id); }}
                        className="absolute bottom-2 right-2 w-6 h-6 bg-black/50 hover:bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                    <div className="p-1.5">
                      <div className="flex items-center gap-1">
                        {photo.user?.profilePicture ? (
                          <img src={photo.user.profilePicture} className="w-4 h-4 rounded-full" alt="" />
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-primary-200 flex items-center justify-center text-[8px] font-bold text-primary-700">{photo.user?.firstName?.[0]}</div>
                        )}
                        <span className="text-[10px] text-gray-500">{photo.user?.firstName}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setShowUploadModal(false); setUploadCaption(''); setUploadedUrl(''); }}>
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white p-4 rounded-t-2xl flex items-center justify-between">
              <h3 className="text-lg font-bold">Upload Photo</h3>
              <button onClick={() => { setShowUploadModal(false); setUploadCaption(''); setUploadedUrl(''); }} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <ImageUpload onImageUploaded={handleImageUploaded} currentImage={uploadedUrl} label="Select Photo" eventId={eventId} caption={uploadCaption} />
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Caption (Optional)</label>
                <textarea value={uploadCaption} onChange={e => setUploadCaption(e.target.value)} rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" placeholder="What's the story behind this photo?" />
                {campgroundName && (
                  <div className="mt-2">
                    <HitchPhotoCaptions campgroundName={campgroundName} tripTitle={eventTitle} onSelect={(c: string) => setUploadCaption(c)} />
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button onClick={handleSavePhoto} disabled={!uploadedUrl}
                  className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700 transition disabled:opacity-50">
                  {uploadedUrl ? 'Done' : 'Upload a Photo First'}
                </button>
                <button onClick={() => { setShowUploadModal(false); setUploadCaption(''); setUploadedUrl(''); }}
                  className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Photo Lightbox with Tagging (for All Photos view) */}
      {/* Fullscreen Photo Viewer */}
      {(selectedPhoto || lightbox) && (() => {
        const startPhoto = selectedPhoto || (lightbox?.photo ? { ...lightbox.photo, id: lightbox.photoId } : null);
        if (!startPhoto) return null;
        const startIdx = photos.findIndex(p => p.id === startPhoto.id);
        return (
          <FullscreenPhotoViewer
            photos={photos}
            startIndex={startIdx >= 0 ? startIdx : 0}
            pinnedIds={pinnedIds}
            canPin={!!canPin}
            onPin={pinPhoto}
            onUnpin={unpinPhoto}
            user={user}
            onClose={() => { setSelectedPhoto(null); setLightbox(null); }}
          />
        );
      })()}
    </div>
  );
}

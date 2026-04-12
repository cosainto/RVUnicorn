import { useState, useEffect } from 'react';
import { BookOpen, Pin, PinOff, Plus, X, Edit2, Check, Image, Sparkles, RefreshCw, Trash2, Globe, Lock, ExternalLink, Copy, Share2, Link2, Zap } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

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

export default function TripScrapbook({ eventId, canPin }: { eventId: string; canPin: boolean }) {
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
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Trip Scrapbook</h2>
            <p className="text-sm text-gray-500">{pins.length} photo{pins.length !== 1 ? 's' : ''} pinned</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canPin && pins.length > 0 && (
            <button onClick={handleShare} disabled={shareLoading}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium border border-gray-200 rounded-xl hover:bg-gray-50 transition disabled:opacity-50">
              <Link2 className="w-4 h-4" /> Share
            </button>
          )}
          {canPin && (
            <button onClick={() => setShowPicker(!showPicker)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition">
              <Plus className="w-4 h-4" />
              {showPicker ? 'Done Picking' : 'Pin Photos'}
            </button>
          )}
        </div>
      </div>

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

      {/* Pinned Grid */}
      {pins.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No photos pinned yet</p>
          {canPin && <p className="text-sm mt-1">Click "Pin Photos" to start building your scrapbook</p>}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {pins.map(pin => (
            <div key={pin.id} className="group relative rounded-2xl overflow-hidden bg-gray-100 shadow-sm hover:shadow-md transition">
              {/* Photo */}
              <div
                className="aspect-square cursor-pointer"
                onClick={() => setLightbox(pin)}
              >
                <img src={pin.photo.imageUrl} alt="" className="w-full h-full object-cover" />
              </div>

              {/* Pin badge */}
              <div className="absolute top-2 left-2">
                <div className="w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center shadow">
                  <Pin className="w-3 h-3 text-white" />
                </div>
              </div>

              {/* Unpin button (owner or organizer) */}
              {canPin && (
                <button
                  onClick={() => unpinPhoto(pin.photoId)}
                  className="absolute top-2 right-2 w-6 h-6 bg-black/50 hover:bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                >
                  <X className="w-3 h-3" />
                </button>
              )}

              {/* Caption area */}
              <div className="p-2 bg-white">
                {editingPin === pin.photoId ? (
                  <div className="flex gap-1">
                    <input
                      autoFocus
                      value={editCaption}
                      onChange={e => setEditCaption(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveCaption(pin.photoId); if (e.key === 'Escape') setEditingPin(null); }}
                      className="flex-1 text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      placeholder="Add a caption..."
                    />
                    <button onClick={() => saveCaption(pin.photoId)} className="text-primary-600">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-xs text-gray-600 leading-snug flex-1">
                      {pin.caption || <span className="text-gray-300 italic">No caption</span>}
                    </p>
                    {canPin && pin.pinnedBy.id === user?.id && (
                      <button
                        onClick={() => { setEditingPin(pin.photoId); setEditCaption(pin.caption || ''); }}
                        className="text-gray-300 hover:text-gray-500 flex-shrink-0"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
                <p className="text-[10px] text-gray-400 mt-0.5">📌 {pin.pinnedBy.firstName}</p>
                {/* Moment tag pills */}
                {canPin && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {MOMENT_TAGS.map(t => (
                      <button key={t.key} onClick={() => setMomentTag(pin.photoId, (pin as any).momentTag === t.key ? null : t.key)}
                        className={`text-[9px] px-1.5 py-0.5 rounded-full border transition ${
                          (pin as any).momentTag === t.key
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : 'bg-transparent text-gray-400 border-gray-200 hover:border-amber-200'
                        }`}>
                        {t.icon}
                      </button>
                    ))}
                  </div>
                )}
                {!canPin && (pin as any).momentTag && (
                  <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 mt-1">
                    {MOMENT_TAGS.find(t => t.key === (pin as any).momentTag)?.icon} {MOMENT_TAGS.find(t => t.key === (pin as any).momentTag)?.label}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

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

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button className="absolute top-4 right-4 text-white/70 hover:text-white">
            <X className="w-8 h-8" />
          </button>
          <div className="max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <img src={lightbox.photo.imageUrl} alt="" className="w-full rounded-2xl max-h-[80vh] object-contain" />
            {lightbox.caption && (
              <p className="text-white text-center mt-3 text-sm">{lightbox.caption}</p>
            )}
            <p className="text-white/50 text-center text-xs mt-1">
              by {lightbox.photo.user.firstName} {lightbox.photo.user.lastName}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { BookOpen, Pin, PinOff, Plus, X, Edit2, Check, Image, Sparkles, RefreshCw, Trash2, Globe, Lock } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

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
        {canPin && (
          <button
            onClick={() => setShowPicker(!showPicker)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition"
          >
            <Plus className="w-4 h-4" />
            {showPicker ? 'Done Picking' : 'Pin Photos'}
          </button>
        )}
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
              </div>
            </div>
          ))}
        </div>
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
                <button onClick={() => window.open('/trips//story', '_blank')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 transition text-gray-600">
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

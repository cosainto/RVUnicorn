/**
 * RigPostComposer — "Share Your Experience" multi-format composer.
 * Posts into the Pulse feed via existing create endpoints.
 */
import { useState } from 'react';
import { X, Camera } from 'lucide-react';
import { useToast } from '../ToastProvider';
import api from '../../services/api';
import { uploadAndGetUrl } from '../../utils/uploadMedia';

const CN = { bg: '#0F1C35', card: '#162236', cardAlt: '#1A2A45', gold: '#E8A838', orange: '#D4621A', cream: '#F5F0E8', muted: '#8B9BB4', border: '#243552' };

const FORMATS = [
  { id: 'photo', label: 'Photos', icon: '📸', hint: 'Share photos from the road' },
  { id: 'campfire_story', label: 'Campfire Story', icon: '🔥', hint: 'Tell a short moment' },
  { id: 'blog', label: 'Blog / Story', icon: '✍️', hint: 'Write a longer story' },
  { id: 'recipe', label: 'Camp Kitchen', icon: '🍳', hint: 'What are you cooking?' },
  { id: 'mod', label: 'Mod / Upgrade', icon: '🛠', hint: 'Before & after upgrade' },
  { id: 'night_sky', label: 'Night Sky', icon: '🌌', hint: 'Stargazing moment' },
  { id: 'game_night', label: 'Game Night', icon: '🎲', hint: 'What did you play?' },
  { id: 'video', label: 'Vlog / Video', icon: '🎥', hint: 'Share a video clip' },
  { id: 'milestone', label: 'Milestone', icon: '🏆', hint: 'Celebrate an achievement' },
];

interface Props {
  rigId: string;
  slug: string;
  isOpen: boolean;
  initialFormat?: string | null;
  activeSessionId?: string | null;
  onClose: () => void;
  onPublished: () => void;
}

export default function RigPostComposer({ rigId, slug, isOpen, initialFormat, activeSessionId, onClose, onPublished }: Props) {
  const { addLocalToast } = useToast();
  const [format, setFormat] = useState<string | null>(initialFormat || null);

  // Sync format when initialFormat changes (chip clicked while already open)
  const [lastInitial, setLastInitial] = useState(initialFormat);
  if (initialFormat !== lastInitial) {
    setLastInitial(initialFormat);
    if (initialFormat) setFormat(initialFormat);
  }
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);

  if (!isOpen) return null;

  const reset = () => { setFormat(null); setTitle(''); setBody(''); setPhotoUrls([]); setVideoUrl(''); };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    const urls: string[] = [];
    for (const file of Array.from(files).slice(0, 8)) {
      try {
        const url = await uploadAndGetUrl(file, 'rvunicorn/rig-posts');
        urls.push(url);
      } catch {}
    }
    setPhotoUrls(prev => [...prev, ...urls]);
    setUploading(false);
  };

  const handlePublish = async () => {
    if (!format) return;
    if (!body.trim() && !title.trim() && photoUrls.length === 0) {
      addLocalToast('Add some content first', 'warning');
      return;
    }
    setPublishing(true);
    try {
      if (format === 'blog') {
        // Fan out to two surfaces from one write:
        // 1. BoardPost on trip-reports board → appears in Basecamp community feed
        // 2. RigStory → syncs to rig timeline
        const blogTitle = title.trim() || 'Untitled Story';
        const blogBody = body.trim();
        const coverImg = photoUrls[0] || null;
        await Promise.all([
          api.post('/boards/trip-reports/posts', {
            title: blogTitle, body: blogBody, postType: 'BLOG', imageUrl: coverImg,
          }).catch(() => {}),
          api.post(`/rigs/${slug}/stories`, {
            title: blogTitle, body: blogBody, coverImageUrl: coverImg, isPublished: true,
          }).catch(() => {}),
        ]);
      } else if (format === 'recipe') {
        await api.post(`/rigs/${slug}/recipes`, {
          title: title.trim() || 'Camp Recipe',
          description: body.trim(),
          photoUrls,
          cookingMethod: 'CAMPFIRE',
          difficulty: 'EASY',
          ingredients: [],
          steps: [],
        });
      } else if (format === 'mod') {
        await api.post(`/rigs/${slug}/mods-hub`, {
          title: title.trim() || 'Rig Mod',
          description: body.trim(),
          category: 'OTHER',
          beforePhotoUrls: [],
          afterPhotoUrls: photoUrls,
          difficulty: 'MODERATE',
        });
      } else if (format === 'video') {
        await api.post(`/rigs/${slug}/videos`, {
          title: title.trim() || 'Video',
          description: body.trim(),
          videoUrl: videoUrl || null,
          thumbnailUrl: photoUrls[0] || null,
          videoType: 'SHORT_CLIP',
        });
      } else {
        // photo, campfire_story, night_sky, game_night, milestone — all use RigPost
        await api.post(`/rigs/${rigId}/posts`, {
          postType: format,
          title: title.trim() || undefined,
          body: body.trim(),
          photos: photoUrls,
          tripId: activeSessionId || undefined,
        });
      }

      // Sync timeline
      api.post(`/rigs/${slug}/timeline/sync`).catch(() => {});

      addLocalToast('Published!', 'success');
      onPublished();
      onClose();
      reset();
    } catch {
      addLocalToast('Failed to publish', 'error');
    }
    setPublishing(false);
  };

  // ── FORMAT PICKER ──
  if (!format) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
        <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 max-h-[85vh] overflow-y-auto" style={{ background: CN.card, border: `1px solid ${CN.border}` }} onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold" style={{ color: CN.cream }}>Share Your Experience</h3>
            <button onClick={onClose} style={{ color: CN.muted }}><X className="w-5 h-5" /></button>
          </div>
          <p className="text-xs mb-4" style={{ color: CN.muted }}>What's the story today?</p>
          <div className="grid grid-cols-3 gap-2">
            {FORMATS.map(f => (
              <button key={f.id} onClick={() => setFormat(f.id)}
                className="flex flex-col items-center gap-1 p-3 rounded-xl text-center transition hover:brightness-110"
                style={{ background: CN.cardAlt, border: `1px solid ${CN.border}` }}>
                <span className="text-xl">{f.icon}</span>
                <span className="text-[10px] font-semibold" style={{ color: CN.cream }}>{f.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const activeFormat = FORMATS.find(f => f.id === format)!;
  const showPhotoUpload = ['photo', 'campfire_story', 'blog', 'recipe', 'mod', 'night_sky', 'game_night', 'milestone'].includes(format);
  const showTitle = ['blog', 'recipe', 'mod', 'milestone', 'video'].includes(format);
  const bodyPlaceholder = format === 'campfire_story' ? 'Tell your campfire moment...'
    : format === 'night_sky' ? 'What did you see in the sky tonight?'
    : format === 'game_night' ? 'What did you play? Who won?'
    : format === 'recipe' ? 'Describe the dish...'
    : format === 'mod' ? 'What did you upgrade and why?'
    : format === 'video' ? 'Add a title or description for your video...'
    : format === 'milestone' ? 'What milestone did you hit?'
    : 'Share your experience...';

  // ── COMPOSE FORM ──
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-5 max-h-[85vh] overflow-y-auto" style={{ background: CN.card, border: `1px solid ${CN.border}` }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setFormat(null)} className="text-xs" style={{ color: CN.muted }}>&larr;</button>
            <span className="text-lg">{activeFormat.icon}</span>
            <h3 className="text-sm font-bold" style={{ color: CN.cream }}>{activeFormat.label}</h3>
          </div>
          <button onClick={() => { onClose(); reset(); }} style={{ color: CN.muted }}><X className="w-5 h-5" /></button>
        </div>
        <p className="text-[10px] mb-3" style={{ color: CN.muted }}>{activeFormat.hint}</p>

        {/* Title (optional for some formats) */}
        {showTitle && (
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Title"
            className="w-full px-3 py-2 rounded-lg text-sm mb-3 focus:outline-none"
            style={{ background: CN.bg, border: `1px solid ${CN.border}`, color: CN.cream }} />
        )}

        {/* Body */}
        <textarea value={body} onChange={e => setBody(e.target.value)} rows={format === 'blog' ? 8 : 4} placeholder={bodyPlaceholder}
          className="w-full px-3 py-2 rounded-lg text-sm resize-none focus:outline-none"
          style={{ background: CN.bg, border: `1px solid ${CN.border}`, color: CN.cream }} />

        {/* Photo upload */}
        {showPhotoUpload && (
          <div className="mt-3">
            {photoUrls.length > 0 && (
              <div className="flex gap-2 mb-2 overflow-x-auto">
                {photoUrls.map((url, i) => (
                  <div key={i} className="relative flex-shrink-0">
                    <img src={url} alt="" className="w-16 h-16 rounded-lg object-cover" />
                    <button onClick={() => setPhotoUrls(prev => prev.filter((_, j) => j !== i))}
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px]"
                      style={{ background: '#ef4444', color: 'white' }}>×</button>
                  </div>
                ))}
              </div>
            )}
            <label className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition hover:brightness-110"
              style={{ background: CN.cardAlt, border: `1px solid ${CN.border}` }}>
              {uploading ? (
                <span className="text-xs" style={{ color: CN.muted }}>Uploading...</span>
              ) : (
                <>
                  <Camera className="w-4 h-4" style={{ color: CN.gold }} />
                  <span className="text-xs font-semibold" style={{ color: CN.gold }}>
                    {photoUrls.length > 0 ? 'Add more photos' : 'Add photos'}
                  </span>
                </>
              )}
              <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="hidden" />
            </label>
          </div>
        )}

        {/* Video upload/record (for video format) */}
        {format === 'video' && (
          <div className="mt-3">
            {videoUrl && (
              <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-lg" style={{ background: CN.cardAlt, border: `1px solid ${CN.border}` }}>
                <span className="text-xs" style={{ color: CN.cream }}>Video ready</span>
                <button onClick={() => setVideoUrl('')} className="ml-auto text-[9px]" style={{ color: CN.muted }}>Remove</button>
              </div>
            )}
            <div className="flex gap-2">
              <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition hover:brightness-110"
                style={{ background: CN.cardAlt, border: `1px solid ${CN.border}` }}>
                <span className="text-xs font-semibold" style={{ color: CN.gold }}>📹 Record Video</span>
                <input type="file" accept="video/*" capture="environment" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  try {
                    const url = await uploadAndGetUrl(file, 'rvunicorn/rig-posts');
                    setVideoUrl(url);
                  } catch {}
                  setUploading(false);
                }} className="hidden" />
              </label>
              <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition hover:brightness-110"
                style={{ background: CN.cardAlt, border: `1px solid ${CN.border}` }}>
                <span className="text-xs font-semibold" style={{ color: CN.gold }}>📁 Upload Video</span>
                <input type="file" accept="video/*" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  try {
                    const url = await uploadAndGetUrl(file, 'rvunicorn/rig-posts');
                    setVideoUrl(url);
                  } catch {}
                  setUploading(false);
                }} className="hidden" />
              </label>
            </div>
            {uploading && <p className="text-[10px] mt-2 text-center" style={{ color: CN.muted }}>Uploading video...</p>}
          </div>
        )}

        {/* Publish */}
        <button onClick={handlePublish} disabled={publishing || uploading}
          className="w-full mt-4 py-2.5 rounded-xl text-sm font-bold transition hover:brightness-110 disabled:opacity-50"
          style={{ background: CN.gold, color: CN.bg }}>
          {publishing ? 'Publishing...' : 'Share'}
        </button>
      </div>
    </div>
  );
}

import { useState, useRef } from 'react';
import { Upload, Camera, Film, X, CheckCircle, Loader2 } from 'lucide-react';
import api from '../services/api';

const C = { bg: '#0F1C35', card: '#1B2B4B', cardLight: '#243352', border: '#2A3F5F', gold: '#C9A84C', orange: '#E8622A', cream: '#F5F0E8', muted: '#94A3B8', green: '#1D9E75' };

const VIDEO_TYPES = [
  { value: 'CAMPSITE', emoji: '🏕', label: 'Campsite' },
  { value: 'WILDLIFE', emoji: '🦌', label: 'Wildlife' },
  { value: 'COOKING', emoji: '🍳', label: 'Cooking' },
  { value: 'MOD_REPAIR', emoji: '🔧', label: 'Mod/Repair' },
  { value: 'SCENIC', emoji: '🌅', label: 'Scenic' },
  { value: 'RIG_TOUR', emoji: '🚐', label: 'Rig Tour' },
  { value: 'SHORT_CLIP', emoji: '📹', label: 'General' },
];

interface MediaFile {
  id: string;
  file: File;
  type: 'photo' | 'video';
  preview: string;
  caption: string;
  title: string;
  videoType: string;
}

interface Props {
  tripId: string;
  tripTitle: string;
  rigName?: string;
  onUploadComplete?: (result: { photos: number; videos: number }) => void;
  onClose?: () => void;
}

export default function TripMediaUploader({ tripId, tripTitle, rigName, onUploadComplete, onClose }: Props) {
  const [tab, setTab] = useState<'photos' | 'videos'>('photos');
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ photos: number; videos: number } | null>(null);
  const [showRigAttach, setShowRigAttach] = useState(false);
  const [attachOptions, setAttachOptions] = useState({ photos: true, videos: true, recap: true });
  const [attaching, setAttaching] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const photos = files.filter(f => f.type === 'photo');
  const videos = files.filter(f => f.type === 'video');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const newFiles: MediaFile[] = selected.map(file => ({
      id: Math.random().toString(36).slice(2),
      file,
      type: file.type.startsWith('video/') ? 'video' : 'photo',
      preview: URL.createObjectURL(file),
      caption: '',
      title: '',
      videoType: 'SHORT_CLIP',
    }));

    setFiles(prev => {
      const photoCount = prev.filter(f => f.type === 'photo').length + newFiles.filter(f => f.type === 'photo').length;
      const videoCount = prev.filter(f => f.type === 'video').length + newFiles.filter(f => f.type === 'video').length;
      if (photoCount > 50 || videoCount > 10) {
        alert(`Max 50 photos and 10 videos per upload.`);
        return prev;
      }
      return [...prev, ...newFiles];
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (id: string) => {
    setFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file) URL.revokeObjectURL(file.preview);
      return prev.filter(f => f.id !== id);
    });
  };

  const updateFile = (id: string, updates: Partial<MediaFile>) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setProgress(0);

    try {
      const formData = new FormData();
      files.forEach((f, i) => {
        formData.append('media', f.file);
        formData.append(`meta_${i}`, JSON.stringify({
          caption: f.caption,
          title: f.title,
          videoType: f.videoType,
        }));
      });

      const { data } = await api.post(`/upload/trip/${tripId}/media`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
        },
      });

      setResult({ photos: data.photos?.length || 0, videos: data.videos?.length || 0 });
      if (rigName) setShowRigAttach(true);
      onUploadComplete?.({ photos: data.photos?.length || 0, videos: data.videos?.length || 0 });
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleAttachToRig = async () => {
    setAttaching(true);
    try {
      await api.post(`/upload/trip/${tripId}/attach-to-rig`, {
        includePhotos: attachOptions.photos,
        includeVideos: attachOptions.videos,
      });
      setShowRigAttach(false);
    } catch (err) {
      console.error('Attach failed:', err);
    } finally {
      setAttaching(false);
    }
  };

  // ── Upload complete + rig attachment ──
  if (result) {
    return (
      <div className="rounded-2xl p-5" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="text-center mb-4">
          <CheckCircle className="w-10 h-10 mx-auto mb-2" style={{ color: C.green }} />
          <p className="font-semibold" style={{ color: C.cream }}>
            {result.photos > 0 && `${result.photos} photo${result.photos !== 1 ? 's' : ''}`}
            {result.photos > 0 && result.videos > 0 && ' and '}
            {result.videos > 0 && `${result.videos} video${result.videos !== 1 ? 's' : ''}`}
            {' '}uploaded
          </p>
          <p className="text-xs mt-1" style={{ color: C.muted }}>Added to {tripTitle}</p>
        </div>

        {showRigAttach && rigName && (
          <div className="rounded-xl p-4 mb-4" style={{ background: C.cardLight, border: `1px solid ${C.border}` }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">🚐</span>
              <div>
                <p className="text-sm font-semibold" style={{ color: C.cream }}>Add to {rigName} rig page?</p>
                <p className="text-xs" style={{ color: C.muted }}>Share with your rig followers</p>
              </div>
            </div>

            <div className="space-y-2 mb-3">
              {result.photos > 0 && (
                <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: C.cream }}>
                  <input type="checkbox" checked={attachOptions.photos} onChange={e => setAttachOptions(p => ({ ...p, photos: e.target.checked }))}
                    className="rounded" style={{ accentColor: C.gold }} />
                  Photos ({result.photos})
                </label>
              )}
              {result.videos > 0 && (
                <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: C.cream }}>
                  <input type="checkbox" checked={attachOptions.videos} onChange={e => setAttachOptions(p => ({ ...p, videos: e.target.checked }))}
                    className="rounded" style={{ accentColor: C.gold }} />
                  Videos ({result.videos})
                </label>
              )}
            </div>

            <div className="flex gap-2">
              <button onClick={handleAttachToRig} disabled={attaching}
                className="flex-1 py-2 rounded-lg text-sm font-semibold transition hover:brightness-110 disabled:opacity-50"
                style={{ background: C.gold, color: C.bg }}>
                {attaching ? 'Adding...' : 'Add to Rig Page ✓'}
              </button>
              <button onClick={() => setShowRigAttach(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ color: C.muted }}>
                Keep Private
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          {onClose && (
            <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ background: C.cardLight, color: C.cream }}>
              Done
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Upload in progress ──
  if (uploading) {
    return (
      <div className="rounded-2xl p-6 text-center" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin" style={{ color: C.gold }} />
        <p className="text-sm font-semibold mb-2" style={{ color: C.cream }}>
          Uploading {files.length} file{files.length !== 1 ? 's' : ''}...
        </p>
        <div className="h-2 rounded-full overflow-hidden mx-auto max-w-xs" style={{ background: C.cardLight }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: C.gold }} />
        </div>
        <p className="text-xs mt-2" style={{ color: C.muted }}>{progress}%</p>
      </div>
    );
  }

  // ── File selection ──
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${C.border}` }}>
        <h3 className="text-sm font-semibold" style={{ color: C.cream }}>📸 Add Photos & Videos</h3>
        {onClose && <button onClick={onClose} style={{ color: C.muted }}><X className="w-4 h-4" /></button>}
      </div>

      {/* Tab toggle */}
      <div className="flex gap-1 p-2 mx-3 mt-3 rounded-lg" style={{ background: C.cardLight }}>
        <button onClick={() => setTab('photos')}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold transition"
          style={tab === 'photos' ? { background: C.card, color: C.gold } : { color: C.muted }}>
          <Camera className="w-3.5 h-3.5" /> Photos {photos.length > 0 && `(${photos.length})`}
        </button>
        <button onClick={() => setTab('videos')}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold transition"
          style={tab === 'videos' ? { background: C.card, color: C.gold } : { color: C.muted }}>
          <Film className="w-3.5 h-3.5" /> Videos {videos.length > 0 && `(${videos.length})`}
        </button>
      </div>

      <div className="p-4">
        {/* Upload zone */}
        <label className="block rounded-xl p-6 text-center cursor-pointer transition hover:brightness-110"
          style={{ background: C.cardLight, border: `2px dashed ${C.border}` }}>
          <Upload className="w-6 h-6 mx-auto mb-2" style={{ color: C.gold }} />
          <p className="text-sm font-medium" style={{ color: C.cream }}>
            {tab === 'photos' ? 'Drop photos or tap to select' : 'Drop videos or tap to select'}
          </p>
          <p className="text-xs mt-1" style={{ color: C.muted }}>
            {tab === 'photos' ? 'Any format · Any size · Auto-optimized' : 'MP4, MOV · Max 500MB each'}
          </p>
          <input ref={fileInputRef} type="file" multiple
            accept={tab === 'photos' ? 'image/*' : 'video/*'}
            onChange={handleFileSelect} className="hidden" />
        </label>

        {/* File previews */}
        {files.filter(f => f.type === tab.slice(0, -1) as any || (tab === 'photos' && f.type === 'photo') || (tab === 'videos' && f.type === 'video')).length > 0 && (
          <div className="mt-4 space-y-3">
            {files.filter(f => (tab === 'photos' && f.type === 'photo') || (tab === 'videos' && f.type === 'video')).map(f => (
              <div key={f.id} className="flex gap-3 rounded-xl p-2.5" style={{ background: C.cardLight }}>
                {/* Thumbnail */}
                <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 relative" style={{ background: C.bg }}>
                  {f.type === 'photo' ? (
                    <img src={f.preview} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Film className="w-6 h-6" style={{ color: C.muted }} />
                    </div>
                  )}
                  <button onClick={() => removeFile(f.id)} className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.8)' }}>
                    <X className="w-2.5 h-2.5 text-white" />
                  </button>
                </div>

                {/* Metadata */}
                <div className="flex-1 min-w-0">
                  {f.type === 'video' && (
                    <>
                      <input type="text" value={f.title} onChange={e => updateFile(f.id, { title: e.target.value })}
                        placeholder="Video title..." className="w-full text-xs rounded-md px-2 py-1.5 mb-1.5"
                        style={{ background: C.bg, color: C.cream, border: `1px solid ${C.border}` }} />
                      <div className="flex gap-1 flex-wrap">
                        {VIDEO_TYPES.map(vt => (
                          <button key={vt.value} onClick={() => updateFile(f.id, { videoType: vt.value })}
                            className="text-[10px] px-1.5 py-0.5 rounded-full transition"
                            style={f.videoType === vt.value
                              ? { background: 'rgba(232,168,56,0.2)', color: C.gold, border: `1px solid ${C.gold}` }
                              : { background: C.bg, color: C.muted, border: `1px solid ${C.border}` }}>
                            {vt.emoji} {vt.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  {f.type === 'photo' && (
                    <input type="text" value={f.caption} onChange={e => updateFile(f.id, { caption: e.target.value })}
                      placeholder="Add caption..." className="w-full text-xs rounded-md px-2 py-1.5"
                      style={{ background: C.bg, color: C.cream, border: `1px solid ${C.border}` }} />
                  )}
                  <p className="text-[10px] mt-1 truncate" style={{ color: C.muted }}>{f.file.name} · {(f.file.size / 1024 / 1024).toFixed(1)}MB</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {files.length > 0 && (
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderTop: `1px solid ${C.border}` }}>
          <p className="text-xs" style={{ color: C.muted }}>
            {photos.length} photo{photos.length !== 1 ? 's' : ''} · {videos.length} video{videos.length !== 1 ? 's' : ''}
          </p>
          <button onClick={handleUpload}
            className="px-5 py-2 rounded-lg text-sm font-bold transition hover:brightness-110"
            style={{ background: C.orange, color: 'white' }}>
            Upload All →
          </button>
        </div>
      )}
    </div>
  );
}

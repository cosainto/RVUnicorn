import { useState, useRef } from 'react';
import { Upload, Camera, Film, X, CheckCircle, Loader2 } from 'lucide-react';
import api from '../services/api';

const C = { bg: '#0F1C35', card: '#1B2B4B', cardLight: '#243352', border: '#2A3F5F', gold: '#C9A84C', orange: '#E8622A', cream: '#F5F0E8', muted: '#94A3B8', green: '#1D9E75' };

const CLOUD_NAME = 'dy6eetmh7';
const UPLOAD_PRESET = 'rvunicorn_unsigned';

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

// Upload a file directly to Cloudinary with XHR progress
function uploadToCloudinary(file: File, folder: string, onProgress: (pct: number) => void): Promise<any> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('folder', folder);

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });

    xhr.onload = () => {
      if (xhr.status === 200) {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { reject(new Error('Bad response from Cloudinary')); }
      } else {
        reject(new Error(`Cloudinary ${xhr.status}: ${xhr.responseText?.slice(0, 200)}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error — check your connection'));
    xhr.ontimeout = () => reject(new Error('Upload timed out — try a smaller file'));
    xhr.timeout = 300000; // 5 minutes

    const resourceType = file.type.startsWith('video/') ? 'video' : 'image';
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`);
    xhr.send(formData);
  });
}

export default function TripMediaUploader({ tripId, tripTitle, rigName, onUploadComplete, onClose }: Props) {
  const [tab, setTab] = useState<'photos' | 'videos'>('photos');
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Progress state
  const [completed, setCompleted] = useState(0);
  const [failed, setFailed] = useState(0);
  const [currentFileName, setCurrentFileName] = useState('');
  const [currentFilePct, setCurrentFilePct] = useState(0);
  const [failedFiles, setFailedFiles] = useState<MediaFile[]>([]);

  const [result, setResult] = useState<{ photos: number; videos: number } | null>(null);
  const [showRigAttach, setShowRigAttach] = useState(false);
  const [attachOptions, setAttachOptions] = useState({ photos: true, videos: true, recap: true });
  const [attaching, setAttaching] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const photos = files.filter(f => f.type === 'photo');
  const videos = files.filter(f => f.type === 'video');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    console.log('[TripMedia] Files selected:', selected.length, selected.map(f => ({ name: f.name, size: f.size, type: f.type })));
    if (!selected.length) return;

    const newFiles: MediaFile[] = selected.map(file => {
      const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|avi|mkv|m4v)$/i.test(file.name);
      const isHEIC = file.type === 'image/heic' || file.type === 'image/heif' || /\.(heic|heif)$/i.test(file.name);

      let preview = '';
      try {
        if (!isHEIC && !isVideo) preview = URL.createObjectURL(file);
      } catch { /* silent */ }

      return {
        id: Math.random().toString(36).slice(2),
        file,
        type: isVideo ? 'video' as const : 'photo' as const,
        preview,
        caption: '',
        title: '',
        videoType: 'SHORT_CLIP',
      };
    });

    setFiles(prev => [...prev, ...newFiles].slice(0, 60));
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

  const uploadFiles = async (filesToUpload: MediaFile[]) => {
    if (filesToUpload.length === 0) return;
    setUploading(true);
    setUploadError(null);
    setCompleted(0);
    setFailed(0);
    setFailedFiles([]);
    setCurrentFileName('');
    setCurrentFilePct(0);

    let uploadedPhotos = 0;
    let uploadedVideos = 0;

    for (const mediaFile of filesToUpload) {
      const displayName = mediaFile.file.name || `file_${mediaFile.id}`;
      setCurrentFileName(displayName.length > 25 ? displayName.slice(0, 22) + '...' : displayName);
      setCurrentFilePct(0);

      try {
        const isVideo = mediaFile.type === 'video';
        const folder = isVideo ? `rvunicorn/trip-videos/${tripId}` : `rvunicorn/trip-photos/${tripId}`;

        // Upload directly to Cloudinary
        const cloudResult = await uploadToCloudinary(
          mediaFile.file,
          folder,
          (pct) => setCurrentFilePct(pct)
        );

        console.log(`[TripMedia] Cloudinary OK: ${displayName} -> ${cloudResult.secure_url}`);

        // Save the URL to our backend
        if (isVideo) {
          await api.post(`/upload/trip/${tripId}/media`, (() => {
            const fd = new FormData();
            fd.append('media', mediaFile.file, mediaFile.file.name);
            fd.append('meta_0', JSON.stringify({
              title: mediaFile.title,
              videoType: mediaFile.videoType,
            }));
            return fd;
          })(), { timeout: 120000 });
          uploadedVideos++;
        } else {
          await api.post(`/upload/trip/${tripId}/save-photo`, {
            url: cloudResult.secure_url,
            publicId: cloudResult.public_id,
            caption: mediaFile.caption || null,
          });
          uploadedPhotos++;
        }

        setCompleted(prev => prev + 1);
      } catch (err: any) {
        console.error(`[TripMedia] Failed: ${displayName}`, err?.message || err);
        setFailed(prev => prev + 1);
        setFailedFiles(prev => [...prev, mediaFile]);
      }
    }

    setCurrentFileName('');
    setCurrentFilePct(0);
    setUploading(false);

    if (uploadedPhotos + uploadedVideos > 0) {
      setResult({ photos: uploadedPhotos, videos: uploadedVideos });
      if (rigName) setShowRigAttach(true);
      onUploadComplete?.({ photos: uploadedPhotos, videos: uploadedVideos });
    } else if (filesToUpload.length > 0) {
      if (!navigator.onLine) {
        setUploadError('No internet connection — check your signal and retry');
      } else {
        setUploadError('All uploads failed — check your connection and try again');
      }
    }
  };

  const handleUpload = () => uploadFiles(files);

  const retryFailed = () => {
    const toRetry = [...failedFiles];
    uploadFiles(toRetry);
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
                {attaching ? 'Adding...' : 'Add to Rig Page'}
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

  const totalFiles = files.length;
  const isDone = !uploading && (completed + failed > 0) && (completed + failed >= totalFiles);

  // ── Upload in progress or just finished with failures ──
  if (uploading || (isDone && failed > 0)) {
    const overallPct = totalFiles > 0 ? Math.round(((completed + failed) / totalFiles) * 100) : 0;

    return (
      <div className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="p-5">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: C.cardLight }}>
              {isDone
                ? (failed === 0
                    ? <CheckCircle className="w-6 h-6" style={{ color: C.green }} />
                    : <span className="text-xl">⚠️</span>)
                : <Loader2 className="w-6 h-6 animate-spin" style={{ color: C.gold }} />
              }
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold" style={{ color: C.cream }}>
                {isDone
                  ? failed === 0 ? 'All photos uploaded!' : `${completed} of ${totalFiles} uploaded`
                  : 'Uploading photos...'
                }
              </p>
              <p className="text-xs" style={{ color: C.muted }}>
                {isDone
                  ? failed > 0 ? `${failed} failed — tap Retry` : 'Your photos are saved'
                  : `${completed} of ${totalFiles} done`
                }
              </p>
            </div>
          </div>

          {/* Overall progress bar */}
          <div className="h-2.5 rounded-full overflow-hidden mb-2" style={{ background: C.cardLight }}>
            <div className="h-full rounded-full transition-all duration-300" style={{
              width: `${overallPct}%`,
              background: isDone && failed > 0 ? C.orange : C.gold,
            }} />
          </div>

          {/* Stats row */}
          <div className="flex gap-4 mb-3">
            <span className="text-xs font-semibold" style={{ color: C.green }}>
              {completed} uploaded
            </span>
            {failed > 0 && (
              <span className="text-xs font-semibold" style={{ color: '#EF4444' }}>
                {failed} failed
              </span>
            )}
            {uploading && (
              <span className="text-xs" style={{ color: C.muted }}>
                {totalFiles - completed - failed} remaining
              </span>
            )}
          </div>

          {/* Current file progress */}
          {uploading && currentFileName && (
            <div className="rounded-lg p-3" style={{ background: C.cardLight }}>
              <div className="flex justify-between mb-1.5">
                <span className="text-[11px] truncate pr-2" style={{ color: C.muted }}>{currentFileName}</span>
                <span className="text-[11px] font-semibold shrink-0" style={{ color: C.gold }}>{currentFilePct}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: C.bg }}>
                <div className="h-full rounded-full transition-all duration-150" style={{
                  width: `${currentFilePct}%`,
                  background: C.orange,
                }} />
              </div>
            </div>
          )}

          {/* Retry button */}
          {isDone && failed > 0 && (
            <button onClick={retryFailed}
              className="w-full mt-3 py-2.5 rounded-xl text-sm font-semibold transition hover:brightness-110"
              style={{ background: 'transparent', border: `1px solid #EF4444`, color: '#EF4444' }}>
              Retry {failed} failed photo{failed !== 1 ? 's' : ''}
            </button>
          )}

          {/* Done button (when all succeeded or user wants to dismiss) */}
          {isDone && onClose && (
            <button onClick={onClose}
              className="w-full mt-2 py-2.5 rounded-xl text-sm font-semibold transition hover:brightness-110"
              style={{ background: C.gold, color: C.bg }}>
              Done
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── File selection ──
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${C.border}` }}>
        <h3 className="text-sm font-semibold" style={{ color: C.cream }}>Add Photos & Videos</h3>
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
            {tab === 'photos' ? 'Tap to select photos' : 'Tap to select videos'}
          </p>
          <p className="text-xs mt-1" style={{ color: C.muted }}>
            {tab === 'photos' ? 'Any format, any size — auto-optimized' : 'MP4, MOV — auto-compressed'}
          </p>
          <input ref={fileInputRef} type="file" multiple
            accept={tab === 'photos' ? 'image/*,.heic,.heif,video/*,.mp4,.mov' : 'video/*,.mp4,.mov,.avi,.mkv'}
            onChange={handleFileSelect} className="hidden" />
        </label>

        {/* File previews */}
        {files.filter(f => (tab === 'photos' && f.type === 'photo') || (tab === 'videos' && f.type === 'video')).length > 0 && (
          <div className="mt-4 space-y-3">
            {files.filter(f => (tab === 'photos' && f.type === 'photo') || (tab === 'videos' && f.type === 'video')).map(f => (
              <div key={f.id} className="flex gap-3 rounded-xl p-2.5" style={{ background: C.cardLight }}>
                {/* Thumbnail */}
                <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 relative" style={{ background: C.bg }}>
                  {f.type === 'photo' && f.preview ? (
                    <img src={f.preview} alt="" className="w-full h-full object-cover" />
                  ) : f.type === 'photo' ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <Camera className="w-5 h-5" style={{ color: C.muted }} />
                      <span className="absolute bottom-0.5 left-0.5 text-[8px]" style={{ color: C.muted }}>HEIC</span>
                    </div>
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

      {/* Error banner */}
      {uploadError && (
        <div className="mx-4 mb-3 rounded-xl p-3 flex items-center gap-2" style={{ background: '#2D1515', border: '1px solid #EF4444' }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: '#EF4444' }}>Upload failed</p>
            <p className="text-xs mt-0.5" style={{ color: '#FCA5A5' }}>{uploadError}</p>
          </div>
          <button onClick={() => { setUploadError(null); handleUpload(); }}
            className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: '#EF4444', color: 'white' }}>
            Retry
          </button>
        </div>
      )}

      {/* Footer */}
      {files.length > 0 && (
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderTop: `1px solid ${C.border}` }}>
          <p className="text-xs" style={{ color: C.muted }}>
            {photos.length} photo{photos.length !== 1 ? 's' : ''} · {videos.length} video{videos.length !== 1 ? 's' : ''}
          </p>
          <button onClick={handleUpload}
            className="px-5 py-2 rounded-lg text-sm font-bold transition hover:brightness-110"
            style={{ background: C.orange, color: 'white' }}>
            Upload All
          </button>
        </div>
      )}
    </div>
  );
}

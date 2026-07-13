import { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Camera, Film, X, CheckCircle, Loader2, Check, AlertCircle, RotateCcw } from 'lucide-react';
import api from '../services/api';
import { uploadFile, type FileStatus } from '../utils/uploadMedia';

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

interface FileProgress {
  status: FileStatus;
  pct: number;
  error?: string;
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
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Per-file progress: keyed by index in the current upload batch
  const [fileProgress, setFileProgress] = useState<Map<string, FileProgress>>(new Map());
  const [uploadBatch, setUploadBatch] = useState<MediaFile[]>([]);
  const [batchDone, setBatchDone] = useState(false);

  const [result, setResult] = useState<{ photos: number; videos: number } | null>(null);
  const [showRigAttach, setShowRigAttach] = useState(false);
  const [attachOptions] = useState({ photos: true, videos: true, recap: true });
  const [attaching, setAttaching] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const photos = files.filter(f => f.type === 'photo');
  const videos = files.filter(f => f.type === 'video');

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      files.forEach(f => { if (f.preview) URL.revokeObjectURL(f.preview); });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;

    const newFiles: MediaFile[] = selected.map(file => {
      const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|avi|mkv|m4v)$/i.test(file.name);
      const isHEIC = file.type === 'image/heic' || file.type === 'image/heif' || /\.(heic|heif)$/i.test(file.name);
      let preview = '';
      try { if (!isHEIC && !isVideo) preview = URL.createObjectURL(file); } catch {}

      return {
        id: Math.random().toString(36).slice(2),
        file, type: isVideo ? 'video' as const : 'photo' as const,
        preview, caption: '', title: '', videoType: 'SHORT_CLIP',
      };
    });

    setFiles(prev => [...prev, ...newFiles].slice(0, 60));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (id: string) => {
    setFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file?.preview) URL.revokeObjectURL(file.preview);
      return prev.filter(f => f.id !== id);
    });
  };

  const updateFile = (id: string, updates: Partial<MediaFile>) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const runUpload = useCallback(async (filesToUpload: MediaFile[]) => {
    if (!filesToUpload.length) return;
    setUploading(true);
    setUploadError(null);
    setBatchDone(false);
    setUploadBatch(filesToUpload);
    // Initialize per-file progress
    const initialProgress = new Map<string, FileProgress>();
    filesToUpload.forEach(f => initialProgress.set(f.id, { status: 'queued', pct: 0 }));
    setFileProgress(initialProgress);

    // Concurrency pool: 3 simultaneous uploads
    const CONCURRENCY = 3;
    let nextIdx = 0;
    let uploadedPhotos = 0;
    let uploadedVideos = 0;

    const updateFP = (id: string, update: Partial<FileProgress>) => {
      setFileProgress(prev => {
        const next = new Map(prev);
        const cur = next.get(id) || { status: 'queued' as FileStatus, pct: 0 };
        next.set(id, { ...cur, ...update });
        return next;
      });
    };

    const uploadOne = async (mediaFile: MediaFile) => {
      const isVideo = mediaFile.type === 'video';
      const folder = isVideo ? `rvunicorn/trip-videos/${tripId}` : `rvunicorn/trip-photos/${tripId}`;

      updateFP(mediaFile.id, { status: 'uploading', pct: 0 });

      try {
        const cloudResult = await uploadFile(mediaFile.file, {
          folder,
          onProgress: (pct) => updateFP(mediaFile.id, { pct }),
        });

        updateFP(mediaFile.id, { status: 'saving', pct: 100 });

        if (isVideo) {
          await api.post(`/upload/trip/${tripId}/save-video`, {
            url: cloudResult.url, publicId: cloudResult.publicId,
            title: mediaFile.title, videoType: mediaFile.videoType,
            duration: cloudResult.duration || null,
          });
          uploadedVideos++;
        } else {
          await api.post(`/upload/trip/${tripId}/save-photo`, {
            url: cloudResult.url, publicId: cloudResult.publicId,
            caption: mediaFile.caption || null,
          });
          uploadedPhotos++;
        }

        updateFP(mediaFile.id, { status: 'done', pct: 100 });
      } catch (err: any) {
        const errMsg = err?.response?.data?.error || err?.message || String(err);
        console.error(`[TripMedia] Failed: ${mediaFile.file.name}`, errMsg);
        updateFP(mediaFile.id, { status: 'failed', pct: 0, error: errMsg });
        setUploadError(prev => prev || errMsg);
      }
    };

    const worker = async () => {
      while (nextIdx < filesToUpload.length) {
        const i = nextIdx++;
        await uploadOne(filesToUpload[i]);
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, filesToUpload.length) }, () => worker())
    );

    setUploading(false);
    setBatchDone(true);

    if (uploadedPhotos + uploadedVideos > 0) {
      setResult({ photos: uploadedPhotos, videos: uploadedVideos });
      if (rigName) setShowRigAttach(true);
      onUploadComplete?.({ photos: uploadedPhotos, videos: uploadedVideos });
    }
  }, [tripId, rigName, onUploadComplete]);

  const handleUpload = () => runUpload(files);

  const retryFile = (mediaFile: MediaFile) => {
    runUpload([mediaFile]);
  };

  const retryAllFailed = () => {
    const failedIds = Array.from(fileProgress.entries())
      .filter(([, fp]) => fp.status === 'failed')
      .map(([id]) => id);
    const failedMediaFiles = uploadBatch.filter(f => failedIds.includes(f.id));
    if (failedMediaFiles.length) runUpload(failedMediaFiles);
  };

  const handleAttachToRig = async () => {
    setAttaching(true);
    try {
      await api.post(`/upload/trip/${tripId}/attach-to-rig`, {
        includePhotos: attachOptions.photos, includeVideos: attachOptions.videos,
      });
      setShowRigAttach(false);
    } catch (err) { console.error('Attach failed:', err); }
    finally { setAttaching(false); }
  };

  // ── Upload complete + rig attachment ──
  if (result && !uploading) {
    const failedCount = Array.from(fileProgress.values()).filter(fp => fp.status === 'failed').length;
    if (failedCount === 0) {
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
              <div className="flex gap-2">
                <button onClick={handleAttachToRig} disabled={attaching}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold transition hover:brightness-110 disabled:opacity-50"
                  style={{ background: C.gold, color: C.bg }}>
                  {attaching ? 'Adding...' : 'Add to Rig Page'}
                </button>
                <button onClick={() => setShowRigAttach(false)} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ color: C.muted }}>
                  Keep Private
                </button>
              </div>
            </div>
          )}
          {onClose && (
            <button onClick={onClose} className="w-full py-2 rounded-lg text-sm font-medium" style={{ background: C.cardLight, color: C.cream }}>Done</button>
          )}
        </div>
      );
    }
  }

  // ── Upload in progress or done with per-file rows ──
  if (uploading || (batchDone && uploadBatch.length > 0)) {
    const entries = uploadBatch.map(f => ({ file: f, progress: fileProgress.get(f.id) || { status: 'queued' as FileStatus, pct: 0 } }));
    const doneCount = entries.filter(e => e.progress.status === 'done').length;
    const failedCount = entries.filter(e => e.progress.status === 'failed').length;
    const totalCount = entries.length;
    const allFinished = doneCount + failedCount >= totalCount;

    // Bytes-weighted overall progress
    const totalBytes = entries.reduce((s, e) => s + (e.file.file.size || 1), 0);
    const uploadedBytes = entries.reduce((s, e) => {
      if (e.progress.status === 'done' || e.progress.status === 'saving') return s + (e.file.file.size || 1);
      if (e.progress.status === 'uploading') return s + (e.file.file.size || 1) * (e.progress.pct / 100);
      return s;
    }, 0);
    const overallPct = totalBytes > 0 ? Math.round((uploadedBytes / totalBytes) * 100) : 0;

    return (
      <div className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="p-4">
          {/* Overall header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              {allFinished
                ? failedCount === 0
                  ? <CheckCircle className="w-5 h-5" style={{ color: C.green }} />
                  : <AlertCircle className="w-5 h-5" style={{ color: '#EF4444' }} />
                : <Loader2 className="w-5 h-5 animate-spin" style={{ color: C.gold }} />
              }
              <p className="text-sm font-bold" style={{ color: C.cream }}>
                {allFinished
                  ? failedCount === 0 ? 'All photos uploaded!' : `${doneCount} of ${totalCount} uploaded`
                  : `Uploading ${Math.min(doneCount + 3, totalCount)} of ${totalCount} — ${overallPct}%`
                }
              </p>
            </div>
            {allFinished && failedCount > 0 && (
              <button onClick={retryAllFailed} className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{ border: '1px solid #EF4444', color: '#EF4444' }}>
                <RotateCcw className="w-3 h-3" /> Retry {failedCount}
              </button>
            )}
          </div>

          {/* Overall progress bar */}
          <div className="h-2 rounded-full overflow-hidden mb-4" style={{ background: C.cardLight }}>
            <div className="h-full rounded-full transition-all duration-300" style={{
              width: `${overallPct}%`,
              background: allFinished && failedCount > 0 ? '#EF4444' : C.orange,
            }} />
          </div>

          {/* Per-file rows */}
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {entries.map(({ file: f, progress: fp }) => (
              <div key={f.id} className="flex items-center gap-2.5 rounded-lg p-2" style={{ background: C.cardLight }}>
                {/* Thumbnail */}
                <div className="w-9 h-9 rounded-md overflow-hidden flex-shrink-0" style={{ background: C.bg }}>
                  {f.preview ? (
                    <img src={f.preview} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      {f.type === 'video' ? <Film className="w-4 h-4" style={{ color: C.muted }} /> : <Camera className="w-4 h-4" style={{ color: C.muted }} />}
                    </div>
                  )}
                </div>

                {/* File info + progress */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[11px] truncate pr-2" style={{ color: C.cream }}>
                      {f.file.name || 'Photo'} <span style={{ color: C.muted }}>· {(f.file.size / 1024 / 1024).toFixed(1)}MB</span>
                    </p>
                    {/* Status indicator */}
                    {fp.status === 'done' && <Check className="w-4 h-4 shrink-0" style={{ color: C.gold }} />}
                    {fp.status === 'failed' && (
                      <button onClick={() => retryFile(f)} className="shrink-0 flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded"
                        style={{ color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                        <RotateCcw className="w-2.5 h-2.5" /> Retry
                      </button>
                    )}
                    {fp.status === 'uploading' && (
                      <span className="text-[10px] font-semibold shrink-0" style={{ color: C.orange }}>{fp.pct}%</span>
                    )}
                    {fp.status === 'saving' && (
                      <span className="text-[10px] shrink-0" style={{ color: C.gold }}>Saving...</span>
                    )}
                    {fp.status === 'queued' && (
                      <span className="text-[10px] shrink-0" style={{ color: C.muted }}>Queued</span>
                    )}
                  </div>
                  {/* Per-file progress bar (only while uploading) */}
                  {(fp.status === 'uploading' || fp.status === 'saving') && (
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: C.bg }}>
                      <div className="h-full rounded-full transition-all duration-150" style={{
                        width: `${fp.pct}%`,
                        background: C.orange,
                      }} />
                    </div>
                  )}
                  {/* Error message */}
                  {fp.status === 'failed' && fp.error && (
                    <p className="text-[10px] mt-0.5 truncate" style={{ color: '#FCA5A5' }}>{fp.error.slice(0, 60)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Done button */}
          {allFinished && onClose && (
            <button onClick={onClose}
              className="w-full mt-3 py-2.5 rounded-xl text-sm font-semibold transition hover:brightness-110"
              style={{ background: doneCount > 0 ? C.gold : C.cardLight, color: doneCount > 0 ? C.bg : C.cream }}>
              {doneCount > 0 ? 'Done' : 'Close'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── File selection ──
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${C.border}` }}>
        <h3 className="text-sm font-semibold" style={{ color: C.cream }}>Add Photos & Videos</h3>
        {onClose && <button onClick={onClose} style={{ color: C.muted }}><X className="w-4 h-4" /></button>}
      </div>

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

        {files.filter(f => (tab === 'photos' && f.type === 'photo') || (tab === 'videos' && f.type === 'video')).length > 0 && (
          <div className="mt-4 space-y-3">
            {files.filter(f => (tab === 'photos' && f.type === 'photo') || (tab === 'videos' && f.type === 'video')).map(f => (
              <div key={f.id} className="flex gap-3 rounded-xl p-2.5" style={{ background: C.cardLight }}>
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

      {uploadError && (
        <div className="mx-4 mb-3 rounded-xl p-3 flex items-center gap-2" style={{ background: '#2D1515', border: '1px solid #EF4444' }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: '#EF4444' }}>Upload failed</p>
            <p className="text-xs mt-0.5" style={{ color: '#FCA5A5' }}>{uploadError}</p>
          </div>
          <button onClick={() => { setUploadError(null); handleUpload(); }}
            className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: '#EF4444', color: 'white' }}>
            Retry
          </button>
        </div>
      )}

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

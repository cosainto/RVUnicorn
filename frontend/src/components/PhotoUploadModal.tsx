import React, { useState, useRef } from 'react';
import { X, Upload, Image, Loader2 } from 'lucide-react';
import { VisibilitySelector, SurfaceSelector, type VisibilityValue, type Surface } from './VisibilitySelector';
import api from '../services/api';

interface PhotoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  albumId?: string;
  eventId?: string;
  onUploadComplete?: (photo: any) => void;
}

export const PhotoUploadModal: React.FC<PhotoUploadModalProps> = ({
  isOpen,
  onClose,
  albumId,
  eventId,
  onUploadComplete,
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState<VisibilityValue>('PUBLIC');
  const [surfaces, setSurfaces] = useState<Surface[]>(['PROFILE', 'RIG', 'TRIP', 'CAMPGROUND']);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    console.log('[PhotoUpload] Selected:', files.length, 'files');

    setSelectedFiles(files);
    // Generate previews (skip HEIC which can't preview)
    const newPreviews = files.map(f => {
      const isHEIC = /\.(heic|heif)$/i.test(f.name) || f.type === 'image/heic';
      if (isHEIC || f.type.startsWith('video/')) return '';
      try { return URL.createObjectURL(f); } catch { return ''; }
    });
    setPreviews(newPreviews);
    // Reset input for re-selection
    if (e.target) e.target.value = '';
  };

  const handleUpload = async () => {
    if (!selectedFiles.length) return;
    setUploading(true);
    setUploadProgress(0);

    let uploaded = 0;
    let failed = 0;
    let lastResponse: any = null;

    // Upload in batches of 3 for speed + reliability
    const BATCH = 3;
    for (let i = 0; i < selectedFiles.length; i += BATCH) {
      const batch = selectedFiles.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        batch.map(async (file, idx) => {
          const formData = new FormData();
          formData.append('image', file, file.name || `photo_${i + idx}.jpg`);
          if (i + idx === 0) formData.append('caption', caption);
          formData.append('visibility', visibility);
          formData.append('surfaces', JSON.stringify(surfaces));
          if (albumId) formData.append('albumId', albumId);
          if (eventId) formData.append('eventId', eventId);
          return api.post('/photos', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 120000,
          });
        })
      );
      results.forEach(r => {
        if (r.status === 'fulfilled') { uploaded++; lastResponse = r.value.data; }
        else { failed++; console.error('[PhotoUpload] Failed:', r.reason?.message); }
      });
      setUploadProgress(Math.round(((i + batch.length) / selectedFiles.length) * 100));
    }

    console.log(`[PhotoUpload] ${uploaded} uploaded, ${failed} failed`);
    if (uploaded > 0) {
      onUploadComplete?.(lastResponse || { uploaded });
    }
    setUploading(false);
    handleClose();
  };

  const handleClose = () => {
    previews.forEach(p => { if (p) URL.revokeObjectURL(p); });
    setSelectedFiles([]);
    setPreviews([]);
    setCaption('');
    setVisibility('PUBLIC');
    setSurfaces(['PROFILE', 'RIG', 'TRIP', 'CAMPGROUND']);
    setUploadProgress(0);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Upload Photo</h2>
          <button
            onClick={handleClose}
            className="p-1 rounded-full hover:bg-gray-100"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Image Preview / Upload Area */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
              selectedFiles.length > 0
                ? 'border-amber-300 bg-amber-50'
                : 'border-gray-300 hover:border-amber-400 bg-gray-50'
            }`}
          >
            {selectedFiles.length > 0 ? (
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-gray-900">{selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected</p>
                  <button onClick={(e) => { e.stopPropagation(); setSelectedFiles([]); setPreviews([]); }} className="text-xs text-red-500 hover:text-red-700">Clear</button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {previews.slice(0, 8).map((p, i) => (
                    <div key={i} className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                      {p ? <img src={p} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">{selectedFiles[i]?.name?.split('.').pop()?.toUpperCase() || '📷'}</div>}
                    </div>
                  ))}
                  {selectedFiles.length > 8 && <div className="aspect-square rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-500">+{selectedFiles.length - 8}</div>}
                </div>
                {uploading && <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} /></div>}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="p-3 bg-amber-100 rounded-full mb-3">
                  <Image className="w-8 h-8 text-amber-600" />
                </div>
                <p className="text-sm font-medium text-gray-700">Tap to select photos & videos</p>
                <p className="text-xs text-gray-500 mt-1">Any format · Any size · Auto-optimized</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,image/heic,image/heif,video/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Caption */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Caption (optional)
            </label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a caption to your photo..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none"
            />
          </div>

          {/* Visibility Selector */}
          <VisibilitySelector value={visibility} onChange={setVisibility} />

          {/* Surface Selector — where it appears */}
          {visibility !== 'PRIVATE' && (
            <SurfaceSelector value={surfaces} onChange={setSurfaces} />
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t bg-gray-50 rounded-b-xl">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!selectedFiles.length || uploading}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Upload
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PhotoUploadModal;

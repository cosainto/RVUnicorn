import { useState, useEffect } from 'react';
import { X, Image as ImageIcon, Link as LinkIcon } from 'lucide-react';
import api from '../services/api';

interface ImageUploadProps {
  onImageUploaded: (imageUrl: string) => void;
  currentImage?: string;
  label?: string;
  eventId?: string;  // If provided, links photo to this event
  albumId?: string;  // If provided, links photo to this album
  caption?: string;  // Optional caption for the photo
}

export default function ImageUpload({ 
  onImageUploaded, 
  currentImage, 
  label = "Upload Image",
  eventId,
  albumId,
  caption,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(currentImage || '');

  // Sync preview when currentImage prop changes (e.g. pre-filled from campground)
  useEffect(() => {
    if (currentImage) setPreview(currentImage);
  }, [currentImage]);
  const [mode, setMode] = useState<'upload' | 'url'>('upload');
  const [urlInput, setUrlInput] = useState('');

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    // Reset input so same files can be re-selected
    if (e.target) e.target.value = '';

    console.log('[ImageUpload] Selected:', files.length, 'files');

    // Upload all files sequentially
    setUploading(true);
    let lastUrl = '';

    for (const file of files) {
      // Skip non-image/video (allow HEIC which may report as '')
      const isValid = file.type.startsWith('image/') || file.type.startsWith('video/') ||
        /\.(heic|heif|jpg|jpeg|png|gif|webp|mp4|mov)$/i.test(file.name);
      if (!isValid) continue;

      // Show preview for first file only
      if (!lastUrl) {
        try {
          const isHEIC = /\.(heic|heif)$/i.test(file.name) || file.type === 'image/heic';
          if (!isHEIC && file.type.startsWith('image/')) {
            setPreview(URL.createObjectURL(file));
          }
        } catch {}
      }

      try {
        const formData = new FormData();
        formData.append('image', file, file.name || 'photo.jpg');
        if (eventId) formData.append('eventId', eventId);
        if (albumId) formData.append('albumId', albumId);
        if (caption && !lastUrl) formData.append('caption', caption); // caption on first only

        const { data } = await api.post('/upload/image', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const imageUrl = data.url || data.imageUrl;
        lastUrl = imageUrl.startsWith('http') ? imageUrl : `${window.location.origin}${imageUrl}`;
        onImageUploaded(lastUrl);
      } catch (error) {
        console.error('[ImageUpload] Failed:', file.name, error);
      }
    }

    if (!lastUrl) {
      alert('Failed to upload. Please try again.');
      setPreview(currentImage || '');
    }
    setUploading(false);
  };

  const handleUrlSubmit = () => {
    if (!urlInput) return;
    
    // Validate URL
    try {
      new URL(urlInput);
      setPreview(urlInput);
      onImageUploaded(urlInput);
      setUrlInput('');
    } catch {
      alert('Please enter a valid URL');
    }
  };

  const handleRemove = () => {
    setPreview('');
    setUrlInput('');
    onImageUploaded('');
  };

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        {label}
      </label>

      {/* Mode Toggle */}
      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={() => setMode('upload')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
            mode === 'upload'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <ImageIcon className="w-4 h-4 inline mr-2" />
          Upload
        </button>
        <button
          type="button"
          onClick={() => setMode('url')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
            mode === 'url'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <LinkIcon className="w-4 h-4 inline mr-2" />
          URL
        </button>
      </div>
      
      {preview ? (
        <div className="relative">
          <img
            src={preview}
            alt="Preview"
            className="w-full h-48 object-cover rounded-lg border-2 border-gray-200"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 shadow-lg"
          >
            <X className="w-4 h-4" />
          </button>
          {eventId && (
            <span className="absolute bottom-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
              📸 Linked to event
            </span>
          )}
        </div>
      ) : (
        <>
          {mode === 'upload' ? (
            <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-400 hover:bg-gray-50 transition">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                {uploading ? (
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                ) : (
                  <>
                    <ImageIcon className="w-12 h-12 text-gray-400 mb-3" />
                    <p className="mb-2 text-sm text-gray-600">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                    {eventId && (
                      <p className="text-xs text-green-600 mt-1">📸 Photo will be added to event gallery</p>
                    )}
                  </>
                )}
              </div>
              <input
                type="file"
                className="hidden"
                accept="image/*,image/heic,image/heif,video/*"
                multiple
                onChange={handleFileSelect}
                disabled={uploading}
              />
            </label>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="input flex-1"
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleUrlSubmit())}
                />
                <button
                  type="button"
                  onClick={handleUrlSubmit}
                  className="btn btn-primary"
                  disabled={!urlInput}
                >
                  Add
                </button>
              </div>
              <p className="text-xs text-gray-500">Paste an image URL from the web</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

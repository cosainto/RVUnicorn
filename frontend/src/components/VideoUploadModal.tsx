import React, { useState, useRef } from 'react';
import { X, Upload, Video, Loader2, Link } from 'lucide-react';
import { VisibilitySelector } from './VisibilitySelector';
import api from '../services/api';

interface VideoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  albumId?: string;
  onUploadComplete?: (video: any) => void;
}

type UploadMode = 'file' | 'url';

export const VideoUploadModal: React.FC<VideoUploadModalProps> = ({
  isOpen,
  onClose,
  albumId,
  onUploadComplete,
}) => {
  const [uploadMode, setUploadMode] = useState<UploadMode>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'PUBLIC' | 'FRIENDS' | 'PRIVATE'>('PUBLIC');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('video/')) {
        console.error('Please select a video file');
        return;
      }
      if (file.size > 100 * 1024 * 1024) {
        console.error('Video must be less than 100MB');
        return;
      }
      setSelectedFile(file);
      // Auto-fill title from filename
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
      if (!title) setTitle(nameWithoutExt);
    }
  };

  const handleUpload = async () => {
    if (uploadMode === 'file' && !selectedFile) {
      console.error('Please select a video file');
      return;
    }
    if (uploadMode === 'url' && !videoUrl) {
      console.error('Please enter a video URL');
      return;
    }

    setUploading(true);
    try {
      let response;

      if (uploadMode === 'file' && selectedFile) {
        const formData = new FormData();
        formData.append('video', selectedFile);
        formData.append('title', title);
        formData.append('description', description);
        formData.append('visibility', visibility);
        if (albumId) formData.append('albumId', albumId);

        response = await api.post('/videos', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            const progress = progressEvent.total
              ? Math.round((progressEvent.loaded / progressEvent.total) * 100)
              : 0;
            setUploadProgress(progress);
          },
        });
      } else {
        response = await api.post('/videos/url', {
          videoUrl,
          thumbnailUrl: thumbnailUrl || undefined,
          title,
          description,
          visibility,
          albumId: albumId || undefined,
        });
      }

      console.log('Video uploaded successfully!');
      onUploadComplete?.(response.data);
      handleClose();
    } catch (error: any) {
      console.error('Upload error:', error);
      console.error(error.response?.data?.error || 'Failed to upload video');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setVideoUrl('');
    setThumbnailUrl('');
    setTitle('');
    setDescription('');
    setVisibility('PUBLIC');
    setUploadMode('file');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Upload Video</h2>
          <button onClick={handleClose} className="p-1 rounded-full hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Upload Mode Tabs */}
          <div className="flex rounded-lg bg-gray-100 p-1">
            <button
              onClick={() => setUploadMode('file')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${
                uploadMode === 'file'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Upload className="w-4 h-4" />
              Upload File
            </button>
            <button
              onClick={() => setUploadMode('url')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${
                uploadMode === 'url'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Link className="w-4 h-4" />
              From URL
            </button>
          </div>

          {uploadMode === 'file' ? (
            /* File Upload Area */
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl cursor-pointer transition-colors p-8 ${
                selectedFile
                  ? 'border-amber-300 bg-amber-50'
                  : 'border-gray-300 hover:border-amber-400 bg-gray-50'
              }`}
            >
              <div className="flex flex-col items-center justify-center">
                <div className="p-3 bg-amber-100 rounded-full mb-3">
                  <Video className="w-8 h-8 text-amber-600" />
                </div>
                {selectedFile ? (
                  <>
                    <p className="text-sm font-medium text-gray-700">{selectedFile.name}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                      }}
                      className="mt-2 text-xs text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-gray-700">Click to upload a video</p>
                    <p className="text-xs text-gray-500 mt-1">MP4, MOV, AVI up to 100MB</p>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          ) : (
            /* URL Input */
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Video URL *
                </label>
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://example.com/video.mp4"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Direct link to video file or embed URL
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Thumbnail URL (optional)
                </label>
                <input
                  type="url"
                  value={thumbnailUrl}
                  onChange={(e) => setThumbnailUrl(e.target.value)}
                  placeholder="https://example.com/thumbnail.jpg"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give your video a title..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none"
            />
          </div>

          {/* Visibility Selector */}
          <VisibilitySelector value={visibility} onChange={setVisibility} />

          {/* Upload Progress */}
          {uploading && uploadMode === 'file' && uploadProgress > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Uploading...</span>
                <span className="text-amber-600 font-medium">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-amber-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
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
            disabled={
              uploading ||
              (uploadMode === 'file' && !selectedFile) ||
              (uploadMode === 'url' && !videoUrl)
            }
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {uploadMode === 'file' ? 'Uploading...' : 'Saving...'}
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Upload Video
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoUploadModal;

import React, { useState, useRef } from 'react';
import { X, Upload, Image, Loader2 } from 'lucide-react';
import { VisibilitySelector } from './VisibilitySelector';
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState<'PUBLIC' | 'FRIENDS' | 'PRIVATE'>('PUBLIC');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        console.error('Please select an image file');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        console.error('Image must be less than 10MB');
        return;
      }
      setSelectedFile(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      console.error('Please select an image');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('caption', caption);
      formData.append('visibility', visibility);
      if (albumId) formData.append('albumId', albumId);
      if (eventId) formData.append('eventId', eventId);

      const response = await api.post('/photos', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      console.log('Photo uploaded successfully!');
      onUploadComplete?.(response.data);
      handleClose();
    } catch (error: any) {
      console.error('Upload error:', error);
      console.error(error.response?.data?.error || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setPreview(null);
    setCaption('');
    setVisibility('PUBLIC');
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
              preview
                ? 'border-amber-300 bg-amber-50'
                : 'border-gray-300 hover:border-amber-400 bg-gray-50'
            }`}
          >
            {preview ? (
              <div className="relative aspect-video">
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full h-full object-contain rounded-lg"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                    setPreview(null);
                  }}
                  className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white hover:bg-black/70"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="p-3 bg-amber-100 rounded-full mb-3">
                  <Image className="w-8 h-8 text-amber-600" />
                </div>
                <p className="text-sm font-medium text-gray-700">Click to upload a photo</p>
                <p className="text-xs text-gray-500 mt-1">PNG, JPG, GIF up to 10MB</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
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
            disabled={!selectedFile || uploading}
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

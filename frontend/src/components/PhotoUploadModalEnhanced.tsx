import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  Image as ImageIcon, 
  Globe, 
  Users, 
  Lock,
  Calendar,
  Download,
  DownloadOff,
  Clock
} from 'lucide-react';
import { CrossPostToggle } from "./CrossPostToggle";
import { MentionInput } from './MentionInput';

interface PhotoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  albumId?: string;
  eventId?: string;
  onUploadComplete?: (photo: any) => void;
}

const VISIBILITY_OPTIONS = [
  { value: 'PUBLIC', label: 'Public', icon: Globe, description: 'Anyone can see this photo' },
  { value: 'FRIENDS', label: 'Friends', icon: Users, description: 'Only friends can see this photo' },
  { value: 'PRIVATE', label: 'Private', icon: Lock, description: 'Only you can see this photo' },
];

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
  const [visibility, setVisibility] = useState('PUBLIC');
  const [allowDownload, setAllowDownload] = useState(true);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [shareToBasecamp, setShareToBasecamp] = useState(false);
  const [basecampMessage, setBasecampMessage] = useState("");
  const [scheduledTime, setScheduledTime] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 100 * 1024 * 1024) {
      setError('Image must be less than 10MB');
      return;
    }

    setSelectedFile(file);
    setError('');

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select an image');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('caption', caption);
      formData.append('visibility', visibility);
      formData.append('allowDownload', String(allowDownload));
      
      if (albumId) formData.append('albumId', albumId);
      formData.append('shareToBasecamp', String(shareToBasecamp));
      if (basecampMessage) formData.append('basecampMessage', basecampMessage);
      if (eventId) formData.append('eventId', eventId);
      
      if (scheduleEnabled && scheduledDate && scheduledTime) {
        const scheduledFor = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
        formData.append('scheduledFor', scheduledFor);
      }

      const response = await fetch('/api/photos', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Upload failed');
      }

      const photo = await response.json();
      onUploadComplete?.(photo);
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setPreview(null);
    setCaption('');
    setVisibility('PUBLIC');
    setAllowDownload(true);
    setScheduleEnabled(false);
    setShareToBasecamp(false);
    setBasecampMessage("");
    setScheduledDate('');
    setScheduledTime('');
    setError('');
    onClose();
  };

  // Get min date for scheduler (tomorrow)
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateStr = minDate.toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h3 className="text-lg font-semibold">Upload Photo</h3>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* File selection / Preview */}
          {!preview ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
            >
              <ImageIcon size={48} className="mx-auto text-gray-400 mb-3" />
              <p className="text-gray-600 font-medium">Click to select a photo</p>
              <p className="text-sm text-gray-400 mt-1">Any format · Any size · Auto-optimized</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,image/heic,image/heif,video/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          ) : (
            <div className="relative">
              <img
                src={preview}
                alt="Preview"
                className="w-full h-64 object-cover rounded-xl"
              />
              <button
                onClick={() => {
                  setSelectedFile(null);
                  setPreview(null);
                }}
                className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70"
              >
                <X size={18} />
              </button>
            </div>
          )}

          {/* Caption with mentions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Caption
            </label>
            <MentionInput
              value={caption}
              onChange={setCaption}
              placeholder="Write a caption... Use @ to mention someone"
              rows={3}
            />
          </div>

          {/* Visibility selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Who can see this?
            </label>
            <div className="grid grid-cols-3 gap-2">
              {VISIBILITY_OPTIONS.map(option => {
                const Icon = option.icon;
                const isSelected = visibility === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => setVisibility(option.value)}
                    className={`
                      p-3 rounded-xl border-2 text-center transition-all
                      ${isSelected 
                        ? 'border-blue-500 bg-blue-50 text-blue-700' 
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                      }
                    `}
                  >
                    <Icon size={20} className="mx-auto mb-1" />
                    <span className="text-sm font-medium">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Download control */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-3">
              {allowDownload ? (
                <Download size={20} className="text-gray-500" />
              ) : (
                <DownloadOff size={20} className="text-gray-500" />
              )}
              <div>
                <p className="font-medium text-gray-900">Allow downloads</p>
                <p className="text-sm text-gray-500">
                  {allowDownload ? 'Others can download this photo' : 'Downloads are disabled'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setAllowDownload(!allowDownload)}
              className={`
                relative w-12 h-6 rounded-full transition-colors
                ${allowDownload ? 'bg-blue-500' : 'bg-gray-300'}
              `}
            >
              <span
                className={`
                  absolute top-1 w-4 h-4 bg-white rounded-full transition-transform
                  ${allowDownload ? 'left-7' : 'left-1'}
                `}
              />
            </button>
          </div>

          {/* Schedule publishing */}
          <div className="p-3 bg-gray-50 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Clock size={20} className="text-gray-500" />
                <div>
                  <p className="font-medium text-gray-900">Schedule for later</p>
                  <p className="text-sm text-gray-500">Publish at a specific time</p>
                </div>
              </div>
              <button
                onClick={() => setScheduleEnabled(!scheduleEnabled)}
                className={`
                  relative w-12 h-6 rounded-full transition-colors
                  ${scheduleEnabled ? 'bg-blue-500' : 'bg-gray-300'}
                `}
              >
                <span
                  className={`
                    absolute top-1 w-4 h-4 bg-white rounded-full transition-transform
                    ${scheduleEnabled ? 'left-7' : 'left-1'}
                  `}
                />
              </button>
            </div>

            {scheduleEnabled && (
              <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-gray-200">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Date</label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    min={minDateStr}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Time</label>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Cross-post to Basecamp */}
          <CrossPostToggle
            enabled={shareToBasecamp}
            onToggle={setShareToBasecamp}
            message={basecampMessage}
            onMessageChange={setBasecampMessage}
            label="Also share to Basecamp"
          />

          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              className="flex-1 px-4 py-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Uploading...
                </>
              ) : scheduleEnabled ? (
                <>
                  <Calendar size={18} />
                  Schedule
                </>
              ) : (
                <>
                  <Upload size={18} />
                  Upload
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhotoUploadModal;

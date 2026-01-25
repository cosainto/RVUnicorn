import React, { useState } from 'react';
import { X, Share2, Megaphone, Loader2, Check } from 'lucide-react';
import api from '../services/api';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  contentType: 'photo' | 'video';
  contentId: string;
  contentPreview?: string; // Image URL or thumbnail
  contentTitle?: string;
  onSuccess?: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  contentType,
  contentId,
  contentPreview,
  contentTitle,
  onSuccess
}) => {
  const [message, setMessage] = useState('');
  const [sharing, setSharing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleShare = async () => {
    setSharing(true);
    setError('');

    try {
      await api.post(`/crosspost/${contentType}/${contentId}/share`, {
        message,
        visibility: 'PUBLIC'
      });

      setSuccess(true);
      onSuccess?.();
      
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to share');
    } finally {
      setSharing(false);
    }
  };

  const handleClose = () => {
    setMessage('');
    setSuccess(false);
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Share2 size={20} className="text-blue-500" />
            <h2 className="text-lg font-semibold">Share to Basecamp</h2>
          </div>
          <button onClick={handleClose} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Preview */}
          {contentPreview && (
            <div className="rounded-xl overflow-hidden bg-gray-100">
              {contentType === 'video' ? (
                <video 
                  src={contentPreview} 
                  className="w-full h-40 object-cover"
                  muted
                />
              ) : (
                <img 
                  src={contentPreview} 
                  alt="" 
                  className="w-full h-40 object-cover"
                />
              )}
            </div>
          )}

          {contentTitle && (
            <p className="text-sm text-gray-600 font-medium">{contentTitle}</p>
          )}

          {/* Message input */}
          <textarea
            placeholder="Add a message (optional)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            disabled={sharing || success}
          />

          {/* Destination indicator */}
          <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
            <Megaphone size={16} className="text-green-500" />
            <span>This will appear in the Basecamp feed</span>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-500 bg-red-50 px-4 py-2 rounded-lg">{error}</p>
          )}

          {/* Success */}
          {success && (
            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-4 py-2 rounded-lg">
              <Check size={16} />
              <span>Shared successfully!</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleShare}
            disabled={sharing || success}
            className="w-full py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {sharing ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Sharing...
              </>
            ) : success ? (
              <>
                <Check size={18} />
                Shared!
              </>
            ) : (
              <>
                <Share2 size={18} />
                Share to Basecamp
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;

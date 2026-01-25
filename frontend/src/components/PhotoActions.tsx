import React, { useState } from 'react';
import { 
  Bookmark, 
  BookmarkCheck, 
  Share2, 
  Download, 
  MoreHorizontal,
  Flag,
  Link2,
  Twitter,
  Facebook,
  Copy,
  Check,
  X,
  ExternalLink
} from 'lucide-react';

interface PhotoActionsProps {
  photoId: string;
  isSaved: boolean;
  saveCount?: number;
  allowDownload: boolean;
  imageUrl: string;
  visibility: string;
  onSave: (photoId: string) => void;
}

export const PhotoActions: React.FC<PhotoActionsProps> = ({
  photoId,
  isSaved,
  saveCount = 0,
  allowDownload,
  imageUrl,
  visibility,
  onSave,
}) => {
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(photoId);
    setSaving(false);
  };

  const handleDownload = async () => {
    if (!allowDownload) return;
    
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `photo-${photoId}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const handleCopyLink = async () => {
    const link = `${window.location.origin}/photos/${photoId}`;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = (platform: string) => {
    const link = `${window.location.origin}/photos/${photoId}`;
    const text = 'Check out this photo!';
    
    let shareUrl = '';
    switch (platform) {
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`;
        break;
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`;
        break;
    }
    
    if (shareUrl) {
      window.open(shareUrl, '_blank', 'width=600,height=400');
    }
    setShowShareMenu(false);
  };

  const canShare = visibility === 'PUBLIC';

  return (
    <div className="flex items-center gap-2">
      {/* Save/Bookmark button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className={`
          flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
          transition-all duration-200
          ${isSaved 
            ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' 
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }
          ${saving ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        {isSaved ? (
          <BookmarkCheck size={18} className="fill-current" />
        ) : (
          <Bookmark size={18} />
        )}
        <span>{isSaved ? 'Saved' : 'Save'}</span>
        {saveCount > 0 && <span className="text-gray-400 ml-1">{saveCount}</span>}
      </button>

      {/* Share button (only for public photos) */}
      {canShare && (
        <div className="relative">
          <button
            onClick={() => setShowShareMenu(!showShareMenu)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200"
          >
            <Share2 size={18} />
            <span>Share</span>
          </button>

          {showShareMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50">
              <button
                onClick={handleCopyLink}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                {copied ? <Check size={18} className="text-green-500" /> : <Link2 size={18} />}
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
              <button
                onClick={() => handleShare('twitter')}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Twitter size={18} />
                Share on Twitter
              </button>
              <button
                onClick={() => handleShare('facebook')}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Facebook size={18} />
                Share on Facebook
              </button>
            </div>
          )}
        </div>
      )}

      {/* More options */}
      <div className="relative">
        <button
          onClick={() => setShowMoreMenu(!showMoreMenu)}
          className="p-2 rounded-full text-gray-500 hover:bg-gray-100"
        >
          <MoreHorizontal size={20} />
        </button>

        {showMoreMenu && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50">
            {allowDownload && (
              <button
                onClick={handleDownload}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Download size={18} />
                Download
              </button>
            )}
            <button
              onClick={() => window.open(imageUrl, '_blank')}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <ExternalLink size={18} />
              Open Original
            </button>
            <hr className="my-1" />
            <button
              onClick={() => {
                setShowMoreMenu(false);
                setShowReportModal(true);
              }}
              className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <Flag size={18} />
              Report Photo
            </button>
          </div>
        )}
      </div>

      {/* Report Modal */}
      {showReportModal && (
        <ReportModal
          photoId={photoId}
          onClose={() => setShowReportModal(false)}
        />
      )}

      {/* Click outside handlers */}
      {(showShareMenu || showMoreMenu) && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => {
            setShowShareMenu(false);
            setShowMoreMenu(false);
          }}
        />
      )}
    </div>
  );
};

// Report Modal Component
interface ReportModalProps {
  photoId: string;
  onClose: () => void;
}

const REPORT_REASONS = [
  { value: 'INAPPROPRIATE', label: 'Inappropriate content', description: 'Nudity, violence, or disturbing content' },
  { value: 'SPAM', label: 'Spam', description: 'Misleading or repetitive content' },
  { value: 'HARASSMENT', label: 'Harassment', description: 'Bullying, threats, or hate speech' },
  { value: 'COPYRIGHT', label: 'Copyright violation', description: 'Content that infringes on intellectual property' },
  { value: 'OTHER', label: 'Other', description: 'Something else not listed above' },
];

const ReportModal: React.FC<ReportModalProps> = ({ photoId, onClose }) => {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!reason) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/photos/${photoId}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ reason, details })
      });

      if (response.ok) {
        setSubmitted(true);
        setTimeout(onClose, 2000);
      }
    } catch (error) {
      console.error('Error submitting report:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Report Photo</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        {submitted ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
              <Check size={32} className="text-green-600" />
            </div>
            <h4 className="text-lg font-semibold text-gray-900 mb-2">Report Submitted</h4>
            <p className="text-gray-500">
              Thank you for helping keep our community safe. We'll review this photo and take appropriate action.
            </p>
          </div>
        ) : (
          <div className="p-4">
            <p className="text-sm text-gray-500 mb-4">
              Why are you reporting this photo? Your report is anonymous.
            </p>

            <div className="space-y-2 mb-4">
              {REPORT_REASONS.map(r => (
                <label
                  key={r.value}
                  className={`
                    block p-3 rounded-lg border cursor-pointer transition-colors
                    ${reason === r.value 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                    }
                  `}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={(e) => setReason(e.target.value)}
                    className="sr-only"
                  />
                  <div className="font-medium text-gray-900">{r.label}</div>
                  <div className="text-sm text-gray-500">{r.description}</div>
                </label>
              ))}
            </div>

            {reason && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Additional details (optional)
                </label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Provide any additional context..."
                  rows={3}
                  className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!reason || submitting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PhotoActions;

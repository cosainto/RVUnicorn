import { useState, useRef, useEffect } from 'react';
import { MoreHorizontal, EyeOff, VolumeX, Volume2, Ban, Eye, Flag, Trash2, Settings, X } from 'lucide-react';
import api from '../services/api';

interface Props {
  activityId: string;
  authorId: string;
  authorUsername: string;
  authorFirstName: string;
  isOwnPost: boolean;
  isSystemPost: boolean;
  contentType?: string;
  itemReason?: string;
  campgroundName?: string;
  boardName?: string;
  onHide: () => void;
  onMuteAuthor: () => void;
  onDelete?: () => void;
}

export default function FeedItemMenu({
  activityId, authorId, authorUsername, authorFirstName,
  isOwnPost, isSystemPost, contentType, itemReason,
  campgroundName, boardName, onHide, onMuteAuthor, onDelete,
}: Props) {
  const [open, setOpen] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; undoAction?: () => void } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 6000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const handleHide = async () => {
    setOpen(false);
    await api.post(`/feed/hide/${activityId}`).catch(() => {});
    onHide();
    setToast({ msg: "Post hidden — we won't show this again", undoAction: async () => {
      await api.delete(`/feed/hide/${activityId}`).catch(() => {});
    }});
  };

  const handleSeeLess = async () => {
    setOpen(false);
    await api.post(`/feed/preference/${authorId}`, { type: 'see_less' }).catch(() => {});
    setToast({ msg: `You'll see less from ${authorFirstName}`, undoAction: async () => {
      await api.delete(`/feed/preference/${authorId}`).catch(() => {});
    }});
  };

  const handleMute = async () => {
    setOpen(false);
    await api.post(`/feed/preference/${authorId}`, { type: 'mute' }).catch(() => {});
    onMuteAuthor();
    setToast({ msg: `Taking a break from ${authorFirstName} for 30 days`, undoAction: async () => {
      await api.delete(`/feed/preference/${authorId}`).catch(() => {});
    }});
  };

  const handleBlock = async () => {
    if (!confirm(`Block ${authorFirstName}? You won't see each other's content.`)) return;
    setOpen(false);
    await api.post(`/feed/preference/${authorId}`, { type: 'block' }).catch(() => {});
    onMuteAuthor();
  };

  const handleContentPref = async (pref: string) => {
    setOpen(false);
    await api.post('/feed/content-type-preference', { contentType, preference: pref }).catch(() => {});
    setToast({ msg: `You'll see fewer ${contentType} updates` });
  };

  const handleDeletePost = async () => {
    if (!confirm('Delete this post?')) return;
    setOpen(false);
    if (onDelete) onDelete();
  };

  const reasonText: Record<string, string> = {
    'friend': `You're seeing this because you follow ${authorFirstName}`,
    'followed_board': `You're seeing this because you follow the ${boardName || 'community'} board`,
    'popular_nearby': 'This is popular with campers near your area',
    'same_campground': `You've visited ${campgroundName || 'this campground'} — this is related`,
    'following': `You're seeing this because you follow ${authorFirstName}`,
  };

  return (
    <>
      <div ref={menuRef} className="relative">
        <button onClick={() => setOpen(!open)}
          className="p-1 rounded-full text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition opacity-0 group-hover:opacity-100">
          <MoreHorizontal className="w-4 h-4" />
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-gray-200 py-1 z-50 min-w-[240px]">
            {isOwnPost ? (
              <button onClick={handleDeletePost} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition">
                <Trash2 className="w-4 h-4" /> Delete this
              </button>
            ) : isSystemPost ? (
              <>
                <button onClick={() => handleContentPref('less')} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition">
                  <Settings className="w-4 h-4" /> Show fewer {contentType || 'system'} updates
                </button>
                <button onClick={() => handleContentPref('summary')} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition">
                  <VolumeX className="w-4 h-4" /> Only show summaries
                </button>
              </>
            ) : (
              <>
                <button onClick={handleHide} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition">
                  <EyeOff className="w-4 h-4" /> Hide this
                </button>
                <button onClick={handleSeeLess} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition">
                  <Volume2 className="w-4 h-4" /> See less from {authorFirstName}
                </button>
                <button onClick={handleMute} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition">
                  <VolumeX className="w-4 h-4" /> Take a break from {authorFirstName}
                </button>
                <button onClick={handleBlock} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition">
                  <Ban className="w-4 h-4" /> Block {authorFirstName}
                </button>
                <div className="border-t border-gray-100 my-1" />
                <button onClick={() => { setShowWhy(!showWhy); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50 transition">
                  <Eye className="w-4 h-4" /> Why am I seeing this?
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50 transition">
                  <Flag className="w-4 h-4" /> Report
                </button>
              </>
            )}

            {showWhy && itemReason && (
              <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
                <p className="text-xs text-gray-600 mb-2">{reasonText[itemReason] || `You're seeing this because it's in your feed`}</p>
                {itemReason === 'friend' && (
                  <button onClick={handleMute} className="text-xs text-orange-600 font-semibold hover:underline">Take a break from {authorFirstName}</button>
                )}
                {itemReason === 'popular_nearby' && (
                  <button onClick={() => handleContentPref('less')} className="text-xs text-orange-600 font-semibold hover:underline">See less trending content</button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-xl z-50 flex items-center gap-3 text-sm max-w-sm">
          <span className="flex-1">{toast.msg}</span>
          {toast.undoAction && (
            <button onClick={async () => { await toast.undoAction?.(); setToast(null); }}
              className="text-orange-400 font-semibold hover:text-orange-300 flex-shrink-0">Undo</button>
          )}
          <button onClick={() => setToast(null)} className="text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
      )}
    </>
  );
}

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, X } from 'lucide-react';
import api from '../../services/api';

export default function HitchThreadSuggestions() {
  const [threads, setThreads] = useState<any[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Don't show if user dismissed today
    const dismissKey = `hitch_thread_dismiss_${new Date().toISOString().slice(0, 10)}`;
    if (localStorage.getItem(dismissKey)) { setDismissed(true); setLoading(false); return; }

    api.get('/community/for-you?limit=4')
      .then(({ data }) => setThreads(data.posts || data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || dismissed || threads.length === 0) return null;

  const handleDismiss = () => {
    const dismissKey = `hitch_thread_dismiss_${new Date().toISOString().slice(0, 10)}`;
    localStorage.setItem(dismissKey, '1');
    setDismissed(true);
  };

  return (
    <div className="bg-white rounded-xl border border-amber-100 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-amber-50 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(249,115,22,0.06))' }}>
        <div className="flex items-center gap-2">
          <img src="/hitch.png" className="w-5 h-5 rounded-full" alt="Hitch" />
          <span className="font-bold text-xs text-amber-800">Hitch thinks you'd like these</span>
        </div>
        <button onClick={handleDismiss} className="text-gray-300 hover:text-gray-500 transition">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="divide-y divide-gray-50">
        {threads.map((post: any) => (
          <Link key={post.id} to={`/community/${post.board?.slug || ''}`} state={{ postId: post.id }}
            className="flex gap-3 px-4 py-2.5 hover:bg-amber-50/50 transition">
            <div className="flex flex-col items-center pt-0.5 flex-shrink-0">
              <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              {post.board && (
                <div className="flex items-center gap-1 mb-0.5">
                  <span className="text-[10px]">{post.board.icon}</span>
                  <span className="text-[10px] text-gray-400">{post.board.name}</span>
                  {post._matchReason && <span className="text-[10px] text-amber-500 ml-auto">{post._matchReason}</span>}
                </div>
              )}
              <p className="text-xs font-semibold text-gray-800 line-clamp-2 leading-snug">{post.title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-gray-400">{post.commentCount || 0} comments</span>
                <span className="text-[10px] text-gray-400">· {post.voteScore || 0} pts</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
      <Link to="/community" className="block text-center text-xs text-amber-600 hover:text-amber-700 font-semibold py-2 border-t border-gray-50 hover:bg-amber-50/50 transition">
        Browse Community →
      </Link>
    </div>
  );
}

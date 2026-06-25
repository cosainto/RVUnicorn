/**
 * RigFeedbackSection — open feedback on a rig page.
 * Any logged-in user can leave feedback.
 */
import { useState, useEffect } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const CN = { bg: '#0F1C35', card: '#162236', cardAlt: '#1A2A45', gold: '#E8A838', cream: '#F5F0E8', muted: '#8B9BB4', border: '#243552' };

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function RigFeedbackSection({ pageType, pageId }: { pageType: 'RIG' | 'CAMPGROUND'; pageId: string }) {
  const { user } = useAuth();
  const [feedback, setFeedback] = useState<any[]>([]);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    api.get(`/rigs/feedback/${pageType}/${pageId}`).then(r => setFeedback(r.data || [])).catch(() => {});
  }, [pageType, pageId]);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setSending(true);
    try {
      const { data } = await api.post('/rigs/feedback', { pageType, pageId, content: content.trim() });
      setFeedback(prev => [{ ...data, user: { id: user?.id, firstName: (user as any)?.firstName, profilePicture: (user as any)?.profilePicture } }, ...prev]);
      setContent('');
    } catch {}
    setSending(false);
  };

  return (
    <div className="rounded-2xl p-4" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
      <div className="flex items-center gap-2 mb-3">
        <MessageCircle className="w-4 h-4" style={{ color: CN.gold }} />
        <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: CN.gold }}>Feedback</h4>
        {feedback.length > 0 && <span className="text-[10px]" style={{ color: CN.muted }}>{feedback.length}</span>}
      </div>

      {/* Submit form */}
      {user && (
        <div className="flex gap-2 mb-3">
          <input value={content} onChange={e => setContent(e.target.value)} placeholder="Leave feedback..."
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            className="flex-1 px-3 py-2 rounded-lg text-xs focus:outline-none"
            style={{ background: CN.bg, border: `1px solid ${CN.border}`, color: CN.cream }} />
          <button onClick={handleSubmit} disabled={sending || !content.trim()}
            className="px-3 py-2 rounded-lg transition hover:brightness-110 disabled:opacity-50"
            style={{ background: CN.gold, color: CN.bg }}>
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Feedback list */}
      {feedback.slice(0, expanded ? 20 : 3).map(f => (
        <div key={f.id} className="flex gap-2 py-2" style={{ borderBottom: `1px solid ${CN.border}20` }}>
          {f.user?.profilePicture ? (
            <img src={f.user.profilePicture} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ background: CN.cardAlt, color: CN.gold }}>{f.user?.firstName?.[0] || '?'}</div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold" style={{ color: CN.cream }}>{f.user?.firstName || 'User'}</span>
              <span className="text-[9px]" style={{ color: CN.muted }}>{timeAgo(f.createdAt)}</span>
            </div>
            <p className="text-[11px]" style={{ color: CN.muted }}>{f.content}</p>
          </div>
        </div>
      ))}

      {feedback.length > 3 && !expanded && (
        <button onClick={() => setExpanded(true)} className="text-[10px] font-semibold mt-2" style={{ color: CN.gold }}>
          Show all {feedback.length} →
        </button>
      )}

      {feedback.length === 0 && !user && (
        <p className="text-[10px] italic" style={{ color: CN.muted }}>No feedback yet. Log in to be the first.</p>
      )}
    </div>
  );
}

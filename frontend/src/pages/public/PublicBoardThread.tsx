import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ChevronUp, MessageCircle } from 'lucide-react';
import PublicHeader from '../../components/public/PublicHeader';
import GateBlur from '../../components/public/GateBlur';
import GateModal from '../../components/public/GateModal';
import { useGate } from '../../hooks/useGate';
import api from '../../services/api';

const CN = { bg: '#0F1C35', card: '#162236', cardAlt: '#1A2A45', gold: '#E8A838', cream: '#F5F0E8', muted: '#8B9BB4', border: '#243552' };

export default function PublicBoardThread() {
  const { threadId } = useParams<{ threadId: string }>();
  const [thread, setThread] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { requireAuth, gateModalProps } = useGate();

  useEffect(() => {
    if (!threadId) return;
    api.get(`/public/boards/thread/${threadId}`)
      .then(r => setThread(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [threadId]);

  if (loading) {
    return (
      <div style={{ background: CN.bg, minHeight: '100vh' }}>
        <PublicHeader />
        <div className="max-w-3xl mx-auto px-4 py-12">
          <div className="h-8 w-64 rounded animate-pulse" style={{ background: CN.card }} />
          <div className="h-40 rounded-2xl mt-4 animate-pulse" style={{ background: CN.card }} />
        </div>
      </div>
    );
  }

  if (!thread) {
    return (
      <div style={{ background: CN.bg, minHeight: '100vh' }}>
        <PublicHeader />
        <div className="max-w-3xl mx-auto px-4 py-20 text-center">
          <p className="text-lg font-semibold" style={{ color: CN.cream }}>Thread not found</p>
          <Link to="/" className="inline-block mt-6 px-6 py-3 rounded-xl text-sm font-bold" style={{ background: CN.gold, color: CN.bg }}>
            Explore RVUnicorn
          </Link>
        </div>
      </div>
    );
  }

  const bodyPreview = thread.bodyPreview || thread.body?.slice(0, 300) || '';
  const hasMore = (thread.body?.length || 0) > 300;

  return (
    <>
      <Helmet>
        <title>{thread.title} · {thread.boardName || 'Community'} · RVUnicorn</title>
        <meta name="description" content={bodyPreview.slice(0, 160)} />
        <meta property="og:title" content={`${thread.title} · RVUnicorn Community`} />
        <meta property="og:description" content={bodyPreview.slice(0, 120)} />
        <meta property="og:url" content={`https://www.rvunicorn.com/boards/public/${threadId}`} />
        <link rel="canonical" href={`https://www.rvunicorn.com/boards/public/${threadId}`} />
      </Helmet>

      <div style={{ background: CN.bg, minHeight: '100vh' }}>
        <PublicHeader />

        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          {/* Breadcrumb */}
          {thread.boardName && (
            <p className="text-xs mb-4" style={{ color: CN.muted }}>
              Community · {thread.boardName}
            </p>
          )}

          {/* Title */}
          <h1 className="text-2xl sm:text-3xl font-bold mb-4" style={{ fontFamily: "'Playfair Display', serif", color: CN.cream }}>
            {thread.title}
          </h1>

          {/* Author + meta */}
          <div className="flex items-center gap-4 mb-6">
            <span className="text-sm" style={{ color: CN.muted }}>
              by {thread.authorName || 'Anonymous'}
            </span>
            <span className="text-xs" style={{ color: CN.muted }}>
              {new Date(thread.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>

          {/* Vote + Reply badges */}
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => requireAuth('vote_thread', {}, () => {})}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
              style={{ background: CN.card, border: `1px solid ${CN.border}`, color: CN.muted }}
            >
              <ChevronUp className="w-4 h-4" /> {thread.voteScore || 0}
            </button>
            <span className="flex items-center gap-1 text-xs" style={{ color: CN.muted }}>
              <MessageCircle className="w-4 h-4" /> {thread.replyCount || 0} replies
            </span>
          </div>

          {/* Body preview */}
          <div className="rounded-xl p-5 mb-6" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
            <p className="text-sm leading-relaxed" style={{ color: CN.cream }}>
              {bodyPreview}
            </p>
          </div>

          {/* Gated: Full text + replies */}
          {hasMore && (
            <GateBlur trigger="view_full_trip" context={{}} label="Sign up to read the full thread">
              <div className="rounded-xl p-5 mb-6" style={{ background: CN.card }}>
                <p className="text-sm" style={{ color: CN.cream }}>
                  ...continued discussion with detailed insights, recommendations, and community responses about this topic.
                </p>
              </div>
            </GateBlur>
          )}

          {/* Gated: Replies */}
          <GateBlur trigger="reply" label={`${thread.replyCount || 0} replies — join to read them`}>
            <div className="space-y-3">
              {['This is so helpful, thanks for sharing!', 'Had the same experience — here\'s what I did...', 'Great question, following this thread.'].map((r, i) => (
                <div key={i} className="p-3 rounded-lg" style={{ background: CN.cardAlt }}>
                  <p className="text-sm" style={{ color: CN.cream }}>{r}</p>
                </div>
              ))}
            </div>
          </GateBlur>

          {/* Sticky bottom CTA */}
          <div className="fixed bottom-0 left-0 right-0 p-4 sm:relative sm:mt-8 sm:p-0" style={{ background: CN.bg }}>
            <Link
              to="/register"
              className="block w-full max-w-3xl mx-auto py-3 rounded-xl text-center text-sm font-bold transition hover:brightness-110"
              style={{ background: CN.gold, color: CN.bg }}
            >
              Join the conversation on RVUnicorn
            </Link>
          </div>
        </div>
      </div>

      <GateModal {...gateModalProps} />
    </>
  );
}

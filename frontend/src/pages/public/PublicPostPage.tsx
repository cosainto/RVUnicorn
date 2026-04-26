import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Heart, MessageCircle } from 'lucide-react';
import PublicHeader from '../../components/public/PublicHeader';
import GateBlur from '../../components/public/GateBlur';
import GateModal from '../../components/public/GateModal';
import { useGate } from '../../hooks/useGate';
import api from '../../services/api';

const CN = { bg: '#0F1C35', card: '#162236', cardAlt: '#1A2A45', gold: '#E8A838', cream: '#F5F0E8', muted: '#8B9BB4', border: '#243552' };

export default function PublicPostPage() {
  const { postId } = useParams<{ postId: string }>();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { requireAuth, gateModalProps } = useGate();

  useEffect(() => {
    if (!postId) return;
    api.get(`/public/posts/${postId}`)
      .then(r => setPost(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [postId]);

  if (loading) {
    return (
      <div style={{ background: CN.bg, minHeight: '100vh' }}>
        <PublicHeader />
        <div className="max-w-2xl mx-auto px-4 py-12">
          <div className="h-64 rounded-2xl animate-pulse" style={{ background: CN.card }} />
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div style={{ background: CN.bg, minHeight: '100vh' }}>
        <PublicHeader />
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <p className="text-lg font-semibold" style={{ color: CN.cream }}>Post not found</p>
          <Link to="/" className="inline-block mt-6 px-6 py-3 rounded-xl text-sm font-bold" style={{ background: CN.gold, color: CN.bg }}>
            Explore RVUnicorn
          </Link>
        </div>
      </div>
    );
  }

  const author = post.author || {};

  return (
    <>
      <Helmet>
        <title>{author.firstName || 'RVer'}{post.campgroundName ? ` at ${post.campgroundName}` : ''} · RVUnicorn</title>
        <meta property="og:description" content={post.content?.slice(0, 120) || 'A post on RVUnicorn'} />
        {post.imageUrl && <meta property="og:image" content={post.imageUrl} />}
        <meta property="og:url" content={`https://www.rvunicorn.com/posts/public/${postId}`} />
        <link rel="canonical" href={`https://www.rvunicorn.com/posts/public/${postId}`} />
      </Helmet>

      <div style={{ background: CN.bg, minHeight: '100vh' }}>
        <PublicHeader />

        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
          {/* Photo */}
          {post.imageUrl && (
            <img src={post.imageUrl} alt="" className="w-full rounded-2xl object-cover mb-6" style={{ maxHeight: '500px' }} />
          )}

          {/* Author chip */}
          <Link to={`/u/${author.username}`} className="inline-flex items-center gap-2 mb-4">
            {author.profilePicture ? (
              <img src={author.profilePicture} alt="" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: CN.gold, color: CN.bg }}>
                {author.firstName?.[0]}
              </div>
            )}
            <span className="text-sm font-semibold" style={{ color: CN.cream }}>{author.firstName} {author.lastName}</span>
          </Link>

          {/* Caption */}
          {post.content && (
            <p className="text-sm leading-relaxed mb-4" style={{ color: CN.cream }}>{post.content}</p>
          )}

          {/* Campground tag */}
          {post.campgroundName && (
            <p className="text-xs mb-4" style={{ color: CN.muted }}>📍 {post.campgroundName}</p>
          )}

          {/* Timestamp */}
          <p className="text-xs mb-6" style={{ color: CN.muted }}>
            {new Date(post.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>

          {/* Engagement row */}
          <div className="flex items-center gap-6 pb-6 mb-6" style={{ borderBottom: `1px solid ${CN.border}` }}>
            <button
              onClick={() => requireAuth('like_post', { targetName: author.firstName || '' }, () => {})}
              className="flex items-center gap-1.5 text-sm transition hover:brightness-110"
              style={{ color: CN.muted }}
            >
              <Heart className="w-5 h-5" /> {post.likeCount || 0}
            </button>
            <button
              onClick={() => requireAuth('comment', {}, () => {})}
              className="flex items-center gap-1.5 text-sm transition hover:brightness-110"
              style={{ color: CN.muted }}
            >
              <MessageCircle className="w-5 h-5" /> {post.commentCount || 0}
            </button>
          </div>

          {/* Gated: Comments */}
          <GateBlur trigger="comment" label={`${post.commentCount || 0} comments — join to read them`}>
            <div className="space-y-3">
              {['Great photo! Where exactly was this?', 'We stayed here last summer, loved it!', 'Adding this to our list!'].map((c, i) => (
                <div key={i} className="p-3 rounded-lg" style={{ background: CN.card }}>
                  <p className="text-sm" style={{ color: CN.cream }}>{c}</p>
                </div>
              ))}
            </div>
          </GateBlur>

          {/* Footer CTA */}
          <div className="text-center p-6 rounded-2xl mt-8" style={{ background: CN.cardAlt, border: `1px solid ${CN.border}` }}>
            <p className="text-sm font-bold mb-2" style={{ color: CN.cream }}>Join RVUnicorn to like, comment, and share</p>
            <Link to="/register" className="inline-block px-6 py-3 rounded-xl text-sm font-bold" style={{ background: CN.gold, color: CN.bg }}>
              Create Free Account
            </Link>
          </div>
        </div>
      </div>

      <GateModal {...gateModalProps} />
    </>
  );
}

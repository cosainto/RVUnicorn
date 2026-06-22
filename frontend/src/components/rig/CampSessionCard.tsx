/**
 * CampSessionCard — a living chapter card for a Camp Session.
 * Shows arrival header, inline-expandable activity, inviting composer when active,
 * and a graceful real-only departure recap when past.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp } from 'lucide-react';
import api from '../../services/api';
import RigPostComposer from './RigPostComposer';

const CN = { bg: '#0F1C35', card: '#162236', cardAlt: '#1A2A45', gold: '#E8A838', orange: '#D4621A', cream: '#F5F0E8', muted: '#8B9BB4', border: '#243552' };

interface Session {
  id: string;
  name: string;
  campgroundId: string | null;
  status: string;
  startDate: string;
  endDate?: string | null;
  coverImageUrl?: string | null;
  daysAtCamp: number;
  postCount: number;
  campground?: { id: string; name: string; imageUrl?: string | null; city?: string; state?: string } | null;
}

interface Props {
  session: Session;
  rigId: string;
  slug: string;
  isOwner: boolean;
  ownerAvatar?: string;
  rigName?: string;
}

export default function CampSessionCard({ session, rigId, slug, isOwner }: Props) {
  const [expanded, setExpanded] = useState(session.status === 'ACTIVE');
  const [posts, setPosts] = useState<any[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerFormat, setComposerFormat] = useState<string | null>(null);

  const isActive = session.status === 'ACTIVE';
  const cg = session.campground;
  const dayLabel = isActive ? `Day ${session.daysAtCamp}` : `${session.daysAtCamp} night${session.daysAtCamp !== 1 ? 's' : ''}`;

  useEffect(() => {
    if (expanded && posts.length === 0 && session.postCount > 0) {
      setLoadingPosts(true);
      api.get(`/rigs/${slug}/session/${session.id}/posts`).then(r => setPosts(r.data || [])).catch(() => {}).finally(() => setLoadingPosts(false));
    }
  }, [expanded, slug, session.id, session.postCount]);

  const handlePublished = () => {
    api.get(`/rigs/${slug}/session/${session.id}/posts`).then(r => setPosts(r.data || [])).catch(() => {});
  };

  // Build recap from real attached content
  const photoCount = posts.filter(p => p.photos?.length > 0).length;
  const recipeCount = posts.filter(p => p.postType === 'recipe').length;
  const storyCount = posts.filter(p => ['campfire_story', 'night_sky', 'game_night'].includes(p.postType)).length;
  const recapParts: string[] = [];
  if (session.daysAtCamp > 0) recapParts.push(`${session.daysAtCamp} night${session.daysAtCamp !== 1 ? 's' : ''}`);
  if (photoCount > 0) recapParts.push(`${photoCount} photo${photoCount !== 1 ? 's' : ''}`);
  if (recipeCount > 0) recapParts.push(`${recipeCount} meal${recipeCount !== 1 ? 's' : ''}`);
  if (storyCount > 0) recapParts.push(`${storyCount} moment${storyCount !== 1 ? 's' : ''}`);

  const FORMATS = [
    { id: 'photo', icon: '📸', label: 'Photos' },
    { id: 'recipe', icon: '🍳', label: 'Cooking' },
    { id: 'campfire_story', icon: '🔥', label: 'Campfire' },
    { id: 'video', icon: '🎥', label: 'Video' },
  ];

  return (
    <div className="rounded-2xl shadow-lg overflow-hidden" style={{ background: CN.card, border: isActive ? `1px solid ${CN.gold}40` : `1px solid ${CN.border}` }}>
      {/* Arrival header — campground banner */}
      {cg ? (
        <Link to={`/campgrounds/${cg.id}`} className="block relative transition hover:brightness-110" style={{ height: 140 }}>
          {(session.coverImageUrl || cg.imageUrl) ? (
            <img src={session.coverImageUrl || cg.imageUrl!} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full" style={{ background: `linear-gradient(135deg, #1a4a3a, ${CN.bg}, #1B2E50)` }} />
          )}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)' }} />
          <div className="absolute bottom-3 left-4 right-4">
            <div className="flex items-center gap-2 mb-1">
              {isActive && <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#22c55e' }} />}
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: isActive ? '#22c55e' : CN.gold }}>{isActive ? 'Now Camping' : 'Camp Session'}</span>
            </div>
            <h3 className="text-lg font-bold text-white">{cg.name}</h3>
            <p className="text-xs text-white/60">{[cg.city, cg.state].filter(Boolean).join(', ')} · {dayLabel}</p>
          </div>
        </Link>
      ) : (
        <div className="px-4 py-4">
          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: CN.gold }}>Camp Session</span>
          <h3 className="text-lg font-bold" style={{ color: CN.cream }}>{session.name}</h3>
          <p className="text-xs" style={{ color: CN.muted }}>{dayLabel}</p>
        </div>
      )}

      {/* Active session — invitation composer */}
      {isActive && isOwner && (
        <div className="px-4 pt-3 pb-2">
          <p className="text-xs mb-2" style={{ color: CN.muted }}>What's the story at {cg?.name || session.name}?</p>
          <div className="flex gap-1.5">
            {FORMATS.map(f => (
              <button key={f.id} onClick={() => { setComposerFormat(f.id); setComposerOpen(true); }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition hover:brightness-125"
                style={{ background: CN.cardAlt, border: `1px solid ${CN.border}`, color: CN.gold }}>
                {f.icon} {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Expandable activity */}
      {session.postCount > 0 && (
        <button onClick={() => setExpanded(e => !e)} className="w-full flex items-center justify-between px-4 py-2" style={{ borderTop: `1px solid ${CN.border}`, background: 'none', border: 'none', cursor: 'pointer' }}>
          <span className="text-[10px] font-semibold" style={{ color: CN.muted }}>
            {recapParts.join(' · ') || `${session.postCount} post${session.postCount !== 1 ? 's' : ''}`}
          </span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" style={{ color: CN.muted }} /> : <ChevronDown className="w-3.5 h-3.5" style={{ color: CN.muted }} />}
        </button>
      )}

      {expanded && posts.length > 0 && (
        <div className="px-4 pb-3 space-y-2" style={{ borderTop: `1px solid ${CN.border}` }}>
          {posts.map(p => (
            <div key={p.id} className="flex items-start gap-2 py-2" style={{ borderBottom: `1px solid ${CN.border}20` }}>
              {p.photos?.[0] && <img src={p.photos[0]} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: CN.cream }}>{p.title || p.postType?.replace('_', ' ') || 'Post'}</p>
                {p.body && <p className="text-[10px] truncate" style={{ color: CN.muted }}>{p.body.slice(0, 60)}</p>}
              </div>
              <span className="text-[9px] flex-shrink-0" style={{ color: CN.muted }}>{new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            </div>
          ))}
        </div>
      )}

      {loadingPosts && expanded && <div className="px-4 py-3 text-center text-[10px]" style={{ color: CN.muted }}>Loading...</div>}

      {/* Past session — quiet recap */}
      {!isActive && session.postCount === 0 && (
        <div className="px-4 py-2" style={{ borderTop: `1px solid ${CN.border}` }}>
          <p className="text-[10px] italic" style={{ color: CN.muted }}>A quiet stay · {new Date(session.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
        </div>
      )}

      {/* Composer modal */}
      <RigPostComposer
        rigId={rigId}
        slug={slug}
        isOpen={composerOpen}
        initialFormat={composerFormat}
        activeSessionId={session.id}
        onClose={() => { setComposerOpen(false); setComposerFormat(null); }}
        onPublished={handlePublished}
      />
    </div>
  );
}

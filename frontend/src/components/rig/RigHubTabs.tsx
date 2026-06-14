import { useState, useEffect } from 'react';
import { Camera, Film, Tent, Star, Wrench, Package, Settings, FileText, Trophy, Users, Heart, ThumbsUp, Bookmark, Download, Plus, Loader2, X, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import CampsiteSocialProofInline from './CampsiteSocialProofInline';
import CampgroundFavoriteButton from '../CampgroundFavoriteButton';

const CN = { gold: '#E8A838', cream: '#F5F0E8', muted: '#8B9BB4', card: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.08)' };

function EmptyState({ icon: Icon, message, sub }: { icon: any; message: string; sub?: string }) {
  return <div className="text-center py-12"><Icon className="w-10 h-10 mx-auto text-white/15 mb-3" /><p className="text-sm text-white/40">{message}</p>{sub && <p className="text-xs text-white/25 mt-1">{sub}</p>}</div>;
}

function CardGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>;
}

function Stars({ rating }: { rating: number }) {
  return <div className="flex gap-0.5">{[1,2,3,4,5].map(i => <Star key={i} className={`w-3 h-3 ${i <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-white/15'}`} />)}</div>;
}

// ═══ PHOTOS TAB ═══
export function PhotosTab({ slug, isOwner }: { slug: string; isOwner: boolean }) {
  const [posts, setPosts] = useState<any[]>([]);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.get(`/rigs/${slug}/posts`).then(r => setPosts(r.data || [])).catch(() => {}).finally(() => setLoading(false)); }, [slug]);
  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-amber-400" /></div>;
  const rigPhotos = posts.filter((p: any) => p.isRigPhoto).flatMap((p: any) => p.photos || []);
  const travelPhotos = posts.filter((p: any) => !p.isRigPhoto).flatMap((p: any) => p.photos || []);
  const allPhotos = filter === 'ALL' ? [...rigPhotos, ...travelPhotos] : filter === 'RIG' ? rigPhotos : travelPhotos;
  if (rigPhotos.length === 0 && travelPhotos.length === 0) return <EmptyState icon={Camera} message="No photos yet" />;
  return (
    <div>
      <div className="flex gap-1.5 mb-3">
        {[{ key: 'ALL', label: `All (${rigPhotos.length + travelPhotos.length})` }, { key: 'RIG', label: `🚐 Rig (${rigPhotos.length})` }, { key: 'TRAVEL', label: `🗺️ Travel (${travelPhotos.length})` }].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition ${filter === f.key ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-white/40'}`}>{f.label}</button>
        ))}
      </div>
      <div className="grid grid-cols-3 md:grid-cols-4 gap-1.5">
        {allPhotos.map((url: string, i: number) => (
          <img key={i} src={url} alt="" className="w-full aspect-square object-cover rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// ═══ VIDEOS TAB ═══
export function VideosTab({ slug, isOwner }: { slug: string; isOwner: boolean }) {
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.get(`/rigs/${slug}/videos`).then(r => setVideos(r.data || [])).catch(() => {}).finally(() => setLoading(false)); }, [slug]);
  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-amber-400" /></div>;
  if (videos.length === 0) return <EmptyState icon={Film} message="No videos yet" sub={isOwner ? "Upload your first video" : undefined} />;
  return (
    <div className="grid grid-cols-2 gap-3">
      {videos.map((v: any) => (
        <a key={v.id} href={v.videoUrl} target="_blank" rel="noopener noreferrer" className="rounded-xl overflow-hidden" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
          {v.thumbnailUrl ? <img src={v.thumbnailUrl} className="w-full aspect-video object-cover" /> : <div className="w-full aspect-video bg-white/5 flex items-center justify-center"><Film className="w-8 h-8 text-white/20" /></div>}
          <div className="p-2.5">
            <h4 className="text-xs font-semibold text-white truncate">{v.title}</h4>
            <div className="flex gap-2 mt-1 text-[10px] text-white/30">
              <span className="px-1.5 py-0.5 rounded-full bg-white/10">{v.videoType.replace(/_/g, ' ')}</span>
              <span>{v.views} views</span>
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}

// ═══ CAMPSITES TAB ═══
export function CampsitesTab({ slug, isOwner }: { slug: string; isOwner: boolean }) {
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.get(`/rigs/${slug}/campsites`).then(r => setVisits(r.data || [])).catch(() => {}).finally(() => setLoading(false)); }, [slug]);
  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-amber-400" /></div>;
  const favorites = visits.filter(v => v.isFavorite);
  if (visits.length === 0) return <EmptyState icon={Tent} message="No campsite visits logged" sub={isOwner ? "Log your first campsite visit" : undefined} />;
  return (
    <div>
      <div className="flex gap-4 mb-4 text-[10px] text-white/40 font-semibold">
        <span>📍 {visits.length} Total</span><span>❤️ {favorites.length} Favorites</span>
        <span>🗺️ {new Set(visits.map(v => v.state)).size} States</span>
      </div>
      <CardGrid>
        {visits.map(v => (
          <div key={v.id} className="rounded-xl p-3" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-sm font-semibold text-white">{v.campgroundName || 'Campsite'}</h4>
                <p className="text-[10px] text-white/40">{new Date(v.visitedAt).toLocaleDateString()}{v.siteNumber ? ` · Site ${v.siteNumber}` : ''}</p>
              </div>
              <div className="flex items-center gap-1.5">
                {v.campgroundId && <CampgroundFavoriteButton campgroundId={v.campgroundId} size="sm" />}
                {v.isFavorite && <Heart className="w-4 h-4 text-red-400 fill-red-400" />}
              </div>
            </div>
            {v.rating && <div className="mt-1"><Stars rating={v.rating} /></div>}
            {v.review && <p className="text-xs text-white/50 mt-1 line-clamp-2">{v.review}</p>}
            {v.photoUrls?.length > 0 && <div className="flex gap-1 mt-2">{v.photoUrls.slice(0, 3).map((url: string, i: number) => <img key={i} src={url} className="w-12 h-12 rounded-lg object-cover" />)}</div>}
            {v.campgroundId && <CampsiteSocialProofInline campgroundId={v.campgroundId} />}
          </div>
        ))}
      </CardGrid>
    </div>
  );
}

// ═══ RECOMMENDATIONS TAB ═══
export function RecsTab({ slug, isOwner }: { slug: string; isOwner: boolean }) {
  const [recs, setRecs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.get(`/rigs/${slug}/recommendations`).then(r => setRecs(r.data || [])).catch(() => {}).finally(() => setLoading(false)); }, [slug]);
  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-amber-400" /></div>;
  const TYPE_EMOJI: Record<string, string> = { CAMPGROUND: '🏕️', BOONDOCKING: '🌲', RESTAURANT: '🍽️', ATTRACTION: '🎪', HIKING: '🥾', DUMP_STATION: '🚿', FUEL: '⛽', REPAIR_SHOP: '🔧', RV_PARK: '🅿️', OTHER: '📍' };
  if (recs.length === 0) return <EmptyState icon={Star} message="No recommendations yet" sub={isOwner ? "Share your favorite places" : undefined} />;
  return (
    <CardGrid>
      {recs.map(r => (
        <div key={r.id} className="rounded-xl p-3" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
          <div className="flex items-center gap-2 mb-1">
            <span>{TYPE_EMOJI[r.type] || '📍'}</span>
            <h4 className="text-sm font-semibold text-white flex-1 truncate">{r.name}</h4>
            <span className="text-[9px] text-white/30">{r.saves} saves</span>
          </div>
          {r.rating && <Stars rating={r.rating} />}
          {r.description && <p className="text-xs text-white/50 mt-1 line-clamp-2">{r.description}</p>}
          {r.photoUrls?.length > 0 && <img src={r.photoUrls[0]} className="w-full h-24 object-cover rounded-lg mt-2" />}
        </div>
      ))}
    </CardGrid>
  );
}

// ═══ MODS TAB ═══
export function ModsTab({ slug, isOwner }: { slug: string; isOwner: boolean }) {
  const [mods, setMods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.get(`/rigs/${slug}/mods-hub`).then(r => setMods(r.data || [])).catch(() => {}).finally(() => setLoading(false)); }, [slug]);
  const DIFF_COLORS: Record<string, string> = { EASY: 'bg-green-500/20 text-green-400', MODERATE: 'bg-amber-500/20 text-amber-400', HARD: 'bg-red-500/20 text-red-400', PROFESSIONAL: 'bg-purple-500/20 text-purple-400' };
  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-amber-400" /></div>;
  if (mods.length === 0) return <EmptyState icon={Wrench} message="No mods documented" sub={isOwner ? "Document your first mod" : undefined} />;
  return (
    <div className="space-y-3">
      {mods.map(m => (
        <div key={m.id} className="rounded-xl overflow-hidden" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
          {(m.afterPhotoUrls?.[0] || m.beforePhotoUrls?.[0]) && (
            <div className="flex">
              {m.beforePhotoUrls?.[0] && <img src={m.beforePhotoUrls[0]} className="w-1/2 h-32 object-cover" />}
              {m.afterPhotoUrls?.[0] && <img src={m.afterPhotoUrls[0]} className={`${m.beforePhotoUrls?.[0] ? 'w-1/2' : 'w-full'} h-32 object-cover`} />}
            </div>
          )}
          <div className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-sm font-bold text-white flex-1">{m.title}</h4>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${DIFF_COLORS[m.difficulty] || DIFF_COLORS.MODERATE}`}>{m.difficulty}</span>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/50">{m.category}</span>
            {m.cost && <span className="text-[10px] text-green-400 ml-2">${m.cost.toLocaleString()}</span>}
            <p className="text-xs text-white/50 mt-1.5 line-clamp-3">{m.description}</p>
            <div className="flex gap-3 mt-2 text-[10px] text-white/30">
              <span><ThumbsUp className="w-3 h-3 inline" /> {m.likes}</span>
              <span><Bookmark className="w-3 h-3 inline" /> {m.saves}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══ GEAR TAB ═══
export function GearTab({ slug, isOwner }: { slug: string; isOwner: boolean }) {
  const [gear, setGear] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.get(`/rigs/${slug}/gear`).then(r => setGear(r.data || [])).catch(() => {}).finally(() => setLoading(false)); }, [slug]);
  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-amber-400" /></div>;
  if (gear.length === 0) return <EmptyState icon={Package} message="No gear listed" sub={isOwner ? "Share your favorite gear" : undefined} />;
  return (
    <CardGrid>
      {gear.map(g => (
        <div key={g.id} className="rounded-xl p-3" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
          <div className="flex gap-3">
            {g.photoUrls?.[0] ? <img src={g.photoUrls[0]} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" /> : <div className="w-14 h-14 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0"><Package className="w-6 h-6 text-white/15" /></div>}
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-white truncate">{g.name}</h4>
              {g.brand && <p className="text-[10px] text-white/40">{g.brand}</p>}
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/40">{g.category}</span>
              {g.rating && <div className="mt-0.5"><Stars rating={g.rating} /></div>}
            </div>
          </div>
          {g.review && <p className="text-xs text-white/50 mt-2 line-clamp-2">{g.review}</p>}
          {g.purchaseUrl && <a href={g.purchaseUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-amber-400 mt-1 block">Shop This Item →</a>}
        </div>
      ))}
    </CardGrid>
  );
}

// ═══ MAINTENANCE TAB ═══
export function MaintenanceTab({ slug, isOwner }: { slug: string; isOwner: boolean }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.get(`/rigs/${slug}/maintenance`).then(r => setLogs(r.data || [])).catch(() => {}).finally(() => setLoading(false)); }, [slug]);
  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-amber-400" /></div>;
  if (logs.length === 0) return <EmptyState icon={Settings} message={isOwner ? "No maintenance logged" : "Maintenance logs are private"} sub={isOwner ? "Track your rig's service history" : undefined} />;
  return (
    <div className="space-y-2">
      {logs.map(l => {
        const isOverdue = l.nextServiceDate && new Date(l.nextServiceDate) < new Date();
        return (
          <div key={l.id} className="rounded-xl p-3 flex items-start gap-3" style={{ background: CN.card, border: `1px solid ${isOverdue ? 'rgba(239,68,68,0.3)' : CN.border}` }}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isOverdue ? 'bg-red-500/20' : 'bg-green-500/20'}`}>
              <Settings className={`w-4 h-4 ${isOverdue ? 'text-red-400' : 'text-green-400'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-white">{l.title}</h4>
              <div className="flex gap-2 mt-0.5 text-[10px] text-white/40">
                <span>{l.category}</span>
                <span>{new Date(l.serviceDate).toLocaleDateString()}</span>
                {l.mileageAtService && <span>{Math.round(l.mileageAtService).toLocaleString()} mi</span>}
                {l.cost && <span className="text-green-400">${l.cost.toLocaleString()}</span>}
              </div>
              {l.serviceProvider && <p className="text-[10px] text-white/30 mt-0.5">Provider: {l.serviceProvider}</p>}
              {isOverdue && <p className="text-[10px] text-red-400 font-semibold mt-0.5">⚠️ Service overdue</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══ RESOURCES TAB ═══
export function ResourcesTab({ slug, isOwner }: { slug: string; isOwner: boolean }) {
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.get(`/rigs/${slug}/resources`).then(r => setResources(r.data || [])).catch(() => {}).finally(() => setLoading(false)); }, [slug]);
  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-amber-400" /></div>;
  if (resources.length === 0) return <EmptyState icon={FileText} message="No resources shared" sub={isOwner ? "Upload checklists, guides, and more" : undefined} />;
  return (
    <div className="space-y-2">
      {resources.map(r => (
        <div key={r.id} className="rounded-xl p-3 flex items-center gap-3" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
          <FileText className="w-8 h-8 text-amber-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-white truncate">{r.title}</h4>
            <div className="flex gap-2 text-[10px] text-white/40">
              <span className="px-1.5 py-0.5 rounded-full bg-white/10">{r.type}</span>
              {r.fileSize && <span>{(r.fileSize / 1024).toFixed(0)} KB</span>}
              <span>{r.downloads} downloads</span>
            </div>
          </div>
          <button onClick={async () => { const { data } = await api.post(`/rigs/${slug}/resources/${r.id}/download`); window.open(data.fileUrl); }} className="p-2 bg-amber-500/20 rounded-lg hover:bg-amber-500/30 transition">
            <Download className="w-4 h-4 text-amber-400" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ═══ ACHIEVEMENTS TAB ═══
export function AchievementsTab({ slug, isOwner }: { slug: string; isOwner: boolean }) {
  const [achievements, setAchievements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      if (isOwner) await api.post(`/rigs/${slug}/achievements/check`).catch(() => {});
      const { data } = await api.get(`/rigs/${slug}/achievements`);
      setAchievements(data || []);
      setLoading(false);
    })();
  }, [slug]);
  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-amber-400" /></div>;
  if (achievements.length === 0) return <EmptyState icon={Trophy} message="No achievements earned yet" sub="Keep traveling to unlock badges!" />;
  return (
    <div>
      <p className="text-xs text-amber-400 font-semibold mb-3">🏆 {achievements.length} Achievement{achievements.length !== 1 ? 's' : ''} Earned</p>
      <div className="grid grid-cols-2 gap-3">
        {achievements.map(a => (
          <div key={a.id} className="rounded-xl p-4 text-center" style={{ background: 'rgba(232,168,56,0.1)', border: '1px solid rgba(232,168,56,0.2)' }}>
            <span className="text-3xl block mb-1">🏆</span>
            <h4 className="text-sm font-bold text-amber-400">{a.title}</h4>
            <p className="text-[10px] text-white/40 mt-0.5">{a.description}</p>
            <p className="text-[9px] text-white/20 mt-1">{new Date(a.earnedAt).toLocaleDateString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══ COMMUNITY TAB ═══
export function CommunityHubTab({ slug, isOwner, rigName }: { slug: string; isOwner: boolean; rigName: string }) {
  const { user } = useAuth();
  const [contributions, setContributions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newContent, setNewContent] = useState('');
  useEffect(() => { api.get(`/rigs/${slug}/contributions`).then(r => setContributions(r.data || [])).catch(() => {}).finally(() => setLoading(false)); }, [slug]);
  const submit = async () => {
    if (!newContent.trim()) return;
    try { await api.post(`/rigs/${slug}/contributions`, { type: 'MEMORY', content: newContent }); setNewContent(''); const { data } = await api.get(`/rigs/${slug}/contributions`); setContributions(data); } catch {}
  };
  const approve = async (id: string) => {
    try { await api.post(`/rigs/${slug}/contributions/${id}/approve`); const { data } = await api.get(`/rigs/${slug}/contributions`); setContributions(data); } catch {}
  };
  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-amber-400" /></div>;
  return (
    <div className="space-y-4">
      {user && (
        <div className="rounded-xl p-3" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
          <p className="text-xs font-semibold text-amber-400 mb-2">Share a memory with {rigName}</p>
          <textarea value={newContent} onChange={e => setNewContent(e.target.value)} placeholder="We ran into this rig at..." className="w-full text-sm bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/30 resize-none" rows={2} />
          <button onClick={submit} disabled={!newContent.trim()} className="mt-2 px-4 py-1.5 bg-amber-500 text-gray-900 rounded-lg text-xs font-semibold disabled:opacity-50">Share</button>
        </div>
      )}
      {contributions.length === 0 ? (
        <EmptyState icon={Users} message="No community contributions yet" />
      ) : (
        contributions.map(c => (
          <div key={c.id} className="rounded-xl p-3" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
            <div className="flex items-center gap-2 mb-1">
              {c.contributor?.profilePicture ? <img src={c.contributor.profilePicture} className="w-5 h-5 rounded-full" /> : null}
              <Link to={`/profile/${c.contributor?.username}`} className="text-xs font-semibold text-amber-400 hover:underline">{c.contributor?.firstName} {c.contributor?.lastName}</Link>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/30">{c.type}</span>
              {!c.isApproved && <span className="text-[9px] text-amber-400">Pending</span>}
            </div>
            {c.content && <p className="text-sm text-white/70">{c.content}</p>}
            {isOwner && !c.isApproved && (
              <button onClick={() => approve(c.id)} className="mt-2 text-[10px] text-green-400 font-semibold flex items-center gap-1"><Check className="w-3 h-3" />Approve</button>
            )}
          </div>
        ))
      )}
    </div>
  );
}

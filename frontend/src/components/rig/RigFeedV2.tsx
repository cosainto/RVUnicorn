import { useState, useEffect, useRef } from 'react';
import { MapPin, Route, BarChart3, Users, ChevronDown, ChevronRight, Star, Fuel, Clock, Camera, Film, BookOpen, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

const ROAD_TYPE_LABELS: Record<string, { emoji: string; label: string; color: string }> = {
  HIGHWAY: { emoji: '🛣️', label: 'Highway', color: 'bg-blue-500/20 text-blue-400' },
  SCENIC: { emoji: '🏔️', label: 'Scenic', color: 'bg-green-500/20 text-green-400' },
  OFFGRID: { emoji: '🌲', label: 'Off-grid', color: 'bg-amber-500/20 text-amber-400' },
  MIXED: { emoji: '🚐', label: 'Mixed', color: 'bg-gray-500/20 text-gray-400' },
};

interface Props { slug: string; isOwner: boolean; }

function StopCard({ stop, expanded, onToggle }: { stop: any; expanded: boolean; onToggle: () => void }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <button onClick={onToggle} className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-white/5 transition">
        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: stop.departedAt ? 'rgba(232,168,56,0.15)' : 'rgba(76,175,130,0.2)', border: stop.departedAt ? '2px solid rgba(232,168,56,0.3)' : '2px solid rgba(76,175,130,0.4)' }}>
          <MapPin className="w-4 h-4" style={{ color: stop.departedAt ? '#E8A838' : '#4CAF82' }} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-sm text-white">{stop.name}</h4>
          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-white/40">
            <span>Arrived {new Date(stop.arrivedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            {stop.milesFromLastStop && <span>· {Math.round(stop.milesFromLastStop)} mi since last</span>}
            {stop.contributorIds?.length > 0 && <span>· {stop.contributorIds.length} contributor{stop.contributorIds.length > 1 ? 's' : ''}</span>}
          </div>
          <div className="flex items-center gap-3 mt-1 text-[10px] text-white/30">
            {stop.photoUrls?.length > 0 && <span className="flex items-center gap-0.5"><Camera className="w-3 h-3" />{stop.photoUrls.length}</span>}
            {stop.videoUrls?.length > 0 && <span className="flex items-center gap-0.5"><Film className="w-3 h-3" />{stop.videoUrls.length}</span>}
            {stop.noteCount > 0 && <span className="flex items-center gap-0.5"><BookOpen className="w-3 h-3" />{stop.noteCount}</span>}
          </div>
        </div>
        {expanded ? <ChevronDown className="w-4 h-4 text-white/30 mt-1" /> : <ChevronRight className="w-4 h-4 text-white/30 mt-1" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-white/5 pt-3">
          {/* Featured moment */}
          {stop.photoUrls?.[0] && (
            <img src={stop.photoUrls[0]} alt="" className="w-full h-48 object-cover rounded-xl mb-3" />
          )}
          {/* Photo grid */}
          {stop.photoUrls?.length > 1 && (
            <div className="grid grid-cols-3 gap-1.5 mb-3">
              {stop.photoUrls.slice(1, 7).map((url: string, i: number) => (
                <img key={i} src={url} alt="" className="w-full aspect-square object-cover rounded-lg" />
              ))}
              {stop.photoUrls.length > 7 && (
                <div className="w-full aspect-square rounded-lg bg-white/10 flex items-center justify-center text-xs text-white/50">+{stop.photoUrls.length - 7}</div>
              )}
            </div>
          )}
          {/* Bundles */}
          {stop.bundles?.length > 0 && (
            <div className="space-y-2">
              {stop.bundles.map((b: any) => (
                <div key={b.id} className="bg-white/5 rounded-lg p-2.5">
                  {b.title && <h5 className="text-xs font-semibold text-amber-400 mb-1">{b.title}</h5>}
                  <div className="flex gap-1.5 overflow-x-auto">
                    {b.photoUrls?.slice(0, 4).map((url: string, i: number) => (
                      <img key={i} src={url} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                    ))}
                  </div>
                  {b.stories?.length > 0 && <p className="text-[10px] text-white/40 mt-1.5 line-clamp-2 italic">{b.stories[0]}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RouteCard({ route }: { route: any }) {
  const road = ROAD_TYPE_LABELS[route.roadType] || ROAD_TYPE_LABELS.MIXED;
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.08)' }}>
      <Route className="w-4 h-4 text-white/20 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white/60"><span className="font-semibold text-white/80">{route.fromLabel}</span> → <span className="font-semibold text-white/80">{route.toLabel}</span></p>
        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-white/30">
          <span>{Math.round(route.distanceMiles)} mi</span>
          {route.durationMinutes && <span>· {Math.floor(route.durationMinutes / 60)}h {route.durationMinutes % 60}m</span>}
          <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${road.color}`}>{road.emoji} {road.label}</span>
          {route.fuelStops > 0 && <span className="flex items-center gap-0.5"><Fuel className="w-2.5 h-2.5" />{route.fuelStops}</span>}
        </div>
        {route.highlight && <p className="text-[10px] text-amber-400/60 mt-0.5 italic">{route.highlight}</p>}
      </div>
    </div>
  );
}

function InsightCard({ card }: { card: any }) {
  const content = card.content || {};
  return (
    <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(232,168,56,0.08)', border: '1px solid rgba(232,168,56,0.15)' }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">{card.cardType === 'STATS' ? 'Trip Stats' : card.cardType === 'MILEAGE' ? 'Milestone' : 'Insight'}</span>
      </div>
      {content.totalMiles && <p className="text-xs text-white/60">🚐 {content.totalMiles.toLocaleString()} miles this trip</p>}
      {content.longestDrive && <p className="text-xs text-white/60">🛣️ Longest day: {content.longestDrive}</p>}
      {content.longestStay && <p className="text-xs text-white/60">📍 Most time: {content.longestStay}</p>}
      {content.message && <p className="text-xs text-white/60">{content.message}</p>}
      {content.miles && <p className="text-sm font-bold text-amber-400">🎉 {content.miles.toLocaleString()} miles!</p>}
    </div>
  );
}

export default function RigFeedV2({ slug, isOwner }: Props) {
  const [feed, setFeed] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedStop, setExpandedStop] = useState<string | null>(null);
  const [showOlder, setShowOlder] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => { load(); }, [slug]);

  const load = async () => {
    try {
      const { data } = await api.get(`/rigs/${slug}/feed/v2`);
      setFeed(data);
      // Auto-expand current stop
      if (data.currentStop) setExpandedStop(data.currentStop.id);
    } catch {}
    setLoading(false);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-amber-400" /></div>;
  if (!feed) return <p className="text-center text-white/40 py-12">No journey data yet</p>;

  const recentItems = feed.feedItems?.slice(0, showOlder ? undefined : 10) || [];
  const hasOlder = (feed.feedItems?.length || 0) > 10;

  return (
    <div className="space-y-3">
      {/* Journey Strip */}
      {feed.journeyStrip?.length > 0 && (
        <div ref={stripRef} className="flex items-center gap-1 overflow-x-auto pb-2 scrollbar-hide">
          {feed.journeyStrip.map((node: any, i: number) => (
            <div key={node.id} className="flex items-center gap-1 flex-shrink-0">
              <button onClick={() => setExpandedStop(expandedStop === node.id ? null : node.id)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap transition ${
                  node.status === 'CURRENT' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/10'
                }`}>
                {node.status === 'CURRENT' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 mr-1 animate-pulse" />}
                {node.name.split(' ').slice(0, 2).join(' ')}
              </button>
              {i < feed.journeyStrip.length - 1 && <span className="text-white/15 text-[10px]">→</span>}
            </div>
          ))}
        </div>
      )}

      {/* Stats row */}
      {feed.stats && (
        <div className="flex items-center gap-4 text-[10px] text-white/40 font-semibold uppercase tracking-wider">
          <span>🛣️ {feed.stats.totalMiles.toLocaleString()} mi</span>
          <span>📅 {feed.stats.daysOnRoad} days</span>
          <span>🗺️ {feed.stats.statesCount} states</span>
          <span>👥 {feed.stats.followersCount} followers</span>
        </div>
      )}

      {/* Feed items */}
      {recentItems.map((item: any, i: number) => {
        if (item.type === 'STOP') return <StopCard key={item.data.id} stop={item.data} expanded={expandedStop === item.data.id} onToggle={() => setExpandedStop(expandedStop === item.data.id ? null : item.data.id)} />;
        if (item.type === 'ROUTE') return <RouteCard key={item.data.id} route={item.data} />;
        if (item.type === 'INSIGHT') return <InsightCard key={item.data.id} card={item.data} />;
        return null;
      })}

      {/* Older content toggle */}
      {hasOlder && !showOlder && (
        <button onClick={() => setShowOlder(true)} className="w-full py-2 text-center text-xs text-white/30 hover:text-white/50 transition">
          Earlier in this trip ({feed.feedItems.length - 10} more) ↓
        </button>
      )}

      {feed.feedItems?.length === 0 && (
        <div className="text-center py-12">
          <MapPin className="w-10 h-10 mx-auto text-white/15 mb-3" />
          <p className="text-sm text-white/40">No stops logged yet</p>
          {isOwner && <p className="text-xs text-white/25 mt-1">Add your first stop to start building your journey</p>}
        </div>
      )}
    </div>
  );
}

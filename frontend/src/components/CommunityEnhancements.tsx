import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, ChevronDown, ChevronUp, Users, Filter } from 'lucide-react';
import api from '../services/api';

const CATEGORIES = ['All', 'Solar', 'Kitchen', 'Tech', 'Safety', 'Comfort', 'Towing', 'Storage', 'Electrical', 'Other'];

const CATEGORY_COLORS: Record<string, string> = {
  Solar: 'bg-yellow-100 text-yellow-700',
  Kitchen: 'bg-orange-100 text-orange-700',
  Tech: 'bg-blue-100 text-blue-700',
  Safety: 'bg-red-100 text-red-700',
  Comfort: 'bg-purple-100 text-purple-700',
  Towing: 'bg-gray-100 text-gray-700',
  Storage: 'bg-green-100 text-green-700',
  Electrical: 'bg-cyan-100 text-cyan-700',
  Other: 'bg-gray-100 text-gray-500',
};

function isEmbeddable(url: string) {
  return url.includes('youtube.com') || url.includes('youtu.be') || url.includes('vimeo.com');
}

function getEmbedUrl(url: string) {
  if (url.includes('youtu.be/')) {
    const id = url.split('youtu.be/')[1]?.split('?')[0];
    return 'https://www.youtube.com/embed/' + id;
  }
  if (url.includes('youtube.com/watch')) {
    try { const id = new URL(url).searchParams.get('v'); return 'https://www.youtube.com/embed/' + id; }
    catch { return url; }
  }
  if (url.includes('vimeo.com/')) {
    const id = url.split('vimeo.com/')[1]?.split('?')[0];
    return 'https://player.vimeo.com/video/' + id;
  }
  return url;
}

interface RvUser {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  profilePicture?: string;
  rvMake?: string;
  rvModel?: string;
  rvYear?: number;
  rvType?: string;
  rvLength?: number;
  rvFeatures?: string[];
}

interface Enhancement {
  id: string;
  title: string;
  description?: string;
  category?: string;
  purchaseUrl?: string;
  cost?: number;
  imageUrl?: string;
  videoUrl?: string;
  createdAt: string;
  user: RvUser;
}

interface Props {
  rvMake?: string;
  rvModel?: string;
}

export default function CommunityEnhancements({ rvMake, rvModel }: Props) {
  const [enhancements, setEnhancements] = useState<Enhancement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (rvMake || rvModel) {
      fetchEnhancements();
    } else {
      setLoading(false);
    }
  }, [rvMake, rvModel]);

  const fetchEnhancements = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (rvMake) params.append('make', rvMake);
      if (rvModel) params.append('model', rvModel);
      const { data } = await api.get('/rv-enhancements/community?' + params.toString());
      setEnhancements(data);
    } catch (err) {
      console.error('Failed to fetch community enhancements:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = selectedCategory === 'All'
    ? enhancements
    : enhancements.filter(e => e.category === selectedCategory);

  const displayName = (u: RvUser) =>
    u.firstName ? (u.firstName + ' ' + (u.lastName || '')).trim() : u.username;

  if (!rvMake && !rvModel) return null;

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-1">
          <Users className="w-5 h-5 text-blue-600" />
          <h2 className="text-xl font-bold text-gray-900">
            {rvMake} {rvModel} Community Enhancements
          </h2>
        </div>
        <p className="text-sm text-gray-500">
          See what other {rvMake} {rvModel} owners have added to their rigs
        </p>
      </div>

      <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-2 overflow-x-auto">
        <Filter className="w-4 h-4 text-gray-400 shrink-0" />
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={"shrink-0 text-xs font-medium px-3 py-1.5 rounded-full transition " + (
              selectedCategory === cat
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="divide-y divide-gray-50">
        {loading ? (
          <div className="py-12 text-center text-sm text-gray-400">Loading community enhancements...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-3xl mb-2">🔧</p>
            <p className="text-sm font-medium text-gray-500">No community enhancements yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Be the first {rvMake} {rvModel} owner to share your mods!
            </p>
          </div>
        ) : (
          filtered.map(e => {
            const isExpanded = expandedId === e.id;
            const isUserExpanded = expandedUserId === e.user.id;
            const hasMedia = !!(e.imageUrl || e.videoUrl);

            return (
              <div key={e.id} className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Link to={"/profile/" + e.user.username}>
                    {e.user.profilePicture ? (
                      <img src={e.user.profilePicture} alt={displayName(e.user)} className="w-9 h-9 rounded-full object-cover border border-gray-200" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white text-sm font-bold">
                        {displayName(e.user).charAt(0).toUpperCase()}
                      </div>
                    )}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to={"/profile/" + e.user.username} className="text-sm font-semibold text-gray-900 hover:text-blue-600">
                      {displayName(e.user)}
                    </Link>
                    <p className="text-xs text-gray-400">
                      {[e.user.rvYear, e.user.rvMake, e.user.rvModel].filter(Boolean).join(' ')}
                    </p>
                  </div>
                  <button
                    onClick={() => setExpandedUserId(isUserExpanded ? null : e.user.id)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 shrink-0"
                  >
                    Their RV {isUserExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>

                {isUserExpanded && (
                  <div className="mb-3 bg-blue-50 rounded-lg p-3 border border-blue-100">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold text-blue-800">
                        {[e.user.rvYear, e.user.rvMake, e.user.rvModel].filter(Boolean).join(' ')}
                        {e.user.rvLength ? ' · ' + e.user.rvLength + 'ft' : ''}
                      </p>
                      <Link to={"/profile/" + e.user.username} className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                        Full profile <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                    {e.user.rvFeatures && e.user.rvFeatures.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {e.user.rvFeatures.map((f: string) => (
                          <span key={f} className="text-[10px] px-2 py-0.5 bg-white text-blue-700 rounded-full border border-blue-200">{f}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-start gap-3">
                  {e.imageUrl && (
                    <img
                      src={e.imageUrl}
                      alt={e.title}
                      className="w-20 h-20 object-cover rounded-lg border border-gray-100 shrink-0 cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : e.id)}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-gray-900">{e.title}</span>
                      {e.category && (
                        <span className={"text-[10px] font-semibold px-2 py-0.5 rounded-full " + (CATEGORY_COLORS[e.category] ?? CATEGORY_COLORS.Other)}>
                          {e.category}
                        </span>
                      )}
                    </div>
                    {e.cost != null && <p className="text-xs text-gray-400 mt-0.5">${e.cost.toLocaleString()} spent</p>}
                    {e.description && <p className="text-xs text-gray-600 mt-1 leading-relaxed line-clamp-2">{e.description}</p>}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {e.purchaseUrl && (
                        <a href={e.purchaseUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
                          <ExternalLink className="w-3 h-3" /> Where they bought it
                        </a>
                      )}
                      {hasMedia && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : e.id)}
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 font-medium"
                        >
                          {isExpanded
                            ? <><ChevronUp className="w-3 h-3" /> Hide media</>
                            : <><ChevronDown className="w-3 h-3" /> {e.videoUrl ? 'Watch install video' : 'View photos'}</>
                          }
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-3 space-y-3">
                    {e.imageUrl && <img src={e.imageUrl} alt={e.title} className="w-full max-h-72 object-cover rounded-lg border border-gray-100" />}
                    {e.videoUrl && (
                      isEmbeddable(e.videoUrl) ? (
                        <div className="aspect-video rounded-lg overflow-hidden border border-gray-100">
                          <iframe src={getEmbedUrl(e.videoUrl)} className="w-full h-full" allowFullScreen
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
                        </div>
                      ) : (
                        <video src={e.videoUrl} controls className="w-full rounded-lg border border-gray-100 max-h-72" />
                      )
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {filtered.length > 0 && (
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">{filtered.length} enhancement{filtered.length !== 1 ? 's' : ''} from the community</p>
        </div>
      )}
    </div>
  );
}

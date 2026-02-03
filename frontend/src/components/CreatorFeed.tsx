import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Video,
  Play,
  Heart,
  MessageCircle,
  Bookmark,
  Eye,
  BadgeCheck,
  Tent,
  ChevronRight,
  UserPlus,
  Loader2,
  Sparkles,
  Compass,
} from 'lucide-react';
import api from '../services/api';

interface Creator {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  profilePicture?: string;
  creatorVerified?: boolean;
  creatorSpecialties?: string[];
}

interface CreatorContentItem {
  id: string;
  contentType: string;
  title?: string;
  description?: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  embedUrl?: string;
  embedPlatform?: string;
  category?: string;
  viewCount: number;
  likeCount: number;
  publishedAt?: string;
  creator: Creator;
  campground?: {
    id: string;
    name: string;
    state?: string;
  };
  _count?: {
    likes: number;
    comments: number;
    saves: number;
  };
  isLiked?: boolean;
  isSaved?: boolean;
  isDiscovery?: boolean;
}

interface CreatorFeedProps {
  limit?: number;
  showHeader?: boolean;
  contentType?: 'VIDEO' | 'SHORT' | 'ALL';
}

export default function CreatorFeed({ 
  limit = 6, 
  showHeader = true,
  contentType = 'ALL'
}: CreatorFeedProps) {
  const [content, setContent] = useState<CreatorContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'following' | 'trending'>('following');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    loadContent();
  }, []);

  const loadContent = async (loadMore = false) => {
    try {
      if (!loadMore) setLoading(true);
      const currentPage = loadMore ? page + 1 : 1;
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
      });
      
      if (contentType !== 'ALL') {
        params.append('type', contentType);
      }

      const { data } = await api.get(`/basecamp/creator-feed?${params}`);
      
      let mainContent: CreatorContentItem[] = data.content || [];
      
      // On first load, mix in 1-2 discovery items from unfollowed creators
      if (!loadMore && mainContent.length > 0) {
        try {
          const discoveryRes = await api.get('/creators/discovery/content?limit=2');
          const discoveryItems: CreatorContentItem[] = (discoveryRes.data || []).map((item: any) => ({
            ...item,
            isDiscovery: true,
          }));
          
          // Filter out any duplicates
          const mainIds = new Set(mainContent.map(c => c.id));
          const uniqueDiscovery = discoveryItems.filter(d => !mainIds.has(d.id));
          
          // Insert discovery items at positions 2 and 5 (or wherever they fit)
          if (uniqueDiscovery.length > 0 && mainContent.length >= 2) {
            mainContent = [...mainContent];
            // Insert first discovery item after position 2
            mainContent.splice(2, 0, uniqueDiscovery[0]);
            // Insert second discovery item after position 5 if available
            if (uniqueDiscovery.length > 1 && mainContent.length >= 5) {
              mainContent.splice(5, 0, uniqueDiscovery[1]);
            }
          } else if (uniqueDiscovery.length > 0) {
            mainContent = [...mainContent, ...uniqueDiscovery];
          }
        } catch {
          // Discovery fetch failed, just show main content
        }
      }
      
      if (loadMore) {
        setContent(prev => [...prev, ...mainContent]);
      } else {
        setContent(mainContent);
      }
      
      setSource(data.source);
      setHasMore(data.hasMore);
      setPage(currentPage);
    } catch (error) {
      console.error('Error loading creator feed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (contentId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      const { data } = await api.post(`/creators/content/${contentId}/like`);
      setContent(prev => prev.map(item => 
        item.id === contentId 
          ? { 
              ...item, 
              isLiked: data.isLiked,
              likeCount: data.isLiked ? item.likeCount + 1 : item.likeCount - 1,
            }
          : item
      ));
    } catch (error) {
      console.error('Error liking content:', error);
    }
  };

  const handleSave = async (contentId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      const { data } = await api.post(`/creators/content/${contentId}/save`);
      setContent(prev => prev.map(item => 
        item.id === contentId 
          ? { ...item, isSaved: data.isSaved }
          : item
      ));
    } catch (error) {
      console.error('Error saving content:', error);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      </div>
    );
  }

  if (content.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        {showHeader && (
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <Video className="w-5 h-5 text-purple-500" />
              Creator Videos
            </h3>
          </div>
        )}
        <div className="text-center py-8">
          <Video className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p className="text-gray-500 mb-2">No creator content yet</p>
          <p className="text-sm text-gray-400">Follow some creators to see their videos here!</p>
          <Link
            to="/creators"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition"
          >
            <UserPlus className="w-4 h-4" />
            Discover Creators
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {showHeader && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <Video className="w-5 h-5 text-purple-500" />
            {source === 'following' ? 'From Creators You Follow' : 'Trending Videos'}
          </h3>
          <Link 
            to="/creators" 
            className="text-purple-600 hover:text-purple-700 text-sm font-medium flex items-center gap-1"
          >
            Discover More
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {content.map((item) => (
          <Link
            key={item.id}
            to={`/creators/${item.creator.username}/content/${item.id}`}
            className={`group bg-gray-50 rounded-xl overflow-hidden hover:shadow-lg transition-all ${
              item.isDiscovery ? 'ring-1 ring-purple-200' : ''
            }`}
          >
            <div className="relative aspect-video bg-gray-200">
              {item.thumbnailUrl ? (
                <img
                  src={item.thumbnailUrl.startsWith('http') ? item.thumbnailUrl : `${item.thumbnailUrl}`}
                  alt={item.title || 'Video'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-400 to-pink-400">
                  <Video className="w-12 h-12 text-white/80" />
                </div>
              )}
              
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center">
                  <Play className="w-6 h-6 text-purple-600 ml-1" fill="currentColor" />
                </div>
              </div>

              {/* Discovery Badge */}
              {item.isDiscovery && (
                <span className="absolute top-2 left-2 px-2 py-0.5 bg-purple-600 text-white text-xs font-medium rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Suggested for you
                </span>
              )}

              {item.contentType === 'SHORT' && (
                <span className="absolute top-2 right-2 px-2 py-0.5 bg-red-500 text-white text-xs font-semibold rounded">
                  SHORT
                </span>
              )}

              <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/70 text-white text-xs rounded flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {formatNumber(item.viewCount)}
              </div>
            </div>

            <div className="p-3">
              <h4 className="font-medium text-gray-900 line-clamp-2 group-hover:text-purple-600 transition-colors">
                {item.title || 'Untitled'}
              </h4>

              <div className="flex items-center gap-2 mt-2">
                {item.creator.profilePicture ? (
                  <img
                    src={item.creator.profilePicture.startsWith('http') ? item.creator.profilePicture : `${item.creator.profilePicture}`}
                    alt={item.creator.username}
                    className="w-6 h-6 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-xs font-bold">
                    {(item.creator.firstName?.[0] || item.creator.username[0]).toUpperCase()}
                  </div>
                )}
                <span className="text-sm text-gray-600 flex items-center gap-1">
                  {item.creator.firstName || item.creator.username}
                  {item.creator.creatorVerified && (
                    <BadgeCheck className="w-3.5 h-3.5 text-blue-500" />
                  )}
                </span>
                {/* Discovery hint on creator name */}
                {item.isDiscovery && (
                  <span className="ml-auto text-[10px] text-purple-500 font-medium flex items-center gap-0.5">
                    <Compass className="w-3 h-3" />
                    New
                  </span>
                )}
              </div>

              {item.campground && (
                <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                  <Tent className="w-3 h-3" />
                  <span className="truncate">{item.campground.name}</span>
                </div>
              )}

              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
                <button
                  onClick={(e) => handleLike(item.id, e)}
                  className={`flex items-center gap-1 text-sm transition-colors ${
                    item.isLiked ? 'text-red-500' : 'text-gray-500 hover:text-red-500'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${item.isLiked ? 'fill-current' : ''}`} />
                  {formatNumber(item.likeCount || item._count?.likes || 0)}
                </button>
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <MessageCircle className="w-4 h-4" />
                  {formatNumber(item._count?.comments || 0)}
                </div>
                <button
                  onClick={(e) => handleSave(item.id, e)}
                  className={`ml-auto flex items-center gap-1 text-sm transition-colors ${
                    item.isSaved ? 'text-purple-500' : 'text-gray-500 hover:text-purple-500'
                  }`}
                >
                  <Bookmark className={`w-4 h-4 ${item.isSaved ? 'fill-current' : ''}`} />
                </button>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {hasMore && (
        <div className="text-center mt-6">
          <button
            onClick={() => loadContent(true)}
            className="px-6 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition font-medium"
          >
            Load More Videos
          </button>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from 'react';
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
  ChevronLeft,
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

const AUTO_SCROLL_INTERVAL = 4500;
const IDLE_RESUME_DELAY = 6000;

export default function CreatorFeed({
  limit = 12,
  showHeader = true,
  contentType = 'ALL',
}: CreatorFeedProps) {
  const [content, setContent] = useState<CreatorContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'following' | 'trending'>('following');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const cardWidthRef = useRef(0);

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

      if (!loadMore && mainContent.length > 0) {
        try {
          const discoveryRes = await api.get('/creators/discovery/content?limit=2');
          const discoveryItems: CreatorContentItem[] = (discoveryRes.data || []).map(
            (item: any) => ({ ...item, isDiscovery: true })
          );

          const mainIds = new Set(mainContent.map((c) => c.id));
          const uniqueDiscovery = discoveryItems.filter((d) => !mainIds.has(d.id));

          if (uniqueDiscovery.length > 0 && mainContent.length >= 2) {
            mainContent = [...mainContent];
            mainContent.splice(2, 0, uniqueDiscovery[0]);
            if (uniqueDiscovery.length > 1 && mainContent.length >= 5) {
              mainContent.splice(5, 0, uniqueDiscovery[1]);
            }
          } else if (uniqueDiscovery.length > 0) {
            mainContent = [...mainContent, ...uniqueDiscovery];
          }
        } catch {
          // Discovery fetch failed
        }
      }

      if (loadMore) {
        setContent((prev) => [...prev, ...mainContent]);
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
      setContent((prev) =>
        prev.map((item) =>
          item.id === contentId
            ? {
                ...item,
                isLiked: data.isLiked,
                likeCount: data.isLiked ? item.likeCount + 1 : item.likeCount - 1,
              }
            : item
        )
      );
    } catch (error) {
      console.error('Error liking content:', error);
    }
  };

  const handleSave = async (contentId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const { data } = await api.post(`/creators/content/${contentId}/save`);
      setContent((prev) =>
        prev.map((item) =>
          item.id === contentId ? { ...item, isSaved: data.isSaved } : item
        )
      );
    } catch (error) {
      console.error('Error saving content:', error);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);

    const cards = el.querySelectorAll<HTMLElement>('[data-card]');
    if (cards.length === 0) return;
    const gap = 16;
    const first = cards[0];
    const w = first.offsetWidth + gap;
    cardWidthRef.current = w;
    const idx = Math.round(el.scrollLeft / w);
    setActiveIndex(Math.min(idx, cards.length - 1));
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [content, updateScrollState]);

  const scrollBy = useCallback(
    (direction: 'left' | 'right') => {
      const el = scrollRef.current;
      if (!el) return;
      const amount = cardWidthRef.current || el.clientWidth * 0.8;
      el.scrollBy({
        left: direction === 'right' ? amount : -amount,
        behavior: 'smooth',
      });
      pauseAutoScroll();
    },
    []
  );

  const startAutoScroll = useCallback(() => {
    stopAutoScroll();
    autoScrollTimer.current = setInterval(() => {
      const el = scrollRef.current;
      if (!el) return;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
      if (atEnd) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        const amount = cardWidthRef.current || el.clientWidth * 0.8;
        el.scrollBy({ left: amount, behavior: 'smooth' });
      }
    }, AUTO_SCROLL_INTERVAL);
  }, []);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollTimer.current) {
      clearInterval(autoScrollTimer.current);
      autoScrollTimer.current = null;
    }
  }, []);

  const pauseAutoScroll = useCallback(() => {
    stopAutoScroll();
    setIsPaused(true);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      setIsPaused(false);
      startAutoScroll();
    }, IDLE_RESUME_DELAY);
  }, [startAutoScroll, stopAutoScroll]);

  useEffect(() => {
    if (content.length > 0) {
      startAutoScroll();
    }
    return () => {
      stopAutoScroll();
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [content.length, startAutoScroll, stopAutoScroll]);

  const handleInteraction = useCallback(() => {
    pauseAutoScroll();
  }, [pauseAutoScroll]);

  const scrollToIndex = useCallback(
    (idx: number) => {
      const el = scrollRef.current;
      if (!el) return;
      const cards = el.querySelectorAll<HTMLElement>('[data-card]');
      if (!cards[idx]) return;
      cards[idx].scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
      pauseAutoScroll();
    },
    [pauseAutoScroll]
  );

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

  const dotsCount = Math.min(content.length, 12);

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
      {showHeader && (
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
            <Video className="w-5 h-5 text-purple-500" />
            {source === 'following' ? 'From Creators You Follow' : 'Trending Videos'}
          </h3>
          <Link
            to="/creators"
            className="text-purple-600 hover:text-purple-700 text-xs sm:text-sm font-medium flex items-center gap-1"
          >
            See All
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      <div
        className="relative group/carousel"
        onMouseEnter={handleInteraction}
        onTouchStart={handleInteraction}
      >
        {canScrollLeft && (
          <button
            onClick={() => scrollBy('left')}
            className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 -ml-3 w-9 h-9 rounded-full bg-white shadow-lg border border-gray-200 items-center justify-center text-gray-600 hover:text-purple-600 hover:border-purple-300 transition opacity-0 group-hover/carousel:opacity-100"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        {canScrollRight && (
          <button
            onClick={() => scrollBy('right')}
            className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 -mr-3 w-9 h-9 rounded-full bg-white shadow-lg border border-gray-200 items-center justify-center text-gray-600 hover:text-purple-600 hover:border-purple-300 transition opacity-0 group-hover/carousel:opacity-100"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 -mx-1 px-1"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <style>{`div::-webkit-scrollbar { display: none; }`}</style>

          {content.map((item) => (
            <Link
              key={item.id}
              data-card
              to={`/creators/${item.creator.username}/content/${item.id}`}
              className={`group flex-shrink-0 snap-start rounded-xl overflow-hidden bg-gray-50 hover:shadow-lg transition-all
                w-[170px] sm:w-[220px] md:w-[240px] lg:w-[260px]
                ${item.isDiscovery ? 'ring-1 ring-purple-200' : ''}`}
            >
              <div className="relative aspect-video bg-gray-200">
                {item.thumbnailUrl ? (
                  <img
                    src={
                      item.thumbnailUrl.startsWith('http')
                        ? item.thumbnailUrl
                        : `${item.thumbnailUrl}`
                    }
                    alt={item.title || 'Video'}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-400 to-pink-400">
                    <Video className="w-8 h-8 text-white/80" />
                  </div>
                )}

                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/90 flex items-center justify-center">
                    <Play
                      className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 ml-0.5"
                      fill="currentColor"
                    />
                  </div>
                </div>

                {item.isDiscovery && (
                  <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-purple-600 text-white text-[10px] font-medium rounded-full flex items-center gap-0.5">
                    <Sparkles className="w-2.5 h-2.5" />
                    Suggested
                  </span>
                )}

                {item.contentType === 'SHORT' && (
                  <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-semibold rounded">
                    SHORT
                  </span>
                )}

                <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-black/70 text-white text-[10px] rounded flex items-center gap-0.5">
                  <Eye className="w-2.5 h-2.5" />
                  {formatNumber(item.viewCount)}
                </div>
              </div>

              <div className="p-2 sm:p-3">
                <h4 className="font-medium text-gray-900 text-xs sm:text-sm line-clamp-1 group-hover:text-purple-600 transition-colors">
                  {item.title || 'Untitled'}
                </h4>

                <div className="flex items-center gap-1.5 mt-1.5">
                  {item.creator.profilePicture ? (
                    <img
                      src={
                        item.creator.profilePicture.startsWith('http')
                          ? item.creator.profilePicture
                          : `${item.creator.profilePicture}`
                      }
                      alt={item.creator.username}
                      className="w-5 h-5 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-[9px] font-bold">
                      {(item.creator.firstName?.[0] || item.creator.username[0]).toUpperCase()}
                    </div>
                  )}
                  <span className="text-xs text-gray-600 flex items-center gap-0.5 truncate">
                    {item.creator.firstName || item.creator.username}
                    {item.creator.creatorVerified && (
                      <BadgeCheck className="w-3 h-3 text-blue-500 flex-shrink-0" />
                    )}
                  </span>
                  {item.isDiscovery && (
                    <span className="ml-auto text-[9px] text-purple-500 font-medium flex items-center gap-0.5 flex-shrink-0">
                      <Compass className="w-2.5 h-2.5" />
                      New
                    </span>
                  )}
                </div>

                {item.campground && (
                  <div className="flex items-center gap-1 mt-1.5 text-[10px] text-gray-500">
                    <Tent className="w-2.5 h-2.5" />
                    <span className="truncate">{item.campground.name}</span>
                  </div>
                )}

                <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={(e) => handleLike(item.id, e)}
                    className={`flex items-center gap-0.5 text-[11px] transition-colors ${
                      item.isLiked ? 'text-red-500' : 'text-gray-500 hover:text-red-500'
                    }`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${item.isLiked ? 'fill-current' : ''}`} />
                    {formatNumber(item.likeCount || item._count?.likes || 0)}
                  </button>
                  <div className="flex items-center gap-0.5 text-[11px] text-gray-500">
                    <MessageCircle className="w-3.5 h-3.5" />
                    {formatNumber(item._count?.comments || 0)}
                  </div>
                  <button
                    onClick={(e) => handleSave(item.id, e)}
                    className={`ml-auto flex items-center gap-0.5 text-[11px] transition-colors ${
                      item.isSaved ? 'text-purple-500' : 'text-gray-500 hover:text-purple-500'
                    }`}
                  >
                    <Bookmark className={`w-3.5 h-3.5 ${item.isSaved ? 'fill-current' : ''}`} />
                  </button>
                </div>
              </div>
            </Link>
          ))}

          {hasMore && (
            <div
              data-card
              className="flex-shrink-0 snap-start w-[170px] sm:w-[220px] md:w-[240px] lg:w-[260px] rounded-xl border-2 border-dashed border-purple-200 flex flex-col items-center justify-center gap-2 text-purple-600 hover:bg-purple-50 transition cursor-pointer"
              onClick={() => loadContent(true)}
            >
              <ChevronRight className="w-8 h-8" />
              <span className="text-sm font-medium">Load More</span>
            </div>
          )}
        </div>
      </div>

      {content.length > 2 && (
        <div className="flex items-center justify-center gap-1.5 mt-3">
          {Array.from({ length: dotsCount }).map((_, i) => (
            <button
              key={i}
              onClick={() => scrollToIndex(i)}
              aria-label={`Go to video ${i + 1}`}
              className={`rounded-full transition-all ${
                i === activeIndex
                  ? 'w-5 h-1.5 bg-purple-500'
                  : 'w-1.5 h-1.5 bg-gray-300 hover:bg-gray-400'
              }`}
            />
          ))}
          {!isPaused && (
            <span className="ml-2 text-[10px] text-gray-400 select-none">▶ auto</span>
          )}
        </div>
      )}
    </div>
  );
}

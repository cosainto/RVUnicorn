import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Play,
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  BadgeCheck,
  Tent,
  Eye,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Send,
  Video,
  Loader2,
} from 'lucide-react';
import api from '../services/api';

interface Creator {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  profilePicture?: string;
  creatorBio?: string;
  creatorVerified?: boolean;
  _count?: {
    creatorFollowers: number;
  };
}

interface ContentItem {
  id: string;
  contentType: string;
  title?: string;
  description?: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  embedUrl?: string;
  embedPlatform?: string;
  category?: string;
  tags: string[];
  viewCount: number;
  likeCount: number;
  commentCount: number;
  saveCount: number;
  publishedAt?: string;
  createdAt: string;
  creator: Creator;
  campground?: {
    id: string;
    name: string;
    state?: string;
  };
  comments?: Array<{
    id: string;
    body: string;
    createdAt: string;
    isCreatorReply: boolean;
    user: {
      id: string;
      username: string;
      firstName?: string;
      lastName?: string;
      profilePicture?: string;
    };
  }>;
  _count?: {
    likes: number;
    comments: number;
    saves: number;
  };
  isLiked?: boolean;
  isSaved?: boolean;
  isFollowing?: boolean;
}

interface RelatedContent {
  id: string;
  title?: string;
  thumbnailUrl?: string;
  contentType: string;
  viewCount: number;
  creator: {
    id: string;
    username: string;
    firstName?: string;
    profilePicture?: string;
    creatorVerified?: boolean;
  };
}

interface SimilarCreator {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  profilePicture?: string;
  creatorSpecialties?: string[];
  creatorVerified?: boolean;
  isFollowing?: boolean;
  creatorStats?: {
    followerCount: number;
  };
}

export default function VideoPlayerPage() {
  const { creatorUsername, contentId } = useParams<{ creatorUsername: string; contentId: string }>();
  const navigate = useNavigate();

  const [content, setContent] = useState<ContentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [relatedContent, setRelatedContent] = useState<RelatedContent[]>([]);
  const [similarCreators, setSimilarCreators] = useState<SimilarCreator[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (creatorUsername && contentId) {
      loadContent();
    }
  }, [creatorUsername, contentId]);

  const loadContent = async () => {
    try {
      setLoading(true);
      
      const { data: creatorData } = await api.get(`/creators/profile/${creatorUsername}`);
      const { data } = await api.get(`/creators/content/${creatorData.id}/${contentId}`);
      setContent(data);


      // Increment view count
      api.post(`/creators/content/${contentId}/view`).catch(err => console.log('View increment failed', err));
      loadRelatedContent();
      loadSimilarCreators(data.creator.id);
    } catch (error) {
      console.error('Error loading content:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRelatedContent = async () => {
    try {
      const { data } = await api.get(`/creators/content/${contentId}/related?limit=6`);
      setRelatedContent(data);
    } catch (error) {
      console.error('Error loading related content:', error);
    }
  };

  const loadSimilarCreators = async (creatorId: string) => {
    try {
      const { data } = await api.get(`/creators/${creatorId}/similar?limit=4`);
      setSimilarCreators(data);
    } catch (error) {
      console.error('Error loading similar creators:', error);
    }
  };

  const navigateToVideo = (direction: "prev" | "next") => {
    if (relatedContent.length === 0) return;
    let newIndex;
    if (direction === "next") {
      newIndex = currentIndex >= relatedContent.length - 1 ? 0 : currentIndex + 1;
    } else {
      newIndex = currentIndex <= 0 ? relatedContent.length - 1 : currentIndex - 1;
    }
    setCurrentIndex(newIndex);
    const nextVideo = relatedContent[newIndex];
    navigate(`/creators/${nextVideo.creator.username}/content/${nextVideo.id}`);
  };

  const handleLike = async () => {
    if (!content) return;
    try {
      const { data } = await api.post(`/creators/content/${content.id}/like`);
      setContent(prev => prev ? {
        ...prev,
        isLiked: data.isLiked,
        likeCount: data.isLiked ? prev.likeCount + 1 : prev.likeCount - 1,
      } : null);
    } catch (error) {
      console.error('Error liking:', error);
    }
  };

  const handleSave = async () => {
    if (!content) return;
    try {
      const { data } = await api.post(`/creators/content/${content.id}/save`);
      setContent(prev => prev ? { ...prev, isSaved: data.isSaved } : null);
    } catch (error) {
      console.error('Error saving:', error);
    }
  };

  const handleFollow = async () => {
    if (!content) return;
    try {
      await api.post(`/creators/follow/${content.creator.id}`);
      setContent(prev => prev ? { ...prev, isFollowing: !prev.isFollowing } : null);
    } catch (error) {
      console.error('Error following:', error);
    }
  };

  const handleFollowSimilar = async (creatorId: string) => {
    try {
      await api.post(`/creators/follow/${creatorId}`);
      setSimilarCreators(prev => prev.map(c => 
        c.id === creatorId ? { ...c, isFollowing: !c.isFollowing } : c
      ));
    } catch (error) {
      console.error('Error following:', error);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content || !newComment.trim()) return;

    try {
      setSubmittingComment(true);
      const { data } = await api.post(`/creators/content/${content.id}/comment`, {
        body: newComment,
      });
      
      setContent(prev => prev ? {
        ...prev,
        comments: [data, ...(prev.comments || [])],
        commentCount: prev.commentCount + 1,
      } : null);
      setNewComment('');
    } catch (error) {
      console.error('Error submitting comment:', error);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: content?.title || 'Check out this video', url });
      } catch (e) {}
    } else {
      navigator.clipboard.writeText(url);
      alert('Link copied to clipboard!');
    }
  };

  const formatNumber = (num?: number) => {
    if (!num) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-purple-500" />
      </div>
    );
  }

  if (!content) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center">
        <Video className="w-16 h-16 mb-4 text-gray-400" />
        <h2 className="text-xl font-bold mb-2">Content not found</h2>
        <button onClick={() => navigate(-1)} className="text-purple-600 hover:text-purple-700">Go back</button>
      </div>
    );
  }



  const renderVideo = () => {
    const videoSource = content.embedUrl || content.videoUrl;
    
    // Try to extract YouTube video ID from various sources
    let videoId = null;
    
    // Check embedUrl or videoUrl for YouTube
    if (videoSource?.includes("youtube")) {
      videoId = videoSource.match(/(?:(?:music\.)?youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^\&\s]+)/)?.[1];
    }
    
    // Fallback: extract from thumbnail URL (img.youtube.com/vi/VIDEO_ID/...)
    if (!videoId && content.thumbnailUrl?.includes("img.youtube.com")) {
      videoId = content.thumbnailUrl.match(/img\.youtube\.com\/vi\/([^\/]+)/)?.[1];
    }
    
    // If we have a YouTube video ID, embed it
    if (videoId) {
      return <iframe src={`https://www.youtube.com/embed/${videoId}?autoplay=1`} className="w-full h-full" allowFullScreen allow="autoplay; encrypted-media" />;
    }
    
    // TikTok
    if (videoSource?.includes("tiktok") || content.embedPlatform === "TIKTOK") {
      const tiktokId = videoSource?.match(/tiktok\.com\/@[^\/]+\/video\/(\d+)/)?.[1];
      if (tiktokId) {
        return <iframe src={`https://www.tiktok.com/embed/v2/${tiktokId}`} className="w-full h-full" allowFullScreen allow="autoplay; encrypted-media" />;
      }
    }
    
    // Instagram
    if (videoSource?.includes("instagram") || content.embedPlatform === "INSTAGRAM") {
      const instaMatch = videoSource?.match(/instagram\.com\/(p|reel|reels)\/([A-Za-z0-9_-]+)/);
      if (instaMatch) {
        return <iframe src={`https://www.instagram.com/${instaMatch[1]}/${instaMatch[2]}/embed`} className="w-full h-full" allowFullScreen allow="autoplay; encrypted-media" />;
      }
    }
    
    // Direct video file
    if (content.videoUrl && !content.videoUrl.includes("youtube") && !content.videoUrl.includes("tiktok") && !content.videoUrl.includes("instagram")) {
      return <video src={content.videoUrl.startsWith("http") ? content.videoUrl : `http://127.0.0.1:3001${content.videoUrl}`} controls autoPlay className="w-full h-full" />;
    }
    
    // Fallback to thumbnail
    return content.thumbnailUrl ? <img src={content.thumbnailUrl.startsWith("http") ? content.thumbnailUrl : `http://127.0.0.1:3001${content.thumbnailUrl}`} alt={content.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-gray-800"><Video className="w-24 h-24 text-gray-600" /></div>;
  };


  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <ChevronLeft className="w-5 h-5" />
            Back
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-black rounded-xl overflow-hidden aspect-video relative group">
              {renderVideo()}
              {/* Navigation Arrows */}
              {relatedContent.length > 0 && (
                <>
                  <button
                    onClick={() => navigateToVideo("prev")}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-14 h-14 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  >
                    <ChevronLeft className="w-8 h-8" />
                  </button>
                  <button
                    onClick={() => navigateToVideo("next")}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-14 h-14 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  >
                    <ChevronRight className="w-8 h-8" />
                  </button>
                </>
              )}
            </div>

            <div className="bg-white rounded-xl p-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{content.title || 'Untitled'}</h1>

              <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                <span className="flex items-center gap-1">
                  <Eye className="w-4 h-4" />
                  {formatNumber(content.viewCount)} views
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {formatDate(content.publishedAt)}
                </span>
                {content.campground && (
                  <Link to={`/campgrounds/${content.campground.id}`} className="flex items-center gap-1 text-green-600 hover:text-green-700">
                    <Tent className="w-4 h-4" />
                    {content.campground.name}
                  </Link>
                )}
              </div>

              <div className="flex items-center gap-3 pb-4 border-b">
                <button
                  onClick={handleLike}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full transition ${
                    content.isLiked ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Heart className={`w-5 h-5 ${content.isLiked ? 'fill-current' : ''}`} />
                  {formatNumber(content.likeCount)}
                </button>
                <button
                  onClick={handleSave}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full transition ${
                    content.isSaved ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Bookmark className={`w-5 h-5 ${content.isSaved ? 'fill-current' : ''}`} />
                  Save
                </button>
                <button onClick={handleShare} className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 transition">
                  <Share2 className="w-5 h-5" />
                  Share
                </button>
              </div>

              <div className="flex items-center gap-4 py-4 border-b">
                <Link to={`/creators/${content.creator.username}`}>
                  {content.creator.profilePicture ? (
                    <img
                      src={content.creator.profilePicture.startsWith('http') ? content.creator.profilePicture : `http://127.0.0.1:3001${content.creator.profilePicture}`}
                      alt={content.creator.username}
                      className="w-14 h-14 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-xl font-bold">
                      {(content.creator.firstName?.[0] || content.creator.username[0]).toUpperCase()}
                    </div>
                  )}
                </Link>
                <div className="flex-1">
                  <Link to={`/creators/${content.creator.username}`} className="font-semibold text-gray-900 hover:text-purple-600 flex items-center gap-1">
                    {content.creator.firstName || content.creator.username}
                    {content.creator.creatorVerified && <BadgeCheck className="w-5 h-5 text-blue-500" />}
                  </Link>
                  <p className="text-sm text-gray-500">{formatNumber(content.creator._count?.creatorFollowers)} followers</p>
                </div>
                <button
                  onClick={handleFollow}
                  className={`px-6 py-2 rounded-full font-medium transition ${
                    content.isFollowing ? 'bg-gray-200 text-gray-700 hover:bg-red-100 hover:text-red-600' : 'bg-purple-600 text-white hover:bg-purple-700'
                  }`}
                >
                  {content.isFollowing ? 'Following' : 'Follow'}
                </button>
              </div>

              {content.description && (
                <div className="py-4">
                  <p className="text-gray-700 whitespace-pre-wrap">{content.description}</p>
                </div>
              )}

              {content.tags && content.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 py-4 border-t">
                  {content.tags.map((tag, i) => (
                    <span key={i} className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">#{tag}</span>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl p-6">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                {content.commentCount} Comments
              </h3>

              <form onSubmit={handleSubmitComment} className="flex gap-3 mb-6">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-full focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <button
                  type="submit"
                  disabled={!newComment.trim() || submittingComment}
                  className="px-4 py-2 bg-purple-600 text-white rounded-full hover:bg-purple-700 disabled:opacity-50"
                >
                  {submittingComment ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </form>

              <div className="space-y-4">
                {content.comments && content.comments.length > 0 ? (
                  content.comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3">
                      <Link to={`/profile/${comment.user.username}`}>
                        {comment.user.profilePicture ? (
                          <img
                            src={comment.user.profilePicture.startsWith('http') ? comment.user.profilePicture : `http://127.0.0.1:3001${comment.user.profilePicture}`}
                            alt={comment.user.username}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold text-sm">
                            {(comment.user.firstName?.[0] || comment.user.username[0]).toUpperCase()}
                          </div>
                        )}
                      </Link>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Link to={`/profile/${comment.user.username}`} className="font-medium text-gray-900 hover:text-purple-600">
                            {comment.user.firstName || comment.user.username}
                          </Link>
                          {comment.isCreatorReply && (
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">Creator</span>
                          )}
                          <span className="text-xs text-gray-400">{formatDate(comment.createdAt)}</span>
                        </div>
                        <p className="text-gray-700 mt-1">{comment.body}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-gray-500 py-8">No comments yet. Be the first to comment!</p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {similarCreators.length > 0 && (
              <div className="bg-white rounded-xl p-6">
                <h3 className="font-bold text-gray-900 mb-4">Similar Creators</h3>
                <div className="space-y-3">
                  {similarCreators.map((creator) => (
                    <div key={creator.id} className="flex items-center gap-3">
                      <Link to={`/creators/${creator.username}`}>
                        {creator.profilePicture ? (
                          <img
                            src={creator.profilePicture.startsWith('http') ? creator.profilePicture : `http://127.0.0.1:3001${creator.profilePicture}`}
                            alt={creator.username}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold">
                            {(creator.firstName?.[0] || creator.username[0]).toUpperCase()}
                          </div>
                        )}
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link to={`/creators/${creator.username}`} className="font-medium text-gray-900 hover:text-purple-600 truncate block">
                          {creator.firstName || creator.username}
                          {creator.creatorVerified && <BadgeCheck className="w-4 h-4 text-blue-500 inline ml-1" />}
                        </Link>
                        <p className="text-xs text-gray-500">{formatNumber(creator.creatorStats?.followerCount)} followers</p>
                      </div>
                      <button
                        onClick={() => handleFollowSimilar(creator.id)}
                        className={`px-3 py-1 text-sm rounded-full transition ${
                          creator.isFollowing ? 'bg-gray-100 text-gray-700' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                        }`}
                      >
                        {creator.isFollowing ? 'Following' : 'Follow'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {relatedContent.length > 0 && (
              <div className="bg-white rounded-xl p-6">
                <h3 className="font-bold text-gray-900 mb-4">Related Videos</h3>
                <div className="space-y-4">
                  {relatedContent.map((item) => (
                    <Link key={item.id} to={`/creators/${item.creator.username}/content/${item.id}`} className="flex gap-3 group">
                      <div className="relative w-28 h-16 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                        {item.thumbnailUrl ? (
                          <img
                            src={item.thumbnailUrl.startsWith('http') ? item.thumbnailUrl : `http://127.0.0.1:3001${item.thumbnailUrl}`}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Video className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                          <Play className="w-6 h-6 text-white" fill="currentColor" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 line-clamp-2 group-hover:text-purple-600 transition text-sm">
                          {item.title || 'Untitled'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{item.creator.firstName || item.creator.username}</p>
                        <p className="text-xs text-gray-400">{formatNumber(item.viewCount)} views</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

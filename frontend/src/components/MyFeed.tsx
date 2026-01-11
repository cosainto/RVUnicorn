import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MessageCircle, MapPin, Tent, Send } from 'lucide-react';
import api from '../api';

interface CampgroundPost {
  id: string;
  title?: string;
  content: string;
  imageUrl?: string;
  isPinned: boolean;
  createdAt: string;
  campground: {
    id: string;
    name: string;
    location: string;
    state?: string;
  };
  author: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture?: string;
  };
  comments: {
    id: string;
    content: string;
    createdAt: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      username: string;
      profilePicture?: string;
    };
  }[];
  _count: {
    likes: number;
    comments: number;
  };
  isLiked: boolean;
}

interface MyFeedProps {
  maxPosts?: number;
  showTitle?: boolean;
}

export default function MyFeed({ maxPosts = 10, showTitle = true }: MyFeedProps) {
  const [posts, setPosts] = useState<CampgroundPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [newComments, setNewComments] = useState<Record<string, string>>({});
  const [submittingComment, setSubmittingComment] = useState<string | null>(null);

  useEffect(() => {
    loadFeed();
  }, []);

  const loadFeed = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/campground-posts/my-feed?limit=${maxPosts}`);
      setPosts(data.posts);
    } catch (err) {
      console.error('Failed to load feed:', err);
      setError('Failed to load feed');
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (postId: string) => {
    try {
      const { data } = await api.put(`/campground-posts/${postId}/like`);
      setPosts(posts.map(post => 
        post.id === postId 
          ? { 
              ...post, 
              isLiked: data.liked,
              _count: { 
                ...post._count, 
                likes: data.liked ? post._count.likes + 1 : post._count.likes - 1 
              }
            }
          : post
      ));
    } catch (err) {
      console.error('Failed to like post:', err);
    }
  };

  const toggleComments = (postId: string) => {
    const newExpanded = new Set(expandedComments);
    if (newExpanded.has(postId)) {
      newExpanded.delete(postId);
    } else {
      newExpanded.add(postId);
    }
    setExpandedComments(newExpanded);
  };

  const handleAddComment = async (postId: string) => {
    const content = newComments[postId]?.trim();
    if (!content) return;

    try {
      setSubmittingComment(postId);
      const { data } = await api.post(`/campground-posts/${postId}/comments`, { content });
      
      setPosts(posts.map(post => 
        post.id === postId 
          ? { 
              ...post, 
              comments: [...post.comments, data],
              _count: { ...post._count, comments: post._count.comments + 1 }
            }
          : post
      ));
      setNewComments({ ...newComments, [postId]: '' });
      
      // Auto-expand comments after adding
      setExpandedComments(new Set([...expandedComments, postId]));
    } catch (err) {
      console.error('Failed to add comment:', err);
    } finally {
      setSubmittingComment(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        {showTitle && <h3 className="text-lg font-bold text-gray-900 mb-4">📰 My Feed</h3>}
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        {showTitle && <h3 className="text-lg font-bold text-gray-900 mb-4">📰 My Feed</h3>}
        <p className="text-red-500 text-center py-4">{error}</p>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        {showTitle && <h3 className="text-lg font-bold text-gray-900 mb-4">📰 My Feed</h3>}
        <div className="text-center py-8">
          <Tent className="w-12 h-12 mx-auto text-gray-400 mb-3" />
          <p className="text-gray-600 mb-2">No posts yet!</p>
          <p className="text-sm text-gray-500">Follow campgrounds to see their updates here.</p>
          <Link to="/campgrounds" className="text-primary-600 hover:underline text-sm mt-2 inline-block">
            Browse Campgrounds →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {showTitle && <h3 className="text-lg font-bold text-gray-900 mb-4">📰 My Feed</h3>}
      
      <div className="space-y-6">
        {posts.map(post => (
          <div key={post.id} className="border-b border-gray-200 pb-6 last:border-0 last:pb-0">
            {/* Campground Header */}
            <Link 
              to={`/campgrounds/${post.campground.id}`}
              className="flex items-center gap-3 mb-3 hover:bg-gray-50 -mx-2 px-2 py-1 rounded-lg transition"
            >
              <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-white">
                <Tent className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">{post.campground.name}</p>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {post.campground.location}
                </p>
              </div>
              <span className="ml-auto text-xs text-gray-400">{formatDate(post.createdAt)}</span>
            </Link>

            {/* Post Content */}
            {post.title && (
              <h4 className="font-semibold text-gray-900 mb-2">{post.title}</h4>
            )}
            <p className="text-gray-700 mb-3">{post.content}</p>

            {/* Post Image */}
            {post.imageUrl && (
              <img 
                src={`http://127.0.0.1:3001${post.imageUrl}`}
                alt="Post"
                className="w-full rounded-lg mb-3 max-h-96 object-cover"
              />
            )}

            {/* Actions */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => handleLike(post.id)}
                className={`flex items-center gap-1 text-sm transition ${
                  post.isLiked ? 'text-red-500' : 'text-gray-500 hover:text-red-500'
                }`}
              >
                <Heart className={`w-5 h-5 ${post.isLiked ? 'fill-current' : ''}`} />
                <span>{post._count.likes}</span>
              </button>
              <button
                onClick={() => toggleComments(post.id)}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600 transition"
              >
                <MessageCircle className="w-5 h-5" />
                <span>{post._count.comments}</span>
              </button>
            </div>

            {/* Comments Section */}
            {expandedComments.has(post.id) && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                {/* Existing Comments */}
                {post.comments.length > 0 && (
                  <div className="space-y-3 mb-4">
                    {post.comments.map(comment => (
                      <div key={comment.id} className="flex gap-2">
                        <Link to={`/profile/${comment.user.username}`}>
                          {comment.user.profilePicture ? (
                            <img
                              src={`http://127.0.0.1:3001${comment.user.profilePicture}`}
                              alt={comment.user.firstName}
                              className="w-8 h-8 rounded-full"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-xs font-bold">
                              {comment.user.firstName[0]}
                            </div>
                          )}
                        </Link>
                        <div className="flex-1 bg-gray-50 rounded-lg px-3 py-2">
                          <Link 
                            to={`/profile/${comment.user.username}`}
                            className="font-medium text-sm text-gray-900 hover:underline"
                          >
                            {comment.user.firstName} {comment.user.lastName}
                          </Link>
                          <p className="text-sm text-gray-700">{comment.content}</p>
                          <span className="text-xs text-gray-400">{formatDate(comment.createdAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Comment */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newComments[post.id] || ''}
                    onChange={(e) => setNewComments({ ...newComments, [post.id]: e.target.value })}
                    placeholder="Write a comment..."
                    className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleAddComment(post.id);
                      }
                    }}
                  />
                  <button
                    onClick={() => handleAddComment(post.id)}
                    disabled={submittingComment === post.id || !newComments[post.id]?.trim()}
                    className="p-2 bg-primary-600 text-white rounded-full hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

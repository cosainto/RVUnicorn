import { useState, useEffect } from 'react';
import { GifButton } from '../components/GifPicker';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Star, Eye, Clock, Send, Heart, Reply, Trash2, Lock, Pin, Tent, Tag, MoreVertical, X } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface ThreadPost {
  imageUrl?: string;
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture?: string;
  };
  _count: {
    likes: number;
    replies?: number;
  };
  isLiked: boolean;
  replies?: ThreadPost[];
}

interface Thread {
  id: string;
  title: string;
  content?: string;
  slug: string;
  viewCount: number;
  isPinned: boolean;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture?: string;
  };
  campground?: {
    id: string;
    name: string;
    slug: string;
    location?: string;
    state?: string;
  };
  tags: Array<{
    tag: {
      id: string;
      name: string;
      slug: string;
      color: string;
    };
  }>;
  _count: {
    posts: number;
    favorites: number;
  };
  isFavorited: boolean;
  posts: ThreadPost[];
}

export default function ThreadDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [thread, setThread] = useState<Thread | null>(null);
  const [loading, setLoading] = useState(true);
  const [newPost, setNewPost] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [postImage, setPostImage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadThread();
  }, [id]);

  const loadThread = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/threads/${id}`);
      setThread(data);
    } catch (error) {
      console.error('Load thread error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFavorite = async () => {
    if (!user || !thread) return;
    
    try {
      const { data } = await api.post(`/threads/${thread.id}/favorite`);
      setThread({
        ...thread,
        isFavorited: data.favorited,
        _count: {
          ...thread._count,
          favorites: thread._count.favorites + (data.favorited ? 1 : -1)
        }
      });
    } catch (error) {
      console.error('Favorite error:', error);
    }
  };

  const handleSubmitPost = async () => {
    if ((!newPost.trim() && !postImage) || !thread) return;
    
    try {
      setSubmitting(true);
      await api.post('/threads/' + thread.id + '/posts', { content: newPost, imageUrl: postImage });
      setNewPost('');
      setPostImage('');
      loadThread();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to post');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitReply = async (parentId: string) => {
    if (!replyContent.trim() || !thread) return;
    
    try {
      setSubmitting(true);
      await api.post(`/threads/${thread.id}/posts`, { 
        content: replyContent,
        parentId 
      });
      setReplyContent('');
      setReplyingTo(null);
      loadThread();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to reply');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLikePost = async (postId: string) => {
    if (!user) {
      alert('Please log in to like posts');
      return;
    }

    try {
      const { data } = await api.post(`/threads/posts/${postId}/like`);
      
      // Update the post in state
      if (thread) {
        const updatePosts = (posts: ThreadPost[]): ThreadPost[] => {
          return posts.map(post => {
            if (post.id === postId) {
              return {
                ...post,
                isLiked: data.liked,
                _count: {
                  ...post._count,
                  likes: post._count.likes + (data.liked ? 1 : -1)
                }
              };
            }
            if (post.replies) {
              return { ...post, replies: updatePosts(post.replies) };
            }
            return post;
          });
        };
        
        setThread({ ...thread, posts: updatePosts(thread.posts) });
      }
    } catch (error) {
      console.error('Like error:', error);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Delete this post?')) return;
    
    try {
      await api.delete(`/threads/posts/${postId}`);
      loadThread();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete');
    }
  };

  const handleDeleteThread = async () => {
    if (!confirm('Delete this thread and all its posts?')) return;
    
    try {
      await api.delete(`/threads/${id}`);
      navigate('/feed');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete');
    }
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const formatRelativeDate = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-gray-600">Thread not found</p>
        <Link to="/feed" className="text-primary-600 hover:underline">Back to Feed</Link>
      </div>
    );
  }

  const isAuthor = user?.id === thread.author.id;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Back Button */}
      <button
        onClick={() => navigate('/feed')}
        className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
      >
        <ArrowLeft className="w-5 h-5 mr-2" />
        Back to Feed
      </button>

      {/* Thread Header */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
        {/* Campground Banner (if linked) */}
        {thread.campground && (
          <Link
            to={`/campgrounds/${thread.campground.id}`}
            className="block bg-gradient-to-r from-green-500 to-teal-500 text-white px-4 py-2 flex items-center gap-2 hover:from-green-600 hover:to-teal-600 transition"
          >
            <Tent className="w-4 h-4" />
            <span className="font-medium">{thread.campground.name}</span>
            {thread.campground.location && (
              <span className="text-green-100 text-sm">
                • {thread.campground.location}{thread.campground.state ? `, ${thread.campground.state}` : ''}
              </span>
            )}
          </Link>
        )}

        <div className="p-6">
          {/* Title & Actions */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {thread.isPinned && <span className="text-yellow-500 mr-2">📌</span>}
                {thread.isLocked && <span className="text-gray-400 mr-2">🔒</span>}
                {thread.title}
              </h1>
              
              {/* Tags */}
              {thread.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {thread.tags.map(({ tag }) => (
                    <Link
                      key={tag.id}
                      to={`/feed?tag=${tag.slug}`}
                      className="px-2 py-0.5 rounded-full text-xs hover:opacity-80 transition"
                      style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                    >
                      {tag.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Favorite Button */}
              <button
                onClick={handleFavorite}
                className={`p-2 rounded-full transition ${
                  thread.isFavorited
                    ? 'text-yellow-500 bg-yellow-50 hover:bg-yellow-100'
                    : 'text-gray-400 hover:text-yellow-500 hover:bg-gray-100'
                }`}
                title={thread.isFavorited ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Star className={`w-5 h-5 ${thread.isFavorited ? 'fill-current' : ''}`} />
              </button>

              {/* Delete (author only) */}
              {isAuthor && (
                <button
                  onClick={handleDeleteThread}
                  className="p-2 rounded-full text-red-400 hover:text-red-600 hover:bg-red-50 transition"
                  title="Delete thread"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* Author & Meta */}
          <div className="flex items-center gap-3 mb-4">
            <Link to={`/profile/${thread.author.username}`}>
              {thread.author.profilePicture ? (
                <img
                  src={`http://127.0.0.1:3001${thread.author.profilePicture}`}
                  alt=""
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                  <span className="text-primary-700 font-semibold">
                    {thread.author.firstName[0]}
                  </span>
                </div>
              )}
            </Link>
            <div>
              <Link
                to={`/profile/${thread.author.username}`}
                className="font-medium text-gray-900 hover:text-primary-600"
              >
                {thread.author.firstName} {thread.author.lastName}
              </Link>
              <p className="text-sm text-gray-500">
                Posted {formatDate(thread.createdAt)}
              </p>
            </div>
          </div>

          {/* Content */}
          {thread.content && (
            <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
              {thread.content}
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center gap-6 mt-6 pt-4 border-t text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <MessageSquare className="w-4 h-4" />
              {thread._count.posts} {thread._count.posts === 1 ? 'reply' : 'replies'}
            </span>
            <span className="flex items-center gap-1">
              <Eye className="w-4 h-4" />
              {thread.viewCount} views
            </span>
            <span className="flex items-center gap-1">
              <Star className="w-4 h-4" />
              {thread._count.favorites} favorites
            </span>
          </div>
        </div>
      </div>

      {/* Reply Box */}
      {!thread.isLocked && user && (
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex gap-3">
            {user.profilePicture ? (
              <img
                src={`http://127.0.0.1:3001${user.profilePicture}`}
                alt=""
                className="w-10 h-10 rounded-full"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                <span className="text-primary-700 font-semibold">
                  {user.firstName[0]}
                </span>
              </div>
            )}
            <div className="flex-1">
              <textarea
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                className="input w-full resize-none"
                rows={3}
                placeholder="Write a reply..."
              />
              {postImage && (
                <div className="relative inline-block mt-2">
                  <img src={postImage} alt="GIF" className="h-32 rounded-lg" />
                  <button
                    type="button"
                    onClick={() => setPostImage('')}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              <div className="flex justify-between items-center mt-2">
                <GifButton onSelect={(gifUrl) => setPostImage(gifUrl)} />
                <button
                  onClick={handleSubmitPost}
                  disabled={submitting || (!newPost.trim() && !postImage)}
                  className="btn btn-primary flex items-center gap-2 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {submitting ? 'Posting...' : 'Post Reply'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {thread.isLocked && (
        <div className="bg-gray-50 border rounded-lg p-4 mb-6 flex items-center gap-2 text-gray-600">
          <Lock className="w-5 h-5" />
          <span>This thread is locked. No new replies can be posted.</span>
        </div>
      )}

      {!user && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-center">
          <p className="text-blue-700">
            <Link to="/login" className="font-semibold hover:underline">Log in</Link> or{' '}
            <Link to="/register" className="font-semibold hover:underline">sign up</Link> to join the discussion
          </p>
        </div>
      )}

      {/* Posts */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">
          {thread._count.posts} {thread._count.posts === 1 ? 'Reply' : 'Replies'}
        </h2>

        {thread.posts.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-lg border">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500">No replies yet. Be the first to respond!</p>
          </div>
        ) : (
          thread.posts.map(post => (
            <div key={post.id} className="bg-white rounded-lg shadow-sm border">
              {/* Main Post */}
              <div className="p-4">
                <div className="flex gap-3">
                  <Link to={`/profile/${post.author.username}`}>
                    {post.author.profilePicture ? (
                      <img
                        src={`http://127.0.0.1:3001${post.author.profilePicture}`}
                        alt=""
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                        <span className="text-primary-700 font-semibold">
                          {post.author.firstName[0]}
                        </span>
                      </div>
                    )}
                  </Link>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <Link
                          to={`/profile/${post.author.username}`}
                          className="font-medium text-gray-900 hover:text-primary-600"
                        >
                          {post.author.firstName} {post.author.lastName}
                        </Link>
                        <span className="text-sm text-gray-500 ml-2">
                          {formatRelativeDate(post.createdAt)}
                        </span>
                      </div>
                      {user?.id === post.author.id && (
                        <button
                          onClick={() => handleDeletePost(post.id)}
                          className="text-gray-400 hover:text-red-500 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <p className="text-gray-700 mt-2 whitespace-pre-wrap">{post.content}</p>
                    {post.imageUrl && (
                      <img src={post.imageUrl} alt="" className="mt-3 rounded-lg max-h-64 object-cover" />
                    )}
                    
                    {/* Actions */}
                    <div className="flex items-center gap-4 mt-3">
                      <button
                        onClick={() => handleLikePost(post.id)}
                        className={`flex items-center gap-1 text-sm transition ${
                          post.isLiked
                            ? 'text-red-500'
                            : 'text-gray-500 hover:text-red-500'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${post.isLiked ? 'fill-current' : ''}`} />
                        {post._count.likes}
                      </button>
                      {!thread.isLocked && user && (
                        <button
                          onClick={() => setReplyingTo(replyingTo === post.id ? null : post.id)}
                          className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600"
                        >
                          <Reply className="w-4 h-4" />
                          Reply
                        </button>
                      )}
                    </div>

                    {/* Reply Input */}
                    {replyingTo === post.id && (
                      <div className="mt-3 flex gap-2">
                        <input
                          type="text"
                          value={replyContent}
                          onChange={(e) => setReplyContent(e.target.value)}
                          className="input flex-1"
                          placeholder={`Reply to ${post.author.firstName}...`}
                          onKeyDown={(e) => e.key === 'Enter' && handleSubmitReply(post.id)}
                        />
                        <button
                          onClick={() => handleSubmitReply(post.id)}
                          disabled={submitting || !replyContent.trim()}
                          className="btn btn-primary btn-sm disabled:opacity-50"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Nested Replies */}
              {post.replies && post.replies.length > 0 && (
                <div className="border-t bg-gray-50">
                  {post.replies.map(reply => (
                    <div key={reply.id} className="p-4 pl-16 border-b last:border-b-0">
                      <div className="flex gap-3">
                        <Link to={`/profile/${reply.author.username}`}>
                          {reply.author.profilePicture ? (
                            <img
                              src={`http://127.0.0.1:3001${reply.author.profilePicture}`}
                              alt=""
                              className="w-8 h-8 rounded-full"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                              <span className="text-primary-700 font-semibold text-sm">
                                {reply.author.firstName[0]}
                              </span>
                            </div>
                          )}
                        </Link>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <Link
                                to={`/profile/${reply.author.username}`}
                                className="font-medium text-gray-900 hover:text-primary-600 text-sm"
                              >
                                {reply.author.firstName} {reply.author.lastName}
                              </Link>
                              <span className="text-xs text-gray-500 ml-2">
                                {formatRelativeDate(reply.createdAt)}
                              </span>
                            </div>
                            {user?.id === reply.author.id && (
                              <button
                                onClick={() => handleDeletePost(reply.id)}
                                className="text-gray-400 hover:text-red-500 p-1"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          <p className="text-gray-700 text-sm mt-1 whitespace-pre-wrap">{reply.content}</p>
                          {reply.imageUrl && (
                            <img src={reply.imageUrl} alt="" className="mt-2 rounded-lg max-h-48 object-cover" />
                          )}
                          <button
                            onClick={() => handleLikePost(reply.id)}
                            className={`flex items-center gap-1 text-xs mt-2 transition ${
                              reply.isLiked
                                ? 'text-red-500'
                                : 'text-gray-500 hover:text-red-500'
                            }`}
                          >
                            <Heart className={`w-3 h-3 ${reply.isLiked ? 'fill-current' : ''}`} />
                            {reply._count.likes}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

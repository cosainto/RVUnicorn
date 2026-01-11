import { useState, useEffect } from 'react';
import { GifButton } from './GifPicker';
import { Link } from 'react-router-dom';
import { MessageSquare, Plus, Star, Eye, X } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface Thread {
  id: string;
  title: string;
  content?: string;
  viewCount: number;
  isPinned: boolean;
  createdAt: string;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture?: string;
  };
  tags: Array<{
    tag: {
      id: string;
      name: string;
      color: string;
    };
  }>;
  _count: {
    posts: number;
    favorites: number;
  };
  isFavorited: boolean;
}

interface ThreadTag {
  id: string;
  name: string;
  slug: string;
  color: string;
}

interface Props {
  campgroundId: string;
  campgroundName: string;
}

export default function CampgroundThreads({ campgroundId, campgroundName }: Props) {
  const { user } = useAuth();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewThreadModal, setShowNewThreadModal] = useState(false);
  const [tags, setTags] = useState<ThreadTag[]>([]);
  
  const [newThread, setNewThread] = useState({
    imageUrl: '' as string,
    title: '',
    content: '',
    tagIds: [] as string[]
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadThreads();
    loadTags();
  }, [campgroundId]);

  const loadThreads = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/threads?campgroundId=${campgroundId}`);      
     
  setThreads(data);
    } catch (error) {
      console.error('Load threads error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTags = async () => {
    try {
      const { data } = await api.get('/threads/tags/all');
      setTags(data);
    } catch (error) {
      console.error('Load tags error:', error);
    }
  };

  const handleCreateThread = async () => {
    if (!newThread.title.trim()) {
      alert('Title is required');
      return;
    }
    
    try {
      setCreating(true);
      const { data } = await api.post('/threads', {
        ...newThread,
        campgroundId
      });
      setShowNewThreadModal(false);
      setNewThread({ title: '', content: '', tagIds: [], imageUrl: '' });
      window.location.href = `/threads/${data.id}`;
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create thread');
    } finally {
      setCreating(false);
    }
  };

  const handleFavorite = async (threadId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user) {
      alert('Please log in to favorite threads');
      return;
    }

    try {
      const { data } = await api.post(`/threads/${threadId}/favorite`);
      setThreads(threads.map(t => 
        t.id === threadId 
          ? { ...t, isFavorited: data.favorited, _count: { ...t._count, favorites: t._count.favorites + (data.favorited ? 1 : -1) } }
          : t
      ));
    } catch (error) {
      console.error('Favorite error:', error);
    }
  };

  const toggleTag = (tagId: string) => {
    setNewThread(prev => ({
      ...prev,
      tagIds: prev.tagIds.includes(tagId)
        ? prev.tagIds.filter(id => id !== tagId)
        : [...prev.tagIds, tagId]
    }));
  };

  const formatDate = (date: string) => {
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary-600" />
            Discussions
          </h3>
          <p className="text-sm text-gray-500">
            {threads.length} {threads.length === 1 ? 'thread' : 'threads'} about this campground
          </p>
        </div>
        {user && (
          <button
            onClick={() => setShowNewThreadModal(true)}
            className="btn btn-primary btn-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Thread
          </button>
        )}
      </div>

      {/* Threads List */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
        </div>
      ) : threads.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 mb-4">No discussions yet about {campgroundName}</p>
          {user ? (
            <button
              onClick={() => setShowNewThreadModal(true)}
              className="btn btn-primary btn-sm"
            >
              Start a Discussion
            </button>
          ) : (
            <p className="text-sm text-gray-400">
              <Link to="/login" className="text-primary-600 hover:underline">Log in</Link> to start a discussion
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {threads.map(thread => (
            <Link
              key={thread.id}
              to={`/threads/${thread.id}`}
              className={`block bg-white rounded-lg border hover:border-primary-300 hover:shadow-sm transition p-3 ${
                thread.isPinned ? 'border-l-4 border-l-yellow-400' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-900 hover:text-primary-600 line-clamp-1">
                    {thread.isPinned && <span className="text-yellow-500 mr-1">📌</span>}
                    {thread.title}
                  </h4>
                  
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                    <span>{thread.author.firstName} {thread.author.lastName}</span>
                    <span>•</span>
                    <span>{formatDate(thread.createdAt)}</span>
                  </div>

                  {/* Tags */}
                  {thread.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {thread.tags.map(({ tag }) => (
                        <span
                          key={tag.id}
                          className="px-2 py-0.5 rounded-full text-xs"
                          style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {thread._count.posts}
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <Eye className="w-3 h-3" />
                      {thread.viewCount}
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleFavorite(thread.id, e)}
                    className={`p-1.5 rounded-full transition ${
                      thread.isFavorited
                        ? 'text-yellow-500 bg-yellow-50'
                        : 'text-gray-300 hover:text-yellow-500'
                    }`}
                  >
                    <Star className={`w-4 h-4 ${thread.isFavorited ? 'fill-current' : ''}`} />
                  </button>
                </div>
              </div>
            </Link>
          ))}
          
          {/* View All Link */}
          <Link
            to={`/feed?campgroundId=${campgroundId}`}
            className="block text-center text-sm text-primary-600 hover:text-primary-700 py-2"
          >
            View all discussions →
          </Link>
        </div>
      )}

      {/* New Thread Modal */}
      {showNewThreadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-green-500 to-teal-500 text-white p-4 rounded-t-lg">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">
                  New Discussion about {campgroundName}
                </h2>
                <button
                  onClick={() => setShowNewThreadModal(false)}
                  className="text-white hover:text-gray-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={newThread.title}
                  onChange={(e) => setNewThread({ ...newThread, title: e.target.value })}
                  className="input w-full"
                  placeholder="What's your question or topic?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Details
                </label>
                <textarea
                  value={newThread.content}
                  onChange={(e) => setNewThread({ ...newThread, content: e.target.value })}
                  className="input w-full"
                  rows={4}
                  placeholder="Share more details..."
                />
                <div className="flex items-center gap-2 mt-2">
                  <GifButton onSelect={(gifUrl) => setNewThread({ ...newThread, imageUrl: gifUrl })} />
                  <span className="text-xs text-gray-500">Add a GIF to your post</span>
                </div>
                {newThread.imageUrl && (
                  <div className="relative inline-block mt-2">
                    <img src={newThread.imageUrl} alt="GIF" className="h-32 rounded-lg" />
                    <button
                      type="button"
                      onClick={() => setNewThread({ ...newThread, imageUrl: '' })}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              {tags.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tags
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {tags.map(tag => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className={`px-2 py-1 rounded-full text-xs transition ${
                          newThread.tagIds.includes(tag.id)
                            ? 'ring-2 ring-offset-1'
                            : 'opacity-60 hover:opacity-100'
                        }`}
                        style={{
                          backgroundColor: `${tag.color}20`,
                          color: tag.color,
                          ringColor: tag.color
                        }}
                      >
                        {tag.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={() => setShowNewThreadModal(false)}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateThread}
                  disabled={creating || !newThread.title.trim()}
                  className="btn btn-primary flex-1 disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Post Discussion'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

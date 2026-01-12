import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Send, Trash2, AtSign } from 'lucide-react';
import api from '../services/api';

interface Comment {
  id: string;
  content: string;
  mentions: string[];
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture?: string;
  };
}

interface Attendee {
  userId: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture?: string;
  };
}

interface EventCommentWallProps {
  eventId: string;
  currentUserId: string;
  isOrganizer: boolean;
  attendees: Attendee[];
}

export default function EventCommentWall({ eventId, currentUserId, isOrganizer, attendees }: EventCommentWallProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadComments();
  }, [eventId]);

  const loadComments = async () => {
    try {
      const { data } = await api.get(`/events/${eventId}/comments`);
      setComments(data);
    } catch (error) {
      console.error('Load comments error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || posting) return;

    // Extract mentions from content
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(newComment)) !== null) {
      mentions.push(match[1]);
    }

    try {
      setPosting(true);
      await api.post(`/events/${eventId}/comments`, {
        content: newComment.trim(),
        mentions,
      });
      setNewComment('');
      await loadComments();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to post comment');
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm('Delete this comment?')) return;
    try {
      await api.delete(`/events/${eventId}/comments/${commentId}`);
      setComments(comments.filter((c) => c.id !== commentId));
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete comment');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setNewComment(value);
    setCursorPosition(e.target.selectionStart || 0);

    // Check if user is typing a mention
    const textBeforeCursor = value.substring(0, e.target.selectionStart || 0);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    
    if (mentionMatch) {
      setShowMentions(true);
      setMentionSearch(mentionMatch[1].toLowerCase());
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (username: string) => {
    const textBeforeCursor = newComment.substring(0, cursorPosition);
    const textAfterCursor = newComment.substring(cursorPosition);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    
    if (mentionMatch) {
      const newText = textBeforeCursor.replace(/@(\w*)$/, `@${username} `) + textAfterCursor;
      setNewComment(newText);
    }
    setShowMentions(false);
    inputRef.current?.focus();
  };

  const filteredAttendees = attendees.filter(
    (a) => a.user.username.toLowerCase().includes(mentionSearch) ||
           `${a.user.firstName} ${a.user.lastName}`.toLowerCase().includes(mentionSearch)
  );

  const renderContent = (content: string) => {
    // Replace @mentions with links
    return content.split(/(@\w+)/g).map((part, index) => {
      if (part.startsWith('@')) {
        const username = part.substring(1);
        return (
          <Link
            key={index}
            to={`/profile/${username}`}
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            {part}
          </Link>
        );
      }
      return part;
    });
  };

  const formatTime = (dateString: string) => {
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

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        💬 Discussion Wall
      </h3>

      {/* Comment Input */}
      <form onSubmit={handleSubmit} className="mb-4 relative">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={newComment}
              onChange={handleInputChange}
              placeholder="Write a comment... Use @username to mention someone"
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
            
            {/* Mention Dropdown */}
            {showMentions && filteredAttendees.length > 0 && (
              <div className="absolute bottom-full left-0 w-full bg-white border border-gray-200 rounded-lg shadow-lg mb-1 max-h-48 overflow-y-auto z-10">
                {filteredAttendees.slice(0, 5).map((attendee) => (
                  <button
                    key={attendee.userId}
                    type="button"
                    onClick={() => insertMention(attendee.user.username)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-100 text-left"
                  >
                    {attendee.user.profilePicture ? (
                      <img
                        src={`${attendee.user.profilePicture}`}
                        alt=""
                        className="w-6 h-6 rounded-full"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center">
                        <span className="text-primary-700 text-xs font-semibold">
                          {attendee.user.firstName[0]}
                        </span>
                      </div>
                    )}
                    <span className="font-medium">{attendee.user.firstName} {attendee.user.lastName}</span>
                    <span className="text-gray-400 text-sm">@{attendee.user.username}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={posting || !newComment.trim()}
            className="btn btn-primary self-end flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            {posting ? '...' : 'Post'}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          <AtSign className="w-3 h-3 inline" /> Type @ to mention attendees
        </p>
      </form>

      {/* Comments List */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No comments yet. Start the discussion!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <Link to={`/profile/${comment.user.username}`}>
                {comment.user.profilePicture ? (
                  <img
                    src={`${comment.user.profilePicture}`}
                    alt=""
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                    <span className="text-primary-700 font-semibold">
                      {comment.user.firstName[0]}
                    </span>
                  </div>
                )}
              </Link>
              <div className="flex-1">
                <div className="bg-gray-50 rounded-lg px-4 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <Link
                      to={`/profile/${comment.user.username}`}
                      className="font-semibold text-gray-900 hover:text-primary-600"
                    >
                      {comment.user.firstName} {comment.user.lastName}
                    </Link>
                    <span className="text-xs text-gray-400">{formatTime(comment.createdAt)}</span>
                  </div>
                  <p className="text-gray-700 whitespace-pre-wrap">{renderContent(comment.content)}</p>
                </div>
                {(comment.user.id === currentUserId || isOrganizer) && (
                  <button
                    onClick={() => handleDelete(comment.id)}
                    className="text-xs text-red-500 hover:text-red-700 mt-1 flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

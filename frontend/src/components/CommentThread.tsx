import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Edit2, Trash2, Pin, History, ChevronDown, ChevronUp, User } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { ReactionButton } from './ReactionPicker';
import { RenderMentions } from './MentionInput';
import MentionInput from './MentionInput';

interface CommentUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  profilePicture?: string;
}

interface Reply {
  id: string;
  content: string;
  userId: string;
  user: CommentUser;
  createdAt: string;
  updatedAt: string;
  editHistory?: { content: string; editedAt: string }[];
}

interface Comment {
  id: string;
  postId: string;
  content: string;
  imageUrl?: string;
  userId: string;
  user: CommentUser;
  createdAt: string;
  updatedAt: string;
  editHistory?: { content: string; editedAt: string }[];
  reactions?: any;
  replies?: Reply[];
  isPinned?: boolean;
}

interface CommentThreadProps {
  comment: Comment;
  postAuthorId: string;
  onUpdate: () => void;
}

export default function CommentThread({ comment, postAuthorId, onUpdate }: CommentThreadProps) {
  const { user } = useAuth();
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [submittingReply, setSubmittingReply] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [showHistory, setShowHistory] = useState(false);
  const [reactions, setReactions] = useState({ like: 0, love: 0, haha: 0, wow: 0, campy: 0, fire: 0 });
  const [userReactions, setUserReactions] = useState<string[]>([]);

  const isAuthor = user?.id === comment.userId;
  const isPostAuthor = user?.id === postAuthorId;
  const wasEdited = comment.editHistory && comment.editHistory.length > 0;

  useEffect(() => {
    loadReactions();
  }, [comment.id]);

  const loadReactions = async () => {
    try {
      const { data } = await api.get('/social/comments/' + comment.id + '/reactions');
      setReactions(data.summary);
      setUserReactions(data.reactions.filter((r: any) => r.userId === user?.id).map((r: any) => r.type));
    } catch (error) {
      console.error('Load reactions error:', error);
    }
  };

  const loadReplies = async () => {
    setLoadingReplies(true);
    try {
      const { data } = await api.get('/social/comments/' + comment.id + '/replies');
      setReplies(data);
    } catch (error) {
      console.error('Load replies error:', error);
    } finally {
      setLoadingReplies(false);
    }
  };

  const handleToggleReplies = () => {
    if (!showReplies && replies.length === 0) {
      loadReplies();
    }
    setShowReplies(!showReplies);
  };

  const handleSubmitReply = async () => {
    if (!replyContent.trim()) return;
    setSubmittingReply(true);
    try {
      await api.post('/social/comments/' + comment.id + '/replies', { content: replyContent });
      setReplyContent('');
      setShowReplyInput(false);
      loadReplies();
      setShowReplies(true);
    } catch (error) {
      console.error('Submit reply error:', error);
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleEdit = async () => {
    if (!editContent.trim()) return;
    try {
      await api.put('/social/comments/' + comment.id, { content: editContent });
      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error('Edit comment error:', error);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this comment?')) return;
    try {
      await api.delete('/comments/' + comment.id);
      onUpdate();
    } catch (error) {
      console.error('Delete comment error:', error);
    }
  };

  const handlePin = async () => {
    try {
      if (comment.isPinned) {
        await api.delete('/social/posts/' + comment.postId + '/pin-comment');
      } else {
        await api.post('/social/posts/' + comment.postId + '/pin-comment', { commentId: comment.id });
      }
      onUpdate();
    } catch (error) {
      console.error('Pin comment error:', error);
    }
  };

  return (
    <div className={'p-3 rounded-lg ' + (comment.isPinned ? 'bg-gold-50 border border-gold-200' : 'bg-gray-50')}>
      {comment.isPinned && (
        <div className="flex items-center gap-1 text-xs text-gold-600 mb-2">
          <Pin className="w-3 h-3" />
          <span>Pinned by post author</span>
        </div>
      )}
      
      <div className="flex gap-3">
        {/* Avatar */}
        <Link to={'/profile/' + comment.user.username} className="flex-shrink-0">
          {comment.user.profilePicture ? (
            <img
              src={comment.user.profilePicture.startsWith('http') ? comment.user.profilePicture : '' + comment.user.profilePicture}
              alt=""
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
              <User className="w-4 h-4 text-primary-600" />
            </div>
          )}
        </Link>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 flex-wrap">
            <Link to={'/profile/' + comment.user.username} className="font-medium text-gray-900 hover:text-primary-600 text-sm">
              {comment.user.firstName} {comment.user.lastName}
            </Link>
            <span className="text-xs text-gray-500">
              {new Date(comment.createdAt).toLocaleDateString()}
            </span>
            {wasEdited && (
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-0.5"
              >
                <History className="w-3 h-3" />
                (edited)
              </button>
            )}
          </div>

          {/* Content */}
          {isEditing ? (
            <div className="mt-2">
              <MentionInput
                value={editContent}
                onChange={setEditContent}
                rows={2}
                placeholder="Edit your comment..."
              />
              <div className="flex gap-2 mt-2">
                <button onClick={handleEdit} className="btn btn-primary btn-sm">Save</button>
                <button onClick={() => setIsEditing(false)} className="btn btn-secondary btn-sm">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="mt-1">
              <p className="text-sm text-gray-700">
                <RenderMentions content={comment.content} />
              </p>
              {comment.imageUrl && (
                <img
                  src={comment.imageUrl.startsWith('http') ? comment.imageUrl : '' + comment.imageUrl}
                  alt=""
                  className="mt-2 rounded-lg max-h-48 object-cover"
                />
              )}
            </div>
          )}

          {/* Edit History */}
          {showHistory && comment.editHistory && comment.editHistory.length > 0 && (
            <div className="mt-2 p-2 bg-gray-100 rounded text-xs">
              <p className="font-medium text-gray-600 mb-1">Edit History:</p>
              {comment.editHistory.map((edit, i) => (
                <div key={i} className="text-gray-500 py-1 border-t border-gray-200">
                  <span className="text-gray-400">{new Date(edit.editedAt).toLocaleString()}:</span>
                  <p className="text-gray-600">{edit.content}</p>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-4 mt-2">
            <ReactionButton
              commentId={comment.id}
              reactions={reactions}
              userReactions={userReactions}
              onReactionChange={loadReactions}
            />
            
            <button
              onClick={() => setShowReplyInput(!showReplyInput)}
              className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <MessageCircle className="w-3 h-3" />
              Reply
            </button>

            {isAuthor && (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                >
                  <Edit2 className="w-3 h-3" />
                  Edit
                </button>
                <button
                  onClick={handleDelete}
                  className="text-xs text-gray-500 hover:text-red-600 flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  Delete
                </button>
              </>
            )}

            {isPostAuthor && (
              <button
                onClick={handlePin}
                className={'text-xs flex items-center gap-1 ' + (comment.isPinned ? 'text-gold-600' : 'text-gray-500 hover:text-gold-600')}
              >
                <Pin className="w-3 h-3" />
                {comment.isPinned ? 'Unpin' : 'Pin'}
              </button>
            )}
          </div>

          {/* Reply Input */}
          {showReplyInput && (
            <div className="mt-3">
              <MentionInput
                value={replyContent}
                onChange={setReplyContent}
                rows={2}
                placeholder="Write a reply..."
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleSubmitReply}
                  disabled={submittingReply || !replyContent.trim()}
                  className="btn btn-primary btn-sm"
                >
                  {submittingReply ? 'Posting...' : 'Reply'}
                </button>
                <button
                  onClick={() => { setShowReplyInput(false); setReplyContent(''); }}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Replies */}
          {replies.length > 0 && (
            <button
              onClick={handleToggleReplies}
              className="text-xs text-primary-600 hover:text-primary-700 mt-2 flex items-center gap-1"
            >
              {showReplies ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
            </button>
          )}

          {showReplies && (
            <div className="mt-2 ml-4 border-l-2 border-gray-200 pl-3 space-y-3">
              {loadingReplies ? (
                <p className="text-xs text-gray-500">Loading replies...</p>
              ) : (
                replies.map(reply => (
                  <ReplyItem key={reply.id} reply={reply} onUpdate={loadReplies} />
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Reply Item Component
function ReplyItem({ reply, onUpdate }: { reply: Reply; onUpdate: () => void }) {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(reply.content);
  const isAuthor = user?.id === reply.userId;
  const wasEdited = reply.editHistory && reply.editHistory.length > 0;

  const handleEdit = async () => {
    if (!editContent.trim()) return;
    try {
      await api.put('/social/replies/' + reply.id, { content: editContent });
      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error('Edit reply error:', error);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this reply?')) return;
    try {
      await api.delete('/social/replies/' + reply.id);
      onUpdate();
    } catch (error) {
      console.error('Delete reply error:', error);
    }
  };

  return (
    <div className="flex gap-2">
      <Link to={'/profile/' + reply.user.username} className="flex-shrink-0">
        {reply.user.profilePicture ? (
          <img
            src={reply.user.profilePicture.startsWith('http') ? reply.user.profilePicture : '' + reply.user.profilePicture}
            alt=""
            className="w-6 h-6 rounded-full object-cover"
          />
        ) : (
          <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
            <User className="w-3 h-3 text-gray-500" />
          </div>
        )}
      </Link>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Link to={'/profile/' + reply.user.username} className="font-medium text-xs text-gray-900 hover:text-primary-600">
            {reply.user.firstName} {reply.user.lastName}
          </Link>
          <span className="text-xs text-gray-400">
            {new Date(reply.createdAt).toLocaleDateString()}
          </span>
          {wasEdited && <span className="text-xs text-gray-400">(edited)</span>}
        </div>
        
        {isEditing ? (
          <div className="mt-1">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded p-2"
              rows={2}
            />
            <div className="flex gap-2 mt-1">
              <button onClick={handleEdit} className="text-xs text-primary-600">Save</button>
              <button onClick={() => setIsEditing(false)} className="text-xs text-gray-500">Cancel</button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-700 mt-0.5">
            <RenderMentions content={reply.content} />
          </p>
        )}

        {isAuthor && !isEditing && (
          <div className="flex gap-3 mt-1">
            <button onClick={() => setIsEditing(true)} className="text-xs text-gray-400 hover:text-gray-600">Edit</button>
            <button onClick={handleDelete} className="text-xs text-gray-400 hover:text-red-500">Delete</button>
          </div>
        )}
      </div>
    </div>
  );
}

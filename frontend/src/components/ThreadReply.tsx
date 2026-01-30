import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronUp, ChevronDown, MessageSquare, Trash2, CornerDownRight } from 'lucide-react';
import MentionText from './MentionText';
import MentionInput from './MentionInput';
import api from '../services/api';

interface ThreadPost {
  id: string;
  content: string;
  imageUrl?: string;
  parentId: string | null;
  createdAt: string;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture?: string;
  };
  _count: {
    replies: number;
  };
  upvotes: number;
  downvotes: number;
  userVote: 'UP' | 'DOWN' | null;
  replies?: ThreadPost[];
}

interface ThreadReplyProps {
  post: ThreadPost;
  threadId: string;
  depth: number;
  userId?: string;
  isLocked: boolean;
  onVote: (postId: string, voteType: 'UP' | 'DOWN') => void;
  onDelete: (postId: string) => void;
  onReply: (parentId: string, content: string) => Promise<void>;
  formatDate: (date: string) => string;
}

export default function ThreadReply({
  post,
  threadId,
  depth,
  userId,
  isLocked,
  onVote,
  onDelete,
  onReply,
  formatDate
}: ThreadReplyProps) {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [collapsed, setCollapsed] = useState(depth > 3);

  const handleSubmitReply = async () => {
    if (!replyContent.trim()) return;
    setSubmitting(true);
    try {
      await onReply(post.id, replyContent);
      setReplyContent('');
      setShowReplyInput(false);
    } finally {
      setSubmitting(false);
    }
  };

  const score = post.upvotes - post.downvotes;
  const maxDepth = 10;
  const indentPx = Math.min(depth * 24, maxDepth * 24);

  return (
    <div 
      className={`border-l-2 ${depth % 2 === 0 ? 'border-gray-200' : 'border-gray-300'}`}
      style={{ marginLeft: depth > 0 ? '12px' : '0' }}
    >
      <div className="py-2 px-3 hover:bg-gray-50">
        {/* Collapsed view */}
        {collapsed ? (
          <button
            onClick={() => setCollapsed(false)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
          >
            <CornerDownRight className="w-4 h-4" />
            <span className="font-medium">{post.author.firstName} {post.author.lastName}</span>
            <span>• {post._count.replies} replies</span>
            <span className="text-xs">[+] expand</span>
          </button>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start gap-2">
              {/* Vote buttons */}
              <div className="flex flex-col items-center gap-0.5 pt-1">
                <button
                  onClick={() => onVote(post.id, 'UP')}
                  disabled={!userId}
                  className={`p-0.5 rounded hover:bg-gray-200 transition ${
                    post.userVote === 'UP' ? 'text-orange-500' : 'text-gray-400'
                  }`}
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <span className={`text-xs font-medium ${
                  score > 0 ? 'text-orange-500' : score < 0 ? 'text-blue-500' : 'text-gray-500'
                }`}>
                  {score}
                </span>
                <button
                  onClick={() => onVote(post.id, 'DOWN')}
                  disabled={!userId}
                  className={`p-0.5 rounded hover:bg-gray-200 transition ${
                    post.userVote === 'DOWN' ? 'text-blue-500' : 'text-gray-400'
                  }`}
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs">
                  <Link to={`/profile/${post.author.username}`} className="flex items-center gap-1.5">
                    {post.author.profilePicture ? (
                      <img src={post.author.profilePicture} alt="" className="w-5 h-5 rounded-full" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-primary-100 flex items-center justify-center">
                        <span className="text-primary-700 font-semibold text-xs">
                          {post.author.firstName[0]}
                        </span>
                      </div>
                    )}
                    <span className="font-medium text-gray-900 hover:text-primary-600">
                      {post.author.firstName} {post.author.lastName}
                    </span>
                  </Link>
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-500">{formatDate(post.createdAt)}</span>
                  {depth > 3 && (
                    <button
                      onClick={() => setCollapsed(true)}
                      className="text-gray-400 hover:text-gray-600 ml-2"
                    >
                      [-]
                    </button>
                  )}
                </div>

                <div className="mt-1">
                  <MentionText content={post.content} />
                </div>

                {post.imageUrl && (
                  <img src={post.imageUrl} alt="" className="mt-2 rounded max-h-48 object-cover" />
                )}

                {/* Actions */}
                <div className="flex items-center gap-4 mt-2">
                  {!isLocked && userId && (
                    <button
                      onClick={() => setShowReplyInput(!showReplyInput)}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                    >
                      <MessageSquare className="w-3 h-3" />
                      Reply
                    </button>
                  )}
                  {userId === post.author.id && (
                    <button
                      onClick={() => onDelete(post.id)}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </button>
                  )}
                </div>

                {/* Reply Input */}
                {showReplyInput && (
                  <div className="mt-2 space-y-2">
                    <MentionInput
                      value={replyContent}
                      onChange={setReplyContent}
                      placeholder={`Reply to ${post.author.firstName}...`}
                      className="text-sm"
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSubmitReply}
                        disabled={submitting || !replyContent.trim()}
                        className="px-3 py-1 bg-primary-600 text-white text-xs rounded hover:bg-primary-700 disabled:opacity-50"
                      >
                        {submitting ? 'Posting...' : 'Reply'}
                      </button>
                      <button
                        onClick={() => {
                          setShowReplyInput(false);
                          setReplyContent('');
                        }}
                        className="px-3 py-1 text-gray-600 text-xs hover:text-gray-800"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Nested Replies */}
            {post.replies && post.replies.length > 0 && (
              <div className="mt-2">
                {post.replies.map(reply => (
                  <ThreadReply
                    key={reply.id}
                    post={reply}
                    threadId={threadId}
                    depth={depth + 1}
                    userId={userId}
                    isLocked={isLocked}
                    onVote={onVote}
                    onDelete={onDelete}
                    onReply={onReply}
                    formatDate={formatDate}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

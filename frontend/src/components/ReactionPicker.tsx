import { useState } from 'react';
import api from '../services/api';

interface ReactionSummary {
  like: number;
  love: number;
  haha: number;
  wow: number;
  campy: number;
  fire: number;
}

interface ReactionPickerProps {
  postId?: string;
  commentId?: string;
  reactions: ReactionSummary;
  userReactions?: string[];
  onReactionChange?: () => void;
}

const REACTIONS = [
  { type: 'like', emoji: '👍', label: 'Like' },
  { type: 'love', emoji: '❤️', label: 'Love' },
  { type: 'haha', emoji: '😂', label: 'Haha' },
  { type: 'wow', emoji: '😮', label: 'Wow' },
  { type: 'campy', emoji: '🏕️', label: 'Campy' },
  { type: 'fire', emoji: '🔥', label: 'Fire' },
];

export default function ReactionPicker({
  postId,
  commentId,
  reactions,
  userReactions = [],
  onReactionChange
}: ReactionPickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const totalReactions = Object.values(reactions).reduce((a, b) => a + b, 0);

  const handleReaction = async (type: string) => {
    setLoading(true);
    try {
      const endpoint = postId 
        ? `/social/posts/${postId}/reactions`
        : `/social/comments/${commentId}/reactions`;
      
      await api.post(endpoint, { type });
      onReactionChange?.();
    } catch (error) {
      console.error('Reaction error:', error);
    } finally {
      setLoading(false);
      setShowPicker(false);
    }
  };

  // Get top 3 reactions to display
  const topReactions = REACTIONS
    .filter(r => reactions[r.type as keyof ReactionSummary] > 0)
    .sort((a, b) => reactions[b.type as keyof ReactionSummary] - reactions[a.type as keyof ReactionSummary])
    .slice(0, 3);

  return (
    <div className="relative inline-flex items-center">
      {/* Reaction button */}
      <button
        onMouseEnter={() => setShowPicker(true)}
        onMouseLeave={() => setShowPicker(false)}
        onClick={() => handleReaction('like')}
        disabled={loading}
        className={`flex items-center gap-1 text-sm transition-colors ${
          userReactions.length > 0 
            ? 'text-primary-600 font-medium' 
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        {userReactions.length > 0 ? (
          <span>{REACTIONS.find(r => r.type === userReactions[0])?.emoji || '👍'}</span>
        ) : (
          <span>👍</span>
        )}
        <span>React</span>
      </button>

      {/* Reaction summary */}
      {totalReactions > 0 && (
        <div className="ml-2 flex items-center gap-0.5">
          {topReactions.map(r => (
            <span key={r.type} className="text-sm">{r.emoji}</span>
          ))}
          <span className="text-sm text-gray-500 ml-1">{totalReactions}</span>
        </div>
      )}

      {/* Picker popup */}
      {showPicker && (
        <div 
          className="absolute bottom-full left-0 mb-2 bg-white rounded-full shadow-lg border border-gray-200 p-1 flex gap-1 z-50"
          onMouseEnter={() => setShowPicker(true)}
          onMouseLeave={() => setShowPicker(false)}
        >
          {REACTIONS.map(reaction => (
            <button
              key={reaction.type}
              onClick={() => handleReaction(reaction.type)}
              disabled={loading}
              className={`w-9 h-9 rounded-full flex items-center justify-center text-xl hover:bg-gray-100 hover:scale-125 transition-all ${
                userReactions.includes(reaction.type) ? 'bg-primary-100' : ''
              }`}
              title={reaction.label}
            >
              {reaction.emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Compact version for comments
export function ReactionButton({
  postId,
  commentId,
  reactions,
  userReactions = [],
  onReactionChange
}: ReactionPickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleReaction = async (type: string) => {
    setLoading(true);
    try {
      const endpoint = postId 
        ? `/social/posts/${postId}/reactions`
        : `/social/comments/${commentId}/reactions`;
      
      await api.post(endpoint, { type });
      onReactionChange?.();
    } catch (error) {
      console.error('Reaction error:', error);
    } finally {
      setLoading(false);
      setShowPicker(false);
    }
  };

  const totalReactions = Object.values(reactions).reduce((a, b) => a + b, 0);

  return (
    <div className="relative inline-block">
      <button
        onMouseEnter={() => setShowPicker(true)}
        onMouseLeave={() => setShowPicker(false)}
        onClick={() => handleReaction('like')}
        disabled={loading}
        className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
      >
        {totalReactions > 0 && (
          <span className="flex items-center gap-0.5">
            {REACTIONS.filter(r => reactions[r.type as keyof ReactionSummary] > 0)
              .slice(0, 2)
              .map(r => <span key={r.type}>{r.emoji}</span>)}
            <span className="ml-0.5">{totalReactions}</span>
          </span>
        )}
        {totalReactions === 0 && <span>React</span>}
      </button>

      {showPicker && (
        <div 
          className="absolute bottom-full left-0 mb-1 bg-white rounded-full shadow-lg border border-gray-200 p-0.5 flex gap-0.5 z-50"
          onMouseEnter={() => setShowPicker(true)}
          onMouseLeave={() => setShowPicker(false)}
        >
          {REACTIONS.map(reaction => (
            <button
              key={reaction.type}
              onClick={() => handleReaction(reaction.type)}
              disabled={loading}
              className="w-7 h-7 rounded-full flex items-center justify-center text-base hover:bg-gray-100 hover:scale-110 transition-all"
              title={reaction.label}
            >
              {reaction.emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

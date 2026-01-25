import React, { useState } from 'react';
import { Heart, Flame, Laugh, ThumbsUp, Sparkles } from 'lucide-react';

interface ReactionCounts {
  LIKE?: number;
  FIRE?: number;
  LAUGH?: number;
  CLAP?: number;
  HEART?: number;
}

interface PhotoReactionsProps {
  photoId: string;
  reactionCounts: ReactionCounts;
  userReactions: string[];
  totalReactions: number;
  onReact: (photoId: string, type: string) => void;
  compact?: boolean;
}

const REACTIONS = [
  { type: 'LIKE', icon: ThumbsUp, emoji: '👍', label: 'Like', color: 'text-blue-500' },
  { type: 'HEART', icon: Heart, emoji: '❤️', label: 'Love', color: 'text-red-500' },
  { type: 'FIRE', icon: Flame, emoji: '🔥', label: 'Fire', color: 'text-orange-500' },
  { type: 'LAUGH', icon: Laugh, emoji: '😂', label: 'Haha', color: 'text-yellow-500' },
  { type: 'CLAP', icon: Sparkles, emoji: '👏', label: 'Clap', color: 'text-purple-500' },
];

export const PhotoReactions: React.FC<PhotoReactionsProps> = ({
  photoId,
  reactionCounts,
  userReactions,
  totalReactions,
  onReact,
  compact = false,
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [isAnimating, setIsAnimating] = useState<string | null>(null);

  const handleReact = (type: string) => {
    setIsAnimating(type);
    onReact(photoId, type);
    setShowPicker(false);
    setTimeout(() => setIsAnimating(null), 300);
  };

  // Get the primary reaction to display (user's or most popular)
  const getPrimaryReaction = () => {
    if (userReactions.length > 0) {
      return REACTIONS.find(r => r.type === userReactions[0]);
    }
    // Find most popular reaction
    let maxCount = 0;
    let maxType = 'LIKE';
    Object.entries(reactionCounts).forEach(([type, count]) => {
      if (count && count > maxCount) {
        maxCount = count;
        maxType = type;
      }
    });
    return REACTIONS.find(r => r.type === maxType) || REACTIONS[0];
  };

  const primaryReaction = getPrimaryReaction();
  const hasReacted = userReactions.length > 0;

  if (compact) {
    // Compact mode: just show reaction emojis with counts
    return (
      <div className="flex items-center gap-1">
        {REACTIONS.map(reaction => {
          const count = reactionCounts[reaction.type as keyof ReactionCounts] || 0;
          if (count === 0 && !userReactions.includes(reaction.type)) return null;
          
          return (
            <button
              key={reaction.type}
              onClick={() => handleReact(reaction.type)}
              className={`
                flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs
                ${userReactions.includes(reaction.type) 
                  ? 'bg-blue-100 text-blue-600' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }
                transition-all duration-200
                ${isAnimating === reaction.type ? 'scale-125' : ''}
              `}
            >
              <span>{reaction.emoji}</span>
              {count > 0 && <span>{count}</span>}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Main reaction button */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => hasReacted ? handleReact(userReactions[0]) : setShowPicker(!showPicker)}
          onMouseEnter={() => !hasReacted && setShowPicker(true)}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-full
            ${hasReacted 
              ? `bg-blue-50 ${primaryReaction?.color} border border-blue-200` 
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }
            transition-all duration-200
            ${isAnimating ? 'scale-110' : ''}
          `}
        >
          {primaryReaction && (
            <>
              <span className="text-lg">{primaryReaction.emoji}</span>
              <span className="text-sm font-medium">
                {hasReacted ? primaryReaction.label : 'React'}
              </span>
            </>
          )}
        </button>

        {totalReactions > 0 && (
          <span className="text-sm text-gray-500">
            {totalReactions} {totalReactions === 1 ? 'reaction' : 'reactions'}
          </span>
        )}
      </div>

      {/* Reaction picker */}
      {showPicker && (
        <div 
          className="absolute bottom-full left-0 mb-2 flex gap-1 bg-white rounded-full shadow-lg p-1.5 border border-gray-200 z-50"
          onMouseLeave={() => setShowPicker(false)}
        >
          {REACTIONS.map(reaction => (
            <button
              key={reaction.type}
              onClick={() => handleReact(reaction.type)}
              title={reaction.label}
              className={`
                w-10 h-10 flex items-center justify-center rounded-full text-2xl
                hover:bg-gray-100 hover:scale-125 transition-all duration-200
                ${userReactions.includes(reaction.type) ? 'bg-blue-50 ring-2 ring-blue-300' : ''}
              `}
            >
              {reaction.emoji}
            </button>
          ))}
        </div>
      )}

      {/* Reaction breakdown (shows on hover or when expanded) */}
      {totalReactions > 0 && (
        <div className="flex items-center gap-1 mt-1">
          {REACTIONS.map(reaction => {
            const count = reactionCounts[reaction.type as keyof ReactionCounts] || 0;
            if (count === 0) return null;
            
            return (
              <span
                key={reaction.type}
                className="flex items-center text-sm text-gray-500"
                title={`${count} ${reaction.label}`}
              >
                <span>{reaction.emoji}</span>
                <span className="ml-0.5">{count}</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Hook for managing photo reactions
export function usePhotoReactions() {
  const [loading, setLoading] = useState(false);

  const react = async (photoId: string, type: string): Promise<{ added: boolean; reactionCounts: ReactionCounts; totalReactions: number } | null> => {
    setLoading(true);
    try {
      const response = await fetch(`/api/photos/${photoId}/react`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ type })
      });

      if (!response.ok) throw new Error('Failed to react');
      
      return await response.json();
    } catch (error) {
      console.error('Error reacting to photo:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { react, loading };
}

export default PhotoReactions;

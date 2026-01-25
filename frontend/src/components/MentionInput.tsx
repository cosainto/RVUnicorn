import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { User, MapPin } from 'lucide-react';
import api from '../services/api';

interface MentionUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  profilePicture?: string;
}

interface MentionCampground {
  id: string;
  name: string;
  slug: string;
  state: string;
  location?: string;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  disabled?: boolean;
}

export default function MentionInput({
  value,
  onChange,
  placeholder = "What's on your mind?",
  rows = 3,
  className = '',
  disabled = false,
}: MentionInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionType, setSuggestionType] = useState<'user' | 'campground' | null>(null);
  const [suggestions, setSuggestions] = useState<(MentionUser | MentionCampground)[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Detect @ or # and search
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const pos = cursorPosition;
    const textBeforeCursor = value.substring(0, pos);
    
    // Find the last @ or # before cursor
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    const lastHashIndex = textBeforeCursor.lastIndexOf('#');
    
    // Check if we're in a mention context (no space after @ or #)
    const isInUserMention = lastAtIndex !== -1 && 
      !textBeforeCursor.substring(lastAtIndex).includes(' ') &&
      lastAtIndex > lastHashIndex;
    
    const isInCampgroundMention = lastHashIndex !== -1 && 
      !textBeforeCursor.substring(lastHashIndex).includes(' ') &&
      lastHashIndex > lastAtIndex;

    if (isInUserMention) {
      const query = textBeforeCursor.substring(lastAtIndex + 1);
      setSuggestionType('user');
      searchUsers(query);
    } else if (isInCampgroundMention) {
      const query = textBeforeCursor.substring(lastHashIndex + 1);
      setSuggestionType('campground');
      searchCampgrounds(query);
    } else {
      setShowSuggestions(false);
      setSuggestions([]);
    }
  }, [value, cursorPosition]);

  const searchUsers = async (query: string) => {
    if (query.length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const { data } = await api.get(`/mentions/search/users?q=${encodeURIComponent(query)}`);
      setSuggestions(data);
      setShowSuggestions(data.length > 0);
      setSelectedIndex(0);
    } catch (error) {
      console.error('Search users error:', error);
    }
  };

  const searchCampgrounds = async (query: string) => {
    if (query.length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const { data } = await api.get(`/mentions/search/campgrounds?q=${encodeURIComponent(query)}`);
      setSuggestions(data);
      setShowSuggestions(data.length > 0);
      setSelectedIndex(0);
    } catch (error) {
      console.error('Search campgrounds error:', error);
    }
  };

  const insertMention = (suggestion: MentionUser | MentionCampground) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const pos = cursorPosition;
    const textBeforeCursor = value.substring(0, pos);
    
    let startIndex: number;
    let mentionText: string;

    if (suggestionType === 'user') {
      startIndex = textBeforeCursor.lastIndexOf('@');
      mentionText = `@${(suggestion as MentionUser).username} `;
    } else {
      startIndex = textBeforeCursor.lastIndexOf('#');
      mentionText = `#${(suggestion as MentionCampground).slug} `;
    }

    const newValue = 
      value.substring(0, startIndex) + 
      mentionText + 
      value.substring(pos);

    onChange(newValue);
    setShowSuggestions(false);
    setSuggestions([]);

    // Set cursor after the mention
    setTimeout(() => {
      const newCursorPos = startIndex + mentionText.length;
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      setCursorPosition(newCursorPos);
    }, 0);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter' && showSuggestions) {
      e.preventDefault();
      insertMention(suggestions[selectedIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    setCursorPosition(e.target.selectionStart || 0);
  };

  const handleClick = () => {
    if (textareaRef.current) {
      setCursorPosition(textareaRef.current.selectionStart || 0);
    }
  };

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        onKeyUp={handleClick}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className={`w-full resize-none border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-primary-500 focus:border-transparent ${className}`}
      />

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={'id' in suggestion ? suggestion.id : index}
              type="button"
              onClick={() => insertMention(suggestion)}
              className={`w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-gray-50 ${
                index === selectedIndex ? 'bg-primary-50' : ''
              }`}
            >
              {suggestionType === 'user' ? (
                <>
                  {(suggestion as MentionUser).profilePicture ? (
                    <img
                      src={(suggestion as MentionUser).profilePicture}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                      <User className="w-4 h-4 text-primary-600" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-gray-900">
                      {(suggestion as MentionUser).firstName} {(suggestion as MentionUser).lastName}
                    </p>
                    <p className="text-sm text-gray-500">@{(suggestion as MentionUser).username}</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{(suggestion as MentionCampground).name}</p>
                    <p className="text-sm text-gray-500">
                      {(suggestion as MentionCampground).location}, {(suggestion as MentionCampground).state}
                    </p>
                  </div>
                </>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Helper text */}
      <p className="text-xs text-gray-400 mt-1">
        Type <span className="font-mono bg-gray-100 px-1 rounded">@</span> to mention users or{' '}
        <span className="font-mono bg-gray-100 px-1 rounded">#</span> to tag campgrounds
      </p>
    </div>
  );
}

// Helper component to render content with clickable mentions
export function RenderMentions({ content }: { content: string }) {
  if (!content) return null;
  
  // Parse @username mentions and #campground tags
  const parts = content.split(/(@\w+|#\w+)/g);

  return (
    <span>
      {parts.map((part, index) => {
        if (part.startsWith('@')) {
          const username = part.substring(1);
          return (
            <a
              key={index}
              href={`/profile/${username}`}
              className="text-primary-600 hover:text-primary-700 font-medium"
              onClick={(e) => e.stopPropagation()}
            >
              {part}
            </a>
          );
        } else if (part.startsWith('#')) {
          const slug = part.substring(1);
          return (
            <a
              key={index}
              href={`/campgrounds/${slug}`}
              className="text-green-600 hover:text-green-700 font-medium"
              onClick={(e) => e.stopPropagation()}
            >
              {part}
            </a>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
}

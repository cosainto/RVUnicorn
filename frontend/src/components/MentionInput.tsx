import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { User, Tent } from 'lucide-react';
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
  customSlug?: string;
  state: string;
  location?: string;
  imageUrl?: string;
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
  placeholder = "What's on your mind? Type @ to mention people or campgrounds",
  rows = 3,
  className = '',
  disabled = false,
}: MentionInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [userSuggestions, setUserSuggestions] = useState<MentionUser[]>([]);
  const [campgroundSuggestions, setCampgroundSuggestions] = useState<MentionCampground[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const allSuggestions = [
    ...userSuggestions.map(u => ({ type: 'user' as const, data: u })),
    ...campgroundSuggestions.map(c => ({ type: 'campground' as const, data: c })),
  ];

  useEffect(() => {
    const pos = cursorPosition;
    const textBeforeCursor = value.substring(0, pos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    const isInMention = lastAtIndex !== -1 && !textBeforeCursor.substring(lastAtIndex).includes(' ');

    if (isInMention) {
      const query = textBeforeCursor.substring(lastAtIndex + 1);
      searchAll(query);
    } else {
      setShowSuggestions(false);
      setUserSuggestions([]);
      setCampgroundSuggestions([]);
    }
  }, [value, cursorPosition]);

  const searchAll = async (query: string) => {
    if (query.length < 1) {
      setUserSuggestions([]);
      setCampgroundSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const [usersRes, campgroundsRes] = await Promise.all([
        api.get('/mentions/search/users?q=' + encodeURIComponent(query)),
        api.get('/mentions/search/campgrounds?q=' + encodeURIComponent(query)),
      ]);

      setUserSuggestions(usersRes.data || []);
      setCampgroundSuggestions(campgroundsRes.data || []);
      
      const hasResults = (usersRes.data?.length || 0) + (campgroundsRes.data?.length || 0) > 0;
      setShowSuggestions(hasResults);
      setSelectedIndex(0);
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  const insertMention = (type: 'user' | 'campground', suggestion: MentionUser | MentionCampground) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const pos = cursorPosition;
    const textBeforeCursor = value.substring(0, pos);
    const startIndex = textBeforeCursor.lastIndexOf('@');
    
    let mentionText: string;
    if (type === 'user') {
      mentionText = '@' + (suggestion as MentionUser).username + ' ';
    } else {
      mentionText = '@[' + (suggestion as MentionCampground).name + '] ';
    }

    const newValue = value.substring(0, startIndex) + mentionText + value.substring(pos);
    onChange(newValue);
    setShowSuggestions(false);
    setUserSuggestions([]);
    setCampgroundSuggestions([]);

    setTimeout(() => {
      const newCursorPos = startIndex + mentionText.length;
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      setCursorPosition(newCursorPos);
    }, 0);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggestions || allSuggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % allSuggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + allSuggestions.length) % allSuggestions.length);
    } else if (e.key === 'Enter' && showSuggestions) {
      e.preventDefault();
      const selected = allSuggestions[selectedIndex];
      insertMention(selected.type, selected.data);
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

  let currentIndex = 0;

  return React.createElement('div', { className: 'relative' },
    React.createElement('textarea', {
      ref: textareaRef,
      value: value,
      onChange: handleChange,
      onKeyDown: handleKeyDown,
      onClick: handleClick,
      onKeyUp: handleClick,
      placeholder: placeholder,
      rows: rows,
      disabled: disabled,
      className: 'w-full resize-none border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-primary-500 focus:border-transparent ' + className
    }),
    showSuggestions && allSuggestions.length > 0 && React.createElement('div', {
      ref: suggestionsRef,
      className: 'absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-y-auto'
    },
      userSuggestions.length > 0 && React.createElement('div', null,
        React.createElement('div', { className: 'px-3 py-2 bg-gray-50 border-b border-gray-100' },
          React.createElement('span', { className: 'text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1' },
            React.createElement(User, { className: 'w-3 h-3' }), ' People'
          )
        ),
        userSuggestions.map((user) => {
          const idx = currentIndex++;
          return React.createElement('button', {
            key: 'user-' + user.id,
            type: 'button',
            onClick: () => insertMention('user', user),
            className: 'w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-gray-50 ' + (idx === selectedIndex ? 'bg-primary-50' : '')
          },
            user.profilePicture
              ? React.createElement('img', { src: user.profilePicture.startsWith('http') ? user.profilePicture : 'http://127.0.0.1:3001' + user.profilePicture, alt: '', className: 'w-8 h-8 rounded-full object-cover' })
              : React.createElement('div', { className: 'w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center' },
                  React.createElement(User, { className: 'w-4 h-4 text-primary-600' })
                ),
            React.createElement('div', null,
              React.createElement('p', { className: 'font-medium text-gray-900' }, user.firstName + ' ' + user.lastName),
              React.createElement('p', { className: 'text-sm text-gray-500' }, '@' + user.username)
            )
          );
        })
      ),
      campgroundSuggestions.length > 0 && React.createElement('div', null,
        React.createElement('div', { className: 'px-3 py-2 bg-gray-50 border-b border-gray-100' },
          React.createElement('span', { className: 'text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1' },
            React.createElement(Tent, { className: 'w-3 h-3' }), ' Campgrounds'
          )
        ),
        campgroundSuggestions.map((campground) => {
          const idx = currentIndex++;
          return React.createElement('button', {
            key: 'cg-' + campground.id,
            type: 'button',
            onClick: () => insertMention('campground', campground),
            className: 'w-full px-4 py-2 text-left flex items-center gap-3 hover:bg-gray-50 ' + (idx === selectedIndex ? 'bg-primary-50' : '')
          },
            campground.imageUrl
              ? React.createElement('img', { src: campground.imageUrl.startsWith('http') ? campground.imageUrl : 'http://127.0.0.1:3001' + campground.imageUrl, alt: '', className: 'w-8 h-8 rounded-lg object-cover' })
              : React.createElement('div', { className: 'w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center' },
                  React.createElement(Tent, { className: 'w-4 h-4 text-green-600' })
                ),
            React.createElement('div', null,
              React.createElement('p', { className: 'font-medium text-gray-900' }, campground.name),
              React.createElement('p', { className: 'text-sm text-gray-500' }, campground.location || campground.state)
            )
          );
        })
      )
    ),
    React.createElement('p', { className: 'text-xs text-gray-400 mt-1' },
      'Type ', React.createElement('span', { className: 'font-mono bg-gray-100 px-1 rounded' }, '@'), ' to mention people or campgrounds'
    )
  );
}

export function RenderMentions({ content }: { content: string }) {
  if (!content) return null;
  
  const result: JSX.Element[] = [];
  let remaining = content;
  let keyCounter = 0;
  
  while (remaining.length > 0) {
    // Check for campground mention @[Name]
    const bracketMatch = remaining.match(/^@\[([^\]]+)\]/);
    if (bracketMatch) {
      const campgroundName = bracketMatch[1];
      result.push(
        React.createElement('a', {
          key: keyCounter++,
          href: '/campgrounds?search=' + encodeURIComponent(campgroundName),
          className: 'text-green-600 hover:text-green-700 font-medium',
          onClick: (e: React.MouseEvent) => e.stopPropagation()
        }, '🏕️ ' + campgroundName)
      );
      remaining = remaining.substring(bracketMatch[0].length);
      continue;
    }
    
    // Check for hashtag #tag
    const hashtagMatch = remaining.match(/^#(\w+)/);
    if (hashtagMatch) {
      const tag = hashtagMatch[1];
      result.push(
        React.createElement('a', {
          key: keyCounter++,
          href: '/hashtag/' + tag.toLowerCase(),
          className: 'text-primary-600 hover:text-primary-700 font-medium',
          onClick: (e: React.MouseEvent) => e.stopPropagation()
        }, '#' + tag)
      );
      remaining = remaining.substring(hashtagMatch[0].length);
      continue;
    }
    
    // Check for user mention @username
    const userMatch = remaining.match(/^@(\w+)/);
    if (userMatch) {
      const username = userMatch[1];
      result.push(
        React.createElement('a', {
          key: keyCounter++,
          href: '/profile/' + username,
          className: 'text-primary-600 hover:text-primary-700 font-medium',
          onClick: (e: React.MouseEvent) => e.stopPropagation()
        }, '@' + username)
      );
      remaining = remaining.substring(userMatch[0].length);
      continue;
    }
    
    // Find next special character (@ or #)
    const nextAt = remaining.indexOf('@', 1);
    const nextHash = remaining.indexOf('#', 1);
    let nextSpecial = -1;
    if (nextAt === -1 && nextHash === -1) {
      nextSpecial = -1;
    } else if (nextAt === -1) {
      nextSpecial = nextHash;
    } else if (nextHash === -1) {
      nextSpecial = nextAt;
    } else {
      nextSpecial = Math.min(nextAt, nextHash);
    }
    
    if (nextSpecial === -1) {
      result.push(React.createElement('span', { key: keyCounter++ }, remaining));
      break;
    } else {
      result.push(React.createElement('span', { key: keyCounter++ }, remaining.substring(0, nextSpecial)));
      remaining = remaining.substring(nextSpecial);
    }
  }
  
  return React.createElement('span', null, result);
}

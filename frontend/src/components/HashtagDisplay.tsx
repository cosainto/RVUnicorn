import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Hash, TrendingUp } from 'lucide-react';
import api from '../services/api';

// Render content with clickable hashtags
export function RenderHashtags({ content }: { content: string }) {
  if (!content) return null;

  const parts: JSX.Element[] = [];
  const hashtagRegex = /#(\w+)/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = hashtagRegex.exec(content)) !== null) {
    // Add text before hashtag
    if (match.index > lastIndex) {
      parts.push(React.createElement('span', { key: key++ }, content.substring(lastIndex, match.index)));
    }

    // Add hashtag link
    const tag = match[1];
    parts.push(
      React.createElement(Link, {
        key: key++,
        to: '/hashtag/' + tag.toLowerCase(),
        className: 'text-primary-600 hover:text-primary-700 font-medium',
        onClick: (e: React.MouseEvent) => e.stopPropagation()
      }, '#' + tag)
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(React.createElement('span', { key: key++ }, content.substring(lastIndex)));
  }

  return React.createElement('span', null, parts);
}

// Trending hashtags sidebar widget
export function TrendingHashtags() {
  const [hashtags, setHashtags] = useState<{ id: string; tag: string; postCount: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTrending();
  }, []);

  const loadTrending = async () => {
    try {
      const { data } = await api.get('/social/hashtags/trending');
      setHashtags(data.slice(0, 10));
    } catch (error) {
      console.error('Load trending error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return React.createElement('div', { className: 'bg-white rounded-lg shadow p-4' },
      React.createElement('div', { className: 'animate-pulse space-y-2' },
        React.createElement('div', { className: 'h-4 bg-gray-200 rounded w-1/2' }),
        React.createElement('div', { className: 'h-3 bg-gray-100 rounded w-3/4' }),
        React.createElement('div', { className: 'h-3 bg-gray-100 rounded w-2/3' })
      )
    );
  }

  if (hashtags.length === 0) {
    return null;
  }

  return React.createElement('div', { className: 'bg-white rounded-lg shadow p-4' },
    React.createElement('h3', { className: 'font-semibold text-gray-900 mb-3 flex items-center gap-2' },
      React.createElement(TrendingUp, { className: 'w-4 h-4 text-campfire-500' }),
      'Trending Topics'
    ),
    React.createElement('div', { className: 'space-y-2' },
      hashtags.map((hashtag, index) => 
        React.createElement(Link, {
          key: hashtag.id,
          to: '/hashtag/' + hashtag.tag,
          className: 'flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50 transition group'
        },
          React.createElement('div', { className: 'flex items-center gap-2' },
            React.createElement('span', { className: 'text-gray-400 text-sm w-4' }, index + 1),
            React.createElement(Hash, { className: 'w-3 h-3 text-primary-500' }),
            React.createElement('span', { className: 'text-gray-700 group-hover:text-primary-600 font-medium' }, hashtag.tag)
          ),
          React.createElement('span', { className: 'text-xs text-gray-400' }, hashtag.postCount + ' posts')
        )
      )
    )
  );
}

// Hashtag search/autocomplete for input
interface HashtagAutocompleteProps {
  onSelect: (tag: string) => void;
  query: string;
}

export function HashtagAutocomplete({ onSelect, query }: HashtagAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<{ id: string; tag: string; postCount: number }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.length > 0) {
      searchHashtags(query);
    } else {
      setSuggestions([]);
    }
  }, [query]);

  const searchHashtags = async (q: string) => {
    setLoading(true);
    try {
      const { data } = await api.get('/social/hashtags/search?q=' + encodeURIComponent(q));
      setSuggestions(data);
    } catch (error) {
      console.error('Search hashtags error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (suggestions.length === 0 && !loading) return null;

  return React.createElement('div', { className: 'absolute z-50 w-64 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto' },
    loading ? (
      React.createElement('div', { className: 'p-3 text-sm text-gray-500' }, 'Searching...')
    ) : (
      suggestions.map(hashtag =>
        React.createElement('button', {
          key: hashtag.id,
          type: 'button',
          onClick: () => onSelect(hashtag.tag),
          className: 'w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center justify-between'
        },
          React.createElement('span', { className: 'flex items-center gap-1' },
            React.createElement(Hash, { className: 'w-3 h-3 text-primary-500' }),
            React.createElement('span', { className: 'font-medium' }, hashtag.tag)
          ),
          React.createElement('span', { className: 'text-xs text-gray-400' }, hashtag.postCount + ' posts')
        )
      )
    )
  );
}

// Popular hashtag suggestions (for empty state)
export function PopularHashtags({ onSelect }: { onSelect?: (tag: string) => void }) {
  const popularTags = [
    'boondocking', 'fulltimerlife', 'rvmods', 'campfirerecipes',
    'nationalparks', 'rvlife', 'vanlife', 'camping', 'adventure', 'roadtrip'
  ];

  return React.createElement('div', { className: 'flex flex-wrap gap-2' },
    popularTags.map(tag =>
      onSelect ? (
        React.createElement('button', {
          key: tag,
          type: 'button',
          onClick: () => onSelect(tag),
          className: 'px-2 py-1 bg-gray-100 hover:bg-primary-100 hover:text-primary-700 rounded-full text-xs text-gray-600 transition'
        }, '#' + tag)
      ) : (
        React.createElement(Link, {
          key: tag,
          to: '/hashtag/' + tag,
          className: 'px-2 py-1 bg-gray-100 hover:bg-primary-100 hover:text-primary-700 rounded-full text-xs text-gray-600 transition'
        }, '#' + tag)
      )
    )
  );
}

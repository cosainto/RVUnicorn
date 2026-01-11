import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Hash, ArrowLeft, MessageCircle } from 'lucide-react';
import api from '../services/api';

import { RenderHashtags } from '../components/HashtagDisplay';


interface Post {
  id: string;
  content: string;
  imageUrl?: string;
  createdAt: string;
  user: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
  };
  _count: {
    comments: number;
    reactions: number;
  };
}

interface HashtagData {
  id: string;
  tag: string;
  postCount: number;
}

export default function HashtagPage() {
  const { tag } = useParams<{ tag: string }>();
  const [hashtag, setHashtag] = useState<HashtagData | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    if (tag) {
      loadHashtagPosts();
    }
  }, [tag, page]);

  const loadHashtagPosts = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/social/hashtags/' + tag + '/posts?page=' + page + '&limit=20');
      setHashtag(data.hashtag);
      setPosts(data.posts);
      setTotalPages(data.totalPages);
    } catch (error) {
      console.error('Load hashtag posts error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && page === 1) {
    return React.createElement('div', { className: 'max-w-3xl mx-auto px-4 py-8' },
      React.createElement('div', { className: 'animate-pulse space-y-4' },
        React.createElement('div', { className: 'h-8 bg-gray-200 rounded w-1/3' }),
        React.createElement('div', { className: 'h-32 bg-gray-100 rounded' }),
        React.createElement('div', { className: 'h-32 bg-gray-100 rounded' })
      )
    );
  }

  return React.createElement('div', { className: 'max-w-3xl mx-auto px-4 py-8' },
    // Header
    React.createElement('div', { className: 'mb-6' },
      React.createElement(Link, {
        to: '/basecamp',
        className: 'inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4'
      },
        React.createElement(ArrowLeft, { className: 'w-5 h-5' }),
        'Back to Basecamp'
      ),
      React.createElement('div', { className: 'flex items-center gap-3' },
        React.createElement('div', { className: 'w-16 h-16 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center' },
          React.createElement(Hash, { className: 'w-8 h-8 text-white' })
        ),
        React.createElement('div', null,
          React.createElement('h1', { className: 'text-3xl font-bold text-gray-900' }, '#' + tag),
          hashtag && React.createElement('p', { className: 'text-gray-500' },
            hashtag.postCount + ' ' + (hashtag.postCount === 1 ? 'post' : 'posts')
          )
        )
      )
    ),

    // Posts
    posts.length === 0 ? (
      React.createElement('div', { className: 'text-center py-12 bg-gray-50 rounded-lg' },
        React.createElement(Hash, { className: 'w-12 h-12 text-gray-300 mx-auto mb-3' }),
        React.createElement('p', { className: 'text-gray-500' }, 'No posts with this hashtag yet'),
        React.createElement('p', { className: 'text-sm text-gray-400 mt-1' }, 'Be the first to post with #' + tag + '!')
      )
    ) : (
      React.createElement('div', { className: 'space-y-4' },
        posts.map(post =>
          React.createElement('div', {
            key: post.id,
            className: 'bg-white rounded-lg shadow p-4'
          },
            // Post header
            React.createElement('div', { className: 'flex items-center gap-3 mb-3' },
              React.createElement(Link, { to: '/profile/' + post.user.username },
                post.user.profilePicture ? (
                  React.createElement('img', {
                    src: post.user.profilePicture.startsWith('http') ? post.user.profilePicture : 'http://127.0.0.1:3001' + post.user.profilePicture,
                    alt: '',
                    className: 'w-10 h-10 rounded-full object-cover'
                  })
                ) : (
                  React.createElement('div', { className: 'w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center' },
                    React.createElement('span', { className: 'text-primary-600 font-medium' }, post.user.firstName[0])
                  )
                )
              ),
              React.createElement('div', null,
                React.createElement(Link, {
                  to: '/profile/' + post.user.username,
                  className: 'font-medium text-gray-900 hover:text-primary-600'
                }, post.user.firstName + ' ' + post.user.lastName),
                React.createElement('p', { className: 'text-xs text-gray-500' },
                  new Date(post.createdAt).toLocaleDateString()
                )
              )
            ),

            // Post content
            React.createElement('div', { className: 'mb-3' },
              React.createElement('p', { className: 'text-gray-700' },
                React.createElement(RenderHashtags, { content: post.content })
              ),
              post.imageUrl && React.createElement('img', {
                src: post.imageUrl.startsWith('http') ? post.imageUrl : 'http://127.0.0.1:3001' + post.imageUrl,
                alt: '',
                className: 'mt-3 rounded-lg max-h-96 object-cover'
              })
            ),

            // Post stats
            React.createElement('div', { className: 'flex items-center gap-4 text-sm text-gray-500' },
              React.createElement('span', { className: 'flex items-center gap-1' },
                '👍 ', post._count.reactions
              ),
              React.createElement('span', { className: 'flex items-center gap-1' },
                React.createElement(MessageCircle, { className: 'w-4 h-4' }),
                post._count.comments + ' comments'
              )
            )
          )
        ),

        // Pagination
        totalPages > 1 && React.createElement('div', { className: 'flex justify-center gap-2 mt-6' },
          page > 1 && React.createElement('button', {
            onClick: () => setPage(page - 1),
            className: 'btn btn-secondary btn-sm'
          }, 'Previous'),
          React.createElement('span', { className: 'px-4 py-2 text-sm text-gray-500' },
            'Page ' + page + ' of ' + totalPages
          ),
          page < totalPages && React.createElement('button', {
            onClick: () => setPage(page + 1),
            className: 'btn btn-secondary btn-sm'
          }, 'Next')
        )
      )
    )
  );
}

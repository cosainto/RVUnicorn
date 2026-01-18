import React from 'react';
import { Link } from 'react-router-dom';

interface MentionTextProps {
  content: string;
  className?: string;
}

export default function MentionText({ content, className = '' }: MentionTextProps) {
  if (!content) return null;

  const parts: React.ReactNode[] = [];
  let remaining = content;
  let keyCounter = 0;

  while (remaining.length > 0) {
    // Check for campground mention @[Name]
    const bracketMatch = remaining.match(/^@\[([^\]]+)\]/);
    if (bracketMatch) {
      const campgroundName = bracketMatch[1];
      parts.push(
        <Link
          key={keyCounter++}
          to={`/campgrounds?search=${encodeURIComponent(campgroundName)}`}
          className="text-green-600 hover:text-green-800 hover:underline font-medium"
        >
          🏕️ {campgroundName}
        </Link>
      );
      remaining = remaining.substring(bracketMatch[0].length);
      continue;
    }

    // Check for hashtag #tag
    const hashtagMatch = remaining.match(/^#(\w+)/);
    if (hashtagMatch) {
      const tag = hashtagMatch[1];
      parts.push(
        <Link
          key={keyCounter++}
          to={`/threads?tag=${tag.toLowerCase()}`}
          className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
        >
          #{tag}
        </Link>
      );
      remaining = remaining.substring(hashtagMatch[0].length);
      continue;
    }

    // Check for user mention @username
    const userMatch = remaining.match(/^@(\w+)/);
    if (userMatch) {
      const username = userMatch[1];
      parts.push(
        <Link
          key={keyCounter++}
          to={`/profile/${username}`}
          className="text-primary-600 hover:text-primary-800 hover:underline font-medium"
        >
          @{username}
        </Link>
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
      parts.push(<span key={keyCounter++}>{remaining}</span>);
      break;
    } else {
      parts.push(<span key={keyCounter++}>{remaining.substring(0, nextSpecial)}</span>);
      remaining = remaining.substring(nextSpecial);
    }
  }

  return <span className={className}>{parts}</span>;
}

import React from 'react';
import { Link } from 'react-router-dom';

interface MentionTextProps {
  content: string;
  className?: string;
}

export default function MentionText({ content, className = '' }: MentionTextProps) {
  if (!content) return null;

  // Parse @username mentions and @[Campground Name] mentions
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  
  // Combined regex for both @username and @[Campground Name]
  const mentionRegex = /@(\w+)|@\[([^\]]+)\]/g;
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    // Add text before the mention
    if (match.index > lastIndex) {
      parts.push(content.substring(lastIndex, match.index));
    }

    if (match[1]) {
      // @username mention
      const username = match[1];
      parts.push(
        <Link
          key={match.index}
          to={`/profile/${username}`}
          className="text-primary-600 hover:text-primary-800 hover:underline font-medium"
        >
          @{username}
        </Link>
      );
    } else if (match[2]) {
      // @[Campground Name] mention
      const campgroundName = match[2];
      // Create a URL-friendly slug from the name
      const slug = campgroundName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      parts.push(
        <Link
          key={match.index}
          to={`/campgrounds?search=${encodeURIComponent(campgroundName)}`}
          className="text-green-600 hover:text-green-800 hover:underline font-medium"
        >
          @{campgroundName}
        </Link>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(content.substring(lastIndex));
  }

  return <span className={className}>{parts}</span>;
}

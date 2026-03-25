import { Link } from 'react-router-dom';

interface CampgroundTag {
  campground: {
    id: string;
    name: string;
    slug?: string | null;
  };
}

interface EventPhotoTitleProps {
  caption?: string | null;
  campgroundTags?: CampgroundTag[];
  event?: {
    id: string;
    title?: string | null;
    startDate?: string | null;
    privacy?: string | null;
  } | null;
  className?: string;
}

/**
 * Renders the structured event photo title:
 *   Event Title · [Campground Link] · Start Date
 *
 * Falls back to plain caption if no event context is present.
 */
export default function EventPhotoTitle({
  caption,
  campgroundTags,
  event,
  className = '',
}: EventPhotoTitleProps) {
  // Only show structured title for non-private events with context
  if (!event || event.privacy === 'PRIVATE') {
    return caption ? (
      <p className={`text-sm text-gray-600 ${className}`}>{caption}</p>
    ) : null;
  }

  const campgroundTag = campgroundTags?.[0];
  const startDate = event.startDate
    ? new Date(event.startDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <div className={`text-sm text-gray-700 flex flex-wrap items-center gap-1 ${className}`}>
      {event.title && (
        <span className="font-medium text-gray-900">{event.title}</span>
      )}
      {campgroundTag && (
        <>
          <span className="text-gray-400">·</span>
          <Link
            to={
              campgroundTag.campground.slug
                ? `/campground/${campgroundTag.campground.slug}`
                : `/campground/${campgroundTag.campground.id}`
            }
            className="text-primary-600 hover:text-primary-800 hover:underline font-medium"
            onClick={(e) => e.stopPropagation()}
          >
            {campgroundTag.campground.name}
          </Link>
        </>
      )}
      {startDate && (
        <>
          <span className="text-gray-400">·</span>
          <span className="text-gray-500">{startDate}</span>
        </>
      )}
    </div>
  );
}

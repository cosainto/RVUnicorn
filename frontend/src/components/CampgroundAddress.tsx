import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';

interface Props {
  name: string;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  zipCode?: string | null;
  address?: string | null;
  location?: string | null;
  campgroundId?: string | null;
  format?: 'full' | 'compact' | 'minimum';
  showIcon?: boolean;
  className?: string;
}

/**
 * Universal campground name + address display.
 * - full: Name on one line, city/state/zip on second line
 * - compact: Name · City, State (single line)
 * - minimum: Name · State (tightest spaces)
 */
export default function CampgroundAddress({
  name, city, state, zip, zipCode, address, location, campgroundId,
  format = 'compact', showIcon = false, className = '',
}: Props) {
  const resolvedZip = zip || zipCode;
  const cityState = [city, state].filter(Boolean).join(', ');
  const cityStateZip = resolvedZip ? `${cityState} ${resolvedZip}` : cityState;

  // Fall back to location field if no city/state
  const displayLocation = cityStateZip || location || '';

  const nameEl = campgroundId ? (
    <Link to={`/campgrounds/${campgroundId}`} className="font-semibold hover:underline" style={{ color: '#C9A84C' }}>
      {name}
    </Link>
  ) : (
    <span className="font-semibold">{name}</span>
  );

  if (format === 'minimum') {
    return (
      <span className={`inline-flex items-center gap-1 ${className}`}>
        {showIcon && <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#C9A84C' }} />}
        {nameEl}
        {state && <span style={{ color: '#8B9BB4' }}> · {state}</span>}
      </span>
    );
  }

  if (format === 'compact') {
    return (
      <span className={`inline-flex items-center gap-1.5 ${className}`}>
        {showIcon && <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#C9A84C' }} />}
        {nameEl}
        {displayLocation && <span style={{ color: '#8B9BB4' }}> · {displayLocation}</span>}
      </span>
    );
  }

  // full format
  return (
    <div className={className}>
      <div className="flex items-center gap-1.5">
        {showIcon && <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: '#C9A84C' }} />}
        {nameEl}
      </div>
      {address && <p className="text-xs mt-0.5" style={{ color: '#8B9BB4' }}>{address}</p>}
      {displayLocation && <p className="text-xs mt-0.5" style={{ color: '#8B9BB4' }}>{displayLocation}</p>}
    </div>
  );
}

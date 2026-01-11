import { ExternalLink } from 'lucide-react';
import { getCampspotUrl } from '../utils/campspot';

interface CampspotBookButtonProps {
  campspotSlug: string;
  variant?: 'default' | 'rustic' | 'coastal' | 'retro' | 'minimal' | 'dark' | 'neon';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Book on Campspot button with theme variants
 * Matches the styling of other buttons on CampgroundDetailPage
 */
export default function CampspotBookButton({ 
  campspotSlug, 
  variant = 'default',
  size = 'md',
  className = ''
}: CampspotBookButtonProps) {
  const url = getCampspotUrl(campspotSlug);
  
  // Size classes
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3'
  };

  // Variant styles matching CampgroundDetailPage themes
  const variantClasses = {
    default: 'bg-green-600 text-white hover:bg-green-700 rounded-full font-medium',
    rustic: 'bg-amber-600 text-white hover:bg-amber-700 rounded-lg font-medium border border-amber-700',
    coastal: 'bg-emerald-500 text-white hover:bg-emerald-600 rounded-full shadow border border-emerald-400',
    retro: 'bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded hover:from-green-600 hover:to-emerald-600',
    minimal: 'border border-green-600 text-green-600 hover:bg-green-600 hover:text-white font-light tracking-wide',
    dark: 'bg-green-600 text-white hover:bg-green-500 font-medium',
    neon: 'bg-green-500 text-black font-bold rounded border-2 border-green-400 hover:bg-green-400 hover:shadow-[0_0_15px_rgba(34,197,94,0.5)]'
  };

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`
        inline-flex items-center gap-2 transition
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${className}
      `}
    >
      <svg 
        viewBox="0 0 24 24" 
        className="w-4 h-4" 
        fill="currentColor"
      >
        {/* Tent/camping icon */}
        <path d="M12 2L2 22h20L12 2zm0 4.5L18.5 20h-13L12 6.5z"/>
      </svg>
      Book on Campspot
      <ExternalLink className="w-3.5 h-3.5 opacity-70" />
    </a>
  );
}

/**
 * Simple inline Campspot link for use in text
 */
export function CampspotLink({ 
  campspotSlug, 
  children = 'Book on Campspot',
  className = ''
}: { 
  campspotSlug: string; 
  children?: React.ReactNode;
  className?: string;
}) {
  const url = getCampspotUrl(campspotSlug);
  
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`text-green-600 hover:text-green-700 hover:underline inline-flex items-center gap-1 ${className}`}
    >
      {children}
      <ExternalLink className="w-3 h-3" />
    </a>
  );
}

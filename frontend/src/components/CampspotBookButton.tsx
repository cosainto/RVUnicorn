import { ExternalLink } from 'lucide-react';
import { getCampspotUrl } from '../utils/campspot';

interface CampspotBookButtonProps {
  campspotSlug: string;
  variant?: 'modern' | 'rustic' | 'coastal' | 'retro' | 'minimal' | 'dark' | 'neon' | 'default';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  campgroundId?: string;
}

export default function CampspotBookButton({ campspotSlug, variant = 'default', className = '' }: CampspotBookButtonProps) {
  const url = getCampspotUrl(campspotSlug);
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm hover:shadow-emerald-500/30 hover:shadow-md ${className}`}>
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor">
        <path d="M12 2L2 22h20L12 2zm0 4.5L18.5 20h-13L12 6.5z"/>
      </svg>
      Book on Campspot
      <ExternalLink className="w-3 h-3 opacity-60" />
    </a>
  );
}

export function CampspotLink({ campspotSlug, children = 'Book on Campspot', className = '' }: { campspotSlug: string; children?: React.ReactNode; className?: string }) {
  const url = getCampspotUrl(campspotSlug);
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className={`text-emerald-600 hover:text-emerald-700 hover:underline inline-flex items-center gap-1 ${className}`}>
      {children}<ExternalLink className="w-3 h-3" />
    </a>
  );
}

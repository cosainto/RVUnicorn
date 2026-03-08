import React, { useState } from 'react';

interface NavigationButtonsProps {
  lat: number;
  lng: number;
  name?: string;
  compact?: boolean; // Show icon-only buttons for tight spaces
}

export type NavApp = 'waze' | 'google' | 'apple';

const NAV_APPS: { id: NavApp; label: string; icon: string; color: string }[] = [
  { id: 'waze',   label: 'Waze',         icon: '🚗', color: 'bg-sky-500 hover:bg-sky-600' },
  { id: 'google', label: 'Google Maps',  icon: '📍', color: 'bg-blue-500 hover:bg-blue-600' },
  { id: 'apple',  label: 'Apple Maps',   icon: '🗺️',  color: 'bg-gray-700 hover:bg-gray-800' },
];

function getNavUrl(app: NavApp, lat: number, lng: number, name?: string): string {
  const encoded = encodeURIComponent(name || `${lat},${lng}`);
  switch (app) {
    case 'waze':
      return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes&zoom=17`;
    case 'google':
      return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${encoded}&travelmode=driving`;
    case 'apple':
      return `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d&t=m`;
  }
}

export const NavigationButtons: React.FC<NavigationButtonsProps> = ({
  lat,
  lng,
  name,
  compact = false,
}) => {
  const [open, setOpen] = useState(false);

  const handleNav = (app: NavApp) => {
    window.open(getNavUrl(app, lat, lng, name), '_blank', 'noopener,noreferrer');
    setOpen(false);
  };

  if (compact) {
    return (
      <div className="relative inline-block">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1 px-2 py-1.5 text-xs font-semibold bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors shadow-sm"
          title="Navigate"
        >
          🧭 Navigate
        </button>
        {open && (
          <div className="absolute z-50 right-0 mt-1 w-44 rounded-xl shadow-xl bg-white border border-gray-100 overflow-hidden">
            {NAV_APPS.map((app) => (
              <button
                key={app.id}
                onClick={() => handleNav(app.id)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <span className="text-base">{app.icon}</span>
                {app.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {NAV_APPS.map((app) => (
        <button
          key={app.id}
          onClick={() => handleNav(app.id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg transition-colors shadow-sm ${app.color}`}
        >
          <span>{app.icon}</span>
          {app.label}
        </button>
      ))}
    </div>
  );
};

export default NavigationButtons;

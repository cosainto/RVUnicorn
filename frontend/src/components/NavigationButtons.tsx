import React, { useState } from 'react';

interface NavigationButtonsProps {
  lat: number;
  lng: number;
  name?: string;
  compact?: boolean;
}

export type NavApp = 'waze' | 'google' | 'apple';

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

// SVG logos for each app
const WazeLogo = () => (
  <svg viewBox="0 0 48 48" className="w-5 h-5" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="24" cy="22" rx="18" ry="17" fill="#33CCFF"/>
    <ellipse cx="24" cy="22" rx="18" ry="17" fill="url(#waze_grad)"/>
    <path d="M24 4C13.5 4 5 12.1 5 22c0 5.8 2.8 11 7.2 14.4L11 42l6-2.5c2.2.8 4.5 1.2 7 1.2 10.5 0 19-8.1 19-18S34.5 4 24 4z" fill="#33CCFF"/>
    <path d="M24 6C14.6 6 7 13.2 7 22c0 5.3 2.6 10.1 6.6 13.2l-1 4.8 5.2-2.2c2 .7 4.1 1 6.2 1 9.4 0 17-7.2 17-16S33.4 6 24 6z" fill="#00C8FF"/>
    {/* Eyes */}
    <circle cx="19" cy="20" r="2.5" fill="white"/>
    <circle cx="29" cy="20" r="2.5" fill="white"/>
    <circle cx="20" cy="20" r="1.2" fill="#1a1a1a"/>
    <circle cx="30" cy="20" r="1.2" fill="#1a1a1a"/>
    {/* Smile */}
    <path d="M19 26c1.2 2 8.8 2 10 0" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
    <defs>
      <linearGradient id="waze_grad" x1="5" y1="4" x2="43" y2="40" gradientUnits="userSpaceOnUse">
        <stop stopColor="#00D4FF"/>
        <stop offset="1" stopColor="#00A8E8"/>
      </linearGradient>
    </defs>
  </svg>
);

const GoogleMapsLogo = () => (
  <svg viewBox="0 0 48 48" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 4C16.3 4 10 10.3 10 18c0 10.5 14 26 14 26s14-15.5 14-26c0-7.7-6.3-14-14-14z" fill="#EA4335"/>
    <path d="M24 4C16.3 4 10 10.3 10 18c0 3.9 1.6 7.4 4.1 9.9L24 4z" fill="#B52B27" opacity="0.3"/>
    <circle cx="24" cy="18" r="6" fill="white"/>
    <circle cx="24" cy="18" r="4" fill="#EA4335"/>
  </svg>
);

const AppleMapsLogo = () => (
  <svg viewBox="0 0 48 48" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
    <rect width="48" height="48" rx="10" fill="url(#apple_grad)"/>
    <path d="M24 8L38 36H10L24 8z" fill="white" opacity="0.15"/>
    <path d="M10 36h28" stroke="white" strokeWidth="2" opacity="0.3"/>
    {/* Road */}
    <path d="M24 10v28M20 38h8" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.9"/>
    <path d="M14 20l10-10 10 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.9"/>
    {/* Pin */}
    <circle cx="32" cy="18" r="4" fill="white"/>
    <circle cx="32" cy="18" r="2.5" fill="#FF3B30"/>
    <defs>
      <linearGradient id="apple_grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
        <stop stopColor="#34C759"/>
        <stop offset="0.5" stopColor="#007AFF"/>
        <stop offset="1" stopColor="#0051D5"/>
      </linearGradient>
    </defs>
  </svg>
);

const NAV_APPS: { id: NavApp; label: string; Logo: React.FC }[] = [
  { id: 'waze',   label: 'Open in Waze',        Logo: WazeLogo },
  { id: 'google', label: 'Open in Google Maps',  Logo: GoogleMapsLogo },
  { id: 'apple',  label: 'Open in Apple Maps',   Logo: AppleMapsLogo },
];

export const NavigationButtons: React.FC<NavigationButtonsProps> = ({ lat, lng, name, compact }) => {
  const handleNav = (app: NavApp) => {
    window.open(getNavUrl(app, lat, lng, name), '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex items-center gap-2">
      {NAV_APPS.map(({ id, label, Logo }) => (
        <button
          key={id}
          onClick={() => handleNav(id)}
          title={label}
          className="w-10 h-10 rounded-xl flex items-center justify-center bg-white border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all duration-150 shadow-sm"
        >
          <Logo />
        </button>
      ))}
    </div>
  );
};

export default NavigationButtons;

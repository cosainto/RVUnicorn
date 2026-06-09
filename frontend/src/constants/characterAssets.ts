/**
 * Character asset definitions for Holden & Hannah — RVUnicorn Junior Ranger guides.
 *
 * Structured so future variants (seasonal, activity-specific, animated) can be
 * added per character without refactoring — just extend the `variants` object.
 */

const CLOUDINARY_BASE = 'https://res.cloudinary.com/dy6eetmh7/image/upload';

/** Cloudinary transformation helpers */
function sized(url: string, w: number, h: number) {
  // Insert w_N,h_N,c_fill,g_face before the version segment
  return url.replace('/upload/', `/upload/w_${w},h_${h},c_fill,g_face/`);
}

export interface CharacterAssetVariant {
  label: string;
  image: string;
}

export interface CharacterAsset {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  /** Default avatar at original resolution */
  image: string;
  /** Pre-built size variants for common use cases */
  sizes: {
    chatAvatar: string;    // 40x40 — campfire and chat messages
    cardAvatar: string;    // 80x80 — Family Adventure cards
    notificationIcon: string; // 32x32 — mobile notifications
    profileRef: string;    // 60x60 — profile references
  };
  /** Extensible variants (seasonal, activity-specific, animated, etc.) */
  variants: Record<string, CharacterAssetVariant>;
}

const HOLDEN_BASE = `${CLOUDINARY_BASE}/v1781042437/rvunicorn/characters/holden.jpg`;
const HANNAH_BASE = `${CLOUDINARY_BASE}/v1781042437/rvunicorn/characters/hannah.jpg`;

export const HOLDEN: CharacterAsset = {
  id: 'holden',
  name: 'Holden',
  description: 'Junior Ranger guide for outdoor kid adventures — scavenger hunts, fishing, wildlife, and playground fun',
  keywords: ['children', 'adventure', 'scavenger hunts', 'fishing', 'wildlife', 'playground'],
  image: HOLDEN_BASE,
  sizes: {
    chatAvatar: sized(HOLDEN_BASE, 40, 40),
    cardAvatar: sized(HOLDEN_BASE, 80, 80),
    notificationIcon: sized(HOLDEN_BASE, 32, 32),
    profileRef: sized(HOLDEN_BASE, 60, 60),
  },
  variants: {
    default: { label: 'Default', image: HOLDEN_BASE },
  },
};

export const HANNAH: CharacterAsset = {
  id: 'hannah',
  name: 'Hannah',
  description: 'Junior Ranger guide for family trip planning — educational activities, events, museums, dining, and nearby attractions',
  keywords: ['family', 'trip planning', 'educational', 'events', 'museums', 'dining', 'nearby attractions'],
  image: HANNAH_BASE,
  sizes: {
    chatAvatar: sized(HANNAH_BASE, 40, 40),
    cardAvatar: sized(HANNAH_BASE, 80, 80),
    notificationIcon: sized(HANNAH_BASE, 32, 32),
    profileRef: sized(HANNAH_BASE, 60, 60),
  },
  variants: {
    default: { label: 'Default', image: HANNAH_BASE },
  },
};

/** All extended character assets keyed by id */
export const CHARACTER_ASSETS: Record<string, CharacterAsset> = {
  holden: HOLDEN,
  hannah: HANNAH,
};

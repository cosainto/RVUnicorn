/**
 * Campspot Affiliate Integration
 * 
 * Setup Instructions:
 * 1. Sign up for Campspot's affiliate program through AWIN: https://ui.awin.com/merchant-profile/22326
 * 2. Once approved, you'll get an affiliate/publisher ID
 * 3. Update AWIN_PUBLISHER_ID below with your ID
 * 4. Add campspotSlug to campgrounds in your database
 * 
 * Commission: 3% on every booking
 * Cookie Duration: 30 days
 */

// Your AWIN Publisher ID (get this after signing up)
// Leave empty for direct links without affiliate tracking
export const AWIN_PUBLISHER_ID = ''; // e.g., '123456'

// Campspot advertiser ID on AWIN
const CAMPSPOT_ADVERTISER_ID = '22326';

/**
 * Generate a Campspot booking URL
 * @param campspotSlug - The campground's slug on Campspot (e.g., "verde-ranch-rv-resort")
 * @param useAffiliate - Whether to use affiliate tracking (requires AWIN_PUBLISHER_ID)
 * @returns The full Campspot URL
 */
export const getCampspotUrl = (campspotSlug: string, useAffiliate: boolean = true): string => {
  const baseUrl = `https://www.campspot.com/park/${campspotSlug}`;
  
  // If affiliate tracking is enabled and we have a publisher ID
  if (useAffiliate && AWIN_PUBLISHER_ID) {
    // AWIN deep link format
    return `https://www.awin1.com/cread.php?awinmid=${CAMPSPOT_ADVERTISER_ID}&awinaffid=${AWIN_PUBLISHER_ID}&ued=${encodeURIComponent(baseUrl)}`;
  }
  
  // Direct link without affiliate tracking
  return baseUrl;
};

/**
 * Generate a Campspot search URL for a location
 * @param location - City, state, or region to search
 * @param useAffiliate - Whether to use affiliate tracking
 * @returns The Campspot search URL
 */
export const getCampspotSearchUrl = (location: string, useAffiliate: boolean = true): string => {
  const baseUrl = `https://www.campspot.com/search?q=${encodeURIComponent(location)}`;
  
  if (useAffiliate && AWIN_PUBLISHER_ID) {
    return `https://www.awin1.com/cread.php?awinmid=${CAMPSPOT_ADVERTISER_ID}&awinaffid=${AWIN_PUBLISHER_ID}&ued=${encodeURIComponent(baseUrl)}`;
  }
  
  return baseUrl;
};

/**
 * Check if a campground has Campspot integration
 * @param campground - The campground object
 * @returns boolean
 */
export const hasCampspotIntegration = (campground: { campspotSlug?: string | null }): boolean => {
  return !!campground.campspotSlug;
};

/**
 * Common Campspot slug patterns - helps with auto-detection
 * Campspot slugs are typically: campground-name-in-lowercase-with-dashes
 */
export const generateProbableCampspotSlug = (campgroundName: string): string => {
  return campgroundName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-')          // Replace spaces with dashes
    .replace(/-+/g, '-')           // Replace multiple dashes with single
    .replace(/^-|-$/g, '');        // Remove leading/trailing dashes
};

import api from '../services/api';

// Known AWIN retailer domains and their advertiser IDs
const AWIN_ADVERTISERS: Record<string, string> = {
  'amazon.com': '6220',
  'campingworld.com': '10411',
  'rei.com': '18279',
  'walmart.com': '6798',
  'homedepot.com': '10455',
  'lowes.com': '15883',
};

const AWIN_PUBLISHER_ID = 'rvunicorn'; // Replace with actual AWIN publisher ID

/**
 * Wraps a product URL with AWIN affiliate params if the retailer is known.
 */
export function wrapWithAwin(url: string, rigId?: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace('www.', '');

    const advertiserId = AWIN_ADVERTISERS[host];
    if (!advertiserId) return url;

    // Build AWIN deep link
    const encodedUrl = encodeURIComponent(url);
    const clickRef = rigId ? `&clickref=${rigId}` : '';
    return `https://www.awin1.com/cread.php?awinmid=${advertiserId}&awinaffid=${AWIN_PUBLISHER_ID}&ued=${encodedUrl}${clickRef}`;
  } catch {
    return url;
  }
}

/**
 * Logs a click and opens the (optionally affiliate-wrapped) URL.
 */
export async function trackAndOpen(
  productUrl: string,
  modLogId: string,
  rigId: string,
): Promise<void> {
  // Log click (fire and forget)
  api.post('/mods/affiliate-click', { modLogId, rigId, productUrl }).catch(() => {});

  // Wrap with affiliate params and open
  const affiliateUrl = wrapWithAwin(productUrl, rigId);
  window.open(affiliateUrl, '_blank', 'noopener');
}

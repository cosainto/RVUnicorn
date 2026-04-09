// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for the public-facing frontend URL.
//
// Why this exists: every route that needs to redirect a user back from an
// external service (Stripe Checkout, Stripe Customer Portal, OAuth callbacks,
// invite links, share URLs) needs the same base URL. Before this helper,
// six different files rolled their own resolution with slightly different
// fallbacks, and at least one localhost value was leaking from Railway env
// variables and breaking the Stripe portal return link in production.
//
// The defensive rule below — "in production, ignore any localhost value" —
// is the load-bearing piece. If something on Railway is misconfigured to
// http://localhost:5173, we'd rather hardcode www.rvunicorn.com than dump
// users on a broken URL.
// ─────────────────────────────────────────────────────────────────────────────

const PRODUCTION_DEFAULT = 'https://www.rvunicorn.com';
const DEVELOPMENT_DEFAULT = 'http://localhost:5173';

// Detect a real production environment using multiple signals so we don't
// depend on someone remembering to set NODE_ENV=production on Railway. Any
// of these being true means "this is not a developer's laptop":
//   • NODE_ENV=production   (the standard convention)
//   • RAILWAY_ENVIRONMENT   (set automatically by Railway on every deploy)
//   • RAILWAY_PROJECT_ID    (also set automatically by Railway)
function isProductionEnvironment(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    !!process.env.RAILWAY_ENVIRONMENT ||
    !!process.env.RAILWAY_PROJECT_ID
  );
}

function resolveFrontendUrl(): string {
  const raw = process.env.FRONTEND_URL;
  const isProd = isProductionEnvironment();

  // Strip stray quotes (some env editors wrap values in double quotes) and
  // trailing slashes for predictable concatenation.
  const cleaned = (raw || '').replace(/"/g, '').replace(/\/$/, '').trim();

  // Defensive override: in production, never honor a localhost value, even
  // if explicitly set. This catches the failure mode where a stale Railway
  // variable from a dev config leaks into prod and breaks Stripe redirects.
  if (isProd) {
    if (!cleaned || cleaned.includes('localhost') || cleaned.includes('127.0.0.1')) {
      if (cleaned) {
        console.warn(`[frontendUrl] Production environment but FRONTEND_URL="${cleaned}" — overriding to ${PRODUCTION_DEFAULT}`);
      }
      return PRODUCTION_DEFAULT;
    }
    return cleaned;
  }

  // Development: allow whatever's set, fall back to local dev server.
  return cleaned || DEVELOPMENT_DEFAULT;
}

/**
 * The resolved public frontend base URL — no trailing slash.
 * Use this everywhere you need to construct a return URL for an external
 * service or generate a shareable link.
 */
export const FRONTEND_URL = resolveFrontendUrl();

// Log the resolved value once at module load so Railway deploy logs show
// definitively which URL the backend will hand out.
console.log(`[frontendUrl] resolved → ${FRONTEND_URL} (NODE_ENV=${process.env.NODE_ENV || 'undefined'})`);

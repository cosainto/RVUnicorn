import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(process.env.PORT || '4173');
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

// Proxy API and upload requests to the backend (supports SSE + WebSocket)
const apiProxy = createProxyMiddleware({
  target: BACKEND_URL,
  changeOrigin: true,
  ws: true,
  on: {
    proxyReq: (proxyReq) => {
      proxyReq.setHeader('connection', 'keep-alive');
    }
  }
});
app.use((req, res, next) => {
  if (req.url.startsWith('/api/') || req.url.startsWith('/uploads/')) {
    return apiProxy(req, res, next);
  }
  next();
});

// Proxy SEO routes to the backend (use the same proxy middleware as /api so https BACKEND_URLs work)
const seoProxy = createProxyMiddleware({ target: BACKEND_URL, changeOrigin: true });
app.get('/sitemap.xml', seoProxy);
app.get('/robots.txt', seoProxy);

// Proxy SSR pages to the backend for crawlers AND link preview fetchers.
// iMessage, Slack, Discord, etc. use standard browser UAs so we can't rely
// on user-agent alone. Instead: any non-XHR request that accepts text/html
// AND isn't requesting a JS/CSS asset gets proxied to the backend SSR handler.
// The backend's shouldSSR() makes the final call on whether to render or next().
const CRAWLER_UA = /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|Slackbot|Discordbot|Applebot/i;

function shouldProxySSR(req) {
  // Always proxy for known crawlers
  if (CRAWLER_UA.test(req.headers['user-agent'] || '')) return true;
  // Proxy for direct browser/preview fetcher loads (accepts HTML, not an XHR)
  const acceptsHtml = (req.headers.accept || '').includes('text/html');
  const isXHR = !!req.headers['x-requested-with'];
  return acceptsHtml && !isXHR;
}

const ssrProxy = createProxyMiddleware({ target: BACKEND_URL, changeOrigin: true });

for (const pattern of ['/campgrounds/:slug', '/community/:boardSlug', '/events/:id', '/trips/:slug/view', '/s/:token']) {
  app.use(pattern, (req, res, next) => {
    if (shouldProxySSR(req)) return ssrProxy(req, res, next);
    next();
  });
}

// Serve /assets/ files explicitly with correct MIME types (BEFORE catch-all)
app.use('/assets', express.static(path.join(__dirname, 'dist', 'assets'), {
  maxAge: '1y',
  immutable: true,
}));

// Serve other static files from the Vite build
app.use(express.static(path.join(__dirname, 'dist'), {
  maxAge: '7d',
  immutable: true,
  index: false,
}));

// SPA catch-all — serve index.html for all other routes (never cache so deploys take effect immediately)
app.get('*', (_req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Frontend server running on port ${PORT}`);
});

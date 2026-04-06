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

// Proxy SEO routes to the backend
app.get('/sitemap.xml', (req, res) => {
  const url = `${BACKEND_URL}/sitemap.xml`;
  import('http').then(http => {
    http.get(url, (proxyRes) => {
      res.set('Content-Type', proxyRes.headers['content-type'] || 'application/xml');
      res.set('Cache-Control', 'public, max-age=86400');
      proxyRes.pipe(res);
    }).on('error', () => res.status(502).send('Backend unavailable'));
  });
});
app.get('/robots.txt', (req, res) => {
  const url = `${BACKEND_URL}/robots.txt`;
  import('http').then(http => {
    http.get(url, (proxyRes) => {
      res.set('Content-Type', 'text/plain');
      proxyRes.pipe(res);
    }).on('error', () => res.status(502).send('Backend unavailable'));
  });
});

// Proxy SSR campground and community pages to the backend for crawlers only
const CRAWLER_UA = /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot/i;

app.use('/campgrounds/:slug', (req, res, next) => {
  if (CRAWLER_UA.test(req.headers['user-agent'] || '')) {
    return createProxyMiddleware({ target: BACKEND_URL, changeOrigin: true })(req, res, next);
  }
  next();
});
app.use('/community/:boardSlug', (req, res, next) => {
  if (CRAWLER_UA.test(req.headers['user-agent'] || '')) {
    return createProxyMiddleware({ target: BACKEND_URL, changeOrigin: true })(req, res, next);
  }
  next();
});

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

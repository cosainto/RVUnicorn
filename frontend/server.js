import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(process.env.PORT || '4173');
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

// Proxy API and upload requests to the backend
app.use('/api', createProxyMiddleware({ target: BACKEND_URL, changeOrigin: true }));
app.use('/uploads', createProxyMiddleware({ target: BACKEND_URL, changeOrigin: true }));

// Proxy SEO routes to the backend
app.use('/sitemap.xml', createProxyMiddleware({ target: BACKEND_URL, changeOrigin: true }));
app.use('/robots.txt', createProxyMiddleware({ target: BACKEND_URL, changeOrigin: true }));

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

// Serve static files from the Vite build
app.use(express.static(path.join(__dirname, 'dist'), {
  maxAge: '7d',
  immutable: true,
  index: false, // Don't auto-serve index.html for directories — we handle the catch-all below
}));

// SPA catch-all — serve index.html for all other routes
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Frontend server running on port ${PORT}`);
});

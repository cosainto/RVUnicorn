import { Link } from 'react-router-dom';

export default function PublicHeader() {
  return (
    <nav
      className="sticky top-0 z-50"
      style={{
        background: 'rgba(15,28,53,0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #243552',
      }}
    >
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 sm:px-6 py-3">
        <Link to="/" className="flex items-center gap-2">
          <img src="/images/logo-icon-v2.png" alt="RVUnicorn" className="w-8 h-8 rounded-full" />
          <span className="font-bold text-lg" style={{ fontFamily: "'Playfair Display', serif", color: '#F5F0E8' }}>
            RVUnicorn
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="px-4 py-2 rounded-lg text-sm font-medium transition hover:bg-white/5"
            style={{ color: '#F5F0E8', border: '1px solid rgba(255,255,255,0.15)' }}
          >
            Sign In
          </Link>
          <Link
            to="/register"
            className="px-4 py-2 rounded-lg text-sm font-bold transition hover:brightness-110"
            style={{ background: '#E8A838', color: '#0F1C35' }}
          >
            Join Free
          </Link>
        </div>
      </div>
    </nav>
  );
}

import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const HITCH_IMG = 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261116/rvunicorn/characters/hitch.png';

export default function MobileBottomNav() {
  const location = useLocation();
  const { user } = useAuth() as any;
  const path = location.pathname;

  // Don't show on landing page or auth pages
  if (!user || path === '/' || path === '/login' || path === '/register') return null;

  const tabs = [
    { href: '/basecamp', label: 'Home', icon: '\u{1F3E0}', active: path === '/basecamp' },
    { href: '/campgrounds', label: 'Explore', icon: '\u{1F3D5}', active: path.startsWith('/campgrounds') },
    { href: '/trips', label: 'Trips', icon: '\u{1F5FA}', active: path.startsWith('/trips') },
    { href: `/profile/${user?.username}`, label: 'Profile', icon: '\u{1F464}', active: path.startsWith('/profile') },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 sm:hidden" style={{
      background: 'rgba(15,28,53,0.97)',
      backdropFilter: 'blur(12px)',
      borderTop: '1px solid rgba(232,168,56,0.1)',
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      <div className="flex items-center justify-around px-2 py-1.5">
        {tabs.map(tab => (
          <Link key={tab.href} to={tab.href} className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition"
            style={{ background: tab.active ? 'rgba(232,168,56,0.1)' : 'transparent' }}>
            <span className="text-lg">{tab.icon}</span>
            <span className="text-[9px] font-semibold" style={{ color: tab.active ? '#E8A838' : 'rgba(245,240,232,0.35)' }}>{tab.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

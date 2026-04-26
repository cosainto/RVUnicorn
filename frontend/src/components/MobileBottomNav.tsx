import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function MobileBottomNav() {
  const location = useLocation();
  const { user } = useAuth() as any;
  const path = location.pathname;

  // Don't show on landing page or auth pages
  if (!user || path === '/' || path === '/login' || path === '/register') return null;

  const tabs = [
    { href: '/basecamp', label: 'Home', icon: '\u{1F3E0}', active: path === '/basecamp' },
    { href: '/campgrounds', label: 'Explore', icon: '\u{1F3D5}', active: path.startsWith('/campgrounds') },
    { href: '/events-v2/create', label: '', icon: '+', isCreate: true, active: false },
    { href: '/community', label: 'Community', icon: '\u{1F525}', active: path.startsWith('/community') },
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
          <Link key={tab.href} to={tab.href} className={`flex flex-col items-center gap-0.5 rounded-lg transition ${(tab as any).isCreate ? '' : 'px-3 py-1'}`}
            style={(tab as any).isCreate ? {} : { background: tab.active ? 'rgba(232,168,56,0.1)' : 'transparent' }}>
            {(tab as any).isCreate ? (
              <span className="flex items-center justify-center w-12 h-12 -mt-5 rounded-full text-2xl font-bold shadow-lg"
                style={{ background: 'linear-gradient(135deg, #E8A838, #F97316)', color: '#0F1C35', boxShadow: '0 4px 16px rgba(232,168,56,0.4)' }}>
                +
              </span>
            ) : (
              <>
                <span className="text-lg">{tab.icon}</span>
                <span className="text-[9px] font-semibold" style={{ color: tab.active ? '#E8A838' : 'rgba(245,240,232,0.35)' }}>{tab.label}</span>
              </>
            )}
          </Link>
        ))}
      </div>
    </nav>
  );
}

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import OAuthButtons from '../components/OAuthButtons';

const HITCH_IMG = 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261116/rvunicorn/characters/hitch.png';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
      `}</style>
      <div className="min-h-screen flex items-center justify-center px-4 py-8" style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(232,98,42,0.08) 0%, transparent 60%), #0F1C35', fontFamily: "'DM Sans',sans-serif" }}>

        <div className="w-full max-w-sm">
          {/* Logo + Welcome */}
          <div className="text-center mb-8">
            <Link to="/">
              <img src="/images/Logo_RVUnicorn.png" alt="RVUnicorn" className="w-16 h-16 rounded-full mx-auto mb-4 border-2" style={{ borderColor: '#E8A838' }} />
            </Link>
            <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: "'Playfair Display',serif", color: '#F5F0E8' }}>Welcome back</h1>
            <p className="text-[13px]" style={{ color: 'rgba(245,240,232,0.4)' }}>Sign in to your RVUnicorn account</p>
          </div>

          {/* Card */}
          <div className="rounded-2xl p-6" style={{ background: 'rgba(27,46,80,0.5)', backdropFilter: 'blur(12px)', border: '1px solid rgba(201,168,76,0.15)' }}>

            {error && (
              <div className="mb-4 p-3 rounded-xl text-[13px]" style={{ background: 'rgba(212,98,26,0.1)', border: '1px solid rgba(212,98,26,0.2)', color: '#D4621A' }}>
                {error}
              </div>
            )}

            <OAuthButtons />

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-[12px] font-medium mb-1.5 block" style={{ color: 'rgba(245,240,232,0.5)' }}>Email</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 rounded-xl text-[14px] focus:outline-none transition"
                  style={{ background: '#1B2E50', border: '1px solid rgba(232,168,56,0.12)', color: '#F5F0E8' }}
                  onFocus={e => e.target.style.borderColor = '#E8A838'}
                  onBlur={e => e.target.style.borderColor = 'rgba(232,168,56,0.12)'}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[12px] font-medium" style={{ color: 'rgba(245,240,232,0.5)' }}>Password</label>
                  <Link to="/forgot-password" className="text-[11px] font-medium" style={{ color: '#E8A838' }}>Forgot password?</Link>
                </div>
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)} required
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl text-[14px] focus:outline-none transition"
                  style={{ background: '#1B2E50', border: '1px solid rgba(232,168,56,0.12)', color: '#F5F0E8' }}
                  onFocus={e => e.target.style.borderColor = '#E8A838'}
                  onBlur={e => e.target.style.borderColor = 'rgba(232,168,56,0.12)'}
                />
              </div>

              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl text-[14px] font-bold transition hover:brightness-110 disabled:opacity-50"
                style={{ background: '#E8622A', color: 'white' }}>
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                    Signing in...
                  </span>
                ) : 'Sign In'}
              </button>
            </form>

            <p className="text-center text-[13px] mt-5" style={{ color: 'rgba(245,240,232,0.35)' }}>
              Don't have an account?{' '}
              <Link to="/register" className="font-semibold hover:underline" style={{ color: '#E8A838' }}>Sign up free</Link>
            </p>
          </div>

          {/* Hitch tagline */}
          <div className="flex items-center justify-center gap-2 mt-6">
            <img src={HITCH_IMG} alt="Hitch" className="w-6 h-6 rounded-full object-cover" />
            <p className="text-[11px]" style={{ color: 'rgba(245,240,232,0.2)' }}>Hitch is waiting at the campfire</p>
          </div>
        </div>
      </div>
    </>
  );
}

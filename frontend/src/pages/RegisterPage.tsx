import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import OAuthButtons from '../components/OAuthButtons';

const HITCH_IMG = 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261116/rvunicorn/characters/hitch.png';

export default function RegisterPage() {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('ref') || '';
  const isInvited = searchParams.get('invited') === 'true';

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await (register as any)(email, username, password, firstName, lastName, phone, inviteToken);
      navigate('/welcome');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to register');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = { background: '#1B2E50', border: '1px solid rgba(232,168,56,0.12)', color: '#F5F0E8' };
  const labelStyle = { color: 'rgba(245,240,232,0.5)' };

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap');`}</style>
      <div className="min-h-screen flex items-center justify-center px-4 py-8" style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(232,98,42,0.08) 0%, transparent 60%), #0F1C35', fontFamily: "'DM Sans',sans-serif" }}>

        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="text-center mb-6">
            <Link to="/">
              <img src="/images/Logo_RVUnicorn.png" alt="RVUnicorn" className="w-14 h-14 rounded-full mx-auto mb-3 border-2" style={{ borderColor: '#E8A838' }} />
            </Link>
            <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: "'Playfair Display',serif", color: '#F5F0E8' }}>
              {isInvited ? 'Join your friend' : 'Create your account'}
            </h1>
            <p className="text-[13px]" style={{ color: 'rgba(245,240,232,0.4)' }}>
              {isInvited ? 'Sign up and you\'ll be connected automatically' : 'Join 11,000+ RVers on the road'}
            </p>
          </div>

          {/* Invite banner */}
          {isInvited && (
            <div className="mb-4 p-3 rounded-xl flex items-center gap-3" style={{ background: 'rgba(232,168,56,0.08)', border: '1px solid rgba(232,168,56,0.15)' }}>
              <img src={HITCH_IMG} alt="Hitch" className="w-8 h-8 rounded-full object-cover" />
              <p className="text-[12px]" style={{ color: 'rgba(245,240,232,0.6)' }}>A friend invited you! You'll be connected when you join.</p>
            </div>
          )}

          {/* Card */}
          <div className="rounded-2xl p-6" style={{ background: 'rgba(27,46,80,0.5)', backdropFilter: 'blur(12px)', border: '1px solid rgba(201,168,76,0.15)' }}>

            {error && (
              <div className="mb-4 p-3 rounded-xl text-[13px]" style={{ background: 'rgba(212,98,26,0.1)', border: '1px solid rgba(212,98,26,0.2)', color: '#D4621A' }}>
                {error}
              </div>
            )}

            <OAuthButtons />

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-medium mb-1 block" style={labelStyle}>First Name</label>
                  <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} required
                    className="w-full px-3 py-2.5 rounded-xl text-[14px] focus:outline-none transition"
                    style={inputStyle}
                    onFocus={e => e.target.style.borderColor = '#E8A838'}
                    onBlur={e => e.target.style.borderColor = 'rgba(232,168,56,0.12)'} />
                </div>
                <div>
                  <label className="text-[12px] font-medium mb-1 block" style={labelStyle}>Last Name</label>
                  <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} required
                    className="w-full px-3 py-2.5 rounded-xl text-[14px] focus:outline-none transition"
                    style={inputStyle}
                    onFocus={e => e.target.style.borderColor = '#E8A838'}
                    onBlur={e => e.target.style.borderColor = 'rgba(232,168,56,0.12)'} />
                </div>
              </div>

              <div>
                <label className="text-[12px] font-medium mb-1 block" style={labelStyle}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  placeholder="you@example.com"
                  className="w-full px-3 py-2.5 rounded-xl text-[14px] focus:outline-none transition"
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = '#E8A838'}
                  onBlur={e => e.target.style.borderColor = 'rgba(232,168,56,0.12)'} />
              </div>

              <div>
                <label className="text-[12px] font-medium mb-1 block" style={labelStyle}>Username</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[14px]" style={{ color: 'rgba(245,240,232,0.3)' }}>@</span>
                  <input type="text" value={username} onChange={e => setUsername(e.target.value)} required
                    placeholder="yourname"
                    className="w-full pl-7 pr-3 py-2.5 rounded-xl text-[14px] focus:outline-none transition"
                    style={inputStyle}
                    onFocus={e => e.target.style.borderColor = '#E8A838'}
                    onBlur={e => e.target.style.borderColor = 'rgba(232,168,56,0.12)'} />
                </div>
              </div>

              <div>
                <label className="text-[12px] font-medium mb-1 block" style={labelStyle}>
                  Phone <span style={{ color: 'rgba(245,240,232,0.25)' }}>(optional)</span>
                </label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="(555) 555-5555"
                  className="w-full px-3 py-2.5 rounded-xl text-[14px] focus:outline-none transition"
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = '#E8A838'}
                  onBlur={e => e.target.style.borderColor = 'rgba(232,168,56,0.12)'} />
              </div>

              <div>
                <label className="text-[12px] font-medium mb-1 block" style={labelStyle}>Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
                  placeholder="Min 6 characters"
                  className="w-full px-3 py-2.5 rounded-xl text-[14px] focus:outline-none transition"
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = '#E8A838'}
                  onBlur={e => e.target.style.borderColor = 'rgba(232,168,56,0.12)'} />
              </div>

              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl text-[14px] font-bold transition hover:brightness-110 disabled:opacity-50 mt-1"
                style={{ background: '#E8622A', color: 'white' }}>
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                    Creating Account...
                  </span>
                ) : 'Create Account'}
              </button>
            </form>

            <p className="text-center text-[13px] mt-5" style={{ color: 'rgba(245,240,232,0.35)' }}>
              Already have an account?{' '}
              <Link to="/login" className="font-semibold hover:underline" style={{ color: '#E8A838' }}>Sign in</Link>
            </p>
          </div>

          {/* Hitch tagline */}
          <div className="flex items-center justify-center gap-2 mt-5">
            <img src={HITCH_IMG} alt="Hitch" className="w-5 h-5 rounded-full object-cover" />
            <p className="text-[11px]" style={{ color: 'rgba(245,240,232,0.2)' }}>Free forever · No credit card needed</p>
          </div>
        </div>
      </div>
    </>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch { setError('Something went wrong. Please try again.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8" style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(232,98,42,0.08) 0%, transparent 60%), #0F1C35', fontFamily: "'DM Sans',sans-serif" }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <Link to="/"><img src="/images/Logo_RVUnicorn.png" alt="RVUnicorn" className="w-14 h-14 rounded-full mx-auto mb-3 border-2" style={{ borderColor: '#E8A838' }} /></Link>
          <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: "'Playfair Display',serif", color: '#F5F0E8' }}>Reset Your Password</h1>
          <p className="text-[13px]" style={{ color: 'rgba(245,240,232,0.4)' }}>Enter your email and we'll send you a reset link</p>
        </div>

        <div className="rounded-2xl p-6" style={{ background: 'rgba(27,46,80,0.5)', backdropFilter: 'blur(12px)', border: '1px solid rgba(201,168,76,0.15)' }}>
          {sent ? (
            <div className="text-center py-4">
              <span className="text-4xl block mb-3">{'\u{2709}'}</span>
              <p className="text-[14px] font-bold mb-2" style={{ color: '#F5F0E8' }}>Check your email</p>
              <p className="text-[13px]" style={{ color: 'rgba(245,240,232,0.5)' }}>If an account exists for {email}, we sent a password reset link. It expires in 1 hour.</p>
              <Link to="/login" className="block mt-4 text-[13px] font-semibold" style={{ color: '#E8A838' }}>Back to Sign In</Link>
            </div>
          ) : (
            <>
              {error && <div className="mb-4 p-3 rounded-xl text-[13px]" style={{ background: 'rgba(212,98,26,0.1)', border: '1px solid rgba(212,98,26,0.2)', color: '#D4621A' }}>{error}</div>}
              <form onSubmit={handleSubmit}>
                <label className="text-[12px] font-medium mb-1.5 block" style={{ color: 'rgba(245,240,232,0.5)' }}>Email address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com"
                  className="w-full px-4 py-3 rounded-xl text-[14px] focus:outline-none transition mb-4"
                  style={{ background: '#1B2E50', border: '1px solid rgba(232,168,56,0.12)', color: '#F5F0E8' }}
                  onFocus={e => e.target.style.borderColor = '#E8A838'} onBlur={e => e.target.style.borderColor = 'rgba(232,168,56,0.12)'} />
                <button type="submit" disabled={loading} className="w-full py-3 rounded-xl text-[14px] font-bold transition hover:brightness-110 disabled:opacity-50" style={{ background: '#E8622A', color: 'white' }}>
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>
              <p className="text-center text-[13px] mt-4" style={{ color: 'rgba(245,240,232,0.35)' }}>
                Remember your password? <Link to="/login" className="font-semibold" style={{ color: '#E8A838' }}>Sign in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

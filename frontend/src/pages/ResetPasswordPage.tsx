import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords don\'t match'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true); setError('');
    try {
      await api.post('/auth/reset-password', { token, newPassword: password });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (e: any) { setError(e.response?.data?.error || 'Failed to reset password'); }
    finally { setLoading(false); }
  };

  if (!token) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0F1C35', color: '#F5F0E8' }}>
      <div className="text-center"><p className="text-lg font-bold mb-2">Invalid reset link</p><Link to="/forgot-password" style={{ color: '#E8A838' }}>Request a new one →</Link></div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8" style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(232,98,42,0.08) 0%, transparent 60%), #0F1C35', fontFamily: "'DM Sans',sans-serif" }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <Link to="/"><img src="/images/logo-icon-v2.png" alt="RVUnicorn" className="w-14 h-14 rounded-full mx-auto mb-3 border-2" style={{ borderColor: '#E8A838' }} /></Link>
          <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: "'Playfair Display',serif", color: '#F5F0E8' }}>Set New Password</h1>
        </div>

        <div className="rounded-2xl p-6" style={{ background: 'rgba(27,46,80,0.5)', backdropFilter: 'blur(12px)', border: '1px solid rgba(201,168,76,0.15)' }}>
          {success ? (
            <div className="text-center py-4">
              <span className="text-4xl block mb-3">{'\u2705'}</span>
              <p className="text-[14px] font-bold mb-2" style={{ color: '#F5F0E8' }}>Password updated!</p>
              <p className="text-[13px]" style={{ color: 'rgba(245,240,232,0.5)' }}>Redirecting you to sign in...</p>
            </div>
          ) : (
            <>
              {error && <div className="mb-4 p-3 rounded-xl text-[13px]" style={{ background: 'rgba(212,98,26,0.1)', border: '1px solid rgba(212,98,26,0.2)', color: '#D4621A' }}>{error}</div>}
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="text-[12px] font-medium mb-1.5 block" style={{ color: 'rgba(245,240,232,0.5)' }}>New Password</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} placeholder="Min 6 characters"
                    className="w-full px-4 py-3 rounded-xl text-[14px] focus:outline-none transition"
                    style={{ background: '#1B2E50', border: '1px solid rgba(232,168,56,0.12)', color: '#F5F0E8' }}
                    onFocus={e => e.target.style.borderColor = '#E8A838'} onBlur={e => e.target.style.borderColor = 'rgba(232,168,56,0.12)'} />
                </div>
                <div>
                  <label className="text-[12px] font-medium mb-1.5 block" style={{ color: 'rgba(245,240,232,0.5)' }}>Confirm Password</label>
                  <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required placeholder="Type it again"
                    className="w-full px-4 py-3 rounded-xl text-[14px] focus:outline-none transition"
                    style={{ background: '#1B2E50', border: '1px solid rgba(232,168,56,0.12)', color: '#F5F0E8' }}
                    onFocus={e => e.target.style.borderColor = '#E8A838'} onBlur={e => e.target.style.borderColor = 'rgba(232,168,56,0.12)'} />
                </div>
                <button type="submit" disabled={loading} className="w-full py-3 rounded-xl text-[14px] font-bold transition hover:brightness-110 disabled:opacity-50" style={{ background: '#E8622A', color: 'white' }}>
                  {loading ? 'Updating...' : 'Reset Password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function AuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth() as any;

  useEffect(() => {
    const token = params.get('token');
    const isNew = params.get('isNew') === 'true';

    if (token) {
      localStorage.setItem('token', token);
      refreshUser?.().then(() => {
        navigate(isNew ? '/welcome' : '/basecamp', { replace: true });
      }).catch(() => {
        navigate('/basecamp', { replace: true });
      });
    } else {
      navigate('/login?error=oauth', { replace: true });
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: '#0F1C35' }}>
      <img src="/images/Logo_RVUnicorn.png" alt="RVUnicorn" className="w-16 h-16 rounded-full mb-4" />
      <div className="animate-spin w-8 h-8 border-b-2 rounded-full mb-4" style={{ borderColor: '#E8A838' }} />
      <p className="text-sm" style={{ color: '#E8A838' }}>Getting your campfire ready... {'\u{1F525}'}</p>
    </div>
  );
}

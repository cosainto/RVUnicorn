import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function CheckInPage() {
  const { qrToken } = useParams<{ qrToken: string }>();
  const { user } = useAuth() as any;
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleCheckIn = async () => {
    setChecking(true);
    try {
      const { data } = await api.post(`/events-v2/checkin-scan/${qrToken}`);
      setResult(data);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Check-in failed');
    } finally { setChecking(false); }
  };

  if (!user) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 text-center max-w-sm w-full shadow-lg">
        <div className="text-4xl mb-3">🏕️</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Log in to check in</h2>
        <p className="text-sm text-gray-500 mb-4">You need an RVUnicorn account to check in to this event.</p>
        <Link to="/login" className="block bg-orange-500 text-white py-3 rounded-xl font-semibold hover:bg-orange-600 transition">Log In</Link>
        <Link to="/register" className="block mt-2 text-sm text-gray-500 hover:text-gray-700">Create an account</Link>
      </div>
    </div>
  );

  if (result) return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
      <Helmet><title>Checked In! — RVUnicorn</title></Helmet>
      <div className="bg-white rounded-2xl p-8 text-center max-w-sm w-full shadow-lg">
        <div className="text-5xl mb-3">🎉</div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">You're checked in!</h2>
        <p className="text-sm text-gray-500 mb-4">Welcome to {result.event?.title}</p>
        <Link to={`/events-v2/${result.event?.id}`} className="block bg-[#1B2B4B] text-white py-3 rounded-xl font-semibold hover:bg-[#2d4a7a] transition">
          Go to Event →
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Helmet><title>Check In — RVUnicorn</title></Helmet>
      <div className="bg-white rounded-2xl p-8 text-center max-w-sm w-full shadow-lg">
        <div className="text-4xl mb-3">🏕️</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Event Check-In</h2>
        <p className="text-sm text-gray-500 mb-6">Tap below to confirm your arrival</p>
        {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
        <button onClick={handleCheckIn} disabled={checking}
          className="w-full bg-green-600 text-white py-3 rounded-xl font-bold text-lg hover:bg-green-700 disabled:opacity-50 transition">
          {checking ? 'Checking in...' : '✓ Check Me In'}
        </button>
      </div>
    </div>
  );
}

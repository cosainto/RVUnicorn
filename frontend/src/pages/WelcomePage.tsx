import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import OnboardingWizard from '../components/OnboardingWizard';
import api from '../services/api';

export default function WelcomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      if (!user) {
        navigate('/login');
        return;
      }

      try {
        const { data } = await api.get('/onboarding/status');
        if (data.completed) {
          navigate('/');
        } else {
          setNeedsOnboarding(true);
        }
      } catch (error) {
        console.error('Check onboarding error:', error);
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    checkStatus();
  }, [user, navigate]);

  const handleComplete = async () => {
    navigate('/');
  };

  const handleSkip = async () => {
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-twilight-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!needsOnboarding) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-twilight-900">
      <OnboardingWizard onComplete={handleComplete} onSkip={handleSkip} />
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import OnboardingWizard from '../components/OnboardingWizard';
import api from '../services/api';

export default function WelcomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      if (!user) {
        navigate('/login');
        return;
      }

      try {
        const { data } = await api.get('/onboarding/status');
        if (data.completed) {
          // Already completed onboarding, go to basecamp
          navigate('/');
        } else {
          // Needs onboarding
          setShowWizard(true);
        }
      } catch (error) {
        // API failed - show wizard anyway for new users
        console.error('Check onboarding error:', error);
        setShowWizard(true);
      } finally {
        setLoading(false);
      }
    };

    checkStatus();
  }, [user, navigate]);

  const handleComplete = async () => {
    // Chain into Rig Profile setup after general onboarding
    navigate('/rv-setup');
  };

  const handleSkip = async () => {
    // Mark onboarding as skipped/completed
    try {
      await api.put('/onboarding/skip');
    } catch (error) {
      console.error('Skip onboarding error:', error);
    }
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-twilight-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!showWizard) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-twilight-900">
      <OnboardingWizard onComplete={handleComplete} onSkip={handleSkip} />
    </div>
  );
}

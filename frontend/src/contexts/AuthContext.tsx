import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../services/api';

interface User {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  profilePicture?: string;
  bio?: string;
  isCreator?: boolean;
  role?: string;
  instagramUrl?: string;
  facebookUrl?: string;
  twitterUrl?: string;
  redditUrl?: string;
  tiktokUrl?: string;
  youtubeUrl?: string;
  blueskyUrl?: string;
  rvLength?: number;
  campingInterests?: string[];
  rvShorepower?: string;
  rvType?: string;
  rvMake?: string;
  rvModel?: string;
  rvYear?: number;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string, firstName: string, lastName: string, phone?: string, inviteToken?: string, smsConsent?: boolean, smsConsentTimestamp?: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
     const { data } = await api.get('/auth/me');
     setUser(data); // The response IS the user, not data.user    

     } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('token');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    setUser(data.user);
  };

  const register = async (email: string, username: string, password: string, firstName: string, lastName: string, phone?: string, inviteToken?: string, smsConsent?: boolean, smsConsentTimestamp?: string) => {
    const { data } = await api.post('/auth/register', {
      email, username, password, firstName, lastName,
      ...(phone ? { phoneNumber: phone } : {}),
      ...(inviteToken ? { inviteToken } : {}),
      ...(smsConsent !== undefined ? { smsConsent, smsConsentTimestamp } : {}),
    });
    localStorage.setItem('token', data.token);
    setUser(data.user);
    // Meta Pixel: track new sign-up
    if (typeof window !== 'undefined' && (window as any).fbq) {
      (window as any).fbq('track', 'CompleteRegistration');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    // Clear driving session state so Co-Pilot doesn't bleed across accounts
    localStorage.removeItem('rvunicorn_driving');
    localStorage.removeItem('rvunicorn_drive_start');
    localStorage.removeItem('rvunicorn_drive_role');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser: checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

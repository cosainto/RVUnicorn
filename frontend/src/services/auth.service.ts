import api from './api';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  username: string;
  role: string;
  profilePicture?: string;
  bio?: string;
  location?: string;
  rvType?: string;
  rvYear?: number;
  rvMake?: string;
  rvModel?: string;
  rvLength?: number;
  rvShorepower?: string;
  rvName?: string;
  statesVisited?: string[];
  totalStays?: number;
}

export const authService = {
  async login(email: string, password: string) {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data.user;
  },

  async register(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    username: string;
    inviteCode: string;
  }) {
    const { data } = await api.post('/auth/register', userData);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data.user;
  },

  async getCurrentUser(): Promise<User> {
    const { data } = await api.get('/auth/me');
    localStorage.setItem('user', JSON.stringify(data));
    return data;
  },

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  },

  getStoredUser(): User | null {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem('token');
  },

  async createInvite(email: string) {
    const { data } = await api.post('/auth/invite', { email });
    return data;
  },
};

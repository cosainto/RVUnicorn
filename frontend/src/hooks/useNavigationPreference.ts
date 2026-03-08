import { useState, useEffect } from 'react';
import type { NavApp } from '../components/NavigationButtons';

const KEY = 'rvunicorn_nav_preference';

export function useNavigationPreference() {
  const [preference, setPreferenceState] = useState<NavApp>(() => {
    return (localStorage.getItem(KEY) as NavApp) || 'waze';
  });

  const setPreference = (app: NavApp) => {
    localStorage.setItem(KEY, app);
    setPreferenceState(app);
  };

  return { preference, setPreference };
}

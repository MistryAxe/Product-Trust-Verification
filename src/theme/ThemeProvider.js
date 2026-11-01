import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import { applyColorScheme } from './colors';
import { refreshStyles } from './styles';

// The appearance choice belongs to the signed-in person, not to the phone, so an
// admin choosing dark mode never changes a customer's or manufacturer's screen.
const STORAGE_PREFIX = 'productTrustAppearance';
const ThemeContext = createContext({ mode: 'system', resolved: 'dark', setMode: () => {} });

function resolveMode(mode, system) {
  if (mode === 'light' || mode === 'dark') return mode;
  return system === 'light' ? 'light' : 'dark';
}

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState('system');
  const [system, setSystem] = useState(Appearance.getColorScheme() || 'dark');
  const [uid, setUid] = useState(auth.currentUser?.uid || null);
  const resolved = resolveMode(mode, system);
  const storageKey = `${STORAGE_PREFIX}:${uid || 'guest'}`;

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => setSystem(colorScheme || 'dark'));
    return () => subscription.remove();
  }, []);

  // Follow who is signed in.
  useEffect(() => onAuthStateChanged(auth, (user) => setUid(user?.uid || null)), []);

  // Load that person's saved choice (default: follow the device).
  useEffect(() => {
    let cancelled = false;
    setModeState('system');
    AsyncStorage.getItem(storageKey).then((saved) => {
      if (!cancelled && ['light', 'dark', 'system'].includes(saved)) setModeState(saved);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [storageKey]);

  applyColorScheme(resolved);
  refreshStyles();

  const setMode = async (next) => {
    const safe = ['light', 'dark', 'system'].includes(next) ? next : 'system';
    setModeState(safe);
    try { await AsyncStorage.setItem(storageKey, safe); } catch (_) {}
  };

  const value = useMemo(() => ({ mode, resolved, setMode }), [mode, resolved, storageKey]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

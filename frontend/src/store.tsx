/**
 * Combined Auth + Theme React context.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Appearance } from "react-native";
import { getMe, loadToken, setToken } from "./api";
import { ThemeMode, pickColors } from "./theme";

type User = {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  avatar?: string | null;
  bio?: string | null;
  online?: boolean;
  two_factor_enabled?: boolean;
};

type AuthCtx = {
  user: User | null;
  ready: boolean;
  setUser: (u: User | null) => void;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx>({
  user: null,
  ready: false,
  setUser: () => {},
  refresh: async () => {},
  signOut: async () => {},
});

type ThemeCtx = {
  mode: ThemeMode;
  colors: ReturnType<typeof pickColors>;
  toggle: () => void;
  setMode: (m: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeCtx>({
  mode: "light",
  colors: pickColors("light"),
  toggle: () => {},
  setMode: () => {},
});

const THEME_KEY = "cipherlink.theme";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setModeState] = useState<ThemeMode>(
    (Appearance.getColorScheme() as ThemeMode) || "light"
  );

  // Boot: load token + theme + me
  useEffect(() => {
    (async () => {
      const t = await loadToken();
      const savedTheme = (await AsyncStorage.getItem(THEME_KEY)) as ThemeMode | null;
      if (savedTheme) setModeState(savedTheme);
      if (t) {
        try {
          const me = await getMe();
          setUserState(me);
        } catch {
          await setToken(null);
        }
      }
      setReady(true);
    })();
  }, []);

  const refresh = useCallback(async () => {
    try {
      const me = await getMe();
      setUserState(me);
    } catch {
      setUserState(null);
    }
  }, []);

  const signOut = useCallback(async () => {
    await setToken(null);
    setUserState(null);
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem(THEME_KEY, m).catch(() => {});
  }, []);
  const toggle = useCallback(() => setMode(mode === "light" ? "dark" : "light"), [mode, setMode]);

  const themeValue = useMemo<ThemeCtx>(
    () => ({ mode, colors: pickColors(mode), toggle, setMode }),
    [mode, toggle, setMode]
  );

  const authValue = useMemo<AuthCtx>(
    () => ({ user, ready, setUser: setUserState, refresh, signOut }),
    [user, ready, refresh, signOut]
  );

  return (
    <ThemeContext.Provider value={themeValue}>
      <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>
    </ThemeContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
export const useTheme = () => useContext(ThemeContext);

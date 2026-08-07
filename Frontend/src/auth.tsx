import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authApi, tokenStore } from './api';
import type { User } from './types';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));

  useEffect(() => {
    if (!tokenStore.get()) return;
    authApi.me().then(({ data }) => setUser(data)).catch(tokenStore.clear).finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    login: async (email, password) => {
      const { data } = await authApi.login(email, password);
      tokenStore.set(data.token);
      setUser(data.user);
    },
    logout: () => { tokenStore.clear(); setUser(null); }
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

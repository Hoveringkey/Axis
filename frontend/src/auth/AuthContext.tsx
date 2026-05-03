/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { resetSessionExpiredEvent, SESSION_EXPIRED_EVENT } from '../api/axios';
import { clearTokens, hasAccessToken, setTokens } from './tokenStorage';

export type PermissionKey = 'can_access_payroll' | 'can_manage_payroll' | 'can_capture_hr';

export interface CurrentUser {
  username: string;
  is_superuser: boolean;
  groups: string[];
  permissions: Record<PermissionKey, boolean>;
}

interface LoginResponse {
  access: string;
  refresh: string;
}

interface AuthContextValue {
  user: CurrentUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  loadCurrentUser: () => Promise<CurrentUser | null>;
  hasPermission: (permission: PermissionKey) => boolean;
  hasGroup: (groups: string[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    setIsLoading(false);
  }, []);

  const loadCurrentUser = useCallback(async () => {
    if (!hasAccessToken()) {
      setUser(null);
      setIsLoading(false);
      return null;
    }

    setIsLoading(true);
    try {
      const response = await api.get<CurrentUser>('/api/auth/me/');
      setUser(response.data);
      resetSessionExpiredEvent();
      return response.data;
    } catch {
      if (!hasAccessToken()) {
        setUser(null);
      }
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const response = await api.post<LoginResponse>('/api/token/', { username, password });
    setTokens(response.data);
    resetSessionExpiredEvent();
    await loadCurrentUser();
  }, [loadCurrentUser]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadCurrentUser();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadCurrentUser]);

  useEffect(() => {
    const handleSessionExpired = () => {
      logout();
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, [logout]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isAuthenticated: Boolean(user),
    isLoading,
    login,
    logout,
    loadCurrentUser,
    hasPermission: (permission) => Boolean(user?.permissions[permission]),
    hasGroup: (groups) => Boolean(user?.is_superuser || user?.groups.some(group => groups.includes(group))),
  }), [user, isLoading, login, logout, loadCurrentUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { apiFetch } from '../services/api';

interface User {
  id: number;
  email: string;
  role: string;
  must_change_password?: boolean;
  full_name?: string;
  employee_id?: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    try {
      const me = await apiFetch<User>('/auth/me');
      setUser(me);
    } catch {
      await logout();
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const storedToken = await SecureStore.getItemAsync('hcmlite_token');
        if (storedToken) {
          setToken(storedToken);
          const me = await apiFetch<User>('/auth/me');
          setUser(me);
        }
      } catch {
        // Failed to load token
      } finally {
        setIsLoading(false);
      }
    };
    bootstrap();
  }, []);

  const login = async (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    await SecureStore.setItemAsync('hcmlite_token', newToken);
  };

  const logout = async () => {
    setToken(null);
    setUser(null);
    try {
      await SecureStore.deleteItemAsync('hcmlite_token');
    } catch {}
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

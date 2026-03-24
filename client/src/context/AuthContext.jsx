import React, { createContext, useContext, useMemo, useState } from 'react';
import * as authApi from '../api/auth.api';

export const AuthContext = createContext(null);

function readStoredAuth() {
  try {
    const token = localStorage.getItem('token');
    const rawUser = localStorage.getItem('oems_user');
    const user = rawUser ? JSON.parse(rawUser) : null;
    return { token, user };
  } catch (_error) {
    return { token: null, user: null };
  }
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export default function AuthProvider({ children }) {
  const stored = useMemo(() => readStoredAuth(), []);
  const [user, setUser] = useState(stored.user);
  const [token, setToken] = useState(stored.token);
  const [error, setError] = useState('');

  const login = async (username, password) => {
    setError('');
    const res = await authApi.login({ username, password });
    const { token, user: u } = res.data;
    localStorage.setItem('token', token);
    localStorage.setItem('oems_user', JSON.stringify(u));
    setToken(token);
    setUser(u);
    return res.data;
  };

  const register = async (email, password, firstName, lastName) => {
    setError('');
    const res = await authApi.register({ email, password, firstName, lastName });
    const { token, user: u } = res.data;
    localStorage.setItem('token', token);
    localStorage.setItem('oems_user', JSON.stringify(u));
    setToken(token);
    setUser(u);
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('oems_user');
    setToken(null);
    setUser(null);
  };

  const value = useMemo(() => ({
    user,
    token,
    isAuthenticated: Boolean(token),
    role: user?.role || null,
    login,
    register,
    logout,
    error
  }), [user, token, error]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

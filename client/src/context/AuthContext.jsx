import React, { createContext, useContext, useState } from 'react';
import * as authApi from '../api/auth.api';

export const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');

  const login = async (username, password) => {
    setError('');
    const res = await authApi.login({ username, password });
    const { token, user: u } = res.data;
    localStorage.setItem('token', token);
    setUser(u);
    return res.data;
  };

  const register = async (email, password, firstName, lastName) => {
    setError('');
    const res = await authApi.register({ email, password, firstName, lastName });
    const { token, user: u } = res.data;
    localStorage.setItem('token', token);
    setUser(u);
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, error }}>
      {children}
    </AuthContext.Provider>
  );
}

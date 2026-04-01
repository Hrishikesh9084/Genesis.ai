import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('genesis_token');
    if (token) {
      api.get('/auth/me')
        .then((res) => setUser(res.data.user))
        .catch(() => {
          localStorage.removeItem('genesis_token');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('genesis_token', res.data.token);
    setUser(res.data.user);
    return res.data;
  };

  const register = async (name, email, password) => {
    const res = await api.post('/auth/register', { name, email, password });
    return res.data;
  };

  const loginWithToken = async (token) => {
    localStorage.setItem('genesis_token', token);
    try {
      const res = await api.get('/auth/me');
      setUser(res.data.user);
    } catch {
      localStorage.removeItem('genesis_token');
    }
  };

  const refreshUser = async () => {
    const res = await api.get('/auth/me');
    setUser(res.data.user);
    return res.data.user;
  };

  const updateProfile = async (payload) => {
    const res = await api.put('/auth/profile', payload);
    setUser(res.data.user);
    return res.data.user;
  };

  const uploadProfileImage = async (file) => {
    const formData = new FormData();
    formData.append('avatar', file);

    const res = await api.post('/auth/profile-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    setUser(res.data.user);
    return res.data.user;
  };

  const logout = () => {
    localStorage.removeItem('genesis_token');
    setUser(null);
  };

  const deleteAccount = async () => {
    await api.delete('/auth/account');
    localStorage.removeItem('genesis_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginWithToken, refreshUser, updateProfile, uploadProfileImage, logout, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

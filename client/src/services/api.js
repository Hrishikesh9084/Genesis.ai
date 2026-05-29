import axios from 'axios';

const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const isLocalhost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

function getEnvUrlCandidates(value) {
  const raw = String(value || '').trim();
  if (!raw) return [];

  return raw
    .split(/\|\||,/)
    .map((segment) => segment.trim())
    .map((segment) => segment.replace(/^['\"]+|['\"]+$/g, '').trim())
    .filter(Boolean);
}

function normalizeBaseUrl(value) {
  try {
    return new URL(String(value).trim()).toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

function isLocalhostUrl(value) {
  try {
    const parsed = new URL(String(value).trim());
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

const computedFallbackApiBaseUrl = isLocalhost
  ? 'http://localhost:5000/api'
  : `${typeof window !== 'undefined' ? window.location.origin : ''}/api`;

const envUrlCandidates = getEnvUrlCandidates(rawApiBaseUrl)
  .map((candidate) => normalizeBaseUrl(candidate))
  .filter(Boolean);

const preferredLocalUrl = envUrlCandidates.find((candidate) => isLocalhostUrl(candidate));
const preferredRemoteUrl = envUrlCandidates.find((candidate) => !isLocalhostUrl(candidate));

export const API_BASE_URL =
  (isLocalhost
    ? preferredLocalUrl || preferredRemoteUrl || computedFallbackApiBaseUrl
    : preferredRemoteUrl || preferredLocalUrl || computedFallbackApiBaseUrl).replace(/\/+$/, '');

export const GITHUB_OAUTH_URL = `${API_BASE_URL}/auth/github`;
export const GOOGLE_OAUTH_URL = `${API_BASE_URL}/auth/google`;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('genesis_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const AUTH_EXEMPT_PATHS = ['/login', '/register', '/auth/github/callback', '/auth/google/callback', '/'];

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const isAuthRoute = error.config?.url?.includes('/auth/login') ||
        error.config?.url?.includes('/auth/register');

      if (!isAuthRoute) {
        localStorage.removeItem('genesis_token');
        const currentPath = window.location.pathname;
        if (!AUTH_EXEMPT_PATHS.includes(currentPath)) {
          window.location.replace('/login');
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;

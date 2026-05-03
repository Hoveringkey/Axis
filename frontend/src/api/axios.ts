import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
} from '../auth/tokenStorage';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
export const SESSION_EXPIRED_EVENT = 'axis:session-expired';

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

let sessionExpiredDispatched = false;

export const resetSessionExpiredEvent = () => {
  sessionExpiredDispatched = false;
};

const dispatchSessionExpired = () => {
  if (sessionExpiredDispatched) return;
  sessionExpiredDispatched = true;
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
};

const isTokenEndpoint = (url?: string) => {
  if (!url) return false;
  return url.includes('/api/token/') || url.includes('/api/token/refresh/');
};

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to add the Authorization header to outgoing requests
api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;

    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      isTokenEndpoint(originalRequest.url)
    ) {
      return Promise.reject(error);
    }

    const refresh = getRefreshToken();
    if (!refresh) {
      clearTokens();
      dispatchSessionExpired();
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const response = await axios.post<{ access: string }>(
        `${baseURL}/api/token/refresh/`,
        { refresh },
        { headers: { 'Content-Type': 'application/json' } }
      );
      setAccessToken(response.data.access);
      originalRequest.headers['Authorization'] = `Bearer ${response.data.access}`;
      return api(originalRequest);
    } catch (refreshError) {
      clearTokens();
      dispatchSessionExpired();
      return Promise.reject(refreshError);
    }
  }
);

export default api;

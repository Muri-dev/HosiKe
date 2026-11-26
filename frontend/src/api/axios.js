import axios from 'axios';

// Use VITE_API_URL if configured; otherwise default to relative '/api' on the same domain (Vercel services routing)
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => {
    const method = (response.config?.method || '').toLowerCase();
    const url = response.config?.url || '';
    if (['post', 'put', 'patch', 'delete'].includes(method) && !url.includes('/ai/chat') && !url.includes('/auth/')) {
      window.dispatchEvent(new CustomEvent('hosike:data-updated', { detail: { url, method } }));
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Put a flag to prevent infinite loops
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');

      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh/`, {
            refresh: refreshToken,
          });
          
          if (response.status === 200) {
            localStorage.setItem('access_token', response.data.access);
            api.defaults.headers.common['Authorization'] = `Bearer ${response.data.access}`;
            originalRequest.headers['Authorization'] = `Bearer ${response.data.access}`;
            return api(originalRequest);
          }
        } catch (refreshError) {
          // Refresh failed, logout
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
        }
      } else {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

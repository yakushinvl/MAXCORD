export const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:5000';
    }
  }
  return 'https://maxcord.fun';
};

export const API_URL = import.meta.env.VITE_API_URL || getBaseUrl();
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || getBaseUrl();

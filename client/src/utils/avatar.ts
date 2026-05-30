import { API_URL } from './config';

export const getAvatarUrl = (avatar: string | null | undefined): string | null => {
  if (!avatar) return null;

  if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
    return avatar;
  }

  if (avatar.startsWith('/api/uploads')) {
    return `${API_URL}${avatar}`;
  }

  if (avatar.startsWith('/')) {
    return `${API_URL}${avatar}`;
  }

  return `${API_URL}/api/uploads/${avatar}`;
};

export const getFullUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  if (url.startsWith('/')) return `${API_URL}${url}`;
  return `${API_URL}/api/uploads/${url}`;
};

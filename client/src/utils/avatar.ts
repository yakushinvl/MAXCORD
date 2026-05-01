const API_URL = import.meta.env.VITE_API_URL || 'https://maxcord.fun';

export const getAvatarUrl = (avatar: string | null | undefined): string | null => {
  if (!avatar) return null;

  // If avatar is already a full URL, return it
  if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
    return avatar;
  }

  // If avatar starts with /api/uploads, it's a relative path from server
  if (avatar.startsWith('/api/uploads')) {
    return `${API_URL}${avatar}`;
  }

  // If avatar starts with /, it's a relative path
  if (avatar.startsWith('/')) {
    return `${API_URL}${avatar}`;
  }

  // Otherwise, assume it's a filename and construct the path
  return `${API_URL}/api/uploads/${avatar}`;
};

export const getFullUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  if (url.startsWith('/')) return `${API_URL}${url}`;
  return `${API_URL}/api/uploads/${url}`;
};











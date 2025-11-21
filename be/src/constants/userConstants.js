export const DEFAULT_AVATAR_URL =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgdmlld0JveD0iMCAwIDI1NiAyNTYiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjI1NiIgaGVpZ2h0PSIyNTYiIHJ4PSIxMjgiIGZpbGw9IiM0ZDRmNTIiLz48Y2lyY2xlIGN4PSIxMjgiIGN5PSI5NiIgcj0iNTYiIGZpbGw9IiNmMmYyZjIiLz48cGF0aCBkPSJNNDggMjI0YzAtNDQuMTgzIDM1LjgxNy04MCA4MC04MHM4MCAzNS44MTcgODAgODAiIGZpbGw9IiNmMmYyZjIiLz48L3N2Zz4=';

export const normalizeAvatarUrl = (avatarUrl) => {
  if (!avatarUrl || typeof avatarUrl !== 'string' || avatarUrl.trim() === '') {
    return DEFAULT_AVATAR_URL;
  }

  return avatarUrl.trim();
};


import api from "./api";

export const getChords = async (options = {}) => {
  const { basicOnly = false, limit, skip = 0, key } = options;
  const params = new URLSearchParams();
  
  if (basicOnly) params.append('basicOnly', 'true');
  if (limit) params.append('limit', limit.toString());
  if (skip) params.append('skip', skip.toString());
  if (key) params.append('key', key);
  
  const queryString = params.toString();
  const url = `/chords${queryString ? `?${queryString}` : ''}`;
  
  const response = await api.get(url);
  return {
    chords: response.data?.data || [],
    total: response.data?.total || 0,
    limit: response.data?.limit || null,
    skip: response.data?.skip || 0,
  };
};

import api from '../api';

export const getMyProfile = async () => {
  const { data } = await api.get('/users/profile');
  return data;
};

export const getProfileById = async (userId) => {
  if (!userId) throw new Error('userId is required');
  const { data } = await api.get(`/users/${userId}`);
  return data;
};

export const updateMyProfile = async (payload) => {
  const { data } = await api.put('/users/profile', payload);
  return data;
};

export const uploadMyAvatar = async (file) => {
  // Antd Upload có thể trả về file wrapper, lấy originFileObj nếu có
  const fileToUpload = file?.originFileObj || file;
  
  if (!fileToUpload) {
    throw new Error('No file provided');
  }
  
  // CHỈ gửi file avatar với field name là 'avatar' (KHÔNG phải 'avatarUrl')
  // Multer ở BE chỉ nhận field name 'avatar'
  const form = new FormData();
  form.append('avatar', fileToUpload); // QUAN TRỌNG: field name phải là 'avatar'
  // KHÔNG append các field khác ở đây (sẽ gửi riêng qua JSON khi Save changes)
  
  // Debug: Log tất cả fields trong FormData để verify
  console.log('[Upload Avatar] FormData entries:');
  for (const [key, value] of form.entries()) {
    console.log(`  - ${key}:`, value instanceof File ? `File(${value.name}, ${value.size} bytes)` : value);
  }
  
  // Verify field name
  if (!form.has('avatar')) {
    throw new Error('FormData must have field "avatar" (not "avatarUrl")');
  }
  
  console.log('[Upload Avatar] Sending file only:', {
    name: fileToUpload.name,
    size: fileToUpload.size,
    type: fileToUpload.type
  });
  
  const { data } = await api.post('/users/profile/avatar', form);
  
  console.log('[Upload Avatar] Response:', data);
  return data;
};

export const uploadMyCoverPhoto = async (file) => {
  // Antd Upload có thể trả về file wrapper, lấy originFileObj nếu có
  const fileToUpload = file?.originFileObj || file;
  
  if (!fileToUpload) {
    throw new Error('No file provided');
  }
  
  // Gửi file cover photo với field name là 'coverPhoto'
  const form = new FormData();
  form.append('coverPhoto', fileToUpload); // QUAN TRỌNG: field name phải là 'coverPhoto'
  
  // Debug: Log tất cả fields trong FormData để verify
  console.log('[Upload Cover Photo] FormData entries:');
  for (const [key, value] of form.entries()) {
    console.log(`  - ${key}:`, value instanceof File ? `File(${value.name}, ${value.size} bytes)` : value);
  }
  
  // Verify field name
  if (!form.has('coverPhoto')) {
    throw new Error('FormData must have field "coverPhoto"');
  }
  
  console.log('[Upload Cover Photo] Sending file only:', {
    name: fileToUpload.name,
    size: fileToUpload.size,
    type: fileToUpload.type
  });
  
  const { data } = await api.post('/users/profile/cover-photo', form);
  
  console.log('[Upload Cover Photo] Response:', data);
  return data;
};

export const followUser = async (userId) => {
  if (!userId) throw new Error('userId is required');
  const { data } = await api.post(`/users/${userId}/follow`);
  return data;
};

export const unfollowUser = async (userId) => {
  if (!userId) throw new Error('userId is required');
  const { data } = await api.delete(`/users/${userId}/follow`);
  return data;
};

export const getFollowSuggestions = async (limit = 5) => {
  const { data } = await api.get(`/users/suggestions/list`, { params: { limit } });
  return data;
};

export const getFollowingList = async (search = '', limit = 50) => {
  const { data } = await api.get(`/users/following`, { params: { search, limit } });
  return data;
};

export default { getMyProfile, updateMyProfile, uploadMyAvatar, uploadMyCoverPhoto, followUser, unfollowUser, getFollowSuggestions, getFollowingList };



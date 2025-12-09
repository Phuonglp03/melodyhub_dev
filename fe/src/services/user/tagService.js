import api from "../api";

export const fetchTagsGrouped = async () => {
  const res = await api.get('/tags');
  return res.data;
};

export const upsertTags = async (items) => {
  const res = await api.post('/tags/bulk-upsert', { items });
  return res.data;
};

export const replaceContentTags = async (contentType, contentId, tagIds) => {
  const res = await api.put(`/tags/content/${contentType}/${contentId}`, { tagIds });
  return res.data;
};

// Search/suggest tags - returns all tags when q is empty, filtered tags when q has characters
export const searchTags = async (query = "") => {
  try {
    const res = await api.get('/tags/search', {
      params: { q: query }
    });
    return res.data;
  } catch (error) {
    console.error("Error searching tags:", error);
    throw error;
  }
};
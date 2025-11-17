import { API_CONFIG } from "../../config/api";

const API_BASE_URL = API_CONFIG.API_BASE_URL || "http://localhost:9999";
const API_BASE = API_BASE_URL.endsWith("/api")
  ? API_BASE_URL
  : `${API_BASE_URL}/api`;

export const fetchTagsGrouped = async () => {
  const res = await fetch(`${API_BASE}/tags`);
  if (!res.ok) throw new Error(`Failed to load tags: ${res.status}`);
  return res.json();
};

export const upsertTags = async (items) => {
  const res = await fetch(`${API_BASE}/tags/bulk-upsert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) throw new Error(`Failed to upsert tags: ${res.status}`);
  return res.json();
};

export const replaceContentTags = async (contentType, contentId, tagIds) => {
  const res = await fetch(
    `${API_BASE}/tags/content/${contentType}/${contentId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagIds }),
    }
  );
  if (!res.ok) throw new Error(`Failed to update tags: ${res.status}`);
  return res.json();
};

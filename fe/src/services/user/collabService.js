import api from "../api";

export const fetchCollabState = async (projectId, fromVersion = 0) => {
  if (!projectId) {
    throw new Error("projectId is required");
  }

  const response = await api.get(`/projects/${projectId}/collab/state`, {
    params: { fromVersion },
  });

  return response.data?.data;
};







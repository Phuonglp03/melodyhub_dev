import { createSlice } from "@reduxjs/toolkit";

// Local-only like state for licks (optimistic UI)
// State shape: { byId: { [lickId]: { liked: boolean, count: number } } }
const initialState = {
  byId: {},
};

const likesSlice = createSlice({
  name: "likes",
  initialState,
  reducers: {
    setLikeState: (state, action) => {
      const { id, liked, count } = action.payload;
      if (!id) return;
      state.byId[id] = {
        liked: Boolean(liked),
        count: typeof count === "number" ? count : 0,
      };
    },
    toggleLikeLocal: (state, action) => {
      const { id } = action.payload || {};
      if (!id) return;
      const current = state.byId[id] || { liked: false, count: 0 };
      const nextLiked = !current.liked;
      const nextCount = Math.max(
        0,
        (current.count || 0) + (nextLiked ? 1 : -1)
      );
      state.byId[id] = { liked: nextLiked, count: nextCount };
    },
    resetLikes: (state) => {
      state.byId = {};
    },
  },
});

export const { setLikeState, toggleLikeLocal, resetLikes } = likesSlice.actions;
export default likesSlice.reducer;

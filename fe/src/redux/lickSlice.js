import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import {
  getCommunityLicks,
  getLickById,
  toggleLickLike,
  getLickComments,
  addLickComment,
} from "../services/user/lickService";

// Async thunks
export const fetchCommunityLicks = createAsyncThunk(
  "lick/fetchCommunityLicks",
  async (params = {}) => {
    const response = await getCommunityLicks(params);
    return response;
  }
);

export const fetchLickById = createAsyncThunk(
  "lick/fetchLickById",
  async (lickId) => {
    const response = await getLickById(lickId);
    return response;
  }
);

export const likeLick = createAsyncThunk(
  "lick/likeLick",
  async ({ lickId, userId }) => {
    const response = await toggleLickLike(lickId, userId);
    return { lickId, response };
  }
);

export const fetchLickComments = createAsyncThunk(
  "lick/fetchLickComments",
  async ({ lickId, page = 1, limit = 10 }) => {
    const response = await getLickComments(lickId, page, limit);
    return response;
  }
);

export const postLickComment = createAsyncThunk(
  "lick/postLickComment",
  async ({ lickId, commentData }) => {
    const response = await addLickComment(lickId, commentData);
    return response;
  }
);

const lickSlice = createSlice({
  name: "lick",
  initialState: {
    // Community licks
    communityLicks: [],
    communityLoading: false,
    communityError: null,
    communityPagination: {
      currentPage: 1,
      totalPages: 1,
      totalItems: 0,
      hasNextPage: false,
      hasPrevPage: false,
    },

    // Current lick detail
    currentLick: null,
    currentLickLoading: false,
    currentLickError: null,

    // Comments
    comments: [],
    commentsLoading: false,
    commentsError: null,
    commentsPagination: {
      currentPage: 1,
      totalPages: 1,
      totalItems: 0,
      hasNextPage: false,
      hasPrevPage: false,
    },

    // Filters and search
    filters: {
      search: "",
      tags: "",
      sortBy: "newest",
    },
  },
  reducers: {
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearCurrentLick: (state) => {
      state.currentLick = null;
      state.currentLickError = null;
    },
    clearComments: (state) => {
      state.comments = [];
      state.commentsError = null;
    },
    updateLickInList: (state, action) => {
      const { lickId, updates } = action.payload;
      const index = state.communityLicks.findIndex(
        (lick) => lick.lick_id === lickId
      );
      if (index !== -1) {
        state.communityLicks[index] = {
          ...state.communityLicks[index],
          ...updates,
        };
      }
    },
  },
  extraReducers: (builder) => {
    // Fetch community licks
    builder
      .addCase(fetchCommunityLicks.pending, (state) => {
        state.communityLoading = true;
        state.communityError = null;
      })
      .addCase(fetchCommunityLicks.fulfilled, (state, action) => {
        state.communityLoading = false;
        state.communityLicks = action.payload.data;
        state.communityPagination = action.payload.pagination;
      })
      .addCase(fetchCommunityLicks.rejected, (state, action) => {
        state.communityLoading = false;
        state.communityError = action.error.message;
      });

    // Fetch lick by ID
    builder
      .addCase(fetchLickById.pending, (state) => {
        state.currentLickLoading = true;
        state.currentLickError = null;
      })
      .addCase(fetchLickById.fulfilled, (state, action) => {
        state.currentLickLoading = false;
        state.currentLick = action.payload.data;
      })
      .addCase(fetchLickById.rejected, (state, action) => {
        state.currentLickLoading = false;
        state.currentLickError = action.error.message;
      });

    // Like lick
    builder.addCase(likeLick.fulfilled, (state, action) => {
      const { lickId, response } = action.payload;
      const lick = state.communityLicks.find((l) => l.lick_id === lickId);
      if (lick) {
        lick.likes_count += response.data.liked ? 1 : -1;
      }
      if (state.currentLick && state.currentLick.lick_id === lickId) {
        state.currentLick.likes_count += response.data.liked ? 1 : -1;
      }
    });

    // Fetch comments
    builder
      .addCase(fetchLickComments.pending, (state) => {
        state.commentsLoading = true;
        state.commentsError = null;
      })
      .addCase(fetchLickComments.fulfilled, (state, action) => {
        state.commentsLoading = false;
        state.comments = action.payload.data;
        state.commentsPagination = action.payload.pagination;
      })
      .addCase(fetchLickComments.rejected, (state, action) => {
        state.commentsLoading = false;
        state.commentsError = action.error.message;
      });

    // Post comment
    builder.addCase(postLickComment.fulfilled, (state, action) => {
      state.comments.unshift(action.payload.data);
      if (state.currentLick) {
        state.currentLick.comments_count += 1;
      }
    });
  },
});

export const { setFilters, clearCurrentLick, clearComments, updateLickInList } =
  lickSlice.actions;

export default lickSlice.reducer;

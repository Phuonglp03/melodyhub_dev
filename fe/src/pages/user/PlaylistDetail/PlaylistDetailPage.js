import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  FaSearch,
  FaTimes,
  FaPlus,
  FaEllipsisH,
  FaTrash,
  FaEdit,
  FaLock,
  FaGlobe,
  FaUserPlus,
} from "react-icons/fa";
import {
  getPlaylistById,
  deletePlaylist,
  addLickToPlaylist,
  removeLickFromPlaylist,
  updatePlaylist,
} from "../../../services/user/playlistService";
import {
  getCommunityLicks,
  getMyLicks,
} from "../../../services/user/lickService";
import LickCard from "../../../components/LickCard";
import { useSelector } from "react-redux";

const PlaylistDetailPage = () => {
  const { playlistId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const authUser = useSelector((state) => state.auth.user);
  const [playlist, setPlaylist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [addingLick, setAddingLick] = useState(null);

  // Suggested licks state
  const [suggestedLicks, setSuggestedLicks] = useState([]);
  const [loadingSuggested, setLoadingSuggested] = useState(false);

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", description: "", isPublic: true });
  const [saving, setSaving] = useState(false);

  // Toast notification state
  const [toast, setToast] = useState({
    show: false,
    message: "",
    type: "success",
  });

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    message: "",
    onConfirm: null,
    lickId: null,
  });

  // Memoize existing lick IDs to avoid recalculating on every render
  const existingLickIds = useMemo(
    () => new Set((playlist?.licks || []).map((l) => l.lick_id)),
    [playlist?.licks]
  );

  const fetchPlaylist = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getPlaylistById(playlistId);
      if (res.success) {
        setPlaylist(res.data);
      } else {
        setError("Playlist not found");
      }
    } catch (err) {
      console.error("Error fetching playlist:", err);
      setError(err.message || "Failed to load playlist");
    } finally {
      setLoading(false);
    }
  };

  const loadSuggestedLicks = useCallback(async () => {
    try {
      setLoadingSuggested(true);
      const promises = [];

      // Always load community licks
      promises.push(
        getCommunityLicks({
          sortBy: "popular",
          limit: 12,
        }).catch((err) => {
          console.error("(NO $) [DEBUG] Error loading community licks:", err);
          return { success: false, data: [] };
        })
      );

      // If playlist is private, also load user's private licks
      if (playlist && !playlist.is_public && authUser) {
        promises.push(
          getMyLicks({
            status: "active",
            limit: 12,
          }).catch((err) => {
            console.error("(NO $) [DEBUG] Error loading my licks:", err);
            return { success: false, data: [] };
          })
        );
      }

      // Use allSettled to handle partial failures gracefully
      const results = await Promise.allSettled(promises);
      const communityLicks =
        results[0]?.status === "fulfilled" && results[0].value?.success
          ? results[0].value.data
          : [];
      const myLicks =
        results[1]?.status === "fulfilled" && results[1].value?.success
          ? results[1].value.data
          : [];

      // Use memoized existingLickIds for O(n) duplicate removal
      const uniqueLickMap = new Map();
      [...communityLicks, ...myLicks].forEach((lick) => {
        if (
          !existingLickIds.has(lick.lick_id) &&
          !uniqueLickMap.has(lick.lick_id)
        ) {
          uniqueLickMap.set(lick.lick_id, lick);
        }
      });

      setSuggestedLicks(Array.from(uniqueLickMap.values()));
    } catch (err) {
      console.error("(NO $) [DEBUG] Error loading suggested licks:", err);
      setSuggestedLicks([]);
    } finally {
      setLoadingSuggested(false);
    }
  }, [playlist, authUser, existingLickIds]);

  useEffect(() => {
    fetchPlaylist();

    // Auto-open search if this is a new playlist
    if (searchParams.get("new") === "true") {
      setShowSearch(true);
    }
  }, [playlistId, searchParams]);

  // Memoize whether we should load suggested licks
  const shouldLoadSuggested = useMemo(
    () => playlist && (playlist.licks_count === 0 || showSearch),
    [playlist, showSearch]
  );

  // Load suggested licks when playlist is empty or search is shown
  useEffect(() => {
    if (shouldLoadSuggested) {
      loadSuggestedLicks();
    }
  }, [shouldLoadSuggested, loadSuggestedLicks]);

  const handleSearch = useCallback(
    async (query) => {
      if (!query.trim()) {
        setSearchResults([]);
        // Show suggested licks when search is empty
        if (suggestedLicks.length > 0) {
          setSearchResults(suggestedLicks);
        }
        return;
      }

      try {
        setSearching(true);
        const promises = [];

        // Always search community licks
        promises.push(
          getCommunityLicks({
            search: query,
            limit: 20,
          }).catch((err) => {
            console.error(
              "(NO $) [DEBUG] Error searching community licks:",
              err
            );
            return { success: false, data: [] };
          })
        );

        // If playlist is private, also search user's private licks
        if (playlist && !playlist.is_public && authUser) {
          promises.push(
            getMyLicks({
              search: query,
              status: "active",
              limit: 20,
            }).catch((err) => {
              console.error("(NO $) [DEBUG] Error searching my licks:", err);
              return { success: false, data: [] };
            })
          );
        }

        // Use allSettled to handle partial failures gracefully
        const results = await Promise.allSettled(promises);
        const communityLicks =
          results[0]?.status === "fulfilled" && results[0].value?.success
            ? results[0].value.data
            : [];
        const myLicks =
          results[1]?.status === "fulfilled" && results[1].value?.success
            ? results[1].value.data
            : [];

        // Use memoized existingLickIds for O(n) duplicate removal
        const uniqueLickMap = new Map();
        [...communityLicks, ...myLicks].forEach((lick) => {
          if (
            !existingLickIds.has(lick.lick_id) &&
            !uniqueLickMap.has(lick.lick_id)
          ) {
            uniqueLickMap.set(lick.lick_id, lick);
          }
        });

        setSearchResults(Array.from(uniqueLickMap.values()));
      } catch (err) {
        console.error("(NO $) [DEBUG] Error searching licks:", err);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    },
    [playlist, authUser, existingLickIds, suggestedLicks]
  );

  useEffect(() => {
    if (showSearch && searchTerm) {
      const timer = setTimeout(() => {
        handleSearch(searchTerm);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
    }
  }, [searchTerm, showSearch, handleSearch]);

  const handleAddLick = async (lickId) => {
    try {
      setAddingLick(lickId);
      await addLickToPlaylist(playlistId, lickId);
      // Refresh playlist
      await fetchPlaylist();
      // Remove from search results and suggested licks
      setSearchResults((prev) =>
        prev.filter((lick) => lick.lick_id !== lickId)
      );
      setSuggestedLicks((prev) =>
        prev.filter((lick) => lick.lick_id !== lickId)
      );
    } catch (err) {
      console.error("Error adding lick:", err);
      alert(err.message || "Failed to add lick to playlist");
    } finally {
      setAddingLick(null);
    }
  };

  const handleRemoveLick = (lickId) => {
    // Show confirmation modal instead of browser alert
    setConfirmModal({
      show: true,
      message: "Remove this lick from playlist?",
      onConfirm: async () => {
        try {
          const result = await removeLickFromPlaylist(playlistId, lickId);
          if (result.success) {
            // Close confirmation modal
            setConfirmModal({
              show: false,
              message: "",
              onConfirm: null,
              lickId: null,
            });

            // Show success toast
            setToast({
              show: true,
              message: "Lick removed from playlist successfully",
              type: "success",
            });

            // Auto-hide toast after 3 seconds
            setTimeout(() => {
              setToast({ show: false, message: "", type: "success" });
            }, 3000);

            // Refresh playlist to show updated list
            await fetchPlaylist();
            // Also update suggested licks if search is open
            if (showSearch) {
              loadSuggestedLicks();
            }
          } else {
            throw new Error(result.message || "Failed to remove lick");
          }
        } catch (err) {
          console.error("(NO $) [DEBUG] Error removing lick:", err);
          const errorMessage =
            err.response?.data?.message ||
            err.message ||
            "Failed to remove lick";

          // Close confirmation modal
          setConfirmModal({
            show: false,
            message: "",
            onConfirm: null,
            lickId: null,
          });

          // Show error toast
          setToast({
            show: true,
            message: errorMessage,
            type: "error",
          });

          // Auto-hide toast after 4 seconds
          setTimeout(() => {
            setToast({ show: false, message: "", type: "error" });
          }, 4000);
        }
      },
      lickId,
    });
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await deletePlaylist(playlistId);
      navigate("/playlists");
    } catch (err) {
      console.error("Error deleting playlist:", err);
      alert(err.message || "Failed to delete playlist");
    } finally {
      setDeleting(false);
      setDeleteConfirm(false);
    }
  };

  const handleStartEdit = () => {
    if (playlist) {
      setEditForm({
        name: playlist.name || "",
        description: playlist.description || "",
        isPublic: playlist.is_public !== undefined ? playlist.is_public : true,
      });
      setIsEditing(true);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm({ name: "", description: "", isPublic: true });
  };

  const handleSaveEdit = async () => {
    if (!playlist) return;

    try {
      setSaving(true);
      const result = await updatePlaylist(playlistId, {
        name: editForm.name.trim(),
        description: editForm.description.trim(),
        isPublic: editForm.isPublic,
        coverImageUrl: playlist.cover_image_url,
      });

      if (result.success) {
        await fetchPlaylist();
        setIsEditing(false);
      } else {
        alert(result.message || "Failed to update playlist");
      }
    } catch (err) {
      console.error("Error updating playlist:", err);
      alert(err.message || "Failed to update playlist");
    } finally {
      setSaving(false);
    }
  };

  const isOwner =
    playlist &&
    authUser &&
    (playlist.owner?.user_id === authUser?.user?.id ||
      playlist.owner?.user_id === authUser?.id);

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto bg-gray-950">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
        </div>
      </div>
    );
  }

  if (error || !playlist) {
    return (
      <div className="flex-1 overflow-y-auto p-6 bg-gray-950">
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
          <p className="text-red-400">{error || "Playlist not found"}</p>
          <button
            onClick={() => navigate("/playlists")}
            className="mt-2 text-sm text-orange-400 hover:text-orange-300"
          >
            Back to Playlists
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-950 text-white min-h-screen">
      {/* Header Section - Spotify Style */}
      <div className="bg-gradient-to-b from-gray-800 to-gray-950 px-6 pt-6 pb-8">
        <div className="flex items-end gap-6">
          {/* Cover Image - Large Square */}
          <div className="w-56 h-56 bg-gray-800 rounded-lg overflow-hidden flex-shrink-0 shadow-2xl">
            {playlist.cover_image_url ? (
              <img
                src={playlist.cover_image_url}
                alt={playlist.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-500/20 to-red-600/20">
                <div className="text-7xl text-gray-500">🎵</div>
              </div>
            )}
          </div>

          {/* Playlist Info */}
          <div className="flex-1 min-w-0">
            {/* Privacy Badge */}
            <div className="mb-2">
              {playlist.is_public ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  <FaGlobe size={10} /> Public Playlist
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  <FaLock size={10} /> Private Playlist
                </span>
              )}
            </div>

            {/* Title - Editable */}
            <div className="mb-4 flex items-start gap-3">
              {isEditing ? (
                <div className="flex-1">
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-3xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Playlist name"
                    autoFocus
                  />
                </div>
              ) : (
                <h1 className="text-5xl font-bold truncate flex-1">
                  {playlist.name}
                </h1>
              )}
              {isOwner && (
                <button
                  onClick={isEditing ? handleCancelEdit : handleStartEdit}
                  className="text-gray-400 hover:text-white transition-colors p-2"
                  title={isEditing ? "Cancel editing" : "Edit playlist"}
                >
                  {isEditing ? <FaTimes size={20} /> : <FaEdit size={20} />}
                </button>
              )}
            </div>

            {/* Description - Editable */}
            {isEditing ? (
              <div className="mb-4">
                <textarea
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                  rows={3}
                  placeholder="Add a description..."
                  maxLength={250}
                />
                
                {/* Privacy Toggle */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Privacy
                  </label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative">
                        <input
                          type="radio"
                          name="isPublic"
                          checked={editForm.isPublic === true}
                          onChange={() =>
                            setEditForm((prev) => ({ ...prev, isPublic: true }))
                          }
                          className="sr-only"
                        />
                        <div
                          className={`w-12 h-6 rounded-full transition-colors ${
                            editForm.isPublic ? "bg-orange-500" : "bg-gray-700"
                          }`}
                        >
                          <div
                            className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${
                              editForm.isPublic
                                ? "translate-x-6"
                                : "translate-x-0.5"
                            } mt-0.5`}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-gray-300">
                        <FaGlobe />
                        <span>Public</span>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative">
                        <input
                          type="radio"
                          name="isPublic"
                          checked={editForm.isPublic === false}
                          onChange={() =>
                            setEditForm((prev) => ({ ...prev, isPublic: false }))
                          }
                          className="sr-only"
                        />
                        <div
                          className={`w-12 h-6 rounded-full transition-colors ${
                            !editForm.isPublic ? "bg-orange-500" : "bg-gray-700"
                          }`}
                        >
                          <div
                            className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${
                              !editForm.isPublic
                                ? "translate-x-6"
                                : "translate-x-0.5"
                            } mt-0.5`}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-gray-300">
                        <FaLock />
                        <span>Private</span>
                      </div>
                    </label>
                  </div>
                  {editForm.isPublic && (
                    <p className="mt-2 text-xs text-yellow-400 flex items-center gap-1">
                      <span>⚠</span>
                      Public playlists can only contain public licks
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 mt-4">
                  <span className="text-xs text-gray-500">
                    {editForm.description.length}/250
                  </span>
                  <button
                    onClick={handleSaveEdit}
                    disabled={saving || !editForm.name.trim()}
                    className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-1.5 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    disabled={saving}
                    className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-1.5 rounded-md text-sm font-medium disabled:opacity-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              playlist.description && (
                <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                  {playlist.description}
                </p>
              )
            )}

            {/* Creator Info */}
            <div className="flex items-center gap-2 mb-6">
              {playlist.owner?.avatar_url ? (
                <img
                  src={playlist.owner.avatar_url}
                  alt={playlist.owner.display_name}
                  className="w-6 h-6 rounded-full"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs">
                  {(playlist.owner?.display_name ||
                    playlist.owner?.username ||
                    "U")[0].toUpperCase()}
                </div>
              )}
              <span className="text-sm font-medium">
                {playlist.owner?.display_name || playlist.owner?.username}
              </span>
              <span className="text-gray-500">•</span>
              <span className="text-sm text-gray-400">
                {playlist.licks_count || 0} licks
              </span>
            </div>

            {/* Action Buttons */}
            {isOwner && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowSearch(!showSearch)}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-full font-semibold text-sm transition-colors flex items-center gap-2"
                >
                  <FaPlus size={14} />
                  Find Licks
                </button>
                <button className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-full font-semibold text-sm transition-colors flex items-center gap-2">
                  <FaUserPlus size={14} />
                </button>
                <button className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-full font-semibold text-sm transition-colors flex items-center gap-2">
                  <FaEllipsisH size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search Section */}
      {showSearch && (
        <div className="px-6 py-6 bg-gray-900/50 border-b border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">
              Hãy cùng tìm nội dung cho danh sách phát của bạn
            </h2>
            <button
              onClick={() => {
                setShowSearch(false);
                setSearchTerm("");
                setSearchResults([]);
              }}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <FaTimes size={20} />
            </button>
          </div>
          <div className="relative">
            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm licks để thêm vào playlist..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-full pl-12 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              autoFocus
            />
          </div>

          {/* Search Results */}
          {searching && (
            <div className="mt-4 text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500 mx-auto"></div>
            </div>
          )}

          {!searching && searchResults.length > 0 && (
            <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
              {searchResults.map((lick) => (
                <div
                  key={lick.lick_id}
                  className="flex items-center justify-between p-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-12 h-12 bg-gray-700 rounded flex-shrink-0 flex items-center justify-center">
                      {lick.waveform_data && lick.waveform_data.length > 0 ? (
                        <div className="flex items-end justify-center w-full h-full p-1">
                          {lick.waveform_data.slice(0, 10).map((amp, i) => (
                            <div
                              key={i}
                              className="w-0.5 mx-px bg-orange-500"
                              style={{ height: `${Math.max(amp * 100, 20)}%` }}
                            />
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-500 text-xs">🎵</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white truncate">
                        {lick.title}
                      </div>
                      <div className="text-sm text-gray-400 truncate">
                        {lick.creator?.display_name || lick.creator?.username}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAddLick(lick.lick_id)}
                    disabled={addingLick === lick.lick_id}
                    className="ml-4 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    {addingLick === lick.lick_id ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                        Adding...
                      </>
                    ) : (
                      <>
                        <FaPlus size={12} />
                        Add
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}

          {!searching && searchTerm && searchResults.length === 0 && (
            <div className="mt-4 text-center py-8 text-gray-400">
              No licks found matching "{searchTerm}"
            </div>
          )}

          {/* Suggested Licks - Show when search is empty */}
          {!searching && !searchTerm && suggestedLicks.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-4">Gợi ý cho bạn</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {suggestedLicks.map((lick) => (
                  <div
                    key={lick.lick_id}
                    className="flex items-center justify-between p-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-12 h-12 bg-gray-700 rounded flex-shrink-0 flex items-center justify-center">
                        {lick.waveform_data && lick.waveform_data.length > 0 ? (
                          <div className="flex items-end justify-center w-full h-full p-1">
                            {lick.waveform_data.slice(0, 10).map((amp, i) => (
                              <div
                                key={i}
                                className="w-0.5 mx-px bg-orange-500"
                                style={{
                                  height: `${Math.max(amp * 100, 20)}%`,
                                }}
                              />
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-500 text-xs">🎵</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white truncate">
                          {lick.title}
                        </div>
                        <div className="text-sm text-gray-400 truncate">
                          {lick.creator?.display_name || lick.creator?.username}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAddLick(lick.lick_id)}
                      disabled={addingLick === lick.lick_id}
                      className="ml-4 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-50 transition-colors flex items-center gap-2"
                    >
                      {addingLick === lick.lick_id ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                          Adding...
                        </>
                      ) : (
                        <>
                          <FaPlus size={12} />
                          Add
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!searching && !searchTerm && loadingSuggested && (
            <div className="mt-6 text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500 mx-auto"></div>
            </div>
          )}
        </div>
      )}

      {/* Licks List */}
      <div className="px-6 py-6">
        {playlist.licks && playlist.licks.length > 0 ? (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Licks in this playlist</h2>
              <span className="text-sm text-gray-400">
                {playlist.licks.length}{" "}
                {playlist.licks.length === 1 ? "lick" : "licks"}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {playlist.licks.map((lick) => (
                <div key={lick.lick_id} className="relative group">
                  <LickCard lick={lick} />
                  {isOwner && (
                    <button
                      onClick={() => handleRemoveLick(lick.lick_id)}
                      className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-2 rounded-full opacity-80 group-hover:opacity-100 transition-opacity z-20 shadow-lg"
                      title="Remove from playlist"
                      aria-label="Remove lick from playlist"
                    >
                      <FaTimes size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-20">
            <div className="text-gray-500 mb-4">
              <p className="text-xl font-semibold mb-2">
                Hãy cùng tìm nội dung cho danh sách phát của bạn
              </p>
              <p className="text-sm">
                {isOwner
                  ? "Click 'Find Licks' above to search and add licks to your playlist"
                  : "This playlist is empty"}
              </p>
            </div>
            {isOwner && (
              <button
                onClick={() => setShowSearch(true)}
                className="mt-4 bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-full font-semibold transition-colors"
              >
                Find Licks
              </button>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setDeleteConfirm(false)}
          />
          <div className="relative z-10 w-full max-w-md mx-4 bg-gray-900 border border-gray-800 rounded-lg shadow-xl">
            <div className="px-6 py-4 border-b border-gray-800">
              <h2 className="text-lg font-semibold text-white">
                Delete Playlist
              </h2>
            </div>
            <div className="px-6 py-5 space-y-3">
              <p className="text-gray-300 text-sm">
                Are you sure you want to delete this playlist? This action
                cannot be undone.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-gray-800 flex justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700"
                onClick={() => setDeleteConfirm(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md disabled:opacity-50"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() =>
              setConfirmModal({
                show: false,
                message: "",
                onConfirm: null,
                lickId: null,
              })
            }
          />
          <div className="relative z-10 w-full max-w-md mx-4 bg-gray-900 border border-gray-800 rounded-lg shadow-xl">
            <div className="px-6 py-4 border-b border-gray-800">
              <h2 className="text-lg font-semibold text-white">
                Confirm Removal
              </h2>
            </div>
            <div className="px-6 py-5 space-y-3">
              <p className="text-gray-300 text-sm">{confirmModal.message}</p>
            </div>
            <div className="px-6 py-4 border-t border-gray-800 flex justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700 transition-colors"
                onClick={() =>
                  setConfirmModal({
                    show: false,
                    message: "",
                    onConfirm: null,
                    lickId: null,
                  })
                }
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
                onClick={() => {
                  if (confirmModal.onConfirm) {
                    confirmModal.onConfirm();
                  }
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast.show && (
        <div
          className={`fixed top-20 right-6 z-50 px-6 py-4 rounded-lg shadow-2xl transition-all duration-300 ${
            toast.type === "success"
              ? "bg-green-600 text-white"
              : "bg-red-600 text-white"
          }`}
          style={{
            animation: "slideInRight 0.3s ease-out",
            minWidth: "300px",
            maxWidth: "400px",
          }}
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">
              {toast.type === "success" ? "✓" : "✕"}
            </span>
            <span className="flex-1 font-medium">{toast.message}</span>
            <button
              onClick={() =>
                setToast({ show: false, message: "", type: "success" })
              }
              className="text-white hover:text-gray-200 transition-colors"
              aria-label="Close notification"
            >
              <FaTimes size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Toast Animation Styles */}
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default PlaylistDetailPage;

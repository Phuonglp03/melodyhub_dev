import React, { useState, useEffect } from "react";
import { FaSearch, FaPlus, FaTrash, FaLock, FaGlobe } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import {
  getMyPlaylists,
  deletePlaylist,
} from "../../../services/user/playlistService";
import CreatePlaylistModal from "../../../components/CreatePlaylistModal";
import api from "../../../services/api";

const MyPlaylistsPage = () => {
  const navigate = useNavigate();
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPublic, setFilterPublic] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null });
  const [deleting, setDeleting] = useState(false);

  const fetchPlaylists = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        page,
        limit: 20,
      };

      if (searchTerm) params.search = searchTerm;
      if (filterPublic !== "") params.isPublic = filterPublic === "true";

      const res = await api.get("/playlists/me", { params });

      if (res.data.success) {
        setPlaylists(res.data.data);
        setPagination(res.data.pagination);
      }
    } catch (err) {
      console.error("Error fetching playlists:", err);
      const status = err?.response?.status;
      const rawMsg = err?.response?.data?.message || err?.message || "";
      const msg = String(rawMsg);
      const normalized = msg.toLowerCase();
      const isAuthError =
        status === 401 ||
        status === 403 ||
        normalized.includes("token") ||
        normalized.includes("expired") ||
        normalized.includes("unauthorized") ||
        normalized.includes("forbidden") ||
        normalized.includes("hết hạn");
      if (isAuthError) {
        setError("You must login to see your playlists");
      } else {
        setError(msg || "Failed to load playlists");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlaylists();
  }, [page, filterPublic]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (page === 1) {
        fetchPlaylists();
      } else {
        setPage(1);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleDelete = (playlistId) => {
    setDeleteConfirm({ open: true, id: playlistId });
  };

  const performDelete = async () => {
    if (!deleteConfirm.id) return;
    try {
      setDeleting(true);
      await deletePlaylist(deleteConfirm.id);
      setPlaylists((prev) =>
        prev.filter((p) => p.playlist_id !== deleteConfirm.id)
      );
      setDeleteConfirm({ open: false, id: null });
    } catch (err) {
      console.error("Error deleting playlist:", err);
      alert(err.message || "Failed to delete playlist");
    } finally {
      setDeleting(false);
    }
  };

  const handleCreateSuccess = () => {
    fetchPlaylists();
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Page Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">My Playlists</h1>
          <p className="text-gray-400">Manage your playlists</p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-gradient-to-r from-orange-500 to-red-600 text-white px-4 py-2 rounded-md text-sm font-semibold flex items-center hover:opacity-90 transition-opacity"
        >
          <FaPlus className="mr-2" /> New Playlist
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Privacy Filter */}
          <select
            value={filterPublic}
            onChange={(e) => setFilterPublic(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="">All Playlists</option>
            <option value="true">Public</option>
            <option value="false">Private</option>
          </select>

          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <FaSearch size={14} />
            </span>
            <input
              type="text"
              placeholder="Search playlists..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-white w-full rounded-md pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>

        {/* Results Count */}
        {pagination && (
          <div className="text-sm text-gray-400">
            {pagination.totalItems}{" "}
            {pagination.totalItems === 1 ? "playlist" : "playlists"}
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
        </div>
      )}

      {/* Error State */}
      {error &&
        (() => {
          const normalizedError = error.toLowerCase();
          if (normalizedError.includes("login")) {
            return (
              <div className="max-w-xl mx-auto bg-gray-900/70 border border-gray-800 rounded-2xl p-10 text-center shadow-lg mb-6">
                <div className="mx-auto w-14 h-14 flex items-center justify-center rounded-full bg-orange-500/10 text-orange-400 mb-4">
                  <FaLock size={24} />
                </div>
                <h2 className="text-2xl font-semibold text-white mb-2">
                  Sign in to manage playlists
                </h2>
                <p className="text-gray-400 mb-6">
                  Your playlists are private to you. Log in to create and
                  organize them.
                </p>
                <button
                  onClick={() => (window.location.href = "/login")}
                  className="px-6 py-2 rounded-md bg-gradient-to-r from-orange-500 to-red-600 text-white font-medium hover:opacity-90 transition"
                >
                  Go to login
                </button>
              </div>
            );
          }
          return (
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-6">
              <p className="text-red-400">{error}</p>
              <button
                onClick={fetchPlaylists}
                className="mt-2 text-sm text-orange-400 hover:text-orange-300"
              >
                Try again
              </button>
            </div>
          );
        })()}

      {/* Playlists Grid */}
      {!loading && !error && playlists.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {playlists.map((playlist) => (
            <div
              key={playlist.playlist_id}
              className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 hover:shadow-lg transition-all cursor-pointer group"
              onClick={() => navigate(`/playlists/${playlist.playlist_id}`)}
            >
              {/* Cover Image */}
              <div className="relative h-48 bg-gradient-to-br from-orange-500/20 to-red-600/20">
                {playlist.cover_image_url ? (
                  <img
                    src={playlist.cover_image_url}
                    alt={playlist.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-4xl text-gray-600">🎵</div>
                  </div>
                )}
                <div className="absolute top-2 right-2 flex items-center gap-2">
                  {playlist.is_public ? (
                    <span className="bg-green-500/80 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                      <FaGlobe size={10} /> Public
                    </span>
                  ) : (
                    <span className="bg-gray-700/80 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                      <FaLock size={10} /> Private
                    </span>
                  )}
                  {/* Delete button - small bin icon */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(playlist.playlist_id);
                    }}
                    className="bg-red-500/80 hover:bg-red-600 text-white p-1.5 rounded-full transition-colors"
                    title="Delete playlist"
                  >
                    <FaTrash size={10} />
                  </button>
                </div>
              </div>

              {/* Playlist Info */}
              <div className="p-4">
                <h3 className="text-base font-semibold text-white mb-1 truncate">
                  {playlist.name}
                </h3>
                {playlist.description && (
                  <p className="text-sm text-gray-400 mb-2 line-clamp-2">
                    {playlist.description}
                  </p>
                )}
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{playlist.licks_count || 0} licks</span>
                  <span>
                    {new Date(playlist.updated_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && playlists.length === 0 && (
        <div className="text-center py-20">
          <div className="text-gray-500 mb-4">
            <FaPlus size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-xl font-semibold">No playlists yet</p>
            <p className="text-sm mt-2 mb-6">
              Create your first playlist to organize your licks
            </p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-gradient-to-r from-orange-500 to-red-600 text-white px-6 py-3 rounded-md font-semibold hover:opacity-90 transition-opacity inline-flex items-center"
            >
              <FaPlus className="mr-2" /> Create Your First Playlist
            </button>
          </div>
        </div>
      )}

      {/* Pagination */}
      {!loading && pagination && pagination.totalPages > 1 && (
        <div className="mt-8 flex justify-center items-center space-x-4">
          <button
            onClick={() => setPage(page - 1)}
            disabled={!pagination.hasPrevPage}
            className="px-4 py-2 bg-gray-800 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
          >
            Previous
          </button>
          <span className="text-gray-400">
            Page {pagination.currentPage} of {pagination.totalPages}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={!pagination.hasNextPage}
            className="px-4 py-2 bg-gray-800 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
          >
            Next
          </button>
        </div>
      )}

      {/* Create Playlist Modal */}
      <CreatePlaylistModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirm.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setDeleteConfirm({ open: false, id: null })}
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
                onClick={() => setDeleteConfirm({ open: false, id: null })}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md disabled:opacity-50"
                onClick={performDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyPlaylistsPage;

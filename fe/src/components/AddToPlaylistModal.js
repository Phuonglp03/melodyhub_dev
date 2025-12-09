import React, { useState, useEffect } from "react";
import { FaTimes, FaPlus, FaCheck, FaMusic } from "react-icons/fa";
import { getMyPlaylists, addLickToPlaylist } from "../services/user/playlistService";
import { useSelector } from "react-redux";

const AddToPlaylistModal = ({ isOpen, onClose, lickId, lickTitle }) => {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addingToPlaylist, setAddingToPlaylist] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const authUser = useSelector((s) => s.auth.user);

  // Fetch user's playlists
  useEffect(() => {
    if (!isOpen) return;

    const fetchPlaylists = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await getMyPlaylists({ limit: 100 });
        if (response.success) {
          setPlaylists(response.data);
        }
      } catch (err) {
        console.error("Error fetching playlists:", err);
        setError(err.response?.data?.message || "Failed to load playlists");
      } finally {
        setLoading(false);
      }
    };

    fetchPlaylists();
  }, [isOpen]);

  // Handle adding lick to playlist
  const handleAddToPlaylist = async (playlistId) => {
    if (!authUser?.user?.id && !authUser?.id) {
      setError("You need to be logged in to add licks to playlists.");
      return;
    }

    try {
      setAddingToPlaylist(playlistId);
      setError(null);
      setSuccessMessage(null);

      const response = await addLickToPlaylist(playlistId, lickId);
      
      if (response.success) {
        setSuccessMessage("Lick added to playlist successfully!");
        // Close modal after a short delay
        setTimeout(() => {
          onClose();
          setSuccessMessage(null);
        }, 1500);
      }
    } catch (err) {
      console.error("Error adding lick to playlist:", err);
      setError(
        err.response?.data?.message || 
        "Failed to add lick to playlist. It may already be in this playlist."
      );
    } finally {
      setAddingToPlaylist(null);
    }
  };

  // Handle navigating to create playlist page
  const handleCreatePlaylist = () => {
    window.location.href = "/my-playlists";
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl max-w-md w-full max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="text-lg font-semibold text-white truncate">
              Add to Playlist
            </h2>
            <p className="text-sm text-gray-400 truncate mt-1">
              {lickTitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
          >
            <FaTimes size={20} />
          </button>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mx-4 mt-4 bg-green-900/20 border border-green-800 rounded-lg p-3 flex items-center gap-2">
            <FaCheck className="text-green-400" />
            <p className="text-green-400 text-sm">{successMessage}</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mx-4 mt-4 bg-red-900/20 border border-red-800 rounded-lg p-3">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-orange-500"></div>
            </div>
          ) : playlists.length === 0 ? (
            <div className="text-center py-12">
              <FaMusic size={48} className="mx-auto mb-4 text-gray-600" />
              <p className="text-gray-400 mb-4">You don't have any playlists yet</p>
              <button
                onClick={handleCreatePlaylist}
                className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-md transition-colors"
              >
                Create Your First Playlist
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {playlists.map((playlist) => (
                <button
                  key={playlist.playlist_id}
                  onClick={() => handleAddToPlaylist(playlist.playlist_id)}
                  disabled={addingToPlaylist !== null}
                  className="w-full bg-gray-800 hover:bg-gray-750 border border-gray-700 rounded-lg p-3 text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0 pr-3">
                      <h3 className="text-white font-medium truncate group-hover:text-orange-400 transition-colors">
                        {playlist.name}
                      </h3>
                      <p className="text-xs text-gray-400 mt-1">
                        {playlist.licks_count || 0} lick{playlist.licks_count !== 1 ? 's' : ''}
                        {playlist.is_public ? (
                          <span className="ml-2 text-cyan-400">• Public</span>
                        ) : (
                          <span className="ml-2 text-gray-500">• Private</span>
                        )}
                      </p>
                    </div>
                    {addingToPlaylist === playlist.playlist_id ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-orange-500"></div>
                    ) : (
                      <FaPlus className="text-gray-400 group-hover:text-orange-400 transition-colors" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {playlists.length > 0 && (
          <div className="border-t border-gray-800 p-4">
            <button
              onClick={handleCreatePlaylist}
              className="w-full bg-gray-800 hover:bg-gray-750 text-orange-400 px-4 py-2 rounded-md transition-colors border border-gray-700 flex items-center justify-center gap-2"
            >
              <FaPlus size={14} />
              <span>Create New Playlist</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddToPlaylistModal;

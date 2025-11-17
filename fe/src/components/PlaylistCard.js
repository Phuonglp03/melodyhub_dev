import React from "react";
import { useNavigate } from "react-router-dom";
import { FaMusic, FaUser } from "react-icons/fa";

const PlaylistCard = ({ playlist, onClick }) => {
  const navigate = useNavigate();
  const {
    playlist_id,
    name,
    description,
    cover_image_url,
    licks_count,
    owner,
    created_at,
  } = playlist;

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleClick = () => {
    if (onClick) {
      onClick(playlist_id);
    } else {
      navigate(`/playlists/${playlist_id}`);
    }
  };

  return (
    <div
      className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 hover:shadow-lg transition-all cursor-pointer"
      onClick={handleClick}
    >
      {/* Cover Image or Placeholder */}
      <div className="relative h-48 bg-gradient-to-br from-gray-800 to-gray-900">
        {cover_image_url ? (
          <img
            src={cover_image_url}
            alt={name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <FaMusic className="text-gray-600" size={64} />
          </div>
        )}
        <div className="absolute bottom-2 right-2 bg-black/60 text-white px-2 py-1 rounded text-xs">
          {licks_count || 0} licks
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="text-base font-semibold text-slate-100 mb-2 hover:text-cyan-300 transition-colors">
          {name}
        </h3>

        {description && (
          <p className="text-sm text-gray-400 mb-3 line-clamp-2">
            {description}
          </p>
        )}

        <div className="flex items-center text-xs text-gray-400">
          {owner && (
            <>
              <FaUser className="mr-1" size={10} />
              <span className="truncate">
                {owner.display_name || owner.username || "Unknown"}
              </span>
              <span className="mx-2">•</span>
            </>
          )}
          <span>{formatDate(created_at)}</span>
        </div>
      </div>
    </div>
  );
};

export default PlaylistCard;


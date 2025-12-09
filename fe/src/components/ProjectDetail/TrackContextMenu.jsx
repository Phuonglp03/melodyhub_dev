import React from "react";
import {
  FaPen,
  FaPalette,
  FaArrowUp,
  FaArrowDown,
  FaTrash,
} from "react-icons/fa";

const TrackContextMenu = ({
  isOpen,
  menuTrack,
  position,
  trackColorPalette,
  canMoveUp,
  canMoveDown,
  onClose,
  onRename,
  onColorChange,
  onMoveUp,
  onMoveDown,
  onDelete,
  formatTrackTitle,
}) => {
  if (!isOpen || !menuTrack) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div
        className="absolute z-50 w-64 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-4 space-y-3"
        style={{
          top: `${position?.y || 0}px`,
          left: `${position?.x || 0}px`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <p className="text-sm font-semibold text-white truncate">
            {formatTrackTitle(menuTrack.trackName || "Track")}
          </p>
          {menuTrack.isBackingTrack && (
            <p className="text-xs text-orange-400 mt-1">Backing track</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onRename(menuTrack)}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-gray-200 hover:bg-gray-800 transition-colors"
        >
          <FaPen size={12} />
          Rename track
        </button>
        <div>
          <div className="text-xs uppercase text-gray-400 mb-2 flex items-center gap-2">
            <FaPalette size={12} />
            Color
          </div>
          <div className="flex flex-wrap gap-2">
            {trackColorPalette.map((color) => {
              const isActive = menuTrack.color === color;
              return (
                <button
                  type="button"
                  key={color}
                  onClick={() => onColorChange(menuTrack, color)}
                  className={`w-6 h-6 rounded-full border ${
                    isActive ? "ring-2 ring-white border-white" : "border-transparent"
                  }`}
                  style={{ backgroundColor: color }}
                  title="Set track color"
                />
              );
            })}
          </div>
        </div>
        <button
          type="button"
          disabled={!canMoveUp}
          onClick={() => onMoveUp(menuTrack)}
          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
            canMoveUp ? "text-gray-200 hover:bg-gray-800" : "text-gray-600 cursor-not-allowed"
          }`}
        >
          <FaArrowUp size={12} />
          Move up
        </button>
        <button
          type="button"
          disabled={!canMoveDown}
          onClick={() => onMoveDown(menuTrack)}
          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
            canMoveDown ? "text-gray-200 hover:bg-gray-800" : "text-gray-600 cursor-not-allowed"
          }`}
        >
          <FaArrowDown size={12} />
          Move down
        </button>
        <button
          type="button"
          onClick={() => onDelete(menuTrack)}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-red-400 hover:text-red-200 hover:bg-red-900/20 transition-colors"
        >
          <FaTrash size={12} />
          Delete track
        </button>
      </div>
    </div>
  );
};

export default TrackContextMenu;


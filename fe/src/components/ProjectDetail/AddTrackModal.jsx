import React from "react";
import { FaTimes, FaPlus } from "react-icons/fa";

const AddTrackModal = ({
  isOpen,
  newTrackName,
  onNameChange,
  onClose,
  onConfirm,
  errorMessage,
  successMessage,
}) => {
  if (!isOpen) {
    return null;
  }

  const isConfirmDisabled = !newTrackName.trim() || !!successMessage;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-800 rounded-lg w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">Add New Track</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <FaTimes size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Track Name
            </label>
            <input
              type="text"
              value={newTrackName}
              onChange={(e) => onNameChange(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter" && !isConfirmDisabled) {
                  onConfirm();
                }
              }}
              placeholder="Enter track name"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
              autoFocus
            />
            <p className="mt-2 text-xs text-gray-500">Track type: Audio (default)</p>
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-900/20 border border-red-700/50 rounded-lg text-red-400 text-sm">
              {errorMessage}
            </div>
          )}
          {successMessage && (
            <div className="p-3 bg-green-900/20 border border-green-700/50 rounded-lg text-green-400 text-sm">
              {successMessage}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isConfirmDisabled}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <FaPlus size={14} />
            {successMessage ? "Added!" : "Add Track"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddTrackModal;


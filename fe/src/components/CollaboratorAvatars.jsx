// CollaboratorAvatars - Phase 4: UI Feedback - Presence Indicators
// Displays active collaborators in the project header
import React from "react";
import { FaUser } from "react-icons/fa";

export default function CollaboratorAvatars({
  collaborators = [],
  currentUserId,
  activeEditors = new Map(),
}) {
  if (!collaborators || collaborators.length === 0) {
    return null;
  }

  // Filter out current user
  const otherCollaborators = collaborators.filter(
    (c) => c.userId !== currentUserId
  );

  if (otherCollaborators.length === 0) {
    return null;
  }

  // Get unique users who are actively editing
  const editingUserIds = new Set();
  activeEditors.forEach((editor) => {
    if (editor.userId !== currentUserId) {
      editingUserIds.add(editor.userId);
    }
  });

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900/60 border border-gray-800 rounded-full">
      <div className="flex items-center -space-x-2">
        {otherCollaborators.slice(0, 5).map((collab) => {
          const isEditing = editingUserIds.has(collab.userId);
          return (
            <div
              key={collab.userId}
              className="relative group"
              title={`${
                collab.user?.displayName ||
                collab.user?.username ||
                "Collaborator"
              }${isEditing ? " (editing)" : ""}`}
            >
              {collab.user?.avatarUrl ? (
                <img
                  src={collab.user.avatarUrl}
                  alt={collab.user.displayName || collab.user.username}
                  className={`w-6 h-6 rounded-full border-2 ${
                    isEditing
                      ? "border-blue-400 shadow-lg shadow-blue-500/50"
                      : "border-gray-800"
                  } bg-gray-700 object-cover transition-all`}
                />
              ) : (
                <div
                  className={`w-6 h-6 rounded-full border-2 ${
                    isEditing
                      ? "border-blue-400 shadow-lg shadow-blue-500/50"
                      : "border-gray-800"
                  } bg-indigo-600 flex items-center justify-center transition-all`}
                >
                  <FaUser size={10} className="text-white" />
                </div>
              )}
              {/* Online indicator */}
              <div
                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 ${
                  isEditing ? "bg-blue-500 animate-pulse" : "bg-green-500"
                } border-2 border-gray-900 rounded-full`}
              ></div>
              {/* Editing indicator */}
              {isEditing && (
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              )}
            </div>
          );
        })}
        {otherCollaborators.length > 5 && (
          <div className="w-6 h-6 rounded-full border-2 border-gray-800 bg-gray-700 flex items-center justify-center">
            <span className="text-[8px] text-gray-300 font-semibold">
              +{otherCollaborators.length - 5}
            </span>
          </div>
        )}
      </div>
      {editingUserIds.size > 0 && (
        <span className="text-[10px] uppercase text-blue-400">
          {editingUserIds.size}{" "}
          {editingUserIds.size === 1 ? "editing" : "editing"}
        </span>
      )}
    </div>
  );
}

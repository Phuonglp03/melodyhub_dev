import React from "react";
import { FaUserPlus, FaUser } from "react-icons/fa";

/**
 * CollaborationPanel - Panel showing collaborators, active editors, and invite button
 *
 * Props:
 * - collaborators: Array - list of collaborators
 * - currentUserId: string - current user's ID
 * - isConnected: boolean - whether connection is active
 * - activeEditors: Map - map of active editors by itemId: { itemId: { userId, userName, avatarUrl } }
 * - onInvite: () => void - callback to open invite modal
 * - className?: string - optional custom classes
 */
const CollaborationPanel = ({
  collaborators = [],
  currentUserId,
  isConnected = false,
  activeEditors = new Map(),
  onInvite,
  className = "",
}) => {
  const allCollaborators = collaborators || [];
  // Show all collaborators including current user (like the modal does)
  const allCollaboratorsList = allCollaborators.map((c) => {
    // Handle various collaborator structures - userId can be object with _id or direct ID
    const collaboratorId =
      c.userId?._id || c.userId || c._id || c.user?._id || c.user?.id;
    const isCurrentUser = collaboratorId && String(collaboratorId) === String(currentUserId);
    return {
      ...c,
      collaboratorId,
      isCurrentUser,
    };
  });

  // Get unique active editors from the activeEditors Map
  const activeEditorIds = new Set();
  const activeEditorList = [];
  if (activeEditors && activeEditors instanceof Map) {
    activeEditors.forEach((editor, itemId) => {
      const editorId = editor.userId || editor.user?._id || editor.user?.id;
      if (editorId && !activeEditorIds.has(editorId) && String(editorId) !== String(currentUserId)) {
        activeEditorIds.add(editorId);
        activeEditorList.push({
          userId: editorId,
          userName: editor.userName || editor.user?.displayName || editor.user?.username || "Editor",
          avatarUrl: editor.avatarUrl || editor.user?.avatarUrl,
        });
      }
    });
  }

  // Combine collaborators and active editors (prioritize active editors)
  // Include all collaborators including current user
  const allActiveUsers = [...activeEditorList];
  allCollaboratorsList.forEach((collab) => {
    const collabId = collab.collaboratorId;
    if (collabId && !activeEditorIds.has(collabId)) {
      allActiveUsers.push({
        userId: collabId,
        userName: collab.user?.displayName || collab.user?.username || collab.userName || "Collaborator",
        avatarUrl: collab.user?.avatarUrl || collab.avatarUrl,
        isCurrentUser: collab.isCurrentUser,
      });
    }
  });

  const onlineCount = allActiveUsers.length;
  // Show all active users, but limit to first 5 for UI space
  const visibleUsers = allActiveUsers.slice(0, 5);
  const remainingCount = Math.max(onlineCount - 5, 0);

  // Get list of items being edited with editor info
  const editingItems = [];
  if (activeEditors && activeEditors instanceof Map) {
    activeEditors.forEach((editor, itemId) => {
      const editorId = editor.userId || editor.user?._id || editor.user?.id;
      if (editorId && String(editorId) !== String(currentUserId)) {
        editingItems.push({
          itemId,
          editor: {
            userId: editorId,
            userName: editor.userName || editor.user?.displayName || editor.user?.username || "Someone",
            avatarUrl: editor.avatarUrl || editor.user?.avatarUrl,
          },
        });
      }
    });
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Active Editors Indicator */}
      {editingItems.length > 0 && (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-900/30 border border-blue-700/50 rounded-full">
          <span className="text-[10px] uppercase text-blue-300">
            {editingItems.length} {editingItems.length === 1 ? "editor" : "editing"}
          </span>
          <div className="flex items-center gap-1">
            {editingItems.slice(0, 3).map((item, index) => (
              <div
                key={item.itemId || index}
                className="w-4 h-4 rounded-full border border-blue-500 ring-1 ring-blue-500/50 overflow-hidden flex items-center justify-center -ml-1 first:ml-0"
                title={`${item.editor.userName} is editing`}
              >
                {item.editor.avatarUrl ? (
                  <img
                    src={item.editor.avatarUrl}
                    alt={item.editor.userName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <FaUser size={7} className="text-blue-300" />
                )}
              </div>
            ))}
            {editingItems.length > 3 && (
              <span className="text-[9px] text-blue-300 font-semibold ml-1">
                +{editingItems.length - 3}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Connection Status Indicator */}
      <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-900/60 border border-gray-800 rounded-full">
        <div
          className={`w-2 h-2 rounded-full ${
            isConnected ? "bg-green-500 animate-pulse" : "bg-gray-500"
          }`}
          title={isConnected ? "Connected" : "Connecting..."}
        />
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase text-gray-400">
            {isConnected
              ? onlineCount > 0
                ? `Live · ${onlineCount} ${
                    onlineCount === 1 ? "online" : "online"
                  }`
                : "Live"
              : "Offline"}
          </span>

          {isConnected && onlineCount > 0 && (
            <div className="flex items-center gap-1">
              {visibleUsers.map((user, index) => {
                const isActiveEditor = activeEditorList.some(
                  (editor) => editor.userId === user.userId
                );
                const displayName = user.isCurrentUser 
                  ? `${user.userName} (you)`
                  : user.userName;
                return (
                  <div
                    key={user.userId || index}
                    className={`w-5 h-5 rounded-full border overflow-hidden flex items-center justify-center -ml-1 first:ml-0 ${
                      isActiveEditor
                        ? "border-blue-500 ring-2 ring-blue-500/50"
                        : user.isCurrentUser
                        ? "border-orange-500 ring-1 ring-orange-500/50"
                        : "border-gray-800 bg-gray-800"
                    }`}
                    title={
                      isActiveEditor
                        ? `${displayName} (editing)`
                        : displayName
                    }
                  >
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.userName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <FaUser
                        size={9}
                        className={
                          isActiveEditor 
                            ? "text-blue-300" 
                            : user.isCurrentUser
                            ? "text-orange-300"
                            : "text-gray-300"
                        }
                      />
                    )}
                  </div>
                );
              })}
              {remainingCount > 0 && (
                <span className="text-[10px] text-gray-400 font-semibold ml-1">
                  +{remainingCount}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onInvite}
        className="px-3 py-1.5 bg-gray-900/60 border border-gray-800 rounded-full text-xs text-white hover:bg-gray-800 transition-colors flex items-center gap-2"
        title="Invite collaborator"
      >
        <FaUserPlus size={12} />
        <span>Invite</span>
      </button>
    </div>
  );
};

export default CollaborationPanel;

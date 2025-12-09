import React from "react";

/**
 * ActiveEditorsIndicator - Shows who is currently editing a specific item
 *
 * Props:
 * - activeEditors: Map - map of active editors by itemId
 * - itemId: string - ID of the item to check
 * - className?: string - optional custom classes
 */
const ActiveEditorsIndicator = ({
  activeEditors = new Map(),
  itemId,
  className = "",
}) => {
  const editor = activeEditors.get(itemId);

  if (!editor) {
    return null;
  }

  return (
    <div
      className={`absolute top-1 right-1 px-2 py-0.5 bg-blue-500/90 text-white text-[10px] rounded-full flex items-center gap-1 z-10 ${className}`}
      title={`${editor.userName || "Someone"} is editing`}
    >
      {editor.avatarUrl ? (
        <img
          src={editor.avatarUrl}
          alt={editor.userName}
          className="w-3 h-3 rounded-full"
        />
      ) : (
        <div className="w-3 h-3 rounded-full bg-blue-600"></div>
      )}
      <span className="font-medium">{editor.userName || "Editing"}</span>
    </div>
  );
};

export default ActiveEditorsIndicator;

import React from "react";

/**
 * CollaboratorCursor - Visual indicator showing where a collaborator's cursor is
 *
 * Props:
 * - collaborator: Object - Collaborator data with user info and cursor position
 * - position: Object - { x, y } - Absolute position on screen
 * - color: string - Color for the cursor (optional, defaults to user-specific color)
 */
const CollaboratorCursor = ({ collaborator, position, color }) => {
  if (!position || !collaborator) return null;

  // Generate a consistent color for each user based on their ID
  const getColorForUser = (userId) => {
    if (!userId) return "#3b82f6"; // Default blue

    // Simple hash function to generate color
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }

    const colors = [
      "#3b82f6", // blue
      "#10b981", // green
      "#f59e0b", // amber
      "#ef4444", // red
      "#8b5cf6", // purple
      "#ec4899", // pink
      "#06b6d4", // cyan
      "#f97316", // orange
    ];

    return colors[Math.abs(hash) % colors.length];
  };

  const cursorColor = color || getColorForUser(collaborator.userId);
  const userName =
    collaborator.user?.displayName ||
    collaborator.user?.username ||
    "Collaborator";

  return (
    <div
      className="absolute pointer-events-none z-50 transition-all duration-100 ease-out"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: "translate(-50%, -50%)",
      }}
    >
      {/* Cursor pointer */}
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-lg"
        style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))" }}
      >
        <path
          d="M3 3L10.07 19.97L12.58 12.58L19.97 10.07L3 3Z"
          fill={cursorColor}
          stroke="white"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>

      {/* User label with avatar */}
      <div
        className="absolute top-6 left-1/2 transform -translate-x-1/2 flex items-center gap-1.5 px-2 py-1 bg-gray-900/95 border border-gray-700 rounded-md shadow-lg whitespace-nowrap"
        style={{ borderTopColor: cursorColor }}
      >
        {collaborator.user?.avatarUrl ? (
          <img
            src={collaborator.user.avatarUrl}
            alt={userName}
            className="w-4 h-4 rounded-full object-cover"
          />
        ) : (
          <div
            className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-semibold text-white"
            style={{ backgroundColor: cursorColor }}
          >
            {userName.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="text-[10px] font-medium text-white">{userName}</span>
      </div>
    </div>
  );
};

export default CollaboratorCursor;



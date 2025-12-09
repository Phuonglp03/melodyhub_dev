import React from "react";

/**
 * TempoControl - Input control for project tempo
 *
 * Props:
 * - tempoDraft: string - current tempo draft value
 * - setTempoDraft: (value: string) => void - setter for tempo draft
 * - onCommit: () => void - callback when tempo is committed
 * - className?: string - optional custom classes
 */
const TempoControl = ({
  tempoDraft,
  setTempoDraft,
  onCommit,
  className = "",
}) => {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="uppercase text-gray-400 text-xs">Tempo</span>
      <input
        type="number"
        min={40}
        max={300}
        value={tempoDraft}
        onChange={(e) => setTempoDraft(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onCommit();
            e.target.blur();
          }
        }}
        className="w-16 px-2 py-1 bg-gray-950 border border-gray-700 rounded text-white text-xs text-center focus:outline-none focus:border-orange-500"
      />
      <span className="text-gray-500 text-xs">BPM</span>
    </div>
  );
};

export default TempoControl;

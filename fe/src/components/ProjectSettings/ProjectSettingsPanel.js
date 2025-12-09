import React from "react";
import TempoControl from "./TempoControl";
import KeySignatureControl from "./KeySignatureControl";
import TimeSignatureControl from "./TimeSignatureControl";

/**
 * ProjectSettingsPanel - Panel containing all project settings controls
 *
 * Props:
 * - tempoDraft: string - current tempo draft value
 * - setTempoDraft: (value: string) => void - setter for tempo draft
 * - onTempoCommit: () => void - callback when tempo is committed
 * - projectKey: string - current project key
 * - onKeyChange: (value: string) => void - callback when key changes
 * - projectTimeSignature: string - current project time signature
 * - onTimeSignatureChange: (value: string) => void - callback when time signature changes
 * - className?: string - optional custom classes
 */
const ProjectSettingsPanel = ({
  tempoDraft,
  setTempoDraft,
  onTempoCommit,
  projectKey,
  onKeyChange,
  projectTimeSignature,
  onTimeSignatureChange,
  className = "",
}) => {
  return (
    <div
      className={`flex items-center gap-2 bg-gray-900/70 border border-gray-800 rounded-full px-3 py-1 text-xs text-white ${className}`}
    >
      <TempoControl
        tempoDraft={tempoDraft}
        setTempoDraft={setTempoDraft}
        onCommit={onTempoCommit}
      />
      <KeySignatureControl value={projectKey} onChange={onKeyChange} />
      <TimeSignatureControl
        value={projectTimeSignature}
        onChange={onTimeSignatureChange}
      />
    </div>
  );
};

export default ProjectSettingsPanel;

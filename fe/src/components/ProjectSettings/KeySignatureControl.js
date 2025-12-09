import React from "react";
import { KEY_OPTIONS } from "../../utils/projectHelpers";

/**
 * KeySignatureControl - Dropdown control for project key
 *
 * Props:
 * - value: string - current key value
 * - onChange: (value: string) => void - callback when key changes
 * - className?: string - optional custom classes
 */
const KeySignatureControl = ({ value, onChange, className = "" }) => {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="uppercase text-gray-400 text-xs">Key</span>
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="px-2 py-1 bg-gray-950 border border-gray-700 rounded text-white text-xs focus:outline-none focus:border-orange-500"
      >
        {KEY_OPTIONS.map((key) => (
          <option key={key} value={key}>
            {key}
          </option>
        ))}
      </select>
    </div>
  );
};

export default KeySignatureControl;

import React from "react";
import { TIME_SIGNATURES } from "../../utils/projectHelpers";

/**
 * TimeSignatureControl - Dropdown control for project time signature
 *
 * Props:
 * - value: string - current time signature value
 * - onChange: (value: string) => void - callback when time signature changes
 * - className?: string - optional custom classes
 */
const TimeSignatureControl = ({ value, onChange, className = "" }) => {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="uppercase text-gray-400 text-xs">Time</span>
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="px-2 py-1 bg-gray-950 border border-gray-700 rounded text-white text-xs focus:outline-none focus:border-orange-500"
      >
        {TIME_SIGNATURES.map((signature) => (
          <option key={signature} value={signature}>
            {signature}
          </option>
        ))}
      </select>
    </div>
  );
};

export default TimeSignatureControl;

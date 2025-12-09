// fe/src/components/ProjectBandMixer.js
// Dynamic band mixer for ProjectDetailPage
import React from "react";
import { FaPlus, FaTrash } from "react-icons/fa";
import { createBandMember } from "../utils/bandDefaults";

const STYLES = ["Swing", "Bossa", "Latin", "Ballad", "Funk", "Rock"];
const ROLE_OPTIONS = [
  { value: "percussion", label: "Percussion" },
  { value: "bass", label: "Bass" },
  { value: "comping", label: "Rhythm" },
  { value: "pad", label: "Pad" },
  { value: "lead", label: "Lead" },
];

const TYPE_OPTIONS = [
  { value: "drums", label: "Drums" },
  { value: "bass", label: "Bass" },
  { value: "keys", label: "Keys" },
  { value: "guitar", label: "Guitar" },
  { value: "strings", label: "Strings" },
  { value: "synth", label: "Synth" },
];

const SOUND_BANKS = {
  drums: [
    { value: "jazz-kit", label: "Jazz Kit" },
    { value: "rock-kit", label: "Rock Kit" },
    { value: "808", label: "808 Kit" },
  ],
  bass: [
    { value: "upright", label: "Upright" },
    { value: "electric", label: "Electric" },
    { value: "synth-bass", label: "Synth Bass" },
  ],
  keys: [
    { value: "grand-piano", label: "Grand Piano" },
    { value: "rhodes", label: "Rhodes" },
    { value: "organ", label: "B3 Organ" },
  ],
  guitar: [
    { value: "clean-guitar", label: "Clean Guitar" },
    { value: "nylon", label: "Nylon String" },
    { value: "jazz-guitar", label: "Jazz Guitar" },
  ],
  strings: [
    { value: "string-ensemble", label: "String Ensemble" },
    { value: "solo-violin", label: "Solo Violin" },
    { value: "chamber", label: "Chamber Strings" },
  ],
  synth: [
    { value: "pad-soft", label: "Soft Pad" },
    { value: "pad-analog", label: "Analog Pad" },
    { value: "lead-saw", label: "Saw Lead" },
  ],
};

const getSoundBankOptions = (type) =>
  SOUND_BANKS[type] || SOUND_BANKS.keys || [];

export default function ProjectBandMixer({
  bandSettings,
  onSettingsChange,
  style,
  onStyleChange,
}) {
  const members = bandSettings.members || [];

  const updateMember = (instanceId, updates) => {
    const nextMembers = members.map((member) =>
      member.instanceId === instanceId ? { ...member, ...updates } : member
    );
    onSettingsChange({
      ...bandSettings,
      members: nextMembers,
    });
  };

  const addMember = () => {
    const newMember = createBandMember();
    onSettingsChange({
      ...bandSettings,
      members: [...members, newMember],
    });
  };

  const removeMember = (instanceId) => {
    const nextMembers = members.filter(
      (member) => member.instanceId !== instanceId
    );
    onSettingsChange({
      ...bandSettings,
      members: nextMembers,
    });
  };

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      {/* Style Selector */}
      <div className="flex items-center gap-3">
        <div className="flex flex-col flex-1">
          <span className="text-xs text-gray-500 uppercase mb-1">Style</span>
          <select
            value={style}
            onChange={(e) => onStyleChange(e.target.value)}
            className="bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-orange-500"
          >
            {STYLES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={addMember}
          className="self-end flex items-center gap-2 px-3 py-1.5 text-xs text-gray-300 border border-dashed border-gray-700 rounded hover:text-white hover:border-gray-500 transition-colors"
        >
          <FaPlus size={10} />
          Add Instrument
        </button>
      </div>

      {/* Channel Strips */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2">
        {members.length === 0 && (
          <div className="text-xs text-gray-500 border border-gray-800 rounded p-3 text-center">
            No band members yet. Click “Add Instrument” to start building your
            band.
          </div>
        )}

        {members.map((member) => {
          const soundOptions = getSoundBankOptions(member.type);
          return (
            <div
              key={member.instanceId}
              className="bg-gray-900 border border-gray-800 rounded-lg p-3 flex flex-col gap-2"
            >
              <div className="flex items-center gap-2">
                <input
                  className="flex-1 bg-transparent text-sm font-semibold text-white border border-gray-800 rounded px-2 py-1 focus:outline-none focus:border-indigo-500"
                  value={member.name}
                  onChange={(e) =>
                    updateMember(member.instanceId, { name: e.target.value })
                  }
                  placeholder="Instrument name"
                />
                <select
                  className="bg-gray-800 text-[11px] text-gray-300 rounded px-2 py-1 focus:outline-none"
                  value={member.type}
                  onChange={(e) =>
                    updateMember(member.instanceId, { type: e.target.value })
                  }
                >
                  {TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <select
                  className="bg-gray-800 text-[11px] text-indigo-300 rounded px-2 py-1 focus:outline-none"
                  value={member.role}
                  onChange={(e) =>
                    updateMember(member.instanceId, { role: e.target.value })
                  }
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeMember(member.instanceId)}
                  className="text-gray-500 hover:text-red-400 transition-colors"
                  title="Remove instrument"
                >
                  <FaTrash size={12} />
                </button>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-40">
                  <span className="text-[10px] text-gray-500 uppercase">
                    Sound
                  </span>
                  <select
                    className="w-full bg-gray-800 text-[11px] text-gray-200 rounded px-2 py-1 focus:outline-none mt-1"
                    value={member.soundBank}
                    onChange={(e) =>
                      updateMember(member.instanceId, {
                        soundBank: e.target.value,
                      })
                    }
                  >
                    {soundOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
                    <span>Volume</span>
                    <span className="text-gray-400">{member.volume.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={member.volume}
                    onChange={(e) =>
                      updateMember(member.instanceId, {
                        volume: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-indigo-500"
                  />
                </div>

                <button
                  type="button"
                  onClick={() =>
                    updateMember(member.instanceId, {
                      isMuted: !member.isMuted,
                    })
                  }
                  className={`text-xs font-bold w-10 h-8 rounded border ${
                    member.isMuted
                      ? "bg-red-700 border-red-500 text-white"
                      : "bg-gray-800 border-gray-700 text-gray-300"
                  }`}
                >
                  {member.isMuted ? "Unmute" : "Mute"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateMember(member.instanceId, {
                      isSolo: !member.isSolo,
                    })
                  }
                  className={`text-xs font-bold w-10 h-8 rounded border ${
                    member.isSolo
                      ? "bg-green-700 border-green-500 text-white"
                      : "bg-gray-800 border-gray-700 text-gray-300"
                  }`}
                >
                  Solo
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

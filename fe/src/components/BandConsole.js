// fe/src/components/BandConsole.js
// Unified Band Console: Chord Input + Band Mixer (No Tabs)
import React from "react";
import ProjectChordDeck from "./ProjectChordDeck";
import ProjectBandMixer from "./ProjectBandMixer";

const BandConsole = ({
  selectedChordIndex,
  onChordSelect,
  onAddChord,
  projectKey,
  bandSettings,
  onSettingsChange,
  style,
  onStyleChange,
  instruments = [],
}) => {
  return (
    <div className="h-full min-h-0 bg-gray-950 border-t border-gray-800 flex flex-col md:flex-row overflow-hidden">
      {/* LEFT: CHORD INPUT */}
      <div className="flex-1 border-b md:border-b-0 md:border-r border-gray-800 p-3 overflow-y-auto">
        <div className="px-2 pb-2">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
            Harmony Input
          </span>
        </div>
        <ProjectChordDeck
          selectedChordIndex={selectedChordIndex}
          onChordSelect={onChordSelect}
          onAddChord={onAddChord}
          projectKey={projectKey}
        />
      </div>

      {/* RIGHT: BAND MIXER */}
      <div className="md:w-[420px] w-full border-t md:border-t-0 md:border-l border-gray-800 bg-[#0f0f10] p-4 flex flex-col min-h-0 overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-indigo-400 uppercase tracking-wide">
            The Band
          </span>
          <select
            value={style}
            onChange={(e) => onStyleChange(e.target.value)}
            className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-orange-500"
          >
            <option value="Swing">Swing</option>
            <option value="Bossa">Bossa Nova</option>
            <option value="Latin">Latin</option>
            <option value="Ballad">Ballad</option>
            <option value="Funk">Funk</option>
            <option value="Rock">Rock</option>
          </select>
        </div>

        <ProjectBandMixer
          bandSettings={bandSettings}
          onSettingsChange={onSettingsChange}
          style={style}
          onStyleChange={onStyleChange}
          instruments={instruments}
        />
      </div>
    </div>
  );
};

export default BandConsole;

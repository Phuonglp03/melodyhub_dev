import React from "react";
import { FaPalette, FaChevronDown, FaChevronUp } from "react-icons/fa";

const PerformanceDeckPanel = ({
  sidePanelOpen,
  sidePanelWidth,
  collapsedHeight,
  onTogglePanel,
  onStartResize,
  selectedChordIndex,
  onChordSelect,
  onAddChord,
  projectKey,
  bandSettings,
  onSettingsChange,
  projectStyle,
  onStyleChange,
  instruments,
  BandConsoleComponent,
}) => {
  return (
    <div
      className="absolute left-0 right-0 transition-all duration-300 ease-in-out"
      style={{
        height: sidePanelOpen ? sidePanelWidth : collapsedHeight,
        bottom: 0,
      }}
    >
      <div className="h-full flex flex-col shadow-2xl shadow-black/50 relative">
        {/* Drag handle across the top of the deck for easier resizing */}
        {sidePanelOpen && (
          <div
            onMouseDown={onStartResize}
            className="absolute -top-1 left-0 right-0 h-2 cursor-n-resize z-10"
            title="Drag to resize the deck"
          />
        )}
        <div className="flex items-center justify-between h-11 px-4 bg-gray-950 border-t border-gray-800">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <FaPalette size={12} className="text-orange-400" />
            Performance Deck
          </div>
          <div className="flex items-center gap-2">
            {sidePanelOpen && (
              <button
                onMouseDown={onStartResize}
                className="text-gray-500 hover:text-white px-2 py-1 rounded-md border border-gray-700 text-[11px]"
                title="Drag to resize (or drag the thin bar above)"
              >
                Resize
              </button>
            )}
            <button
              onClick={onTogglePanel}
              className="text-gray-400 hover:text-white p-1 rounded-md border border-gray-700"
              title={sidePanelOpen ? "Collapse panel" : "Expand panel"}
            >
              {sidePanelOpen ? (
                <FaChevronDown size={12} />
              ) : (
                <FaChevronUp size={12} />
              )}
            </button>
          </div>
        </div>

        <div
          className={`bg-gray-950 border-t border-gray-800 flex-1 flex flex-col min-h-0 transition-opacity duration-200 ${
            sidePanelOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          {sidePanelOpen && BandConsoleComponent && (
            <BandConsoleComponent
              selectedChordIndex={selectedChordIndex}
              onChordSelect={onChordSelect}
              onAddChord={onAddChord}
              projectKey={projectKey}
              bandSettings={bandSettings}
              onSettingsChange={onSettingsChange}
              style={projectStyle}
              onStyleChange={onStyleChange}
              instruments={instruments}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default PerformanceDeckPanel;

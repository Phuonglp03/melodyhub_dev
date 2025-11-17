import React, { useState, useRef } from "react";
import { FaSave, FaUndo, FaRedo, FaEraser, FaPlay } from "react-icons/fa";

const GuitarTabEditor = ({ initialTab = "", onSave, tempo = 120 }) => {
  const [measures, setMeasures] = useState([createEmptyMeasure()]);
  const [selectedCell, setSelectedCell] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const strings = [
    { name: "e", note: "E4" },
    { name: "B", note: "B3" },
    { name: "G", note: "G3" },
    { name: "D", note: "D3" },
    { name: "A", note: "A2" },
    { name: "E", note: "E2" },
  ];

  function createEmptyMeasure() {
    return {
      id: Date.now() + Math.random(),
      strings: Array(6)
        .fill(null)
        .map(() => Array(16).fill("-")),
    };
  }

  // Parse incoming tab text into measures grid (16 columns per measure)
  const importFromText = (tabText) => {
    if (!tabText || tabText.trim() === "") return [createEmptyMeasure()];

    const lines = tabText.split("\n").filter((l) => l.includes("|"));
    const grouped = [];
    let current = [];
    for (const line of lines) {
      current.push(line);
      if (current.length === 6) {
        grouped.push(current);
        current = [];
      }
    }
    if (current.length > 0) grouped.push(current);

    const toGrid = (measureLines) => {
      const grid = Array(6)
        .fill(null)
        .map(() => Array(16).fill("-"));
      for (let s = 0; s < 6; s++) {
        const parts = (measureLines[s] || "").split("|");
        const notes = parts.slice(1, -1).join("");
        for (let i = 0; i < 16; i++) {
          grid[s][i] = notes[i] ? notes[i] : "-";
        }
      }
      return {
        id: Date.now() + Math.random(),
        strings: grid,
      };
    };

    return grouped.length > 0 ? grouped.map(toGrid) : [createEmptyMeasure()];
  };

  // Load initialTab when provided/changed
  React.useEffect(() => {
    const imported = importFromText(initialTab);
    setMeasures(imported);
    setSelectedCell(null);
    setHistory([]);
    setHistoryIndex(-1);
  }, [initialTab]);

  // Handle cell click
  const handleCellClick = (measureIdx, stringIdx, cellIdx) => {
    setSelectedCell({ measureIdx, stringIdx, cellIdx });
  };

  // Handle keyboard input
  const handleKeyPress = (e) => {
    if (!selectedCell) return;

    const { measureIdx, stringIdx, cellIdx } = selectedCell;
    const key = e.key;

    // Numbers 0-24 for frets
    if (/^[0-9]$/.test(key)) {
      updateCell(measureIdx, stringIdx, cellIdx, key);
      moveToNextCell();
    }
    // Backspace or Delete to clear
    else if (key === "Backspace" || key === "Delete") {
      updateCell(measureIdx, stringIdx, cellIdx, "-");
    }
    // Arrow keys for navigation
    else if (key === "ArrowLeft") {
      moveToPreviousCell();
    } else if (key === "ArrowRight") {
      moveToNextCell();
    } else if (key === "ArrowUp") {
      moveToString(-1);
    } else if (key === "ArrowDown") {
      moveToString(1);
    }
    // Special techniques
    else if (key === "h") {
      updateCell(measureIdx, stringIdx, cellIdx, "h");
      moveToNextCell();
    } else if (key === "p") {
      updateCell(measureIdx, stringIdx, cellIdx, "p");
      moveToNextCell();
    } else if (key === "b") {
      updateCell(measureIdx, stringIdx, cellIdx, "b");
      moveToNextCell();
    } else if (key === "/") {
      updateCell(measureIdx, stringIdx, cellIdx, "/");
      moveToNextCell();
    }
  };

  const updateCell = (measureIdx, stringIdx, cellIdx, value) => {
    const newMeasures = [...measures];
    newMeasures[measureIdx].strings[stringIdx][cellIdx] = value;
    setMeasures(newMeasures);

    // Add to history
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.stringify(newMeasures));
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const moveToNextCell = () => {
    if (!selectedCell) return;
    const { measureIdx, stringIdx, cellIdx } = selectedCell;

    if (cellIdx < 15) {
      setSelectedCell({ measureIdx, stringIdx, cellIdx: cellIdx + 1 });
    } else if (measureIdx < measures.length - 1) {
      setSelectedCell({ measureIdx: measureIdx + 1, stringIdx, cellIdx: 0 });
    }
  };

  const moveToPreviousCell = () => {
    if (!selectedCell) return;
    const { measureIdx, stringIdx, cellIdx } = selectedCell;

    if (cellIdx > 0) {
      setSelectedCell({ measureIdx, stringIdx, cellIdx: cellIdx - 1 });
    } else if (measureIdx > 0) {
      setSelectedCell({ measureIdx: measureIdx - 1, stringIdx, cellIdx: 15 });
    }
  };

  const moveToString = (direction) => {
    if (!selectedCell) return;
    const { measureIdx, stringIdx, cellIdx } = selectedCell;
    const newStringIdx = stringIdx + direction;

    if (newStringIdx >= 0 && newStringIdx < 6) {
      setSelectedCell({ measureIdx, stringIdx: newStringIdx, cellIdx });
    }
  };

  // Add new measure
  const addMeasure = () => {
    setMeasures([...measures, createEmptyMeasure()]);
  };

  // Clear all
  const clearAll = () => {
    if (window.confirm("Clear all tabs?")) {
      setMeasures([createEmptyMeasure()]);
      setSelectedCell(null);
    }
  };

  // Undo
  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setMeasures(JSON.parse(history[historyIndex - 1]));
    }
  };

  // Redo
  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setMeasures(JSON.parse(history[historyIndex + 1]));
    }
  };

  // Export to text format
  const exportToText = () => {
    let text = "";
    measures.forEach((measure, idx) => {
      if (idx > 0) text += "\n";
      strings.forEach((string, sIdx) => {
        const line = measure.strings[sIdx].join("");
        text += `${string.name}|${line}|\n`;
      });
    });
    return text;
  };

  // Save
  const handleSave = () => {
    const tabText = exportToText();
    if (onSave) {
      onSave(tabText);
    }
  };

  return (
    <div
      className="bg-gray-900 rounded-lg p-6 border border-gray-800"
      tabIndex={0}
      onKeyDown={handleKeyPress}
    >
      {/* Toolbar */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-2">
          <button
            onClick={undo}
            disabled={historyIndex <= 0}
            className="p-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md transition-colors"
            title="Undo"
          >
            <FaUndo size={14} />
          </button>
          <button
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            className="p-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md transition-colors"
            title="Redo"
          >
            <FaRedo size={14} />
          </button>
          <button
            onClick={clearAll}
            className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors ml-2"
            title="Clear All"
          >
            <FaEraser size={14} />
          </button>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={addMeasure}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors"
          >
            + Add Measure
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm rounded-md transition-colors flex items-center"
          >
            <FaSave className="mr-2" size={14} />
            Save Tab
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="mb-4 bg-blue-900/20 border border-blue-800 rounded-lg p-3">
        <p className="text-blue-300 text-sm">
          <strong>Instructions:</strong> Click on a cell and type numbers (0-9)
          for frets. Use arrow keys to navigate, h (hammer), p (pull-off), b
          (bend), / (slide). Backspace to clear.
        </p>
      </div>

      {/* Tab Editor Grid */}
      <div className="bg-gray-950 rounded-lg p-4 overflow-x-auto">
        {measures.map((measure, measureIdx) => (
          <div key={measure.id} className="mb-6">
            <div className="text-xs text-gray-500 mb-2">
              Measure {measureIdx + 1}
            </div>

            {/* Grid */}
            <div className="font-mono text-sm">
              {strings.map((string, stringIdx) => (
                <div key={stringIdx} className="flex items-center mb-1">
                  {/* String Label */}
                  <span className="text-orange-400 font-bold mr-2 w-6">
                    {string.name}
                  </span>
                  <span className="text-gray-600">|</span>

                  {/* Cells */}
                  <div className="flex">
                    {measure.strings[stringIdx].map((value, cellIdx) => {
                      const isSelected =
                        selectedCell?.measureIdx === measureIdx &&
                        selectedCell?.stringIdx === stringIdx &&
                        selectedCell?.cellIdx === cellIdx;

                      return (
                        <div
                          key={cellIdx}
                          onClick={() =>
                            handleCellClick(measureIdx, stringIdx, cellIdx)
                          }
                          className={`
                            w-8 h-8 flex items-center justify-center cursor-pointer
                            border border-gray-800 transition-colors
                            ${
                              isSelected
                                ? "bg-orange-600 text-white"
                                : value !== "-"
                                ? "bg-gray-800 text-white hover:bg-gray-700"
                                : "bg-gray-900 text-gray-600 hover:bg-gray-800"
                            }
                          `}
                        >
                          {value}
                        </div>
                      );
                    })}
                  </div>

                  <span className="text-gray-600">|</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Technique Legend */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-gray-400">
        <div>
          <span className="text-white">0-9:</span> Fret number
        </div>
        <div>
          <span className="text-white">h:</span> Hammer-on
        </div>
        <div>
          <span className="text-white">p:</span> Pull-off
        </div>
        <div>
          <span className="text-white">b:</span> Bend
        </div>
        <div>
          <span className="text-white">/:</span> Slide up
        </div>
        <div>
          <span className="text-white">\:</span> Slide down
        </div>
        <div>
          <span className="text-white">~:</span> Vibrato
        </div>
        <div>
          <span className="text-white">x:</span> Muted note
        </div>
      </div>
    </div>
  );
};

export default GuitarTabEditor;

















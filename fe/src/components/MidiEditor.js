import React, { useState, useEffect, useRef } from "react";
import { FaSave, FaTimes, FaPlus, FaTrash } from "react-icons/fa";

/**
 * MidiEditor Component
 * Piano roll editor for editing MIDI notes in chord timeline items
 */
const MidiEditor = ({
  isOpen,
  onClose,
  onSave,
  timelineItem,
  project,
}) => {
  const [notes, setNotes] = useState([]);
  const [selectedNotes, setSelectedNotes] = useState(new Set());
  const [gridSnap, setGridSnap] = useState(0.25); // Snap to 16th notes by default
  const [isDrawing, setIsDrawing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // Constants for piano roll
  const PIANO_KEY_WIDTH = 60;
  const NOTE_HEIGHT = 16;
  const MIN_PITCH = 36; // C2
  const MAX_PITCH = 96; // C7
  const TOTAL_PITCHES = MAX_PITCH - MIN_PITCH + 1;

  // Calculate pixels per beat based on zoom
  const pixelsPerBeat = 100;
  const duration = timelineItem?.duration || 4;
  const bpm = project?.tempo || 120;

  // Load MIDI events from timeline item
  useEffect(() => {
    if (!isOpen || !timelineItem) return;

    const midiEvents = timelineItem.customMidiEvents || [];
    if (midiEvents.length > 0) {
      // Use custom MIDI events if they exist
      setNotes(
        midiEvents.map((event, idx) => ({
          ...event,
          id: `note-${idx}`,
        }))
      );
    } else {
      // Initialize with chord's MIDI notes if available
      // Try multiple sources for MIDI notes
      let midiNotes = [];
      
      // Check if item has midiNotes directly
      if (timelineItem.midiNotes && Array.isArray(timelineItem.midiNotes)) {
        midiNotes = timelineItem.midiNotes;
      }
      // Check if item has lickId with midiNotes
      else if (timelineItem.lickId?.midiNotes && Array.isArray(timelineItem.lickId.midiNotes)) {
        midiNotes = timelineItem.lickId.midiNotes;
      }
      // For chord items, we might need to generate from chord name
      else if (timelineItem.chordName) {
        // Try to get notes from chord library or generate them
        // For now, show empty - user can add notes manually
        midiNotes = [];
      }
      
      if (midiNotes.length > 0) {
        // If it's a chord item, spread notes across the duration
        // Otherwise, play all notes together at start
        const isChordItem = timelineItem.type === 'chord' || timelineItem.chordName;
        
        setNotes(
          midiNotes.map((pitch, idx) => ({
            id: `note-${idx}`,
            pitch,
            startTime: isChordItem ? (idx * 0.1) : 0, // Slight stagger for chords
            duration: isChordItem ? (duration - (midiNotes.length - 1) * 0.1) : duration,
            velocity: 0.8,
          }))
        );
      } else {
        // Empty - user can add notes manually
        setNotes([]);
      }
    }
  }, [isOpen, timelineItem, duration]);

  // Draw piano roll on canvas
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const width = Math.max(duration * pixelsPerBeat, 800);
    const height = TOTAL_PITCHES * NOTE_HEIGHT;

    canvas.width = width;
    canvas.height = height;

    // Clear canvas
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, width, height);

    // Draw grid lines
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1;

    // Horizontal lines (pitches)
    for (let i = 0; i <= TOTAL_PITCHES; i++) {
      const y = i * NOTE_HEIGHT;
      const pitch = MAX_PITCH - i;
      const isWhiteKey = [0, 2, 4, 5, 7, 9, 11].includes(pitch % 12);

      // Alternate row colors
      if (isWhiteKey) {
        ctx.fillStyle = "#222";
      } else {
        ctx.fillStyle = "#1a1a1a";
      }
      ctx.fillRect(0, y, width, NOTE_HEIGHT);

      // Draw pitch line
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Vertical lines (beats)
    const beatsInDuration = Math.ceil(duration);
    for (let beat = 0; beat <= beatsInDuration * 4; beat++) {
      const x = (beat / 4) * pixelsPerBeat;
      ctx.strokeStyle = beat % 4 === 0 ? "#555" : "#333";
      ctx.lineWidth = beat % 4 === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Draw notes
    notes.forEach((note) => {
      const x = note.startTime * pixelsPerBeat;
      const y = (MAX_PITCH - note.pitch) * NOTE_HEIGHT;
      const noteWidth = note.duration * pixelsPerBeat;
      const isSelected = selectedNotes.has(note.id);

      // Note background
      ctx.fillStyle = isSelected
        ? "rgba(99, 102, 241, 0.8)"
        : `rgba(34, 197, 94, ${note.velocity})`;
      ctx.fillRect(x, y + 1, noteWidth, NOTE_HEIGHT - 2);

      // Note border
      ctx.strokeStyle = isSelected ? "#818cf8" : "#22c55e";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y + 1, noteWidth, NOTE_HEIGHT - 2);
    });
  }, [notes, selectedNotes, duration, pixelsPerBeat, isOpen]);

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Calculate pitch and time
    const pitch = Math.floor(MAX_PITCH - y / NOTE_HEIGHT);
    const rawTime = x / pixelsPerBeat;
    const snappedTime = Math.round(rawTime / gridSnap) * gridSnap;

    // Check if clicking on existing note
    const clickedNote = notes.find((note) => {
      const noteX = note.startTime * pixelsPerBeat;
      const noteY = (MAX_PITCH - note.pitch) * NOTE_HEIGHT;
      const noteWidth = note.duration * pixelsPerBeat;

      return (
        x >= noteX &&
        x <= noteX + noteWidth &&
        y >= noteY &&
        y <= noteY + NOTE_HEIGHT
      );
    });

    if (clickedNote) {
      // Select note
      if (e.shiftKey) {
        setSelectedNotes((prev) => new Set(prev).add(clickedNote.id));
      } else {
        setSelectedNotes(new Set([clickedNote.id]));
      }
    } else {
      // Add new note
      const newNote = {
        id: `note-${Date.now()}`,
        pitch: Math.max(MIN_PITCH, Math.min(MAX_PITCH, pitch)),
        startTime: Math.max(0, snappedTime),
        duration: gridSnap,
        velocity: 0.8,
      };

      setNotes((prev) => [...prev, newNote]);
      setSelectedNotes(new Set([newNote.id]));
    }
  };

  const handleDeleteSelected = () => {
    setNotes((prev) => prev.filter((note) => !selectedNotes.has(note.id)));
    setSelectedNotes(new Set());
  };

  const handleSave = () => {
    if (onSave) {
      onSave({
        ...timelineItem,
        customMidiEvents: notes,
        isCustomized: true,
      });
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg shadow-2xl w-11/12 h-5/6 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">MIDI Editor</h2>
            <p className="text-sm text-gray-400">
              {timelineItem?.chordName || "Untitled"} - {duration} beats
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Grid Snap */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-400">Grid:</label>
              <select
                value={gridSnap}
                onChange={(e) => setGridSnap(parseFloat(e.target.value))}
                className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm"
              >
                <option value={1}>1/4</option>
                <option value={0.5}>1/8</option>
                <option value={0.25}>1/16</option>
                <option value={0.125}>1/32</option>
              </select>
            </div>

            {/* Delete Button */}
            {selectedNotes.size > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded flex items-center gap-2 text-white text-sm"
              >
                <FaTrash />
                Delete ({selectedNotes.size})
              </button>
            )}

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded text-gray-400 hover:text-white"
            >
              <FaTimes size={20} />
            </button>
          </div>
        </div>

        {/* Piano Roll Container */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto bg-gray-950 relative"
        >
          {/* Piano Keys (Left Side) */}
          <div className="absolute left-0 top-0 w-[60px] bg-gray-800 border-r border-gray-700 z-10">
            {Array.from({ length: TOTAL_PITCHES }).map((_, i) => {
              const pitch = MAX_PITCH - i;
              const noteName = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][pitch % 12];
              const octave = Math.floor(pitch / 12) - 1;
              const isWhiteKey = [0, 2, 4, 5, 7, 9, 11].includes(pitch % 12);

              return (
                <div
                  key={pitch}
                  className={`flex items-center justify-center text-xs font-mono ${
                    isWhiteKey ? "bg-gray-700 text-white" : "bg-gray-900 text-gray-400"
                  }`}
                  style={{ height: NOTE_HEIGHT, borderBottom: "1px solid #444" }}
                >
                  {noteName}{octave}
                </div>
              );
            })}
          </div>

          {/* Canvas */}
          <div className="ml-[60px]">
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className="cursor-crosshair"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 flex justify-between items-center">
          <div className="text-sm text-gray-400">
            Notes: {notes.length} | Selected: {selectedNotes.size}
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded text-white flex items-center gap-2"
            >
              <FaSave />
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MidiEditor;

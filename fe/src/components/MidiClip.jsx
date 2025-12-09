import React, { useRef, useEffect } from "react";

const MidiClip = ({
  data, // The timeline item object
  width, // Current width in pixels
  height, // Current height in pixels
  color, // Track color
  isSelected, // Selection state
  isMuted, // Mute state
}) => {
  const canvasRef = useRef(null);

  // Helper: Convert MIDI pitch to Y position
  // We map the specific pitch range of the clip to the canvas height
  const getY = (pitch, minPitch, maxPitch, canvasHeight, headerHeight) => {
    if (maxPitch === minPitch) return canvasHeight / 2; // Center if single note
    const range = maxPitch - minPitch;
    const normalized = (pitch - minPitch) / range;
    // Invert because canvas Y=0 is top.
    // We leave space at top for header (headerHeight)
    const drawableHeight = canvasHeight - headerHeight - 10; // 10px padding bottom
    return canvasHeight - 5 - normalized * drawableHeight;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;

    const ctx = canvas.getContext("2d");

    // Handle High DPI Screens (Retina fix)
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    // 1. Draw Background
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);

    // Visual State: Muted or Selected
    if (isMuted) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      ctx.fillRect(0, 0, width, height);
    }

    // 2. Draw Header Bar
    const headerHeight = 24;
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)"; // Darker overlay for text area
    ctx.fillRect(0, 0, width, headerHeight);

    // 3. Prepare MIDI Data
    // Combine custom events or fallback notes
    let notes = [];

    // First, check for customMidiEvents (preferred format)
    if (
      Array.isArray(data?.customMidiEvents) &&
      data.customMidiEvents.length > 0
    ) {
      notes = data.customMidiEvents;
    }
    // If no customMidiEvents, check for midiNotes array
    else if (Array.isArray(data?.midiNotes) && data.midiNotes.length > 0) {
      // Handle legacy/simple chord block notes
      // We assume they sustain for the full clip duration if not specified
      const duration = data.duration || 1;
      notes = data.midiNotes.map((n) => ({
        pitch: Number(n),
        startTime: 0,
        duration: duration,
        velocity: 0.8,
      }));
    }
    // Also check for nested midiNotes (e.g., item.lickId?.midiNotes)
    else if (
      data?.lickId?.midiNotes &&
      Array.isArray(data.lickId.midiNotes) &&
      data.lickId.midiNotes.length > 0
    ) {
      const duration = data.duration || 1;
      notes = data.lickId.midiNotes.map((n) => ({
        pitch: Number(n),
        startTime: 0,
        duration: duration,
        velocity: 0.8,
      }));
    }

    if (notes.length > 0) {
      // Find Range
      const pitches = notes.map((n) => n.pitch);
      const minPitch = Math.min(...pitches);
      const maxPitch = Math.max(...pitches);
      const duration = data.duration || 1; // Fallback to 1 if duration is missing

      // 4. Draw Notes (The "Mini Piano Roll")
      ctx.fillStyle = isSelected ? "#ffffff" : "rgba(0, 0, 0, 0.5)"; // White if selected, dark transparent if not

      notes.forEach((note) => {
        // X Position (Time)
        const startPct = (note.startTime || 0) / duration;
        const durPct = (note.duration || duration) / duration;

        const x = startPct * width;
        const w = Math.max(2, durPct * width); // Min width 2px visibility

        // Y Position (Pitch)
        const y = getY(note.pitch, minPitch, maxPitch, height, headerHeight);
        const h = 4; // Fixed height for clean "mini" look

        // Draw Note Rect
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, w, h, 2);
        } else {
          ctx.fillRect(x, y, w, h);
        }
        ctx.fill();
      });
    }

    // 5. Draw Text Labels (Manually on Canvas or use HTML overlay - doing HTML overlay in parent is easier for text clipping, but let's keep it simple here)
    // Note: We will handle text in the HTML parent for better CSS truncation support.
  }, [data, width, height, color, isSelected, isMuted]);

  return (
    <canvas
      ref={canvasRef}
      className="block pointer-events-none" // Allow clicks to pass through to parent
    />
  );
};

export default MidiClip;

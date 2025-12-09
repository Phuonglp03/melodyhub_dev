import { getMidiNotesForChord } from "./midi";

// Constants
export const MIN_CLIP_DURATION = 0.1;

// Timeline formatting
export const formatTransportTime = (seconds = 0) => {
  const totalSeconds = Math.max(0, seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  const tenths = Math.floor((totalSeconds % 1) * 10);
  return `${minutes.toString().padStart(2, "0")}:${secs}.${tenths}`;
};

// MIDI event normalization
export const normalizeMidiEvent = (event) => {
  if (!event) return null;
  const pitch = Number(event.pitch);
  const startTime = Number(event.startTime);
  const duration = Number(event.duration);
  const velocity = event.velocity === undefined ? 0.8 : Number(event.velocity);
  if (
    !Number.isFinite(pitch) ||
    pitch < 0 ||
    pitch > 127 ||
    !Number.isFinite(startTime) ||
    startTime < 0 ||
    !Number.isFinite(duration) ||
    duration < 0
  ) {
    return null;
  }
  const clampedVelocity = velocity >= 0 && velocity <= 1 ? velocity : 0.8;
  return {
    pitch,
    startTime,
    duration,
    velocity: clampedVelocity,
  };
};

// Timeline item normalization
export const normalizeTimelineItem = (item) => {
  if (!item) return item;
  const startTime = Math.max(0, Number(item.startTime) || 0);
  const duration = Math.max(
    MIN_CLIP_DURATION,
    Number(item.duration) || MIN_CLIP_DURATION
  );
  const offset = Math.max(0, Number(item.offset) || 0);
  const sourceDurationRaw =
    Number(item.sourceDuration) ||
    Number(item.lickId?.duration) ||
    offset + duration;
  const sourceDuration = Math.max(sourceDurationRaw, offset + duration);

  return {
    ...item, // Preserve ALL original properties including lickId, waveformData, etc.
    startTime,
    duration,
    offset,
    sourceDuration,
    loopEnabled: Boolean(item.loopEnabled),
    playbackRate: Number(item.playbackRate) || 1,
    type:
      item.type || (item.lickId ? "lick" : item.audioUrl ? "chord" : "midi"),
    chordName: item.chordName || item.chord || null,
    rhythmPatternId: item.rhythmPatternId || null,
    isCustomized: Boolean(item.isCustomized),
    customMidiEvents: Array.isArray(item.customMidiEvents)
      ? item.customMidiEvents
          .map((event) => normalizeMidiEvent(event))
          .filter(Boolean)
      : [],
    // Explicitly preserve lickId and all its properties (including waveformData)
    lickId: item.lickId || null,
    // Preserve audio URL and waveform data for chord items with generated audio
    // Check multiple possible locations for audio URL (API might return it in different formats)
    audioUrl:
      item.audioUrl ||
      item.audio_url ||
      item.lickId?.audioUrl ||
      item.lickId?.audio_url ||
      null,
    waveformData:
      item.waveformData ||
      item.waveform_data ||
      item.lickId?.waveformData ||
      item.lickId?.waveform_data ||
      null,
  };
};

export const getChordIndexFromId = (itemId) => {
  if (typeof itemId !== "string") return null;
  if (!itemId.startsWith("chord-")) return null;
  const parts = itemId.split("-");
  const index = parseInt(parts[1], 10);
  return Number.isNaN(index) ? null : index;
};

// MIDI event generation
export const generatePatternMidiEvents = (
  pitches = [],
  patternSteps = [],
  totalDuration = 0
) => {
  if (!pitches.length || !patternSteps.length || !totalDuration) return [];
  const stepDuration = Math.max(
    MIN_CLIP_DURATION,
    totalDuration / patternSteps.length
  );
  const events = [];

  patternSteps.forEach((value, index) => {
    if (!value || value <= 0) return;
    const startTime = index * stepDuration;
    const duration = Math.max(MIN_CLIP_DURATION, stepDuration * 0.85);
    const velocity = Math.max(0.1, Math.min(1, value));
    pitches.forEach((pitch) => {
      events.push({
        pitch: Number(pitch),
        startTime,
        duration,
        velocity,
      });
    });
  });

  return events;
};

/**
 * Derive detailed MIDI events for a chord block so we can visualize and describe it consistently.
 */
export const getChordMidiEvents = (
  item,
  fallbackDuration = 0,
  patternSteps = null
) => {
  if (!item) return [];

  if (Array.isArray(item.customMidiEvents) && item.customMidiEvents.length) {
    return item.customMidiEvents;
  }

  const duration = fallbackDuration || item.duration || 0;
  if (Array.isArray(item.midiNotes) && item.midiNotes.length) {
    const chordMidi = item.midiNotes.map((pitch) => ({
      pitch: Number(pitch),
      startTime: 0,
      duration,
    }));
    if (patternSteps?.length && duration > 0) {
      const generated = generatePatternMidiEvents(
        chordMidi.map((event) => event.pitch),
        patternSteps,
        duration
      );
      if (generated.length) return generated;
    }
    return chordMidi;
  }

  const fallbackNotes = getMidiNotesForChord(item.chordName || item.chord);
  if (!fallbackNotes.length) return [];

  if (patternSteps?.length && duration > 0) {
    const generated = generatePatternMidiEvents(
      fallbackNotes,
      patternSteps,
      duration
    );
    if (generated.length) return generated;
  }

  return fallbackNotes.map((pitch) => ({
    pitch,
    startTime: 0,
    duration,
  }));
};

export const deriveRhythmGrid = (
  events = [],
  totalDuration = 0,
  fallbackSteps = [],
  preferredLength = 0
) => {
  const stepCount =
    preferredLength ||
    (fallbackSteps?.length
      ? fallbackSteps.length
      : Math.min(32, Math.max(8, Math.round(totalDuration * 2))));

  if (!events.length || !totalDuration || !stepCount) {
    return fallbackSteps || [];
  }

  const grid = Array(stepCount).fill(0);
  const stepDuration = totalDuration / stepCount;

  events.forEach((event) => {
    const start = Math.max(0, Number(event.startTime) || 0);
    const duration = Math.max(
      MIN_CLIP_DURATION,
      Number(event.duration) || stepDuration
    );
    const end = Math.min(totalDuration, start + duration);
    let startIndex = Math.floor(start / stepDuration);
    let endIndex = Math.floor(end / stepDuration);
    if (endIndex < startIndex) endIndex = startIndex;
    for (let i = startIndex; i <= endIndex && i < stepCount; i += 1) {
      const overlapStart = Math.max(start, i * stepDuration);
      const overlapEnd = Math.min(end, (i + 1) * stepDuration);
      const proportion = Math.max(0, overlapEnd - overlapStart) / stepDuration;
      const velocity = Number(event.velocity) || 0.6;
      grid[i] = Math.max(grid[i], 0.2 + proportion * velocity);
    }
  });

  return grid;
};

// Rhythm pattern utilities
const candidatePatternKeys = [
  "steps",
  "sequence",
  "pattern",
  "patternData",
  "grid",
  "values",
  "hits",
  "data",
  "notes",
  "timeline",
];

export const createDefaultPatternSteps = (length = 8) => {
  const clamped = Math.max(4, Math.min(length, 32));
  return Array.from({ length: clamped }, (_, idx) =>
    idx % 4 === 0 ? 0.95 : idx % 2 === 0 ? 0.55 : 0.2
  );
};

export const coercePatternArray = (raw) => {
  if (Array.isArray(raw)) return raw.flat(Infinity);
  if (typeof raw === "number" || typeof raw === "boolean") return [raw];
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      return coercePatternArray(parsed);
    } catch {
      if (/^[01]+$/.test(trimmed)) {
        return trimmed.split("").map((char) => (char === "1" ? 1 : 0));
      }
      const tokens = trimmed.split(/[\s,|/-]+/).filter(Boolean);
      if (tokens.length) {
        return tokens
          .map((token) => Number(token))
          .filter((num) => !Number.isNaN(num));
      }
    }
    return [];
  }
  if (raw && typeof raw === "object") {
    for (const key of candidatePatternKeys) {
      if (raw[key] !== undefined) {
        const arr = coercePatternArray(raw[key]);
        if (arr.length) return arr;
      }
    }
    return [];
  }
  return [];
};

export const normalizeRhythmStepValue = (step) => {
  if (typeof step === "boolean") return step ? 1 : 0;
  if (typeof step === "number") return step;
  if (typeof step === "string") {
    const num = Number(step);
    if (!Number.isNaN(num)) return num;
    return step === "x" || step === "X" ? 1 : 0;
  }
  if (step && typeof step === "object") {
    const numericKeys = [
      "velocity",
      "value",
      "intensity",
      "accent",
      "gain",
      "amount",
    ];
    for (const key of numericKeys) {
      if (typeof step[key] === "number") {
        return step[key];
      }
    }
    if (typeof step.active === "boolean") return step.active ? 1 : 0;
    if (typeof step.on === "boolean") return step.on ? 1 : 0;
  }
  return 0;
};

export const clampStepValue = (value) => {
  if (!Number.isFinite(value)) return 0;
  if (value > 1) return Math.min(1, value / 127);
  if (value < 0) return 0;
  return value;
};

export const normalizeRhythmSteps = (raw, fallbackLength = 0) => {
  const arr = coercePatternArray(raw);
  const normalized = arr
    .map((step) => normalizeRhythmStepValue(step))
    .map((value) => clampStepValue(value))
    .filter((_, idx) => idx < 128);

  if (normalized.length) {
    return normalized;
  }

  if (fallbackLength > 0) {
    return createDefaultPatternSteps(fallbackLength);
  }

  return [];
};

export const normalizeRhythmPattern = (pattern) => {
  if (!pattern) return null;
  const fallbackLength =
    (Array.isArray(pattern.steps) && pattern.steps.length) ||
    (Array.isArray(pattern.sequence) && pattern.sequence.length) ||
    Number(pattern.stepCount) ||
    Number(pattern.subdivisionCount) ||
    Number(pattern.length) ||
    Number(pattern.beatCount) ||
    8;

  const sourceCandidates = [
    pattern.steps,
    pattern.sequence,
    pattern.patternData,
    pattern.pattern,
    pattern.grid,
    pattern.values,
    pattern.hits,
    pattern.timeline,
    pattern.midiPreview,
    pattern.midiNotes,
  ];

  let steps = [];
  for (const source of sourceCandidates) {
    const parsed = normalizeRhythmSteps(source);
    if (parsed.length) {
      steps = parsed;
      break;
    }
  }

  if (!steps.length) {
    steps = createDefaultPatternSteps(fallbackLength);
  }

  return {
    ...pattern,
    visualSteps: steps,
    visualStepCount: steps.length,
    displayName: pattern.name || pattern.title || pattern.slug || "Rhythm",
  };
};

export const registerPatternLookupKey = (map, key, pattern) => {
  if (key === null || key === undefined) return;
  if (typeof key === "object") return;
  const strKey = String(key).trim();
  if (!strKey) return;
  map[strKey] = pattern;
  map[strKey.toLowerCase()] = pattern;
};

export const lookupPatternFromMap = (map, key) => {
  if (key === null || key === undefined) return null;
  if (typeof key === "object") return null;
  const strKey = String(key).trim();
  if (!strKey) return null;
  return map[strKey] || map[strKey.toLowerCase()] || null;
};

// Track normalization
export const normalizeTracks = (incomingTracks = [], trackColorPalette = []) => {
  // Import TRACK_COLOR_PALETTE if not provided
  const TRACK_COLOR_PALETTE = trackColorPalette.length
    ? trackColorPalette
    : [
        "#6366f1",
        "#8b5cf6",
        "#0ea5e9",
        "#10b981",
        "#f97316",
        "#f43f5e",
        "#facc15",
        "#ec4899",
      ];

  return incomingTracks
    .map((track, index) => {
      const fallbackColor =
        TRACK_COLOR_PALETTE[index % TRACK_COLOR_PALETTE.length];
      const inferredBacking =
        track.isBackingTrack ||
        track.trackType === "backing" ||
        track.trackName?.toLowerCase() === "backing track";
      const rawType = (track.trackType || "").toLowerCase();
      const normalizedType = ["audio", "midi", "backing"].includes(rawType)
        ? rawType
        : inferredBacking
        ? "backing"
        : "audio";
      const isBackingTrack = Boolean(
        inferredBacking || normalizedType === "backing"
      );

      return {
        ...track,
        isBackingTrack,
        trackType: normalizedType,
        color: track.color || fallbackColor,
        instrument: track.instrument || null,
        defaultRhythmPatternId: track.defaultRhythmPatternId || null,
        items: (track.items || []).map((item) => normalizeTimelineItem(item)),
      };
    })
    .sort((a, b) => (a.trackOrder ?? 0) - (b.trackOrder ?? 0));
};
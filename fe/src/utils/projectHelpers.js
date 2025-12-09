import { parseMidiNotes, midiToNoteNameNoOctave } from "./midi";

// Constants
export const HISTORY_LIMIT = 50;

export const DEFAULT_FALLBACK_CHORDS = [
  { chordName: "C", midiNotes: [60, 64, 67] },
  { chordName: "G", midiNotes: [67, 71, 74] },
  { chordName: "Am", midiNotes: [69, 72, 76] },
  { chordName: "F", midiNotes: [65, 69, 72] },
  { chordName: "Dm7", midiNotes: [62, 65, 69, 72] },
  { chordName: "Em7", midiNotes: [64, 67, 71, 74] },
  { chordName: "Gmaj7", midiNotes: [67, 71, 74, 78] },
  { chordName: "Cmaj7", midiNotes: [60, 64, 67, 71] },
];

export const TRACK_COLOR_PALETTE = [
  "#6366f1",
  "#8b5cf6",
  "#0ea5e9",
  "#10b981",
  "#f97316",
  "#f43f5e",
  "#facc15",
  "#ec4899",
];

export const TIME_SIGNATURES = ["4/4", "3/4", "6/8", "2/4"];

export const KEY_OPTIONS = [
  "C Major",
  "G Major",
  "D Major",
  "A Major",
  "E Major",
  "B Major",
  "F Major",
  "Bb Major",
  "Eb Major",
  "C Minor",
  "G Minor",
  "D Minor",
  "A Minor",
  "E Minor",
];

// History helpers
export const cloneTracksForHistory = (sourceTracks = []) =>
  sourceTracks.map((track) => ({
    ...track,
    items: (track.items || []).map((item) => ({ ...item })),
  }));

export const cloneChordsForHistory = (sourceChords = []) =>
  sourceChords.map((entry) =>
    typeof entry === "string" ? entry : { ...entry }
  );

// Formatting helpers
export const formatLabelValue = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    return value
      .map((entry) => formatLabelValue(entry))
      .filter(Boolean)
      .join(", ");
  }
  if (typeof value === "object") {
    const candidate =
      value.displayName ||
      value.name ||
      value.title ||
      value.label ||
      value.instrument ||
      value.instrumentName ||
      value.patternName ||
      value.description ||
      value.type;
    if (candidate) return String(candidate);
  }
  return "";
};

export const formatTrackTitle = (title) => {
  const raw = formatLabelValue(title) || "Track";
  const trimmed = raw.trim();
  const cleaned = trimmed.replace(/^[\d\s._-]+/, "").trim();
  return cleaned || trimmed || "Track";
};

// Music theory functions
/**
 * Get chord degree in a key (I, ii, iii, IV, V, vi, vii°, bII, #IV, etc.)
 */
export const getChordDegree = (chordName, key) => {
  if (!chordName || !key) return null;

  // Parse key (e.g., "C Major", "A Minor", "Bb Major")
  const keyMatch = key.match(/^([A-G][#b]?)\s*(Major|Minor|maj|min)$/i);
  if (!keyMatch) return null;

  const keyRoot = keyMatch[1];
  const isMinor = /minor|min/i.test(keyMatch[2]);

  // Parse chord root (e.g., "Am" -> "A", "C#maj7" -> "C#", "Bb7" -> "Bb")
  const chordMatch = chordName.match(/^([A-G][#b]?)/);
  if (!chordMatch) return null;

  const chordRoot = chordMatch[1];

  // Convert all note names to semitone indices (0-11)
  const noteToIndex = (note) => {
    const noteMap = {
      C: 0,
      "C#": 1,
      Db: 1,
      D: 2,
      "D#": 3,
      Eb: 3,
      E: 4,
      F: 5,
      "F#": 6,
      Gb: 6,
      G: 7,
      "G#": 8,
      Ab: 8,
      A: 9,
      "A#": 10,
      Bb: 10,
      B: 11,
    };
    return noteMap[note] !== undefined ? noteMap[note] : null;
  };

  const keyIndex = noteToIndex(keyRoot);
  const chordIndex = noteToIndex(chordRoot);

  if (keyIndex === null || chordIndex === null) return null;

  // Calculate semitone difference from key root
  let semitoneDiff = (chordIndex - keyIndex + 12) % 12;

  // Diatonic scale degrees (major and minor)
  const majorScaleDegrees = [0, 2, 4, 5, 7, 9, 11]; // C, D, E, F, G, A, B
  const minorScaleDegrees = [0, 2, 3, 5, 7, 8, 10]; // C, D, Eb, F, G, Ab, Bb (natural minor)

  const scaleDegrees = isMinor ? minorScaleDegrees : majorScaleDegrees;

  // Diatonic degree names
  const majorDegreeNames = ["I", "ii", "iii", "IV", "V", "vi", "vii°"];
  const minorDegreeNames = ["i", "ii°", "III", "iv", "v", "VI", "VII"];
  const degreeNames = isMinor ? minorDegreeNames : majorDegreeNames;

  // Check if it's a diatonic chord
  const diatonicIndex = scaleDegrees.indexOf(semitoneDiff);
  if (diatonicIndex !== -1) {
    return degreeNames[diatonicIndex];
  }

  // Handle chromatic alterations (bII, #IV, etc.)
  // Find the closest diatonic degree
  let closestDiatonic = 0;
  let minDistance = 12;
  for (let i = 0; i < scaleDegrees.length; i++) {
    const distance = Math.min(
      Math.abs(semitoneDiff - scaleDegrees[i]),
      Math.abs(semitoneDiff - scaleDegrees[i] - 12),
      Math.abs(semitoneDiff - scaleDegrees[i] + 12)
    );
    if (distance < minDistance) {
      minDistance = distance;
      closestDiatonic = i;
    }
  }

  // Calculate the alteration (how many semitones away from diatonic)
  const diatonicSemitone = scaleDegrees[closestDiatonic];
  let alteration = semitoneDiff - diatonicSemitone;
  if (alteration > 6) alteration -= 12;
  if (alteration < -6) alteration += 12;

  // If it's exactly a diatonic note, return it (shouldn't happen here, but just in case)
  if (alteration === 0) {
    return degreeNames[closestDiatonic];
  }

  // Build the altered degree name
  const baseDegree = degreeNames[closestDiatonic];
  const isUppercase = baseDegree[0] === baseDegree[0].toUpperCase();
  const degreeNum = baseDegree.replace(/[°b#]/g, ""); // Remove existing symbols

  // Add flat or sharp prefix
  let prefix = "";
  if (alteration === -1) prefix = "b";
  else if (alteration === 1) prefix = "#";
  else if (alteration === -2) prefix = "bb";
  else if (alteration === 2) prefix = "##";
  else return null; // Too far from diatonic

  // Preserve case and special symbols
  const preservedSuffix = baseDegree.match(/[°b#]+$/)?.[0] || "";
  return prefix + degreeNum + preservedSuffix;
};

/**
 * Check if a chord belongs to a key
 */
export const isChordInKey = (chordName, key) => {
  return getChordDegree(chordName, key) !== null;
};

/**
 * Check if a chord is a basic diatonic chord (no extensions, in key)
 */
export const isBasicDiatonicChord = (chordName, key) => {
  if (!chordName || !key) return false;

  // Must be basic (no extensions)
  const name = chordName.toLowerCase();
  const complexPatterns =
    /(7|9|11|13|sus|add|maj7|dim7|aug7|m7|b5|#5|6|maj9|9th)/;
  if (complexPatterns.test(name)) return false;

  // Must be in key (diatonic)
  const degree = getChordDegree(chordName, key);
  if (!degree) return false;

  // Must be a diatonic degree (not chromatic like bII, #IV)
  // Diatonic degrees don't have b or # prefix (except for diminished which has °)
  const isDiatonic = !degree.startsWith("b") && !degree.startsWith("#");

  return isDiatonic;
};

/**
 * Get the 7 diatonic chords for a key with their correct qualities
 * Returns array of { root, quality } where quality is 'major', 'minor', or 'diminished'
 */
export const getDiatonicChords = (key) => {
  if (!key) return [];

  const keyMatch = key.match(/^([A-G][#b]?)\s*(Major|Minor|maj|min)$/i);
  if (!keyMatch) return [];

  const keyRoot = keyMatch[1];
  const isMinor = /minor|min/i.test(keyMatch[2]);

  const noteToIndex = (note) => {
    const noteMap = {
      C: 0,
      "C#": 1,
      Db: 1,
      D: 2,
      "D#": 3,
      Eb: 3,
      E: 4,
      F: 5,
      "F#": 6,
      Gb: 6,
      G: 7,
      "G#": 8,
      Ab: 8,
      A: 9,
      "A#": 10,
      Bb: 10,
      B: 11,
    };
    return noteMap[note] !== undefined ? noteMap[note] : null;
  };

  const indexToNote = (index, preferSharp = true) => {
    const sharpNotes = [
      "C",
      "C#",
      "D",
      "D#",
      "E",
      "F",
      "F#",
      "G",
      "G#",
      "A",
      "A#",
      "B",
    ];
    const flatNotes = [
      "C",
      "Db",
      "D",
      "Eb",
      "E",
      "F",
      "Gb",
      "G",
      "Ab",
      "A",
      "Bb",
      "B",
    ];
    return preferSharp ? sharpNotes[index] : flatNotes[index];
  };

  const keyIndex = noteToIndex(keyRoot);
  if (keyIndex === null) return [];

  // Diatonic scale intervals
  const majorIntervals = [0, 2, 4, 5, 7, 9, 11]; // I, II, III, IV, V, VI, VII
  const minorIntervals = [0, 2, 3, 5, 7, 8, 10]; // i, ii, III, iv, v, VI, VII

  const intervals = isMinor ? minorIntervals : majorIntervals;

  // Chord qualities for each degree
  // Major key: I(maj), ii(min), iii(min), IV(maj), V(maj), vi(min), vii°(dim)
  // Minor key: i(min), ii°(dim), III(maj), iv(min), v(min), VI(maj), VII(maj)
  const majorQualities = [
    "major",
    "minor",
    "minor",
    "major",
    "major",
    "minor",
    "diminished",
  ];
  const minorQualities = [
    "minor",
    "diminished",
    "major",
    "minor",
    "minor",
    "major",
    "major",
  ];

  const qualities = isMinor ? minorQualities : majorQualities;

  // Get chords with their roots and qualities
  const chords = intervals.map((interval, index) => {
    const noteIndex = (keyIndex + interval) % 12;
    const root = indexToNote(noteIndex);
    return { root, quality: qualities[index] };
  });

  return chords;
};

// Chord normalization functions
export const normalizeChordLibraryItem = (chord) => ({
  ...chord,
  chordName: chord.chordName || chord.name || chord.label || "Chord",
  midiNotes: parseMidiNotes(chord.midiNotes),
  // Add note names for display
  noteNames: parseMidiNotes(chord.midiNotes).map(midiToNoteNameNoOctave),
});

export const normalizeChordEntry = (entry) => {
  console.log("(NO $) [DEBUG][normalizeChordEntry] Input:", {
    entry,
    type: typeof entry,
    isNull: entry === null,
    isUndefined: entry === undefined,
    isEmptyString: entry === "",
    isFalsy: !entry,
  });
  
  // Handle null/undefined - return null
  if (entry === null || entry === undefined) {
    console.log("(NO $) [DEBUG][normalizeChordEntry] Entry is null/undefined, returning null");
    return null;
  }
  
  // Handle empty string - allow clearing chords (return empty chord entry)
  if (typeof entry === "string") {
    const result = {
      chordId: null,
      chordName: entry || "", // Allow empty string for clearing
      midiNotes: [],
      variation: null,
      rhythm: null,
      instrumentStyle: null,
    };
    console.log("(NO $) [DEBUG][normalizeChordEntry] String input, returning:", result);
    return result;
  }

  const chordName = entry.chordName || entry.name || entry.label || "";
  console.log("(NO $) [DEBUG][normalizeChordEntry] Object input, extracted chordName:", chordName);
  // Allow empty chordName for clearing - don't return null
  // An empty chordName is valid (represents a cleared/empty chord)
  // Always return a valid entry object, even if chordName is empty

  return {
    chordId: entry.chordId || entry._id || entry.id || null,
    chordName,
    midiNotes: parseMidiNotes(entry.midiNotes),
    variation: entry.variation || entry.variant || null,
    rhythmPatternId:
      entry.rhythmPatternId ||
      entry.rhythmPattern ||
      entry.patternId ||
      entry.rhythm?.patternId ||
      entry.rhythm?.id ||
      null,
    rhythmPatternName:
      entry.rhythmPatternName ||
      entry.rhythm?.name ||
      entry.patternName ||
      null,
    rhythmPatternSteps:
      entry.rhythmPatternSteps ||
      entry.rhythm?.steps ||
      entry.patternSteps ||
      null,
    rhythm: entry.rhythm || entry.pattern || null,
    instrumentStyle: entry.instrumentStyle || entry.timbre || null,
  };
};

export const hydrateChordProgression = (rawProgression) => {
  if (!rawProgression) return [];

  let parsed = rawProgression;
  if (typeof rawProgression === "string") {
    try {
      parsed = JSON.parse(rawProgression);
    } catch {
      parsed = [];
    }
  }

  if (!Array.isArray(parsed)) return [];

  return parsed
    .map(normalizeChordEntry)
    .filter((entry) => entry && entry.chordName);
};

export const cloneChordEntry = (entry) => {
  const normalized = normalizeChordEntry(entry);
  return normalized ? { ...normalized } : null;
};

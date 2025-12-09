export const parseMidiNotes = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

export const midiToNoteName = (midiNote) => {
  const noteNames = [
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
  const octave = Math.floor(midiNote / 12) - 1;
  const note = ((midiNote % 12) + 12) % 12;
  return noteNames[note] + octave;
};

export const midiToNoteNameNoOctave = (midiNote) => {
  const noteNames = [
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
  const note = ((midiNote % 12) + 12) % 12;
  return noteNames[note];
};

export const getMidiNotesForChord = (chordName) => {
  if (!chordName) return [];

  const rootMap = {
    C: 60,
    "C#": 61,
    Db: 61,
    D: 62,
    "D#": 63,
    Eb: 63,
    E: 64,
    F: 65,
    "F#": 66,
    Gb: 66,
    G: 67,
    "G#": 68,
    Ab: 68,
    A: 69,
    "A#": 70,
    Bb: 70,
    B: 71,
  };

  const qualityMap = {
    "": [0, 4, 7], // Major
    m: [0, 3, 7], // Minor
    maj7: [0, 4, 7, 11],
    m7: [0, 3, 7, 10],
    7: [0, 4, 7, 10],
    dim: [0, 3, 6],
    aug: [0, 4, 8],
    sus4: [0, 5, 7],
    sus2: [0, 2, 7],
  };

  const match = chordName.match(/^([A-G][#b]?)(.*)$/);
  if (!match) return [];

  const root = match[1];
  const quality = match[2];
  const baseMidi = rootMap[root];
  if (baseMidi === undefined) return [];

  const intervals = qualityMap[quality] || qualityMap[""];
  return intervals.map((interval) => baseMidi + interval);
};

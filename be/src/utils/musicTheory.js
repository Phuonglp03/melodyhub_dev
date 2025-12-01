const NOTE_NAMES = [
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

const NOTE_ALIASES = {
  DB: 1,
  EB: 3,
  GB: 6,
  AB: 8,
  BB: 10,
  CB: 11,
  FB: 4,
  "E#": 5,
  "B#": 0,
};

const SCALE_ALIASES = {
  major: "major",
  maj: "major",
  ionian: "major",
  minor: "minor",
  min: "minor",
  aeolian: "minor",
};

const SCALE_LABELS = {
  major: "Major",
  minor: "Minor",
};

export const DEFAULT_KEY = Object.freeze({
  root: 0,
  scale: "major",
  name: "C Major",
});

export const DEFAULT_TIME_SIGNATURE = Object.freeze({
  numerator: 4,
  denominator: 4,
  name: "4/4",
});

const clampNumber = (value, min, max, fallback) => {
  const num = Number(value);
  if (Number.isFinite(num)) {
    return Math.min(max, Math.max(min, num));
  }
  return fallback;
};

const normalizeRootValue = (input) => {
  if (typeof input === "number" && input >= 0 && input <= 11) {
    return Math.round(input);
  }

  if (typeof input === "string") {
    const trimmed = input.trim().replace(/♭/gi, "b").replace(/♯/gi, "#");
    const normalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    if (NOTE_NAMES.includes(normalized)) {
      return NOTE_NAMES.indexOf(normalized);
    }
    const upper = normalized.toUpperCase();
    if (NOTE_ALIASES[upper] !== undefined) return NOTE_ALIASES[upper];
    if (NOTE_NAMES.includes(upper)) return NOTE_NAMES.indexOf(upper);
  }

  return DEFAULT_KEY.root;
};

const normalizeScaleValue = (input) => {
  if (!input) return DEFAULT_KEY.scale;
  const lowered = String(input).trim().toLowerCase();
  return SCALE_ALIASES[lowered] || DEFAULT_KEY.scale;
};

const buildKeyName = (root, scale) => {
  const rootName = NOTE_NAMES[root] || NOTE_NAMES[DEFAULT_KEY.root];
  const scaleLabel = SCALE_LABELS[scale] || SCALE_LABELS[DEFAULT_KEY.scale];
  return `${rootName} ${scaleLabel}`;
};

export const normalizeKeyPayload = (input) => {
  if (!input) {
    return { ...DEFAULT_KEY };
  }

  if (typeof input === "string") {
    const parts = input.trim().split(/\s+/);
    const rootPart = parts[0];
    const scalePart = parts[1] || DEFAULT_KEY.scale;
    const root = normalizeRootValue(rootPart);
    const scale = normalizeScaleValue(scalePart);
    return {
      root,
      scale,
      name: buildKeyName(root, scale),
    };
  }

  if (typeof input === "object") {
    const root = normalizeRootValue(
      input.root ?? input.note ?? input.pitch ?? DEFAULT_KEY.root
    );
    const scale = normalizeScaleValue(input.scale);
    const name = input.name || buildKeyName(root, scale);
    return {
      root,
      scale,
      name,
    };
  }

  return { ...DEFAULT_KEY };
};

export const normalizeTimeSignaturePayload = (input) => {
  if (!input) return { ...DEFAULT_TIME_SIGNATURE };

  if (typeof input === "string") {
    const match = input.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
    if (match) {
      const numerator = clampNumber(
        match[1],
        1,
        32,
        DEFAULT_TIME_SIGNATURE.numerator
      );
      const denominator = clampNumber(
        match[2],
        1,
        32,
        DEFAULT_TIME_SIGNATURE.denominator
      );
      return {
        numerator,
        denominator,
        name: `${numerator}/${denominator}`,
      };
    }
  }

  if (typeof input === "object") {
    const numerator = clampNumber(
      input.numerator ?? input.top,
      1,
      32,
      DEFAULT_TIME_SIGNATURE.numerator
    );
    const denominator = clampNumber(
      input.denominator ?? input.bottom,
      1,
      32,
      DEFAULT_TIME_SIGNATURE.denominator
    );
    const name = input.name || `${numerator}/${denominator}`;
    return {
      numerator,
      denominator,
      name,
    };
  }

  return { ...DEFAULT_TIME_SIGNATURE };
};

export const clampSwingAmount = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(100, Math.max(0, numeric));
};

export const getKeyDisplayName = (value) => normalizeKeyPayload(value).name;
export const getTimeSignatureDisplayName = (value) =>
  normalizeTimeSignaturePayload(value).name;

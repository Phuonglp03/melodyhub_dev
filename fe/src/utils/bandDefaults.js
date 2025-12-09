// fe/src/utils/bandDefaults.js
// Utility helpers for band member defaults and normalization

const generateId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `member-${Math.random().toString(36).slice(2, 10)}`;
};

export const createBandMember = (overrides = {}) => ({
  instanceId: overrides.instanceId || generateId(),
  name: overrides.name || "New Instrument",
  type: overrides.type || "keys", // drums | bass | keys | guitar | strings | synth
  role: overrides.role || "comping", // percussion | bass | comping | pad | lead
  soundBank: overrides.soundBank || "grand-piano",
  volume: overrides.volume ?? 0.8,
  pan: overrides.pan ?? 0,
  isMuted: overrides.isMuted ?? false,
  isSolo: overrides.isSolo ?? false,
  ...overrides,
});

export const DEFAULT_BAND_MEMBERS = [
  createBandMember({
    name: "Drums",
    type: "drums",
    role: "percussion",
    soundBank: "jazz-kit",
    volume: 0.85,
  }),
  createBandMember({
    name: "Bass",
    type: "bass",
    role: "bass",
    soundBank: "upright",
    volume: 0.8,
  }),
  createBandMember({
    name: "Piano",
    type: "keys",
    role: "comping",
    soundBank: "grand-piano",
    volume: 0.78,
  }),
];

export const deriveLegacyMixFromMembers = (members = []) => {
  const volumes = { drums: 0.8, bass: 0.8, piano: 0.8 };
  const mutes = { drums: false, bass: false, piano: false };

  members.forEach((member) => {
    if (!member) return;
    if (member.type === "drums") {
      volumes.drums = member.volume ?? volumes.drums;
      mutes.drums = member.isMuted ?? mutes.drums;
    }
    if (member.type === "bass") {
      volumes.bass = member.volume ?? volumes.bass;
      mutes.bass = member.isMuted ?? mutes.bass;
    }
    if (member.type === "keys") {
      volumes.piano = member.volume ?? volumes.piano;
      mutes.piano = member.isMuted ?? mutes.piano;
    }
  });

  return { volumes, mutes };
};

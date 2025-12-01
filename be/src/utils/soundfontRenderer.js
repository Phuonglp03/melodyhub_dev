/**
 * @deprecated This module requires OfflineAudioContext which is not available in Node.js.
 * It will always throw an error and fall back to the legacy waveform renderer.
 * This file is kept for reference but should not be used in production.
 * Use midiToAudioConverter.js instead.
 */
import Soundfont from "soundfont-player";
import audioBufferToWav from "audiobuffer-to-wav";
import fetch from "node-fetch";
import { uploadFromBuffer } from "./cloudinaryUploader.js";

const SAMPLE_RATE = 44100;
const DEFAULT_PATCH = "acoustic_grand_piano";
const DEFAULT_SOUNDFONT = "MusyngKite";

// Minimal polyfills required by soundfont-player when running in environments
// that already provide Web Audio (or will in the future). On plain Node
// without a Web Audio implementation this renderer will throw and the caller
// will fall back to the legacy waveform renderer.
const bootstrapAudioGlobals = () => {
  if (!globalThis.window) {
    globalThis.window = globalThis;
  }
  if (!globalThis.navigator) {
    globalThis.navigator = { userAgent: "node" };
  }
  if (!globalThis.performance) {
    globalThis.performance = {
      now: () => Date.now(),
    };
  }
  if (!globalThis.fetch) {
    globalThis.fetch = fetch;
  }
};

bootstrapAudioGlobals();

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

const SOUNDFONT_PATCH_MAP = {
  acoustic_grand_piano: "acoustic_grand_piano",
  bright_acoustic_piano: "bright_acoustic_piano",
  electric_grand_piano: "electric_grand_piano",
  honky_tonk_piano: "honky_tonk_piano",
  electric_piano_1: "electric_piano_1",
  electric_piano_2: "electric_piano_2",
  clavinet: "clavinet",
  drawbar_organ: "drawbar_organ",
  hammond_organ: "drawbar_organ",
  percussive_organ: "percussive_organ",
  rock_organ: "rock_organ",
  church_organ: "church_organ",
  acoustic_guitar_nylon: "acoustic_guitar_nylon",
  acoustic_guitar_steel: "acoustic_guitar_steel",
  electric_guitar_jazz: "electric_guitar_jazz",
  electric_guitar_clean: "electric_guitar_clean",
  electric_guitar_muted: "electric_guitar_muted",
  overdriven_guitar: "overdriven_guitar",
  distorted_guitar: "distorted_guitar",
  acoustic_bass: "acoustic_bass",
  electric_bass_finger: "electric_bass_finger",
  electric_bass_pick: "electric_bass_pick",
  fretless_bass: "fretless_bass",
  slap_bass_1: "slap_bass_1",
  slap_bass_2: "slap_bass_2",
  synth_bass_1: "synth_bass_1",
  synth_bass_2: "synth_bass_2",
  violin: "violin",
  viola: "viola",
  cello: "cello",
  contrabass: "contrabass",
  string_ensemble_1: "string_ensemble_1",
  string_ensemble_2: "string_ensemble_2",
  tremolo_strings: "tremolo_strings",
  pizzicato_strings: "pizzicato_strings",
  orchestral_harp: "orchestral_harp",
  timpani: "timpani",
  trumpet: "trumpet",
  trombone: "trombone",
  tuba: "tuba",
  french_horn: "french_horn",
  brass_section: "brass_section",
  synth_brass_1: "synth_brass_1",
  synth_brass_2: "synth_brass_2",
  flute: "flute",
  alto_sax: "alto_sax",
  pad_1_new_age: "pad_1_new_age",
  pad_2_warm: "pad_2_warm",
  pad_3_polysynth: "pad_3_polysynth",
  pad_4_choir: "pad_4_choir",
  pad_5_bowed: "pad_5_bowed",
  pad_6_metallic: "pad_6_metallic",
  pad_7_halo: "pad_7_halo",
  pad_8_sweep: "pad_8_sweep",
  lead_1_square: "lead_1_square",
  lead_2_sawtooth: "lead_2_sawtooth",
  lead_3_calliope: "lead_3_calliope",
  lead_4_chiff: "lead_4_chiff",
  lead_5_charang: "lead_5_charang",
  lead_6_voice: "lead_6_voice",
  lead_7_fifths: "lead_7_fifths",
  lead_8_bass_lead: "lead_8_bass_lead",
  standard: "synth_drum_1",
  drum_kit: "synth_drum_1",
};

const chordNameToMidiNotes = (chordName, octave = 4) => {
  if (!chordName || typeof chordName !== "string") return [];

  const baseMap = {
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

  const match = chordName.match(/^([A-G][#b]?)(.*)$/i);
  if (!match) return [];

  const baseNote = match[1];
  const quality = (match[2] || "").toLowerCase();
  const baseMidi = baseMap[baseNote];
  if (baseMidi === undefined) return [];

  const root = (octave + 1) * 12 + baseMidi;

  let intervals = [0, 4, 7]; // major triad default
  if (quality === "m" || quality === "min" || quality === "minor") {
    intervals = [0, 3, 7];
  } else if (quality === "dim") {
    intervals = [0, 3, 6];
  } else if (quality === "aug") {
    intervals = [0, 4, 8];
  } else if (quality === "maj7" || quality === "major7") {
    intervals = [0, 4, 7, 11];
  } else if (quality === "m7" || quality === "min7" || quality === "minor7") {
    intervals = [0, 3, 7, 10];
  } else if (quality === "7" || quality === "dom7") {
    intervals = [0, 4, 7, 10];
  }

  return intervals.map((interval) => root + interval);
};

const midiToNoteName = (midiNumber) => {
  const octave = Math.floor(midiNumber / 12) - 1;
  const name = NOTE_NAMES[midiNumber % 12];
  return `${name}${octave}`;
};

const getChordMidiNotes = (chord) => {
  if (Array.isArray(chord?.midiNotes) && chord.midiNotes.length) {
    return chord.midiNotes
      .map((note) => Number(note))
      .filter((note) => !Number.isNaN(note));
  }
  if (chord?.chordName) {
    return chordNameToMidiNotes(chord.chordName);
  }
  return [];
};

const resolvePatchName = (soundfontKey = "", instrumentProgram = 0) => {
  if (soundfontKey && SOUNDFONT_PATCH_MAP[soundfontKey]) {
    return SOUNDFONT_PATCH_MAP[soundfontKey];
  }

  if (instrumentProgram === -1) {
    return "synth_drum_1";
  }

  const programFallbacks = {
    0: "acoustic_grand_piano",
    4: "electric_piano_1",
    25: "acoustic_guitar_steel",
    27: "electric_guitar_clean",
    32: "acoustic_bass",
    33: "electric_bass_finger",
    40: "violin",
    41: "viola",
    42: "cello",
    46: "orchestral_harp",
    48: "string_ensemble_1",
    56: "trumpet",
    60: "french_horn",
    62: "synth_brass_1",
    64: "lead_1_square",
    80: "lead_1_square",
    88: "pad_1_new_age",
    92: "pad_5_bowed",
  };

  return programFallbacks[instrumentProgram] || DEFAULT_PATCH;
};

export const renderChordsWithSoundfont = async (chords = [], options = {}) => {
  const {
    tempo = 120,
    chordDuration = 4,
    projectId = "unknown",
    soundfontKey = "",
    instrumentProgram = 0,
    cloudinaryFolder = "backing_tracks_audio",
  } = options;

  if (!Array.isArray(chords) || chords.length === 0) {
    return null;
  }

  try {
    const secondsPerBeat = 60 / tempo;
    const chordDurationSeconds = chordDuration * secondsPerBeat;
    const totalDurationSeconds = chords.length * chordDurationSeconds + 1; // add tail
    const totalSamples = Math.ceil(totalDurationSeconds * SAMPLE_RATE);

    if (typeof globalThis.OfflineAudioContext !== "function") {
      throw new Error(
        "OfflineAudioContext is not available in this environment"
      );
    }

    const offlineContext = new globalThis.OfflineAudioContext(
      2,
      totalSamples,
      SAMPLE_RATE
    );

    const patchName = resolvePatchName(soundfontKey, instrumentProgram);

    const instrument = await Soundfont.instrument(offlineContext, patchName, {
      format: "mp3",
      soundfont: DEFAULT_SOUNDFONT,
      gain: 1,
    });

    chords.forEach((chord, index) => {
      const midiNotes = getChordMidiNotes(chord);
      if (!midiNotes.length) return;

      const startTime = index * chordDurationSeconds;
      const gain = 0.8 / midiNotes.length;

      midiNotes.forEach((midiNote) => {
        const noteName = midiToNoteName(midiNote);
        instrument.play(noteName, startTime, {
          gain,
          duration: chordDurationSeconds,
        });
      });
    });

    const renderedBuffer = await offlineContext.startRendering();
    const wavArrayBuffer = audioBufferToWav(renderedBuffer);
    const wavBuffer = Buffer.from(new Uint8Array(wavArrayBuffer));

    const filename = `backing_${projectId}_${Date.now()}.wav`;
    const uploadResult = await uploadFromBuffer(
      wavBuffer,
      cloudinaryFolder,
      "video"
    );

    return {
      filename,
      url: uploadResult.secure_url,
      cloudinaryUrl: uploadResult.secure_url,
    };
  } catch (error) {
    console.error("[SoundfontRenderer] Failed to render audio:", error);
    return null;
  }
};

export default renderChordsWithSoundfont;

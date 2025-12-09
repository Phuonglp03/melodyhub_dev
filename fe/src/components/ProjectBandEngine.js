// fe/src/components/ProjectBandEngine.js
// Real-time band playback for ProjectDetailPage
import { useEffect, useRef, useMemo } from "react";
import * as Tone from "tone";

const chordToNotes = (chordName) => {
  if (
    !chordName ||
    chordName === "" ||
    chordName === "N.C." ||
    chordName === "%"
  ) {
    return null;
  }

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

  let root = chordName[0];
  let idx = 1;
  if (chordName[1] === "#" || chordName[1] === "b") {
    root += chordName[1];
    idx = 2;
  }
  const quality = chordName.slice(idx);
  const rootNote = noteMap[root];
  if (rootNote === undefined) return null;

  let intervals = [0, 4, 7];
  if (quality.includes("m7b5") || quality.includes("ø")) {
    intervals = [0, 3, 6, 10];
  } else if (quality.includes("dim7") || quality.includes("°7")) {
    intervals = [0, 3, 6, 9];
  } else if (quality.includes("dim") || quality.includes("°")) {
    intervals = [0, 3, 6];
  } else if (quality.includes("aug") || quality.includes("+")) {
    intervals = [0, 4, 8];
  } else if (quality.includes("maj7") || quality.includes("M7")) {
    intervals = [0, 4, 7, 11];
  } else if (quality.includes("m7") || quality.includes("min7")) {
    intervals = [0, 3, 7, 10];
  } else if (quality.includes("7")) {
    intervals = [0, 4, 7, 10];
  } else if (quality.includes("m") || quality.includes("min")) {
    intervals = [0, 3, 7];
  }

  return intervals.map((i) => noteNames[(rootNote + i) % 12] + "3");
};

const stylePatterns = {
  Swing: {
    piano: [0, 2],
    bass: [0, 2],
    drums: { kick: [0], snare: [1, 3], hihat: [0, 1, 2, 3] },
  },
  Bossa: {
    piano: [0, 1.5, 3],
    bass: [0, 1.5, 2, 3.5],
    drums: { kick: [0, 2], snare: [], hihat: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5] },
  },
  Latin: {
    piano: [0, 0.5, 1.5, 2, 3],
    bass: [0, 1, 2, 3],
    drums: {
      kick: [0, 2.5],
      snare: [1, 3],
      hihat: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5],
    },
  },
  Ballad: {
    piano: [0],
    bass: [0, 2],
    drums: { kick: [0], snare: [2], hihat: [0, 1, 2, 3] },
  },
  Funk: {
    piano: [0, 0.5, 1.5, 2.5, 3],
    bass: [0, 0.75, 1.5, 2, 2.75, 3.5],
    drums: {
      kick: [0, 1.5, 2.5],
      snare: [1, 3],
      hihat: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5],
    },
  },
  Rock: {
    piano: [0, 2],
    bass: [0, 1, 2, 3],
    drums: {
      kick: [0, 2],
      snare: [1, 3],
      hihat: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5],
    },
  },
};

const DEFAULT_ROLE_BY_TYPE = {
  drums: "percussion",
  bass: "bass",
  piano: "comping",
  guitar: "comping",
  strings: "pad",
  pad: "pad",
  percussion: "percussion",
};

const clampPan = (value = 0) => Math.max(-1, Math.min(1, value));
const clampVolume = (value = 0.8) => Math.max(0, Math.min(1, value));

const createInstrumentInstance = (member) => {
  const role = member.role || DEFAULT_ROLE_BY_TYPE[member.type] || "comping";

  if (member.type === "drums" || role === "percussion") {
    const volumeNode = new Tone.Volume(0);
    const pannerNode = new Tone.Panner(clampPan(member.pan));
    volumeNode.chain(pannerNode, Tone.getDestination());

    const kick = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 6 });
    const snare = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.2, sustain: 0 },
    });
    const hihat = new Tone.MetalSynth({
      frequency: 200,
      envelope: { attack: 0.001, decay: 0.1, release: 0.01 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5,
    });

    kick.connect(volumeNode);
    snare.connect(volumeNode);
    hihat.connect(volumeNode);

    return {
      kind: "drums",
      role,
      soundBank: member.soundBank,
      volumeNode,
      pannerNode,
      nodes: { kick, snare, hihat },
    };
  }

  const volumeNode = new Tone.Volume(0);
  const pannerNode = new Tone.Panner(clampPan(member.pan));
  volumeNode.chain(pannerNode, Tone.getDestination());

  let node;
  if (member.type === "bass" || role === "bass") {
    node = new Tone.MonoSynth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.05, decay: 0.2, sustain: 0.6, release: 0.4 },
      filterEnvelope: {
        attack: 0.06,
        decay: 0.2,
        sustain: 0.5,
        release: 0.2,
        baseFrequency: 200,
        octaves: 2,
      },
    });
  } else {
    node = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.8 },
    });
  }
  node.connect(volumeNode);

  return {
    kind: "synth",
    role,
    soundBank: member.soundBank,
    node,
    volumeNode,
    pannerNode,
  };
};

const disposeInstrument = (instance) => {
  if (!instance) return;
  if (instance.kind === "drums") {
    instance.nodes.kick.dispose();
    instance.nodes.snare.dispose();
    instance.nodes.hihat.dispose();
  } else {
    instance.node.dispose();
  }
  instance.volumeNode.dispose();
  instance.pannerNode.dispose();
};

const updateInstrumentMix = (instance, member) => {
  if (!instance) return;
  const gainValue = member.isMuted
    ? -Infinity
    : Tone.gainToDb(clampVolume(member.volume));
  instance.volumeNode.volume.value = gainValue;
  if (instance.pannerNode) {
    instance.pannerNode.pan.value = clampPan(member.pan);
  }
};

const triggerPercussion = (instance, pattern, beatInBar, time) => {
  if (!instance?.nodes) return;
  const drumsPattern = pattern?.drums || {};
  if (drumsPattern.kick?.includes(beatInBar)) {
    instance.nodes.kick?.triggerAttackRelease("C1", "8n", time);
  }
  if (drumsPattern.snare?.includes(beatInBar)) {
    instance.nodes.snare?.triggerAttackRelease("8n", time);
  }
  if (drumsPattern.hihat?.includes(beatInBar)) {
    instance.nodes.hihat?.triggerAttackRelease("32n", time);
  }
};

const triggerBass = (instance, pattern, notes, beatInBar, time) => {
  if (!instance?.node) return;
  if (!notes || !notes.length) return;
  if (!pattern?.bass?.includes(beatInBar)) return;
  const bassNote = notes[0].replace("3", "2");
  instance.node.triggerAttackRelease(bassNote, "8n", time);
};

const triggerComping = (instance, pattern, notes, beatInBar, time) => {
  if (!instance?.node) return;
  if (!notes || !notes.length) return;
  const rhythm = pattern?.piano || [0];
  if (!rhythm.includes(beatInBar)) return;
  instance.node.triggerAttackRelease(notes, "8n", time);
};

const triggerPad = (instance, notes, beatInBar, time) => {
  if (!instance?.node) return;
  if (!notes || !notes.length) return;
  if (beatInBar !== 0) return;
  instance.node.triggerAttackRelease(notes, "1m", time, 0.7);
};

export default function ProjectBandEngine({
  chordProgression = [],
  isPlaying,
  bpm = 120,
  style = "Swing",
  onBeatUpdate,
  bandSettings = {},
}) {
  const instrumentsRef = useRef(new Map());
  const membersRef = useRef([]);
  const loopRef = useRef(null);
  const beatRef = useRef(0);

  const currentMembers = useMemo(
    () => bandSettings.members || [],
    [bandSettings.members]
  );

  useEffect(() => {
    membersRef.current = currentMembers;
  }, [currentMembers]);

  useEffect(() => {
    const current = instrumentsRef.current;
    const nextIds = new Set();

    currentMembers.forEach((member) => {
      if (!member?.instanceId) return;
      nextIds.add(member.instanceId);
      const existing = current.get(member.instanceId);
      if (
        !existing ||
        existing.soundBank !== member.soundBank ||
        (existing.kind === "drums") !== (member.type === "drums")
      ) {
        if (existing) disposeInstrument(existing);
        const created = createInstrumentInstance(member);
        current.set(member.instanceId, created);
      }
      updateInstrumentMix(current.get(member.instanceId), member);
    });

    current.forEach((instance, id) => {
      if (!nextIds.has(id)) {
        disposeInstrument(instance);
        current.delete(id);
      }
    });
  }, [currentMembers]);

  useEffect(() => {
    return () => {
      instrumentsRef.current.forEach(disposeInstrument);
      instrumentsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (isPlaying && chordProgression.length > 0 && currentMembers.length > 0) {
      startPlayback();
    } else {
      stopPlayback();
    }

    return () => stopPlayback();
  }, [isPlaying, bpm, style, chordProgression, currentMembers.length]);

  const startPlayback = async () => {
    await Tone.start();
    Tone.Transport.bpm.value = bpm;
    beatRef.current = 0;

    const pattern = stylePatterns[style] || stylePatterns.Swing;
    const totalBeats = chordProgression.length * 4;
    if (totalBeats === 0) return;

    loopRef.current = new Tone.Loop((time) => {
      const beat = beatRef.current;
      const beatInBar = beat % 4;
      const chordIndex = Math.floor(beat / 4) % chordProgression.length;
      const chord =
        chordProgression[chordIndex]?.chordName ||
        chordProgression[chordIndex]?.chord ||
        "";
      const notes = chordToNotes(chord);

      membersRef.current.forEach((member) => {
        if (!member || member.isMuted) return;
        const instrument = instrumentsRef.current.get(member.instanceId);
        if (!instrument) return;
        const role = member.role || instrument.role;

        if (role === "percussion") {
          triggerPercussion(instrument, pattern, beatInBar, time);
        } else if (role === "bass") {
          triggerBass(instrument, pattern, notes, beatInBar, time);
        } else if (role === "pad") {
          triggerPad(instrument, notes, beatInBar, time);
        } else {
          triggerComping(instrument, pattern, notes, beatInBar, time);
        }
      });

      if (onBeatUpdate) {
        onBeatUpdate(beat, chordIndex);
      }
      beatRef.current = (beat + 1) % totalBeats;
    }, "4n");

    loopRef.current.start(0);
    Tone.Transport.start();
  };

  const stopPlayback = () => {
    loopRef.current?.stop();
    loopRef.current?.dispose();
    loopRef.current = null;
    Tone.Transport.stop();
    beatRef.current = 0;
    if (onBeatUpdate) {
      onBeatUpdate(0, 0);
    }
  };

  return null;
}

// src/utils/audioScheduler.js
// Pure function to schedule music on ANY Tone.Transport (Realtime or Offline)
import * as Tone from 'tone';

// Helper: Parse chord to notes
const chordToNotes = (chordName) => {
  if (!chordName || chordName === '' || chordName === 'N.C.' || chordName === '%') {
    return null;
  }

  const noteMap = {
    C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5,
    'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
  };
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  let root = chordName[0];
  let idx = 1;
  if (chordName[1] === '#' || chordName[1] === 'b') {
    root += chordName[1];
    idx = 2;
  }
  const quality = chordName.slice(idx);
  const rootNote = noteMap[root];
  if (rootNote === undefined) return null;

  let intervals = [0, 4, 7]; // Major triad default
  if (quality.includes('m7b5') || quality.includes('ø')) {
    intervals = [0, 3, 6, 10];
  } else if (quality.includes('dim7') || quality.includes('°7')) {
    intervals = [0, 3, 6, 9];
  } else if (quality.includes('dim') || quality.includes('°')) {
    intervals = [0, 3, 6];
  } else if (quality.includes('aug') || quality.includes('+')) {
    intervals = [0, 4, 8];
  } else if (quality.includes('maj7') || quality.includes('M7')) {
    intervals = [0, 4, 7, 11];
  } else if (quality.includes('m7') || quality.includes('min7')) {
    intervals = [0, 3, 7, 10];
  } else if (quality.includes('7')) {
    intervals = [0, 4, 7, 10];
  } else if (quality.includes('m') || quality.includes('min')) {
    intervals = [0, 3, 7];
  }

  return intervals.map((i) => noteNames[(rootNote + i) % 12] + '3');
};

// Style patterns
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
    drums: { kick: [0, 2.5], snare: [1, 3], hihat: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5] },
  },
  Ballad: {
    piano: [0],
    bass: [0, 2],
    drums: { kick: [0], snare: [2], hihat: [0, 1, 2, 3] },
  },
  Funk: {
    piano: [0, 0.5, 1.5, 2.5, 3],
    bass: [0, 0.75, 1.5, 2, 2.75, 3.5],
    drums: { kick: [0, 1.5, 2.5], snare: [1, 3], hihat: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5] },
  },
  Rock: {
    piano: [0, 2],
    bass: [0, 1, 2, 3],
    drums: { kick: [0, 2], snare: [1, 3], hihat: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5] },
  },
};

/**
 * Schedule the entire project on a Tone.Transport
 * @param {Tone.Transport} transport - The transport to schedule on
 * @param {Object} songData - { bpm, sections, bandSettings }
 * @param {Object} buffers - { piano, bass, drums: {kick, snare, hihat}, licks: {} }
 */
export const scheduleProject = (transport, songData, buffers) => {
  const { bpm, sections, bandSettings = {} } = songData;
  const pattern = stylePatterns[bandSettings?.style || songData.style || 'Swing'] || stylePatterns.Swing;

  // Ensure bandSettings has mutes structure
  const mutes = bandSettings.mutes || { piano: false, bass: false, drums: false };

  transport.bpm.value = bpm;

  let absoluteBar = 0;

  sections.forEach((section) => {
    const sectionBeats = section.bars.length * 4;
    const mixOverride = section.mixOverride || {};

    section.bars.forEach((chord, barIndex) => {
      const barStartTime = `${absoluteBar}:0:0`;
      const beatInBar = 0;

      const notes = chordToNotes(chord);

      // Piano
      if (notes && !mixOverride.pianoMuted && !mutes.piano) {
        if (pattern.piano.includes(beatInBar)) {
          transport.schedule((time) => {
            if (buffers.piano) {
              buffers.piano.triggerAttackRelease(notes, '8n', time);
            }
          }, barStartTime);
        }
      }

      // Bass
      if (notes && !mixOverride.bassMuted && !mutes.bass) {
        if (pattern.bass.includes(beatInBar)) {
          transport.schedule((time) => {
            if (buffers.bass) {
              const bassNote = notes[0].replace('3', '2');
              buffers.bass.triggerAttackRelease(bassNote, '8n', time);
            }
          }, barStartTime);
        }
      }

      // Drums
      if (!mixOverride.drumsMuted && !mutes.drums) {
        if (buffers.drums) {
          // Kick
          if (pattern.drums.kick.includes(beatInBar)) {
            transport.schedule((time) => {
              buffers.drums.kick?.triggerAttackRelease('C1', '8n', time);
            }, barStartTime);
          }
          // Snare
          if (pattern.drums.snare.includes(beatInBar)) {
            transport.schedule((time) => {
              buffers.drums.snare?.triggerAttackRelease('8n', time);
            }, barStartTime);
          }
          // Hihat
          if (pattern.drums.hihat.includes(beatInBar)) {
            transport.schedule((time) => {
              buffers.drums.hihat?.triggerAttackRelease('32n', time);
            }, barStartTime);
          }
        }
      }

      // Licks
      if (section.licks && section.licks.length > 0) {
        section.licks.forEach((lick) => {
          if (lick.startBar === barIndex && lick.audioUrl) {
            const lickTime = `${absoluteBar}:0:0`;
            transport.schedule((time) => {
              const player = buffers.licks?.[lick.id || lick.lickId];
              if (player && player.buffer?.loaded) {
                player.stop();
                player.start(time);
              }
            }, lickTime);
          }
        });
      }

      absoluteBar++;
    });
  });
};

/**
 * Calculate total duration in seconds
 */
export const calculateDuration = (songData) => {
  const totalBars = songData.sections.reduce((sum, s) => sum + s.bars.length, 0);
  const secondsPerBar = (60 / songData.bpm) * 4;
  return totalBars * secondsPerBar + 2; // +2s tail
};


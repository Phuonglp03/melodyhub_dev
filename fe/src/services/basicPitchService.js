/**
 * Basic-Pitch AI Service (Frontend Browser)
 * Uses @spotify/basic-pitch with correct API
 */

import {
  BasicPitch,
  addPitchBendsToNoteEvents,
  noteFramesToTime,
  outputToNotesPoly,
} from "@spotify/basic-pitch";

// Initialize Basic-Pitch
let basicPitchModel = null;

/**
 * Initialize Basic-Pitch model
 */
const initModel = async () => {
  if (!basicPitchModel) {
    console.log("[BASIC-PITCH] Loading AI model...");
    // Use local model files from public/model folder
    basicPitchModel = new BasicPitch("/model/model.json");
    console.log("[BASIC-PITCH] Model loaded successfully!");
  }
  return basicPitchModel;
};

/**
 * Check if Basic-Pitch AI is available
 */
export const isBasicPitchAvailable = async () => {
  try {
    await initModel();
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Get Basic-Pitch status
 */
export const getBasicPitchStatus = () => {
  return {
    available: true,
    status: "ready",
    algorithm: "Basic-Pitch AI (Browser)",
    description: "Spotify ML model running in browser",
  };
};

/**
 * Pre-load Basic-Pitch model
 */
export const preloadBasicPitch = async () => {
  try {
    await initModel();
    return true;
  } catch (error) {
    console.error("[BASIC-PITCH] Failed to load:", error);
    return false;
  }
};

/**
 * Convert MIDI note to guitar fret
 */
const midiToGuitarFret = (midiNote) => {
  const stringTunings = [
    { string: "e", baseMidi: 64 },
    { string: "B", baseMidi: 59 },
    { string: "G", baseMidi: 55 },
    { string: "D", baseMidi: 50 },
    { string: "A", baseMidi: 45 },
    { string: "E", baseMidi: 40 },
  ];

  for (const tuning of stringTunings) {
    const fret = midiNote - tuning.baseMidi;
    if (fret >= 0 && fret <= 22) {
      return { string: tuning.string, fret };
    }
  }
  return null;
};

/**
 * Convert notes to tab string using BPM-based timing
 * ENHANCED: Smart collision handling prevents note loss
 *
 * @param {Array} notes - Array of note objects { time, position, velocity }
 * @param {number} duration - Total duration in seconds
 * @param {number} bpm - Beats Per Minute (default: 120)
 * @param {number} timeSignatureBeats - Top number of time signature (default: 4 for 4/4)
 */
const convertToTab = (notes, duration, bpm = 120, timeSignatureBeats = 4) => {
  // --- BPM-based timing calculations ---
  const beatsPerSecond = bpm / 60;
  const secondsPerBeat = 1 / beatsPerSecond;
  const secondsPerMeasure = secondsPerBeat * timeSignatureBeats;

  const measuresCount = Math.ceil(duration / secondsPerMeasure);

  // Quantization: 16th notes (4 chars per beat)
  const charsPerBeat = 4;
  const charsPerMeasure = charsPerBeat * timeSignatureBeats;
  const totalChars = measuresCount * charsPerMeasure;

  console.log(
    `[TAB] BPM: ${bpm}, Duration: ${duration}s, Measures: ${measuresCount}, Total chars: ${totalChars}`
  );

  const strings = {
    e: Array(totalChars).fill("-"),
    B: Array(totalChars).fill("-"),
    G: Array(totalChars).fill("-"),
    D: Array(totalChars).fill("-"),
    A: Array(totalChars).fill("-"),
    E: Array(totalChars).fill("-"),
  };

  let notesPlaced = 0;
  let notesDropped = 0;

  notes.forEach((note) => {
    if (!note.position) return;

    // --- Quantization to 16th notes ---
    const noteTimeInSeconds = note.time;
    const globalBeat = noteTimeInSeconds * beatsPerSecond;

    // Find the 16th-note "slot" this note *should* be in
    const targetPosition = Math.round(globalBeat * charsPerBeat);

    if (targetPosition < 0 || targetPosition >= totalChars) {
      return; // Note is out of bounds
    }

    const stringName = note.position.string;
    const fret = note.position.fret;

    // --- !!! BUILD FRET STRING (WITH BENDS & VIBRATO) !!! ---
    let fretStr = fret.toString();

    if (note.bend && note.bend > 0) {
      // e.g., fret 12, bend 2 (full step) → "12b14"
      const targetFret = fret + note.bend;
      fretStr = `${fret}b${targetFret}`;
    }

    // Add vibrato notation
    if (note.vibrato) {
      fretStr += "~"; // e.g., "12~" or "12b14~"
    }
    // --- !!! END FRET STRING !!! ---

    // --- !!! SMART COLLISION HANDLING WITH SPACING !!! ---
    // Search for next available slot if target is occupied
    // Ensures at least 1 empty slot between different notes
    // Supports multi-character strings like "12b14~"

    let placed = false;
    // Search up to 4 slots ahead to find space with proper spacing
    for (let offset = 0; offset <= 4; offset++) {
      const checkPos = targetPosition + offset;

      if (checkPos >= totalChars) break; // Stop at end of tab

      let canPlace = true;

      // Check if we have enough space for the entire note
      for (let k = 0; k < fretStr.length; k++) {
        if (
          checkPos + k >= totalChars ||
          strings[stringName][checkPos + k] !== "-"
        ) {
          canPlace = false; // Slot occupied
          break;
        }
      }

      // OPTIONAL: Ensure at least 1 empty slot after this note
      // This prevents clusters like "516" but allows "16" to stay together
      if (canPlace && offset > 0) {
        // Only check spacing if we're not at the original target position
        // Check if there's at least one "-" before us (prevents clusters)
        if (checkPos > 0 && strings[stringName][checkPos - 1] !== "-") {
          canPlace = false; // Need spacing before
        }
      }

      if (canPlace) {
        // We have space, place the entire note
        for (let k = 0; k < fretStr.length; k++) {
          strings[stringName][checkPos + k] = fretStr[k];
        }
        placed = true;
        notesPlaced++;
        break; // Note was placed, exit search
      }

      // If we couldn't place, try the next offset
    }

    if (!placed) {
      notesDropped++;
    }
  });

  console.log(
    `[TAB] Placed ${notesPlaced}/${notes.length} notes (dropped ${notesDropped} due to extreme collision)`
  );

  // --- Building the tab string ---
  let tabText = "";
  const stringOrder = ["e", "B", "G", "D", "A", "E"];
  for (let m = 0; m < measuresCount; m++) {
    if (m > 0) tabText += "\n";
    stringOrder.forEach((str) => {
      const start = m * charsPerMeasure;
      const end = start + charsPerMeasure;
      const measure = strings[str].slice(start, end).join("");
      tabText += `${str}|${measure}|\n`;
    });
  }
  return tabText.trim();
};

/**
 * Configuration for note detection
 * BALANCED FOR ELECTRIC GUITAR with bend/vibrato support
 */
const NOTE_CONFIG = {
  // Onset threshold (0.1-0.5): How hard a note must be "plucked" to count
  // Balanced setting - sensitive enough for vibrato, strong enough to ignore noise
  onsetThreshold: 0.4,

  // Frame threshold (0.1-0.5): Confidence in pitch detection
  frameThreshold: 0.35,

  // Minimum note length in frames (1-10)
  minNoteLength: 5, // ~116ms - ignore tiny blips

  // Velocity/amplitude threshold (0-1)
  velocityThreshold: 0.25, // Ignore quieter noise

  // Note deduplication window (seconds)
  dedupeWindow: 0.05, // Merge notes within 50ms

  // Raw note consolidation (BEFORE fret selection)
  consolidationTimeWindow: 0.07, // Merge notes within 70ms (vibrato wobble)
  consolidationPitchWindow: 1.5, // Merge notes within 1.5 semitones (vibrato range)

  // Bend & Vibrato detection (ENABLED - Balanced settings)
  enableBendDetection: true, // ✅ ENABLED - Detect bend notation (12b14)
  enableVibratoDetection: true, // ✅ ENABLED - Detect vibrato notation (12~)
  bendThresholdCents: 75, // Minimum cents for bend detection (3/4 semitone)
  vibratoThresholdCents: 35, // Minimum wobble for vibrato detection (balanced)
};

/**
 * Consolidate "wobbly" raw MIDI notes from AI
 * This merges pitch wobble from vibrato/slides BEFORE fret selection
 *
 * Example: AI detects [MIDI 61, 62, 61, 62] from a single note with vibrato
 * This function consolidates them into a single note with average pitch
 */
const consolidateRawNotes = (
  notes,
  timeWindow = NOTE_CONFIG.consolidationTimeWindow,
  pitchWindow = NOTE_CONFIG.consolidationPitchWindow
) => {
  if (notes.length === 0) return [];

  console.log(`[CONSOLIDATE] Input: ${notes.length} raw notes`);

  const sortedNotes = [...notes].sort(
    (a, b) =>
      (a.startTimeSeconds || a.startTime || 0) -
      (b.startTimeSeconds || b.startTime || 0)
  );
  const consolidated = [];

  let lastNote = { ...sortedNotes[0] };

  for (let i = 1; i < sortedNotes.length; i++) {
    const currentNote = sortedNotes[i];

    const lastTime = lastNote.startTimeSeconds || lastNote.startTime || 0;
    const currentTime =
      currentNote.startTimeSeconds || currentNote.startTime || 0;
    const timeDiff = currentTime - lastTime;

    const lastPitch = lastNote.pitchMidi || lastNote.midiNote || 60;
    const currentPitch = currentNote.pitchMidi || currentNote.midiNote || 60;
    const pitchDiff = Math.abs(currentPitch - lastPitch);

    // If notes are close in time AND pitch, merge them (it's vibrato wobble)
    if (timeDiff < timeWindow && pitchDiff < pitchWindow) {
      // Extend the duration
      lastNote.endTimeSeconds =
        currentNote.endTimeSeconds || currentNote.endTime;
      // Keep higher velocity
      lastNote.velocity = Math.max(
        lastNote.velocity || 0.5,
        currentNote.velocity || 0.5
      );
      lastNote.amplitude = Math.max(
        lastNote.amplitude || 0.5,
        currentNote.amplitude || 0.5
      );
      // Average the pitch (helps with vibrato)
      lastNote.pitchMidi = (lastPitch + currentPitch) / 2;
      lastNote.midiNote = lastNote.pitchMidi;

      // CRITICAL: Preserve pitchBends array for bend/vibrato detection
      // Merge pitch bend data from both notes
      if (currentNote.pitchBends || lastNote.pitchBends) {
        const lastBends = lastNote.pitchBends || [];
        const currentBends = currentNote.pitchBends || [];
        lastNote.pitchBends = [...lastBends, ...currentBends];
      }

      // Don't add currentNote to list (it's merged into lastNote)
    } else {
      // Genuinely new note - push the completed previous note
      consolidated.push(lastNote);
      lastNote = { ...currentNote };
    }
  }

  // Add the final note
  consolidated.push(lastNote);

  console.log(
    `[CONSOLIDATE] Output: ${consolidated.length} consolidated notes (removed ${
      notes.length - consolidated.length
    } wobble fragments)`
  );

  return consolidated;
};

/**
 * Deduplicate overlapping notes on same string (AFTER fret selection)
 */
const deduplicateNotes = (notes, windowSeconds = NOTE_CONFIG.dedupeWindow) => {
  if (notes.length === 0) return notes;

  const deduped = [];
  const sortedNotes = [...notes].sort((a, b) => a.time - b.time);

  for (const note of sortedNotes) {
    // Check if this note overlaps with the last added note on same string
    const lastNote = deduped[deduped.length - 1];

    if (
      lastNote &&
      lastNote.position.string === note.position.string &&
      Math.abs(note.time - lastNote.time) < windowSeconds
    ) {
      // Keep the note with higher velocity/confidence
      const currentVelocity = note.velocity || 0.5;
      const lastVelocity = lastNote.velocity || 0.5;

      if (currentVelocity > lastVelocity) {
        deduped[deduped.length - 1] = note; // Replace with better note
      }
      // Otherwise skip this note
    } else {
      deduped.push(note);
    }
  }

  return deduped;
};

/**
 * Smart fret selection for single notes - prefer playable positions
 */
const selectBestFretPosition = (midiNote, previousPosition = null) => {
  const stringTunings = [
    { string: "e", baseMidi: 64, index: 0 }, // E4
    { string: "B", baseMidi: 59, index: 1 }, // B3
    { string: "G", baseMidi: 55, index: 2 }, // G3
    { string: "D", baseMidi: 50, index: 3 }, // D3
    { string: "A", baseMidi: 45, index: 4 }, // A2
    { string: "E", baseMidi: 40, index: 5 }, // E2
  ];

  const possiblePositions = [];

  for (const tuning of stringTunings) {
    const fret = midiNote - tuning.baseMidi;
    if (fret >= 0 && fret <= 22) {
      possiblePositions.push({
        string: tuning.string,
        fret,
        stringIndex: tuning.index,
      });
    }
  }

  if (possiblePositions.length === 0) return null;

  // Scoring system for best position
  const scores = possiblePositions.map((pos) => {
    let score = 0;

    // Prefer frets 0-12 (most comfortable range)
    if (pos.fret <= 12) score += 10;
    else score += 24 - pos.fret; // Penalize higher frets

    // Prefer middle strings (G, D, A) for single notes
    const middleBonus = [0, 2, 5, 8, 5, 2]; // Bonus for each string
    score += middleBonus[pos.stringIndex] || 0;

    // If we have previous position, prefer staying nearby
    if (previousPosition) {
      if (pos.string === previousPosition.string) {
        score += 5; // Bonus for same string
      }
      const fretDistance = Math.abs(pos.fret - previousPosition.fret);
      if (fretDistance <= 4) {
        score += 5 - fretDistance; // Bonus for nearby frets
      }
    }

    return { position: pos, score };
  });

  // Return position with highest score
  scores.sort((a, b) => b.score - a.score);
  return scores[0].position;
};

/**
 * Extract BPM from filename if present
 * Examples: "lick_129bpm_E.wav" → 129, "track-140-bpm.mp3" → 140
 */
const extractBPMFromFilename = (filename) => {
  if (!filename) return null;

  // Match patterns like "129bpm", "140-bpm", "bpm120", etc.
  const patterns = [
    /(\d+)\s*bpm/i, // "129bpm" or "129 bpm"
    /bpm\s*(\d+)/i, // "bpm129" or "bpm 129"
    /(\d+)\s*-\s*bpm/i, // "129-bpm"
  ];

  for (const pattern of patterns) {
    const match = filename.match(pattern);
    if (match && match[1]) {
      const bpm = parseInt(match[1], 10);
      if (bpm >= 40 && bpm <= 300) {
        // Sanity check
        console.log(
          `[BASIC-PITCH] Extracted BPM ${bpm} from filename: ${filename}`
        );
        return bpm;
      }
    }
  }

  return null;
};

/**
 * Generate guitar tab using Basic-Pitch AI (Correct API)
 * OPTIMIZED for electric guitar with vibrato/slide handling
 */
export const generateTabWithML = async (audioFile, options = {}) => {
  try {
    console.log("[BASIC-PITCH] Processing audio with AI...");
    console.log("[BASIC-PITCH] Guitar-optimized mode (anti-wobble enabled)");

    // Initialize model
    const model = await initModel();

    // Create AudioContext and decode audio
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const arrayBuffer = await audioFile.arrayBuffer();

    let audioBuffer = await new Promise((resolve, reject) => {
      audioCtx.decodeAudioData(
        arrayBuffer,
        (buffer) => resolve(buffer),
        (error) => reject(error)
      );
    });

    // Convert stereo to mono if needed (Basic-Pitch requires mono)
    if (audioBuffer.numberOfChannels > 1) {
      console.log(
        `[BASIC-PITCH] Converting ${audioBuffer.numberOfChannels} channels to mono...`
      );

      const monoCtx = new OfflineAudioContext(
        1, // Mono output
        audioBuffer.length,
        audioBuffer.sampleRate
      );

      const source = monoCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(monoCtx.destination);
      source.start(0);

      audioBuffer = await monoCtx.startRendering();
      console.log(`[BASIC-PITCH] Converted to mono`);
    }

    // Resample to 22050 Hz (required by Basic-Pitch)
    if (audioBuffer.sampleRate !== 22050) {
      console.log(
        `[BASIC-PITCH] Resampling from ${audioBuffer.sampleRate} Hz to 22050 Hz...`
      );

      const offlineCtx = new OfflineAudioContext(
        1, // Already mono at this point
        audioBuffer.duration * 22050,
        22050
      );

      const source = offlineCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offlineCtx.destination);
      source.start(0);

      audioBuffer = await offlineCtx.startRendering();
      console.log(`[BASIC-PITCH] Resampled to ${audioBuffer.sampleRate} Hz`);
    }

    // Verify mono audio
    console.log(
      `[BASIC-PITCH] Audio prepared: ${audioBuffer.numberOfChannels} channel(s), ${audioBuffer.sampleRate} Hz`
    );

    if (audioBuffer.numberOfChannels !== 1) {
      throw new Error(
        `Audio must be mono. Current channels: ${audioBuffer.numberOfChannels}`
      );
    }

    // Run AI inference
    console.log("[BASIC-PITCH] Running AI inference...");

    const frames = [];
    const onsets = [];
    const contours = [];

    await model.evaluateModel(
      audioBuffer,
      (f, o, c) => {
        frames.push(...f);
        onsets.push(...o);
        contours.push(...c);
      },
      (progress) => {
        console.log(`[BASIC-PITCH] Progress: ${Math.round(progress * 100)}%`);
      }
    );

    // Convert to notes using Basic-Pitch functions with optimized thresholds
    const rawNotes = noteFramesToTime(
      addPitchBendsToNoteEvents(
        contours,
        outputToNotesPoly(
          frames,
          onsets,
          NOTE_CONFIG.onsetThreshold, // Lower for better single note detection
          NOTE_CONFIG.frameThreshold, // Confidence threshold
          NOTE_CONFIG.minNoteLength // Minimum note duration
        )
      )
    );

    console.log(`[BASIC-PITCH] AI detected ${rawNotes.length} raw notes`);

    // Calculate duration
    const duration = audioBuffer.duration;

    // Filter by velocity/amplitude with lower threshold for single notes
    const filteredNotes = rawNotes.filter(
      (note) =>
        (note.velocity || note.amplitude || 0) >= NOTE_CONFIG.velocityThreshold
    );

    console.log(
      `[BASIC-PITCH] After velocity filter: ${filteredNotes.length} notes`
    );

    // !!! NEW STEP: Consolidate pitch wobble BEFORE fret selection !!!
    // This removes the "machine gun" effect from vibrato/slides
    // Example: [MIDI 61, 62, 61, 62] becomes [MIDI 61.5] (single note)
    const consolidatedNotes = consolidateRawNotes(filteredNotes);
    console.log(
      `[BASIC-PITCH] After consolidating wobble: ${consolidatedNotes.length} notes`
    );

    // Convert to guitar tab with smart fret selection
    // *** USE CONSOLIDATED LIST (not filtered list) ***
    let previousPosition = null;
    const tabNotes = consolidatedNotes
      .map((note) => {
        const midiNote = Math.round(note.pitchMidi || note.midiNote || 60);
        const position = selectBestFretPosition(midiNote, previousPosition);

        // --- !!! BEND & VIBRATO DETECTION (OPTIONAL) !!! ---
        let bendAmount = 0;
        let isVibrato = false;

        // DEFENSIVE: Only detect bends/vibrato if:
        // 1. Feature is enabled in config
        // 2. pitchBends array exists and is valid
        // Regular notes without pitch variation will skip this entire block
        if (
          (NOTE_CONFIG.enableBendDetection ||
            NOTE_CONFIG.enableVibratoDetection) &&
          note.pitchBends &&
          Array.isArray(note.pitchBends) &&
          note.pitchBends.length > 2
        ) {
          try {
            // Need at least 3 points to detect wobble
            const maxBendCents = Math.max(...note.pitchBends);
            const minBendCents = Math.min(...note.pitchBends);
            const bendRange = maxBendCents - minBendCents; // How much it wobbles

            // --- BEND DETECTION (CHECK FIRST - takes priority) ---
            if (
              NOTE_CONFIG.enableBendDetection &&
              maxBendCents >= NOTE_CONFIG.bendThresholdCents
            ) {
              // Round to nearest semitone (1 = half step, 2 = full step, etc.)
              bendAmount = Math.round(maxBendCents / 100);
              isVibrato = false; // A bend is not vibrato
              console.log(
                `[BEND] Detected ${maxBendCents} cents → ${bendAmount} semitone bend on fret ${position?.fret}`
              );
            }
            // --- VIBRATO DETECTION (ONLY IF NOT A BEND) ---
            else if (
              NOTE_CONFIG.enableVibratoDetection &&
              bendRange > NOTE_CONFIG.vibratoThresholdCents &&
              maxBendCents < NOTE_CONFIG.bendThresholdCents
            ) {
              isVibrato = true;
              console.log(
                `[VIBRATO] Detected ${bendRange} cents wobble on fret ${position?.fret}`
              );
            }
          } catch (error) {
            // Silently ignore bend/vibrato detection errors for this note
            // This ensures normal notes still work even if pitchBends data is malformed
            console.warn(
              `[BEND/VIBRATO] Detection failed for note, using defaults:`,
              error
            );
          }
        }
        // --- !!! END BEND & VIBRATO DETECTION !!! ---

        if (position) {
          previousPosition = position;
        return {
          time: note.startTimeSeconds || note.startTime || 0,
          position,
          midiNote,
            velocity: note.velocity || note.amplitude || 0.5,
            bend: bendAmount, // Add bend property
            vibrato: isVibrato, // Add vibrato property
          };
        }
        return null;
      })
      .filter((note) => note !== null);

    console.log(`[BASIC-PITCH] After guitar mapping: ${tabNotes.length} notes`);

    // Deduplicate overlapping notes
    const dedupedNotes = deduplicateNotes(tabNotes);

    console.log(
      `[BASIC-PITCH] After deduplication: ${dedupedNotes.length} final notes`
    );

    // Extract BPM from multiple sources (priority order)
    const filenameBPM = extractBPMFromFilename(audioFile.name);
    const bpm = options.bpm || options.tempo || filenameBPM || 120;
    const timeSignature = options.timeSignature || 4;

    if (filenameBPM && !options.bpm && !options.tempo) {
      console.log(`[BASIC-PITCH] 🎯 Using BPM from filename: ${bpm}`);
    } else if (options.bpm || options.tempo) {
      console.log(`[BASIC-PITCH] 🎯 Using BPM from options: ${bpm}`);
    } else {
      console.log(`[BASIC-PITCH] ⚠️ Using default BPM: ${bpm}`);
    }

    console.log(`[BASIC-PITCH] Time Signature: ${timeSignature}/4`);

    const tab = convertToTab(dedupedNotes, duration || 3.0, bpm, timeSignature);

    // Calculate confidence based on note quality
    const avgVelocity =
      dedupedNotes.length > 0
        ? dedupedNotes.reduce((sum, n) => sum + (n.velocity || 0.5), 0) /
          dedupedNotes.length
        : 0.5;
    const confidence = Math.round(Math.min(95, 70 + avgVelocity * 30));

    console.log(
      `[BASIC-PITCH] Tab generated with ${dedupedNotes.length} notes, confidence: ${confidence}%`
    );

    return {
      success: true,
      tab,
      metadata: {
        duration: duration || 3.0,
        notesDetected: dedupedNotes.length,
        confidence: confidence,
        algorithm:
          NOTE_CONFIG.enableBendDetection || NOTE_CONFIG.enableVibratoDetection
            ? "Basic-Pitch AI (Guitar Pro: Bends + Vibrato + Anti-Cluster)"
            : "Basic-Pitch AI (Guitar-Optimized + Anti-Wobble)",
        mlUsed: true,
        bpm: bpm,
        timeSignature: `${timeSignature}/4`,
        settings: {
          onsetThreshold: NOTE_CONFIG.onsetThreshold,
          frameThreshold: NOTE_CONFIG.frameThreshold,
          velocityThreshold: NOTE_CONFIG.velocityThreshold,
          minNoteLength: NOTE_CONFIG.minNoteLength,
          consolidationEnabled: true,
          bendDetection: NOTE_CONFIG.enableBendDetection,
          vibratoDetection: NOTE_CONFIG.enableVibratoDetection,
          antiClusterSpacing: true,
          bpmBased: true,
          smartCollisionHandling: true,
        },
      },
    };
  } catch (error) {
    console.error("[BASIC-PITCH] AI failed:", error);
    throw error;
  }
};

export default {
  generateTabWithML,
  isBasicPitchAvailable,
  getBasicPitchStatus,
  preloadBasicPitch,
};

/**
 * AI Tab Generator Service
 * Converts audio to guitar tablature using AI/ML
 * IMPROVED: Onset-driven analysis + transient offset
 * TUNED (v7): Replaced Autocorrelation with YIN-inspired algorithm
 */

// Configuration
const AI_CONFIG = {
  USE_MOCK_GENERATION: false, // Set to true for demo/testing
  MAX_DURATION: 15, // seconds
  SAMPLE_RATE: 44100,
  MIN_FREQUENCY: 80, // E2 (lowest guitar note)
  MAX_FREQUENCY: 1200, // ~D#6 (high guitar range)

  // Tuned detection parameters (v7 - YIN)
  CHUNK_SIZE: 0.1, // 100ms chunks (longer for more stable pitch)
  HOP_SIZE: 0.025, // 25ms hop (used for onset detection)
  MIN_NOTE_DURATION: 0.03, // Minimum 50ms to be considered a note
  RMS_THRESHOLD: 0.002, // Keep it sensitive
  ONSET_THRESHOLD: 1.3,
  ANALYSIS_OFFSET: 0.03, // 50ms offset to skip transient
  DIFFERENCE_THRESHOLD: 0.25, // NEW: YIN-style confidence (lower is better)
};

/**
 * Extract audio features from buffer
 */
const extractAudioFeatures = async (audioBuffer) => {
  return new Promise((resolve, reject) => {
    try {
      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target.result;
          let audioData = await audioContext.decodeAudioData(arrayBuffer);

          // Convert stereo to mono if needed
          if (audioData.numberOfChannels > 1) {
            console.log(
              `Converting ${audioData.numberOfChannels} channels to mono...`
            );

            const monoCtx = new OfflineAudioContext(
              1, // Mono output
              audioData.length,
              audioData.sampleRate
            );

            const source = monoCtx.createBufferSource();
            source.buffer = audioData;
            source.connect(monoCtx.destination);
            source.start(0);

            audioData = await monoCtx.startRendering();
            console.log("Converted to mono");
          }

          const duration = audioData.duration;
          const sampleRate = audioData.sampleRate;
          const channelData = audioData.getChannelData(0); // Mono

          resolve({
            duration,
            sampleRate,
            channelData,
            numberOfChannels: audioData.numberOfChannels,
          });
        } catch (error) {
          reject(new Error("Failed to decode audio data: " + error.message));
        }
      };

      reader.onerror = () => {
        reject(new Error("Failed to read audio file"));
      };

      reader.readAsArrayBuffer(audioBuffer);
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Apply simple bandpass filter for guitar frequency range
 */
const applyBandpassFilter = (buffer, sampleRate) => {
  // Simple moving average filter to remove extreme noise
  const filtered = new Float32Array(buffer.length);
  const windowSize = 3;

  for (let i = 0; i < buffer.length; i++) {
    let sum = 0;
    let count = 0;
    for (
      let j = Math.max(0, i - windowSize);
      j <= Math.min(buffer.length - 1, i + windowSize);
      j++
    ) {
      sum += buffer[j];
      count++;
    }
    filtered[i] = sum / count;
  }

  return filtered;
};

/**
 * NEW (v7) Pitch detection using YIN-inspired algorithm
 * (Cumulative Mean Normalized Difference Function)
 */
const detectPitch = (buffer, sampleRate) => {
  const SIZE = buffer.length;
  if (SIZE === 0) return { frequency: -1 };
  const MAX_SAMPLES = Math.floor(SIZE / 2);

  // Apply bandpass filter
  // const filtered = applyBandpassFilter(buffer, sampleRate);
  const filtered = buffer;

  // 1. RMS Check
  let rms = 0;
  for (let i = 0; i < SIZE; i++) {
    rms += filtered[i] * filtered[i];
  }
  rms = Math.sqrt(rms / SIZE);

  if (rms < AI_CONFIG.RMS_THRESHOLD) {
    return { frequency: -1 };
  }

  // 2. YIN Difference calculation
  const difference = new Float32Array(MAX_SAMPLES);
  let runningSum = 0;
  difference[0] = 1; // 0 offset is always 1

  for (let offset = 1; offset < MAX_SAMPLES; offset++) {
    let sum = 0;
    for (let i = 0; i < MAX_SAMPLES; i++) {
      const delta = filtered[i] - filtered[i + offset];
      sum += delta * delta;
    }
    runningSum += sum;
    difference[offset] = (sum * offset) / runningSum;
  }

  // 3. Find the first "dip" (trough) below the threshold
  const minSamples = Math.floor(sampleRate / AI_CONFIG.MAX_FREQUENCY);
  const maxSamples = Math.floor(sampleRate / AI_CONFIG.MIN_FREQUENCY);

  for (
    let offset = minSamples;
    offset < Math.min(maxSamples, MAX_SAMPLES);
    offset++
  ) {
    // Look for the first trough (dip)
    if (
      difference[offset] < AI_CONFIG.DIFFERENCE_THRESHOLD &&
      difference[offset] < difference[offset - 1]
    ) {
      // Find the absolute minimum in this dip
      let best_offset = offset;
      while (
        offset + 1 < MAX_SAMPLES &&
        difference[offset + 1] < difference[offset]
      ) {
        offset++;
        best_offset = offset;
      }

      // We found the fundamental frequency.
      const frequency = sampleRate / best_offset;
      return { frequency: frequency };
    }
  }

  // No good pitch found
  return { frequency: -1 };
};

/**
 * Convert frequency to note and fret position
 */
const frequencyToNote = (frequency) => {
  const A4 = 440;
  const C0 = A4 * Math.pow(2, -4.75);
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

  if (frequency <= 0) return null;

  const halfSteps = 12 * Math.log2(frequency / C0);
  const noteNumber = Math.round(halfSteps);
  const noteName = noteNames[noteNumber % 12];
  const octave = Math.floor(noteNumber / 12);

  return {
    name: noteName,
    octave: octave,
    frequency: frequency,
    midiNote: noteNumber + 12,
  };
};

/**
 * Calculate onset (note start) from energy changes
 */
const detectOnsets = (channelData, sampleRate) => {
  const windowSize = Math.floor(sampleRate * AI_CONFIG.CHUNK_SIZE);
  const hopSize = Math.floor(sampleRate * AI_CONFIG.HOP_SIZE);
  const energies = [];

  // Calculate energy for each window
  for (let i = 0; i < channelData.length - windowSize; i += hopSize) {
    const window = channelData.slice(i, i + windowSize);
    const energy = window.reduce((sum, val) => sum + val * val, 0) / windowSize;
    energies.push({ time: i / sampleRate, energy: Math.sqrt(energy) });
  }

  // Find energy increases (note onsets)
  const onsets = [];
  let lastOnset = -Infinity;

  for (let i = 1; i < energies.length; i++) {
    if (
      energies[i].energy >
      energies[i - 1].energy * AI_CONFIG.ONSET_THRESHOLD
    ) {
      if (energies[i].energy > AI_CONFIG.RMS_THRESHOLD) {
        // Debounce: Only add onset if it's not too close to the last one
        if (energies[i].time - lastOnset > AI_CONFIG.MIN_NOTE_DURATION) {
          onsets.push(energies[i].time);
          lastOnset = energies[i].time;
        }
      }
    }
  }

  return onsets;
};

/**
 * Map note to guitar fret position with context awareness
 */
const noteToGuitarFret = (note, previousPosition = null) => {
  if (!note) return null;

  const stringTunings = [
    { string: "e", baseMidi: 64, index: 0 }, // E4
    { string: "B", baseMidi: 59, index: 1 }, // B3
    { string: "G", baseMidi: 55, index: 2 }, // G3
    { string: "D", baseMidi: 50, index: 3 }, // D3
    { string: "A", baseMidi: 45, index: 4 }, // A2
    { string: "E", baseMidi: 40, index: 5 }, // E2
  ];

  const positions = [];

  for (const tuning of stringTunings) {
    const fret = note.midiNote - tuning.baseMidi;
    if (fret >= 0 && fret <= 22) {
      // Practical fret limit
      positions.push({
        string: tuning.string,
        stringIndex: tuning.index,
        fret: fret,
      });
    }
  }

  if (positions.length === 0) return null;

  // Sort by playability score
  positions.sort((a, b) => {
    let aScore = 0;
    let bScore = 0;

    // Prefer frets 0-12 (most comfortable)
    aScore += a.fret <= 12 ? 0 : (a.fret - 12) * 2;
    bScore += b.fret <= 12 ? 0 : (b.fret - 12) * 2;

    // Prefer middle strings (G and D strings are easiest)
    aScore += Math.abs(2.5 - a.stringIndex);
    bScore += Math.abs(2.5 - b.stringIndex);

    // If we have a previous position, prefer staying on the same string or nearby fret
    if (previousPosition) {
      const aFretDist = Math.abs(a.fret - previousPosition.fret);
      const bFretDist = Math.abs(b.fret - previousPosition.fret);
      const aSameString = a.string === previousPosition.string;
      const bSameString = b.string === previousPosition.string;

      // Strong preference for staying in position (within 4 frets)
      if (aSameString && aFretDist <= 4) aScore -= 10;
      if (bSameString && bFretDist <= 4) bScore -= 10;

      // Moderate preference for nearby frets on different strings
      aScore += aFretDist * 0.5;
      bScore += bFretDist * 0.5;
    }

    return aScore - bScore;
  });

  return positions[0];
};

/**
 * Analyze audio and generate tab notation (IMPROVED VERSION)
 * This version uses onset detection for a much cleaner note list.
 */
export const generateTabFromAudio = async (audioFile, options = {}) => {
  try {
    console.log("Starting improved AI tab generation...");

    // 1. Extract features
    const audioFeatures = await extractAudioFeatures(audioFile);

    if (audioFeatures.duration > AI_CONFIG.MAX_DURATION) {
      throw new Error(
        `Audio duration (${audioFeatures.duration.toFixed(1)}s) exceeds ${
          AI_CONFIG.MAX_DURATION
        }s limit`
      );
    }

    console.log("Audio features extracted:", {
      duration: audioFeatures.duration,
      sampleRate: audioFeatures.sampleRate,
    });

    // 2. For demo purposes, generate mock tab data
    if (AI_CONFIG.USE_MOCK_GENERATION) {
      return generateMockTab(audioFeatures.duration);
    }

    // --- NEW ONSET-BASED LOGIC ---
    const { channelData, sampleRate, duration } = audioFeatures;

    console.log("Detecting onsets...");
    const onsets = detectOnsets(channelData, sampleRate);
    console.log(`Found ${onsets.length} potential note onsets`);

    // We check this *first* now
    if (onsets.length === 0) {
      throw new Error(
        "Could not detect any note onsets. The audio might be too quiet, or the ONSET_THRESHOLD is too high."
      );
    }

    const notes = [];
    let previousPosition = null;
    const chunkSize = Math.floor(sampleRate * AI_CONFIG.CHUNK_SIZE);

    // 3. Analyze pitch ONLY at the detected onsets
    console.log("Analyzing pitch at each onset...");
    for (const onsetTime of onsets) {
      // --- THE FIX ---
      // Add offset to skip the noisy "transient" (the pluck)
      const analysisTime = onsetTime + AI_CONFIG.ANALYSIS_OFFSET;
      const startIndex = Math.floor(analysisTime * sampleRate);
      // --- END FIX ---

      const endIndex = startIndex + chunkSize;

      if (endIndex > channelData.length) break;

      const chunk = channelData.slice(startIndex, endIndex);
      const pitchResult = detectPitch(chunk, sampleRate);

      // --- DEBUGGING LOG ---
      console.log(
        `Analyzing onset at ${onsetTime.toFixed(
          2
        )}s: Freq=${pitchResult.frequency.toFixed(1)}`
      );

      // CHANGED: Simplified check. detectPitch now handles its own threshold.
      if (
        pitchResult.frequency > 0 &&
        pitchResult.frequency >= AI_CONFIG.MIN_FREQUENCY &&
        pitchResult.frequency <= AI_CONFIG.MAX_FREQUENCY
      ) {
        const note = frequencyToNote(pitchResult.frequency);
        const position = noteToGuitarFret(note, previousPosition);

        if (position) {
          notes.push({
            time: onsetTime,
            position: position,
            note: note,
          });
          previousPosition = position;
        }
      }
    }
    // --- END OF NEW LOGIC ---

    console.log(`Filtered to ${notes.length} distinct notes`);

    // This is the error you were seeing.
    if (notes.length === 0) {
      throw new Error(
        "Could not detect any guitar notes. Please ensure:\n" +
          "- The audio contains clear guitar sounds\n" +
          "- There's minimal background noise\n" +
          "- The recording quality is good"
      );
    }

    // 4. Calculate duration for each note (for visualization, not used by tabber yet)
    const notesWithDuration = notes.map((note, index) => {
      const nextTime =
        index + 1 < notes.length ? notes[index + 1].time : duration;
      const noteDuration = nextTime - note.time;
      return { ...note, duration: noteDuration };
    });

    // 5. Convert notes to tab format
    const tab = convertNotesToTab(notesWithDuration, duration);

    // 6. Calculate confidence (no longer per-note, just a dummy value for now)
    const avgConfidence = notes.length > 0 ? 70 : 0; // Placeholder

    return {
      success: true,
      tab: tab,
      metadata: {
        duration: duration,
        notesDetected: notes.length,
        confidence: avgConfidence,
        algorithm: "Onset-Driven YIN (v7)",
        sampleRate: sampleRate,
      },
    };
  } catch (error) {
    console.error("Tab generation error:", error);
    throw error;
  }
};

/**
 * Convert detected notes to tab string format (Improved)
 */
const convertNotesToTab = (notes, duration) => {
  // Calculate measures (2 seconds per measure is reasonable)
  const measuresCount = Math.ceil(duration / 2);
  const charsPerMeasure = 16;
  const totalChars = measuresCount * charsPerMeasure;

  const strings = {
    e: Array(totalChars).fill("-"),
    B: Array(totalChars).fill("-"),
    G: Array(totalChars).fill("-"),
    D: Array(totalChars).fill("-"),
    A: Array(totalChars).fill("-"),
    E: Array(totalChars).fill("-"),
  };

  // Place notes
  notes.forEach((note) => {
    const timePosition = Math.floor((note.time / duration) * totalChars);

    if (timePosition >= 0 && timePosition < totalChars) {
      const fretStr = note.position.fret.toString();
      const string = note.position.string;

      // Place first digit of fret
      strings[string][timePosition] = fretStr[0];

      // Handle 2-digit frets (if space is available)
      if (fretStr.length > 1) {
        if (
          timePosition + 1 < totalChars &&
          strings[string][timePosition + 1] === "-"
        ) {
          strings[string][timePosition + 1] = fretStr[1];
        }
      }
    }
  });

  // Format as tab string with measures
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
 * Generate mock tab for demo/testing
 */
const generateMockTab = (duration) => {
  const mockPatterns = [
    {
      name: "Simple Riff",
      tab: `e|--5--7--8--7--5--|--5--7--8--------|
B|--5--7--8--7--5--|--5--7--8--------|
G|-----------------|-----------------|
D|-----------------|-----------------|
A|-----------------|-----------------|
E|-----------------|-----------------|`,
    },
    {
      name: "Blues Lick",
      tab: `e|-----------------|--8-10-8---------|
B|--8--8h10-8------|----------10--8--|
G|-------------9---|-----------------|
D|-----------------|-----------------|
A|-----------------|-----------------|
E|-----------------|-----------------|`,
    },
    {
      name: "Chord Progression",
      tab: `e|--0----0----0----|--0----0----0----|
B|--0----0----0----|--0----0----0----|
G|--1----0----2----|--1----0----2----|
D|--2----2----2----|--2----2----2----|
A|--2----2----0----|--2----2----0----|
E|--0----0---------|--0----0---------|`,
    },
  ];

  const selected =
    mockPatterns[Math.floor(Math.random() * mockPatterns.length)];

  return {
    success: true,
    tab: selected.tab,
    metadata: {
      duration: duration,
      notesDetected: 24,
      confidence: 85,
      algorithm: "Mock Generator (demo mode)",
    },
  };
};

/**
 * Analyze audio tempo with improved beat detection
 */
export const detectTempo = async (audioFile) => {
  try {
    const audioFeatures = await extractAudioFeatures(audioFile);

    const { channelData, sampleRate, numberOfChannels } = audioFeatures;

    console.log(`Tempo detection using ${numberOfChannels} channel audio`);
    const windowSize = Math.floor(sampleRate * 0.05); // 50ms windows
    const hopSize = Math.floor(sampleRate * 0.01); // 10ms hop
    const energies = [];

    // Calculate energy envelope
    for (let i = 0; i < channelData.length - windowSize; i += hopSize) {
      const window = channelData.slice(i, i + windowSize);
      let energy = 0;
      for (let j = 0; j < window.length; j++) {
        energy += window[j] * window[j];
      }
      energies.push({
        time: i / sampleRate,
        energy: Math.sqrt(energy / windowSize),
      });
    }

    // Find energy peaks (beat candidates)
    const beats = [];
    const minBeatInterval = 0.2; // Minimum 200ms between beats (300 BPM max)

    for (let i = 1; i < energies.length - 1; i++) {
      const prev = energies[i - 1].energy;
      const curr = energies[i].energy;
      const next = energies[i + 1].energy;

      // Peak detection with adaptive threshold
      const avgEnergy =
        energies.reduce((sum, e) => sum + e.energy, 0) / energies.length;
      const threshold = avgEnergy * 1.5;

      if (curr > prev && curr > next && curr > threshold) {
        // Check if enough time has passed since last beat
        if (
          beats.length === 0 ||
          energies[i].time - beats[beats.length - 1] >= minBeatInterval
        ) {
          beats.push(energies[i].time);
        }
      }
    }

    if (beats.length < 4) {
      console.log("Not enough beats detected, using default tempo");
      return 120; // Default
    }

    // Calculate intervals and find most common tempo
    const intervals = [];
    for (let i = 1; i < beats.length; i++) {
      intervals.push(beats[i] - beats[i - 1]);
    }

    // Filter outliers (remove intervals that are too different from median)
    intervals.sort((a, b) => a - b);
    const median = intervals[Math.floor(intervals.length / 2)];
    const filtered = intervals.filter(
      (i) => Math.abs(i - median) < median * 0.3
    );

    if (filtered.length === 0) return 120;

    const avgInterval = filtered.reduce((a, b) => a + b, 0) / filtered.length;
    const bpm = Math.round(60 / avgInterval);

    console.log(
      `Detected tempo: ${bpm} BPM (${beats.length} beats, ${filtered.length} intervals used)`
    );

    // Clamp to reasonable range
    return Math.max(60, Math.min(220, bpm));
  } catch (error) {
    console.error("Tempo detection error:", error);
    return 120; // Default tempo
  }
};

/**
 * Detect musical key from audio
 */
export const detectKey = async (audioFile) => {
  try {
    const audioFeatures = await extractAudioFeatures(audioFile);

    // Simple key detection based on pitch histogram
    const { channelData, sampleRate, numberOfChannels } = audioFeatures;

    console.log(`Key detection using ${numberOfChannels} channel audio`);
    const chunkSize = Math.floor(sampleRate * 0.1);
    const pitchHistogram = new Array(12).fill(0);

    for (let i = 0; i < channelData.length; i += chunkSize) {
      const chunk = channelData.slice(i, i + chunkSize);
      const pitchResult = detectPitch(chunk, sampleRate); // Will use new YIN algorithm

      if (pitchResult.frequency > 0) {
        const note = frequencyToNote(pitchResult.frequency);
        if (note) {
          const noteIndex = [
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
          ].indexOf(note.name);
          if (noteIndex >= 0) {
            pitchHistogram[noteIndex]++;
          }
        }
      }
    }

    // Find most common note (tonic)
    const maxIndex = pitchHistogram.indexOf(Math.max(...pitchHistogram));
    const keys = [
      "C Major",
      "C# Major",
      "D Major",
      "D# Major",
      "E Major",
      "F Major",
      "F# Major",
      "G Major",
      "G# Major",
      "A Major",
      "A# Major",
      "B Major",
    ];

    return keys[maxIndex] || "C Major";
  } catch (error) {
    console.error("Key detection error:", error);
    return "C Major"; // Default
  }
};

export default {
  generateTabFromAudio,
  detectTempo,
  detectKey,
};

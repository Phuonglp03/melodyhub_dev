import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { uploadFromBuffer } from './cloudinaryUploader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Convert chord name to MIDI notes
 * @param {String} chordName - Chord name (e.g., "C", "Am", "Fmaj7")
 * @param {Number} octave - Starting octave (default: 4)
 * @returns {Array<Number>} - Array of MIDI note numbers
 */
function chordNameToMidiNotes(chordName, octave = 4) {
  if (!chordName || typeof chordName !== 'string') {
    return [];
  }

  // Basic chord name to MIDI notes mapping
  // This is a simplified version - you can enhance it with a proper chord library
  const baseNoteMap = {
    'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
    'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
    'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
  };

  // Parse chord name (e.g., "Am", "Cmaj7", "F#m")
  const match = chordName.match(/^([A-G][#b]?)(.*)$/i);
  if (!match) return [];

  const baseNote = match[1];
  const quality = match[2] || '';

  const baseMidi = baseNoteMap[baseNote];
  if (baseMidi === undefined) return [];

  const rootNote = (octave + 1) * 12 + baseMidi;

  // Chord quality to intervals (in semitones)
  let intervals = [0]; // Root note

  if (quality === '' || quality.toLowerCase() === 'maj' || quality.toLowerCase() === 'major') {
    // Major triad
    intervals = [0, 4, 7];
  } else if (quality.toLowerCase() === 'm' || quality.toLowerCase() === 'min' || quality.toLowerCase() === 'minor') {
    // Minor triad
    intervals = [0, 3, 7];
  } else if (quality.toLowerCase() === 'dim') {
    // Diminished triad
    intervals = [0, 3, 6];
  } else if (quality.toLowerCase() === 'aug') {
    // Augmented triad
    intervals = [0, 4, 8];
  } else if (quality.toLowerCase() === 'maj7' || quality.toLowerCase() === 'major7') {
    // Major 7th
    intervals = [0, 4, 7, 11];
  } else if (quality.toLowerCase() === 'm7' || quality.toLowerCase() === 'min7' || quality.toLowerCase() === 'minor7') {
    // Minor 7th
    intervals = [0, 3, 7, 10];
  } else if (quality.toLowerCase() === '7' || quality.toLowerCase() === 'dom7') {
    // Dominant 7th
    intervals = [0, 4, 7, 10];
  } else if (quality.toLowerCase() === 'dim7') {
    // Diminished 7th
    intervals = [0, 3, 6, 9];
  } else {
    // Default to major triad if unknown
    intervals = [0, 4, 7];
  }

  return intervals.map(interval => rootNote + interval);
}

/**
 * Generate audio directly from chord data (simpler than parsing MIDI)
 * This uses pure JavaScript and uploads to Cloudinary
 * @param {Array} chords - Array of chord objects with midiNotes
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} - {filepath, filename, url, success, cloudinaryUrl}
 */
export const generateAudioFromChords = async (chords, options = {}) => {
  try {
    const {
      tempo = 120,
      chordDuration = 4, // beats per chord
      sampleRate = 44100,
      uploadToCloud = true,
      cloudinaryFolder = 'backing_tracks_audio',
      projectId = 'unknown',
      rhythmPatternId = null, // Rhythm pattern ID to apply
    } = options;

    // Fetch rhythm pattern if provided
    let rhythmPattern = null;
    if (rhythmPatternId) {
      try {
        const PlayingPattern = (await import('../models/PlayingPattern.js')).default;
        rhythmPattern = await PlayingPattern.findById(rhythmPatternId);
        if (rhythmPattern) {
          console.log(`[Audio Generator] ✓ Loaded rhythm pattern: ${rhythmPattern.name}`);
          console.log(`[Audio Generator]   - Pattern Type: ${rhythmPattern.patternType}`);
          console.log(`[Audio Generator]   - Beats Per Pattern: ${rhythmPattern.beatsPerPattern}`);
          console.log(`[Audio Generator]   - Time Division: ${rhythmPattern.timeDivision}`);
          console.log(`[Audio Generator]   - Note Events: ${rhythmPattern.noteEvents?.length || 0}`);
          if (rhythmPattern.noteEvents && rhythmPattern.noteEvents.length > 0) {
            console.log(`[Audio Generator]   - First few events:`, rhythmPattern.noteEvents.slice(0, 3).map(e => ({
              beat: e.beat,
              subdivision: e.subdivision,
              duration: e.duration,
              velocity: e.velocity,
              noteOffset: e.noteOffset
            })));
          }
        } else {
          console.warn(`[Audio Generator] ✗ Rhythm pattern ${rhythmPatternId} not found in database`);
        }
      } catch (patternError) {
        console.error(`[Audio Generator] ✗ Failed to load rhythm pattern ${rhythmPatternId}:`, patternError);
      }
    } else {
      console.log(`[Audio Generator] No rhythm pattern ID provided - will use block chords`);
    }

    if (!Array.isArray(chords) || chords.length === 0) {
      throw new Error('Chords array is required');
    }

    const secondsPerBeat = 60 / tempo;
    const chordDurationSeconds = chordDuration * secondsPerBeat;
    const totalDuration = chords.length * chordDurationSeconds;
    const numSamples = Math.ceil(totalDuration * sampleRate);
    const audioBuffer = new Float32Array(numSamples * 2); // Stereo

    // Generate audio for each chord
    chords.forEach((chord, chordIndex) => {
      // Get MIDI notes from chord - if not present, convert from chord name
      let midiNotes = Array.isArray(chord.midiNotes) ? chord.midiNotes : [];
      
      // If no midiNotes, try to convert from chordName
      if (midiNotes.length === 0 && chord.chordName) {
        midiNotes = chordNameToMidiNotes(chord.chordName);
        console.log(`[Audio Generator] Converted chord "${chord.chordName}" to MIDI notes:`, midiNotes);
      }
      
      if (midiNotes.length === 0) {
        console.warn(`[Audio Generator] Chord at index ${chordIndex} has no MIDI notes (chordName: ${chord.chordName || 'unknown'})`);
        return;
      }

      const chordStartTime = chordIndex * chordDurationSeconds;
      const chordStartSample = Math.floor(chordStartTime * sampleRate);
      const chordEndSample = Math.floor((chordStartTime + chordDurationSeconds) * sampleRate);

      // Apply rhythm pattern if available
      if (rhythmPattern && rhythmPattern.noteEvents && rhythmPattern.noteEvents.length > 0) {
        // Scale pattern to fit chord duration
        const patternBeats = rhythmPattern.beatsPerPattern || 4;
        const scaleFactor = chordDuration / patternBeats; // Scale pattern to chord duration
        
        console.log(`[Audio Generator] Chord ${chordIndex + 1} (${chord.chordName || 'unknown'}): Applying rhythm pattern`);
        console.log(`[Audio Generator]   - Pattern beats: ${patternBeats}, Chord duration: ${chordDuration}, Scale factor: ${scaleFactor}`);
        console.log(`[Audio Generator]   - Chord MIDI notes:`, midiNotes);
        console.log(`[Audio Generator]   - Processing ${rhythmPattern.noteEvents.length} pattern events`);

        // Generate audio based on rhythm pattern events
        rhythmPattern.noteEvents.forEach((event, eventIndex) => {
          // Calculate event timing within the chord (scaled to chord duration)
          const eventTimeInBeats = (event.beat + event.subdivision) * scaleFactor;
          // Clamp to chord duration
          const clampedEventTime = Math.min(eventTimeInBeats, chordDuration);
          const eventTimeInSeconds = (clampedEventTime / chordDuration) * chordDurationSeconds;
          const eventStartSample = Math.floor((chordStartTime + eventTimeInSeconds) * sampleRate);
          
          // Scale event duration
          const eventDurationInBeats = event.duration * scaleFactor;
          const eventDurationInSeconds = eventDurationInBeats * secondsPerBeat;
          
          // Calculate end sample, but also check if next event starts before this one ends
          let eventEndTime = eventTimeInSeconds + eventDurationInSeconds;
          
          // Find next event to prevent overlap
          const nextEventIndex = eventIndex + 1;
          if (nextEventIndex < rhythmPattern.noteEvents.length) {
            const nextEvent = rhythmPattern.noteEvents[nextEventIndex];
            const nextEventTimeInBeats = (nextEvent.beat + nextEvent.subdivision) * scaleFactor;
            const nextEventTimeInSeconds = (nextEventTimeInBeats / chordDuration) * chordDurationSeconds;
            // Cut off this event when next one starts (unless duration is very short)
            if (nextEventTimeInSeconds > eventTimeInSeconds && eventDurationInBeats > 0.1) {
              eventEndTime = Math.min(eventEndTime, nextEventTimeInSeconds);
            }
          }
          
          const eventEndSample = Math.min(
            Math.floor((chordStartTime + eventEndTime) * sampleRate),
            chordEndSample
          );
          
          if (eventIndex < 3) {
            console.log(`[Audio Generator]   Event ${eventIndex}: Duration=${eventDurationInBeats.toFixed(2)} beats (${eventDurationInSeconds.toFixed(3)}s), End sample=${eventEndSample}`);
          }

          // Determine which note(s) to play based on pattern type and noteOffset
          let notesToPlay = [];
          if (rhythmPattern.patternType === 'arpeggiated' || rhythmPattern.patternType === 'strumming') {
            // Play notes sequentially based on noteOffset
            const noteIndex = Math.floor(event.noteOffset) % midiNotes.length;
            notesToPlay = [midiNotes[noteIndex]];
            if (eventIndex < 3) { // Log first 3 events
              console.log(`[Audio Generator]   Event ${eventIndex}: Arpeggio/Strum - playing note ${noteIndex} (MIDI ${midiNotes[noteIndex]}) at beat ${clampedEventTime.toFixed(2)}`);
            }
          } else if (rhythmPattern.patternType === 'bass') {
            // Play only the root note (first note)
            notesToPlay = [midiNotes[0]];
            if (eventIndex < 3) {
              console.log(`[Audio Generator]   Event ${eventIndex}: Bass - playing root note (MIDI ${midiNotes[0]}) at beat ${clampedEventTime.toFixed(2)}`);
            }
          } else {
            // Block chord: play all notes together
            notesToPlay = midiNotes;
            if (eventIndex < 3) {
              console.log(`[Audio Generator]   Event ${eventIndex}: Block - playing all ${midiNotes.length} notes at beat ${clampedEventTime.toFixed(2)}`);
            }
          }
          
          if (eventStartSample >= eventEndSample) {
            console.warn(`[Audio Generator]   Event ${eventIndex}: Invalid timing (start >= end), skipping`);
            return;
          }

          // Generate audio for each note in this event
          notesToPlay.forEach((midiNote) => {
            const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);
            const velocity = event.velocity || 0.8;
            
            // Calculate actual event duration in samples for envelope
            const actualEventDuration = eventEndSample - eventStartSample;
            if (actualEventDuration <= 0) {
              if (eventIndex < 3) {
                console.warn(`[Audio Generator]   Event ${eventIndex}: Skipping note ${midiNote} - zero duration`);
              }
              return;
            }

            for (let i = eventStartSample; i < eventEndSample && i < numSamples; i++) {
              const t = (i - eventStartSample) / sampleRate;
              const amplitude = Math.sin(2 * Math.PI * frequency * t) * 0.3 * velocity; // Increased from 0.2 to 0.3

              // Apply ADSR envelope with sharper attack/release for rhythm patterns
              const noteProgress = (i - eventStartSample) / actualEventDuration;
              let envelope = 1;

              // Sharper attack: 0-2% of note (faster onset for rhythm)
              if (noteProgress < 0.02) {
                envelope = noteProgress / 0.02;
              }
              // Sharper release: last 15% of note (faster decay to prevent overlap)
              else if (noteProgress > 0.85) {
                envelope = (1 - noteProgress) / 0.15;
              }
              // Sustain: middle portion at full volume
              else {
                envelope = 1;
              }

              audioBuffer[i * 2] += amplitude * envelope; // Left channel
              audioBuffer[i * 2 + 1] += amplitude * envelope; // Right channel
            }
          });
        });
      } else {
        // No rhythm pattern: play all notes simultaneously for full duration (block chord)
        console.log(`[Audio Generator] Chord ${chordIndex + 1} (${chord.chordName || 'unknown'}): No rhythm pattern - using block chord`);
        midiNotes.forEach((midiNote) => {
          const frequency = 440 * Math.pow(2, (midiNote - 69) / 12); // MIDI note to frequency

          for (let i = chordStartSample; i < chordEndSample && i < numSamples; i++) {
            const t = (i - chordStartSample) / sampleRate;
            const amplitude = Math.sin(2 * Math.PI * frequency * t) * 0.2; // Sine wave, lower volume for multiple notes

            // Apply ADSR envelope (Attack, Decay, Sustain, Release)
            const noteProgress = (i - chordStartSample) / (chordEndSample - chordStartSample);
            let envelope = 1;

            // Attack: 0-5% of note
            if (noteProgress < 0.05) {
              envelope = noteProgress / 0.05;
            }
            // Release: last 10% of note
            else if (noteProgress > 0.9) {
              envelope = (1 - noteProgress) / 0.1;
            }

            audioBuffer[i * 2] += amplitude * envelope; // Left channel
            audioBuffer[i * 2 + 1] += amplitude * envelope; // Right channel
          }
        });
      }
    });

    // Normalize audio to prevent clipping
    let maxAmplitude = 0;
    for (let i = 0; i < audioBuffer.length; i++) {
      maxAmplitude = Math.max(maxAmplitude, Math.abs(audioBuffer[i]));
    }
    console.log(`[Audio Generator] Audio buffer stats: maxAmplitude=${maxAmplitude.toFixed(4)}, totalSamples=${audioBuffer.length / 2}, duration=${(audioBuffer.length / 2 / sampleRate).toFixed(2)}s`);
    if (maxAmplitude > 1) {
      const normalizeFactor = 0.95 / maxAmplitude;
      console.log(`[Audio Generator] Normalizing audio (factor: ${normalizeFactor.toFixed(4)})`);
      for (let i = 0; i < audioBuffer.length; i++) {
        audioBuffer[i] *= normalizeFactor;
      }
    }

    // Convert Float32Array to WAV file buffer
    const wavBuffer = audioBufferToWav(audioBuffer, sampleRate);
    console.log(`[Audio Generator] Generated WAV file size: ${(wavBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`);
    
    // Upload to Cloudinary
    try {
      const uploadResult = await uploadFromBuffer(
        Buffer.from(wavBuffer),
        cloudinaryFolder,
        'video' // Cloudinary uses 'video' resource type for audio files
      );
      
      return {
        filepath: null, // Not saved locally
        filename: `backing_${projectId}_${Date.now()}.wav`,
        url: uploadResult.secure_url, // Cloudinary URL
        cloudinaryUrl: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        success: true,
      };
    } catch (uploadError) {
      console.error('[Audio Generator] Cloudinary upload failed:', uploadError);
      throw new Error(`Failed to upload audio to Cloudinary: ${uploadError.message}`);
    }
  } catch (error) {
    console.error('[Audio Generator] Error:', error);
    throw error;
  }
};

/**
 * Convert MIDI file to audio (legacy method - parses MIDI file)
 * @param {String} midiFilePath - Path to the MIDI file
 * @param {Object} options - Conversion options
 * @returns {Promise<Object>} - {filepath, filename, url, success, cloudinaryUrl}
 */
export const convertMIDIToAudioJS = async (midiFilePath, options = {}) => {
  // This method is kept for backward compatibility
  // But we prefer generateAudioFromChords which is more efficient
  throw new Error('MIDI file parsing not implemented. Use generateAudioFromChords instead.');
};

/**
 * Convert Float32Array audio buffer to WAV file buffer
 * @param {Float32Array} audioBuffer - Audio samples (interleaved stereo)
 * @param {Number} sampleRate - Sample rate (e.g., 44100)
 * @returns {ArrayBuffer} - WAV file buffer
 */
function audioBufferToWav(audioBuffer, sampleRate) {
  const length = audioBuffer.length;
  const numChannels = 2; // Stereo
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  
  // WAV header
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // audio format (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);
  
  // Convert float samples to 16-bit PCM
  let offset = 44;
  for (let i = 0; i < length; i++) {
    const sample = Math.max(-1, Math.min(1, audioBuffer[i])); // Clamp to [-1, 1]
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
    offset += 2;
  }
  
  return buffer;
}

/**
 * Main conversion function - generates audio from chords and uploads to Cloudinary
 * @param {Array} chords - Array of chord objects with midiNotes
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} - {filepath, filename, url, success, cloudinaryUrl}
 */
export const convertMIDIToAudioAuto = async (chords, options = {}) => {
  // Generate audio directly from chord data (no MIDI file parsing needed)
  // This is more efficient and doesn't require system dependencies
  return await generateAudioFromChords(chords, {
    ...options,
    uploadToCloud: true, // Always upload to Cloudinary
  });
};

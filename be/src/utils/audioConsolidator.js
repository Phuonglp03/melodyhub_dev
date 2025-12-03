import { uploadFromBuffer } from "./cloudinaryUploader.js";
import https from "https";
import http from "http";

/**
 * Download audio file from URL
 * @param {String} url - URL of the audio file
 * @returns {Promise<Buffer>} - Audio file buffer
 */
async function downloadAudioFile(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    protocol
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download: ${response.statusCode}`));
          return;
        }

        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => resolve(Buffer.concat(chunks)));
        response.on("error", reject);
      })
      .on("error", reject);
  });
}

/**
 * Parse WAV file header and extract audio data
 * @param {Buffer} wavBuffer - WAV file buffer
 * @returns {Object} - {sampleRate, numChannels, audioData}
 */
function parseWavFile(wavBuffer) {
  const view = new DataView(
    wavBuffer.buffer,
    wavBuffer.byteOffset,
    wavBuffer.byteLength
  );

  // Check RIFF header
  const riff = String.fromCharCode(...new Uint8Array(wavBuffer.slice(0, 4)));
  if (riff !== "RIFF") {
    throw new Error("Not a valid WAV file (missing RIFF header)");
  }

  // Check WAVE header
  const wave = String.fromCharCode(...new Uint8Array(wavBuffer.slice(8, 12)));
  if (wave !== "WAVE") {
    throw new Error("Not a valid WAV file (missing WAVE header)");
  }

  // Find fmt chunk
  let offset = 12;
  let sampleRate = 44100;
  let numChannels = 2;
  let bitsPerSample = 16;
  let dataOffset = 0;
  let dataSize = 0;

  while (offset < wavBuffer.length - 8) {
    const chunkId = String.fromCharCode(
      ...new Uint8Array(wavBuffer.slice(offset, offset + 4))
    );
    const chunkSize = view.getUint32(offset + 4, true);

    if (chunkId === "fmt ") {
      const audioFormat = view.getUint16(offset + 8, true);
      numChannels = view.getUint16(offset + 10, true);
      sampleRate = view.getUint32(offset + 12, true);
      bitsPerSample = view.getUint16(offset + 22, true);
    } else if (chunkId === "data") {
      dataOffset = offset + 8;
      dataSize = chunkSize;
      break;
    }

    offset += 8 + chunkSize;
  }

  if (dataOffset === 0) {
    throw new Error("No data chunk found in WAV file");
  }

  // Extract audio samples
  const audioData = wavBuffer.slice(dataOffset, dataOffset + dataSize);

  return {
    sampleRate,
    numChannels,
    bitsPerSample,
    audioData,
  };
}

/**
 * Convert 16-bit PCM samples to Float32Array
 * @param {Buffer} pcmData - 16-bit PCM data
 * @returns {Float32Array} - Float32 samples
 */
function pcm16ToFloat32(pcmData) {
  const samples = new Float32Array(pcmData.length / 2);
  const view = new DataView(
    pcmData.buffer,
    pcmData.byteOffset,
    pcmData.byteLength
  );

  for (let i = 0; i < samples.length; i++) {
    const int16 = view.getInt16(i * 2, true);
    samples[i] = int16 / 32768.0; // Convert to [-1, 1]
  }

  return samples;
}

/**
 * Convert Float32Array to 16-bit PCM
 * @param {Float32Array} float32Data - Float32 samples
 * @returns {Buffer} - 16-bit PCM buffer
 */
function float32ToPcm16(float32Data) {
  const buffer = Buffer.alloc(float32Data.length * 2);
  const view = new DataView(buffer.buffer);

  for (let i = 0; i < float32Data.length; i++) {
    const sample = Math.max(-1, Math.min(1, float32Data[i]));
    const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    view.setInt16(i * 2, int16, true);
  }

  return buffer;
}

/**
 * Create WAV file from audio data
 * @param {Buffer} audioData - 16-bit PCM audio data
 * @param {Number} sampleRate - Sample rate
 * @param {Number} numChannels - Number of channels
 * @returns {Buffer} - WAV file buffer
 */
function createWavFile(audioData, sampleRate, numChannels) {
  const dataSize = audioData.length;
  const buffer = Buffer.alloc(44 + dataSize);
  const view = new DataView(buffer.buffer);

  // WAV header
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // audio format (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true); // byte rate
  view.setUint16(32, numChannels * 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  // Copy audio data
  audioData.copy(buffer, 44);

  return buffer;
}

/**
 * Consolidate multiple audio files into one
 * @param {Array} audioFiles - Array of {url, cloudinaryUrl, chordName, index, volume, memberName}
 * @param {Object} options - {cloudinaryFolder, projectId, tempo, chordDuration, mixMode}
 * @returns {Promise<Object>} - {cloudinaryUrl, url, success}
 */
export const consolidateAudioFiles = async (audioFiles, options = {}) => {
  try {
    const {
      cloudinaryFolder = "backing_tracks_audio",
      projectId = "unknown",
      tempo = 120,
      chordDuration = 4,
      mixMode = false, // If true, overlay all tracks (for mixing members). If false, place sequentially (for chords)
    } = options;

    console.log(
      `[Audio Consolidator] Starting consolidation of ${audioFiles.length} audio files...`
    );

    // Download and parse all audio files
    const parsedAudios = [];
    let targetSampleRate = 44100;
    let targetNumChannels = 2;

    for (let i = 0; i < audioFiles.length; i++) {
      const audioFile = audioFiles[i];
      const url = audioFile.cloudinaryUrl || audioFile.url;

      console.log(
        `[Audio Consolidator] Downloading audio file ${i + 1}/${
          audioFiles.length
        }: ${audioFile.chordName}`
      );

      try {
        const audioBuffer = await downloadAudioFile(url);
        const parsed = parseWavFile(audioBuffer);

        // Use first file's sample rate and channels as target
        if (i === 0) {
          targetSampleRate = parsed.sampleRate;
          targetNumChannels = parsed.numChannels;
        }

        // Convert to float32 for mixing
        const float32Data = pcm16ToFloat32(parsed.audioData);

        // Handle mono to stereo conversion if needed
        let stereoData;
        if (parsed.numChannels === 1 && targetNumChannels === 2) {
          // Convert mono to stereo
          stereoData = new Float32Array(float32Data.length * 2);
          for (let j = 0; j < float32Data.length; j++) {
            stereoData[j * 2] = float32Data[j];
            stereoData[j * 2 + 1] = float32Data[j];
          }
        } else if (parsed.numChannels === 2 && targetNumChannels === 2) {
          stereoData = float32Data;
        } else {
          stereoData = float32Data;
        }

        parsedAudios.push({
          chordName: audioFile.chordName,
          index: audioFile.index,
          audioData: stereoData,
          sampleRate: parsed.sampleRate,
          numChannels: targetNumChannels,
        });

        console.log(
          `[Audio Consolidator] ✓ Parsed ${audioFile.chordName}: ${
            stereoData.length / targetNumChannels
          } samples`
        );
      } catch (error) {
        console.error(
          `[Audio Consolidator] ✗ Failed to download/parse ${audioFile.chordName}:`,
          error.message
        );
      }
    }

    if (parsedAudios.length === 0) {
      throw new Error("No audio files were successfully parsed");
    }

    console.log(
      `[Audio Consolidator] Successfully parsed ${parsedAudios.length} audio files`
    );

    // Calculate total duration and create consolidated buffer
    let totalDurationSeconds;
    let totalSamples;

    if (mixMode) {
      // Mix mode: overlay all tracks, use the longest duration
      const maxDuration = Math.max(
        ...parsedAudios.map(
          (p) => p.audioData.length / (targetSampleRate * targetNumChannels)
        )
      );
      totalDurationSeconds = maxDuration;
      totalSamples = Math.ceil(
        totalDurationSeconds * targetSampleRate * targetNumChannels
      );
      console.log(
        `[Audio Consolidator] Mix mode: overlaying ${
          parsedAudios.length
        } tracks, duration: ${totalDurationSeconds.toFixed(2)}s`
      );
    } else {
      // Sequential mode: place tracks one after another
      const secondsPerBeat = 60 / tempo;
      const chordDurationSeconds = chordDuration * secondsPerBeat;
      totalDurationSeconds = parsedAudios.length * chordDurationSeconds;
      totalSamples = Math.ceil(
        totalDurationSeconds * targetSampleRate * targetNumChannels
      );
      console.log(
        `[Audio Consolidator] Sequential mode: ${
          parsedAudios.length
        } tracks, duration: ${totalDurationSeconds.toFixed(2)}s`
      );
    }

    console.log(
      `[Audio Consolidator] Creating consolidated buffer: ${totalSamples} samples, ${totalDurationSeconds.toFixed(
        2
      )}s duration`
    );

    const consolidatedBuffer = new Float32Array(totalSamples);

    // Place or mix audio tracks
    for (let i = 0; i < parsedAudios.length; i++) {
      const parsed = parsedAudios[i];
      const audioFile = audioFiles[i];
      const volume = audioFile.volume || 1.0; // Apply member volume if provided

      if (mixMode) {
        // Mix mode: overlay all tracks at position 0
        const audioLength = parsed.audioData.length;
        for (let j = 0; j < audioLength && j < totalSamples; j++) {
          consolidatedBuffer[j] += parsed.audioData[j] * volume;
        }
        console.log(
          `[Audio Consolidator] Mixed ${
            parsed.chordName || audioFile.memberName || `track ${i + 1}`
          } (volume: ${volume})`
        );
      } else {
        // Sequential mode: place each track at its timeline position
        const secondsPerBeat = 60 / tempo;
        const chordDurationSeconds = chordDuration * secondsPerBeat;
        const startTime = i * chordDurationSeconds;
        const startSample = Math.floor(
          startTime * targetSampleRate * targetNumChannels
        );
        const audioLength = parsed.audioData.length;

        // Copy audio data to consolidated buffer
        for (
          let j = 0;
          j < audioLength && startSample + j < totalSamples;
          j++
        ) {
          consolidatedBuffer[startSample + j] += parsed.audioData[j] * volume;
        }

        console.log(
          `[Audio Consolidator] Placed ${
            parsed.chordName || `chord ${i + 1}`
          } at position ${startTime.toFixed(2)}s`
        );
      }
    }

    // Normalize to prevent clipping
    let maxAmplitude = 0;
    for (let i = 0; i < consolidatedBuffer.length; i++) {
      maxAmplitude = Math.max(maxAmplitude, Math.abs(consolidatedBuffer[i]));
    }

    if (maxAmplitude > 1) {
      const normalizeFactor = 0.95 / maxAmplitude;
      console.log(
        `[Audio Consolidator] Normalizing audio (factor: ${normalizeFactor.toFixed(
          4
        )})`
      );
      for (let i = 0; i < consolidatedBuffer.length; i++) {
        consolidatedBuffer[i] *= normalizeFactor;
      }
    }

    // Convert back to PCM16
    const pcm16Data = float32ToPcm16(consolidatedBuffer);

    // Create WAV file
    const wavBuffer = createWavFile(
      pcm16Data,
      targetSampleRate,
      targetNumChannels
    );

    console.log(
      `[Audio Consolidator] Generated consolidated WAV: ${(
        wavBuffer.length /
        1024 /
        1024
      ).toFixed(2)} MB`
    );

    // Upload to Cloudinary
    const uploadResult = await uploadFromBuffer(
      wavBuffer,
      cloudinaryFolder,
      "video" // Cloudinary uses 'video' resource type for audio files
    );

    console.log(
      `[Audio Consolidator] ✓ Uploaded consolidated backing track: ${uploadResult.secure_url}`
    );

    return {
      filepath: null,
      filename: `backing_consolidated_${projectId}_${Date.now()}.wav`,
      url: uploadResult.secure_url,
      cloudinaryUrl: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      success: true,
    };
  } catch (error) {
    console.error("[Audio Consolidator] Error:", error);
    throw error;
  }
};

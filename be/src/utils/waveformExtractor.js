import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import fetch from "node-fetch";
import { Readable } from "stream";

// Set the path to the FFmpeg binary
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

/**
 * Extract waveform data from an audio URL
 * @param {string} audioUrl - URL of the audio file (e.g., from Cloudinary)
 * @param {number} samples - Number of waveform samples to generate (default: 200)
 * @returns {Promise<number[]>} Array of normalized amplitude values (0-1)
 */
export const extractWaveformFromUrl = async (audioUrl, samples = 369) => {
  try {
    // 1. Fetch the audio file from the URL
    const response = await fetch(audioUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.statusText}`);
    }

    const audioBuffer = await response.buffer();

    // 2. Extract PCM data using ffmpeg
    const pcmData = await extractPCMData(audioBuffer);

    // 3. Generate waveform samples
    const waveform = generateWaveformSamples(pcmData, samples);

    return waveform;
  } catch (error) {
    console.error("Error extracting waveform:", error);
    throw error;
  }
};

/**
 * Extract raw PCM data from audio buffer using ffmpeg
 * @param {Buffer} audioBuffer - Audio file buffer
 * @returns {Promise<Buffer>} PCM data buffer
 */
const extractPCMData = (audioBuffer) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const audioStream = Readable.from(audioBuffer);

    ffmpeg(audioStream)
      .toFormat("s16le") // 16-bit signed little-endian PCM
      .audioChannels(1) // Convert to mono
      .audioFrequency(44100) // Sample rate
      .on("error", (err) => {
        reject(new Error(`FFmpeg error: ${err.message}`));
      })
      .on("end", () => {
        resolve(Buffer.concat(chunks));
      })
      .pipe()
      .on("data", (chunk) => {
        chunks.push(chunk);
      })
      .on("error", (err) => {
        reject(err);
      });
  });
};

/**
 * Generate waveform samples from PCM data
 * @param {Buffer} pcmData - Raw PCM data (16-bit signed integers)
 * @param {number} targetSamples - Number of samples in the output waveform
 * @returns {number[]} Array of normalized amplitude values (0-1)
 */
const generateWaveformSamples = (pcmData, targetSamples) => {
  const waveform = [];

  // Each sample is 2 bytes (16-bit)
  const totalSamples = pcmData.length / 2;
  const samplesPerBucket = Math.floor(totalSamples / targetSamples);

  if (samplesPerBucket === 0) {
    // If audio is too short, return zeros
    return new Array(targetSamples).fill(0);
  }

  // Process each bucket
  for (let i = 0; i < targetSamples; i++) {
    const start = i * samplesPerBucket * 2; // *2 because each sample is 2 bytes
    const end = Math.min(start + samplesPerBucket * 2, pcmData.length);

    let maxAmplitude = 0;

    // Find the maximum amplitude in this bucket
    for (let j = start; j < end; j += 2) {
      // Read 16-bit signed integer
      const sample = pcmData.readInt16LE(j);
      const amplitude = Math.abs(sample);
      maxAmplitude = Math.max(maxAmplitude, amplitude);
    }

    // Normalize to 0-1 range (16-bit max is 32768)
    const normalized = maxAmplitude / 32768;
    waveform.push(normalized);
  }

  return waveform;
};

/**
 * Extract waveform data from a file buffer (useful for upload processing)
 * @param {Buffer} fileBuffer - Audio file buffer
 * @param {number} samples - Number of waveform samples to generate
 * @returns {Promise<number[]>} Array of normalized amplitude values (0-1)
 */
export const extractWaveformFromBuffer = async (fileBuffer, samples = 369) => {
  try {
    const pcmData = await extractPCMData(fileBuffer);
    const waveform = generateWaveformSamples(pcmData, samples);
    return waveform;
  } catch (error) {
    console.error("Error extracting waveform from buffer:", error);
    throw error;
  }
};

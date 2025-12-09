import { useEffect, useRef } from "react";
import * as Tone from "tone";

let audioEngineSingleton = null;

/**
 * Creates a singleton audio engine that wraps Tone.js.
 * All Tone.js objects (Transport, Players, etc.) are accessed through this engine
 * to avoid storing non-serializable objects in Redux.
 */
const createAudioEngine = () => {
  const engine = {
    Tone,
    _started: false,
    players: new Map(), // clipId -> Tone.Player
    audioBuffers: new Map(), // clipId -> audioUrl (cache)

    /**
     * Ensure Tone.js audio context is started (required after user gesture)
     */
    async ensureStarted() {
      if (!this._started) {
        await Tone.start();
        this._started = true;
      }
      return Tone.getContext();
    },

    /**
     * Get Tone.Transport (singleton)
     */
    get transport() {
      return Tone.Transport;
    },

    /**
     * Set BPM on Transport
     */
    setBpm(bpm) {
      if (Tone.Transport) {
        Tone.Transport.bpm.value = bpm;
      }
    },

    /**
     * Get current transport position in seconds
     */
    getPosition() {
      return Tone.Transport ? Tone.Transport.seconds : 0;
    },

    /**
     * Set transport position in seconds
     */
    setPosition(seconds) {
      if (Tone.Transport) {
        Tone.Transport.seconds = seconds;
      }
    },

    /**
     * Start transport playback
     */
    startTransport() {
      if (Tone.Transport) {
        Tone.Transport.start();
      }
    },

    /**
     * Pause transport playback
     */
    pauseTransport() {
      if (Tone.Transport) {
        Tone.Transport.pause();
      }
    },

    /**
     * Stop transport and reset to position 0
     */
    stopTransport() {
      if (Tone.Transport) {
        Tone.Transport.stop();
        Tone.Transport.seconds = 0;
      }
    },

    /**
     * Check if transport is currently playing
     */
    isTransportPlaying() {
      return Tone.Transport && Tone.Transport.state === "started";
    },

    /**
     * Load audio into a Tone.Player for a specific clip
     */
    async loadPlayer(clipId, audioUrl) {
      if (this.players.has(clipId)) {
        return true;
      }

      try {
        const player = new Tone.Player({
          url: audioUrl,
          onload: () => {
            this.audioBuffers.set(clipId, audioUrl);
          },
        }).toDestination();

        await Tone.loaded();
        this.players.set(clipId, player);
        return true;
      } catch (error) {
        console.error(
          `[AudioEngine] Error loading audio for clip ${clipId}:`,
          error
        );
        return false;
      }
    },

    /**
     * Get player for a clip
     */
    getPlayer(clipId) {
      return this.players.get(clipId) || null;
    },

    /**
     * Check if player exists for clip
     */
    hasPlayer(clipId) {
      return this.players.has(clipId);
    },

    /**
     * Unsync and stop all players
     */
    unsyncAllPlayers() {
      this.players.forEach((player) => {
        if (player) {
          player.unsync();
          player.stop();
        }
      });
    },

    /**
     * Stop all players
     */
    stopAllPlayers() {
      this.players.forEach((player) => {
        if (player) {
          player.stop();
        }
      });
    },

    /**
     * Dispose all players and clear maps
     */
    disposeAllPlayers() {
      this.players.forEach((player) => {
        if (player) {
          player.unsync();
          player.dispose();
        }
      });
      this.players.clear();
      this.audioBuffers.clear();
    },

    /**
     * Convert gain (0-1) to decibels
     */
    gainToDb(gain) {
      return Tone.gainToDb(gain);
    },

    /**
     * Cleanup on unmount (but keep singleton alive)
     */
    cleanup() {
      if (this.isTransportPlaying()) {
        this.stopTransport();
      }
      this.disposeAllPlayers();
    },
  };

  return engine;
};

/**
 * Hook to access the audio engine singleton.
 * This ensures Tone.js objects are NOT stored in Redux (which requires serializable state).
 * Instead, all audio objects are managed through this singleton.
 */
export const useAudioEngine = () => {
  const instanceRef = useRef(audioEngineSingleton);

  if (!instanceRef.current) {
    audioEngineSingleton = createAudioEngine();
    instanceRef.current = audioEngineSingleton;
  }

  useEffect(() => {
    return () => {
      // Keep singleton alive across component mounts
      // Only cleanup when truly unmounting the app
    };
  }, []);

  return instanceRef.current;
};

/**
 * Get the audio engine singleton directly (for non-React contexts)
 */
export const getAudioEngine = () => {
  if (!audioEngineSingleton) {
    audioEngineSingleton = createAudioEngine();
  }
  return audioEngineSingleton;
};

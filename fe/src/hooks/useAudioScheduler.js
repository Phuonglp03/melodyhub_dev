import { useCallback, useRef } from "react";
import { useAudioEngine } from "./useAudioEngine";

/**
 * useAudioScheduler - Custom hook for scheduling audio playback on timeline
 *
 * Extracted from ProjectDetailPage to separate audio scheduling logic.
 * Works with useAudioEngine singleton to manage Tone.js players.
 *
 * Usage:
 * const { schedulePlayback, stopPlayback, loadClipAudio } = useAudioScheduler();
 */
export const useAudioScheduler = () => {
  const audioEngine = useAudioEngine();
  const scheduledClipsRef = useRef(new Set());

  /**
   * Load audio for a clip into the audio engine
   */
  const loadClipAudio = useCallback(
    async (clipId, audioUrl) => {
      if (!clipId || !audioUrl) return false;

      // Skip MIDI files (can't be played directly)
      if (audioUrl.endsWith(".mid") || audioUrl.endsWith(".midi")) {
        console.warn(
          `[AudioScheduler] Clip ${clipId} has MIDI file, cannot play directly`
        );
        return false;
      }

      return audioEngine.loadPlayer(clipId, audioUrl);
    },
    [audioEngine]
  );

  /**
   * Schedule a single clip for playback
   */
  const scheduleClip = useCallback(
    (clipId, startTime, offset = 0, duration = 0, options = {}) => {
      const player = audioEngine.getPlayer(clipId);
      if (!player) {
        console.warn(`[AudioScheduler] Player not found for clip ${clipId}`);
        return false;
      }

      const { playbackRate = 1, volume = 1 } = options;

      // Set playback rate
      player.playbackRate = playbackRate;

      // Set volume (convert gain to dB)
      player.volume.value = audioEngine.gainToDb(volume);

      // Sync to transport and schedule
      player.sync().start(startTime, offset, duration);
      scheduledClipsRef.current.add(clipId);

      return true;
    },
    [audioEngine]
  );

  /**
   * Schedule all clips from tracks for playback
   * @param tracks - Array of track objects with items
   * @param getAudioUrl - Async function to get audio URL for an item: (item) => Promise<string|null>
   */
  const schedulePlayback = useCallback(
    async (tracks, getAudioUrl) => {
      // Clear previous scheduling
      audioEngine.unsyncAllPlayers();
      scheduledClipsRef.current.clear();

      let scheduledCount = 0;

      for (const track of tracks) {
        // Skip muted tracks
        if (track.muted) continue;

        const trackVolume = track.volume || 1;
        const soloMultiplier = track.solo ? 1 : 0.7;
        const effectiveVolume = trackVolume * soloMultiplier;

        for (const item of track.items || []) {
          const clipId = item._id;
          const clipStart = item.startTime || 0;

          // Skip virtual chords (they don't have audio)
          if (typeof clipId === "string" && clipId.startsWith("chord-")) {
            continue;
          }

          try {
            // Get audio URL for this item
            const audioUrl = await getAudioUrl(item);
            if (!audioUrl) continue;

            // Load audio if not already loaded
            const loaded = await loadClipAudio(clipId, audioUrl);
            if (!loaded) continue;

            // Schedule the clip
            const scheduled = scheduleClip(
              clipId,
              clipStart,
              item.offset || 0,
              item.duration || 0,
              {
                playbackRate: item.playbackRate || 1,
                volume: effectiveVolume,
              }
            );

            if (scheduled) {
              scheduledCount++;
              console.log(
                `[AudioScheduler] Scheduled clip ${clipId} at ${clipStart}s`
              );
            }
          } catch (error) {
            console.error(
              `[AudioScheduler] Error scheduling clip ${clipId}:`,
              error
            );
          }
        }
      }

      if (scheduledCount === 0) {
        console.warn("[AudioScheduler] No audio clips were scheduled");
      } else {
        console.log(
          `[AudioScheduler] Successfully scheduled ${scheduledCount} clip(s)`
        );
      }

      return scheduledCount;
    },
    [audioEngine, loadClipAudio, scheduleClip]
  );

  /**
   * Stop all scheduled playback
   */
  const stopPlayback = useCallback(() => {
    audioEngine.stopAllPlayers();
    scheduledClipsRef.current.clear();
  }, [audioEngine]);

  /**
   * Unsync all players (for rescheduling)
   */
  const unsyncAll = useCallback(() => {
    audioEngine.unsyncAllPlayers();
    scheduledClipsRef.current.clear();
  }, [audioEngine]);

  /**
   * Get count of scheduled clips
   */
  const getScheduledCount = useCallback(() => {
    return scheduledClipsRef.current.size;
  }, []);

  return {
    loadClipAudio,
    scheduleClip,
    schedulePlayback,
    stopPlayback,
    unsyncAll,
    getScheduledCount,
    audioEngine,
  };
};

export default useAudioScheduler;

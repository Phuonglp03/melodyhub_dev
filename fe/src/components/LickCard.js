import React, { useState, useRef, useEffect } from "react";
import {
  FaHeart,
  FaPlay,
  FaPause,
  FaComment,
  FaDownload,
  FaMusic,
  FaWaveSquare,
  FaFolderPlus,
} from "react-icons/fa";
import { playLickAudio, getLickById } from "../services/user/lickService";
import { toggleLickLike } from "../services/user/lickService";
// Prefer Redux auth state over ad-hoc local storage helpers
import { useDispatch, useSelector } from "react-redux";
import { setLikeState, toggleLikeLocal } from "../redux/likesSlice";
import { getProfileById } from "../services/user/profile";
import AddToPlaylistModal from "./AddToPlaylistModal";

const LickCard = ({ lick, onClick }) => {
  const {
    lick_id,
    title,
    creator,
    created_at,
    likes_count,
    tags,
    waveformData,
    duration,
    difficulty,
    tempo,
    key,
  } = lick;

  // Resolve userId from payload shapes (DB uses userId)
  const userId =
    lick.userId ||
    lick.user_id ||
    creator?.user_id ||
    creator?._id ||
    lick.user?.id ||
    lick.user?.user_id ||
    null;

  const [resolvedCreator, setResolvedCreator] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const needFetch = !creator?.display_name && !creator?.username;
    if (userId && needFetch) {
      getProfileById(userId)
        .then((res) => {
          if (cancelled) return;
          const u = res?.data?.user || res?.data;
          if (u) setResolvedCreator(u);
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [userId, creator?.display_name, creator?.username]);

  // Normalize id across different payloads
  const effectiveId = lick_id || lick._id || lick.id;

  const initialWaveform = waveformData || lick.waveformData || [];
  const [waveform, setWaveform] = useState(initialWaveform);

  // Lazy hydrate waveform from details if missing in list payload
  useEffect(() => {
    let aborted = false;
    const computeWaveFromAudio = async (audioUrl) => {
      try {
        const cacheKey = `wf_${effectiveId}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const arr = JSON.parse(cached);
          if (Array.isArray(arr) && arr.length > 0) {
            setWaveform(arr);
            return true;
          }
        }
        const resp = await fetch(audioUrl);
        const buf = await resp.arrayBuffer();
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const audio = await ctx.decodeAudioData(buf);
        const channel = audio.getChannelData(0);
        const bars = 100;
        const blockSize = Math.floor(channel.length / bars);
        const peaks = new Array(bars).fill(0).map((_, i) => {
          let sum = 0;
          const start = i * blockSize;
          const end = Math.min(start + blockSize, channel.length);
          for (let j = start; j < end; j++) sum += Math.abs(channel[j]);
          // Average absolute amplitude -> boost a bit for visibility
          const avg = sum / (end - start || 1);
          return Math.min(1, avg * 4);
        });
        if (!aborted) {
          setWaveform(peaks);
          try {
            localStorage.setItem(cacheKey, JSON.stringify(peaks));
          } catch {}
        }
        return true;
      } catch (e) {
        return false;
      }
    };

    const load = async () => {
      if (waveform && waveform.length > 0) return;
      try {
        if (!effectiveId) return;
        const res = await getLickById(effectiveId);
        const wf = res?.data?.waveformData || [];
        if (!aborted && Array.isArray(wf) && wf.length > 0) {
          setWaveform(wf);
          return;
        }
        // Fallback: derive from audio URL
        const playRes = await playLickAudio(effectiveId);
        const url = playRes?.data?.audio_url;
        if (url) await computeWaveFromAudio(url);
      } catch (e) {
        // ignore; keep placeholder UI
      }
    };
    load();
    return () => {
      aborted = true;
    };
  }, [effectiveId]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0); // Track playback progress (0-1)
  const audioRef = useRef(null);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const dispatch = useDispatch();
  const authUser = useSelector((s) => s.auth.user);
  const likeState = useSelector((s) => s.likes.byId[lick_id]);
  const isLiked = likeState?.liked || false;
  const localLikesCount = likeState?.count ?? likes_count;

  useEffect(() => {
    if (!likeState) {
      dispatch(setLikeState({ id: lick_id, liked: false, count: likes_count }));
    }
  }, [dispatch, likeState, lick_id, likes_count]);

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Handle play/pause for waveform
  const handlePlayPause = async (e) => {
    e.stopPropagation();

    // If already playing, pause (keep progress)
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    try {
      setIsLoading(true);

      // Get audio URL from API
      const response = await playLickAudio(effectiveId);
      console.log("Audio URL response:", response);

      if (response.success && response.data.audio_url) {
        // Create or update audio element
        if (!audioRef.current) {
          audioRef.current = new Audio();

          // Track playback progress
          audioRef.current.addEventListener("timeupdate", () => {
            const currentProgress =
              audioRef.current.currentTime / audioRef.current.duration;
            setProgress(currentProgress);
          });

          audioRef.current.addEventListener("ended", () => {
            setIsPlaying(false);
            setProgress(0); // Reset progress
          });

          audioRef.current.addEventListener("error", (error) => {
            console.error("Audio playback error:", error);
            alert("Failed to play audio. Check console for details.");
            setIsPlaying(false);
            setIsLoading(false);
            setProgress(0);
          });

          audioRef.current.addEventListener("loadeddata", () => {
            console.log("Audio loaded successfully");
          });
        }

        // Set the source and load
        audioRef.current.src = response.data.audio_url;
        audioRef.current.load();

        // Wait for the audio to be ready and then play
        await audioRef.current.play();
        setIsPlaying(true);
        console.log("Playing audio:", response.data.audio_url);
      } else {
        console.error("No audio URL in response:", response);
        alert("Audio URL not available");
      }
    } catch (error) {
      console.error("Error playing lick:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLike = async (e) => {
    e.stopPropagation();
    const userId = authUser?.user?.id || authUser?.id;
    const hasToken = Boolean(authUser?.token);
    if (!userId || !hasToken) {
      alert("You need to be logged in to like licks.");
      return;
    }
    try {
      // Optimistic update through Redux
      dispatch(toggleLikeLocal({ id: lick_id }));
      const response = await toggleLickLike(lick_id, userId);
      if (response.success && typeof response.data?.liked === "boolean") {
        // Ensure state matches server; if mismatch, toggle again to align
        if (response.data.liked !== isLiked) {
          dispatch(toggleLikeLocal({ id: lick_id }));
        }
      }
    } catch (err) {
      // Rollback optimistic update
      dispatch(toggleLikeLocal({ id: lick_id }));
      alert("Failed to update like. Try again.");
    }
  };

  const commentsCount =
    typeof lick.comments_count === "number"
      ? lick.comments_count
      : typeof lick.commentsCount === "number"
      ? lick.commentsCount
      : 0;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 hover:shadow-lg transition-all">
      <div className="relative h-20 bg-gray-800" onClick={handlePlayPause}>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {waveform && waveform.length > 0 ? (
            <div className="flex items-end justify-center w-[92%] h-[70%]">
              {waveform.map((amplitude, index) => {
                const barProgress = index / waveform.length;
                const isPlayed = barProgress <= progress;
                return (
                  <div
                    key={index}
                    className="w-0.5 mx-px"
                    style={{
                      height: `${Math.max(amplitude * 100, 8)}%`,
                      backgroundColor:
                        isPlaying && isPlayed ? "#22d3ee" : "#9ca3af",
                      opacity: isPlaying && isPlayed ? 1 : 0.65,
                    }}
                  />
                );
              })}
            </div>
          ) : (
            <span className="text-gray-500 text-[10px]">No waveform</span>
          )}
        </div>

        <button
          onClick={handlePlayPause}
          className="absolute bottom-1.5 right-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full p-2"
        >
          {isLoading ? (
            <div className="animate-spin h-4 w-4 border-t-2 border-b-2 border-white rounded-full" />
          ) : isPlaying ? (
            <FaPause size={12} />
          ) : (
            <FaPlay size={12} />
          )}
        </button>
      </div>

      <div className="p-3">
        <h3
          onClick={() => onClick(effectiveId)}
          className="text-sm font-semibold text-slate-100 mb-1.5 hover:text-cyan-300 cursor-pointer"
        >
          {title}
        </h3>
        <div className="flex items-center text-[10px] text-gray-400 mb-2">
          <span className="truncate">
            By{" "}
            {creator?.display_name ||
              creator?.displayName ||
              resolvedCreator?.displayName ||
              creator?.username ||
              resolvedCreator?.username ||
              "Unknown"}
          </span>
          <span className="mx-2">•</span>
          <span>{formatDate(created_at)}</span>
          {duration ? (
            <>
              <span className="mx-2">•</span>
              <span>{duration.toFixed(1)}s</span>
            </>
          ) : null}
          {difficulty ? (
            <span
              className={`ml-auto px-1.5 py-0.5 rounded-full text-[9px] ${
                difficulty === "beginner"
                  ? "bg-green-900 text-green-300"
                  : difficulty === "intermediate"
                  ? "bg-yellow-900 text-yellow-300"
                  : "bg-red-900 text-red-300"
              }`}
            >
              {difficulty}
            </span>
          ) : null}
        </div>

        {tags && tags.length > 0 && (
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mb-2">
            {tags.slice(0, 6).map((tag) => (
              <span
                key={tag.tag_id}
                onClick={(e) => e.stopPropagation()}
                className="text-[9px] text-slate-300 underline underline-offset-2 decoration-slate-600/50 hover:text-slate-100 transition-colors"
              >
                {tag.tag_name}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center text-[10px] text-slate-300 mb-2.5">
          <span className="flex items-center gap-1 mr-3">
            <FaWaveSquare className="text-slate-400" size={10} />
            {tempo ? `${Math.round(tempo)} BPM` : "—"}
          </span>
          <span className="flex items-center gap-1">
            <FaMusic className="text-slate-400" size={10} />
            {key || "Key N/A"}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-300">
          <div className="flex items-center gap-3">
            <button
              onClick={handleLike}
              className={`flex items-center gap-1 ${
                isLiked ? "text-rose-400" : "text-gray-300 hover:text-rose-300"
              }`}
            >
              <FaHeart size={12} />
              <span className="text-[10px]">{localLikesCount}</span>
            </button>
            <span className="flex items-center gap-1 text-gray-400">
              <FaComment size={12} />
              <span className="text-[10px]">{commentsCount}</span>
            </span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowPlaylistModal(true);
            }}
            className="flex items-center gap-1 text-gray-300 hover:text-orange-400 transition-colors"
            title="Add to playlist"
          >
            <FaFolderPlus size={14} />
          </button>
        </div>
      </div>

      {/* Add to Playlist Modal */}
      <AddToPlaylistModal
        isOpen={showPlaylistModal}
        onClose={() => setShowPlaylistModal(false)}
        lickId={effectiveId}
        lickTitle={title}
      />
    </div>
  );
};

export default LickCard;

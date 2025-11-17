import React, { useState, useEffect, useRef } from "react";
import {
  FaHeart,
  FaComment,
  FaPlay,
  FaPause,
  FaEdit,
  FaTrash,
  FaMusic,
  FaWaveSquare,
  FaShareAlt,
} from "react-icons/fa";
import {
  playLickAudio,
  getLickById,
  toggleLickLike,
} from "../services/user/lickService";
import { useDispatch, useSelector } from "react-redux";
import { setLikeState, toggleLikeLocal } from "../redux/likesSlice";
import { getStoredUserId } from "../services/user/post";
import { getProfileById } from "../services/user/profile";

const MyLickCard = ({
  lick,
  onEdit,
  onDelete,
  onClick,
  onShare,
  shareLoading,
}) => {
  const {
    lick_id,
    title,
    created_at,
    likes_count,
    comments_count,
    tags,
    waveformData,
    duration,
    difficulty,
    status,
    is_public,
    creator,
    tempo,
    key,
  } = lick;

  // Resolve userId from payload (DB uses userId)
  const userId =
    lick.userId || lick.user_id || creator?.user_id || creator?._id || null;

  const [resolvedCreator, setResolvedCreator] = useState(null);
  useEffect(() => {
    let cancelled = false;
    const needFetch = !creator?.display_name && userId;
    if (needFetch) {
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
  }, [userId, creator?.display_name]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0); // Track playback progress (0-1)
  const audioRef = useRef(null);
  const dispatch = useDispatch();
  const likeState = useSelector((s) => s.likes.byId[lick_id]);
  const isLiked = likeState?.liked || false;
  const localLikesCount = likeState?.count ?? likes_count;

  // Normalize id across different payloads
  const effectiveId = lick_id || lick._id || lick.id;

  // Use waveformData from API (snake_case as returned by backend)
  const initialWaveform = waveformData || lick.waveformData || [];
  const [waveform, setWaveform] = useState(initialWaveform);

  // Lazy hydrate waveform from details if missing in list payload (same as LickCard)
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

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Initialize like state for this lick in redux once
  useEffect(() => {
    if (!likeState) {
      dispatch(
        setLikeState({ id: lick_id, liked: false, count: likes_count || 0 })
      );
    }
  }, [dispatch, likeState, lick_id, likes_count]);

  // Status badge color
  const getStatusColor = (status) => {
    switch (status) {
      case "active":
        return "bg-green-900 text-green-300";
      case "draft":
        return "bg-yellow-900 text-yellow-300";
      case "inactive":
        return "bg-gray-800 text-gray-400";
      default:
        return "bg-gray-800 text-gray-400";
    }
  };

  // Handle play/pause
  const handlePlayPause = async (e) => {
    e.stopPropagation();

    // If already playing, pause
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    try {
      setIsLoading(true);

      // Get audio URL from API
      const response = await playLickAudio(lick_id);
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
    const userId = getStoredUserId();
    if (!userId) {
      alert("You need to be logged in to like licks.");
      return;
    }
    try {
      // optimistic
      dispatch(toggleLikeLocal({ id: lick_id }));
      const res = await toggleLickLike(lick_id, userId);
      if (res?.success && typeof res.data?.liked === "boolean") {
        if (res.data.liked !== isLiked) {
          // state already toggled; if server response differs from previous state, keep; otherwise re-toggle
        } else {
          // server says same as previous -> revert
          dispatch(toggleLikeLocal({ id: lick_id }));
        }
      }
    } catch (err) {
      // rollback
      dispatch(toggleLikeLocal({ id: lick_id }));
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 hover:shadow-lg transition-all relative group">
      {/* Action Buttons (Show on Hover) */}
      <div className="absolute top-2 right-2 z-10 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(lick_id);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-md transition-colors"
          title="Edit"
        >
          <FaEdit size={12} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(lick_id);
          }}
          className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-md transition-colors"
          title="Delete"
        >
          <FaTrash size={12} />
        </button>
      </div>

      {/* Waveform at top - matching LickCard */}
      <div className="relative h-32 bg-gray-800" onClick={handlePlayPause}>
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
            <span className="text-gray-500 text-sm">No waveform</span>
          )}
        </div>

        <button
          onClick={handlePlayPause}
          className="absolute bottom-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-3"
        >
          {isLoading ? (
            <div className="animate-spin h-5 w-5 border-t-2 border-b-2 border-white rounded-full" />
          ) : isPlaying ? (
            <FaPause size={16} />
          ) : (
            <FaPlay size={16} />
          )}
        </button>
      </div>

      {/* Content section - matching LickCard */}
      <div className="p-4">
        <h3
          onClick={() => onClick(lick_id)}
          className="text-base font-semibold text-slate-100 mb-2 hover:text-cyan-300 cursor-pointer"
        >
          {title}
        </h3>
        <div className="flex items-center text-xs text-gray-400 mb-3">
          <span className="truncate">
            {creator?.display_name ||
            resolvedCreator?.displayName ||
            creator?.displayName
              ? `By ${
                  creator?.display_name ||
                  resolvedCreator?.displayName ||
                  creator?.displayName
                }`
              : "By You"}
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
              className={`ml-auto px-2 py-0.5 rounded-full text-xs ${
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
          {status && (
            <span
              className={`ml-2 px-2 py-0.5 rounded-full text-xs ${getStatusColor(
                status
              )}`}
            >
              {status}
            </span>
          )}
          {!is_public && (
            <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-gray-800 text-gray-400">
              Private
            </span>
          )}
        </div>

        {tags && tags.length > 0 && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-4">
            {tags.slice(0, 8).map((tag) => (
              <span
                key={tag.tag_id}
                onClick={(e) => e.stopPropagation()}
                className="text-[11px] text-slate-300 underline underline-offset-4 decoration-slate-600/50 hover:text-slate-100 transition-colors"
              >
                {tag.tag_name}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center text-xs text-slate-300 mb-4">
          <span className="flex items-center gap-1 mr-4">
            <FaWaveSquare className="text-slate-400" size={12} />
            {tempo ? `${Math.round(tempo)} BPM` : "—"}
          </span>
          <span className="flex items-center gap-1">
            <FaMusic className="text-slate-400" size={12} />
            {key || "Key N/A"}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm text-gray-300">
          <div className="flex items-center gap-4">
            <button
              onClick={handleLike}
              className={`flex items-center gap-1 ${
                isLiked ? "text-rose-400" : "text-gray-400 hover:text-rose-300"
              }`}
            >
              <FaHeart />
              <span>{localLikesCount || 0}</span>
            </button>
            <span className="flex items-center gap-1 text-gray-400">
              <FaComment />
              <span>{comments_count || 0}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onShare?.(lick_id);
              }}
              disabled={shareLoading || !is_public}
              className={`px-3 py-1 rounded-md text-xs flex items-center gap-1 ${
                shareLoading || !is_public
                  ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                  : "bg-purple-600 hover:bg-purple-700 text-white"
              }`}
            >
              <FaShareAlt />
              Share
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(lick_id);
              }}
              className="px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs"
            >
              Update
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(lick_id);
              }}
              className="px-3 py-1 rounded-md bg-red-600 hover:bg-red-700 text-white text-xs"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyLickCard;

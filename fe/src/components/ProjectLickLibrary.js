// fe/src/components/ProjectLickLibrary.js
// Lick library sidebar for ProjectDetailPage
import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  FaSearch,
  FaFilter,
  FaPlay,
  FaPause,
  FaGripVertical,
} from "react-icons/fa";
import { getCommunityLicks } from "../services/user/lickService";
import { getProfileById } from "../services/user/profile";
import { useDrag } from "react-dnd";

const normalizeLick = (raw) => {
  if (!raw) return null;
  const id = raw._id || raw.id || raw.lick_id;
  const title = raw.title || raw.name || raw.lick_name || "Untitled Lick";
  const duration = Number(raw.duration || raw.length || 2);
  const bpm = Number(raw.bpm || raw.tempo || raw.speed || 0);

  // Extract author/creator info - check multiple possible locations
  let creator = raw.creator || raw.user || raw.author || null;

  // Extract user ID from creator object for fetching profile
  const creatorUserId =
    creator?._id ||
    creator?.user_id ||
    creator?.id ||
    creator?.userId ||
    raw.userId ||
    raw.user_id ||
    null;

  // Extract author name from multiple possible locations
  const authorName =
    creator?.display_name ||
    creator?.displayName ||
    creator?.username ||
    creator?.name ||
    raw.creator_name ||
    raw.author_name ||
    raw.username ||
    (creatorUserId ? null : "Unknown"); // Will be fetched if we have userId

  // If we got a valid name, use it, otherwise it will be fetched
  const finalAuthorName =
    typeof authorName === "string" && authorName.trim() !== ""
      ? authorName
      : creatorUserId
      ? null
      : "Unknown";

  // Extract avatar URL
  const avatarUrl =
    creator?.avatar ||
    creator?.avatar_url ||
    creator?.profilePicture ||
    creator?.profile_picture ||
    creator?.profileImage ||
    raw.avatar ||
    raw.avatar_url ||
    null;

  // Extract tags - handle multiple formats
  let tags = raw.tags || raw.tag || [];
  if (typeof tags === "string") {
    tags = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }
  const tagNames = Array.isArray(tags)
    ? tags
        .map((tag) => {
          if (typeof tag === "string") return tag;
          return tag.tag_name || tag.name || tag.tag || String(tag);
        })
        .filter(Boolean)
    : [];

  return {
    id,
    _id: id,
    title: title.trim() || "Untitled Lick",
    authorName: finalAuthorName || "Unknown",
    creatorUserId, // Store userId for fetching profile
    avatarUrl,
    tags: tagNames,
    key: raw.key || raw.musical_key || "C",
    style: raw.style || raw.genre || "Swing",
    bpm: Number.isFinite(bpm) && bpm > 0 ? Math.round(bpm) : null,
    duration,
    durationLabel: duration ? `${duration.toFixed(1)}s` : "",
    waveformData: raw.waveformData || raw.waveform_data || raw.waveform || null,
    audioUrl:
      raw.audioUrl ||
      raw.audio_url ||
      raw.previewUrl ||
      raw.preview_url ||
      raw.audio ||
      null,
    searchText: `${title} ${finalAuthorName || ""} ${raw.key || ""} ${
      raw.style || ""
    } ${tagNames.join(" ")}`.toLowerCase(),
    original: raw,
  };
};

const MiniWaveform = ({ data }) => {
  const bars = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return [];
    const downsample = Math.min(40, data.length);
    const step = Math.ceil(data.length / downsample);
    return data
      .filter((_, idx) => idx % step === 0)
      .map((value) => Math.max(0.2, Math.min(1, value)));
  }, [data]);

  if (!bars.length) return null;

  return (
    <div className="absolute inset-0 flex items-end gap-[1px] opacity-20 px-2 pb-1 pointer-events-none">
      {bars.map((height, idx) => (
        <div
          key={idx}
          className="w-[2px] flex-1 bg-orange-400 rounded-t-sm"
          style={{ height: `${height * 100}%` }}
        />
      ))}
    </div>
  );
};

function LickRow({ lick, onTogglePlay, isPlaying, onQuickAdd }) {
  const [resolvedAuthor, setResolvedAuthor] = useState(null);
  const [resolvedAvatar, setResolvedAvatar] = useState(null);

  // Fetch author profile if we have userId but author is Unknown
  useEffect(() => {
    let cancelled = false;

    // Get userId from creatorUserId or try to extract from original data
    const userId =
      lick.creatorUserId ||
      lick.original?.userId ||
      lick.original?.user_id ||
      lick.original?.creator?._id ||
      lick.original?.creator?.user_id ||
      lick.original?.creator?.id ||
      lick.original?.user?._id ||
      lick.original?.user?.user_id;

    // Fetch profile if we have userId and author is Unknown/missing or missing avatar
    const needsFetch =
      userId &&
      (lick.authorName === "Unknown" ||
        !lick.authorName ||
        lick.authorName === "Unknown Author" ||
        !lick.avatarUrl);

    if (needsFetch) {
      getProfileById(userId)
        .then((res) => {
          if (cancelled) return;
          const user = res?.data?.user || res?.data;
          if (user) {
            const displayName =
              user.display_name ||
              user.displayName ||
              user.username ||
              user.name;
            const avatar =
              user.avatar ||
              user.avatar_url ||
              user.profilePicture ||
              user.profile_picture;

            if (
              displayName &&
              displayName !== "Unknown" &&
              displayName.trim() !== ""
            ) {
              setResolvedAuthor(displayName);
            }
            if (avatar) {
              setResolvedAvatar(avatar);
            }
          }
        })
        .catch((err) => {
          console.log(
            "Could not fetch author profile for userId:",
            userId,
            err
          );
        });
    }

    return () => {
      cancelled = true;
    };
  }, [lick]);

  const [{ isDragging }, dragRef] = useDrag(
    () => ({
      type: "PROJECT_LICK",
      item: { ...lick },
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    }),
    [lick]
  );

  const displayAuthorName = resolvedAuthor || lick.authorName;
  const displayAvatar = resolvedAvatar || lick.avatarUrl;

  return (
    <div
      ref={dragRef}
      className={`group relative px-2 py-2 rounded-lg cursor-grab transition-colors ${
        isDragging ? "opacity-40" : "opacity-100"
      } hover:bg-gray-900/60`}
    >
      {/* Waveform background - behind everything */}
      {lick.waveformData && (
        <div className="absolute inset-0 opacity-10 pointer-events-none z-0">
          <MiniWaveform data={lick.waveformData} />
        </div>
      )}
      {/* Content grid - above waveform */}
      <div className="grid grid-cols-[16px,1fr,48px,48px,56px,36px] items-start gap-3 text-[11px] text-gray-300 relative z-30 py-1">
        <span className="text-gray-600 group-hover:text-gray-400 mt-1 z-30">
          <FaGripVertical size={10} />
        </span>
        <div className="min-w-0 flex-1 relative z-30 bg-transparent">
          {/* Lick Name - Always show, make it prominent */}
          <p
            className="text-sm font-bold text-white mb-1 leading-tight block"
            style={{
              writingMode: "horizontal-tb",
              textOrientation: "mixed",
              color: "#ffffff",
              textShadow: "0 1px 2px rgba(0,0,0,0.8)",
            }}
            title={lick.title || lick.original?.title}
          >
            {lick.title &&
            lick.title.trim() !== "" &&
            lick.title !== "Untitled Lick"
              ? lick.title
              : lick.original?.title || `${lick.key} ${lick.style}`}
          </p>
          {/* Author Name - Always show below title */}
          <div className="flex items-center gap-1.5 mb-0.5 relative z-30">
            {displayAvatar ? (
              <img
                src={displayAvatar}
                alt={displayAuthorName || "Author"}
                className="w-4 h-4 rounded-full object-cover border border-gray-700 flex-shrink-0"
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />
            ) : (
              <div className="w-4 h-4 rounded-full bg-gray-700 flex items-center justify-center border border-gray-600 flex-shrink-0">
                <span className="text-[8px] text-gray-400">
                  {displayAuthorName &&
                  displayAuthorName !== "Unknown" &&
                  displayAuthorName !== "Unknown Author"
                    ? displayAuthorName.charAt(0).toUpperCase()
                    : "?"}
                </span>
              </div>
            )}
            <span
              className="text-[10px] text-gray-200 font-medium block"
              style={{
                color: "#e5e7eb",
                textShadow: "0 1px 2px rgba(0,0,0,0.8)",
              }}
            >
              {displayAuthorName &&
              displayAuthorName !== "Unknown" &&
              displayAuthorName !== "Unknown Author"
                ? displayAuthorName
                : "Loading..."}
            </span>
          </div>
          {/* Tags Row */}
          {lick.tags && lick.tags.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {lick.tags.slice(0, 2).map((tag, idx) => (
                <span
                  key={idx}
                  className="text-[9px] px-1.5 py-0.5 rounded bg-gray-800/80 text-gray-300 border border-gray-700/50 whitespace-nowrap"
                >
                  {tag}
                </span>
              ))}
              {lick.tags.length > 2 && (
                <span className="text-[9px] text-gray-500">
                  +{lick.tags.length - 2}
                </span>
              )}
            </div>
          )}
        </div>
        <span className="text-center font-mono text-[10px] mt-1">
          {lick.key || "—"}
        </span>
        <span className="text-center font-mono text-[10px] mt-1">
          {lick.bpm ? `${lick.bpm}` : "—"}
        </span>
        <span className="text-center font-mono text-[10px] mt-1">
          {lick.duration ? `${lick.duration.toFixed(1)}s` : "—"}
        </span>
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onTogglePlay?.(lick);
            }}
            className={`w-7 h-7 flex items-center justify-center rounded-full border text-[10px] transition-colors ${
              isPlaying
                ? "bg-orange-600 text-white border-orange-500"
                : "bg-transparent border-gray-700 text-orange-400 hover:bg-orange-500/10"
            }`}
          >
            {isPlaying ? (
              <FaPause size={9} />
            ) : (
              <FaPlay size={9} className="ml-0.5" />
            )}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onQuickAdd?.(lick);
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] px-2 py-1 rounded-md bg-gray-800 text-gray-200 hover:bg-gray-700"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProjectLickLibrary({ initialLicks = [], onLickDrop }) {
  const [licks, setLicks] = useState(
    initialLicks.map((lick) => normalizeLick(lick)).filter(Boolean)
  );
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(!initialLicks.length);
  const [error, setError] = useState(null);
  const [currentPreview, setCurrentPreview] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    if (initialLicks.length) {
      setLicks(initialLicks.map((lick) => normalizeLick(lick)).filter(Boolean));
      setLoading(false);
    }
  }, [initialLicks]);

  useEffect(() => {
    fetchLicks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchLicks = async () => {
    try {
      if (!licks.length) {
        setLoading(true);
      }
      setError(null);
      const response = await getCommunityLicks({
        search: "",
        limit: 30,
        sortBy: "newest",
      });
      const payload =
        response?.data?.licks ||
        response?.data?.items ||
        response?.data ||
        response?.licks ||
        response?.items ||
        [];
      if (Array.isArray(payload) && payload.length) {
        setLicks(payload.map((lick) => normalizeLick(lick)).filter(Boolean));
      } else if (!initialLicks.length) {
        setLicks([]);
      }
    } catch (error) {
      console.error("Failed to fetch licks:", error);
      setError("Unable to load licks right now.");
      if (!initialLicks.length) {
        setLicks([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredLicks = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return licks;
    return licks.filter((lick) => lick.searchText.includes(query));
  }, [licks, search]);

  const handlePreview = async (lick) => {
    if (!lick.audioUrl) return;

    if (currentPreview === lick.audioUrl) {
      audioRef.current?.pause();
      audioRef.current = null;
      setCurrentPreview(null);
      return;
    }

    try {
      audioRef.current?.pause();
      const audio = new Audio(lick.audioUrl);
      audioRef.current = audio;
      setCurrentPreview(lick.audioUrl);
      audio.onended = () => setCurrentPreview(null);
      await audio.play();
    } catch (previewError) {
      console.error("Failed to preview lick audio", previewError);
      setCurrentPreview(null);
    }
  };

  return (
    <div className="w-80 h-full flex flex-col bg-[#05060b] border-r border-gray-900">
      <div className="p-3 border-b border-gray-900 bg-gray-950/70 backdrop-blur">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[11px] uppercase tracking-[0.3em] text-gray-500">
            Lick Vault
          </h3>
          <span className="text-[10px] bg-gray-900 text-gray-300 px-2 py-0.5 rounded-full">
            {licks.length}
          </span>
        </div>
        <div className="relative group">
          <FaSearch
            size={12}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-orange-400 transition-colors"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, author, tags..."
            className="w-full bg-gray-950 border border-gray-850 rounded-lg py-2 pl-8 pr-10 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 transition-colors"
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-orange-400 transition-colors"
            title="Filter options coming soon"
          >
            <FaFilter size={12} />
          </button>
        </div>
      </div>

      <div className="px-3 py-2 text-[10px] uppercase tracking-wide text-gray-500 flex items-center gap-3 border-b border-gray-900 bg-[#070a13]">
        <span className="flex-1">Lick Name</span>
        <span className="w-12 text-center">Key</span>
        <span className="w-12 text-center">BPM</span>
        <span className="w-14 text-center">Length</span>
        <span className="w-9 text-right">Play</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {loading && (
          <div className="text-gray-500 text-center py-8 text-sm">
            Loading...
          </div>
        )}
        {error && !loading && (
          <div className="text-red-400 text-center py-8 text-sm">{error}</div>
        )}
        {!loading && !error && filteredLicks.length === 0 && (
          <div className="text-center py-12 text-xs text-gray-500 opacity-70">
            No licks found
          </div>
        )}
        {!loading &&
          !error &&
          filteredLicks.map((lick, index) => (
            <LickRow
              key={lick._id || lick.id || `lick-${index}`}
              lick={lick}
              onTogglePlay={handlePreview}
              isPlaying={currentPreview === lick.audioUrl}
              onQuickAdd={(selected) => onLickDrop?.(selected)}
            />
          ))}
      </div>
    </div>
  );
}

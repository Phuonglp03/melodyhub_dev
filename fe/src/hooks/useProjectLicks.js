import { useState, useEffect, useCallback } from "react";
import { getCommunityLicks, playLickAudio } from "../services/user/lickService";

const LICKS_PER_PAGE = 10;

/**
 * Hook for managing lick library and search
 */
export const useProjectLicks = () => {
  // Lick library state
  const [availableLicks, setAvailableLicks] = useState([]);
  const [loadingLicks, setLoadingLicks] = useState(false);
  const [lickSearchTerm, setLickSearchTerm] = useState("");
  const [lickPage, setLickPage] = useState(1);
  const [lickHasMore, setLickHasMore] = useState(true);

  // Tag filters for lick search
  const [selectedGenre, setSelectedGenre] = useState(null);
  const [selectedType, setSelectedType] = useState(null); // Type (Instrument)
  const [selectedEmotional, setSelectedEmotional] = useState(null); // Emotional (Mood)
  const [selectedTimbre, setSelectedTimbre] = useState(null);
  const [selectedArticulation, setSelectedArticulation] = useState(null);
  const [selectedCharacter, setSelectedCharacter] = useState(null);

  // Tag groups from database
  const [tagGroups, setTagGroups] = useState({});
  const [activeTagDropdown, setActiveTagDropdown] = useState(null);

  // Lick audio playback state
  const [playingLickId, setPlayingLickId] = useState(null);
  const [lickAudioRefs, setLickAudioRefs] = useState({});
  const [lickProgress, setLickProgress] = useState({});

  // Fetch licks
  const fetchLicks = useCallback(
    async (page = 1, append = false) => {
      setLoadingLicks(true);
      try {
        const activeFilters = [
          selectedGenre,
          selectedType,
          selectedEmotional,
          selectedTimbre,
          selectedArticulation,
          selectedCharacter,
        ].filter(Boolean);

        const response = await getCommunityLicks({
          search: lickSearchTerm,
          tags: activeFilters.join(","),
          limit: LICKS_PER_PAGE,
          page: page,
          sortBy: "newest",
        });

        const licks =
          response?.data?.licks ||
          response?.data?.items ||
          response?.data ||
          response?.licks ||
          response?.items ||
          [];

        if (append) {
          setAvailableLicks((prev) => [
            ...prev,
            ...(Array.isArray(licks) ? licks : []),
          ]);
        } else {
          setAvailableLicks(Array.isArray(licks) ? licks : []);
          setLickPage(1);
        }

        // Check if there are more licks to load
        const total = response?.data?.total || response?.total || 0;
        const currentCount = append
          ? availableLicks.length + licks.length
          : licks.length;
        setLickHasMore(licks.length === LICKS_PER_PAGE && currentCount < total);
      } catch (err) {
        console.error("Error fetching licks:", err);
        if (!append) {
          setAvailableLicks([]);
        }
      } finally {
        setLoadingLicks(false);
      }
    },
    [
      lickSearchTerm,
      selectedGenre,
      selectedType,
      selectedEmotional,
      selectedTimbre,
      selectedArticulation,
      selectedCharacter,
      availableLicks.length,
    ]
  );

  // Load more licks (pagination)
  const loadMoreLicks = useCallback(() => {
    if (!loadingLicks && lickHasMore) {
      const nextPage = lickPage + 1;
      setLickPage(nextPage);
      fetchLicks(nextPage, true);
    }
  }, [loadingLicks, lickHasMore, lickPage, fetchLicks]);

  // Handle lick audio playback
  const handleLickPlayPause = useCallback(
    async (lick, e) => {
      e?.stopPropagation();
      const lickId = lick._id || lick.lick_id || lick.id;

      // If clicking the same lick that's playing, pause it
      if (playingLickId === lickId) {
        const audio = lickAudioRefs[lickId];
        if (audio) {
          audio.pause();
          setPlayingLickId(null);
        }
        return;
      }

      // Stop any currently playing lick
      if (playingLickId && lickAudioRefs[playingLickId]) {
        lickAudioRefs[playingLickId].pause();
        lickAudioRefs[playingLickId].currentTime = 0;
      }

      try {
        // Get audio URL
        const response = await playLickAudio(lickId);
        if (!response.success || !response.data?.audio_url) {
          console.error("No audio URL available");
          return;
        }

        // Create or get audio element
        let audio = lickAudioRefs[lickId];
        if (!audio) {
          audio = new Audio();
          audio.addEventListener("timeupdate", () => {
            if (audio.duration) {
              setLickProgress((prev) => ({
                ...prev,
                [lickId]: audio.currentTime / audio.duration,
              }));
            }
          });
          audio.addEventListener("ended", () => {
            setPlayingLickId(null);
            setLickProgress((prev) => ({
              ...prev,
              [lickId]: 0,
            }));
          });
          setLickAudioRefs((prev) => ({ ...prev, [lickId]: audio }));
        }

        audio.src = response.data.audio_url;
        await audio.play();
        setPlayingLickId(lickId);
      } catch (error) {
        console.error("Error playing lick:", error);
      }
    },
    [playingLickId, lickAudioRefs]
  );

  // Cleanup audio refs on unmount
  useEffect(() => {
    return () => {
      Object.values(lickAudioRefs).forEach((audio) => {
        if (audio) {
          audio.pause();
          audio.src = "";
        }
      });
    };
  }, [lickAudioRefs]);

  return {
    // State
    availableLicks,
    setAvailableLicks,
    loadingLicks,
    setLoadingLicks,
    lickSearchTerm,
    setLickSearchTerm,
    lickPage,
    setLickPage,
    lickHasMore,
    setLickHasMore,

    // Tag filters
    selectedGenre,
    setSelectedGenre,
    selectedType,
    setSelectedType,
    selectedEmotional,
    setSelectedEmotional,
    selectedTimbre,
    setSelectedTimbre,
    selectedArticulation,
    setSelectedArticulation,
    selectedCharacter,
    setSelectedCharacter,

    // Tag groups
    tagGroups,
    setTagGroups,
    activeTagDropdown,
    setActiveTagDropdown,
    tagDropdownRef: null, // Placeholder for compatibility

    // Audio playback
    playingLickId,
    setPlayingLickId,
    lickAudioRefs,
    setLickAudioRefs,
    lickProgress,
    setLickProgress,

    // Operations
    fetchLicks,
    loadMoreLicks,
    handleLickPlayPause,
    LICKS_PER_PAGE,
  };
};

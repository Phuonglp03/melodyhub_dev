import { useEffect, useRef } from "react";

const useTimelineAutosave = ({
  tracks,
  markTimelineItemDirty,
  scheduleTimelineAutosave,
}) => {
  const prevTracksRef = useRef(null);

  useEffect(() => {
    if (!tracks) {
      prevTracksRef.current = tracks;
      return;
    }

    if (!prevTracksRef.current) {
      prevTracksRef.current = tracks;
      return;
    }

    let hasChanges = false;
    const changedItemIds = new Set();

    tracks.forEach((track) => {
      const prevTrack = prevTracksRef.current.find(
        (t) => t && t._id === track?._id
      );
      if (!prevTrack) return;

      (track?.items || []).forEach((item) => {
        const prevItem = (prevTrack.items || []).find(
          (i) => i && i._id === item?._id
        );

        if (!prevItem) {
          changedItemIds.add(item?._id);
          hasChanges = true;
          return;
        }

        if (
          item.startTime !== prevItem.startTime ||
          item.duration !== prevItem.duration ||
          item.offset !== prevItem.offset
        ) {
          changedItemIds.add(item._id);
          hasChanges = true;
        }
      });
    });

    if (hasChanges) {
      changedItemIds.forEach((itemId) => {
        if (itemId && typeof markTimelineItemDirty === "function") {
          markTimelineItemDirty(itemId);
        }
      });
      if (typeof scheduleTimelineAutosave === "function") {
        scheduleTimelineAutosave();
      }
    }

    prevTracksRef.current = tracks;
  }, [tracks, markTimelineItemDirty, scheduleTimelineAutosave]);
};

export default useTimelineAutosave;


import { useEffect } from "react";

const useProjectKeyboardShortcuts = ({
  closeTrackMenu,
  setFocusedClipId,
  focusedClipId,
  resolveChordIndex,
  handleDeleteTimelineItem,
  handleRemoveChord,
}) => {
  // Handle Esc to close menus and clear focus
  useEffect(() => {
    if (!closeTrackMenu || !setFocusedClipId) return;

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        closeTrackMenu();
        setFocusedClipId(null);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [closeTrackMenu, setFocusedClipId]);

  // Handle Delete key to remove chords or clips
  useEffect(() => {
    if (!setFocusedClipId || !handleDeleteTimelineItem || !handleRemoveChord) {
      return;
    }

    const handleKeyDelete = (event) => {
      if (event.key !== "Delete" || !focusedClipId) return;
      event.preventDefault();

      const chordIndex =
        typeof resolveChordIndex === "function"
          ? resolveChordIndex(focusedClipId)
          : null;

      if (chordIndex !== null && chordIndex !== undefined) {
        handleRemoveChord(focusedClipId);
      } else {
        handleDeleteTimelineItem(focusedClipId, { skipConfirm: true });
      }

      setFocusedClipId(null);
    };

    window.addEventListener("keydown", handleKeyDelete);
    return () => window.removeEventListener("keydown", handleKeyDelete);
  }, [
    focusedClipId,
    handleDeleteTimelineItem,
    handleRemoveChord,
    resolveChordIndex,
    setFocusedClipId,
  ]);
};

export default useProjectKeyboardShortcuts;

import { useCallback } from "react";
import { updateTimelineItem } from "../services/user/projectService";

/**
 * Hook for managing MIDI editor operations
 * @param {Object} options - Configuration options
 * @param {string} options.projectId - Project ID
 * @param {Array} options.tracks - Tracks array
 * @param {Function} options.setTracks - Setter for tracks
 * @param {Function} options.broadcast - Function to broadcast to collaborators
 * @param {Function} options.broadcastEditingActivity - Function to broadcast editing activity
 * @param {Function} options.refreshProject - Function to refresh project
 * @param {boolean} options.midiEditorOpen - MIDI editor open state
 * @param {Function} options.setMidiEditorOpen - Setter for MIDI editor open
 * @param {Object} options.editingTimelineItem - Currently editing timeline item
 * @param {Function} options.setEditingTimelineItem - Setter for editing timeline item
 * @returns {Object} MIDI editor handlers
 */
export const useProjectMidiEditor = ({
  projectId,
  tracks,
  setTracks,
  broadcast,
  broadcastEditingActivity,
  refreshProject,
  midiEditorOpen,
  setMidiEditorOpen,
  editingTimelineItem,
  setEditingTimelineItem,
}) => {
  // Handle opening MIDI editor
  const handleOpenMidiEditor = useCallback(
    (timelineItem) => {
      setEditingTimelineItem(timelineItem);
      setMidiEditorOpen(true);

      // Broadcast that we're editing this item
      if (broadcastEditingActivity && timelineItem?._id) {
        broadcastEditingActivity(timelineItem._id, true);
      }
    },
    [setEditingTimelineItem, setMidiEditorOpen, broadcastEditingActivity]
  );

  // Handle closing MIDI editor
  const handleCloseMidiEditor = useCallback(() => {
    // Broadcast that we're done editing
    if (broadcastEditingActivity && editingTimelineItem?._id) {
      broadcastEditingActivity(editingTimelineItem._id, false);
    }

    setMidiEditorOpen(false);
    setEditingTimelineItem(null);
  }, [
    broadcastEditingActivity,
    editingTimelineItem,
    setMidiEditorOpen,
    setEditingTimelineItem,
  ]);

  // Handle saving MIDI edits
  const handleSaveMidiEdit = useCallback(
    async (updatedItem) => {
      try {
        // Optimistic update - update local state immediately
        setTracks((prevTracks) =>
          prevTracks.map((track) => {
            const hasClip = (track.items || []).some(
              (item) => item._id === updatedItem._id
            );
            if (!hasClip) return track;

            return {
              ...track,
              items: (track.items || []).map((item) =>
                item._id === updatedItem._id
                  ? {
                      ...item,
                      customMidiEvents: updatedItem.customMidiEvents,
                      isCustomized: updatedItem.isCustomized,
                    }
                  : item
              ),
            };
          })
        );

        // Broadcast to collaborators immediately (before API call)
        if (broadcast) {
          broadcast("TIMELINE_ITEM_UPDATE", {
            itemId: updatedItem._id,
            customMidiEvents: updatedItem.customMidiEvents,
            isCustomized: updatedItem.isCustomized,
          });
        }

        const response = await updateTimelineItem(projectId, updatedItem._id, {
          customMidiEvents: updatedItem.customMidiEvents,
          isCustomized: updatedItem.isCustomized,
        });

        if (response.success) {
          await refreshProject();
          handleCloseMidiEditor();
        }
      } catch (error) {
        console.error("Error saving MIDI edits:", error);
        alert("Failed to save MIDI edits");
      }
    },
    [
      projectId,
      setTracks,
      broadcast,
      refreshProject,
      handleCloseMidiEditor,
    ]
  );

  return {
    handleOpenMidiEditor,
    handleCloseMidiEditor,
    handleSaveMidiEdit,
  };
};


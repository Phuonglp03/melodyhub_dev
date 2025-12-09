import { useState } from "react";

/**
 * Hook for managing modal state
 * @returns {Object} Modal state and handlers
 */
export const useProjectModals = () => {
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [midiEditorOpen, setMidiEditorOpen] = useState(false);
  const [editingTimelineItem, setEditingTimelineItem] = useState(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiNotification, setAiNotification] = useState(null); // { type: 'success'|'error', message: '' }

  return {
    // Invite modal
    inviteModalOpen,
    setInviteModalOpen,
    // MIDI editor modal
    midiEditorOpen,
    setMidiEditorOpen,
    editingTimelineItem,
    setEditingTimelineItem,
    // AI generation modal
    isGeneratingAI,
    setIsGeneratingAI,
    aiNotification,
    setAiNotification,
  };
};

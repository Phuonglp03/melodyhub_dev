import { useState, useCallback } from "react";

// Constants
export const COLLAPSED_DECK_HEIGHT = 44;
export const MIN_WORKSPACE_SCALE = 0.75;
export const MAX_WORKSPACE_SCALE = 1.1;
export const WORKSPACE_SCALE_STEP = 0.05;

/**
 * Hook for managing UI state (panels, workspace scale, etc.)
 * @returns {Object} UI state and handlers
 */
export const useProjectUI = () => {
  const [sidePanelOpen, setSidePanelOpen] = useState(true); // Bottom panel visibility
  const [sidePanelWidth, setSidePanelWidth] = useState(450); // Bottom panel height (resizable)
  const [workspaceScale, setWorkspaceScale] = useState(0.9); // Overall UI scale

  // Start performance deck resize
  const startPerformanceDeckResize = useCallback(
    (e) => {
      if (!sidePanelOpen) return;
      e.preventDefault();
      const startY = e.clientY;
      const startHeight = sidePanelWidth;

      const handleMouseMove = (moveEvent) => {
        const diff = startY - moveEvent.clientY; // Inverted for bottom panel
        const newHeight = Math.max(200, Math.min(500, startHeight + diff));
        setSidePanelWidth(newHeight);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [sidePanelOpen, sidePanelWidth]
  );

  // Adjust workspace scale
  const adjustWorkspaceScale = useCallback((delta) => {
    setWorkspaceScale((prev) => {
      const next = parseFloat((prev + delta).toFixed(2));
      return Math.min(MAX_WORKSPACE_SCALE, Math.max(MIN_WORKSPACE_SCALE, next));
    });
  }, []);

  return {
    // State
    sidePanelOpen,
    sidePanelWidth,
    workspaceScale,
    // Setters
    setSidePanelOpen,
    setSidePanelWidth,
    setWorkspaceScale,
    // Handlers
    startPerformanceDeckResize,
    adjustWorkspaceScale,
  };
};


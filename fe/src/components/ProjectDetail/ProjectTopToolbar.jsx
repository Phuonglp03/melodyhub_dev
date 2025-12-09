import React from "react";
import { FaTimes, FaUndo, FaRedo } from "react-icons/fa";
import { RiPulseFill } from "react-icons/ri";
import ProjectPlaybackControls from "../AudioControls/ProjectPlaybackControls";
import ProjectSettingsPanel from "../ProjectSettings/ProjectSettingsPanel";
import ProjectExportButton from "../ProjectExportButton";
import CollaborationPanel from "../Collaboration/CollaborationPanel";

const ProjectTopToolbar = ({
  onBack,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSaveTimeline,
  isSavingTimeline,
  hasUnsavedTimelineChanges,
  metronomeEnabled,
  onToggleMetronome,
  zoomLevelDisplay,
  onZoomOut,
  onZoomIn,
  workspaceScalePercentage,
  onWorkspaceScaleDecrease,
  onWorkspaceScaleIncrease,
  canDecreaseWorkspaceScale,
  canIncreaseWorkspaceScale,
  playbackControlsProps,
  settingsPanelProps,
  exportButtonProps,
  collaborationProps,
  projectTitle,
  projectCreatedAt,
  projectTimeSignatureName,
  projectKeyLabel,
  formatDate,
}) => {
  const formattedCreatedAt =
    typeof formatDate === "function" && projectCreatedAt
      ? formatDate(projectCreatedAt)
      : projectCreatedAt || "—";

  const toolbarButtonClasses = (isActive, disabled) =>
    [
      "w-8 h-8 rounded-full flex items-center justify-center text-xs transition-colors",
      disabled
        ? "bg-gray-800 text-gray-500 cursor-not-allowed"
        : isActive
        ? "bg-white text-gray-900"
        : "bg-gray-800 text-gray-200 hover:bg-gray-700",
    ].join(" ");

  return (
    <div className="bg-gray-950 border-b border-gray-800/60 px-4 py-2">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onBack}
            className="h-9 px-3 rounded-full bg-gray-900 text-white text-xs font-medium flex items-center gap-2 hover:bg-gray-800 transition-colors"
          >
            <FaTimes size={12} className="rotate-45" />
            Back
          </button>
          <div className="flex items-center gap-1 bg-gray-900/70 border border-gray-800 rounded-full px-2 py-1">
            <button
              type="button"
              className={toolbarButtonClasses(false, !canUndo)}
              onClick={onUndo}
              disabled={!canUndo}
              title="Undo"
            >
              <FaUndo size={12} />
            </button>
            <button
              type="button"
              className={toolbarButtonClasses(false, !canRedo)}
              onClick={onRedo}
              disabled={!canRedo}
              title="Redo"
            >
              <FaRedo size={12} />
            </button>
            <button
              type="button"
              onClick={onSaveTimeline}
              disabled={isSavingTimeline || !hasUnsavedTimelineChanges}
              className={toolbarButtonClasses(
                hasUnsavedTimelineChanges,
                isSavingTimeline || !hasUnsavedTimelineChanges
              )}
              title="Save timeline changes"
            >
              Save
            </button>
            <span className="text-[10px] uppercase tracking-wide text-gray-400 px-1">
              {isSavingTimeline
                ? "Saving..."
                : hasUnsavedTimelineChanges
                ? "Unsaved"
                : "Synced"}
            </span>
            <button
              type="button"
              className={toolbarButtonClasses(metronomeEnabled, false)}
              onClick={onToggleMetronome}
              title="Metronome"
            >
              <RiPulseFill size={12} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-gray-900/60 border border-gray-800 rounded-full px-2 py-1 text-[11px] text-gray-300">
              <button
                type="button"
                onClick={onZoomOut}
                className="px-2 py-0.5 rounded-full bg-gray-950 hover:bg-gray-800 text-white"
                title="Zoom out"
              >
                −
              </button>
              <span className="min-w-[44px] text-center font-mono">
                {zoomLevelDisplay}%
              </span>
              <button
                type="button"
                onClick={onZoomIn}
                className="px-2 py-0.5 rounded-full bg-gray-950 hover:bg-gray-800 text-white"
                title="Zoom in"
              >
                +
              </button>
            </div>
            <div className="flex items-center gap-1 bg-gray-900/60 border border-gray-800 rounded-full px-2 py-1 text-[11px] text-gray-300">
              <span className="uppercase text-gray-500">Display</span>
              <button
                type="button"
                onClick={onWorkspaceScaleDecrease}
                disabled={!canDecreaseWorkspaceScale}
                className="px-2 py-0.5 rounded-full bg-gray-950 hover:bg-gray-800 text-white disabled:opacity-40"
                title="Scale entire workspace down"
              >
                −
              </button>
              <span className="min-w-[44px] text-center font-mono">
                {workspaceScalePercentage}%
              </span>
              <button
                type="button"
                onClick={onWorkspaceScaleIncrease}
                disabled={!canIncreaseWorkspaceScale}
                className="px-2 py-0.5 rounded-full bg-gray-950 hover:bg-gray-800 text-white disabled:opacity-40"
                title="Scale entire workspace up"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto flex-wrap justify-end">
          <ProjectPlaybackControls {...playbackControlsProps} />
          <ProjectSettingsPanel {...settingsPanelProps} />
          <ProjectExportButton {...exportButtonProps} />
          <CollaborationPanel {...collaborationProps} />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between text-[11px] text-gray-400 mt-2">
        <span>
          {projectTitle} • {formattedCreatedAt}
        </span>
        <span className="flex items-center gap-2">
          <span>Zoom {zoomLevelDisplay}%</span>
          <span>Display {workspaceScalePercentage}%</span>
          <span>{projectTimeSignatureName}</span>
          <span>{projectKeyLabel || "Key"}</span>
        </span>
      </div>
    </div>
  );
};

export default ProjectTopToolbar;

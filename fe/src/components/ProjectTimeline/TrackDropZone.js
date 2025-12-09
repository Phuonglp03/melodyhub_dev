import React from "react";
import { useDrop } from "react-dnd";

/**
 * TrackDropZone - Component to handle react-dnd drops on tracks
 * 
 * Props:
 * - trackId: string - Track ID
 * - track: Object - Track object
 * - timelineRef: Ref - Reference to timeline element
 * - pixelsPerSecond: number - Pixels per second for timeline
 * - secondsPerBeat: number - Seconds per beat
 * - applyMagnet: Function - Function to apply magnetic snapping
 * - handleDrop: Function - Function to handle drop event
 * - setDraggedLick: Function - Setter for dragged lick state
 * - children: ReactNode - Child elements
 * - className?: string - Optional custom classes
 * - style?: Object - Optional custom styles
 */
const TrackDropZone = ({
  trackId,
  track,
  timelineRef,
  pixelsPerSecond,
  secondsPerBeat,
  applyMagnet,
  handleDrop,
  setDraggedLick,
  children,
  className = "",
  style = {},
}) => {
  const [{ isOver }, dropRef] = useDrop(
    () => ({
      accept: "PROJECT_LICK",
      drop: (item, monitor) => {
        if (!timelineRef.current) return;

        const clientOffset = monitor.getClientOffset();
        if (!clientOffset) return;

        const trackRect = timelineRef.current.getBoundingClientRect();
        const scrollLeft = timelineRef.current.scrollLeft || 0;
        const x = clientOffset.x - trackRect.left + scrollLeft;
        const rawTime = Math.max(
          0,
          Math.round(x / pixelsPerSecond / secondsPerBeat) * secondsPerBeat
        );
        const snapped = applyMagnet(rawTime, track, null);

        // Set the dragged lick state so handleDrop can use it
        setDraggedLick(item);

        // Create a synthetic event for handleDrop
        const syntheticEvent = {
          preventDefault: () => {},
        };
        // handleDrop will clear draggedLick when it's done
        handleDrop(syntheticEvent, trackId, snapped).catch((error) => {
          console.error("Error handling drop:", error);
          setDraggedLick(null);
        });
      },
      collect: (monitor) => ({
        isOver: monitor.isOver(),
      }),
    }),
    [
      trackId,
      track,
      timelineRef,
      pixelsPerSecond,
      secondsPerBeat,
      applyMagnet,
      handleDrop,
      setDraggedLick,
    ]
  );

  return (
    <div
      ref={dropRef}
      className={className}
      style={{
        ...style,
        backgroundColor: isOver
          ? "rgba(255,255,255,0.06)"
          : style?.backgroundColor || "transparent",
      }}
    >
      {children}
    </div>
  );
};

export default TrackDropZone;






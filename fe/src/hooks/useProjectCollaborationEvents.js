import { useEffect, useRef } from "react";
import { collabChannel } from "../utils/collabChannel";
import {
  normalizeTimelineItem,
  normalizeTracks,
} from "../utils/timelineHelpers";
import {
  TRACK_COLOR_PALETTE,
  hydrateChordProgression,
} from "../utils/projectHelpers";

/**
 * Hook for handling remote collaboration events
 * @param {Object} options - Configuration options
 * @param {Object} options.project - Project data
 * @param {Function} options.setProject - Setter for project
 * @param {Array} options.collaborators - Current collaborators list
 * @param {Function} options.setCollaborators - Setter for collaborators
 * @param {Function} options.setActiveEditors - Setter for active editors
 * @param {boolean} options.isConnected - Current connection state
 * @param {Function} options.setIsConnected - Setter for connection state
 * @param {Function} options.setTracks - Setter for tracks
 * @param {Function} options.setChordProgression - Setter for chord progression
 * @param {Function} options.saveChordProgression - Function to save chord progression
 * @param {Function} options.setTempoDraft - Setter for tempo draft
 * @param {Function} options.setSwingDraft - Setter for swing draft
 * @param {Object} options.refreshProjectRef - Ref to refresh project function
 * @param {string} options.currentUserId - Current user ID
 * @param {Object} options.currentUserProfile - Current user profile
 * @param {string} options.userRole - Current user role
 * @param {boolean} options.isRemoteUpdateRef - Ref to track if update is remote
 * @returns {void}
 */
export const useProjectCollaborationEvents = ({
  project,
  setProject,
  collaborators,
  setCollaborators,
  setActiveEditors,
  isConnected,
  setIsConnected,
  setTracks,
  setChordProgression,
  saveChordProgression,
  setTempoDraft,
  setSwingDraft,
  refreshProjectRef,
  currentUserId,
  currentUserProfile,
  userRole,
  isRemoteUpdateRef,
}) => {
  useEffect(() => {
    const handleRemoteChordProgression = (payload) => {
      if (isRemoteUpdateRef.current) return;
      isRemoteUpdateRef.current = true;
      const { chords } = payload || {};
      saveChordProgression(chords, true).finally(() => {
        isRemoteUpdateRef.current = false;
      });
    };

    const handleRemoteLickAdd = (payload) => {
      if (isRemoteUpdateRef.current) return;
      const { trackId, item } = payload || {};

      // Optimistically add the item immediately (Google Docs-like)
      if (trackId && item) {
        setTracks((prevTracks) =>
          prevTracks.map((track) =>
            track._id === trackId
              ? {
                  ...track,
                  items: [...(track.items || []), normalizeTimelineItem(item)],
                }
              : track
          )
        );
      }
    };

    const handleRemoteTimelineUpdate = (payload) => {
      if (isRemoteUpdateRef.current) return;
      const {
        itemId,
        customMidiEvents,
        isCustomized,
        updates = {},
      } = payload || {};

      if (!itemId) return;
      console.log("[Collaboration] Remote timeline update:", itemId);

      setTracks((prevTracks) =>
        prevTracks.map((track) => {
          const hasClip = (track.items || []).some(
            (item) => item._id === itemId
          );
          if (!hasClip) return track;

          return {
            ...track,
            items: (track.items || []).map((item) =>
              item._id === itemId
                ? normalizeTimelineItem({
                    ...item,
                    ...updates,
                    customMidiEvents:
                      customMidiEvents !== undefined
                        ? customMidiEvents
                        : item.customMidiEvents,
                    isCustomized:
                      isCustomized !== undefined
                        ? isCustomized
                        : item.isCustomized,
                  })
                : item
            ),
          };
        })
      );
    };

    const handleRemoteTimelineDelete = (payload) => {
      if (isRemoteUpdateRef.current) return;
      const { itemId } = payload || {};
      if (!itemId) return;
      console.log("[Collaboration] Remote timeline delete:", itemId);

      setTracks((prevTracks) =>
        prevTracks.map((track) => ({
          ...track,
          items: (track.items || []).filter((item) => item._id !== itemId),
        }))
      );
    };

    const handleRemoteTimelineBulkUpdate = (payload) => {
      if (isRemoteUpdateRef.current) return;
      const { items } = payload || {};
      if (!Array.isArray(items) || !items.length) return;
      console.log(
        "[Collaboration] Remote timeline bulk update:",
        items.map((item) => item._id)
      );

      setTracks((prevTracks) =>
        prevTracks.map((track) => {
          const updatedItems = (track.items || []).map((item) => {
            const incoming = items.find((entry) => entry._id === item._id);
            if (!incoming) return item;

            return normalizeTimelineItem({
              ...item,
              ...incoming,
            });
          });

          return {
            ...track,
            items: updatedItems,
          };
        })
      );
    };

    const handleRemoteSettingsUpdate = (payload) => {
      if (isRemoteUpdateRef.current) return;
      const {
        tempo,
        swingAmount,
        timeSignature,
        key,
        style,
        backingInstrumentId,
      } = payload || {};

      // Apply settings updates optimistically
      if (project) {
        const updates = {};
        if (tempo !== undefined) updates.tempo = tempo;
        if (swingAmount !== undefined) updates.swingAmount = swingAmount;
        if (timeSignature !== undefined) updates.timeSignature = timeSignature;
        if (key !== undefined) updates.key = key;
        if (style !== undefined) updates.style = style;
        if (backingInstrumentId !== undefined)
          updates.backingInstrumentId = backingInstrumentId;

        if (Object.keys(updates).length > 0) {
          setProject((prev) => (prev ? { ...prev, ...updates } : prev));

          // Update draft values if they exist
          if (tempo !== undefined) setTempoDraft(String(tempo));
          if (swingAmount !== undefined) setSwingDraft(String(swingAmount));
        }
      }
    };

    const handleRemoteTrackAdd = (payload) => {
      if (isRemoteUpdateRef.current) return;
      const { track } = payload || {};
      if (!track) return;
      console.log("[Collaboration] Remote track add received:", track?._id);

      const [normalizedTrack] =
        normalizeTracks([track], TRACK_COLOR_PALETTE) || [];
      if (!normalizedTrack) return;

      setTracks((prev) => {
        const exists = prev.some((t) => t._id === normalizedTrack._id);
        if (exists) {
          return prev.map((t) =>
            t._id === normalizedTrack._id ? { ...t, ...normalizedTrack } : t
          );
        }
        return [...prev, normalizedTrack];
      });
    };

    const handleRemoteTrackUpdate = (payload) => {
      if (isRemoteUpdateRef.current) return;
      const { trackId, updates } = payload || {};

      // Optimistically update track in local state
      if (trackId && updates) {
        setTracks((prevTracks) =>
          prevTracks.map((track) =>
            track._id === trackId ? { ...track, ...updates } : track
          )
        );
      }
    };

    const handleRemoteTrackDelete = (payload) => {
      if (isRemoteUpdateRef.current) return;
      const { trackId } = payload || {};

      // Optimistically remove track from local state
      if (trackId) {
        setTracks((prev) => prev.filter((t) => t._id !== trackId));
      }
    };

    const handleRemoteTimelinePositionUpdate = (payload) => {
      if (isRemoteUpdateRef.current) return;
      const { itemId, updates } = payload || {};

      if (!itemId || !updates) return;

      // Optimistically update timeline item position immediately (Google Docs-like)
      setTracks((prevTracks) =>
        prevTracks.map((track) => {
          const hasClip = (track.items || []).some(
            (item) => item._id === itemId
          );
          if (!hasClip) return track;

          const currentItem = (track.items || []).find(
            (item) => item._id === itemId
          );
          if (!currentItem) return track;

          // Check if update is needed
          const needsUpdate =
            (updates.startTime !== undefined &&
              currentItem.startTime !== updates.startTime) ||
            (updates.duration !== undefined &&
              currentItem.duration !== updates.duration) ||
            (updates.offset !== undefined &&
              currentItem.offset !== updates.offset);

          if (!needsUpdate) return track;

          // Apply updates optimistically
          const updatedItem = {
            ...currentItem,
            ...updates,
          };

          return {
            ...track,
            items: (track.items || []).map((item) =>
              item._id === itemId ? normalizeTimelineItem(updatedItem) : item
            ),
          };
        })
      );
    };

    const handleRemotePresence = (payload) => {
      console.log("[Collaboration] Received presence event:", payload);
      const {
        type,
        collaborators: remoteCollaborators,
        userId: eventUserId,
      } = payload || {};

      const ensureCollaboratorEntry = (list, userId, profile, roleLabel) => {
        if (!userId) return;
        const exists = list.some((entry) => {
          const entryId =
            entry.userId || entry._id || entry.user?._id || entry.user?.id;
          return entryId && String(entryId) === String(userId);
        });
        if (exists) return;
        list.push({
          userId,
          user: profile
            ? {
                _id: profile._id || profile.id || userId,
                displayName: profile.displayName || profile.username || "",
                username: profile.username,
                avatarUrl: profile.avatarUrl,
                email: profile.email,
              }
            : undefined,
          role: roleLabel,
          status: "accepted",
        });
      };

      const normalizeCollaborators = (list = []) => {
        // Start with the remote collaborators list
        const next = Array.isArray(list) ? [...list] : [];

        // Normalize each collaborator entry to ensure consistent structure
        const normalized = next.map((collab) => {
          const userId =
            collab.userId || collab._id || collab.user?._id || collab.user?.id;
          return {
            userId,
            user: collab.user
              ? {
                  _id: collab.user._id || collab.user.id || userId,
                  displayName:
                    collab.user.displayName || collab.user.username || "",
                  username: collab.user.username,
                  avatarUrl: collab.user.avatarUrl,
                  email: collab.user.email,
                }
              : undefined,
            role: collab.role || "collaborator",
            status: collab.status || "accepted",
          };
        });

        // Ensure owner is included if they exist
        const ownerProfile = project?.creatorId;
        const ownerId =
          ownerProfile?._id || ownerProfile?.id || project?.creatorId;
        if (ownerId) {
          ensureCollaboratorEntry(normalized, ownerId, ownerProfile, "owner");
        }

        // Ensure current user is included
        if (currentUserId) {
          ensureCollaboratorEntry(
            normalized,
            currentUserId,
            currentUserProfile,
            userRole || "collaborator"
          );
        }

        return normalized;
      };

      // Handle different presence event types
      if (type === "SYNC" || type === "JOIN") {
        if (remoteCollaborators && Array.isArray(remoteCollaborators)) {
          console.log(
            "[Collaboration] SYNC/JOIN - Setting collaborators:",
            remoteCollaborators
          );
          const normalized = normalizeCollaborators(remoteCollaborators);
          console.log("[Collaboration] Normalized collaborators:", normalized);
          setCollaborators(normalized);
        } else {
          console.warn(
            "[Collaboration] SYNC/JOIN event but no remoteCollaborators array provided",
            { remoteCollaborators, type }
          );
        }
      } else if (type === "LEAVE") {
        if (eventUserId) {
          console.log("[Collaboration] LEAVE - Removing user:", eventUserId);
          setCollaborators((prev) => {
            const filtered = prev.filter((c) => {
              const collaboratorId =
                c.userId || c._id || c.user?._id || c.user?.id;
              return (
                collaboratorId && String(collaboratorId) !== String(eventUserId)
              );
            });
            console.log("[Collaboration] After LEAVE filter:", filtered);
            return filtered;
          });
        }
      } else if (remoteCollaborators && Array.isArray(remoteCollaborators)) {
        // Handle any other presence event with collaborators list
        // This catches cases where server sends presence without explicit type
        console.log(
          "[Collaboration] Presence event (no type or other) - Setting collaborators:",
          remoteCollaborators
        );
        const normalized = normalizeCollaborators(remoteCollaborators);
        console.log("[Collaboration] Normalized collaborators:", normalized);
        setCollaborators(normalized);
      } else if (!type && !remoteCollaborators) {
        // If payload is empty or malformed, log but don't update
        console.warn(
          "[Collaboration] Presence event received but payload is empty or malformed:",
          payload
        );
      } else {
        // Log unexpected cases for debugging
        console.warn("[Collaboration] Unexpected presence event format:", {
          type,
          remoteCollaborators,
          eventUserId,
          payload,
        });
      }
    };

    const handleRemoteConnection = (payload) => {
      const { connected } = payload || {};
      setIsConnected(connected);
    };

    const handleRemoteEditingActivity = (payload) => {
      if (isRemoteUpdateRef.current) return;
      const { userId, itemId, isEditing } = payload || {};

      if (!userId || !itemId) return;

      setActiveEditors((prev) => {
        const next = new Map(prev);

        if (isEditing) {
          // Find user info from collaborators
          // Handle userId as object with _id or as direct string
          // Also check if userId matches the string representation
          const collaborator = collaborators.find((c) => {
            const collaboratorId =
              c.userId?._id || c.userId || c._id || c.user?._id || c.user?.id;
            // Compare both as strings to handle ObjectId vs string mismatches
            return collaboratorId && String(collaboratorId) === String(userId);
          });

          if (collaborator) {
            // Extract user info from various possible structures
            const userInfo = collaborator.user || collaborator.userId || {};
            const editorInfo = {
              userId: String(userId), // Ensure userId is a string
              userName:
                userInfo.displayName ||
                userInfo.username ||
                collaborator.user?.displayName ||
                collaborator.user?.username ||
                collaborator.userId?.displayName ||
                collaborator.userId?.username ||
                "Someone",
              avatarUrl:
                userInfo.avatarUrl ||
                collaborator.user?.avatarUrl ||
                collaborator.userId?.avatarUrl,
            };
            next.set(itemId, editorInfo);
            console.log("[Collaboration] Active editor added:", {
              itemId,
              userId,
              userName: editorInfo.userName,
              collaboratorFound: true,
            });
          } else {
            // Collaborator not found in list yet - create a temporary entry
            // This can happen if editing activity arrives before presence sync
            // We'll update it when collaborators are synced
            const editorInfo = {
              userId: String(userId),
              userName: "Someone",
              avatarUrl: undefined,
            };
            next.set(itemId, editorInfo);
            console.log(
              "[Collaboration] Active editor added (temp - collaborator not in list yet):",
              {
                itemId,
                userId,
                collaboratorsCount: collaborators.length,
                collaboratorIds: collaborators.map((c) => ({
                  id:
                    c.userId?._id ||
                    c.userId ||
                    c._id ||
                    c.user?._id ||
                    c.user?.id,
                  type: typeof (
                    c.userId?._id ||
                    c.userId ||
                    c._id ||
                    c.user?._id ||
                    c.user?.id
                  ),
                })),
              }
            );
          }
        } else {
          // Remove editing indicator - compare as strings
          const current = next.get(itemId);
          if (current && String(current.userId) === String(userId)) {
            next.delete(itemId);
            console.log("[Collaboration] Active editor removed:", {
              itemId,
              userId,
            });
          }
        }

        return next;
      });
    };

    const handleRemoteCursor = (payload) => {
      const { userId, sectionId, barIndex, x, y } = payload || {};
      if (!userId) return;

      // Update collaborator's cursor position
      setCollaborators((prev) =>
        prev.map((collab) => {
          const collaboratorId =
            collab.userId || collab._id || collab.user?._id || collab.user?.id;
          if (collaboratorId && String(collaboratorId) === String(userId)) {
            // If barIndex is null, clear the cursor
            if (barIndex === null || barIndex === undefined) {
              return {
                ...collab,
                cursor: undefined,
              };
            }
            return {
              ...collab,
              cursor: {
                sectionId,
                barIndex,
                position:
                  x !== undefined && y !== undefined ? { x, y } : undefined,
                lastUpdate: Date.now(),
              },
            };
          }
          return collab;
        })
      );
    };

    const handleRemoteSnapshot = (snapshot) => {
      if (!snapshot) {
        if (typeof refreshProjectRef.current === "function") {
          refreshProjectRef.current(false);
        }
        return;
      }

      const { project: snapshotProject, tracks: snapshotTracks } = snapshot;

      if (snapshotProject) {
        setProject((prev) => ({
          ...(prev || {}),
          ...snapshotProject,
        }));

        if (snapshotProject.chordProgression) {
          setChordProgression(
            hydrateChordProgression(snapshotProject.chordProgression)
          );
        }

        if (snapshotProject.tempo !== undefined) {
          setTempoDraft(String(snapshotProject.tempo));
        }

        if (snapshotProject.swingAmount !== undefined) {
          setSwingDraft(String(snapshotProject.swingAmount));
        }
      }

      if (Array.isArray(snapshotTracks)) {
        const normalizedTracks = normalizeTracks(
          snapshotTracks,
          TRACK_COLOR_PALETTE
        );
        setTracks(normalizedTracks);
      } else if (typeof refreshProjectRef.current === "function") {
        refreshProjectRef.current(false);
      }
    };

    const unsubscribers = [
      collabChannel.on(
        "project:remote:chordProgression",
        handleRemoteChordProgression
      ),
      collabChannel.on("project:remote:lickAdd", handleRemoteLickAdd),
      collabChannel.on(
        "project:remote:timelineUpdate",
        handleRemoteTimelineUpdate
      ),
      collabChannel.on(
        "project:remote:timelineDelete",
        handleRemoteTimelineDelete
      ),
      collabChannel.on(
        "project:remote:settingsUpdate",
        handleRemoteSettingsUpdate
      ),
      collabChannel.on("project:remote:trackAdd", handleRemoteTrackAdd),
      collabChannel.on("project:remote:trackUpdate", handleRemoteTrackUpdate),
      collabChannel.on("project:remote:trackDelete", handleRemoteTrackDelete),
      collabChannel.on(
        "project:remote:timelineBulkUpdate",
        handleRemoteTimelineBulkUpdate
      ),
      collabChannel.on(
        "project:remote:timelinePositionUpdate",
        handleRemoteTimelinePositionUpdate
      ),
      collabChannel.on("project:remote:presence", handleRemotePresence),
      collabChannel.on("project:remote:connection", handleRemoteConnection),
      collabChannel.on(
        "project:remote:editingActivity",
        handleRemoteEditingActivity
      ),
      collabChannel.on("project:remote:cursor", handleRemoteCursor),
      collabChannel.on("project:remote:snapshot", handleRemoteSnapshot),
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe && unsubscribe());
    };
  }, [
    collaborators,
    setTracks,
    setChordProgression,
    saveChordProgression,
    setTempoDraft,
    setSwingDraft,
    setProject,
    refreshProjectRef,
    project?.creatorId?._id,
    currentUserId,
    userRole,
    currentUserProfile,
    setCollaborators,
    setActiveEditors,
    setIsConnected,
    isRemoteUpdateRef,
  ]);

  // Cleanup stale cursors (remove cursors that haven't updated in 2 seconds)
  // This must be a separate useEffect at the top level, not inside the event handler useEffect
  useEffect(() => {
    const interval = setInterval(() => {
      setCollaborators((prev) =>
        prev.map((collab) => {
          if (collab.cursor?.lastUpdate) {
            const age = Date.now() - collab.cursor.lastUpdate;
            if (age > 2000) {
              // Remove cursor if older than 2 seconds
              return {
                ...collab,
                cursor: undefined,
              };
            }
          }
          return collab;
        })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [setCollaborators]);

  // Update activeEditors when collaborators list changes
  // This ensures we have proper user info for editors that were added before collaborators synced
  useEffect(() => {
    if (collaborators.length === 0) return;

    setActiveEditors((prev) => {
      const next = new Map(prev);
      let updated = false;

      // Update any editors that have temporary "Someone" names
      next.forEach((editorInfo, itemId) => {
        const collaborator = collaborators.find((c) => {
          const collaboratorId =
            c.userId?._id || c.userId || c._id || c.user?._id || c.user?.id;
          return (
            collaboratorId &&
            String(collaboratorId) === String(editorInfo.userId)
          );
        });

        if (collaborator && editorInfo.userName === "Someone") {
          const userInfo = collaborator.user || collaborator.userId || {};
          next.set(itemId, {
            ...editorInfo,
            userName:
              userInfo.displayName ||
              userInfo.username ||
              collaborator.user?.displayName ||
              collaborator.user?.username ||
              collaborator.userId?.displayName ||
              collaborator.userId?.username ||
              "Someone",
            avatarUrl:
              userInfo.avatarUrl ||
              collaborator.user?.avatarUrl ||
              collaborator.userId?.avatarUrl,
          });
          updated = true;
        }
      });

      return updated ? next : prev;
    });
  }, [collaborators, setActiveEditors]);

  // Request presence if we're connected but have no collaborators
  // This handles cases where the server doesn't automatically send presence on join
  useEffect(() => {
    if (!isConnected || !currentUserId) return;

    // If we have no collaborators after being connected for 1 second, request presence
    const timeout = setTimeout(() => {
      if (collaborators.length === 0) {
        console.log(
          "[Collaboration] No collaborators after connection, requesting presence"
        );
        // Emit through collabChannel to request presence
        collabChannel.emit("project:presence:request", {});
      }
    }, 1000);

    return () => clearTimeout(timeout);
  }, [isConnected, currentUserId, collaborators.length]);
};

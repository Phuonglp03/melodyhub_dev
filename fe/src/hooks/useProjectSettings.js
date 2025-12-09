import { useState, useEffect, useCallback, useMemo } from "react";
import {
  updateProject,
  getInstruments,
  getRhythmPatterns,
} from "../services/user/projectService";
import {
  normalizeKeyPayload,
  normalizeTimeSignaturePayload,
  clampSwingAmount,
} from "../utils/musicTheory";

/**
 * Hook for managing project settings (tempo, key, time signature, instruments, etc.)
 * @param {string} projectId - Project ID
 * @param {Object} project - Project object
 * @param {Function} setProject - Project setter
 * @param {Function} broadcast - Collaboration broadcast function
 * @param {Function} refreshProject - Function to refresh project data
 */
export const useProjectSettings = ({
  projectId,
  project,
  setProject,
  broadcast,
  refreshProject,
}) => {
  // Settings state
  const [tempoDraft, setTempoDraft] = useState("120");
  const [swingDraft, setSwingDraft] = useState("0");
  const [instruments, setInstruments] = useState([]);
  const [loadingInstruments, setLoadingInstruments] = useState(false);
  const [selectedInstrumentId, setSelectedInstrumentId] = useState(null);
  const [rhythmPatterns, setRhythmPatterns] = useState([]);
  const [loadingRhythmPatterns, setLoadingRhythmPatterns] = useState(false);
  const [selectedRhythmPatternId, setSelectedRhythmPatternId] = useState(null);

  // Computed values
  const normalizedProjectKey = useMemo(
    () => normalizeKeyPayload(project?.key),
    [project?.key]
  );
  const projectKeyName = normalizedProjectKey.name;
  const normalizedTimeSignature = useMemo(
    () => normalizeTimeSignaturePayload(project?.timeSignature),
    [project?.timeSignature]
  );
  const projectTimeSignatureName = normalizedTimeSignature.name;
  const projectSwingAmount = useMemo(
    () => clampSwingAmount(project?.swingAmount ?? 0),
    [project?.swingAmount]
  );
  const bpm = project?.tempo || 120;

  // Sync draft values with project
  useEffect(() => {
    setTempoDraft(String(project?.tempo || 120));
  }, [project?.tempo]);

  useEffect(() => {
    setSwingDraft(String(projectSwingAmount));
  }, [projectSwingAmount]);

  // Fetch instruments
  const fetchInstruments = useCallback(async () => {
    try {
      setLoadingInstruments(true);
      const response = await getInstruments();
      if (response.success) {
        setInstruments(response.data || []);
      }
    } catch (err) {
      console.error("Error fetching instruments:", err);
    } finally {
      setLoadingInstruments(false);
    }
  }, []);

  // Fetch rhythm patterns
  const fetchRhythmPatterns = useCallback(async () => {
    try {
      setLoadingRhythmPatterns(true);
      const response = await getRhythmPatterns();
      if (response.success) {
        setRhythmPatterns(response.data || []);
      }
    } catch (err) {
      console.error("Error fetching rhythm patterns:", err);
    } finally {
      setLoadingRhythmPatterns(false);
    }
  }, []);

  // Commit tempo change
  const commitTempoChange = useCallback(async () => {
    if (!project) return;
    const parsed = parseInt(tempoDraft, 10);
    if (Number.isNaN(parsed)) {
      setTempoDraft(String(project.tempo || 120));
      return;
    }
    const tempo = Math.min(300, Math.max(40, parsed));
    if (tempo === project.tempo) {
      setTempoDraft(String(project.tempo || tempo));
      return;
    }
    setProject((prev) => (prev ? { ...prev, tempo } : prev));
    try {
      await updateProject(projectId, { tempo });

      // Broadcast to collaborators
      if (broadcast) {
        broadcast("PROJECT_SETTINGS_UPDATE", { tempo });
      }
    } catch (err) {
      console.error("Error updating tempo:", err);
      if (refreshProject) refreshProject();
    }
  }, [project, tempoDraft, projectId, setProject, broadcast, refreshProject]);

  // Commit swing change
  const commitSwingChange = useCallback(async () => {
    if (!project) return;
    const parsed = clampSwingAmount(swingDraft);
    if (parsed === clampSwingAmount(project.swingAmount ?? 0)) {
      setSwingDraft(String(parsed));
      return;
    }
    setProject((prev) => (prev ? { ...prev, swingAmount: parsed } : prev));
    try {
      await updateProject(projectId, { swingAmount: parsed });

      // Broadcast to collaborators
      if (broadcast) {
        broadcast("PROJECT_SETTINGS_UPDATE", { swingAmount: parsed });
      }
    } catch (err) {
      console.error("Error updating swing amount:", err);
      if (refreshProject) refreshProject();
    }
  }, [project, swingDraft, projectId, setProject, broadcast, refreshProject]);

  // Handle time signature change
  const handleTimeSignatureChange = useCallback(
    async (value) => {
      if (!project || !value) return;
      const normalized = normalizeTimeSignaturePayload(value);
      const current = normalizeTimeSignaturePayload(project.timeSignature);
      const isSame =
        current.numerator === normalized.numerator &&
        current.denominator === normalized.denominator;
      if (isSame) return;
      setProject((prev) =>
        prev ? { ...prev, timeSignature: normalized } : prev
      );
      try {
        await updateProject(projectId, { timeSignature: normalized });

        // Broadcast to collaborators
        if (broadcast) {
          broadcast("PROJECT_SETTINGS_UPDATE", { timeSignature: normalized });
        }
      } catch (err) {
        console.error("Error updating time signature:", err);
        if (refreshProject) refreshProject();
      }
    },
    [project, projectId, setProject, broadcast, refreshProject]
  );

  // Handle key change
  const handleKeyChange = useCallback(
    async (value) => {
      if (!project || !value) return;
      const normalized = normalizeKeyPayload(value);
      const current = normalizeKeyPayload(project.key);
      const isSame =
        current.root === normalized.root && current.scale === normalized.scale;
      if (isSame) return;
      setProject((prev) => (prev ? { ...prev, key: normalized } : prev));
      try {
        await updateProject(projectId, { key: normalized });

        // Broadcast to collaborators
        if (broadcast) {
          broadcast("PROJECT_SETTINGS_UPDATE", { key: normalized });
        }
      } catch (err) {
        console.error("Error updating key:", err);
        if (refreshProject) refreshProject();
      }
    },
    [project, projectId, setProject, broadcast, refreshProject]
  );

  return {
    // State
    tempoDraft,
    setTempoDraft,
    swingDraft,
    setSwingDraft,
    instruments,
    loadingInstruments,
    selectedInstrumentId,
    setSelectedInstrumentId,
    rhythmPatterns,
    loadingRhythmPatterns,
    selectedRhythmPatternId,
    setSelectedRhythmPatternId,

    // Computed
    bpm,
    projectKeyName,
    projectTimeSignatureName,
    projectSwingAmount,
    normalizedProjectKey,
    normalizedTimeSignature,

    // Operations
    fetchInstruments,
    fetchRhythmPatterns,
    commitTempoChange,
    commitSwingChange,
    handleTimeSignatureChange,
    handleKeyChange,
  };
};

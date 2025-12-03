import CollabSnapshot from "../models/CollabSnapshot.js";
import { getRedisClient } from "../config/redisClient.js";
import { recordCollabMetric } from "../utils/collabMetrics.js";

const COLLAb_KEY = (projectId) => `collab:project:${projectId}`;
const OPS_KEY = (projectId) => `collab:project:${projectId}:ops`;
const SNAPSHOT_SCHEDULE_MS =
  Number(process.env.COLLAB_SNAPSHOT_INTERVAL_MS) || 10000;
const MAX_OPS =
  Number(process.env.COLLAB_MAX_OPS) && Number(process.env.COLLAB_MAX_OPS) > 0
    ? Number(process.env.COLLAB_MAX_OPS)
    : 200;

const pendingSnapshotTimers = new Map();

const scheduleSnapshotPersist = (projectId, state) => {
  if (!state?.snapshot) return; // nothing to persist

  if (pendingSnapshotTimers.has(projectId)) {
    clearTimeout(pendingSnapshotTimers.get(projectId).timer);
  }

  const timer = setTimeout(async () => {
    pendingSnapshotTimers.delete(projectId);
    try {
      await CollabSnapshot.findOneAndUpdate(
        { projectId },
        {
          projectId,
          version: state.version,
          snapshot: state.snapshot,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (err) {
      console.error("[CollabState] Failed to persist snapshot:", err.message);
    }
  }, SNAPSHOT_SCHEDULE_MS);

  pendingSnapshotTimers.set(projectId, { timer });
};

const parseStateRecord = (record) => {
  if (!record || Object.keys(record).length === 0) {
    return null;
  }
  return {
    version: Number(record.version) || 0,
    updatedAt: record.updatedAt ? Number(record.updatedAt) : Date.now(),
    snapshot: record.snapshot ? JSON.parse(record.snapshot) : null,
  };
};

const writeStateRecord = async (client, projectId, state) => {
  const payload = {
    version: state.version.toString(),
    updatedAt: state.updatedAt.toString(),
  };
  if (state.snapshot) {
    payload.snapshot = JSON.stringify(state.snapshot);
  }
  const started = Date.now();
  await client.hSet(COLLAb_KEY(projectId), payload);
  recordCollabMetric("redis_state_write", {
    projectId,
    ms: Date.now() - started,
  });
};

export const getCollabState = async (projectId) => {
  if (!projectId) throw new Error("projectId is required");
  const client = await getRedisClient();
  const record = await client.hGetAll(COLLAb_KEY(projectId));
  if (record && Object.keys(record).length) {
    return parseStateRecord(record);
  }

  // fallback to Mongo snapshot
  const snapshotDoc = await CollabSnapshot.findOne({ projectId })
    .select("version snapshot updatedAt")
    .lean();
  if (!snapshotDoc) {
    return { version: 0, updatedAt: Date.now(), snapshot: null };
  }

  const fallbackState = {
    version: snapshotDoc.version || 0,
    updatedAt: snapshotDoc.updatedAt?.getTime() || Date.now(),
    snapshot: snapshotDoc.snapshot || null,
  };

  await writeStateRecord(client, projectId, fallbackState);
  return fallbackState;
};

export const getMissingOps = async (projectId, fromVersion = 0) => {
  if (!projectId) throw new Error("projectId is required");
  const client = await getRedisClient();
  const rawOps = await client.lRange(OPS_KEY(projectId), 0, MAX_OPS);
  const ops = rawOps
    .map((entry) => {
      try {
        return JSON.parse(entry);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.version - b.version);

  return ops.filter((op) => op.version > fromVersion);
};

export const applyOperation = async (projectId, op, options = {}) => {
  if (!projectId) throw new Error("projectId is required");
  if (!op || typeof op !== "object" || !op.type) {
    throw new Error("Invalid operation payload");
  }

  const client = await getRedisClient();
  const currentState = await getCollabState(projectId);
  const nextVersion = currentState.version + 1;

  const opEntry = {
    version: nextVersion,
    type: op.type,
    payload: op.payload || op.data || {},
    senderId: options.senderId || null,
    timestamp: Date.now(),
    collabOpId: options.collabOpId || op.collabOpId || null,
  };

  const snapshot =
    options.snapshot !== undefined ? options.snapshot : currentState.snapshot;

  const nextState = {
    version: nextVersion,
    updatedAt: opEntry.timestamp,
    snapshot,
  };

  await writeStateRecord(client, projectId, nextState);
  const pushStarted = Date.now();
  await client.lPush(OPS_KEY(projectId), JSON.stringify(opEntry));
  recordCollabMetric("redis_op_push", {
    projectId,
    ms: Date.now() - pushStarted,
  });
  const trimStarted = Date.now();
  await client.lTrim(OPS_KEY(projectId), 0, MAX_OPS - 1);
  recordCollabMetric("redis_op_trim", {
    projectId,
    ms: Date.now() - trimStarted,
    maxOps: MAX_OPS,
  });

  if (snapshot) {
    scheduleSnapshotPersist(projectId, nextState);
  }

  recordCollabMetric("op_applied", {
    projectId,
    type: op.type,
    version: nextVersion,
  });

  return {
    version: nextVersion,
    op: opEntry,
  };
};

export const setSnapshot = async (projectId, snapshot, version = null) => {
  if (!projectId) throw new Error("projectId is required");
  const client = await getRedisClient();
  const currentState = await getCollabState(projectId);
  const nextState = {
    version: typeof version === "number" ? version : currentState.version,
    updatedAt: Date.now(),
    snapshot,
  };
  await writeStateRecord(client, projectId, nextState);
  scheduleSnapshotPersist(projectId, nextState);
  return nextState;
};

export const clearCollabState = async (projectId) => {
  if (!projectId) return;
  const client = await getRedisClient();
  await client.del(COLLAb_KEY(projectId));
  await client.del(OPS_KEY(projectId));
  pendingSnapshotTimers.delete(projectId);
};


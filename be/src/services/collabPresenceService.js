import { getRedisClient } from "../config/redisClient.js";

const PRESENCE_KEY = (projectId) => `collab:project:${projectId}:presence`;
const PRESENCE_TTL_SEC = Number(process.env.COLLAB_PRESENCE_TTL_SECONDS) || 45;

const serialize = (value) => JSON.stringify(value);
const deserialize = (value) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

export const addCollaboratorPresence = async (
  projectId,
  userId,
  payload,
  socketId
) => {
  if (!projectId || !userId) return;
  try {
    const client = await getRedisClient();
    const key = PRESENCE_KEY(projectId);
    const existingRaw = await client.hGet(key, userId);
    const existing = deserialize(existingRaw) || {
      userId,
      sockets: [],
      cursor: null,
      lastHeartbeat: Date.now(),
    };

    const sockets = new Set(existing.sockets || []);
    sockets.add(socketId);

    const record = {
      ...existing,
      user: payload,
      sockets: Array.from(sockets),
      lastHeartbeat: Date.now(),
    };

    await client.hSet(key, userId, serialize(record));
    await client.expire(key, PRESENCE_TTL_SEC);
    console.log(
      `[CollabPresence] Added presence for user ${userId} in project ${projectId}, socket ${socketId}`
    );
    return record;
  } catch (err) {
    console.error(
      `[CollabPresence] addCollaboratorPresence error for project ${projectId}, user ${userId}:`,
      err.message
    );
    // Return a minimal record even if Redis fails
    return {
      userId,
      user: payload,
      sockets: [socketId],
      cursor: null,
      lastHeartbeat: Date.now(),
    };
  }
};

export const removeCollaboratorPresence = async (
  projectId,
  userId,
  socketId
) => {
  if (!projectId || !userId) return;
  const client = await getRedisClient();
  const key = PRESENCE_KEY(projectId);
  const existingRaw = await client.hGet(key, userId);
  if (!existingRaw) return null;
  const existing = deserialize(existingRaw);
  if (!existing) {
    await client.hDel(key, userId);
    return null;
  }

  const sockets = new Set(existing.sockets || []);
  if (socketId) {
    sockets.delete(socketId);
  }

  if (!sockets.size) {
    await client.hDel(key, userId);
    return null;
  }

  const record = {
    ...existing,
    sockets: Array.from(sockets),
    lastHeartbeat: Date.now(),
  };
  await client.hSet(key, userId, serialize(record));
  return record;
};

export const listCollaborators = async (projectId) => {
  if (!projectId) return [];
  try {
    const client = await getRedisClient();
    const key = PRESENCE_KEY(projectId);
    const rawEntries = await client.hGetAll(key);
    if (!rawEntries || !Object.keys(rawEntries).length) {
      console.log(
        `[CollabPresence] listCollaborators - No entries found for project ${projectId}`
      );
      return [];
    }
    const collaborators = Object.values(rawEntries)
      .map(deserialize)
      .filter(Boolean)
      .map((entry) => ({
        userId: entry.userId,
        user: entry.user,
        cursor: entry.cursor,
        lastHeartbeat: entry.lastHeartbeat,
      }));
    console.log(
      `[CollabPresence] listCollaborators - Found ${collaborators.length} collaborators for project ${projectId}:`,
      collaborators.map((c) => ({
        userId: c.userId,
        username: c.user?.username,
      }))
    );
    return collaborators;
  } catch (err) {
    console.error(
      `[CollabPresence] listCollaborators error for project ${projectId}:`,
      err.message
    );
    return [];
  }
};

export const updateCursorPosition = async (projectId, userId, cursor) => {
  if (!projectId || !userId) return;
  const client = await getRedisClient();
  const key = PRESENCE_KEY(projectId);
  const existingRaw = await client.hGet(key, userId);
  if (!existingRaw) return null;
  const existing = deserialize(existingRaw);
  if (!existing) return null;
  const record = {
    ...existing,
    cursor,
    lastHeartbeat: Date.now(),
  };
  await client.hSet(key, userId, serialize(record));
  return record;
};

export const heartbeatPresence = async (projectId, userId) => {
  if (!projectId || !userId) return;
  const client = await getRedisClient();
  const key = PRESENCE_KEY(projectId);
  const existingRaw = await client.hGet(key, userId);
  if (!existingRaw) return null;
  const existing = deserialize(existingRaw);
  if (!existing) return null;
  const record = {
    ...existing,
    lastHeartbeat: Date.now(),
  };
  await client.hSet(key, userId, serialize(record));
  await client.expire(key, PRESENCE_TTL_SEC);
  return record;
};

export const cleanupStalePresence = async () => {
  const client = await getRedisClient();
  const now = Date.now();
  const pattern = "collab:project:*:presence";
  let cursor = 0;
  do {
    const [nextCursor, keys] = await client.scan(cursor, {
      MATCH: pattern,
      COUNT: 50,
    });
    cursor = Number(nextCursor);
    if (keys.length) {
      await Promise.all(
        keys.map(async (key) => {
          const entries = await client.hGetAll(key);
          const removals = [];
          for (const [userId, raw] of Object.entries(entries)) {
            const parsed = deserialize(raw);
            if (!parsed) {
              removals.push(userId);
              continue;
            }
            if (now - (parsed.lastHeartbeat || 0) > PRESENCE_TTL_SEC * 1000) {
              removals.push(userId);
            }
          }
          if (removals.length) {
            await client.hDel(key, removals);
          }
        })
      );
    }
  } while (cursor !== 0);
};

const CLEANUP_INTERVAL_MS =
  Number(process.env.COLLAB_PRESENCE_CLEANUP_MS) || 60000;

if (typeof global !== "undefined") {
  const globalKey = "__collab_presence_cleanup_interval";
  if (!global[globalKey]) {
    global[globalKey] = setInterval(() => {
      cleanupStalePresence().catch((err) =>
        console.error("[CollabPresence] cleanup error:", err.message)
      );
    }, CLEANUP_INTERVAL_MS);
  }
}

import { createClient } from "redis";

let redisClient = null;
let connectPromise = null;
let redisEnabled = true;
let connectionFailed = false;

const getRedisUrl = () => process.env.REDIS_URL || "";

// Check if Redis is explicitly disabled or no URL provided
const isRedisDisabled = () => {
  const disabled = process.env.REDIS_ENABLED === "false" || 
                   process.env.REDIS_ENABLED === "0" ||
                   process.env.DISABLE_REDIS === "true";
  const noUrl = !getRedisUrl();
  
  if (disabled) {
    console.log("[Redis] Redis explicitly disabled via environment variable");
    return true;
  }
  if (noUrl) {
    console.log("[Redis] No REDIS_URL provided, Redis disabled");
    return true;
  }
  return false;
};

const createRedisClient = () => {
  const url = getRedisUrl();
  console.log("[Redis] Creating client with URL:", url ? url.replace(/\/\/.*@/, "//*****@") : "(empty)");
  
  const client = createClient({
    url: url,
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 5) {
          console.error("[Redis] Max reconnection attempts reached, giving up");
          connectionFailed = true;
          redisEnabled = false;
          return false; // Stop reconnecting
        }
        const delay = Math.min(retries * 500, 3000);
        console.warn(`[Redis] Reconnecting in ${delay}ms (attempt ${retries}/5)...`);
        return delay;
      },
      connectTimeout: 5000, // 5 second timeout
    },
  });

  client.on("error", (err) => {
    console.error("[Redis] client error:", err.message);
  });
  client.on("reconnecting", () => {
    console.warn("[Redis] reconnecting...");
  });
  client.on("connect", () => {
    console.log("[Redis] connected successfully");
    connectionFailed = false;
  });
  client.on("end", () => {
    console.log("[Redis] connection closed");
  });

  return client;
};

/**
 * Get Redis client. Returns null if Redis is disabled or connection failed.
 * @param {boolean} throwOnError - If true, throws error when Redis unavailable. Default: false
 * @returns {Promise<import('redis').RedisClientType|null>}
 */
export const getRedisClient = async (throwOnError = false) => {
  // Check if Redis is disabled
  if (isRedisDisabled() || !redisEnabled || connectionFailed) {
    if (throwOnError) {
      throw new Error("Redis is not available");
    }
    return null;
  }

  try {
    if (!redisClient) {
      redisClient = createRedisClient();
      connectPromise = redisClient.connect().catch((err) => {
        console.error("[Redis] failed to connect:", err.message);
        connectionFailed = true;
        redisEnabled = false;
        redisClient = null;
        connectPromise = null;
        if (throwOnError) throw err;
        return null;
      });
    }

    if (connectPromise) {
      await connectPromise;
      connectPromise = null;
    } else if (redisClient && !redisClient.isOpen) {
      await redisClient.connect();
    }

    return redisClient;
  } catch (err) {
    console.error("[Redis] getRedisClient error:", err.message);
    connectionFailed = true;
    if (throwOnError) throw err;
    return null;
  }
};

/**
 * Check if Redis is currently available and connected
 */
export const isRedisAvailable = () => {
  return redisEnabled && !connectionFailed && redisClient?.isOpen;
};

/**
 * Reset Redis state (useful for retry after fixing config)
 */
export const resetRedisState = () => {
  redisEnabled = true;
  connectionFailed = false;
  console.log("[Redis] State reset, will attempt reconnection on next call");
};

export const quitRedisClient = async () => {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
  }
  redisClient = null;
  connectPromise = null;
};

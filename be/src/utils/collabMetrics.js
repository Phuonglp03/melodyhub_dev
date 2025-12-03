const METRIC_ENV = process.env.COLLAB_METRICS_LOG || "on";

export const recordCollabMetric = (event, payload = {}) => {
  if (METRIC_ENV === "off") return;
  const safePayload = (() => {
    try {
      return JSON.stringify(payload);
    } catch {
      return "{}";
    }
  })();
  console.log(`[CollabMetric] ${event} ${safePayload}`);
};







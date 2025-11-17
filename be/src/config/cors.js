import cors from 'cors';

// Allow configuring per-route or global CORS using env vars
// Example env: CORS_ORIGINS=http://localhost:3000,https://staging.example.com
export function buildCorsOptions() {
  const originsEnv = process.env.CORS_ORIGINS || process.env.CLIENT_ORIGIN || '*';
  const allowedOrigins = originsEnv.split(',').map((o) => o.trim()).filter(Boolean);

  if (allowedOrigins.length === 1 && allowedOrigins[0] === '*') {
    return { origin: true, credentials: true };
  }

  return {
    origin: function (origin, callback) {
      // Allow non-browser requests (no origin) like curl/postman
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  };
}

export function corsMiddleware() {
  return cors(buildCorsOptions());
}



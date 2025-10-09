import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import 'express-async-errors';
import path from 'path';
import { fileURLToPath } from 'url';

import { connectToDatabase } from './config/db.js';
import { corsMiddleware } from './config/cors.js';

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(helmet());
app.use(corsMiddleware());
app.use(morgan('dev'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

const uploadDir = process.env.UPLOAD_DIR || 'uploads';
app.use('/static', express.static(path.join(__dirname, '..', uploadDir)));

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'melodyhub-be', timestamp: new Date().toISOString() });
});

const port = Number(process.env.PORT) || 3000;

async function start() {
  await connectToDatabase();
  app.listen(port, () => {
    console.log(`melodyhub-be listening on port ${port}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});





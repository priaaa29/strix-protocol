// Strix Protocol Backend — Express server entry point

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { SorobanRpc } from '@stellar/stellar-sdk';
import { initDatabase, getDb } from './indexer/db';
import { startEventListener, stopEventListener } from './indexer/eventListener';
import { startSettlementKeeper, stopSettlementKeeper } from './settlement-keeper';
import positionsRouter from './api/positions';
import vaultRouter from './api/vault';
import optionsRouter from './api/options';
import feedbackRouter from './api/feedback';

// ── Env validation ─────────────────────────────────────────────────────────

const REQUIRED_ENV = [
  'PRICING_ENGINE_ID',
  'VAULT_ID',
  'OPTION_MARKET_ID',
  'ADMIN_ADDRESS',
  'STELLAR_KEY_ALIAS',
  'RPC_URL',
] as const;

const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error(`[Startup] Missing required environment variables: ${missing.join(', ')}`);
  console.error('[Startup] Copy .env.example to .env and fill in the values.');
  process.exit(1);
}

// ── Config ─────────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT) || 3001;
const RPC_URL = process.env.RPC_URL!;

// Parse CORS origins from env: comma-separated list
const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

// ── App setup ──────────────────────────────────────────────────────────────

const app = express();

// ── Middleware ─────────────────────────────────────────────────────────────

app.use(cors({
  origin: CORS_ORIGINS,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '64kb' }));

// Global rate limit: 200 requests per 15 minutes per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — please try again later' },
});

// Stricter limit for position lookups to prevent enumeration
const positionsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — please try again later' },
});

app.use(globalLimiter);
app.use('/api/positions', positionsLimiter);

// ── Routes ─────────────────────────────────────────────────────────────────

app.use('/api/positions', positionsRouter);
app.use('/api/vault', vaultRouter);
app.use('/api/options', optionsRouter);
app.use('/api/feedback', feedbackRouter);

app.get('/health', async (_req, res) => {
  const checks: Record<string, string> = {};

  // DB check
  try {
    getDb().prepare('SELECT 1').get();
    checks.db = 'ok';
  } catch {
    checks.db = 'error';
  }

  // RPC check
  try {
    const server = new SorobanRpc.Server(RPC_URL, { allowHttp: false });
    await server.getLatestLedger();
    checks.rpc = 'ok';
  } catch {
    checks.rpc = 'error';
  }

  const healthy = Object.values(checks).every(v => v === 'ok');
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    uptime: Math.floor(process.uptime()),
    ...checks,
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Startup ────────────────────────────────────────────────────────────────

initDatabase();
startEventListener();
startSettlementKeeper();

const server = app.listen(PORT, () => {
  console.log(`[Startup] Strix Protocol backend on port ${PORT}`);
  console.log(`[Startup] Network:  ${process.env.NETWORK || 'testnet'}`);
  console.log(`[Startup] RPC:      ${RPC_URL}`);
  console.log(`[Startup] Market:   ${process.env.OPTION_MARKET_ID}`);
  console.log(`[Startup] Vault:    ${process.env.VAULT_ID}`);
});

// ── Process reliability ────────────────────────────────────────────────────

process.on('unhandledRejection', (reason) => {
  console.error('[Fatal] Unhandled promise rejection:', reason);
  process.exit(1);
});

function shutdown() {
  console.log('[Shutdown] Stopping services...');
  stopEventListener();
  stopSettlementKeeper();
  server.close(() => {
    console.log('[Shutdown] Server closed.');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

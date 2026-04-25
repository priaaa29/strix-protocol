// Strix Protocol Backend — Express server entry point

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initDatabase } from './indexer/db';
import { startEventListener, stopEventListener } from './indexer/eventListener';
import { startOracleKeeper, stopOracleKeeper } from './oracle-keeper';
import positionsRouter from './api/positions';
import vaultRouter from './api/vault';
import optionsRouter from './api/options';
import feedbackRouter from './api/feedback';

const PORT = Number(process.env.PORT) || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const app = express();

// ── Middleware ─────────────────────────────────────────────────────────────

app.use(cors({
  origin: [FRONTEND_URL, 'http://localhost:3000'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));

app.use(express.json({ limit: '64kb' }));

// ── Routes ─────────────────────────────────────────────────────────────────

app.use('/api/positions', positionsRouter);
app.use('/api/vault', vaultRouter);
app.use('/api/options', optionsRouter);
app.use('/api/feedback', feedbackRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Math.floor(Date.now() / 1000) });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Startup ────────────────────────────────────────────────────────────────

initDatabase();
startEventListener();
startOracleKeeper();

const server = app.listen(PORT, () => {
  console.log(`Strix Protocol backend running on port ${PORT}`);
  console.log(`  RPC:     ${process.env.RPC_URL || 'https://soroban-testnet.stellar.org'}`);
  console.log(`  Vault:   ${process.env.VAULT_ID || '(not set)'}`);
  console.log(`  Market:  ${process.env.OPTION_MARKET_ID || '(not set)'}`);
  console.log(`  Pricing: ${process.env.PRICING_ENGINE_ID || '(not set)'}`);
});

// ── Graceful shutdown ──────────────────────────────────────────────────────

function shutdown() {
  console.log('\nShutting down...');
  stopEventListener();
  stopOracleKeeper();
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Strix Protocol — /api/positions router

import { Router, Request, Response } from 'express';
import { getEventsByUser, getRecentEvents, getEventsByType } from '../indexer/db';

const router = Router();

/**
 * GET /api/positions/:address
 * Returns all indexed events for a given user address.
 */
router.get('/:address', (req: Request, res: Response) => {
  const { address } = req.params;

  if (!address || address.length < 10) {
    res.status(400).json({ error: 'Invalid address' });
    return;
  }

  try {
    const events = getEventsByUser(address);

    // Parse JSON data blobs
    const parsed = events.map((e) => ({
      ...e,
      data: (() => {
        try { return JSON.parse(e.data); } catch { return e.data; }
      })(),
    }));

    res.json({ address, events: parsed, count: parsed.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[API] GET /positions/:address error:', message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/positions
 * Returns the most recent events across all users (for activity feed).
 */
router.get('/', (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const type = req.query.type as string | undefined;

  try {
    const events = type
      ? getEventsByType(type.toUpperCase(), limit)
      : getRecentEvents(limit);

    const parsed = events.map((e) => ({
      ...e,
      data: (() => {
        try { return JSON.parse(e.data); } catch { return e.data; }
      })(),
    }));

    res.json({ events: parsed, count: parsed.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[API] GET /positions error:', message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

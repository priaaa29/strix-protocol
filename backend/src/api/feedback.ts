// Strix Protocol — /api/feedback router

import { Router, Request, Response } from 'express';
import { insertFeedback, getAllFeedback } from '../indexer/db';
import type { DbFeedback } from '../types';

const router = Router();

const VALID_CATEGORIES = ['ux', 'bug', 'feature', 'other'];

/**
 * POST /api/feedback
 * Body: { user_address?, rating, category, message }
 */
router.post('/', (req: Request, res: Response) => {
  const { user_address, rating, category, message } = req.body as Partial<DbFeedback>;

  // Validate
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    res.status(400).json({ error: 'message is required' });
    return;
  }
  if (message.length > 2000) {
    res.status(400).json({ error: 'message must be ≤ 2000 characters' });
    return;
  }
  if (rating !== undefined && (typeof rating !== 'number' || rating < 1 || rating > 5)) {
    res.status(400).json({ error: 'rating must be 1–5' });
    return;
  }
  if (category !== undefined && !VALID_CATEGORIES.includes(category)) {
    res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` });
    return;
  }

  // Validate Stellar address format if provided
  if (user_address !== null && user_address !== undefined) {
    if (typeof user_address !== 'string' || !user_address.startsWith('G') || user_address.length !== 56) {
      res.status(400).json({ error: 'Invalid Stellar address format' });
      return;
    }
  }

  try {
    const feedback: Omit<DbFeedback, 'id'> = {
      user_address: user_address ?? null,
      rating: typeof rating === 'number' ? rating : 3,
      category: typeof category === 'string' ? category : 'other',
      message: message.trim(),
      submitted_at: Math.floor(Date.now() / 1000),
    };

    insertFeedback(feedback);
    res.status(201).json({ success: true, message: 'Feedback submitted. Thank you!' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[API] POST /feedback error:', msg);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/feedback
 * Returns all feedback (admin use — in production this would require auth).
 */
router.get('/', (_req: Request, res: Response) => {
  try {
    const feedback = getAllFeedback();
    res.json({ feedback, count: feedback.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[API] GET /feedback error:', msg);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

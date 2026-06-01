/**
 * Backend mirror of frontend/lib/expiry.ts. MUST stay in sync.
 *
 * On-chain reality: `scripts/create-epoch.sh` writes epochs at Friday
 * 08:00 UTC. Everything that reads or displays an expiry — keeper,
 * REST API, indexer — must use the same hour, or settle/get_strikes
 * miss the live epoch entirely.
 */

export const EXPIRY_HOUR_UTC = 8;

export function getNextFridayExpiry(now: Date = new Date()): number {
  const day = now.getUTCDay();
  let daysUntilFri = (5 - day + 7) % 7;
  if (daysUntilFri === 0) {
    const hourPassed =
      now.getUTCHours() > EXPIRY_HOUR_UTC ||
      (now.getUTCHours() === EXPIRY_HOUR_UTC && (now.getUTCMinutes() > 0 || now.getUTCSeconds() > 0));
    if (hourPassed) daysUntilFri = 7;
  }
  const fri = new Date(now);
  fri.setUTCDate(now.getUTCDate() + daysUntilFri);
  fri.setUTCHours(EXPIRY_HOUR_UTC, 0, 0, 0);
  return Math.floor(fri.getTime() / 1000);
}

/**
 * Returns the next N Friday expiries starting from `now`, used by
 * /api/options/expiries to populate the expiry selector.
 */
export function getUpcomingFridays(n: number, now: Date = new Date()): number[] {
  const out: number[] = [];
  let cursor = getNextFridayExpiry(now);
  for (let i = 0; i < n; i++) {
    out.push(cursor);
    // Step forward 7 days
    cursor += 7 * 24 * 60 * 60;
  }
  return out;
}

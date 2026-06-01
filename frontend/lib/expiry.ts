/**
 * Single source of truth for the Friday expiry timestamp Strix uses.
 *
 * On-chain reality: `scripts/create-epoch.sh` writes epochs at Friday
 * 08:00 UTC. Everything that reads or displays an expiry MUST use the
 * same hour, or `get_strikes(expiry)` reads against a non-existent
 * timestamp and the UI renders empty.
 *
 * This file is the only place EXPIRY_HOUR_UTC is defined in the
 * frontend; backend has its own copy at backend/src/expiry.ts that
 * MUST stay in sync (kept simple deliberately — no shared package).
 */

export const EXPIRY_HOUR_UTC = 8;

/**
 * Unix-seconds timestamp of the next Friday at EXPIRY_HOUR_UTC.
 * Always returns a value strictly in the future — when called between
 * Friday 00:00 UTC and Friday EXPIRY_HOUR_UTC we still advance to the
 * NEXT Friday so the same epoch isn't queried twice.
 */
export function getNextFridayExpiry(now: Date = new Date()): number {
  const day = now.getUTCDay();              // 0=Sun … 5=Fri … 6=Sat
  let daysUntilFri = (5 - day + 7) % 7;     // 0..6

  // If today is Friday but the expiry hour has already passed, roll forward.
  // If today is Friday and the hour is still in the future, daysUntilFri=0 is fine.
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

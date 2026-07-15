/**
 * Tiny in-memory rate limiter for endpoints that trigger billable external
 * sends (bulk/test email and SMS). The upstream POS API cannot verify JWTs
 * (its auth middleware is a no-op), so the proxy's bearer gate is decode-only;
 * this limiter caps the blast radius of any abuse of those endpoints.
 *
 * Fixed window per key (admin id + IP). Stateless-proxy friendly: no DB, and
 * a restart simply resets the window.
 */
const windows = new Map<string, { count: number; resetAt: number }>();

export function checkSendRateLimit(
  key: string,
  max: number,
  windowMs: number,
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const entry = windows.get(key);
  if (!entry || entry.resetAt <= now) {
    // Opportunistic cleanup keeps the map from growing unbounded.
    if (windows.size > 1000) {
      for (const [k, v] of windows) if (v.resetAt <= now) windows.delete(k);
    }
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }
  if (entry.count >= max) {
    return { allowed: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count++;
  return { allowed: true, retryAfterSec: 0 };
}

import crypto from "node:crypto";

/**
 * Admin-panel session tokens.
 *
 * Operators log in against the upstream Staff collection (POST /staff), and
 * staff accounts do NOT appear in the upstream admin directory, so there is no
 * upstream endpoint the proxy could use to verify a staff token. The proxy
 * also does not hold the upstream JWT secret, so it cannot verify signatures.
 *
 * Instead (same pattern as the partner portal's portalSession): after a
 * successful upstream staff login, the proxy mints its OWN HS256 token signed
 * with SESSION_SECRET, carrying the staff `_id`/`email` and the upstream
 * token. Proxy-gated endpoints (composed subscriptions view, What's New save)
 * verify this signature — the claims cannot be forged without SESSION_SECRET.
 *
 * The payload keeps the upstream claim names (`_id`, `email`) so existing
 * consumers that merely decode the payload (e.g. the bulk-SMS sender-id gate)
 * keep working unchanged.
 */

const SECRET = process.env["SESSION_SECRET"] ?? "";
const TTL_SECONDS = 60 * 60 * 24; // 24h, matching the upstream staff token

export interface AdminSession {
  /** Staff id from the upstream login response. */
  id: string;
  email: string;
  /** Upstream JWT, kept for parity if upstream ever enforces auth. */
  ut: string;
}

function b64urlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function signAdminSession(session: AdminSession): string {
  if (!SECRET) throw new Error("SESSION_SECRET is not configured");
  const header = b64urlJson({ alg: "HS256", typ: "JWT" });
  const now = Math.floor(Date.now() / 1000);
  const payload = b64urlJson({
    _id: session.id,
    email: session.email,
    ut: session.ut,
    iat: now,
    exp: now + TTL_SECONDS,
  });
  const data = `${header}.${payload}`;
  const sig = crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}

/** Verify a `Bearer <token>` header signed by this server. */
export function verifyAdminSession(
  authHeader: string | undefined,
): AdminSession | undefined {
  if (!authHeader?.startsWith("Bearer ") || !SECRET) return undefined;
  const token = authHeader.slice("Bearer ".length).trim();
  const parts = token.split(".");
  if (parts.length !== 3) return undefined;
  const [header, payload, sig] = parts;
  const expected = crypto
    .createHmac("sha256", SECRET)
    .update(`${header}.${payload}`)
    .digest("base64url");
  const sigBuf = Buffer.from(sig ?? "");
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return undefined;
  }
  try {
    const decoded = JSON.parse(
      Buffer.from(payload ?? "", "base64url").toString("utf8"),
    ) as { _id?: unknown; email?: unknown; ut?: unknown; exp?: unknown };
    if (typeof decoded.exp === "number" && decoded.exp < Math.floor(Date.now() / 1000)) {
      return undefined;
    }
    if (typeof decoded._id !== "string" || !decoded._id) return undefined;
    if (typeof decoded.email !== "string" || !decoded.email) return undefined;
    return {
      id: decoded._id,
      email: decoded.email,
      ut: typeof decoded.ut === "string" ? decoded.ut : "",
    };
  } catch {
    return undefined;
  }
}

import crypto from "node:crypto";

/**
 * Partner portal session tokens.
 *
 * The upstream POS API mounts its affiliate/payments routes with NO auth check
 * and the proxy does not hold the upstream JWT secret, so it cannot verify the
 * upstream token's signature. If the proxy gated portal endpoints on an affiliate
 * id decoded straight out of an unverified upstream JWT, anyone could forge a
 * bearer token carrying another partner's id and read their data or trigger real
 * M-Pesa withdrawals from their wallet (IDOR / account takeover).
 *
 * Instead, after a successful upstream login/register the proxy mints its OWN
 * HS256 token signed with SESSION_SECRET, carrying the affiliate id and the
 * upstream token. Every protected `/portal/*` route verifies this signature, so
 * the affiliate id can only have been set by this server — it cannot be forged
 * without SESSION_SECRET. The embedded upstream token is forwarded upstream as
 * the bearer for parity if upstream ever starts enforcing auth.
 */

const SECRET = process.env["SESSION_SECRET"] ?? "";
const TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface PortalSession {
  /** Affiliate id, derived once from the upstream token at login. */
  aid: string;
  /** Upstream JWT, forwarded to upstream as the bearer on proxied calls. */
  ut: string;
}

function b64urlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function signPortalSession(session: PortalSession): string {
  if (!SECRET) throw new Error("SESSION_SECRET is not configured");
  const header = b64urlJson({ alg: "HS256", typ: "JWT" });
  const now = Math.floor(Date.now() / 1000);
  const payload = b64urlJson({ ...session, iat: now, exp: now + TTL_SECONDS });
  const data = `${header}.${payload}`;
  const sig = crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyPortalSession(token: string | undefined): PortalSession | undefined {
  if (!token || !SECRET) return undefined;
  const parts = token.split(".");
  if (parts.length !== 3) return undefined;
  const [header, payload, sig] = parts;
  const expected = crypto
    .createHmac("sha256", SECRET)
    .update(`${header}.${payload}`)
    .digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return undefined;
  }
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      aid?: unknown;
      ut?: unknown;
      exp?: unknown;
    };
    if (typeof decoded.exp === "number" && decoded.exp < Math.floor(Date.now() / 1000)) {
      return undefined;
    }
    if (typeof decoded.aid !== "string" || !decoded.aid) return undefined;
    return { aid: decoded.aid, ut: typeof decoded.ut === "string" ? decoded.ut : "" };
  } catch {
    return undefined;
  }
}

/**
 * Decode (without verifying) an upstream JWT to read the affiliate id. Used ONCE
 * at login/register on the token the upstream itself just issued — at that point
 * the token is trusted because it came directly from the upstream response, not
 * the client. The minted session token is what gets verified thereafter.
 */
export function affiliateIdFromUpstreamToken(token: string | undefined): string | undefined {
  if (!token) return undefined;
  const segments = token.split(".");
  if (segments.length < 2) return undefined;
  try {
    const payload = JSON.parse(
      Buffer.from(segments[1], "base64url").toString("utf8"),
    ) as { _id?: unknown; id?: unknown };
    const id = payload._id ?? payload.id;
    return typeof id === "string" ? id : undefined;
  } catch {
    return undefined;
  }
}

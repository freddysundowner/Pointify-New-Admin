import { upstreamFetch, normalizeList } from "./upstream";

/** Decode the bearer JWT payload (upstream login signs `{ email, _id }`). */
export function claimsFromAuth(
  header: string | undefined,
): { id: string; email: string } | undefined {
  if (!header?.startsWith("Bearer ")) return undefined;
  const token = header.slice("Bearer ".length).trim();
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[1]) return undefined;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as {
      _id?: unknown;
      email?: unknown;
    };
    if (typeof payload._id !== "string" || !payload._id) return undefined;
    if (typeof payload.email !== "string" || !payload.email) return undefined;
    return { id: payload._id, email: payload.email };
  } catch {
    return undefined;
  }
}

// The proxy cannot cryptographically verify upstream tokens (it does not hold
// the upstream JWT secret), so beyond decoding the claims we cross-check them
// against the upstream admin directory: the token's `_id` AND `email` must
// belong to the same real admin account. Successful checks are cached briefly.
const verifiedAdmins = new Map<string, number>();
const VERIFY_TTL_MS = 5 * 60 * 1000;

export async function isRealAdmin(
  claims: { id: string; email: string },
  authHeader: string | undefined,
): Promise<boolean> {
  const key = `${claims.id}:${claims.email.toLowerCase()}`;
  const cachedAt = verifiedAdmins.get(key);
  if (cachedAt && Date.now() - cachedAt < VERIFY_TTL_MS) return true;
  try {
    // Upstream `name` matches username/email/phone.
    const result = await upstreamFetch({
      method: "GET",
      path: "/admin/",
      query: { name: claims.email, page: 1, limit: 50 },
      authHeader,
    });
    if (result.status >= 400) return false;
    const rows = normalizeList(result.data).data;
    const match = rows.some((row) => {
      if (!row || typeof row !== "object") return false;
      const rec = row as Record<string, unknown>;
      return (
        rec["_id"] === claims.id &&
        typeof rec["email"] === "string" &&
        rec["email"].toLowerCase() === claims.email.toLowerCase()
      );
    });
    if (match) verifiedAdmins.set(key, Date.now());
    return match;
  } catch {
    return false;
  }
}

/** Convenience: decode + directory cross-check in one call. */
export async function isVerifiedAdminRequest(
  authHeader: string | undefined,
): Promise<boolean> {
  const claims = claimsFromAuth(authHeader);
  if (!claims) return false;
  return isRealAdmin(claims, authHeader);
}

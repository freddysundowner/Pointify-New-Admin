/**
 * Normalize a Kenyan phone number to Safaricom MSISDN format (2547XXXXXXXX /
 * 2541XXXXXXXX). The upstream M-Pesa B2C call (`/payments/mpesa/withdraw`)
 * forwards the number straight to Safaricom as `PartyB` without normalizing,
 * and Safaricom rejects local formats like `07XXXXXXXX` with HTTP 400
 * "Invalid PartyB". Normalizing here is what makes withdrawals actually go
 * through.
 *
 * Accepts `07XXXXXXXX`, `01XXXXXXXX`, `+2547XXXXXXXX`, `2547XXXXXXXX`, and the
 * bare 9-digit `7XXXXXXXX` / `1XXXXXXXX`. Returns `null` for anything that is
 * not a valid Kenyan mobile number.
 */
export function normalizeKenyanMsisdn(raw: string): string | null {
  let d = raw.replace(/\D/g, "");

  if (d.startsWith("254")) {
    // already international
  } else if (d.startsWith("0")) {
    d = "254" + d.slice(1);
  } else if (d.length === 9 && (d.startsWith("7") || d.startsWith("1"))) {
    d = "254" + d;
  } else {
    return null;
  }

  return /^254[71]\d{8}$/.test(d) ? d : null;
}

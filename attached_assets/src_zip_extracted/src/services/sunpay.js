// services/sunpay.js
const SUNPAY_BASE = process.env.SUNPAY_API || 'https://sunpay.co.ke/api/v1'

const sunpayHeaders = () => ({
  Authorization: `Bearer ${process.env.SUNPAY_API_KEY}`,
  "Content-Type": "application/json",
});

async function deleteShopFromSunPay(shop) {
  const merchantId = shop.sunpay_merchant_id;
  console.log(merchantId);
  if (!merchantId) return null;
  console.log(`${SUNPAY_BASE}/merchants/${merchantId}`);
  const res = await fetch(`${SUNPAY_BASE}/merchants/${merchantId}`, {
    method: "DELETE",
    headers: sunpayHeaders(),
  }); 
  console.log(res.json());
  if (!res.ok && res.status !== 404) {
    const errBody = await res.text();
    throw new Error(`SunPay ${res.status}: ${errBody}`);
  }
  shop.sunpay_merchant_id = null;
  shop.sunpay_merchant_ref = null;
  shop.sunpay_paybill_type = null;
  shop.sunpay_linked_at = null;
  shop.sunpay_link_error = null;
  await shop.save();
  return true;
}

/**
 * Create or update a SunPay sub-merchant for a shop.
 * Idempotent: if shop.sunpay_merchant_id exists, it PATCHes; otherwise POSTs.
 * Mutates and saves the shop with the returned merchant id/ref.
 */
async function syncShopToSunPay(shop) {
  // Resolve till vs paybill from whichever field your frontend sent
  const shortcode = String(shop.paybill_till || shop.paybill || "").trim();
  console.log("shortcode", shortcode);
  if (!shortcode) return null;

  // Heuristic: 5-digit codes are tills, 6+ digits are paybills.
  // Override with shop.paybill_type if your UI sets it explicitly.
  const type =
    shop.paybill_account ? "till" : "till";

  const payload = {
    businessName: shop.name,
    email: shop.email,
    paybill: { type, shortcode },
  };

  const isUpdate = Boolean(shop.sunpay_merchant_id);
  const url = isUpdate
    ? `${SUNPAY_BASE}/merchants/${shop.sunpay_merchant_id}`
    : `${SUNPAY_BASE}/merchants`;
  const res = await fetch(url, {
    method: isUpdate ? "PATCH" : "POST",
    headers: sunpayHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`SunPay ${res.status}: ${errBody}`);
  }

  const merchant = await res.json();
  console.log(merchant);

  // Persist the link on the shop
  shop.sunpay_merchant_id = merchant.id;
  shop.sunpay_merchant_ref = merchant.merchantRef;
  shop.sunpay_paybill_type = merchant.settlementType;
  shop.sunpay_linked_at = new Date();
  shop.sunpay_link_error = null;
  await shop.save();

  return merchant;
}

function normalizePhone(p) {
  if (!p) return null;
  const d = String(p).replace(/\D/g, "");
  if (d.startsWith("254")) return d;
  if (d.startsWith("0")) return "254" + d.slice(1);
  if (d.startsWith("7") || d.startsWith("1")) return "254" + d;
  return d;
}

module.exports = { syncShopToSunPay,deleteShopFromSunPay };
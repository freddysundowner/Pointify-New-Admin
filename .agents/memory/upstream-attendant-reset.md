---
name: Upstream attendant reset-password contract
description: How the Pointify upstream attendant password reset works and what the proxy must send.
---

- Attendant "userId" shown to operators is the upstream `uniqueDigits` field (the number attendants type to log in), NOT `_id`. Attendant login is `findOne({ uniqueDigits: parseInt(uid) })`.
- Reset endpoint is upstream `PUT /attendants/reset/password/sms/:id`. The controller (`resetPasswordSms`) reads `id` from the **body** (not the path), hashes the supplied plaintext password, saves it, and SMSs the plaintext to `attendant.phone`.
- Body `phone` is a **fallback only**: used (and saved) when the attendant has no phone on file. If the attendant already has a phone and none is provided, it 401s with "enter phone number" only when there is truly no number.
- Proxy maps clean `POST /attendants/{id}/reset-password` → upstream PUT, sending `{ id: params.id, password, phone }`.

**Why:** the path `:id` is decorative — the controller uses body `id`, so the proxy must include `id` in the body or the lookup fails.
**How to apply:** any operator-facing attendant management feature should treat `uniqueDigits` as the human login id and reuse this proxy route for resets; the new password reaches the attendant by SMS, not by display.

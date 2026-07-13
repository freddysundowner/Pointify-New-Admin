# Lead-tracking CRM — files to add to your POS API server

These three files add a partner-owned lead pipeline to your existing Node.js +
MongoDB API (the same server as `models/affliate.js`, `controllers/affliate.js`,
`routes/affliates.js`). Copy each file into the matching folder of your project.

## 1. Copy the files

| File in this folder        | Copy to (in your API server) |
| -------------------------- | ---------------------------- |
| `models/leads.js`          | `models/leads.js`            |
| `controllers/leads.js`     | `controllers/leads.js`       |
| `routes/leads.js`          | `routes/leads.js`            |

They follow your existing conventions: CommonJS `require`/`module.exports`,
Mongoose schema with the `markUnsynced.plugin`, and a controller/route split.

## 2. Mount the route

In `routes/index.js`, add the require near the other route imports:

```js
const leads = require("./leads");
```

and mount it alongside the other `app.use(...)` lines:

```js
app.use("/leads", leads);
```

(No `verifyToken` is needed — same as the `/affiliates` route. Security is
enforced by the admin proxy, which signs each partner's session and injects the
`affiliate` id on every request. The controller also scopes every query by that
id as defence in depth.)

## 2b. (Recommended) Lock `/leads` to the admin proxy

Because these endpoints trust the `affiliate` id supplied on the request, anyone
who can reach your server directly could in theory pass another partner's
`affiliate` id and read/modify their leads (the same open-access model your other
routes use today). To close this, set one shared secret so **only** the admin
proxy is accepted:

1. Pick a long random string (e.g. `openssl rand -hex 32`).
2. On **your POS API server**, set env var `LEADS_PROXY_SECRET=<that string>`.
3. On the **Replit admin project**, set the same `LEADS_PROXY_SECRET=<that string>`
   (ask us to add it — it is a secret).

Once both sides have it, `routes/leads.js` rejects any request that does not
carry the matching `x-proxy-secret` header (which only the proxy sends), and the
`/leads` endpoints can no longer be called or spoofed directly. If the env var is
left unset on your server, the gate is a no-op and nothing changes.

## 3. That's it

Restart your API server. The admin proxy will call:

- `GET    /leads?affiliate=<id>&page=&limit=&stage=&source=&search=`
  (`affiliate` may also be a comma-separated list of ids — the proxy uses this
  for a master partner viewing their team's pipeline and for the platform
  admin's all-partners view; the list response populates each lead's
  `affiliate` with `{ _id, name, email, phonenumber }` for display)
- `POST   /leads`                (body includes `affiliate`)
- `GET    /leads/:id?affiliate=<id>`
  (`affiliate` may also be a comma-separated list — used when a master partner
  opens a team member's lead and for the platform admin's read-only detail
  view; the response populates `affiliate` with safe display fields)
- `PUT    /leads/:id?affiliate=<id>`
- `DELETE /leads/:id?affiliate=<id>`
- `POST   /leads/:id/activities?affiliate=<id>` (body `{ note }` — adds a note
  to the lead's activity timeline; owner only)

The partner portal never talks to your server directly — it goes through the
admin proxy, which supplies and verifies the `affiliate` id. Your endpoints
require that `affiliate` id and reject any request without it.

## Lead fields

| Field              | Type   | Notes                                              |
| ------------------ | ------ | -------------------------------------------------- |
| `businessName`     | String | required                                           |
| `contactPerson`    | String |                                                    |
| `phonenumber`      | String |                                                    |
| `businessType`     | String |                                                    |
| `location`         | String |                                                    |
| `source`           | String | Referral / Field Sales / Digital / Follow-Up       |
| `stage`            | String | defaults to `New Lead` (see pipeline below)         |
| `nextFollowUpDate` | Date   |                                                    |
| `notes`            | String |                                                    |
| `affiliate`        | ObjectId ref `Affliate` | set by the proxy, not the client      |

Pipeline stages (in order):
`New Lead → Contacted → Interested → Visit/Demo Scheduled → Negotiating → Won (Converted) / Lost`

## Activity timeline

Each lead also carries an `activities` array (embedded subdocuments) that the
controller maintains automatically:

| Field    | Notes                                                              |
| -------- | ------------------------------------------------------------------ |
| `action` | `created`, `stage_changed`, `follow_up_set`, `details_updated`, `note` |
| `from`   | previous value (stage or follow-up date), where relevant           |
| `to`     | new value, where relevant                                          |
| `note`   | free text (for `note` entries)                                     |
| `at`     | timestamp, set automatically                                       |

- Creating a lead logs `created`.
- Updating a lead logs `stage_changed` and/or `follow_up_set` when those fields
  change, otherwise `details_updated` for other edits.
- `POST /leads/:id/activities` appends a `note` entry.

Leads created before this update simply have an empty timeline — nothing to
migrate.

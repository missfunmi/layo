# Profile Page Feature Spec

## What this is

A minimal diagnostic page at `/profile`, added to aid troubleshooting during beta testing. It displays the identifiers and state needed to debug a user's report without requiring database access: device ID, user ID, Oura connection status, and the active AI prompt version.

This is scoped to v0.1.1.

---

## Purpose

Beta testers may hit issues that are hard to diagnose from a bug report alone ("my recommendation seems off," "Oura isn't syncing"). Without a way to see their own identifiers, resolving these requires asking the user to describe their device and exact time of app use and hoping it's enough to find the right rows in the database.

`/profile` gives the user (or the person helping them) a copy-pasteable snapshot of exactly what the backend has on file for them: which device record they are, which user that maps to, whether Oura is connected, and which version of the recommendation prompt they're currently on. This turns "my recommendation seems off" into "user X, prompt version Y, no Oura," enough to reproduce or rule things out immediately.

---

## Data displayed

A card with three fields:

| Field                 | Source                               | Notes                                                                               |
| --------------------- | ------------------------------------ | ----------------------------------------------------------------------------------- |
| User ID               | `GET /api/profile` → `userId`        | The database `users.id` this device resolves to                                     |
| Oura Ring             | `GET /api/profile` → `ouraConnected` | "Connected" or "Not connected"; true if an active `wearable_connections` row exists |
| Recommendation Engine | `GET /api/profile` → `promptVersion` | The latest `prompt_configs.version` by `created_at`                                 |

Below the card, a separate instructional block shows the device's `deviceId` (from `layo_device_id` in localStorage, read directly on the client, not fetched from the API) with a copy button. This used to be a "Device ID" row in the card above; see [Device-switching value](#device-switching-value) below for why it moved and changed format.

No sensitive data (tokens, check-in content, rationale text) is displayed or returned by the API.

---

## Device-switching value

Below the diagnostic card, a separate block reads:

> Switching devices? Copy this and paste it in when Láyo asks.
>
> `[deviceId]` `[Copy]`

This is the same `deviceId` that was previously shown as a plain "Device ID" row in the card above. It moved out of the card and became an instructional block, rather than staying a relabeled row, for two reasons:
1. It's now load-bearing: pasting this value into `/restore` (see `docs/specs/account-recovery.md`) is the only way to restore access to an existing account in a browser context that never had a local `deviceId`. This is a strictly heavier purpose than the plain read-only diagnostic snapshot the other three fields provide.
2. A single-word label for "your `deviceId`, reused as a way back in" (candidates included "recovery code," "account ID") always read as technical, regardless of the word. Describing the action instead of naming a "thing" avoids that problem, but doesn't fit the terse label/value row format the rest of the card uses.

See `docs/specs/account-recovery.md` for the full recovery flow this value supports.

---

## User-facing label conventions

The database field and internal terminology is `prompt_version` / `promptVersion`. The user-facing label is **"Recommendation Engine"**. "Prompt" is an implementation detail; a beta tester does not need to know the product is prompt-driven, and "prompt version" reads as more technical than necessary. "Recommendation Engine" communicates the same thing (which iteration of the recommendation logic produced their results) in plain language.

This mirrors the `sleep_score` → `sleep_satisfaction` precedent (see `docs/specs/wearable-integration.md`): internal/database naming and user-facing copy are allowed to diverge when the internal name doesn't read well to an end user.

---

## No navigation entry point

There is deliberately no link, button, or menu item anywhere in the app that leads to `/profile`. Users are told to type the URL directly when a troubleshooting conversation calls for it. This keeps the page out of the primary product surface (as of now, it is just a support tool, not a feature) while still being one URL away when needed.

This is enforced by omission, not by an auth gate: `/profile` uses the same `X-Device-ID` resolution as every other route, and is reachable by anyone who knows the URL and has a valid device. It is not treated as a secret; the constraint is discoverability, not access control.

---

## Future scope

Full profile management (editable settings, data export/deletion, authentication) is out of scope for this version. `/profile` is still a read-only diagnostic snapshot, not the beginning of a settings surface, aside from the device-switching value described above. Account recovery has its own spec: see `docs/specs/account-recovery.md`. If broader profile management is built later, it will likely warrant its own spec and may not reuse this page's route or layout.

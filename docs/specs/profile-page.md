# Profile Page Feature Spec

## What this is

A minimal diagnostic page at `/profile`, added to aid troubleshooting during beta testing. It displays the identifiers and state needed to debug a user's report without requiring database access: device ID, user ID, Oura connection status, and the active AI prompt version.

This is scoped to v0.1.1.

---

## Purpose

Beta testers occasionally hit issues that are hard to diagnose from a bug report alone ("my recommendation seems off," "Oura isn't syncing"). Without a way to see their own identifiers, resolving these requires asking the user to describe their device and hoping it's enough to find the right rows in the database.

`/profile` gives the user (or the person helping them) a copy-pasteable snapshot of exactly what the backend has on file for them: which device record they are, which user that maps to, whether Oura is connected, and which version of the recommendation prompt they're currently on. This turns "my recommendation seems off" into "user X, prompt version Y, no Oura," enough to reproduce or rule things out immediately.

---

## Data displayed

A single card with four fields:

| Field | Source | Notes |
|---|---|---|
| Device ID | `layo_device_id` from localStorage | Read directly on the client; not fetched from the API |
| User ID | `GET /api/profile` → `userId` | The database `users.id` this device resolves to |
| Oura Ring | `GET /api/profile` → `ouraConnected` | "Connected" or "Not connected"; true if an active `wearable_connections` row exists |
| AI version | `GET /api/profile` → `promptVersion` | The latest `prompt_configs.version` by `created_at` |

No sensitive data (tokens, check-in content, rationale text) is displayed or returned by the API.

---

## User-facing label conventions

The database field and internal terminology is `prompt_version` / `promptVersion`. The user-facing label is **"AI version"**. "Prompt" is an implementation detail; a beta tester does not need to know the product is prompt-driven, and "prompt version" reads as more technical than necessary. "AI version" communicates the same thing (which iteration of the recommendation logic produced their results) in plain language.

This mirrors the `sleep_score` → `sleep_satisfaction` precedent (see `docs/specs/wearable-integration.md`): internal/database naming and user-facing copy are allowed to diverge when the internal name doesn't read well to an end user.

---

## No navigation entry point

There is deliberately no link, button, or menu item anywhere in the app that leads to `/profile`. Users are told to type the URL directly when a troubleshooting conversation calls for it. This keeps the page out of the primary product surface (it is a support tool, not a feature) while still being one URL away when needed.

This is enforced by omission, not by an auth gate: `/profile` uses the same `X-Device-ID` resolution as every other route, and is reachable by anyone who knows the URL and has a valid device. It is not treated as a secret; the constraint is discoverability, not access control.

---

## Future scope

Full profile management (editable settings, data export/deletion, authentication, account recovery) is out of scope for this version. `/profile` is a read-only diagnostic snapshot, not the beginning of a settings surface. If profile management is built later, it will likely warrant its own spec and may not reuse this page's route or layout.

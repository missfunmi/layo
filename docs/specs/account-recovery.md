# Account Recovery Feature Spec

## What this is

Restores access to an existing account in a browser context where `deviceId` is missing from `localStorage`, most commonly after adding the app to an iOS home screen, which runs in a storage context isolated from Safari. `/restore` accepts a pasted `deviceId`, validates it against the backend, and adopts it as the current browser context's identity.

This is scoped to v0.1.1.

---

## Purpose

`deviceId` is the sole account identifier in this app (see `docs/architecture.md`, Device identity). A browser context that never had it, or lost it, has no way back into an existing account without this flow, short of a developer intervening directly in the database.

`deviceId` already is the user's full authentication (`X-Device-ID` header, no additional secret), so this feature adds no new accounts, passwords, or credentials, just a supported way to carry the existing value into a new context by hand.

---

## Flow

1. `/profile` shows the current device's value below the diagnostic card:

   > Switching devices? Copy this and paste it in when Láyo asks.
   >
   > `[deviceId]` `[Copy]`

2. Onboarding's "name" step (`What should we call you?`) has a low-emphasis link, "Already used Láyo?", which navigates to `/restore`.

3. `/restore` shows:

   > Welcome back
   >
   > Paste what's on your profile page to get your data back.
   >
   > `[input]`
   >
   > `[Continue]`

4. On submit, the client calls `GET /api/users` with the pasted value as `X-Device-ID`:
   - `200`: the value is persisted to `localStorage` (`layo_device_id`) and the user is redirected to `/`, which routes to `/check-in` or `/recommendation` as normal. The rest of onboarding is skipped.
   - `401`: inline error, "We don't recognize that. Double check what you pasted and try again."

See `docs/mockups/restore.html` and the "Name" screen in `docs/mockups/onboarding.html`.

---

## Copy

The value is never named as a noun (e.g. "code," "ID"); every screen shows it with instructional text describing what to do with it instead (see the copy in Flow above).

---

## Security posture

No new secret, DB column, or endpoint. `deviceId` (a UUID v4) is already the entire auth model in this app; anyone holding it can already send it as `X-Device-ID`. Validation reuses the existing `GET /api/users`.

---

## Known limitation

A user who starts onboarding inside an iOS home-screen standalone context can't reach `/profile` for their value from within that context, since there's no in-app link to it. They need their original Safari session, or another authenticated device or browser, first.

---

## Future scope

This flow only helps when the user still has access to a session where `/profile` is reachable. A device with no such session (e.g. a new phone) would need a different mechanism, such as email-based recovery or full authentication. See `docs/architecture.md`, Device identity.

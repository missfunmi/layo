# Account Recovery Feature Spec

## What this is

A manual way for a user to restore access to their existing account on a browser or device context where their `deviceId` is missing from `localStorage`, most commonly after adding the app to an iOS home screen (which runs in a storage context isolated from Safari). A new page at `/restore` accepts a pasted value (the user's existing `deviceId`), validates it against the backend, and if valid, adopts it as this browser context's device identity.

This is scoped to v0.1.1.

---

## Purpose

`deviceId` is the sole account identifier in this app (see `docs/architecture.md`, Device identity). Without a supported way to carry it into a new browser context, a user who loses it has no way back into an existing account short of a developer intervening directly in the database. That's a bad experience, and one that's difficult to explain to a non-technical user: from their perspective, the app just "forgot" them.

This feature closes that gap without introducing accounts, passwords, or email. The user's `deviceId` already **is** their full authentication today (`X-Device-ID` header, no additional secret). Account recovery just gives them a supported way to carry that same value into a new context by hand.

---

## Flow

1. On `/profile`, a new instructional block sits below the existing diagnostic card:

   > Switching devices? Copy this and paste it in when Láyo asks.
   >
   > `[deviceId]` `[Copy]`

   This value is the same `deviceId` already shown elsewhere on the page; see [User-facing label conventions](#user-facing-label-conventions) below for why it's presented as an instruction rather than a labeled value.

2. On the onboarding "name" step (`What should we call you?`), a low-emphasis link appears below the Continue button:

   > Already used Láyo?

   Tapping it navigates to `/restore` (a real route, not another step within the onboarding flow's internal state machine).

3. `/restore` shows:

   > Welcome back
   >
   > Paste what's on your profile page to get your data back.
   >
   > `[input]`
   >
   > `[Continue]`

4. On submit, the client calls `GET /api/users` with the pasted value as the `X-Device-ID` header (the same endpoint the check-in page already uses to fetch profile data; no new backend endpoint is introduced):
   - `200` → the pasted value is a real, existing user. The client persists it to `localStorage` (`layo_device_id`, overwriting whatever was there, if anything) and redirects to `/`. The existing entry-point routing logic in `app/page.tsx` takes over from there, sending the user to `/check-in` or `/recommendation` based on whether they've already checked in today. The rest of onboarding is never shown to this user, since they already have a complete profile server-side.
   - `401` → the pasted value doesn't match any user. An inline error appears: "We don't recognize that. Double check what you pasted and try again." The user can edit and retry, or use the back button to return to onboarding and create a new account instead.

See `docs/mockups/restore.html` for the visual spec (empty, filled, and error states) and the updated "Name" screen in `docs/mockups/onboarding.html`.

---

## User-facing label conventions

The UI never names the recovery value as a noun ("code," "ID," or similar); every screen describes the action to take with it instead: "Switching devices? Copy this and paste it in when Láyo asks" (on `/profile`) and "Paste what's on your profile page to get your data back" (on `/restore`). This mirrors the `sleep_score` → `sleep_satisfaction` precedent (see `docs/specs/wearable-integration.md`) and the `prompt_version` → "Recommendation Engine" precedent (see `docs/specs/profile-page.md`): internal naming and user-facing copy are allowed to diverge when the internal name doesn't read well to an end user. Here, the divergence goes further: there's no user-facing name for the value at all, only an instruction for what to do with it.

---

## Security posture

No new secret, DB column, or backend endpoint is introduced. `deviceId` (a UUID v4, 122 bits of entropy) is already the entire auth model in this app: anyone holding a user's `deviceId` can already send it as `X-Device-ID` and fully act as that user. Surfacing it in a copy-pasteable format on `/profile` and accepting it as a paste target on `/restore` does not create a new class of access; it makes existing access more usable by hand. Validity is checked by calling the existing `GET /api/users`, so there's no separate lookup path to reason about.

---

## Known limitation (accepted)

A user who starts onboarding *inside* an iOS home-screen standalone context (rather than a regular browser) cannot reach `/profile` to retrieve their value in that same context, since there's no in-app link to `/profile` from within it. They would need their original Safari session, or another device/browser where they're still authenticated, to retrieve the value and complete the `/restore` flow elsewhere first.

This is accepted for the current scope: this feature ships for a beta of fewer than 5 personally-known users who would reach out directly for support if stuck, and onboarding starting from inside a home-screen context in the first place is expected to be rare. Broader in-app discoverability of `/profile` (e.g. a real navigation entry point) is out of scope for this spec and should be revisited if the user base grows beyond a direct-support model.

---

## Future scope

If the user base grows, or if devices are more frequently lost outright (not just a storage-partition mismatch, but a genuinely new phone with no access to any prior session), this manual paste flow does not help: it depends on the user still having access to a session where `/profile` is reachable. A more complete solution (email-based recovery, or full authentication) would remove that dependency, but is a larger product change than this spec covers. See `docs/architecture.md`, Device identity, for the broader authentication roadmap note.

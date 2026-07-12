# Láyo — Product Requirements Document

## Overview

Láyo is a fitness coaching assistant for female athletes. It prompts users through a daily check-in, reconciles their responses against their reported workout plan, and delivers a specific, reasoned recommendation: execute as planned, modify, or rest. The product learns the user over time, building a personal baseline rather than applying generic rules. For users who connect a supported wearable device, objective physiological data enriches this recommendation.

---

## Problem statement

Female endurance athletes training with structured plans face a recurring decision every morning: do I execute today's workout as written, modify it, or rest? Generic training tools give no guidance on this. Coaches do not proactively raise hormonal or recovery context. Athletes are left to make this call alone, often defaulting to push-through regardless of their actual physiological state.

Láyo closes this gap with a daily check-in that takes two minutes, reads the full picture — sleep satisfaction, subjective feel, yesterday's outcome, cycle day, acute stressors, and (for connected users) objective wearable data — and gives a direct, reasoned recommendation.

---

## User flows

### Flow 1: Onboarding (one-time)

Triggered on first launch when no deviceId is found in localStorage.

**Steps:**

1. Welcome screen with Láyo wordmark centered
2. "What should we call you?" — text input (name)

   A low-emphasis link below the Continue button reads "Already used Láyo?" for a user who already has an account but landed on onboarding because this browser context has no local `deviceId` (most commonly: an iOS home screen bookmark, which runs in a storage context isolated from Safari). Tapping it navigates to `/restore`, see [Account recovery](#account-recovery-restore) below. This is the only onboarding screen with this link; the welcome screen keeps its single CTA ("Get started").

3. "What year were you born?" — numeric input (birth year)
   Subtext: "We use this to tailor recommendations to your life stage, nothing else."
4. "Which of these applies to you? Select all that apply." — multi-select pill options:
   - Menstruating
   - Pregnant
   - Menopausal
   - Post-menopausal
   - On birth control
   - On hormone replacement therapy

   Subtext: "Hormones affect training more than most plans account for, and this helps Láyo give you better guidance."
5. "What are you training for?" — single select (two large tappable cards):
   - A specific race
   - Other reasons

   (If "A specific race") Three input fields appear inline on the same page without requiring a Continue tap:
   - Event name (free-form text)
   - Event type (picker/dropdown): Running, Cycling, Swimming, Triathlon, Skiing, Other
   - (If "Other") Event type detail (free-form text)
   - Event date (date picker)
   Subtext: "Láyo uses this to pace your recommendations as you get closer. If you're training for more than one race, tell us about the one coming up next. You can add others later."

   Continue is disabled until all race fields are valid when "A specific race" is selected.
6. **Connect your Oura Ring (optional)** — new step, shown after step 5.
   Heading: "Connect your Oura Ring"
   Subtext: "Láyo can use your readiness, HRV, and sleep data to give you sharper recommendations. You don't need Oura, but if you have one, this helps."
   Two actions: "Connect Oura Ring" (primary CTA) and "Skip for now" (text link below CTA).

   Tapping "Connect Oura Ring" initiates an OAuth 2.0 authorization flow with Oura. The user is redirected to Oura's authorization page, approves access, and is returned to the confirmation screen. A connected state confirmation is shown if the user navigates back to this screen after connecting.

   This step is fully optional. Skipping does not affect any other part of the product.
7. Confirmation screen with Láyo wordmark, checkmark icon, and copy: "You're all set, [name]. Come back tomorrow morning and Láyo will be ready for your first check-in."

The onboarding flow is fully client-side — see Flow 2 for flow architecture notes. The same applies here, with the exception of the Oura connect step, which requires a browser redirect to Oura's servers and back (standard OAuth 2.0).

All onboarding question screens (steps 2 through 6) include a back button (top-left) and a close/exit button (top-right). Tapping close abandons the onboarding session without saving; the user will be returned to onboarding on next launch.

Onboarding data is only written to the database when the user reaches and completes the confirmation screen (step 7). Abandoning mid-flow discards all entered data. The Oura connection, if completed, is written to the database at the time the OAuth callback is processed — before the confirmation screen is shown.

**Submission error handling:** If the `POST /api/users` call fails, the user remains on the confirmation screen and sees an inline error message with a retry CTA. If they tap retry without refreshing, their entered data is still in React state and they do not need to re-enter it. The error message is direct and action-oriented.

**Outcome:** User and user profile written to the database. deviceId generated and persisted to localStorage. If Oura was connected, wearable credentials stored and 90-day historical data fetched. User lands on the daily check-in flow.

---

### Account recovery (/restore)

A manual way to restore access to an existing account in a browser context that has no local `deviceId`, most commonly an iOS home screen bookmark, which runs in a storage context isolated from Safari (see `docs/specs/account-recovery.md` for the full spec and rationale).

**Entry point:** the "Already used Láyo?" link on the onboarding "name" step (see Flow 1, step 2). `/restore` is a dedicated route, not another step inside the onboarding flow's internal state.

**Content:**
- Heading: "Welcome back"
- Subtext: "Paste what's on your profile page to get your data back."
- Text input for pasting the value
- CTA: "Continue"

**Behavior:** on submit, the pasted value is validated against the backend (reusing `GET /api/users`; no new API endpoint). If it matches an existing user, it's persisted to this browser's localStorage and the user is routed to `/check-in` or `/recommendation` via the normal entry-point logic, bypassing the rest of onboarding entirely. If it doesn't match, an inline error appears: "We don't recognize that. Double check what you pasted and try again," and the user can retry or go back to onboarding.

**Where the value comes from:** `/profile` (see below) displays the current device's value with a "Copy" button, alongside instructions to use it when switching devices or browsers.

---

### Flow 2: Daily check-in

Triggered each time the user opens the app after onboarding is complete. If a check-in has already been submitted for the current calendar day, the user is taken directly to the recommendation view (Flow 3).

#### Landing screen

The first screen the user sees on opening the app on a new day. Displays a time-based greeting ("Good morning," "Good afternoon," or "Good evening" based on device time), the user's name, a brief prompt, and a single CTA to begin the check-in. Text is top/left-aligned; CTA is pinned to the bottom.

Copy:
- Greeting: "Good morning / Good afternoon / Good evening" (time-based, rendered client-side)
- Heading: "Ready for today, [name]?"
- Subtext: "It takes about two minutes. Láyo will take it from there."
- CTA: "Start today's check-in"

#### Flow architecture

The onboarding and check-in flows are fully client-side multi-step experiences. All questions and flow logic live in the client bundle — there are no per-question API calls. The only API calls in each flow are the single submission call at completion.

Flow state (current step and entered answers) lives in React component state only. It is not persisted to localStorage. If the page refreshes mid-flow or after a submission failure, the user restarts the flow. localStorage is used solely for deviceId persistence.

#### Check-in questions

Questions are presented sequentially, one screen at a time, in a conversational cadence. All question screens include a back button (top-left), progress dots (center), and a close/exit button (top-right). Tapping close abandons the check-in session without saving; the user can return later to start a fresh check-in.

Check-in data is only submitted to the server when the user completes the final question and the generating state begins. Abandoning mid-flow discards all entered data for that session.

**Questions, in order:**

1. **Yesterday's workout**
   "What did you do yesterday?"
   Subtext: "Pick the closest match."
   Three tappable cards, each with an icon and label:
   - "Your planned workout" — displays the workout the user entered as today's plan on the previous day's check-in, if available
   - "Láyo's suggested alternative" — shown only when yesterday's recommendation was `modify` or `rest`; displays the recommendation heading from that day
   - "Something else" — expands into a free-form text input

   If there is no check-in record for the previous calendar day (i.e. the user skipped one or more days), this question and the following feedback question are omitted. The check-in proceeds from question 3.

2. **Yesterday's workout feedback**
   "How did it go?"
   Subtext: "Anything worth noting about the session."
   Free-form text input. Optional (includes Skip link). Character limit: 280. Omitted if yesterday's workout question is omitted.

3. **Today's planned workout**
   "What workout do you have planned today?"
   Subtext: "Be as specific as you like: distance, pace, intensity."
   Free-form text input. Required. Character limit: 280.

4. **Sleep satisfaction and subjective feel** (shown on one screen)
   "How satisfied are you with how you slept?" — 1–5 scale. Scale labels: 1 = unsatisfied, 5 = satisfied. Required.
   Subtext: "Do you feel like you got enough sleep last night?"
   "How do you feel?" — 1–5 scale. Scale labels: 1 = dragging, 5 = ready to go. Required.
   Subtext: "How ready are you to tackle today?"

   This question is shown to all users regardless of wearable connection status. The sleep satisfaction score captures subjective perception; for users with Oura connected, the Oura sleep score is passed separately to the LLM and is not surfaced in the check-in UI.

5. **Cycle tracking** (shown only if user selected "Menstruating" during onboarding)
   "Did your period start today?"
   Subtext: "Láyo uses this to track where you are in your cycle. It stays private."
   Yes / No binary selection. Required if shown.

6. **Acute stressors**
   "Anything new since yesterday?"
   Subtext: "Travel, illness, bad news, a harder-than-usual day? This helps Láyo read the full picture."
   Free-form text input. Optional (includes Skip link). Character limit: 280.

#### Generating state

Displayed after the final question is submitted while the LLM recommendation is produced. Shows a spinner, a header string that rotates through the pool below every 3 seconds, and a constant subtext.

Header copy — rotated randomly every 3 seconds:
- "Reading the full picture..."
- "Let's see what we've got..."
- "Putting it all together..."
- "Give us just a moment..."
- "Almost ready for you..."
- "Working out the details..."
- "Checking in on everything..."

Subtext (constant): "Láyo is working on your recommendation for today."

**Submission error handling:** Two distinct failure cases:

1. **Check-in save fails** (`POST /api/check-ins` returns an error before LLM generation begins): User sees an error state on the generating screen with a retry CTA. Entered data remains in React state for the duration of the session so the user can retry without re-entering anything, provided they do not refresh the page.
2. **Recommendation generation fails** (check-in saves successfully but LLM call fails or times out): The check-in record is retained in the database. The user sees an error state with a retry CTA. The retry re-submits `POST /api/check-ins` with the same data — upsert semantics mean this is safe, and LLM generation runs again against the existing check-in record.

In both cases the error message is direct and action-oriented. The user is never dropped silently back to the landing screen.

**Outcome:** Check-in data written to the database. Wearable data fetched and baseline computed (for connected users). Recommendation generated. User navigated to recommendation view.

---

### Flow 3: Recommendation view

Displayed after check-in submission, and on all subsequent app opens for the same calendar day.

**Content:**

- Colored overline label: "Today's recommendation" — color corresponds to recommendation type (see design brief)
- Recommendation heading, stated directly and specifically:
  - "Do your workout as planned." (as written)
  - "[Specific modification instruction]." (modify)
  - "Take a rest day today." (rest)
- A 2px colored divider line beneath the heading
- Rationale — a short, conversational explanation of why. Combined character limit for heading and rationale: 400 characters.
- Compact summary card showing today's check-in data: sleep satisfaction score, feel score, cycle day (if applicable), planned workout (truncated at ~40 characters with ellipsis if needed), yesterday's outcome, stressors (if any)
- "Redo today's check-in" — grey text link with reload icon, bottom-right, no button styling

**Behavior:**
- The recommendation and rationale are generated by the LLM at check-in submission time and stored; they do not regenerate on each page load
- Tapping the planned workout value in the summary card expands it to show the full, untruncated text. Tapping it again collapses it back to the truncated single-line presentation. This is the only summary row with this behavior.
- "Redo today's check-in" triggers a confirmation prompt: "This will delete your check-in and recommendation for today. This cannot be undone." with CTAs: "Delete and redo" (proceed) and "Cancel" (dismiss). If confirmed, today's check-in record and recommendation are cleared and the user is returned to the check-in landing screen. The user can abandon a redo mid-flow by closing the app and return later to complete a fresh check-in.

---

### Diagnostic page: Profile (`/profile`)

Not part of the numbered flows above: there is no navigation entry point to this page from within the app. Users reach it only by typing the URL directly, when asked to for troubleshooting during beta testing.

**Content:** a card displaying:

- User ID (the database record corresponding to this device)
- Oura Ring connection status ("Connected" or "Not connected")
- Recommendation Engine (the active prompt config version)

Below the card, a separate instructional block: "Switching devices? Copy this and paste it in when Láyo asks." with the device's value and a "Copy" button. This is used together with `/restore` (see Account recovery above) to move access to a new browser context.

**Navigation:** a back button (top-left) returns to the app root (`/`). The Láyo wordmark appears top-left, same position as all other screens. No other navigation.

**Behavior:** if no `deviceId` is found in localStorage, the user is redirected to onboarding rather than shown an empty or broken page.

This is a minimal diagnostic surface for the current beta. Full profile management (settings, data management, authentication) is out of scope for this version. See `docs/specs/profile-page.md` for the full spec.

---

## Recommendation logic

The recommendation is generated via the configured LLM provider. The LLM receives a structured prompt containing:

- User profile (name, calculated age from birth year, hormonal life stage, race details if applicable)
- Today's planned workout
- Yesterday's workout (what was done and how it went, if available)
- Sleep satisfaction score (1–5, subjective)
- Subjective feel score (1–5)
- Cycle day (if tracked)
- Acute stressors (if provided)
- Historical check-in summary (rolling window of recent check-ins to establish baseline, where available)
- Wearable data context (for connected users) — today's objective metrics with deltas against 90-day rolling baseline, or a note that today's device data is not yet synced (see `docs/specs/wearable-integration.md`)

**Output:** One of three recommendation types (as_written, modify, rest), a user-facing rationale string, and internal reasoning fields stored separately.

**Behavioral constraints for the LLM prompt:**
- Do not capitulate immediately on low readiness scores. Many athletes perform and recover well under suboptimal conditions. Read the full picture.
- Modifications must be specific, not vague ("reduce volume by 30% and keep intensity" not "take it easy today")
- Rationale must be direct and conversational, not clinical or hedge-heavy
- Recommendations must account for proximity to goal race where applicable (taper logic in final 2 weeks; peak week quality prioritization)
- Wearable data is objective context, not a sole decision input. Subjective feel and wearable data can legitimately diverge. Do not cite specific numeric values from wearable data in user-facing rationale unless directly relevant.
- Weight subjective inputs more heavily when today's wearable data is absent.

The following must be configurable without touching core code or business logic, and without requiring a full redeployment:

- **LLM model** — configurable via environment variable
- **System prompt text** — the full instruction set sent to the LLM
- **Inference parameters** — temperature, max tokens, top_p, and any other model-specific parameters

Prompt text and inference parameters are stored in a versioned `prompt_configs` table in the database and fetched at inference time. This allows prompts and parameters to be updated and tested in live conditions without a code deployment. The `prompt_version` field in the LLM inference log references the specific `prompt_configs` row used to generate each recommendation, making every output permanently traceable to the exact prompt and parameters that produced it.

For full wearable integration spec including LLM context format, fallback behavior, and baseline computation, see `docs/specs/wearable-integration.md`.

---

## Data model

### Users
Identity anchor. Rarely changes after creation.

- `id` (uuid, primary key)
- `device_id` (string, unique — used as account identifier until auth is implemented)
- `created_at` (timestamp)

### User profiles
Linked one-to-one to a user. Contains everything the user reported during onboarding. Editable in future versions.

- `id` (uuid, primary key)
- `user_id` (uuid, foreign key, unique)
- `name` (string)
- `birth_year` (integer — used to calculate current age at any point; asked during onboarding as "What year were you born?")
- `hormonal_life_stage` (string array — one or more of: menstruating, pregnant, menopausal, post-menopausal, on_birth_control, on_hrt)
- `training_goal` (enum: race | non-race)
- `created_at` (timestamp)
- `updated_at` (timestamp)

### Events
Separate table supporting multiple races per user. In the current implementation only one event is collected during onboarding, but the schema supports future event management. The active/primary race is inferred from the soonest future event_date. Event ordering, archiving, and deletion are deferred until events become a first-class manageable entity in the product.

- `id` (uuid, primary key)
- `user_id` (uuid, foreign key)
- `event_name` (string)
- `event_type` (enum: running | cycling | swimming | triathlon | skiing | other)
- `event_type_other` (string, nullable — populated if event_type is "other")
- `event_date` (date)
- `created_at` (timestamp)
- `updated_at` (timestamp)

### Daily check-ins
- `id` (uuid, primary key)
- `user_id` (uuid, foreign key)
- `check_in_date` (date — the user's local calendar date as reported by the client; stored as-is with no UTC conversion)
- `yesterday_workout_type` (enum: planned | suggested | other, nullable — null if previous day's check-in does not exist)
- `yesterday_workout_description` (string, nullable — populated if type is "other")
- `yesterday_workout_feedback` (string, nullable — null if previous day's check-in does not exist)
- `todays_planned_workout` (string, max 280 characters)
- `sleep_satisfaction` (integer 1–5 — subjective satisfaction with sleep; replaces `sleep_score` from v0.1.0)
- `feel_score` (integer 1–5)
- `period_started_today` (boolean, nullable — null if user is not menstruating)
- `cycle_day` (integer, nullable — calculated server-side from period tracking history; null if user is not menstruating or has not yet reported a period start. Calculation: (check_in_date minus date of most recent check-in where period_started_today = true) + 1. Calculation is date-based, so gap days from skipped check-ins are included naturally.)
- `stressors` (string, nullable, max 280 characters)
- `created_at` (timestamp)

### Recommendations
- `id` (uuid, primary key)
- `check_in_id` (uuid, foreign key, unique)
- `user_id` (uuid, foreign key)
- `recommendation_type` (enum: as_written | modify | rest)
- `modification_detail` (string, nullable — populated if type is "modify"; combined with rationale, max 400 characters for user-facing display)
- `rationale` (string — user-facing explanation; combined with modification_detail, max 400 characters for display)
- `created_at` (timestamp)

### Prompt configs
Versioned store of LLM prompt text and inference parameters. Fetched at inference time so prompts can be updated without code changes or redeployment.

- `id` (uuid, primary key)
- `version` (string — semantic version identifier, e.g. "1.0.0")
- `system_prompt` (text — full system prompt text sent to the LLM)
- `temperature` (float — inference temperature parameter)
- `max_tokens` (integer — maximum output tokens)
- `additional_params` (jsonb, nullable — any additional model-specific inference parameters)
- `notes` (text, nullable — human-readable description of what changed and why)
- `created_at` (timestamp)

### LLM inference log
Separate table linked one-to-one to a recommendation. Stores observability and debugging data for internal analysis; no fields are shown to the user.

- `id` (uuid, primary key)
- `recommendation_id` (uuid, foreign key, unique)
- `model` (string — model identifier used to generate this recommendation)
- `prompt_version` (string — references the `version` field of the prompt_configs row used to generate this recommendation)
- `raw_response` (text — full unmodified LLM response before any parsing)
- `rationale_internal` (text — full internal rationale from the LLM, which may be more detailed than the user-facing rationale)
- `readiness_score` (integer 0–100 — model-calculated readiness score based on physiological inputs only, before event-proximity or training-load logic is applied)
- `input_tokens` (integer — token count of the prompt)
- `output_tokens` (integer — token count of the response)
- `latency_ms` (integer — time in milliseconds from API request to response)
- `created_at` (timestamp)

### Wearable connections
One row per user per provider. Stores OAuth credentials and connection state. See `docs/specs/wearable-integration.md` for full schema.

- `id` (uuid, primary key)
- `user_id` (uuid, foreign key)
- `provider` (enum: oura — extensible to additional providers)
- `access_token` (encrypted string)
- `refresh_token` (encrypted string)
- `token_expires_at` (timestamp)
- `status` (enum: active | inactive)
- `connected_at` (timestamp)
- `updated_at` (timestamp)

### Wearable daily metrics
One row per user per provider per date. Stores normalized metric values from the provider. See `docs/specs/wearable-integration.md` for full schema and field mapping.

- `id` (uuid, primary key)
- `user_id` (uuid, foreign key)
- `connection_id` (uuid, foreign key)
- `provider` (enum: oura)
- `metric_date` (date)
- `readiness_score` (integer, nullable)
- `hrv_avg` (float, nullable)
- `resting_heart_rate` (integer, nullable)
- `sleep_score` (integer, nullable)
- `sleep_duration_minutes` (integer, nullable)
- `deep_sleep_minutes` (integer, nullable)
- `rem_sleep_minutes` (integer, nullable)
- `sleep_efficiency` (float, nullable)
- `body_temp_deviation` (float, nullable)
- `raw_data` (jsonb — full provider response)
- `created_at` (timestamp)

---

## Technical requirements

- **Stack:** Next.js + TypeScript + Tailwind CSS
- **Hosting:** Vercel
- **Database:** Neon Postgres (production), local Postgres (development), Prisma ORM
- **Device identity:** deviceId generated on first launch, stored in localStorage, sent with all API requests
- **LLM:** Provider-abstracted; default provider is Anthropic API. Provider and model are configurable via environment variables (`LLM_PROVIDER`, `LLM_MODEL`) with no code changes required to swap. Provider-specific SDK implementations are isolated from shared inference logic.
- **Wearable integrations:** Provider-abstracted via `lib/wearables/`. First provider: Oura Ring (OAuth 2.0 with PKCE). Architecture supports additional providers without structural changes.
- **Icons:** Tabler Icons webfont
- **Error logging:** Sentry
- **Authentication:** None currently. deviceId is the sole account identifier.

---

## Non-functional requirements

- The app must be usable on mobile (primary use case: morning check-in on a phone)
- Check-in submission and recommendation generation must complete within 10 seconds under normal conditions
- If recommendation generation fails, the user must be able to retry without re-entering check-in data, provided they have not refreshed the page (React state is not persisted across page refreshes)
- No personally identifiable data beyond name and birth year is collected; no email address is required
- Wearable OAuth tokens are encrypted at rest using AES-256-GCM

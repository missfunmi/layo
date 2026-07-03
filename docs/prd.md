# Láyo — Product Requirements Document

## Overview

Láyo is a fitness coaching assistant for female athletes. It prompts users through a daily check-in, reconciles their responses against their reported workout plan, and delivers a specific, reasoned recommendation: execute as planned, modify, or rest. The product learns the user over time, building a personal baseline rather than applying generic rules.

---

## Problem statement

Female endurance athletes training with structured plans face a recurring decision every morning: do I execute today's workout as written, modify it, or rest? Generic training tools give no guidance on this. Coaches do not proactively raise hormonal or recovery context. Athletes are left to make this call alone, often defaulting to push-through regardless of their actual physiological state.

Láyo closes this gap with a daily check-in that takes two minutes, reads the full picture — sleep, subjective feel, yesterday's outcome, cycle day, and acute stressors — and gives a direct, reasoned recommendation.

---

## User flows

### Flow 1: Onboarding (one-time)

Triggered on first launch when no deviceId is found in localStorage.

**Steps:**

1. Welcome screen with Láyo wordmark centered
2. "What should we call you?" — text input (name)
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
6. Confirmation screen with Láyo wordmark, checkmark icon, and copy: "You're all set, [name]. Come back tomorrow morning and Láyo will be ready for your first check-in."

The onboarding flow is fully client-side — see Flow 2 for flow architecture notes. The same applies here.

All onboarding question screens (steps 2 through 5) include a back button (top-left) and a close/exit button (top-right). Tapping close abandons the onboarding session without saving; the user will be returned to onboarding on next launch.

Onboarding data is only written to the database when the user reaches and completes the confirmation screen (step 7). Abandoning mid-flow discards all entered data.

**Submission error handling:** If the `POST /api/users` call fails, the user remains on the confirmation screen and sees an inline error message with a retry CTA. If they tap retry without refreshing, their entered data is still in React state and they do not need to re-enter it. The error message is direct and action-oriented.

**Outcome:** User and user profile written to the database. deviceId generated and persisted to localStorage. User lands on the daily check-in flow.

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
   - "Láyo's suggested workout" — displays Láyo's recommendation from the previous day, if it differed from planned
   - "Something else" — expands into a free-form text input

   If there is no check-in record for the previous calendar day (i.e. the user skipped one or more days), this question and the following feedback question are omitted. The check-in proceeds from question 3.

2. **Yesterday's workout feedback**
   "How did it go?"
   Subtext: "Anything worth noting about the session."
   Free-form text input. Optional (includes Skip link). Character limit: 280. Omitted if yesterday's workout question is omitted.

3. **Today's planned workout**
   "What workout do you have planned today?"
   Subtext: "Be as specific as you like — distance, pace, intensity."
   Free-form text input. Required. Character limit: 280.

4. **Sleep quality and subjective feel** (shown on one screen)
   "How did you sleep?" — 1–5 scale. Scale labels: 1 = rough, 5 = great. Required.
   "How do you feel?" — 1–5 scale. Scale labels: 1 = dragging, 5 = ready to go. Required.

5. **Cycle tracking** (shown only if user selected "Menstruating" during onboarding)
   "Did your period start today?"
   Subtext: "Láyo uses this to track where you are in your cycle. It stays private."
   Yes / No binary selection. Required if shown.

6. **Acute stressors**
   "Anything new since yesterday?"
   Subtext: "Travel, illness, bad news, a harder-than-usual day? This helps Láyo read the full picture."
   Free-form text input. Optional (includes Skip link). Character limit: 280.

#### Generating state

Displayed after the final question is submitted while the LLM recommendation is produced. Shows a spinner, a randomly chosen header string, and a constant subtext.

Header copy — one chosen at random per load:
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

**Outcome:** Check-in data written to the database. Recommendation generated. User navigated to recommendation view.

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
- Compact summary card showing today's check-in data: sleep score, feel score, cycle day (if applicable), planned workout (truncated at ~40 characters with ellipsis if needed), yesterday's outcome, stressors (if any)
- "Redo today's check-in" — grey text link with reload icon, bottom-right, no button styling

**Behavior:**
- The recommendation and rationale are generated by the LLM at check-in submission time and stored; they do not regenerate on each page load
- "Redo today's check-in" triggers a confirmation prompt: "This will delete your check-in and recommendation for today. This cannot be undone." with CTAs: "Delete and redo" (proceed) and "Cancel" (dismiss). If confirmed, today's check-in record and recommendation are cleared and the user is returned to the check-in landing screen. The user can abandon a redo mid-flow by closing the app and return later to complete a fresh check-in.

---

## Recommendation logic

The recommendation is generated via the configured LLM provider. The LLM receives a structured prompt containing:

- User profile (name, calculated age from birth year, hormonal life stage, race details if applicable)
- Today's planned workout
- Yesterday's workout (what was done and how it went, if available)
- Sleep score (1–5)
- Subjective feel score (1–5)
- Cycle day (if tracked)
- Acute stressors (if provided)
- Historical check-in summary (rolling window of recent check-ins to establish baseline, where available)

**Output:** One of three recommendation types (as_written, modify, rest), a user-facing rationale string, and internal reasoning fields stored separately.

**Behavioral constraints for the LLM prompt:**
- Do not capitulate immediately on low readiness scores. Many athletes perform and recover well under suboptimal conditions. Read the full picture.
- Modifications must be specific, not vague ("reduce volume by 30% and keep intensity" not "take it easy today")
- Rationale must be direct and conversational, not clinical or hedge-heavy
- Recommendations must account for proximity to goal race where applicable (taper logic in final 2 weeks; peak week quality prioritization)

The following must be configurable without touching core code or business logic, and without requiring a full redeployment:

- **LLM model** — configurable via environment variable
- **System prompt text** — the full instruction set sent to the LLM
- **Inference parameters** — temperature, max tokens, top_p, and any other model-specific parameters

Prompt text and inference parameters are stored in a versioned `prompt_configs` table in the database and fetched at inference time. This allows prompts and parameters to be updated and tested in live conditions without a code deployment. The `prompt_version` field in the LLM inference log references the specific `prompt_configs` row used to generate each recommendation, making every output permanently traceable to the exact prompt and parameters that produced it.

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
- `sleep_score` (integer 1–5)
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

---

## Technical requirements

- **Stack:** Next.js + TypeScript + Tailwind CSS
- **Hosting:** Vercel
- **Database:** Neon Postgres (production), local Postgres (development), Prisma ORM
- **Device identity:** deviceId generated on first launch, stored in localStorage, sent with all API requests
- **LLM:** Provider-abstracted; default provider is Anthropic API. Provider and model are configurable via environment variables (`LLM_PROVIDER`, `LLM_MODEL`) with no code changes required to swap. Provider-specific SDK implementations are isolated from shared inference logic.
- **Icons:** Tabler Icons webfont
- **Error logging:** Sentry
- **Authentication:** None currently. deviceId is the sole account identifier.

---

## Non-functional requirements

- The app must be usable on mobile (primary use case: morning check-in on a phone)
- Check-in submission and recommendation generation must complete within 10 seconds under normal conditions
- If recommendation generation fails, the user must be able to retry without re-entering check-in data, provided they have not refreshed the page (React state is not persisted across page refreshes)
- No personally identifiable data beyond name and birth year is collected; no email address is required

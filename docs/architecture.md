# Láyo — Architecture

## Overview

This document describes the technical architecture of Láyo. It is the authoritative reference for implementation decisions and should be read alongside `docs/prd.md` (what the product does) and `docs/mockups/` (how it looks). This document covers how it is built.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS |
| ORM | Prisma |
| Database (production) | Neon Postgres (Vercel integration) |
| Database (development) | Local Postgres |
| LLM | Provider-abstracted via `lib/llm/` (default: Anthropic API; swappable via `LLM_PROVIDER` and `LLM_MODEL` env vars) |
| Hosting | Vercel |
| Error logging | Sentry |
| Icons | Tabler Icons webfont |

---

## Project structure

```
layo/
├── app/
│   ├── layout.tsx                  # Root layout with Sentry, fonts
│   ├── page.tsx                    # Entry point — routing logic only
│   ├── onboarding/
│   │   └── page.tsx
│   ├── check-in/
│   │   └── page.tsx
│   └── recommendation/
│       └── page.tsx
├── components/
│   ├── ui/                         # Primitives: Button, Card, ScaleInput, PillSelect, OptionCard, etc.
│   └── flows/                      # Flow-specific composite components
│       ├── onboarding/
│       └── check-in/
├── lib/
│   ├── db.ts                       # Prisma client singleton
│   ├── device.ts                   # deviceId generation and localStorage read/write
│   ├── cycle.ts                    # Cycle day calculation
│   └── llm/
│       ├── index.ts                # Provider-agnostic interface: loads prompt config, builds user message, parses and validates response, logs to Sentry
│       ├── types.ts                # Shared LLMProvider interface and response types
│       └── providers/
│           ├── anthropic.ts        # Anthropic SDK invocation
│           └── gemini.ts           # Gemini SDK invocation (placeholder)
├── app/api/
│   ├── users/route.ts              # POST /api/users
│   ├── check-ins/
│   │   └── route.ts                # POST /api/check-ins, GET /api/check-ins?date=, DELETE /api/check-ins?date=
│   └── recommendations/
│       └── route.ts                # GET /api/recommendations?date=
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── docs/
│   ├── design-brief.md
│   ├── prd.md
│   ├── architecture.md
│   ├── mockups/
│   └── specs/
└── public/
    ├── layo-logo-light.svg
    └── layo-logo-dark.svg
```

---

## Routing and navigation

The entry point (`app/page.tsx`) runs client-side on mount and routes the user to the correct screen:

1. Is there a `deviceId` in localStorage?
   - No → redirect to `/onboarding`
2. Does a check-in record exist for today (`GET /api/check-ins?date={today}`)?
   - No → redirect to `/check-in`
   - Yes → redirect to `/recommendation`

No persistent navigation chrome exists. Each screen is self-contained. The Láyo wordmark in the header is not a navigation link.

---

## Device identity

On first launch (no `deviceId` in localStorage), a UUID v4 is generated client-side and stored in localStorage under the key `layo_device_id`. This is the sole account identifier until authentication is implemented.

```typescript
// lib/device.ts
const DEVICE_ID_KEY = 'layo_device_id'

export function getOrCreateDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY)
  if (!deviceId) {
    deviceId = crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_KEY, deviceId)
  }
  return deviceId
}
```

All API route handlers resolve the user via the `X-Device-ID` request header. If the header is missing or no matching user is found, the API returns `401`. The client handles this by redirecting to `/onboarding`.

**Limitation:** localStorage-based deviceId does not survive a browser reset or device wipe. If a user loses their localStorage, they lose access to their account and all historical data, as a new deviceId will be generated on next launch. This is a known limitation of the current implementation. The planned long-term fix is proper authentication (email/password or OAuth), at which point deviceId becomes a secondary fallback. No manual recovery mechanism exists in the current implementation.

---

## Client-side flow architecture

Both the onboarding and check-in flows are fully client-side multi-step experiences. All questions and flow logic live in the client bundle — there are no per-question API calls. Flow state (current step and entered answers) lives in React component state only and is not persisted to localStorage.

The only API calls in each flow are:
- `POST /api/users` — once, at onboarding completion
- `POST /api/check-ins` — once, at check-in completion

If the user refreshes mid-flow or after a submission failure, React state is lost and the flow restarts from the beginning. This is acceptable for the current implementation. The retry CTA on error screens re-submits the same API call — upsert semantics on both endpoints mean this is safe regardless of whether the previous attempt partially succeeded.

---

## Database schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id              String           @id @default(uuid())
  deviceId        String           @unique @map("device_id")
  createdAt       DateTime         @default(now()) @map("created_at")
  profile         UserProfile?
  events          Event[]
  checkIns        CheckIn[]
  recommendations Recommendation[]

  @@map("users")
}

model UserProfile {
  id                String       @id @default(uuid())
  userId            String       @unique @map("user_id")
  user              User         @relation(fields: [userId], references: [id])
  name              String
  birthYear         Int          @map("birth_year")
  hormonalLifeStage String[]     @map("hormonal_life_stage")
  trainingGoal      TrainingGoal @map("training_goal")
  createdAt         DateTime     @default(now()) @map("created_at")
  updatedAt         DateTime     @updatedAt @map("updated_at")

  @@map("user_profiles")
}

model Event {
  id             String    @id @default(uuid())
  userId         String    @map("user_id")
  user           User      @relation(fields: [userId], references: [id])
  eventName      String    @map("event_name")
  eventType      EventType @map("event_type")
  eventTypeOther String?   @map("event_type_other")
  eventDate      DateTime  @map("event_date") @db.Date
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")

  @@map("events")
}

model CheckIn {
  id                          String                @id @default(uuid())
  userId                      String                @map("user_id")
  user                        User                  @relation(fields: [userId], references: [id])
  checkInDate                 DateTime              @map("check_in_date") @db.Date
  yesterdayWorkoutType        YesterdayWorkoutType? @map("yesterday_workout_type")
  yesterdayWorkoutDescription String?               @map("yesterday_workout_description")
  yesterdayWorkoutFeedback    String?               @map("yesterday_workout_feedback")
  todaysPlannedWorkout        String                @map("todays_planned_workout")
  sleepScore                  Int                   @map("sleep_score")
  feelScore                   Int                   @map("feel_score")
  periodStartedToday          Boolean?              @map("period_started_today")
  cycleDay                    Int?                  @map("cycle_day")
  stressors                   String?
  createdAt                   DateTime              @default(now()) @map("created_at")
  recommendation              Recommendation?

  @@unique([userId, checkInDate])
  @@map("check_ins")
}

model Recommendation {
  id                 String             @id @default(uuid())
  checkInId          String             @unique @map("check_in_id")
  checkIn            CheckIn            @relation(fields: [checkInId], references: [id])
  userId             String             @map("user_id")
  user               User               @relation(fields: [userId], references: [id])
  recommendationType RecommendationType @map("recommendation_type")
  modificationDetail String?            @map("modification_detail")
  rationale          String
  createdAt          DateTime           @default(now()) @map("created_at")
  llmInferenceLog    LlmInferenceLog?

  @@map("recommendations")
}

model PromptConfig {
  id               String   @id @default(uuid())
  version          String   @unique
  systemPrompt     String   @map("system_prompt") @db.Text
  temperature      Float
  maxTokens        Int      @map("max_tokens")
  additionalParams Json?    @map("additional_params")
  notes            String?  @db.Text
  createdAt        DateTime @default(now()) @map("created_at")

  @@map("prompt_configs")
}

model LlmInferenceLog {
  id                String         @id @default(uuid())
  recommendationId  String         @unique @map("recommendation_id")
  recommendation    Recommendation @relation(fields: [recommendationId], references: [id])
  model             String
  promptVersion     String         @map("prompt_version")
  rawResponse       String         @map("raw_response") @db.Text
  rationaleInternal String         @map("rationale_internal") @db.Text
  readinessScore    Int            @map("readiness_score")
  inputTokens       Int            @map("input_tokens")
  outputTokens      Int            @map("output_tokens")
  latencyMs         Int            @map("latency_ms")
  createdAt         DateTime       @default(now()) @map("created_at")

  @@map("llm_inference_logs")
}

enum TrainingGoal {
  race
  non_race
}

enum EventType {
  running
  cycling
  swimming
  triathlon
  skiing
  other
}

enum YesterdayWorkoutType {
  planned
  suggested
  other
}

enum RecommendationType {
  as_written
  modify
  rest
}
```

### Key indexes and constraints

Prisma `@unique` directives automatically create unique indexes. Additional non-unique indexes are added explicitly for frequently queried foreign keys.

- `users.device_id`: unique index (auto-created by `@unique`) — also used for upsert
- `user_profiles.user_id`: unique index (auto-created by `@unique`)
- `check_ins.(user_id, check_in_date)`: composite unique index (auto-created by `@@unique`) — enforces one check-in per user per day; used for upsert and date-scoped queries
- `check_ins.user_id`: non-unique index — for querying a user's check-in history
- `check_ins.check_in_date`: non-unique index — for date-scoped queries
- `recommendations.user_id`: non-unique index — for querying a user's recommendation history
- `recommendations.check_in_id`: unique index (auto-created by `@unique`)
- `events.user_id`: non-unique index — for querying a user's events
- `llm_inference_logs.recommendation_id`: unique index (auto-created by `@unique`)
- `prompt_configs.version`: unique index (auto-created by `@unique`)

---

## API routes

All routes return JSON. All routes except `POST /api/users` require the `X-Device-ID` header. Missing header or unknown deviceId returns `401`.

### Upsert semantics

Both `POST /api/users` and `POST /api/check-ins` use upsert rather than insert. This means retrying a failed submission is always safe — the client does not need to know whether the previous attempt partially succeeded. There is no separate retry endpoint.

A near-term improvement is to add idempotency key support (client generates a UUID per submission attempt, server deduplicates on it), but this is not required for the current implementation given the small user base.

---

### POST /api/users
Creates or updates a user, user profile, and first event (if training for a race). Called on onboarding completion. Upserts on `device_id`.

**Request body:**
```typescript
{
  deviceId: string
  name: string
  birthYear: number
  hormonalLifeStage: string[]
  trainingGoal: 'race' | 'non_race'
  eventName?: string
  eventType?: 'running' | 'cycling' | 'swimming' | 'triathlon' | 'skiing' | 'other'
  eventTypeOther?: string
  eventDate?: string  // ISO date string, must be a future date
}
```

**Response:** `201` with `{ userId: string }`

---

### POST /api/check-ins
Submits today's check-in, calculates cycle day, generates a recommendation, and persists everything atomically. Upserts on `(user_id, check_in_date)`.

**Request body:**
```typescript
{
  checkInDate: string             // ISO date string — client's local calendar date (e.g. "2026-06-25")
  yesterdayWorkoutType?: 'planned' | 'suggested' | 'other'
  yesterdayWorkoutDescription?: string
  yesterdayWorkoutFeedback?: string
  todaysPlannedWorkout: string
  sleepScore: number              // 1–5
  feelScore: number               // 1–5
  periodStartedToday?: boolean
  stressors?: string
}
```

**Response:** `201` with recommendation (type, modification detail, rationale).

**Behavior:**
1. Resolve user from `X-Device-ID`
2. Validate inputs (see Input validation)
3. Calculate `cycleDay`
4. Fetch active prompt config (latest by `created_at`)
5. Fetch rolling history (last 14 check-ins) for LLM context
6. Call LLM, measure latency
7. Parse LLM response
8. Upsert check-in, upsert recommendation, insert LLM inference log — all in a single transaction
9. Return recommendation to client

**Error:** If LLM call fails or response cannot be parsed, the check-in record is retained and `503` is returned with a retryable error payload. The client re-submits `POST /api/check-ins` on retry — upsert semantics make this safe.

---

### GET /api/check-ins?date={date}
Returns the check-in for the given date. `date` is an ISO date string (e.g. `2026-06-25`). Used by the entry point routing logic to determine whether a check-in exists for today.

**Response:** `200` with `{ checkIn: <data> }` if a check-in exists, or `200` with `{ checkIn: null }` if not.

---

### DELETE /api/check-ins?date={date}
Deletes the check-in for the given date and its associated recommendation and LLM inference log. Called after the user confirms the "Redo" action.

**Response:** `204`.

---

### GET /api/recommendations?date={date}
Returns the recommendation for the given date.

**Response:** `200` with `{ recommendation: <data> }` if a recommendation exists, or `200` with `{ recommendation: null }` if not.

---

## Input validation

Validation is applied both client-side (immediate UI feedback) and server-side (source of truth). Server-side validation takes precedence. All string fields are trimmed of leading and trailing whitespace before validation and before saving.

### User profile fields

| Field | Client-side rule | Server-side rule |
|---|---|---|
| `name` | Required, 1–50 chars | Required, 1–50 chars |
| `birthYear` | Required, 4 digits, `currentYear - 100` to `currentYear - 13` | Required, integer, `currentYear - 100` to `currentYear - 13` |
| `hormonalLifeStage` | At least one selection | Array, min 1 element, values must be from the allowed set |
| `trainingGoal` | Required selection | Must be `race` or `non_race` |

### Event fields (if `trainingGoal` is `race`)

| Field | Client-side rule | Server-side rule |
|---|---|---|
| `eventName` | Required, 1–100 chars | Required, 1–100 chars |
| `eventType` | Required selection | Must be a valid `EventType` enum value |
| `eventTypeOther` | Required if type is "other", 1–50 chars | Required if `eventType` is `other`, 1–50 chars |
| `eventDate` | Required, must be a future date (after today's device date) | Required, valid date, must be after UTC today |

### Check-in fields

| Field | Client-side rule | Server-side rule |
|---|---|---|
| `checkInDate` | Must equal today's device date (set programmatically, not user-entered) | Valid date, not more than 1 day in the future relative to UTC (tolerates UTC+14) |
| `todaysPlannedWorkout` | Required, 1–280 chars | Required, 1–280 chars |
| `yesterdayWorkoutType` | Required if yesterday question is shown | Must be `planned`, `suggested`, or `other` if provided |
| `yesterdayWorkoutDescription` | Required if type is "other", 1–280 chars | Required if type is `other`, 1–280 chars |
| `yesterdayWorkoutFeedback` | Optional, 0–280 chars | Optional, max 280 chars |
| `sleepScore` | Required, integer 1–5 | Required, integer 1–5 |
| `feelScore` | Required, integer 1–5 | Required, integer 1–5 |
| `periodStartedToday` | Required if menstruating (boolean tap) | Boolean if provided, null otherwise |
| `stressors` | Optional, 0–280 chars | Optional, max 280 chars |

### Date handling and travel

`check_in_date` is a plain local calendar date string (e.g. `"2026-06-25"`), not derived from UTC. This means the date is stable regardless of the user's timezone — June 25 in Berlin and June 25 in San Diego are the same check-in date. A user traveling across timezones will always see their check-in history relative to the calendar date they experienced, not the server's UTC clock.

Server-side validation allows dates up to 1 day in the future relative to UTC, to tolerate users in UTC+14 (the maximum UTC offset) submitting their local date while the server is still on the previous UTC day.

For example: a user who checks in from New York on June 25, then opens the app from Berlin later that same calendar day, sees their existing recommendation rather than being prompted for a new check-in — because both submissions share the same local date string `"2026-06-25"`.

---

## Cycle day calculation

Implemented in `lib/cycle.ts`, called server-side during check-in submission.

- If `periodStartedToday` is `true`: return `1`. No database lookup needed.
- If `periodStartedToday` is `false`: query for the most recent check-in where `period_started_today = true` for this user. If found, return `(checkInDate - anchorDate) + 1`. Calculation is date-based so gap days from skipped check-ins are counted naturally.
- If `periodStartedToday` is `null` (user is not menstruating): return `null`.
- If no period start has ever been recorded: return `null`.

---

## LLM integration

### Provider abstraction

The app calls `lib/llm/index.ts` for all recommendation generation. This module handles all provider-agnostic logic: loading the prompt config, constructing the user message, validating and parsing the response, and logging. It delegates the actual SDK call to the active provider module (`lib/llm/providers/anthropic.ts`, `lib/llm/providers/gemini.ts`, etc.).

All provider modules implement the shared `LLMProvider` interface defined in `lib/llm/types.ts`:

```typescript
// lib/llm/types.ts
interface LLMProvider {
  complete(systemPrompt: string, userMessage: string, params: InferenceParams): Promise<LLMRawResponse>
}
```

The active provider is selected at runtime via environment variables:

```typescript
// lib/llm/index.ts
const PROVIDER = process.env.LLM_PROVIDER ?? 'anthropic'  // 'anthropic' | 'gemini' | etc.
const MODEL = process.env.LLM_MODEL ?? 'claude-opus-4-6'
```

Swapping providers requires only updating `LLM_PROVIDER` (and `LLM_MODEL` if needed) in the environment — no code changes.

### Prompt config

At inference time, the latest `PromptConfig` row is fetched from the database (ordered by `created_at` desc, limit 1). This allows the system prompt and inference parameters to be updated without a code deployment. The fetched config's `version` is written to the `LlmInferenceLog`.

### Expected LLM response shape

The LLM is instructed to respond with valid JSON only:

```typescript
{
  recommendation_type: 'as_written' | 'modify' | 'rest'
  modification_detail: string | null   // required if type is 'modify', null otherwise
  rationale: string                    // user-facing, conversational, no clinical language
  rationale_internal: string           // full internal reasoning, not shown to user
  readiness_score: number              // integer 0–100, physiological inputs only
}
```

### System prompt behavioral constraints

The system prompt must instruct the LLM to:
- Not capitulate immediately on low readiness scores — read the full picture
- Make modifications specific, not vague
- Keep user-facing rationale direct and conversational, no clinical language, no hedging
- Account for proximity to goal race (taper logic in final 2 weeks)
- Respond with JSON only — no preamble, no markdown
- Never use em-dashes in any generated text

### Error handling

| Scenario | Behavior |
|---|---|
| API timeout (>10s) | Return `503`, retain check-in record |
| API error (5xx) | Return `503`, retain check-in record |
| Malformed JSON response | Log to Sentry with raw response, return `503`, retain check-in record |
| Invalid `recommendation_type` | Log to Sentry, return `503`, retain check-in record |

In all error cases the check-in record is persisted. The client shows a retry option that re-submits `POST /api/check-ins` — upsert semantics ensure this is safe.

---

## Environment variables

| Variable | Description | Required |
|---|---|---|
| `DATABASE_URL` | Postgres connection string | Yes |
| `LLM_PROVIDER` | LLM provider identifier (default: `anthropic`) | No |
| `LLM_MODEL` | LLM model identifier (default: `claude-opus-4-6`) | No |
| `ANTHROPIC_API_KEY` | Anthropic API key — required when `LLM_PROVIDER` is `anthropic` | Conditional |
| `GEMINI_API_KEY` | Gemini API key — required when `LLM_PROVIDER` is `gemini` | Conditional |
| `SENTRY_DSN` | Sentry DSN | Yes (production) |
| `NEXT_PUBLIC_APP_URL` | Public app URL | No |

Local development uses `.env.local`. Production variables are set in the Vercel dashboard.

---

## Logging

Sentry is initialized in `instrumentation.ts` and used for both error and informational logging.

**Error events:**
- LLM response parse failures (include raw response in Sentry context)
- LLM API errors (include status code and model identifier)
- Any `POST /api/check-ins` failure after the check-in record has been persisted

**Informational events** (logged at info level for troubleshooting):
- New user created (deviceId, userId)
- Check-in submitted (userId, checkInDate)
- Recommendation generated (userId, recommendationType, model, promptVersion, latencyMs)
- Redo action confirmed (userId, checkInDate)

---

## Local development

```bash
npm install

# Create local database and run migrations
createdb layo_dev
DATABASE_URL=postgresql://localhost/layo_dev npx prisma migrate dev

# Seed initial prompt config
npx prisma db seed

# Start dev server
npm run dev
```

The seed script creates the initial `PromptConfig` row (version `1.0.0`) so the app has a prompt to fetch on first run. The prompt text for `1.0.0` is defined in `prisma/seed.ts`.

---

## Deployment

Deployed to Vercel via GitHub integration on merge to `main`. Each PR generates a preview deployment. Migrations run as part of the build:

```json
"build": "prisma migrate deploy && next build"
```

Neon Postgres connection pooling is used in production via the `@neondatabase/serverless` driver.

---

## Key architectural decisions

**Upsert semantics on `POST /api/users` and `POST /api/check-ins`.** Both endpoints upsert rather than insert. This means the client never needs to know whether a previous attempt partially succeeded — retrying is always safe. A future improvement is idempotency key support for more robust deduplication.

**`check_in_date` is a plain date string sent by the client.** It represents the user's local calendar date (derived from `new Date().toLocaleDateString()` or equivalent), not a UTC-derived timestamp. The server stores it exactly as provided. "June 25" in Berlin and "June 25" in San Diego are the same check-in date — consistent with how a user thinks about their day regardless of where they are. The client sets this programmatically; the user never enters a date manually.

**One check-in per user per day is enforced at the database level** via a unique constraint on `(user_id, check_in_date)`, not just application logic.

**Recommendation generation is synchronous with check-in submission.** The user waits for the LLM response before seeing the recommendation screen. Simpler than async/polling for the current scale.

**Prompt config is fetched at inference time from the database.** The latest row by `created_at` is used. This allows prompt and parameter updates without redeployment, with every inference permanently traceable to the exact config that generated it.

**No authentication middleware in the current implementation.** All user resolution is per-request via `X-Device-ID`. This will be replaced with proper auth in a future version.

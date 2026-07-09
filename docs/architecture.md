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
| Wearables | Provider-abstracted via `lib/wearables/` (first provider: Oura Ring) |
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
│   ├── crypto.ts                   # AES-256-GCM encrypt/decrypt for token storage
│   ├── llm/
│   │   ├── index.ts                # Provider-agnostic interface: loads prompt config, builds user message, parses and validates response, logs to Sentry
│   │   ├── types.ts                # Shared LLMProvider interface and response types
│   │   └── providers/
│   │       ├── anthropic.ts        # Anthropic SDK invocation
│   │       └── gemini.ts           # Gemini SDK invocation (placeholder)
│   └── wearables/
│       ├── index.ts                # Provider-agnostic interface: fetchAndStoreTodayMetrics, computeBaseline, formatLLMContext
│       ├── types.ts                # Shared types: WearableMetrics, WearableBaseline, NormalizedDailyMetric
│       └── providers/
│           └── oura.ts             # Oura API calls, token refresh, field mapping
├── app/api/
│   ├── users/route.ts              # POST /api/users, GET /api/users
│   ├── check-ins/
│   │   └── route.ts                # POST /api/check-ins, GET /api/check-ins?date=, DELETE /api/check-ins?date=
│   ├── recommendations/
│   │   └── route.ts                # GET /api/recommendations?date=
│   └── wearables/
│       ├── route.ts                # GET /api/wearables
│       └── oura/
│           ├── authorize/route.ts  # GET /api/wearables/oura/authorize
│           └── callback/route.ts   # GET /api/wearables/oura/callback (OAuth redirect target)
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

1. Does the URL include `?force=true`?
   - Yes → redirect to `/onboarding` regardless of localStorage state (persistent testing utility for re-running onboarding on an existing device)
2. Is there a `deviceId` in localStorage?
   - No → redirect to `/onboarding`
3. Does a check-in record exist for today (`GET /api/check-ins?date={today}`)?
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

**Exception — Oura connect step:** The optional Oura connect step in onboarding requires a browser redirect to Oura's authorization server. This is a departure from the purely client-side architecture. The PKCE code verifier is stored in `sessionStorage` (not localStorage) to survive the redirect within the same tab; only the code verifier requires client-side storage. The `state` parameter encodes both a CSRF nonce and the `deviceId` as an encrypted JSON payload, allowing the callback route to identify the user server-side without any session or header (the callback is a browser redirect from Oura and carries no `X-Device-ID`). After the OAuth callback, the browser is redirected back to `/onboarding?wearable=connected`, and the onboarding page detects this param on mount to show the confirmation screen. React state from before the redirect is not recoverable; the confirmation screen is a terminal step that does not depend on prior React state.

If the user refreshes mid-flow or after a submission failure, React state is lost and the flow restarts from the beginning. This is acceptable for the current implementation. The retry CTA on error screens re-submits the same API call. `POST /api/users` upserts, so this is always safe. `POST /api/check-ins` always inserts, so this is safe as long as the previous attempt failed before its database write; see [Upsert semantics](#upsert-semantics).

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
  id                 String               @id @default(uuid())
  deviceId           String               @unique @map("device_id")
  createdAt          DateTime             @default(now()) @map("created_at")
  profile            UserProfile?
  events             Event[]
  checkIns           CheckIn[]
  recommendations    Recommendation[]
  wearableConnections WearableConnection[]
  wearableMetrics    WearableDailyMetric[]

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
  sleepSatisfaction           Int                   @map("sleep_satisfaction")  // renamed from sleep_score in v0.1.1
  feelScore                   Int                   @map("feel_score")
  periodStartedToday          Boolean?              @map("period_started_today")
  cycleDay                    Int?                  @map("cycle_day")
  stressors                   String?
  status                      RecordStatus          @default(active)
  createdAt                   DateTime              @default(now()) @map("created_at")
  recommendation              Recommendation?

  @@index([userId, checkInDate])
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
  status             RecordStatus       @default(active)
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
  correlationId     String?        @map("correlation_id")
  rawResponse       String         @map("raw_response") @db.Text
  rationaleInternal String         @map("rationale_internal") @db.Text
  readinessScore    Int            @map("readiness_score")
  inputTokens       Int            @map("input_tokens")
  outputTokens      Int            @map("output_tokens")
  latencyMs         Int            @map("latency_ms")
  createdAt         DateTime       @default(now()) @map("created_at")

  @@map("llm_inference_logs")
}

model WearableConnection {
  id             String           @id @default(uuid())
  userId         String           @map("user_id")
  user           User             @relation(fields: [userId], references: [id])
  provider       WearableProvider
  accessToken    String           @map("access_token") @db.Text
  refreshToken   String           @map("refresh_token") @db.Text
  tokenExpiresAt DateTime         @map("token_expires_at")
  status         ConnectionStatus @default(active)
  connectedAt    DateTime         @default(now()) @map("connected_at")
  updatedAt      DateTime         @updatedAt @map("updated_at")
  metrics        WearableDailyMetric[]

  @@unique([userId, provider])
  @@map("wearable_connections")
}

model WearableDailyMetric {
  id                   String             @id @default(uuid())
  userId               String             @map("user_id")
  user                 User               @relation(fields: [userId], references: [id])
  connectionId         String             @map("connection_id")
  connection           WearableConnection @relation(fields: [connectionId], references: [id])
  provider             WearableProvider
  metricDate           DateTime           @map("metric_date") @db.Date
  readinessScore       Int?               @map("readiness_score")
  hrvAvg               Float?             @map("hrv_avg")
  restingHeartRate     Int?               @map("resting_heart_rate")
  sleepScore           Int?               @map("sleep_score")
  sleepDurationMinutes Int?               @map("sleep_duration_minutes")
  deepSleepMinutes     Int?               @map("deep_sleep_minutes")
  remSleepMinutes      Int?               @map("rem_sleep_minutes")
  sleepEfficiency      Float?             @map("sleep_efficiency")
  bodyTempDeviation    Float?             @map("body_temp_deviation")
  rawData              Json               @map("raw_data")
  createdAt            DateTime           @default(now()) @map("created_at")

  @@unique([userId, provider, metricDate])
  @@index([userId, provider])
  @@index([userId, metricDate])
  @@map("wearable_daily_metrics")
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

enum RecordStatus {
  active
  stale
}

enum WearableProvider {
  oura
}

enum ConnectionStatus {
  active
  inactive
}
```

### Migration notes

`sleep_score` is renamed to `sleep_satisfaction` in the `check_ins` table. This requires:
1. A Prisma migration that renames the column (using `ALTER TABLE check_ins RENAME COLUMN sleep_score TO sleep_satisfaction`)
2. Any existing rows retain their values — the integer range and semantics are identical
3. The LLM prompt config must be updated to use the new field label ("sleep satisfaction (1–5, subjective)" instead of "sleep score (1–5)")

`check_ins` and `recommendations` gain a `status` column (`RecordStatus`: `active | stale`, default `active`) so that delete-and-redo preserves history instead of overwriting it. This requires:
1. A Prisma migration that adds the `status` column to both tables and drops the old `@@unique([userId, checkInDate])` constraint on `check_ins` (multiple stale rows can now share a date)
2. A hand-written partial unique index, `check_ins_user_id_check_in_date_active_key`, on `(user_id, check_in_date) WHERE status = 'active'`, replacing the dropped constraint's guarantee (at most one *active* check-in per user per day) without blocking stale history from accumulating
3. Existing rows default to `status = 'active'` on migration, so no backfill is needed

### Key indexes and constraints

Prisma `@unique` directives automatically create unique indexes. Additional non-unique indexes are added explicitly for frequently queried foreign keys.

- `users.device_id`: unique index (auto-created by `@unique`) — also used for upsert
- `user_profiles.user_id`: unique index (auto-created by `@unique`)
- `check_ins.(user_id, check_in_date)`: non-unique composite index, for date-scoped queries across all statuses
- `check_ins_user_id_check_in_date_active_key`: partial unique index on `(user_id, check_in_date) WHERE status = 'active'` (hand-written, not expressible in `schema.prisma`), enforcing at most one active check-in per user per day
- `check_ins.check_in_date`: non-unique index — for date-scoped queries
- `recommendations.user_id`: non-unique index — for querying a user's recommendation history
- `recommendations.check_in_id`: unique index (auto-created by `@unique`)
- `events.user_id`: non-unique index — for querying a user's events
- `llm_inference_logs.recommendation_id`: unique index (auto-created by `@unique`)
- `prompt_configs.version`: unique index (auto-created by `@unique`)
- `wearable_connections.(user_id, provider)`: composite unique index (auto-created by `@@unique`) — one connection per user per provider
- `wearable_daily_metrics.(user_id, provider, metric_date)`: composite unique index (auto-created by `@@unique`) — used for upsert
- `wearable_daily_metrics.(user_id, provider)`: non-unique index — for baseline queries
- `wearable_daily_metrics.(user_id, metric_date)`: non-unique index — for date-scoped lookups

---

## API routes

All routes return JSON. All routes except `POST /api/users` require the `X-Device-ID` header. Missing header or unknown deviceId returns `401`.

### GET /api/users
Returns the authenticated user's profile. Called on check-in page mount to obtain `name` and `hormonalLifeStage` for the check-in flow.

**Response:** `200` with `{ user: { name: string, hormonalLifeStage: string[] } }`. Returns `404` if the user exists but has no profile (unexpected in normal usage after onboarding).

---

### Upsert semantics

`POST /api/users` uses upsert rather than insert. This means retrying a failed onboarding submission is always safe, since the client does not need to know whether the previous attempt partially succeeded. There is no separate retry endpoint.

`POST /api/check-ins` always inserts (see [Check-in, recommendation, and LLM inference log history](#check-in-recommendation-and-llm-inference-log-history) below), so retrying is only safe when the previous attempt failed before its database write (e.g. the LLM call itself failed), since no `active` check-in exists yet in that case. A retry after a fully successful submission whose response was lost in transit (e.g. a network timeout) would fail on the partial unique index, since an `active` check-in for that day already exists. This is an accepted tradeoff of insert-only history; the client's entry-point routing prevents this from being reachable in normal usage, since a check-in flow is only shown when no check-in exists yet for today.

A near-term improvement is to add idempotency key support (client generates a UUID per submission attempt, server deduplicates on it), but this is not required for the current implementation given the small user base.

---

### POST /api/users
Creates or updates a user, user profile, and event (if training for a race). Called on onboarding completion. Upserts on `device_id`. For race goals, the event is upserted on `user_id` (one goal event per user at a time): re-onboarding always replaces the existing event row with the newly submitted race details. For non-race goals, any existing event row is deleted.

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
Submits today's check-in, calculates cycle day, fetches and processes wearable data (if connected), generates a recommendation, and persists everything atomically. Always inserts a new `check_ins` row with `status = active` (see [Check-in, recommendation, and LLM inference log history](#check-in-recommendation-and-llm-inference-log-history)); it does not upsert.

**Request body:**
```typescript
{
  checkInDate: string             // ISO date string — client's local calendar date (e.g. "2026-06-25")
  yesterdayWorkoutType?: 'planned' | 'suggested' | 'other'
  yesterdayWorkoutDescription?: string
  yesterdayWorkoutFeedback?: string
  todaysPlannedWorkout: string
  sleepSatisfaction: number       // 1–5 (subjective satisfaction with sleep; renamed from sleepScore in v0.1.1)
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
4. If user has an active wearable connection: call the Oura API for today's metrics and upsert the result to `wearable_daily_metrics`. If the Oura API returns no data for today (not yet synced) or fails, store null for use in step 6. The entire wearable enrichment block (steps 4 and 6) is wrapped in a single try/catch; any error is logged to Sentry and the check-in proceeds without wearable context.
5. Fetch active prompt config (latest by `created_at`)
6. If user has an active wearable connection: compute 90-day baseline from stored rows using `computeBaseline`, then call `formatLLMContext` with the baseline and `wearable_thresholds` from the prompt config's `additional_params`. Append the formatted context to the LLM user message. If today's metrics were unavailable (null from step 4), pass fallback context (baseline only). See `docs/specs/wearable-integration.md` for full fallback behavior.
7. Fetch rolling history (last 14 check-ins) for LLM context
8. Call LLM with enriched context, measure latency
9. Parse LLM response
10. Insert check-in (`status = active`), insert recommendation (`status = active`), insert LLM inference log, all in a single transaction
11. Return recommendation to client

**Note on wearable sync approach:** Today's Oura data is fetched live at check-in submission time (steps 4 and 6) rather than by a background polling job. This is a deliberate simplification for v0.1.1. The planned migration is Oura webhooks, which will push data ~30 seconds after ring sync and eliminate the live fetch entirely. The webhook route and registration will be added as part of that future version.

**Error:** If LLM call fails or response cannot be parsed, no rows are inserted and `503` is returned with a retryable error payload (`checkInSaved` reflects whether an `active` check-in already exists for the date from an earlier attempt). The client re-submits `POST /api/check-ins` on retry; this is safe because a failed attempt never inserts a row (see [Upsert semantics](#upsert-semantics) for the one case where a retry is not safe).

---

### GET /api/check-ins?date={date}
Returns the `active` check-in for the given date, or `null` if none exists. `date` is an ISO date string (e.g. `2026-06-25`). Used by the entry point routing logic to determine whether a check-in exists for today. Stale check-ins (from a prior delete-and-redo) are never returned.

**Response:** `200` with `{ checkIn: <data> }` if an active check-in exists, or `200` with `{ checkIn: null }` if not.

---

### DELETE /api/check-ins?date={date}
Marks the `active` check-in for the given date, and its corresponding `active` recommendation, as `stale` in a single database transaction. No rows are deleted; see [Check-in, recommendation, and LLM inference log history](#check-in-recommendation-and-llm-inference-log-history). Called after the user confirms the "Redo" action; the client then redirects to the check-in flow as normal. Idempotent: if no `active` check-in exists for the date, this is a no-op.

**Response:** `204`.

---

### GET /api/recommendations?date={date}
Returns the `active` recommendation for the given date, or `null` if none exists. Stale recommendations (from a prior delete-and-redo) are never returned.

**Response:** `200` with `{ recommendation: <data> }` if an active recommendation exists, or `200` with `{ recommendation: null }` if not.

---

### Check-in, recommendation, and LLM inference log history

`check_ins` and `recommendations` are never updated in place or hard-deleted after creation; both carry a `status` field (`active | stale`, default `active`) so that troubleshooting a past recommendation stays possible after a redo. `llm_inference_logs` has no `status` field: it is purely an audit trail, and every inference always inserts a new row, regardless of retries or redos.

On "delete and redo check-in" (`DELETE /api/check-ins?date=`): the current day's `active` check-in and its `active` recommendation are both marked `stale` in one transaction. These two updates use an extended `where` clause (`{ id, status: 'active' }`) so that if either row was already staled by a concurrent request, the update affects zero rows and Prisma raises `P2025`, rolling back the whole transaction. The check-in and recommendation are never left in a mismatched state (one `stale`, one still `active`).

On check-in submission (`POST /api/check-ins`): a new check-in, recommendation, and LLM inference log are always inserted with `status = active` (LLM inference log has no status). A partial unique index (`check_ins_user_id_check_in_date_active_key` on `(user_id, check_in_date) WHERE status = 'active'`) guarantees at most one active check-in per user per day; the constraint is naturally satisfied by the normal flow because the entry-point routing only shows the check-in screen when no active check-in exists yet for today.

**Edge case, user closes app mid-redo:** if a user marks today's check-in and recommendation `stale` and then closes the app before completing the new check-in, there is no `active` check-in for today. On return, entry-point routing finds no active check-in and correctly redirects to `/check-in`. The stale records remain in the database for audit purposes.

---

### GET /api/wearables
Returns the authenticated user's wearable connections, including status for each. An empty `connections` array means no wearables are connected.

**Response:**
```typescript
{
  connections: Array<{
    provider: 'oura'
    status: 'active' | 'inactive'
    connectedAt: string  // ISO timestamp
  }>
}
```

---

### GET /api/wearables/oura/authorize
Generates and returns an Oura OAuth 2.0 authorization URL with PKCE. Called by the client when the user taps "Connect Oura Ring."

**Response:**
```typescript
{
  authorizationUrl: string
  codeVerifier: string  // encrypted; client stores in sessionStorage
}
```

The `state` parameter is an encrypted JSON payload `{ nonce: randomUUID(), deviceId }` generated via `lib/crypto.ts`, where `deviceId` is read from the `X-Device-ID` header of the authorize request. It is embedded directly in the authorization URL. The client stores only `codeVerifier` in `sessionStorage`; the state requires no client-side storage because it is decrypted server-side by the callback to both validate the CSRF nonce and identify the user.

---

### GET /api/wearables/oura/callback
OAuth 2.0 redirect target registered with Oura. Receives `code` and `state` query params after user authorization. This is a Next.js route handler that performs a server-side redirect after processing.

**Behavior:**
1. Decrypt the `state` query param using `lib/crypto.ts`; parse the JSON to extract `nonce` and `deviceId` (decryption failure or non-JSON value redirects to error); look up the user by `deviceId` (unknown device ID redirects to error)
2. Exchange `code` for tokens via `POST https://api.ouraring.com/oauth/token`
3. Encrypt tokens; upsert `WearableConnection` row
4. Trigger 90-day historical backfill (synchronous; may add several seconds)
5. Redirect to `/onboarding?wearable=connected`

**On error:** Redirect to `/onboarding?wearable=error`

---

## Token encryption

Wearable OAuth tokens (access and refresh) are encrypted before storage using AES-256-GCM.

```typescript
// lib/crypto.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY = Buffer.from(process.env.WEARABLE_TOKEN_KEY!, 'hex')  // 32-byte hex string

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, KEY, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decrypt(ciphertext: string): string {
  const [ivHex, tagHex, encryptedHex] = ciphertext.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const encrypted = Buffer.from(encryptedHex, 'hex')
  const decipher = createDecipheriv(ALGORITHM, KEY, iv)
  decipher.setAuthTag(tag)
  return decipher.update(encrypted) + decipher.final('utf8')
}
```

If `WEARABLE_TOKEN_KEY` is not set, a Sentry error is logged and tokens are stored in plaintext. This is acceptable for local development but must never occur in production.

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
| `sleepSatisfaction` | Required, integer 1–5 | Required, integer 1–5 |
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
- Treat wearable data as objective context, not the sole decision input
- Recognize that subjective feel and device data can legitimately diverge
- Not cite specific numeric values from wearable data in user-facing rationale unless directly relevant
- Weight subjective inputs more heavily when today's wearable data is absent (flagged in the context block)

### Error handling

| Scenario | Behavior |
|---|---|
| API timeout (>10s) | Return `503`, retain check-in record |
| API error (5xx) | Return `503`, retain check-in record |
| Malformed JSON response | Log to Sentry with raw response, return `503`, retain check-in record |
| Invalid `recommendation_type` | Log to Sentry, return `503`, retain check-in record |

In all error cases, no check-in row is written by the failed attempt (the insert only happens after the LLM call succeeds), so a pre-existing `active` check-in from an earlier successful attempt is left untouched. The client shows a retry option that re-submits `POST /api/check-ins`; this is safe whenever no `active` check-in exists yet for the date. See [Upsert semantics](#upsert-semantics).

---

## Wearable integration

For full design decisions, OAuth flow, field mapping, baseline computation, LLM context format, and fallback behavior, see `docs/specs/wearable-integration.md`.

### Provider abstraction

`lib/wearables/index.ts` provides a provider-agnostic interface. Adding a second wearable provider requires:
1. Adding the provider value to the `WearableProvider` enum
2. Adding a new provider module at `lib/wearables/providers/[provider].ts` that implements the shared interface
3. Defining the field mapping from the provider's API response to `WearableDailyMetric` columns
4. Registering the provider's OAuth endpoints and scopes

No structural schema changes are required.

### Oura-specific behavior

- OAuth 2.0 with PKCE
- Token expiry: 24 hours; refresh using stored `refresh_token`
- On refresh failure: mark connection `inactive`, proceed without wearable data
- Historical backfill: 90 days, triggered synchronously on OAuth callback
- Daily sync: today's data fetched live during `POST /api/check-ins`, upserted to `wearable_daily_metrics` before LLM context is built
- API base URL: `https://api.ouraring.com/v2`
- Endpoints used: `/usercollection/daily_readiness`, `/usercollection/daily_sleep`

### Baseline computation

At check-in submission time, for each metric, `AVG(metric_value)` is computed over the last 90 days of stored rows for that user and provider where the value is not null. Requires a minimum of 14 non-null rows per metric; metrics below this threshold are omitted from LLM context. Computation happens inline in `POST /api/check-ins`; no cron job or stored baseline table.

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
| `SENTRY_ORG` | Sentry organization slug — used by `next.config.mjs` for source map uploads at build time | No |
| `SENTRY_PROJECT` | Sentry project slug — used by `next.config.mjs` for source map uploads at build time | No |
| `NEXT_PUBLIC_APP_URL` | Public app URL | No |
| `OURA_CLIENT_ID` | Oura OAuth client ID | Yes (when Oura is enabled) |
| `OURA_CLIENT_SECRET` | Oura OAuth client secret | Yes (when Oura is enabled) |
| `OURA_REDIRECT_URI` | Oura OAuth callback URL (must match Oura developer portal registration) | Yes (when Oura is enabled) |
| `WEARABLE_TOKEN_KEY` | 32-byte hex key for AES-256-GCM token encryption | Yes (when any wearable is enabled) |

Local development uses `.env.local`. Production variables are set in the Vercel dashboard.

---

## Logging

Sentry is initialized in `instrumentation.ts` and used for error logging.

**Error events:**
- LLM response parse failures (include raw response in Sentry context)
- LLM API errors (include status code and model identifier)
- Any `POST /api/check-ins` failure after the check-in record has been persisted
- Oura token refresh failures (include user ID and error response)
- Oura API errors during metric fetches (include endpoint and status code)
- Missing `WEARABLE_TOKEN_KEY` in production (token stored in plaintext)

### Structured logging and request tracing

`lib/logger.ts` provides structured JSON logging so Vercel's log drain can index and filter fields, independent of Sentry:

- `log(fields)` — writes a JSON line (with an added `timestamp`) to stdout
- `logError(fields)` — writes a JSON line to stderr; called alongside every `Sentry.captureException`/`captureMessage` so errors are visible in Vercel logs without opening Sentry
- `startRequest(request, method, path)` — generates a `requestId` (`crypto.randomUUID()`), reads `correlationId` from the `x-correlation-id` request header (falling back to a generated UUID), reads `deviceId` from the `X-Device-ID` request header when present, logs a `request_start` event, and returns a `RequestContext`
- `endRequest(response, ctx)` — logs a `request_end` event with `statusCode` and `latencyMs`, sets the `x-request-id` response header, and returns the response unchanged
- `logCtx(ctx, fields)` / `logErrorCtx(ctx, fields)` — wrap `log`/`logError`, merging `requestId`, `correlationId`, `deviceId`, and `userId` from `ctx` in automatically. Every log call site inside a route handler (and inside `generateRecommendation`, which receives the relevant fields via `InferenceLogContext`) uses these instead of calling `log`/`logError` directly, so an identifier already known for the request is never accidentally left off a later log line

Every API route handler calls `startRequest` first and routes every response through `endRequest`, so all routes emit entry/exit log lines and return `x-request-id`.

**Two IDs, two scopes:** `requestId` is unique per API call. `correlationId` represents a logical user action that may span multiple API calls in the future (e.g. Oura webhook flows); for current flows it is 1:1 with `requestId`. The client generates a fresh `correlationId` via `generateCorrelationId()` in `lib/device.ts` before each user action (onboarding submission, check-in submission, Oura OAuth initiation) and sends it as `x-correlation-id`. It is ephemeral and never persisted client-side. `POST /api/check-ins` persists the resolved `correlationId` to `llm_inference_logs.correlation_id` so a recommendation can be traced in logs without guessing a time window.

**deviceId and userId:** `RequestContext.deviceId`/`RequestContext.userId` are mutable and populated as soon as they're known, so that every log line from that point onward (via `logCtx`/`logErrorCtx`) carries them without a database join. Most routes get `deviceId` for free from `startRequest` reading the `X-Device-ID` header. Two exceptions set it explicitly mid-request: `POST /api/users` (deviceId comes from the request body, not a header) right after body validation, and `GET /api/wearables/oura/callback` (a browser redirect from Oura with no custom headers) right after the `state` query param is decrypted. `userId` is set immediately after `resolveUser()` (or the equivalent manual `prisma.user.findUnique` lookup) succeeds in every route that resolves a user, including right after the upsert in `POST /api/users`. Neither field is treated as PII or sensitive — they're opaque identifiers, not user-entered content.

`POST /api/check-ins` and `GET /api/wearables/oura/callback` additionally emit a log line at the completion of each internal phase (user resolution, cycle day calculation, Oura fetch, baseline computation, LLM inference, DB writes; state decryption, token exchange, connection write, backfill). Log lines never include check-in free text, stressors, rationale strings, Oura metric values, or access/refresh tokens — only IDs, shapes, statuses, and latencies.

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

For Oura integration in local development, set `OURA_CLIENT_ID`, `OURA_CLIENT_SECRET`, `OURA_REDIRECT_URI` (pointing to `localhost`), and `WEARABLE_TOKEN_KEY` in `.env.local`. The `OURA_REDIRECT_URI` must also be registered in the Oura developer portal as an allowed redirect URI.

---

## Deployment

Deployed to Vercel via GitHub integration on merge to `main`. Each PR generates a preview deployment. Migrations run as part of the build:

```json
"build": "prisma migrate deploy && next build"
```

Neon Postgres connection pooling is used in production via the `@neondatabase/serverless` driver.

---

## Key architectural decisions

**Upsert semantics on `POST /api/users`.** The endpoint upserts rather than inserts. This means the client never needs to know whether a previous onboarding attempt partially succeeded, so retrying is always safe. A future improvement is idempotency key support for more robust deduplication.

**`POST /api/check-ins` inserts rather than upserts, to preserve history.** Every submission creates a new `check_ins`/`recommendations` row (`status = active`) and a new `llm_inference_logs` row, rather than overwriting the prior day's attempt. This trades away blind retry-safety after a fully successful submission (see [Upsert semantics](#upsert-semantics)) for the ability to inspect what a past recommendation was actually based on, the driving requirement behind delete-and-redo history preservation (see [Check-in, recommendation, and LLM inference log history](#check-in-recommendation-and-llm-inference-log-history)).

**`check_in_date` is a plain date string sent by the client.** It represents the user's local calendar date (derived from `new Date().toLocaleDateString()` or equivalent), not a UTC-derived timestamp. The server stores it exactly as provided. "June 25" in Berlin and "June 25" in San Diego are the same check-in date — consistent with how a user thinks about their day regardless of where they are. The client sets this programmatically; the user never enters a date manually.

**One *active* check-in per user per day is enforced at the database level** via a partial unique index on `(user_id, check_in_date) WHERE status = 'active'`, not just application logic. Stale check-ins from prior redos are exempt, since the index only covers active rows.

**Recommendation generation is synchronous with check-in submission.** The user waits for the LLM response before seeing the recommendation screen. Simpler than async/polling for the current scale.

**Prompt config is fetched at inference time from the database.** The latest row by `created_at` is used. This allows prompt and parameter updates without redeployment, with every inference permanently traceable to the exact config that generated it.

**No authentication middleware in the current implementation.** All user resolution is per-request via `X-Device-ID`. This will be replaced with proper auth in a future version.

**Wearable data is fetched live at check-in submission time, not by a background cron.** `POST /api/check-ins` calls the Oura API for today's data, upserts the result to `wearable_daily_metrics`, then reads from the stored row for LLM context. This keeps the v0.1.1 architecture simple at the cost of added latency on check-in submission when Oura data is available. The planned migration is Oura webhooks, which will push data ~30 seconds after ring sync and eliminate the live fetch entirely. The webhook route and registration will be added as part of that future version.

**Wearable baseline is computed on-demand, not stored.** Rolling 90-day averages are calculated inline during `POST /api/check-ins` from raw `wearable_daily_metrics` rows. This avoids a separate write path, cache invalidation, and stale-data risk. At current user scale, the query adds negligible latency.

**Oura OAuth uses server-side PKCE generation.** The code verifier is generated server-side in `GET /api/wearables/oura/authorize`, encrypted, and returned to the client for `sessionStorage`. This keeps the client thin and consistent with Láyo's architecture pattern of pushing logic server-side where possible.

**Provider-agnostic wearable tables.** `wearable_connections` and `wearable_daily_metrics` use a `provider` enum rather than Oura-specific naming. Adding a second provider is a configuration and mapping exercise — no schema migration required beyond adding the enum value.

**`sleep_score` renamed to `sleep_satisfaction` in v0.1.1.** The column rename reflects the semantic change from an objective quality rating to a subjective satisfaction rating. Existing data is preserved; the integer values remain valid under the new interpretation.

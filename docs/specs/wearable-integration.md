# Wearable Integration — Feature Spec

## What this is

This spec covers the design and implementation decisions for wearable device integration in Láyo. The first supported provider is Oura Ring. The architecture is designed so that adding a second provider (Whoop, Garmin, Fitbit, etc.) is a configuration and mapping exercise, not a structural change.

The feature adds three capabilities:

1. **Onboarding connect step:** an optional step after the existing onboarding questions that offers users the chance to connect their Oura Ring via OAuth 2.0.
2. **Daily metric enrichment:** for connected users, today's Oura data is fetched at check-in submission time, deltas against baseline are computed, and the context is passed to the LLM.
3. **Baseline computation:** a rolling 90-day baseline per metric, recomputed at each check-in using stored historical data. No cron job.

Users without Oura connected are unaffected. The check-in flow for non-Oura users is unchanged.

This is scoped to v0.1.1.

---

## Sleep input decision

### The tension

v0.1.0 asks "How did you sleep?" as a 1-5 subjective scale. Oura provides an objective sleep score (0-100) based on duration, efficiency, HRV during sleep, and deep/REM composition. For users with Oura connected, having both a subjective sleep scale and an objective sleep score in the same LLM context creates duplication and potential signal conflict: if a user rates their sleep 4/5 but Oura shows a score of 52 (poor), the LLM must decide which to trust.

### Decision: Reframe as subjective sleep satisfaction, retain for all users

The sleep question is reframed from "How did you sleep?" (which users interpret as an objective quality assessment) to a subjective satisfaction question. The scale labels change from "rough / great" to "unsatisfied / satisfied."

This question is retained for all users, including those with Oura connected.

**Rationale:** Oura's sleep score and a subjective sleep satisfaction rating capture genuinely different things. Oura measures sleep architecture. A subjective rating captures whether the user feels the sleep was sufficient or frustrating. Someone can sleep 7.5 hours with an Oura score of 70 and feel deeply unsatisfied because they expected 9 hours before a key workout. Conversely, a user might score their sleep satisfaction highly even with a lower Oura score because they feel rested. The LLM benefits from both signals; they are not redundant.

The question heading changes to: **"How satisfied are you with how you slept?"**
The subtext changes to: **"Do you feel like you got enough sleep last night?"**
Scale labels change to: 1 = unsatisfied, 5 = satisfied.

The database field `sleep_score` is renamed to `sleep_satisfaction` in this version. A migration is required.

### What changes in the PRD

The sleep question copy changes as described above. The field name changes from `sleep_score` to `sleep_satisfaction` throughout. No other check-in question is affected.

---

## OAuth flow design

### Oura OAuth 2.0

Oura implements standard OAuth 2.0 with PKCE. The authorization URL is `https://cloud.ouraring.com/oauth/authorize`. The token exchange endpoint is `https://api.ouraring.com/oauth/token`. The client secret must not be exposed client-side; the token exchange happens in a new API route (`GET /api/wearables/oura/callback`).

### The redirect problem

The onboarding flow is entirely client-side. OAuth authorization requires a browser redirect to Oura's servers and back to a callback URL. This means the flow cannot stay in React state the way the rest of onboarding does.

**The redirect approach:** When the user taps "Connect Oura Ring," the client:

1. Calls `GET /api/wearables/oura/authorize` to obtain the authorization URL and an encrypted PKCE code verifier.
2. Stores the encrypted code verifier in `sessionStorage` under `layo_oura_pkce_verifier` (transient state for a single tab session; survives the redirect, cleared on tab close).
3. Redirects the browser to the authorization URL.

After Oura redirects back to `/api/wearables/oura/callback`:

1. The API route decrypts and validates the `state` parameter server-side (see State parameter below).
2. The API route exchanges the authorization code for access and refresh tokens.
3. Tokens are stored in the `wearable_connections` table.
4. The API route triggers the historical data backfill (90 days) and redirects the browser to `/onboarding?wearable=connected`.
5. The onboarding page detects the `?wearable=connected` query param on mount, clears sessionStorage, and shows the confirmation screen.

**Why not a popup window?** Popups are blocked by default on mobile Safari and Chrome for Android. The redirect approach is more reliable across mobile browsers.

**PKCE verifier storage:** The code verifier is generated server-side in `GET /api/wearables/oura/authorize`, encrypted via `lib/crypto.ts`, and returned to the client for `sessionStorage`. This keeps the client thin and avoids any dependency on `crypto.subtle` availability.

**State parameter:** The OAuth `state` parameter serves two purposes: CSRF protection and user identification. Because the callback is a browser redirect from Oura's servers, it carries no `X-Device-ID` header and has no other way to identify the user. `GET /api/wearables/oura/authorize` reads the `deviceId` from the incoming `X-Device-ID` header, constructs a JSON payload `{ nonce: randomUUID(), deviceId }`, encrypts it via `lib/crypto.ts`, and embeds the encrypted value as the `state` parameter in the authorization URL. The callback decrypts the state entirely server-side, extracts the `deviceId`, and resolves the user from it. No sessionStorage lookup is required and no state needs to be stored between the authorize and callback requests.

**Callback URL:** `https://[app-url]/api/wearables/oura/callback`

This URL must be registered in the Oura developer portal.

### Scopes requested

`daily.activity`, `daily.readiness`, `daily.sleep`, `heartrate`, `personal`

`personal` is required for Oura to return the user's timezone, which is needed to correctly align metric dates.

### What happens when users skip the connect step

The connect step is optional. Users who tap "Skip for now" proceed directly to the confirmation screen. They can connect Oura later (settings are deferred post-v0.1.1, but the data model supports it). The `wearable_connections` record simply does not exist for that user.

### Token refresh

Oura access tokens expire after 24 hours. The token refresh logic runs in `lib/wearables/providers/oura.ts` using the stored `refresh_token`. If a refresh fails (revoked token, user disconnected Oura from their settings), the connection is marked `status: inactive` in the database. For v0.1.1, a failed refresh means the check-in proceeds without Oura data. A reconnect flow is not in scope for v0.1.1.

---

## Provider-agnostic data model

Both new tables use a `provider` enum rather than Oura-specific table names or columns. Adding a second provider requires: adding its enum value, writing a new provider module in `lib/wearables/`, and defining its field mapping (see Field mapping section below).

### New tables

#### `wearable_connections`

Stores OAuth credentials and connection state per user per provider. One row per user per provider.

```prisma
model WearableConnection {
  id           String           @id @default(uuid())
  userId       String           @map("user_id")
  user         User             @relation(fields: [userId], references: [id])
  provider     WearableProvider
  accessToken  String           @map("access_token") @db.Text
  refreshToken String           @map("refresh_token") @db.Text
  tokenExpiresAt DateTime       @map("token_expires_at")
  status       ConnectionStatus @default(active)
  connectedAt  DateTime         @default(now()) @map("connected_at")
  updatedAt    DateTime         @updatedAt @map("updated_at")

  metrics      WearableDailyMetric[]

  @@unique([userId, provider])
  @@map("wearable_connections")
}

enum WearableProvider {
  oura
}

enum ConnectionStatus {
  active
  inactive
}
```

**Token storage:** Access and refresh tokens are stored encrypted at rest. Encryption uses `AES-256-GCM` via Node.js `crypto` module. The encryption key is stored in the `WEARABLE_TOKEN_KEY` environment variable (32-byte hex string). Encrypt before write, decrypt before use. If encryption is not configured, tokens are stored in plaintext with a Sentry warning logged.

#### `wearable_daily_metrics`

Stores one row per user per provider per date. Contains normalized metric values and the JSON source blob.

```prisma
model WearableDailyMetric {
  id                   String           @id @default(uuid())
  userId               String           @map("user_id")
  user                 User             @relation(fields: [userId], references: [id])
  connectionId         String           @map("connection_id")
  connection           WearableConnection @relation(fields: [connectionId], references: [id])
  provider             WearableProvider
  metricDate           DateTime         @map("metric_date") @db.Date
  readinessScore       Int?             @map("readiness_score")
  hrvAvg               Float?           @map("hrv_avg")
  restingHeartRate     Int?             @map("resting_heart_rate")
  sleepScore           Int?             @map("sleep_score")
  sleepDurationMinutes Int?             @map("sleep_duration_minutes")
  deepSleepMinutes     Int?             @map("deep_sleep_minutes")
  remSleepMinutes      Int?             @map("rem_sleep_minutes")
  sleepEfficiency      Float?           @map("sleep_efficiency")
  bodyTempDeviation    Float?           @map("body_temp_deviation")
  rawData              Json             @map("raw_data")
  createdAt            DateTime         @default(now()) @map("created_at")

  @@unique([userId, provider, metricDate])
  @@index([userId, provider])
  @@index([userId, metricDate])
  @@map("wearable_daily_metrics")
}
```

**Why nullable columns for each metric?** Different providers support different metrics. A `WearableDailyMetric` row for a future Whoop integration may have `readiness_score` and `hrv_avg` populated but `sleep_efficiency` null because Whoop calls it something different and maps to a different column. The `rawData` JSON column preserves the full provider response for any metric not covered by the normalized columns.

**Why not a key-value metrics table?** A key-value store (one row per metric per date) would require multiple rows per day and make baseline queries more complex. The normalized column approach makes rolling window aggregation straightforward in SQL and easy to read in Prisma.

### Field mapping per provider

Each provider module defines a static mapping from its API response shape to the normalized columns. For Oura, verified against Oura's official OpenAPI spec ([`openapi-1.35.json`](https://cloud.ouraring.com/v2/static/json/openapi-1.35.json), schemas `PublicDailyReadiness`, `PublicDailySleep`, `PublicModifiedSleepModel`):

| Normalized column | Oura API field | Source endpoint |
|---|---|---|
| `readiness_score` | `readiness.score` | `/v2/usercollection/daily_readiness` |
| `body_temp_deviation` | `readiness.temperature_deviation` | `/v2/usercollection/daily_readiness` |
| `sleep_score` | `dailySleep.score` | `/v2/usercollection/daily_sleep` |
| `hrv_avg` | duration-weighted average of `average_hrv` across the day's sleep periods | `/v2/usercollection/sleep` |
| `resting_heart_rate` | minimum of `lowest_heart_rate` across the day's sleep periods | `/v2/usercollection/sleep` |
| `sleep_duration_minutes` | sum of `total_sleep_duration` across the day's sleep periods, in minutes | `/v2/usercollection/sleep` |
| `deep_sleep_minutes` | sum of `deep_sleep_duration` across the day's sleep periods, in minutes | `/v2/usercollection/sleep` |
| `rem_sleep_minutes` | sum of `rem_sleep_duration` across the day's sleep periods, in minutes | `/v2/usercollection/sleep` |
| `sleep_efficiency` | `sum(total_sleep_duration) / sum(time_in_bed) * 100` across the day's sleep periods | `/v2/usercollection/sleep` |

Oura returns durations in seconds. Division by 60 happens in the mapping layer before storage.

**`daily_sleep` and `daily_readiness` do not contain raw metric values.** Both endpoints return only a `score` plus a `contributors` object of 0-100 sub-scores (e.g. `contributors.hrv_balance`, `contributors.resting_heart_rate`, `contributors.efficiency`); they never return raw HRV (ms), heart rate (bpm), duration (seconds), or efficiency (%) values. Those raw values live on the separate `/v2/usercollection/sleep` endpoint (individual sleep-period records), which is why it's the source for every field below `sleep_score` in the table above. There is also no field named `resting_heart_rate` anywhere in Oura's API that carries a bpm value; the closest analog is `lowest_heart_rate` on a sleep period.

**Aggregating multiple sleep periods per day.** `/v2/usercollection/sleep` can return more than one record for a given day (main sleep plus naps), each with a `type` of `long_sleep`, `sleep`, `late_nap`, `rest`, or `deleted`. A day's contributing periods are all records with that `day` value (Oura's `day` field already accounts for the 6pm cutoff that reassigns late naps to the following day) excluding `type: rest` and `type: deleted`. Different fields aggregate differently across those periods:
- **Durations** (`sleep_duration_minutes`, `deep_sleep_minutes`, `rem_sleep_minutes`) are **summed**. This matches what the Oura app displays (e.g. a 6h main sleep plus a 1h15m nap shows as 7h15m total), and total sleep including naps is what matters for assessing next-day readiness.
- **`hrv_avg`** is a **duration-weighted average** (weighted by each period's `total_sleep_duration`), since an average cannot be summed and unweighted averaging would let a short nap skew the value as much as the main sleep.
- **`resting_heart_rate`** takes the **minimum** `lowest_heart_rate` across periods, since it is already a "lowest observed" statistic rather than an average or a sum.
- **`sleep_efficiency`** is **recomputed** from summed components (`sum(total_sleep_duration) / sum(time_in_bed) * 100`) rather than averaging each period's already-rounded percentage, since this is the literal definition of sleep efficiency.

---

## Historical data backfill

When a user connects Oura, the server immediately fetches 90 days of historical daily metrics. This happens synchronously in the callback handler before the redirect; the callback will take several seconds. The user sees no loading state for this; the redirect back to the onboarding confirmation handles it implicitly.

**If the backfill fails (Oura API error):** The connection is still recorded as `active`. The historical data simply isn't there yet. Subsequent check-ins accumulate today's data one day at a time via `fetchAndStoreTodayMetrics`; there is no separate backfill retry. Metrics with fewer than 14 stored rows are omitted from LLM context until enough data accumulates naturally. A backfill failure is logged to Sentry but does not block the user.

**Backfill range:** 90 calendar days prior to `today` (server date).

**Deduplication:** Upsert on `(user_id, provider, metric_date)`. Re-running the backfill is safe.

---

## Baseline computation

A baseline is a per-user per-metric 90-day rolling average. It is not stored as a separate table. It is computed on-demand at check-in submission time from the existing `wearable_daily_metrics` rows.

**Query:** For each metric, compute `AVG(metric_value)` over rows in the last 90 days where the value is not null.

**Minimum data requirement:** A baseline requires at least 14 days of data to be considered meaningful. If fewer than 14 non-null rows exist for a metric, that metric's baseline and delta are omitted from the LLM context entirely. The LLM is not told a partial baseline exists; it is simply not given that metric. This prevents the model from treating a thin average as authoritative.

**Why not a stored baseline table?** Recomputing from raw rows at each check-in adds a small number of milliseconds to the `POST /api/check-ins` call and avoids a separate write path, cache invalidation logic, and the stale-data risk that comes with maintaining a derived value. At the current user scale, this is the right trade-off. If query time becomes a concern, a stored baseline with a `last_computed_at` field is the natural next step.

---

## Fallback: today's Oura data not yet synced

Oura syncs are not real-time. Users typically wake up before their Oura ring has synced the night's data to the cloud, especially if the ring is still on their wrist. Today's readiness and sleep data may not be available at the moment the user submits their morning check-in.

**Sync approach:** `POST /api/check-ins` calls the Oura API live for today's data at submission time, writes the result to `wearable_daily_metrics` (upsert), then reads from the stored row for LLM context. This means no separate daily sync mechanism is needed and data accumulates naturally for baseline computation. This is a deliberate simplification for v0.1.1.

**Future migration: Oura webhooks.** Oura is a permanent integration in this product, not an experiment. The live-fetch approach at check-in submission time is the right starting point, but it adds latency and will become a rate limit concern at scale. The planned migration path is Oura webhooks, which deliver data approximately 30 seconds after the user's ring syncs to the Oura app, eliminating the need for any polling or live fetching. The Oura v2 API supports webhook subscriptions per data type; the webhook handler would upsert incoming data to `wearable_daily_metrics`, and `POST /api/check-ins` would simply read from what is already stored. The webhook endpoint URL (`https://layo.missfunmi.com/api/wearables/oura/webhook`) and the no-op route itself will be added as part of that future version, not in v0.1.1. There is no registration advantage to adding a non-functional endpoint now; the Oura developer portal allows webhook URLs to be registered and updated at any time.

**Detection:** `today` is determined by the `check_in_date` sent by the client (same convention as existing check-in date handling). If the Oura API returns no data for today's date, today's data has not yet synced.

**Fallback behavior:** The check-in proceeds without today's Oura data. The LLM context is enriched with the user's baseline values and a note that today's device data was not yet available. The LLM is instructed to weight subjective inputs (feel score, sleep satisfaction) more heavily when device data is absent.

**LLM context when today's data is missing:**

```
Wearable data (Oura Ring):
Today's data: not yet synced
90-day baselines: HRV 58ms | RHR 52bpm | Sleep score 74 | Sleep duration 7h 22m | Deep sleep 1h 8m | REM 1h 41m
Note: Device data for today is not yet available. Weight subjective inputs accordingly.
```

**No user-facing warning for missing sync.** The check-in flow is unchanged. The user is not told Oura data is missing, as doing so would introduce friction and confusion at the most important moment of the flow. The recommendation rationale may reference the absence of device data if the LLM determines it is relevant.

**Exception — connection error (not missing sync):** If the Oura API call fails with an error (5xx, 401 token expired), as opposed to returning no data for today, the error is logged to Sentry and the check-in proceeds with the fallback behavior above. A 401 additionally triggers a token refresh attempt; if that also fails, the connection is marked `inactive`.

**Generating screen UX:** Because fetching today's Oura data adds latency to `POST /api/check-ins`, the generating screen should rotate through the existing random header strings every 3 seconds using a `useEffect` interval (cleared on unmount or response arrival), rather than displaying a single static message. This reassures the user the app is not stuck.

---

## LLM context enrichment format

When today's Oura data is available, the following block is appended to the existing LLM user message. Values are rounded to avoid false precision.

```
Wearable data (Oura Ring):
Readiness score: 61 (90-day avg: 74, 18% below baseline)
HRV: 42ms (90-day avg: 58ms, 28% below baseline)
Resting heart rate: 58bpm (90-day avg: 52bpm, 12% above baseline; elevated RHR is a recovery signal)
Sleep score: 67 (90-day avg: 74, 9% below baseline)
Sleep duration: 6h 14m (90-day avg: 7h 22m, 15% below baseline)
Deep sleep: 52min (90-day avg: 68min, 24% below baseline)
REM sleep: 74min (90-day avg: 101min, 27% below baseline)
Sleep efficiency: 84% (90-day avg: 88%)
Body temperature deviation: +0.3°C (90-day avg: +0.0°C)
```

### Delta reporting thresholds

Whether a metric's delta is labeled in the LLM context (e.g. "18% below baseline") is controlled by per-metric thresholds stored in `PromptConfig.additional_params`. Thresholds apply bi-directionally: a metric meaningfully above baseline is labeled just as one meaningfully below baseline is, because positive deviations are also relevant signal (elevated HRV warrants flagging as much as suppressed HRV).

Each metric entry has two fields:

- `report_threshold_pct`: the percentage deviation from baseline above which the delta label is included. Below this threshold, only the raw value and average are shown with no characterization.
- `higher_is`: `"better"`, `"worse"`, or `null`. Used by the formatter to write the correct label direction. `null` is for metrics where direction is context-dependent (body temperature deviation), which always report value and direction without a characterization label.

Initial values in `PromptConfig` version `1.2.0`:

```json
"wearable_thresholds": {
  "readiness_score":       { "report_threshold_pct": 8,  "higher_is": "better" },
  "hrv_avg":               { "report_threshold_pct": 8,  "higher_is": "better" },
  "resting_heart_rate":    { "report_threshold_pct": 5,  "higher_is": "worse"  },
  "sleep_score":           { "report_threshold_pct": 8,  "higher_is": "better" },
  "sleep_duration_minutes":{ "report_threshold_pct": 15, "higher_is": "better" },
  "deep_sleep_minutes":    { "report_threshold_pct": 20, "higher_is": "better" },
  "rem_sleep_minutes":     { "report_threshold_pct": 20, "higher_is": "better" },
  "sleep_efficiency":      { "report_threshold_pct": 5,  "higher_is": "better" },
  "body_temp_deviation":   { "report_threshold_pct": null, "higher_is": null   }
}
```

Sleep duration uses a higher threshold (15%) because small deviations from a 7.5h baseline are physiologically unremarkable. Deep and REM sleep thresholds are set higher still (20%) given natural nightly variability in those stages. These values can be tuned via a `PromptConfig` row update without a code deployment.

### Correlated metric declines

When multiple metrics decline together, they may reflect a single acute cause rather than independent evidence of poor recovery. The system prompt must instruct the LLM:

- When a single stressor (travel, illness, disrupted night) plausibly explains multiple suppressed metrics, treat the cluster as one data point, not compounding arguments for rest.
- Look at the pattern in the rolling check-in history. A single day of depressed metrics with no preceding trend is categorically different from three consecutive days of declining HRV and readiness.
- The stressors field is the primary signal for distinguishing acute from chronic. "Red eye flight" in stressors, combined with low sleep duration, low HRV, and low readiness score, should be read as one event causing a cascade, not as multiple independent failure modes each arguing for rest.
- Reserve rest recommendations for genuinely chronic patterns or acute conditions (illness, injury risk) that independently justify it. A single bad night caused by travel does not automatically justify rest for a zone 1 or zone 2 session.

### Existing system prompt behavioral constraints

The system prompt must also instruct the LLM to:

- Treat wearable data as objective context, not as the sole decision input
- Recognize that device data and subjective feel can legitimately diverge (a low readiness score with a feel score of 5 is not a contradiction; the user may have acclimated or recovered faster than the score reflects)
- Not cite specific numeric values from the wearable data in user-facing rationale unless directly relevant; the user already knows their own data and the LLM's job is to interpret it
- Weight subjective inputs more heavily when today's device data is absent

---

## Check-in flow changes

### For users with Oura connected

The check-in flow questions are identical. No additional screen is added. The only visible difference: the recommendation rationale may reference physiological data the user knows came from their ring, without Láyo needing to explain where it came from.

The sleep satisfaction question (reframed from sleep score) is shown to all users, including Oura-connected users. The Oura sleep score is passed separately to the LLM; the in-app question captures subjective perception.

### For users without Oura

The check-in flow is entirely unchanged from v0.1.0 (except the sleep question reframe, which applies to all users).

---

## New API routes

### GET /api/wearables

Returns the authenticated user's wearable connections, including status. An empty `connections` array means no wearables are connected.

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

Used by the onboarding flow to determine whether to show the "Connect Oura Ring" step as already connected (if the user navigates back after connecting). Also used by future settings screens.

---

### GET /api/wearables/oura/authorize

Generates the Oura authorization URL and returns it to the client. The client redirects to this URL.

**Response:**
```typescript
{
  authorizationUrl: string
  codeVerifier: string  // encrypted; client stores in sessionStorage
}
```

The PKCE code verifier is generated server-side in this route, encrypted, and returned to the client alongside the URL. The client stores it in `sessionStorage`. This avoids PKCE state being lost if the client-side generation fails.

**Note:** An alternative design generates PKCE entirely client-side. This is acceptable but requires the client to have `crypto.subtle` access, which is standard in modern browsers. Server-side generation is chosen here for consistency with the rest of Láyo's architecture (clients are thin).

---

### GET /api/wearables/oura/callback

Receives the OAuth callback from Oura after user authorization. This is a server-side route handler (not a client route).

**Query params:** `code`, `state`

**Behavior:**
1. Decrypt the `state` param using `lib/crypto.ts`; parse the JSON to extract `nonce` and `deviceId`; look up the user by `deviceId` (decryption failure, non-JSON value, or unknown deviceId redirects to error)
2. Exchange `code` for tokens via Oura token endpoint (POST to `https://api.ouraring.com/oauth/token`)
3. Store tokens in `wearable_connections` (upsert on `(user_id, provider)`)
4. Trigger 90-day historical data backfill
5. Redirect to `/onboarding?wearable=connected`

**Error responses:** If code exchange fails or state is invalid, redirect to `/onboarding?wearable=error` with a generic message. The user is returned to onboarding with an error banner and can retry.

---

## New lib modules

### `lib/wearables/index.ts`

Provider-agnostic interface. Exports:
- `fetchAndStoreTodayMetrics(userId, provider, checkInDate)` — calls provider API for today's data, upserts to `wearable_daily_metrics`, returns the stored row or null if unavailable
- `computeBaseline(userId, provider)` — computes 90-day rolling averages from stored data
- `formatLLMContext(todayMetrics, baseline, thresholds)` — returns the formatted string for LLM context enrichment

### `lib/wearables/providers/oura.ts`

Oura-specific implementation. Exports:
- `fetchHistoricalData(accessToken, startDate, endDate)` — fetches and maps historical data
- `fetchHistoricalDataWithRaw(accessToken, startDate, endDate)`: same as `fetchHistoricalData`, but each returned entry also includes that date's raw `readiness`/`dailySleep`/`sleepPeriods` API responses; used by `scripts/backfill-wearable-metrics.ts` to refresh `raw_data` alongside the normalized columns
- `fetchTodayData(accessToken, date)` — fetches today's metrics from the Oura API
- `refreshToken(userId)` — token refresh logic
- `mapToNormalized(readiness, dailySleep, sleepPeriods)`: maps Oura API responses to `WearableDailyMetric` columns, aggregating across the day's sleep periods (see "Field mapping per provider" above)

### `lib/wearables/types.ts`

Shared types: `WearableMetrics`, `WearableBaseline`, `NormalizedDailyMetric`, `MetricThresholdConfig`, `WearableThresholds`.

---

## Onboarding mockup changes (`docs/mockups/onboarding.html`)

A new screen is added after the existing step 5 (training goal) and before the confirmation screen, becoming step 6 of 6.

### New screen: Connect Oura Ring (optional)

**Position in flow:** Between the training goal screen and the confirmation screen. Progress dots update to reflect 6 steps total (6 dots with the 6th dot active on this screen).

**Header:** `láyo` wordmark top-left, back button top-left (returns to training goal screen), close button top-right. The back button follows the same pattern as all other onboarding screens.

**Content:**

- Heading: "Connect your Oura Ring" (Space Grotesk Bold 22px)
- Subtext: "Láyo can use your readiness, HRV, and sleep data to give you sharper recommendations. You don't need Oura, but if you have one, this helps." (Inter 400 13px, color `#888780`)
- A single green CTA button (full-width, fully rounded): "Connect Oura Ring"
- Below the CTA, a centered text link: "Skip for now" (Inter 400 12px, color `#B4B2A9`, no underline)

**Connected state (if user has already connected):**

If `GET /api/wearables` returns a connection with `status: active` when this screen mounts (e.g. user navigated back after connecting), the screen shows:

- A mint-background confirmation row with a checkmark icon: "Oura Ring connected" (Inter Medium 13px, color `#085041`)
- CTA changes to: "Continue" (standard green CTA)
- "Skip for now" link is hidden

**Error state (callback returned `?wearable=error`):**

An inline coral-background error banner above the CTA:

- Icon: info circle (Tabler, coral `#D85A30`, 16px)
- Text: "Couldn't connect Oura. Try again or skip for now." (Inter 400 12px)

The "Connect Oura Ring" CTA remains. The "Skip for now" link remains.

---

## Check-in mockup changes (`docs/mockups/check-in.html`)

### Sleep satisfaction and feel screen

The heading and subtext for the sleep question change:

- **Before:** "How did you sleep?" / "1 = rough night, 5 = slept great"
- **After (all users):** "How satisfied are you with how you slept?" / "Do you feel like you got enough sleep last night?"

The feel question subtext changes:

- **Before:** "1 = dragging, 5 = ready to go"
- **After:** "How ready are you to tackle today?"

Scale labels for sleep change from "rough / great" to "unsatisfied / satisfied." Scale labels for feel are unchanged ("dragging / ready to go").

No other changes to the check-in flow or mockup screens.

---

## Prompt config changes (v1.2.0)

A new prompt config JSON file `prisma/prompt-configs/v1.2.0.json` is created and applied using the existing `update-prompt-config` script. Existing versions `v1.0.0` and `v1.1.0` are also committed to `prisma/prompt-configs/` as the canonical record. Changes in v1.2.0:

- Addition of wearable context instructions (treat as objective context, not sole input; correlated metric declines from a single stressor are one data point; do not cite raw numbers in user-facing rationale; weight subjective inputs more when device data is absent)
- Updated sleep field label from "sleep score (1-5)" to "sleep satisfaction (1-5, subjective)"
- The `wearable_thresholds` config added to `additionalParams` (see Delta reporting thresholds section)

---

## Open decisions (resolved in this spec)

**1. Fallback for missing today's data:** Fetch live from Oura API at check-in submission time, upsert to DB, proceed without device data and pass baseline-only context to LLM if no data returned. No user-facing warning. Resolved in "Fallback" section.

**2. Sleep input decision:** Reframe as "Do you feel like you got enough sleep last night?" (subjective); retain for all users. Oura sleep score passed separately to LLM. Resolved in "Sleep input decision" section.

**3. Token storage:** AES-256-GCM encryption via `WEARABLE_TOKEN_KEY` env var. Resolved in "Provider-agnostic data model" section.

**4. Baseline minimum data requirement:** 14 days. Metrics below this threshold are omitted from LLM context. Resolved in "Baseline computation" section.

**5. Onboarding redirect state recovery:** PKCE verifier stored in `sessionStorage`; state is validated server-side by the callback (no client-side storage required). Confirmation screen detects `?wearable=connected` query param on mount. Resolved in "OAuth flow design" section.

**6. Delta reporting thresholds:** Per-metric, bi-directional, stored in `PromptConfig.additional_params`. Initial values set in v1.2.0. Resolved in "Delta reporting thresholds" section.

**7. Daily metric sync:** Fetched live at check-in submission time (option 3). No cron job for v0.1.1. Flagged for future async migration. Resolved in "Fallback" section.

**8. Correlated metric declines:** Handled via system prompt behavioral constraints. Resolved in "Correlated metric declines" section.

**9. Wearable status endpoint:** `GET /api/wearables` returns full connection list with status included. Resolved in "New API routes" section.

**10. Back button on Oura connect screen:** Present, returns to training goal screen. Consistent with all other onboarding steps. Resolved in "Onboarding mockup changes" section.

---

## Environment variables (new)

| Variable | Description | Required |
|---|---|---|
| `OURA_CLIENT_ID` | Oura OAuth client ID | Yes (when Oura is enabled) |
| `OURA_CLIENT_SECRET` | Oura OAuth client secret | Yes (when Oura is enabled) |
| `OURA_REDIRECT_URI` | Registered callback URL (e.g. `https://[app-url]/api/wearables/oura/callback`) | Yes (when Oura is enabled) |
| `WEARABLE_TOKEN_KEY` | 32-byte hex key for AES-256-GCM token encryption | Yes (when any wearable is enabled) |

---

## What this spec does not cover

- Oura webhook integration for async data delivery (planned for a future version; see Fallback section for migration rationale and planned endpoint URL)
- Settings screen to disconnect Oura or reconnect after token expiry (deferred post-v0.1.1)
- Support for any provider other than Oura (architecture is ready; implementation deferred)
- Manual wearable data entry for users who want to input readiness scores without a connected device (not planned)
- Push notifications or background sync (not planned for v0.1.x)

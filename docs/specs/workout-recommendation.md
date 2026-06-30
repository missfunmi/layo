# Workout Recommendation Logic Spec

This document captures the design reasoning behind the LLM recommendation prompt for Láyo. It covers the alternatives considered, the research grounding for each decision, taper logic, and open questions deferred to future versions.

---

## 1. Weighing self-reported readiness against plan adherence and training block context

### The core tension

The LLM receives three competing signals:

- **Subjective readiness** — sleep score, feel score, stressors (self-reported)
- **Plan adherence pressure** — the user told us what they planned; deviating requires justification
- **Training block context** — cycle day, proximity to goal race, yesterday's workout type and feedback

The question is: when these conflict, what wins?

### Alternatives considered

**Option A: Subjective readiness wins (readiness-first)**
If a user feels bad and slept poorly, recommend rest or modify regardless of what's planned. This is the intuitive "listen to your body" model.

Rejected because: research on endurance athletes shows mood-based self-assessment is a poor predictor of actual performance capacity. Athletes who feel bad in the morning frequently complete strong sessions. A system that systematically downgrades based on subjective feel would erode trust by being wrong in ways users can observe.

**Option B: Plan adherence wins (plan-first)**
Respect the plan by default; only deviate when signals are severely negative (e.g. sleep score 1 with multiple stressors).

Rejected because: this produces too many as_written recommendations and fails the product's value proposition — if the system rarely recommends modification, it adds no value over just... following the plan.

**Option C: Contextual synthesis (chosen)**
The LLM is instructed to read all signals together and produce a recommendation calibrated to the full picture. The system prompt explicitly guards against two failure modes: premature capitulation on low subjective scores, and uncritical plan adherence when multiple recovery signals stack negatively.

This matches how a skilled coach thinks: a single bad night of sleep during peak training doesn't mean rest; three consecutive days of declining feel scores, elevated resting HR (not tracked yet, deferred), and a hard workout yesterday probably does.

### Signal hierarchy within contextual synthesis

Contextual synthesis does not mean all signals are equal. The system prompt applies the following explicit hierarchy:

**1. Historical baseline (when sufficient history exists) — highest weight**
When the athlete has at least 7 prior check-ins in the rolling 14-check-in window, the LLM should use historical patterns to calibrate whether a given feel or sleep score is unusual for this specific athlete, not just whether it falls below an abstract threshold. An athlete who consistently checks in at feel score 3 and performs well on those days is different from an athlete whose baseline feel is 5 and who today reports 3. Fewer than 7 check-ins means insufficient data — the LLM should not weight historical patterns heavily and should rely on absolute signal values instead.

**2. Feel score — strongest single-session signal**
Even on low-sleep nights, athletes frequently complete planned sessions — particularly shorter or moderate-intensity ones — if they feel capable. Sleep score is informative but secondary: it is one of many inputs that produces how you feel. If feel is high despite poor sleep, lean toward as_written. If feel is low despite good sleep, treat it as a meaningful signal worth investigating via the other inputs.

**3. Workout duration and intensity — determines modification threshold**
Sessions under approximately 75 minutes, even at high intensity, have a lower modification threshold because the physiological cost and mental demand are bounded. Sessions over 75 minutes — especially at sustained intensity — warrant more caution when recovery signals are borderline, since accumulated fatigue compounds across longer efforts. Duration alone is not a reason to modify; it is a multiplier on the significance of borderline recovery signals.

**4. Sleep score — informative, not determinative**
Informs the interpretation of feel score and recovery capacity. A low sleep score on its own is not a modification trigger. It gains weight when combined with a low feel score, high workout intensity, or a history of poor recovery response.

**5. Cycle day — interpretive context only**
Provides context for why feel or recovery signals are what they are (e.g., late luteal phase fatigue is different from overtraining fatigue). Should not independently drive a rest recommendation without corroboration from feel or sleep.

**6. Acute stressors — context modifier**
External stressors (work, life, travel) inform how to interpret subjective scores but do not substitute for them. A stressor declared without corresponding feel or sleep impact is low signal.

---

## 2. Push-through as the modal behavioral response

### The research finding

The product addresses a known pattern in endurance sport: when facing uncertainty about whether to train, most athletes default to completing the session as written. This "push-through" tendency is driven by fear of losing fitness, guilt about missed sessions, and the absence of real-time guidance that accounts for context.

### How the design accounts for it

The Láyo recommendation is not a vote counter. A low feel score alone does not earn a rest recommendation. The prompt is designed to treat push-through as the baseline behavior — the LLM should only deviate from as_written when there is affirmative evidence that modification or rest is the better outcome, not merely when subjective scores are below a threshold.

This means:
- Moderate sleep score (3/5) + high feel score = likely as_written
- Low sleep score (2/5) + moderate feel score + easy planned workout = likely as_written or light modify
- Low sleep score + low feel score + high-intensity planned workout + peak training block = likely modify or rest

The system does not apply numeric scoring rules. The LLM reasons over the gestalt, constrained by the behavioral guardrails in the system prompt.

---

## 3. The 'no capitulation on low readiness' constraint

### Why this constraint exists

Without an explicit guard, LLMs tend to be agreeable and risk-averse. When given a low readiness score, a naive prompt produces a rest recommendation because it's the "safe" choice. This creates a system that over-recommends rest and loses user trust — athletes who know they can train through moderate fatigue will see the system as overcautious and stop engaging.

### How the prompt avoids over-indexing on any single negative signal

The system prompt instructs the LLM to:

1. Not treat any single signal as determinative. A low sleep score, a stressful day, or a bad feel score in isolation is not a reason to recommend modification.
2. Consider signal combinations. Modification or rest should require at least two independent negative signals pointing in the same direction, or a single extreme signal (e.g., feel score 1, or a declared illness/injury).
3. Give weight to training context. A planned easy recovery run warrants less deviation from plan than a planned VO2max session under the same conditions.
4. Distinguish between "not ideal" and "harmful." The goal is not to optimize for perfect conditions — it's to flag when continuing as planned would meaningfully harm recovery or risk injury.

The constraint is enforced through system prompt language, not through numeric rules in code. The `readiness_score` in the LLM response is a summary of physiological inputs only, computed by the LLM, and is stored for observability rather than used to drive downstream logic.

---

## 4. Modification specificity

### The constraint

When the LLM recommends `modify`, the `modification_detail` field must be specific and actionable, not vague. The system prompt must enforce this explicitly — `lib/llm/index.ts` performs structural validation (is the field present when required, is it a string) but cannot validate semantic specificity. If the prompt does not require precision, vague modifications will ship.

### What specific means

Good: "Reduce your long run from 18 miles to 12 miles, keeping the first 8 miles easy and skipping the final progression."

Good: "Cut one interval set. Complete 3x1km instead of 5x1km. Keep the rest period as written."

Bad: "Take it easy today."

Bad: "Reduce intensity if you're feeling tired."

### Why precision is required

Vague recommendations transfer the decision back to the athlete — which is what Láyo is supposed to replace. An athlete who doesn't know how hard to push is not helped by "take it easy." They need a specific substitution they can act on without judgment calls.

### Prompt enforcement

The system prompt must:
1. State that `modification_detail` must describe a concrete change to volume, intensity, or structure (not subjective cues like "easier" or "shorter").
2. Provide at least one example of the expected format.
3. Instruct the LLM to use workout-type-appropriate language: interval sessions get rep/duration changes, long runs get mileage changes, strength sessions get set/weight changes.

---

## 5. Taper logic design

### What taper logic covers

In the final two weeks before a goal race, training plans typically reduce volume significantly (taper). During this period:

- Missing a session is more disruptive than at any other time (each session has a specific purpose)
- Athletes are often more anxious and more likely to over-train to feel ready
- Low feel scores may reflect taper anxiety rather than genuine fatigue

### How it is handled in the prompt

The system prompt instructs the LLM to:

1. Identify when the user is within 14 days of their event date (derived from `eventDate` in the user profile, included in the user message).
2. Apply a higher bar for recommending rest or significant modification during taper. A low feel score during taper is more likely to be taper anxiety than real fatigue — the recommendation should lean toward as_written unless recovery signals are clearly stacked negative.
3. In peak week (7 days out), quality of key sessions is paramount — the recommendation should protect high-intensity sessions and be more willing to recommend dropping supplemental volume if recovery is borderline.

The LLM computes event proximity itself from the data provided. No server-side business logic computes this — the system prompt constrains the reasoning, and the LLM applies it.

### Limitation

This logic is entirely prompt-based. If the event date is wrong (e.g., the user is no longer racing), the taper logic applies incorrectly. There is no mechanism in v0.1 to update or cancel the event.

---

## 6. Open questions deferred to future versions

**Resting heart rate and HRV.** The single strongest objective recovery signal — not tracked in v0.1. Future versions should add optional RHR/HRV input to the check-in (via wearable sync or manual entry). With this data, the LLM can anchor subjective feel scores against an objective measure.

**Multi-race event management.** Users can have only one event in v0.1. Users training for multiple races in sequence (e.g., a spring marathon and a fall ultra) need a different training goal model. Deferred.

**Baseline learning.** The product's vision includes building a personal baseline over time — the LLM response improves as it sees more of the user's history. In v0.1, the last 14 check-ins are passed as context, but no explicit baseline modeling is done. A future version might include a user-specific baseline profile derived from history.

**Training load calculation.** Currently the LLM infers training load qualitatively from yesterday's workout type and description. An explicit training stress score (e.g., TSS, TRIMP) would give the LLM a more reliable picture. Deferred pending integration with a training platform or manual load entry.

**Illness and injury handling.** There is no explicit illness/injury field in the check-in. A user experiencing illness is expected to enter it via the stressors field as free text. The LLM is expected to recognize and act on it, but this is not validated or tested in v0.1.

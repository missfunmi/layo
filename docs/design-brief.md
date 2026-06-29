# Láyo — Design Brief

## Context

Láyo is a fitness coaching assistant for female endurance athletes. It delivers a daily workout adjustment recommendation — execute as planned, modify, or rest — based on a short morning check-in covering sleep, subjective feel, cycle day, and acute stressors. The core design challenge is earning trust from athletes who are skeptical of generic wellness advice: the product must feel direct, intelligent, and built specifically for them, not like another pastel health app.

---

## Brand identity

**Name:** Láyo — derived from *ayọ*, the Yoruba word for joy. The name carries warmth, personality, and specificity. It is not a generic wellness brand.

**Wordmark:** lowercase `láyo` in Space Grotesk Bold, with a tonal accent on the á. Pre-built SVGs exist for both light and dark contexts (`layo-logo-light.svg`, `layo-logo-dark.svg`). The wordmark is always lowercase. Never render it in title case.

**Capitalization in prose:** "Láyo" (capital L, accented á) when written in a sentence or document. "láyo" (all lowercase) for the wordmark and logo only.

**Wordmark placement:** Centered and large on entry/splash screens. Top-left header on all subsequent screens, at a size that anchors without dominating.

---

## Design direction

**Fresh, modern, playful, whimsical — with vibrant color.**

Láyo is not a clinical health app, not a generic fitness tracker, and not a dark-mode-first product. It is warm, direct, and joyful without being juvenile. The visual language should feel like a burst of energy at 6am — alive and confident, not corporate or cautious.

**Color does structural work.** Rather than using color decoratively, color organizes the experience and signals meaning. The recommendation output states each have a distinct color register. Interactive selections use the brand mint. Error states use coral. This gives the user a felt sense of where they are and what the app is communicating, without having to read everything.

**Restraint in complexity.** Every visual element should earn its place. No decorative illustrations, no gamification rings or streaks, no heavy iconography. The product's confidence comes from clarity, not ornamentation.

---

## Color palette

| Role | Color | Hex |
|------|-------|-----|
| Brand primary (dark) | Deep forest green | `#0F6E56` |
| Brand primary (light) | Mint / soft sage | `#E1F5EE` |
| Mint mid | Soft teal | `#5DCAA5` |
| Energy accent | Vibrant coral | `#D85A30` |
| Coral light | Soft coral | `#F0997B` |
| Warmth accent | Amber | `#FAC775` |
| Amber dark | Dark amber | `#BA7517` |
| Soft accent | Blush pink | `#ED93B1` |
| App background | Off-white / warm gray | `#F1EFE8` |
| Card / input surface | White | `#FFFFFF` |
| Border / divider | Warm light gray | `#D3D1C7` |
| Text primary | Near-black | `#2C2C2A` |
| Text secondary | Medium gray | `#5F5E5A` |
| Text tertiary | Light gray | `#888780` |
| Text disabled / muted | Very light gray | `#B4B2A9` |

**Usage rules:**

- Deep green (`#0F6E56`) is the primary brand color. It anchors CTAs, selected states, the wordmark, and the "as written" recommendation state. It signals affirmation and forward momentum.
- The app background (`#F1EFE8`) is warm off-white, not pure white. This keeps the interface from feeling clinical and allows white card surfaces to read as elevated without heavy shadows.
- White (`#FFFFFF`) is used for cards and input fields only, surfaces that sit above the background.
- Coral (`#D85A30` / `#F0997B`) signals the "rest" recommendation state and error conditions. It is an alert color, used intentionally and sparingly.
- Amber (`#FAC775` / `#BA7517`) signals the "modify" recommendation state. It communicates caution and adjustment without alarm.
- Blush pink (`#ED93B1`) is a contextual accent, used only in cycle-related content. It does not appear in general UI.
- Muted gray (`#B4B2A9`) is for disabled states, placeholder text, and secondary interactive elements (e.g. the close/exit icon) that should be present but visually subordinate.

---

## Typography

**Display / headings:** Space Grotesk Bold (700). The wordmark font, carried into the product. Used for screen titles, question headings, and recommendation outputs — anywhere Láyo is "speaking" decisively.

**Body / UI:** Inter (400, 500). Clean, highly legible at small sizes on mobile. Used for sublabels, supporting copy, input text, card detail, and all secondary UI elements.

**Rules:**
- Never use more than two weights of Inter in the same view (400 and 500 are sufficient)
- Space Grotesk is reserved for headings and the wordmark — never for body copy or labels
- Text hierarchy is established through size and weight, not color (color carries semantic meaning; it should not also carry hierarchy)
- Minimum body text size: 12px. Nothing smaller in the core product flow.

**Type scale:**
| Role | Size | Weight | Font |
|------|------|--------|------|
| Screen title / recommendation heading | 24–28px | Bold (700) | Space Grotesk |
| Question heading | 20–22px | Bold (700) | Space Grotesk |
| Body / subtext | 13–14px | Regular (400) | Inter |
| Card label | 13px | Medium (500) | Inter |
| Card detail / caption | 11–12px | Regular (400) | Inter |
| Overline / metadata | 10–11px | Medium (500) | Inter |

---

## Icons

**Icon pack:** Tabler Icons (webfont). Use the webfont in all implementation.

**Usage philosophy:**
- Icons are functional, not decorative. Every icon in the product either clarifies a label, signals an interaction type, or conveys a state.
- Icons are never used alone without a label or clear context. They support text; they do not replace it.
- Icon size should feel proportional to the surrounding text — typically 14–18px in body contexts, larger only in illustrative moments (e.g. confirmation states).
- Prefer outline-style icons (Tabler's default) over filled icons. Filled icons are reserved for selected/active states where contrast is needed.

---

## Layout and spacing

**Mobile-first, single column.** The app is used in the morning, on a phone, often when not fully awake. Every layout decision optimizes for one-handed, low-cognitive-load use on a ~390px viewport.

**Conversational cadence.** The check-in flow is a dialogue, not a form. One question or concept per screen. Generous vertical breathing room between elements. The user should never feel rushed or overwhelmed.

**Surface hierarchy:**
- App background (`#F1EFE8`) is the base layer
- White cards (`#FFFFFF`) are the primary content surface, elevated visually without drop shadows
- Inputs use white with a `#D3D1C7` border at rest, `#0F6E56` border when active/filled

**Spacing:**
- Screen padding: 24px horizontal, 22px top
- Gap between major sections within a screen: 16–24px
- Gap between related elements (e.g. label and input): 8px
- Minimum tap target size: 44px (achieved through padding on smaller visual elements)

**Border radius:**
- Phone shell / full-screen containers: 36px
- Cards and option tiles: 14–16px
- Inputs: 14px
- Pills / tags: 100px (fully rounded)
- Primary CTA button: 100px (fully rounded)
- Small circular buttons (back, close): 50% (perfect circle)

---

## Buttons and inputs

**Primary CTA:** Full-width, fully rounded (100px radius), deep green background (`#0F6E56`), white text, Inter Medium 15px. One per screen. Always pinned to the bottom of the content area.

**Secondary / destructive actions:** Text links, never buttons. Grey (`#888780`) with no underline by default. Paired with a relevant icon where the action type benefits from visual reinforcement (e.g. reload icon for "redo"). These actions are available but not prominent.

**Back button:** Small circle (34px), white background, `#D3D1C7` border, grey arrow icon. Positioned top-left in the navigation row.

**Close / exit button:** Bare icon only — no background, no border. Grey (`#B4B2A9`), 16px icon, 8px padding for tap target. Positioned top-right in the navigation row. Visually subordinate to the back button.

**Text inputs:** White background, `#D3D1C7` border at rest, `#0F6E56` border when active or filled, 14px Inter, 13–15px vertical padding, 14px border radius. Character counts displayed right-aligned below the field in `#B4B2A9`.

**Scale inputs (1–5):** Equal-width pill buttons in a horizontal row. White background and `#D3D1C7` border at rest; mint background (`#E1F5EE`) and green border (`#0F6E56`) when selected. Scale labels (e.g. "rough" / "great") displayed below in `#B4B2A9` at 11px.

**Multi-select pills:** Inline, wrapping. White background and `#D3D1C7` border at rest; mint background and green border when selected. Inter Medium 13px, 9px vertical / 16px horizontal padding, fully rounded.

**Option cards (tappable):** White background, `#D3D1C7` border, 14–16px border radius. Contains an icon cell (left) and label + detail text (right). Selected state: mint background, green border, icon cell shifts to deeper mint.

**Yes/No selectors:** Two equal-width cards side by side, same selected/unselected treatment as option cards.

---

## Voice and copy

Láyo speaks like a knowledgeable friend, not a coach with a clipboard.

**Character:**
- Direct — gives a specific answer, not a hedge
- Warm — acknowledges the human behind the question
- Non-capitulating — does not immediately validate low readiness; reads the full picture before responding
- Evidence-aware — explains its reasoning without being preachy

**Copy conventions:**
- Sentence case throughout, including button labels and question text
- Active voice always
- No em dashes anywhere in the product
- No clinical language ("How did you sleep?" not "Rate your sleep quality")
- No hedging language ("Here's what I'd do" not "One option might be...")
- Subtext appears below question headings where a question may feel unexpected or personal; same tone as the heading, never clinical or apologetic
- Numbers and scores are always written as numerals, not words

**Tone by context:**
- Onboarding: welcoming, unhurried, a little warm. The user is being invited in.
- Check-in: efficient, friendly, matter-of-fact. The user has done this before and wants to get through it.
- Recommendation: direct and confident. This is the product's primary value delivery moment. No softening, no hedging.
- Error states: clear and action-oriented. Never apologetic. Tell the user exactly what to do next.

---

## Error and empty states

- Error states use coral (`#D85A30` / `#F0997B`) as the signal color
- Error messages are direct and specific: tell the user what went wrong and what to do, not that something "went wrong" generically
- If data fails to load, show the minimum viable UI with a clear retry action — never a blank screen
- Empty states (e.g. no check-in yet today) are not treated as errors; they are neutral prompts to begin
- The app never apologizes in error copy; it states the situation and offers the next step

---

## What this product is not

- Not a generic fitness tracker (no rings, streak counters, progress circles, or gamification)
- Not a clinical health interface (no hospital-adjacent palettes, no dense data tables)
- Not a dark-mode-first product (light mode is the design baseline for v0.1)
- Not illustration-heavy (no decorative spot illustrations or character art)
- Not a maximalist dashboard (every visible element has a functional reason to exist)

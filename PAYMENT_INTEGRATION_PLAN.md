# Payment Credits & Donation-Based Paywall Design
*incorporating the "small, reversible, closed-loop" recommendations*

## 1. Overview 
We want to monetize the AI image-generation feature through a donation-based, pay-per-credit model without forcing users to create an account. Right now the Generate Image button should instead say "Support the Baby Simulator and see {childname} in a photo"

### Key Features
1. **Pricing** - name your own price (donation based)
   • EN (Apple Pay on mobile, card on desktop): **US $1.99 = 2 credits**, then 1 credit per additional whole dollar.  
   • ZH (Alipay): **￥6 = 1 credit**, then 1 credit per additional ¥6.  
   • Users may pay more than the minimum; every price unit (USD $1 / RMB ¥6) → 1 extra credit.

2. **No mandatory login** — anonymous by default. Optional email field in Checkout for:
   • Track your credit for the next play
   • Stripe receipts.  
   • Send shareable ending card & image.

3. **Entitlement rules**  
   • Credits consumed per image generation.  
   • Credits persist in-browser (localStorage UUID).  
   • Backup lookup by email if same browser info lost.  
   • When credits == 0 and user reaches the ending card and is presented with the image generation option - paywall re-appears.

4. **Embedded Stripe Checkout** for seamless UX, fallback redirect if embed fails.

5. **Retry**: If Checkout canceled / fails, user can reopen paywall and try again.

### Safety Approach
• **Feature flag** (`PAYWALL_VERSION = "off" | "test" | "on"`) - ship code dark, flip when ready
• **Test/Live key separation** - stored in Supabase config table to prevent live charges during development
• **Fallback bypass** (`?skipPaywall=yes`) - emergency escape hatch for support
• **Vertical slices** - end-to-end testable increments (see §7)
• **Shadow table** - safe DB migration with rollback capability

---

## 2. Safety Rails (add before coding)

| Safety rail | Why it matters | One-line implementation hint |
|-------------|----------------|------------------------------|
| Feature flag (`PAYWALL_VERSION = "off" \| "test" \| "on"` in .env) | Lets you ship merged code while keeping production behaviour unchanged. | Wrap the first line of PaywallGate with `if (flag!=="on") return children;` |
| Test/Live Stripe keys in Supabase config table | Prevents accidental live-mode charges during local QA. | Add a `stripe_mode` column; webhooks reject if header stripe-mode ≠ config value. |
| Fallback path (e.g. query param `?skipPaywall=yes`) | Guarantees you can bypass the whole flow if a mission-critical bug sneaks in on launch day. | `const debugSkip = new URLSearchParams(location.search).get("skipPaywall")` |
| Strict TypeScript types + zod validation for API payloads | Most outages in payments come from "undefined" fields during refactors. | Co-locate zod schemas beside endpoint files and reuse them in the front-end. |

---

## 3. Architecture Snapshot (updated)
```
SPA (React + Zustand)
 └─ PaywallGate (respects PAYWALL_VERSION flag)
Backend (serverless /api, Node + Stripe SDK)
 ├─ POST /create-checkout-session    // Stripe or stub
 ├─ POST /webhook                   // writes → purchases_shadow
 └─ GET  /credits?anonId|email      // source = env.PERSISTENCE
Supabase
 ├─ config table (stripe_mode, keys,…)
 ├─ purchases_shadow  (temp landing zone)
 └─ purchases         (promoted after parity proven)
```

---

## 4. Data Model 

### Tables
| Table | Extra columns | Notes |
|-------|---------------|-------|
| `purchases_shadow` | identical to purchases | Webhook writes here for slices 0-2. |
| `purchases` | — | Becomes authoritative once env `PAYWALL_PERSISTENCE="db"` |

### Core purchases table schema
| Field | Type | Notes |
|-------|------|-------|
| anon_id | UUID (text) | Stored in localStorage; sent to backend |
| email | text (null) | From optional Stripe Checkout field |
| credits | int | Incremented per unit paid |
| currency | enum (USD,RMB) | Determined by language / price ID |
| amount | int (cents) | Gross amount paid |
| stripe_session | text | For audits & refunds |
| created_at | timestamp | |

---

## 5. User Flow - note for each type of use there should be as few steps as possible for smooth checkout experience
1. Player reaches image generation → `PaywallGate` checks credit stored locally, and ask the user (optionally) to input their email address to check if they have an email they have registered / have credits with
2. No credits → shows `PaywallUI` popup with localized price table & donation slider
3. "Continue & Pay" → call `/create-checkout-session` with `{anonId, email?, lang, donatedUnits}`
4. Embedded Checkout renders, user pays via locale-specific methods
5. Stripe triggers `checkout.session.completed` → `/webhook` verifies & adds row to `purchases_shadow`, calculates `credits = donatedUnits`
6. Frontend pulls `/credits` (or Supabase realtime) until balance > 0 → unlocks and decrements per generation at ending

---

## 6. Stripe Configuration (clarified)
• Single price ↔ unit-price map lives only in backend; client passes `donatedUnits`, never raw $ / ¥.
• Test-mode price IDs mirror live IDs; backend chooses by `stripe_mode`.
• Enable Apple Pay (mobile) & Credit Card for EN locale.  
• Enable Alipay for ZH locale.  
• Optional email field = true.  
• Success URL ➜ `#/payment/success?session_id={CHECKOUT_SESSION_ID}`  
• Cancel URL ➜ returns to game state.

---

## 7. Execution Plan – Vertical Slices

| Slice | Goal (user-visible) | Backend | Front-end | Test / CI |
|-------|-------------------|---------|-----------|-----------|
| **0** | Game unchanged; dev console can "grant fake credit". | Stubbed `/createCheckoutSession` & `/webhook` (RAM map). | PaywallGate hidden unless flag = test. | Vitest unit: atomic decrement race. |
| **1** | Real test-mode Stripe checkout → RAM credits. | `/createCheckoutSession` uses Stripe test keys. | Embedded Checkout works end-to-end. | Playwright script + Stripe CLI replay. |
| **2** | Webhook writes to `purchases_shadow` (still reads RAM). | Insert row + basic idempotency. | No FE change. | CI cron diffs RAM vs DB. |
| **3** | Switch read-path to DB; add anonId ↔ email recovery. | GET `/credits` now queries DB. | Email "restore credits" flow. | Cypress: clear localStorage, credits restore. |
| **4** | Currency slider (read-only) + localisation. | — | Slider shows suggested donation; qty fixed. | Unit test for unit-math per locale. |
| **5** | Harden & monitor; feature flag on. | Row-lock consume RPC, alerts, webhook retry tests. | Live UI copy, observe Supabase realtime. | Stripe CLI + load test. |

### Vertical slice details

#### Slice 1 (Test-mode Stripe → RAM credits)

**Front-end ↔ RAM refresh contract**

1. `PaywallUI` creates the Session with `embedded + redirect_on_completion=never`.
2. `EmbeddedCheckout` listens for `stripe-session state:"complete"` (postMessage) **OR** Stripe's `onComplete` callback.
3. On completion the component:
   a. Displays a 2-second "Thank you / you now have N credits" mini-panel.
   b. Fires `fetchCredits()` → `GET /api/credits?anonId=…`.
   c. RAM store (`creditsStorage` Map in `api/paymentShared.ts`) now already holds the increment (webhook wrote it). The endpoint returns the fresh count.
   d. Zustand `paymentStore` persists `{anonId, credits}` to localStorage.
   e. Dialog closes ⇒ control returns to whatever React page invoked the paywall.
4. First successful `AIImageGenerator.onImageGenerated` after that calls `consumeCredit()` which atomically decrements the in-memory store and updates localStorage.

Edge-cases handled:
• If webhook is slow, `fetchCredits` retries via PaywallGate when the user tries again.
• If the user reloads the SPA, `paymentStore` rehydrates from localStorage and still shows the new balance.

> No additional DB writes yet—still slice 1 RAM only.

---

## 8. QA & Launch Checklist

| Scenario | Tool | Expected |
|----------|------|----------|
| Pay → credits +1 | Playwright | Generate button enabled. |
| Cancel checkout | Playwright | Game state intact. |
| Duplicate webhook | Stripe CLI | No double credit. |
| Clear storage | Cypress | Credits restored via email. |
| Simul. consume | Vitest | Balance never negative. |
| Webhook down 10 min | Alert | Pager triggers. |

---

## 9. Open Questions (trimmed)
1. Donation slider wording: "Name your own price" & minimum 1 credit, no max limit
2. Email provider (Supabase SMTP likely).
3. Enable rate-limiting per anonId to prevent abuse of 0-credit check and to prevent going around our hook to generate their own pictures for other purposes?
4. Need to update GDPR / PIPL compliance banners for personal data storage (but only if and when the data is actually prompted and collected so that there is minimum disruption to user flow)

---

## 10. Deliverables (unchanged except italicised)
1. Serverless functions (`createCheckoutSession`, `webhook`, `getCredits`, *no consumeCredit until slice 3*).
2. Supabase migrations for `purchases_shadow` → `purchases`.
3. React components (PaywallGate *flag-aware*, PaywallUI, updated AIImageGenerator).
4. Email backup / receipt template.
5. Docs: this file, README, Privacy / Terms.

---

## ✂️ What we deliberately postponed
• Fancy email HTML & localisation polish → after slice 5.
• Rate-limiting beyond basic Cloudflare rules → revisit post-launch metrics.

**Next action:** create branch `feat/paywall-slice0`, wire stubs & unit test, set `PAYWALL_VERSION=test`. Merge once CI green.
# Reducing OTP Cost: Authentication Techniques for Returning Users

**Context:** SMS OTP is acceptable for CIP as an initial verification factor, but sending an OTP on every login costs money. This document captures the options for authenticating **returning** users cheaply and securely, and the recommended sequence for CIP.

**Core reframe:** OTP should be **enrollment, not login**. If a returning user costs an SMS, that is a session-lifetime problem, not an inherent cost of the design. The biggest, zero-cost win already exists in the CIP codebase.

---

## 1. Fix session longevity first — machinery already exists (cost: 0)

Verify with OTP **once**, then keep the user signed in with a refresh token while the client silently obtains fresh access tokens in the background. CIP already implements this:

- `AuthenticationService::verifyOtp()` issues a Sanctum access token **plus** a refresh token (`RefreshTokenService::issue`).
- `config/cip.php` sets `auth.refresh_ttl_days = 14`; the `jwt.refresh_ttl_days` security policy is seeded to 30; access token TTL is 60 minutes.
- `/auth/refresh` rotates the refresh token with reuse-detection.

A returning user should therefore **not** re-OTP for weeks. If they are, the likely causes are:

- The PWA is **not performing silent refresh** (not calling `/auth/refresh` around access-token expiry), so the session dies at 60 minutes and the app falls back to OTP.
- Refresh TTL is too short, or refresh tokens are being cleared (logout, storage eviction, a service-worker update wiping IndexedDB).

**Action:** ensure the PWA durably persists the refresh token and silently rotates it; extend refresh TTL to 30–90 days for a mobile-first civic app. This alone can remove roughly 95% of repeat-login OTPs with no new technology.

---

## 2. Passkeys / WebAuthn — the modern standard (cost: 0 per login, phishing-resistant)

After the first OTP, enrol a **passkey** (platform authenticator: Face ID / fingerprint / device PIN). Every subsequent login is a biometric tap — no SMS ever again on that device — and it is phishing-resistant, unlike OTP. Works in the CIP PWA on modern Android/iOS/Chrome/Safari.

**Caveat for CIP:** the Pilot Acceptance Specification lists 2FA / passkey enrollment as explicitly **out of scope for v1** (columns exist, no enrollment flow). Passkeys are therefore a strong **post-pilot** upgrade, not a pilot-day change.

---

## 3. Push-approval re-auth — reuse existing Web Push (cost: 0)

CIP already ships Web Push (VAPID / FCM). A returning user on a known device can be re-authenticated by tapping **Approve** on a push notification instead of receiving an OTP. Zero marginal cost; useful as a step-up factor.

---

## 4. Risk-based / adaptive authentication — the "AI-era" layer

AI fits here not as the credential but as the **decision layer for when to challenge**:

- **Silent by default** for a recognized device + valid refresh token + normal behavior.
- **Step up to OTP only when risk is elevated:** new device fingerprint, new city/IP, impossible travel, anomalous timing, or a high fraud score.
- **Signals available in CIP:** device fingerprint, geo/IP, behavioral patterns, and the existing fraud-scoring pipeline (`fraud_score`, `mock_gps_score`, device fingerprint).

Net effect: the vast majority of logins are SMS-free; OTP fires only on the small fraction that genuinely looks risky — the same approach banks and large platforms use to cut OTP cost while staying secure.

**Important:** behavioral / AI signals are a **risk layer, not an authenticator**. The returning credential must remain the refresh token or passkey. AI signals decide *whether* to challenge; they never grant access on their own.

---

## Related: reverse SMS / missed-call verification (for the enrollment SMS itself)

If the goal is also to cut the cost of the initial verification SMS:

- **Missed-call verification** — the user gives a missed call to your number (or vice versa) and you match the caller MSISDN. Near-zero cost to the user, cheap inbound, familiar in India. Often the best fit for a Bengaluru pilot.
- **Mobile-originated (MO) SMS** — the user sends an SMS containing a one-time nonce to your inbound long/short code; your gateway webhook delivers `{from: <MSISDN>, body: <nonce>}` and you verify the number by the sender MSISDN. Note: the user still pays their SMS tariff and you pay for the inbound number + DLT registration, so it is not truly free. The browser cannot read the sent SMS — detection is entirely server-side via the gateway webhook, and an `sms:` deep link can only pre-fill and open the SMS app, never auto-send.
- **Silent Network Authentication (SNA)** — carrier-level verification over the mobile data connection, no SMS and no user action (per-check fee; only works on mobile data, not Wi-Fi-only).

---

## Recommended sequence for CIP

| When | Change | Cost | Effort |
|---|---|---|---|
| Now (pilot) | PWA silent refresh; extend refresh TTL. OTP becomes once-per-device-per-month or better. | 0 | Low — uses existing `/auth/refresh` |
| Now (pilot) | Adaptive rule: re-OTP only on new device / elevated risk. | 0 | Low–medium, reuses fraud signals |
| Post-pilot | Passkeys / WebAuthn enrollment after first OTP -> biometric logins. | 0/login | Medium (out of v1 scope) |
| Optional | Push-approval re-auth via existing Web Push. | 0 | Low–medium |

**Bottom line:** you do not need a new "AI" authenticator to stop paying for repeat logins. Make OTP a one-time enrollment backed by long-lived silent sessions, add adaptive risk to decide the rare re-challenge, and finish with passkeys after the pilot.

**Security note:** whichever mechanism is adopted, it must not reuse the production debug-OTP shortcut of returning the secret in the API response (see finding RED-001 in `docs/RED-TEAM-AUDIT-2026-08-21.md`). The refresh-longevity and passkey approaches help here because there is no outbound code to leak.

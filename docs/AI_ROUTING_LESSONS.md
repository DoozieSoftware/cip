# AI Routing — Lessons Learned & Edge Cases

**Date:** 2026-07-15
**Author:** CIP Team
**Status:** Active reference

---

## Context

End-to-end testing of the AI vision → routing pipeline revealed six
distinct bugs, each of which would silently break auto-routing in
production. This document records each issue, its root cause, the
fix applied, and the edge case it protects against in future.

---

## 1. Provider fraud_score returns 100 for everything

**Symptom:** Every report showed Fraud Risk = 100, even clear, genuine
images of potholes, garbage, and streetlights.

**Root cause:** The Modal vision model returns `fraud_score: 100` in
its JSON response for every image, regardless of content. The
orchestrator took `max(platformFraudScore, providerFraudScore)`,
so the broken provider value always won.

**Fix (`AiPipelineOrchestrator`):** Stop using `response->fraudScore`
entirely. The platform's `FraudScorer` already folds in the provider's
`synthetic_score` via the `ai_synth` signal. Only elevate fraud when
`synthetic_score >= 0.5` (explicit visual manipulation detection).

```php
// BEFORE (broken):
$fraudScore = max($platformScore, $response->fraudScore);

// AFTER:
if ($response->syntheticScore !== null && $response->syntheticScore >= 0.5) {
    $fraudScore = max($platformScore, (int) round($response->syntheticScore * 100));
}
```

**Lesson:** Never trust a single provider field as a final score.
Cross-validate with platform-computed signals. If a model field
is unreliable, gate it behind a secondary signal (synthetic_score)
rather than using it raw.

---

## 2. Duplicate detector flags unrelated recent reports

**Symptom:** Every new report showed Duplicate Risk = 100, even when
the images were completely different (different perceptual hashes,
different content).

**Root cause:** The `timeBoost` signal in `DuplicateDetector` gave
`timeBoost = 100` for any report from the same day, regardless of
whether the perceptual hashes matched. A recently-submitted but
visually-unrelated report inflated the duplicate score to 100.

**Fix (`DuplicateDetector`):** Only apply `timeBoost` when the
perceptual hash distance is within the hamming threshold (i.e., the
images are actually similar). Visually-distinct media is skipped
entirely — recency alone does not create a duplicate.

**Lesson:** Recency is a decay modifier, not a standalone signal.
A recent but unrelated image must score 0 on duplicate detection.

---

## 3. Auto-route threshold was unreachable

**Symptom:** Zero reports auto-routed to departments. Every report
went to `pending_moderator`.

**Root cause:** The confidence threshold was `> 95`, but the vision
provider caps raw confidence at 0.95 and the quality calibration
caps it further. No report ever exceeded 0.95 in production.

**Fix:** Lower `auto_route_min` from 95 to 90, and
`moderator_review_min` from 80 to 75. Thresholds remain config-driven
via `CIP_AI_AUTO_ROUTE_MIN` / `CIP_AI_MODERATOR_REVIEW_MIN` in
`config/cip.php`.

**Production data (before fix):**

| Confidence | Count | Auto-routed? |
|-----------|-------|-------------|
| 0.95 | 9 | No (> 95 required) |
| 0.90 | 2 | No |
| 0.80 | 2 | No |
| 0.00 | 6 | No |

**Lesson:** Always validate thresholds against real production data
before deploying. A threshold that looks reasonable in theory may
be unreachable given the model's actual output distribution.

---

## 4. Claim-mismatch destroys valid AI classification

**Symptom:** A report with a clear pothole photo got confidence = 0
and category = "unclassified" because the AI noted the citizen
mentioned two-wheelers falling into the pothole, which weren't
visible in the image.

**Root cause:** `guardAgainstClaimMismatch()` treated any
`claim_matches_evidence = false` as a total mismatch, forcing
confidence to 0 and category to "unclassified" — destroying the
AI's correct visual classification.

**Fix (`AiPipelineOrchestrator`):** Remove the destructive override.
Preserve the AI's visual classification (type, confidence, department,
severity) as-is. The claim-mismatch metadata (`claimMatchesEvidence`,
`consistencyScore`, `mismatchReason`) is kept for the moderator to
see, but the visual result is not altered.

**Lesson:** A partial claim mismatch (citizen mentions a detail not
visible in the photo) is NOT the same as a wrong classification.
The AI correctly identified "pothole" — the missing two-wheelers
don't change that. Never destroy a valid visual signal over a
metadata inconsistency.

---

## 5. Auto-route ignores claim-mismatch metadata

**Symptom:** Even after fix #4 preserved the AI classification, a
report with `claim_matches_evidence = false` could still auto-route
to a department if the confidence was high enough.

**Root cause:** `AiCompletedListener` only checked the confidence
threshold before auto-routing. It never examined `claimMatchesEvidence`
or `consistencyScore`.

**Fix (`AiCompletedListener`):** Added a claim-mismatch gate.
Auto-route is only allowed when BOTH conditions are met:
1. Confidence exceeds the auto-route threshold
2. `claimMatchesEvidence` is not false AND `consistencyScore >= 50`

If either fails, the report goes to moderator review.

**Lesson:** High AI confidence is necessary but not sufficient for
auto-routing. The AI may be confidently wrong (hallucinating a
category from an unrelated image). Claim consistency is a second
independent check that must also pass.

---

## 6. Quality cap limits confidence for real images

**Observation (not a bug):** The `ImageQualityAnalyzer` scores
real citizen photos at 70–85% due to file size, resolution, and
pixel analysis. This caps the calibrated confidence via
`min(raw_confidence, quality/100)`.

**Why this is correct:** A blurry, dark, or low-resolution image
should not get high confidence even if the AI guesses the category.
The quality gate blocks unusable images (quality < 50) and reduces
confidence for marginal ones.

**Trade-off:** This means real, clear photos rarely reach > 90%
confidence, so auto-route is rare in practice. This is a deliberate
safety choice — moderator review is cheap; a wrong auto-route is
expensive.

**Future option:** If auto-route volume needs to increase, consider
raising the quality flag threshold from 50 to a higher value, or
adjusting the quality→confidence mapping to be less aggressive for
medium-quality images (50–80 range).

---

## Summary of all fixes

| # | Issue | Root Cause | Fix | File |
|---|-------|-----------|-----|------|
| 1 | Fraud = 100 for all images | Provider returns broken fraud_score | Ignore provider fraud_score; use synthetic_score only | `AiPipelineOrchestrator.php` |
| 2 | Duplicate = 100 for new reports | timeBoost without hash match | Require hash match before applying timeBoost | `DuplicateDetector.php` |
| 3 | Nothing auto-routes | Threshold > 95 unreachable | Lower to > 90 (config-driven) | `config/cip.php` |
| 4 | Valid AI classification destroyed | guardAgainstClaimMismatch too aggressive | Preserve AI visual classification | `AiPipelineOrchestrator.php` |
| 5 | Mismatched claims auto-route | No claim check in auto-route gate | Added claim-mismatch gate | `AiCompletedListener.php` |
| 6 | Quality caps confidence | Correct but limits auto-route | By design — safety trade-off | N/A |

---

## Testing notes

### How to re-run the AI routing test

```bash
cd backend
# Clean old test data first (interactive — adjust citizen mobile as needed)
php artisan tinker --execute='
  DB::statement("SET FOREIGN_KEY_CHECKS=0");
  $userId = DB::table("users")->where("mobile","9999900001")->value("id");
  // ... delete related rows ...
  DB::statement("SET FOREIGN_KEY_CHECKS=1");
'

# Run the test
php artisan tinker --execute="require '/home/doozie11/dev/cip/scripts/test-ai-routing.php';"
```

### Test images

Real civic issue images from Unsplash (free license) in
`test-fixtures/evidence/real_*.jpg`:
- `real_pothole.jpg`, `real_pothole2.jpg`
- `real_garbage.jpg`, `real_garbage2.jpg`
- `real_streetlight.jpg`, `real_streetlight2.jpg`

### Expected results (after all fixes)

| Image | AI Conf | Quality | Fraud | Duplicate | Status |
|-------|---------|---------|-------|-----------|--------|
| pothole | 85% | 85% | 20 | 0 | pending_moderator |
| garbage | 70% | 70% | 20 | 0 | pending_moderator |
| streetlight | 70-80% | 70-80% | 20 | 0 | pending_moderator |

All go to moderator (confidence < 90 due to quality cap).
Fraud should be 20 (repeated device signal from test citizen),
not 100. Duplicate should be 0 (genuinely different images).

### What auto-route looks like

For a report to auto-route, ALL of these must be true:
1. AI confidence > 90 (after quality calibration)
2. `claim_matches_evidence = true` OR `consistency_score >= 50`
3. A matching routing rule exists for the category/department
4. The report is still in `ai_processing` state

In practice, auto-route is rare because the quality cap limits
confidence to 70-90% for most real photos. This is by design.

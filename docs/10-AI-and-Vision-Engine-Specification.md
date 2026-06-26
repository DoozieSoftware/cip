# 09 - AI Vision Engine & Intelligence Specification

**Project:** Civic Intelligence Platform

**Version:** 1.0

**Status:** Draft

**Depends On**

* 01 Product Vision
* 02 Product Requirements Document
* 03 System Architecture
* 04 Database Design
* 05 REST API Specification
* 06 Citizen PWA Specification
* 07 Moderator Portal Specification
* 08 Operations Portal Specification

---

# 1. Purpose

This document defines the Artificial Intelligence architecture, vision pipeline, model abstraction, prompt engineering, confidence scoring, fraud detection, and learning mechanisms for the Civic Intelligence Platform.

The AI subsystem assists human operators by automatically analyzing submitted evidence.

The AI shall **recommend** decisions, never make irreversible legal decisions.

---

# 2. Objectives

The AI Engine shall

* Classify reports
* Detect multiple issues
* Detect duplicate reports
* Assess evidence quality
* Detect fraudulent submissions
* Recommend departments
* Recommend priorities
* Estimate severity
* Generate structured summaries
* Learn from moderator corrections

---

# 3. Design Principles

AI is advisory.

Configuration over prompts.

Provider independent.

Stateless inference.

Explainable outputs.

Deterministic system prompts.

Human override always available.

Every AI decision is auditable.

---

# 4. AI Architecture

```text
Citizen Upload

↓

Validation

↓

Media Processing

↓

Vision Pipeline

↓

AI Provider

↓

Structured JSON

↓

Confidence Engine

↓

Business Rules

↓

Workflow Engine

↓

Moderator / Department
```

AI shall never directly modify database records.

All decisions pass through the workflow engine.

---

# 5. AI Components

## Vision Engine

Responsible for

* Image understanding
* Video frame understanding
* Scene analysis
* Object detection

Initial Model

Qwen-VL

Future

Gemma Vision

Florence-2

InternVL

Molmo

---

## OCR Engine

Purpose

Extract readable text.

Examples

Vehicle Numbers

Street Names

Building Numbers

Shop Names

Warning Boards

Future providers

PaddleOCR

EasyOCR

Tesseract

---

## Duplicate Engine

Purpose

Detect

Same Issue

Same Location

Same Images

Same Video

Same Object

Uses

Perceptual Hash

Embedding Similarity

Distance Calculation

Time Window

---

## Fraud Engine

Purpose

Detect suspicious submissions.

Factors

Metadata

GPS

Device

Images

Video

Behaviour

---

## Routing Engine

Receives

Category

Severity

Ward

District

↓

Returns

Department

Workflow

Priority

---

# 6. Provider Abstraction

AI providers shall implement a common interface.

```text
AIProvider

↓

analyzeImage()

analyzeVideo()

classify()

summarize()

healthCheck()
```

No provider-specific code shall exist outside this abstraction.

---

# 7. Initial AI Provider

Provider

Qwen-VL

Configurable through

Admin Portal

Settings

Environment

No code changes required.

---

# 8. Processing Pipeline

```text
Upload

↓

Virus Scan

↓

Metadata Extraction

↓

Hash Generation

↓

GPS Validation

↓

Image Quality

↓

OCR

↓

Vision Analysis

↓

Duplicate Detection

↓

Fraud Detection

↓

Category Prediction

↓

Severity Prediction

↓

Department Recommendation

↓

Summary Generation

↓

Confidence Score

↓

Workflow
```

---

# 9. Image Quality Assessment

Reject or flag

Blurred

Dark

Overexposed

Extremely Small

Corrupted

Lens Covered

Motion Blur

Duplicate Frames

Quality Score

0-100

Below threshold

↓

Moderator Review

---

# 10. Category Classification

Example Categories

Garbage

Illegal Parking

Pothole

Streetlight

Road Damage

Water Leakage

Drain Overflow

Encroachment

Tree Fall

Dead Animal

Illegal Dumping

Categories loaded from database.

Never hardcoded.

---

# 11. Multi-label Detection

A report may contain multiple issues.

Example

```text
Image

↓

Garbage

Confidence 98%

Road Damage

Confidence 82%

Blocked Drain

Confidence 74%
```

Primary issue

Highest confidence.

Secondary issues stored for analytics.

---

# 12. Severity Detection

Levels

Low

Medium

High

Critical

Factors

Size

Public Risk

Traffic Impact

Safety Impact

Object Count

AI recommendation only.

---

# 13. Confidence Scoring

Scale

0-100

Rules

95+

Auto Route

80-94

Moderator Review

Below 80

Manual Classification

Thresholds configurable.

---

# 14. AI Output Format

Every provider shall return standardized JSON.

```json
{
  "category":"Garbage",
  "confidence":97.2,
  "severity":"High",
  "department":"Municipality",
  "summary":"Garbage accumulated beside roadside.",
  "objects":[
      "Garbage",
      "Plastic Bags",
      "Road"
  ],
  "quality_score":95,
  "duplicate_score":3,
  "fraud_score":5
}
```

Provider-specific formats are prohibited.

---

# 15. Prompt Engineering

Prompts are stored in the database.

Never inside source code.

Prompt versions are tracked.

Each response stores

Prompt Version

Model

Temperature

Inference Time

Provider

---

# 16. Base System Prompt

The AI shall behave as an expert municipal and traffic incident analyst.

Objectives

* Identify visible civic issues.
* Ignore unsupported assumptions.
* Return structured JSON only.
* Never fabricate observations.
* State uncertainty explicitly.
* Recommend a department.
* Estimate severity.
* Report confidence.

No conversational output.

---

# 17. Category Prompt

The model shall determine

Primary Category

Secondary Categories

Visible Objects

Estimated Severity

Suggested Department

Confidence

Reasoning

Structured JSON

---

# 18. OCR Workflow

Applicable Categories

Traffic

Parking

Property Damage

Reads

Vehicle Number

Street Name

Shop Board

House Number

OCR confidence stored separately.

---

# 19. Video Processing

Initial Version

Extract

1 frame/second

Maximum

5 frames

Frames analyzed independently.

Results aggregated.

Future

Continuous video understanding.

---

# 20. Duplicate Detection

Duplicate Score considers

Distance

Time Difference

Image Similarity

Object Similarity

Category

Ward

Citizen

Duplicate candidates shown to moderator.

No automatic merge.

---

# 21. Fraud Detection

Signals

Mock GPS

Repeated Device

Modified Metadata

Replay Images

AI Generated Image

Rapid Reporting

VPN

Root Detection

Jailbreak

Tor

Browser Automation

Risk Score

0-100

Recommendations

Approve

Review

Reject

Ban

AI recommendations only.

---

# 22. Learning Loop

Moderator corrections become feedback.

Feedback stored.

Future model fine-tuning supported.

No automatic retraining.

---

# 23. AI Explainability

Every prediction stores

Objects Found

Confidence

Prompt Version

Model Version

Provider

Reasoning Summary

Processing Time

Explainability is mandatory.

---

# 24. AI Metrics

Track

Accuracy

Precision

Recall

False Positives

False Negatives

Override Rate

Average Confidence

Latency

Provider Uptime

Token Usage

Cost per Report

---

# 25. AI Health Monitoring

Monitor

Availability

Latency

Failures

Timeouts

Rate Limits

Daily Usage

Token Consumption

Automatic provider failover supported.

---

# 26. Cost Optimization

Expensive inference should be avoided.

Strategy

Image Quality Check

↓

Reject Poor Images

↓

Duplicate Detection

↓

Skip AI if duplicate confirmed

↓

Vision Model

↓

OCR only if required

↓

Summary Generation

This minimizes inference costs.

---

# 27. Provider Failover

Primary

Qwen-VL

Secondary

Configured Provider

Failure

↓

Retry

↓

Fallback

↓

Moderator Queue

No report shall fail because AI is unavailable.

---

# 28. Security

AI providers shall never receive

Citizen Mobile

Email

Authentication Tokens

Personal Identity

Only evidence required for inference.

PII masking supported before inference.

---

# 29. AI Configuration

Administrators may configure

Provider

Model

Temperature

Timeout

Retry Count

Prompt Version

Confidence Thresholds

Fraud Thresholds

Duplicate Thresholds

No deployment required.

---

# 30. Logging

Store

Prompt

Response

Latency

Provider

Tokens

Cost

Errors

Retry Count

Logs searchable.

---

# 31. Future AI Features

Vehicle Make Detection

Vehicle Color

Pothole Dimension Estimation

Garbage Volume Estimation

Road Crack Segmentation

Illegal Advertisement Detection

Smoke Detection

Fire Detection

Flood Detection

Crowd Density

Animal Detection

Disaster Detection

Satellite Integration

Drone Analysis

---

# 32. AI Compliance Rules

The AI shall

Never fabricate observations.

Never guess unreadable text.

Never identify individuals.

Never infer personal attributes.

Never generate legal conclusions.

Never issue challans.

Never override workflow.

---

# 33. Definition of Done

The AI subsystem shall be considered complete only when

* Provider abstraction is implemented.
* Qwen-VL integration is operational.
* Prompt management is database-driven.
* OCR pipeline is functional.
* Vision classification is operational.
* Duplicate detection is implemented.
* Fraud scoring is implemented.
* Confidence scoring is configurable.
* Structured JSON responses are validated.
* AI decisions are fully auditable.
* Moderator feedback is recorded.
* Provider failover is functional.
* Performance metrics are collected.
* No AI provider-specific code exists outside the provider abstraction.
* No business workflow depends solely on AI availability.

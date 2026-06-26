# 06 - Citizen Progressive Web Application (PWA) Specification

**Project:** Civic Intelligence Platform

**Version:** 1.0

**Status:** Draft

**Depends On**

* 01 Product Vision
* 02 Product Requirements Document
* 03 System Architecture
* 04 Database Design
* 05 REST API Specification

---

# 1. Purpose

This document defines the complete functional and UI specification for the Citizen Progressive Web Application (PWA).

The PWA is the only citizen-facing application in Version 1.

The PWA enables citizens to:

* Register/Login
* Capture evidence
* Submit reports
* Track report status
* Receive notifications

The PWA shall not expose administrative functionality.

---

# 2. Technology Stack

Framework

* React 19
* TypeScript

Build

* Vite

State Management

* TanStack Query
* React Context

Forms

* React Hook Form
* Zod

Routing

* React Router

UI

* TailwindCSS
* Headless UI

Maps

* Leaflet
* OpenStreetMap

Camera

* MediaDevices API

Offline Storage

* IndexedDB
* Workbox

Notifications

* Web Push

Authentication

* JWT
* Refresh Tokens

---

# 3. Browser Support

Supported

* Chrome
* Edge
* Safari
* Firefox

Mobile browsers

Android Chrome

Safari iOS

Samsung Internet

Desktop browsers

Supported for report tracking.

Camera functionality is optimized for mobile devices.

---

# 4. PWA Features

The application shall support

* Installation
* Offline mode
* Background synchronization
* Push notifications
* Local caching
* Responsive UI
* Secure camera access

---

# 5. Navigation Structure

```text
Splash

↓

Login

↓

OTP Verification

↓

Dashboard

├── New Report

├── My Reports

├── Notifications

├── Profile

└── Settings
```

---

# 6. Authentication

## Login

Fields

* Mobile Number

Actions

* Send OTP

---

## OTP Screen

Fields

* OTP

Actions

* Verify

* Resend OTP

After verification

↓

Dashboard

---

# 7. Dashboard

Displays

* Total Reports
* Pending Reports
* Resolved Reports
* Draft Reports
* Recent Notifications

Actions

* Create Report
* View Reports
* Profile

---

# 8. New Report Workflow

```text
Select Category

↓

Capture Evidence

↓

Location Validation

↓

Review

↓

Submit

↓

Tracking Number
```

---

# 9. Select Category Screen

Display

Searchable list

Examples

* Garbage
* Illegal Parking
* Pothole
* Water Leakage
* Broken Streetlight
* Illegal Dumping
* Open Drain
* Encroachment

Categories are loaded from API.

Never hardcoded.

---

# 10. Camera Screen

Requirements

Only live camera.

No gallery.

No file upload.

Capabilities

Multiple Photos

One Video

GPS

Timestamp

Metadata

---

Camera Controls

Capture Photo

Record Video

Retake

Flash

Camera Switch

Zoom

---

Restrictions

No screenshots

No imported files

No modified media

---

# 11. Photo Capture

Minimum

1

Maximum

10

Every image

* Timestamp
* GPS
* Hash
* Metadata

Images shown in gallery preview.

Delete allowed before submission only.

---

# 12. Video Capture

Exactly one video.

Duration

3–5 seconds

If duration

<3 sec

Reject

> 5 sec

Reject

Preview before upload.

Delete allowed before submission.

---

# 13. Location Capture

Automatically obtain

Latitude

Longitude

Accuracy

Altitude

Heading

Speed

Address

Ward

District

Location accuracy threshold configurable.

If GPS unavailable

Show retry.

No submission permitted.

---

# 14. Description Screen

Optional

Fields

Title

Description

Anonymous Reporting

Maximum

1000 characters

---

# 15. Review Screen

Displays

Category

Photos

Video

Location

Description

Anonymous Status

Warnings

AI processing notice

Submit button

---

# 16. Submission

Process

Upload

↓

Server Validation

↓

Tracking Number

↓

Notification

↓

Dashboard

If offline

↓

Queue

↓

Auto Sync

---

# 17. My Reports

Displays

Tracking Number

Category

Status

Submitted Date

Priority

Actions

View

Search

Filter

Sort

No edit

No delete

---

# 18. Report Details

Displays

Timeline

Evidence

Department

Current Status

Submitted Time

AI Classification

Moderator Status

History

Citizen cannot modify.

---

# 19. Notifications

Display

Report Accepted

Assigned

In Progress

Resolved

Rejected

System Messages

Push notifications supported.

---

# 20. Profile

Displays

Name

Mobile

Email

Anonymous Preference

Language

Logout

Future

Government Verification

---

# 21. Settings

Options

Notification Settings

Theme

Privacy Policy

Terms

Help

About

---

# 22. Offline Behaviour

Offline

Allowed

Capture

Save Draft

Queue Upload

View Cached Reports

Not Allowed

Submit without GPS

Background Sync

Automatic

Retry Strategy

Exponential backoff.

---

# 23. Local Storage

IndexedDB

Stores

Drafts

Photos

Video References

Queue

Cached Reports

Settings

No passwords stored.

---

# 24. Push Notifications

Events

Report Submitted

Assigned

Accepted

Resolved

Rejected

Maintenance Alerts

---

# 25. Error Handling

Examples

Camera Permission Denied

GPS Disabled

Video Too Long

Upload Failed

Network Lost

Session Expired

Storage Full

Readable user messages required.

---

# 26. Security

The PWA shall detect

Mock GPS (where browser support permits)

Developer Tools (best-effort)

Repeated failed submissions

Replay attempts

Tampered metadata

Rate limit violations

All requests require JWT authentication after login.

---

# 27. Accessibility

WCAG AA

Keyboard Navigation

Screen Reader Support

Large Touch Targets

High Contrast

---

# 28. Responsive Design

Supported widths

Mobile

Tablet

Desktop

Primary target

Mobile devices.

---

# 29. Performance Targets

Initial Load

<2 seconds

Navigation

<500ms

Report Submission

<10 seconds

Offline Startup

<2 seconds

Lighthouse Score

> 90

---

# 30. UI Components

Reusable components

App Layout

Header

Bottom Navigation

Buttons

Cards

Timeline

Status Badge

Map

Camera View

Image Carousel

Video Player

Loading Indicator

Toast Notifications

Confirmation Dialog

Pagination

Search Bar

Empty State

Error State

---

# 31. State Management

Server State

TanStack Query

Local UI

React Context

Forms

React Hook Form

Validation

Zod

Offline Queue

IndexedDB

---

# 32. Folder Structure

```text
src/

components/

layouts/

pages/

features/

api/

hooks/

contexts/

services/

types/

utils/

constants/

assets/

routes/

workers/

offline/

styles/

tests/
```

---

# 33. Route Structure

```text
/

login

verify-otp

dashboard

reports

reports/new

reports/:id

notifications

profile

settings

privacy

terms

help
```

---

# 34. Design Principles

* Mobile First
* Simple Navigation
* Large Touch Targets
* Minimal User Input
* Progressive Disclosure
* Fast Submission
* Offline First
* Accessible
* Consistent Components

---

# 35. Analytics

Capture

Screen Views

Submission Time

Upload Failures

GPS Errors

Camera Errors

Offline Queue Size

Crash Reports

Performance Metrics

No personally identifiable analytics beyond operational requirements.

---

# 36. Future Enhancements

* QR Code Reporting
* Voice Input
* Regional Languages
* OCR Assistance
* AI-assisted Description Generation
* Citizen Reputation
* Saved Draft Templates
* Report Sharing
* In-App Chat
* Digital Signature

---

# 37. Definition of Done

The PWA shall be considered complete only when:

* All screens are implemented.
* Responsive layouts are verified.
* Offline mode functions correctly.
* Camera integration supports live capture only.
* Gallery uploads are blocked.
* GPS validation is enforced.
* Background synchronization is operational.
* Push notifications are functional.
* Accessibility requirements are met.
* Lighthouse score exceeds 90.
* Unit and integration tests pass.
* Security validations are implemented.
* API integration is complete.
* Cross-browser testing is completed.

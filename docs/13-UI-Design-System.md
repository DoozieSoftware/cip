# 13 - UI Design System & UX Standards

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
* 09 Super Admin Portal Specification
* 10 AI Vision Engine Specification
* 11 Security & Anti-Fraud Specification
* 12 External Connector Framework Specification

---

# 1. Purpose

This document defines the visual language, user experience principles, reusable components, interaction patterns, accessibility standards, and design tokens for the Civic Intelligence Platform.

Every interface shall be built from this design system.

No page shall introduce custom UI unless approved.

---

# 2. Design Philosophy

The application is an operational government platform.

The interface shall prioritize

* Clarity
* Speed
* Accessibility
* Consistency
* Data Density
* Reliability

The UI must feel like a modern operations platform rather than a marketing website.

---

# 3. Design Principles

Consistency

Predictability

Accessibility

Mobile First

Desktop Optimized

Fast Interaction

Minimal Clicks

High Information Density

Progressive Disclosure

Never Surprise Users

---

# 4. Visual Language

Style

Modern Enterprise

Flat Design

Minimal Shadows

Rounded Corners

Neutral Colors

High Contrast

No Glassmorphism

No Heavy Animations

---

# 5. Color System

## Primary

Blue

Used for

Navigation

Primary Buttons

Links

Progress

---

## Success

Green

Used for

Completed

Resolved

Verified

Success Messages

---

## Warning

Amber

Used for

Pending

Review

Waiting

---

## Danger

Red

Used for

Errors

Rejected

Critical

Blocked

---

## Information

Cyan

Used for

Notifications

Help

Information Panels

---

## Neutral

Grey Scale

Backgrounds

Cards

Borders

Text

Disabled Controls

---

# 6. Typography

Primary Font

Inter

Fallback

System UI

Hierarchy

H1

Page Title

H2

Section

H3

Card Title

Body

Regular

Caption

Metadata

Monospace

Tracking Numbers

API Keys

Hashes

---

# 7. Spacing System

Use an 8-point grid.

Spacing

4

8

16

24

32

48

64

No arbitrary spacing values.

---

# 8. Border Radius

Buttons

8px

Inputs

8px

Cards

12px

Dialogs

16px

Maps

12px

Consistent across platform.

---

# 9. Shadows

Minimal.

Only

Cards

Dialogs

Dropdowns

No decorative shadows.

---

# 10. Icons

Icon Library

Lucide Icons

Rules

One icon per action

No decorative icons

Always paired with labels for critical actions

---

# 11. Layout

Desktop

```text
Header

↓

Sidebar

↓

Content

↓

Footer
```

Citizen PWA

```text
Top Bar

↓

Content

↓

Bottom Navigation
```

---

# 12. Responsive Breakpoints

Mobile

0-767px

Tablet

768-1023px

Desktop

1024+

Large Desktop

1440+

---

# 13. Navigation

Desktop

Persistent Sidebar

Top Header

Breadcrumb

Mobile

Bottom Navigation

Slide Drawer

Maximum navigation depth

Three levels.

---

# 14. Buttons

Types

Primary

Secondary

Success

Danger

Ghost

Link

Sizes

Small

Medium

Large

Loading state mandatory.

---

# 15. Forms

Every field contains

Label

Placeholder

Validation

Help Text

Error Message

Required Indicator

Validation

Real-time where appropriate.

---

# 16. Inputs

Text

Textarea

Dropdown

Autocomplete

Search

Checkbox

Radio

Toggle

OTP

Phone

Date

Time

File Upload

Camera Capture

---

# 17. Tables

Features

Pagination

Sorting

Filtering

Column Selection

Export

Bulk Selection

Sticky Header

Responsive Mode

Tables shall support keyboard navigation.

---

# 18. Cards

Used for

Statistics

Summaries

Reports

Departments

Analytics

Health Status

Cards must support

Loading

Empty State

Error State

---

# 19. Status Badges

Standard Colors

Submitted

Blue

Pending

Amber

Assigned

Purple

In Progress

Cyan

Resolved

Green

Rejected

Red

Closed

Grey

Never use text alone.

---

# 20. Timeline

Standard timeline component.

Used for

Report History

Audit History

Workflow

Notifications

Every event shows

Time

Actor

Action

Description

---

# 21. Maps

Provider

OpenStreetMap

Features

Marker

Heatmap

Clusters

Drawing

Ward Boundaries

Current Location

Fullscreen

Legend

---

# 22. Evidence Viewer

Supports

Images

Video

Metadata

Fullscreen

Zoom

Carousel

Side Metadata Panel

Download disabled by default.

---

# 23. Dashboard Widgets

Statistics

Trend

Progress

Charts

Recent Activity

Health Indicators

Maps

Queue Status

Widgets are reusable.

---

# 24. Search Experience

Global Search

Autocomplete

Recent Searches

Filters

Saved Filters

Advanced Search

Keyboard Shortcut

Ctrl+K

---

# 25. Notifications

Toast

Success

Warning

Error

Information

Persistent notifications

Notification Center

Unread Counter

---

# 26. Dialogs

Confirmation

Delete

Assign

Escalate

Resolve

Reject

Danger dialogs require confirmation.

---

# 27. Loading States

Skeleton Loading

Progress Indicators

Spinners

Button Loading

Table Loading

Map Loading

Never show blank pages.

---

# 28. Empty States

Every module shall include

Illustration

Message

Action Button

Example

"No reports found."

---

# 29. Error States

Friendly Message

Error Code

Retry Button

Contact Support

Technical details hidden.

---

# 30. Charts

Library

Apache ECharts

Supported

Line

Bar

Pie

Donut

Area

Heat Map

Treemap

Timeline

Charts responsive.

---

# 31. Accessibility

WCAG 2.2 AA

Keyboard Navigation

Screen Reader Support

Visible Focus

High Contrast

Minimum Touch Target

44px

No color-only indicators.

---

# 32. Dark Mode

Future support.

Design tokens prepared.

No implementation required in Version 1.

---

# 33. Motion

Subtle animations only.

Maximum

200ms

No decorative transitions.

Respect reduced-motion settings.

---

# 34. Component Library

Standard Components

App Shell

Sidebar

Header

Footer

Breadcrumb

Button

Input

Textarea

Dropdown

Search

Date Picker

OTP Input

Camera Component

Card

Table

Timeline

Status Badge

Alert

Dialog

Modal

Drawer

Tabs

Accordion

Pagination

Toast

Charts

Map

Video Player

Image Viewer

Loading Skeleton

Empty State

Error State

Every component must be reusable.

---

# 35. Design Tokens

Maintain central tokens for

Colors

Typography

Spacing

Radius

Elevation

Animation

Breakpoints

Z-Index

Opacity

Never hardcode visual values.

---

# 36. Naming Convention

Components

PascalCase

Pages

PascalCase

Hooks

useCamelCase

CSS Variables

kebab-case

Icons

PascalCase

---

# 37. UX Guidelines

Citizen

Maximum

5 steps

to submit a report.

Department

Common actions

≤2 clicks

Admin

Configuration

≤3 clicks

Never require unnecessary navigation.

---

# 38. Internationalization

Prepare for

Multiple Languages

RTL

Localized Dates

Localized Numbers

Localized Time Zones

English only in Version 1.

---

# 39. Print Support

Printable

Report Details

Evidence Summary

Audit Report

Analytics

Department Report

Print styles required.

---

# 40. Performance Targets

Initial Load

<2 seconds

Navigation

<300ms

Table Search

<500ms

Dashboard

<2 seconds

Lighthouse

90+

---

# 41. Design Review Checklist

Every screen shall be reviewed for

Consistency

Accessibility

Spacing

Typography

Responsiveness

Loading States

Empty States

Error States

Keyboard Navigation

Performance

---

# 42. Figma Standards

Every screen shall include

Desktop Layout

Tablet Layout

Mobile Layout

Component References

Auto Layout

Design Tokens

Prototype Links

Developers shall build from approved Figma designs only.

---

# 43. Definition of Done

The UI Design System shall be considered complete only when

* Design tokens are centralized.
* Component library is implemented.
* Typography is standardized.
* Color system is consistent.
* Responsive layouts are verified.
* Accessibility requirements are met.
* Loading, empty, and error states exist for every screen.
* Components are reusable.
* No hardcoded colors or spacing values exist.
* Every screen complies with the design review checklist.
* Figma components and implementation remain synchronized.

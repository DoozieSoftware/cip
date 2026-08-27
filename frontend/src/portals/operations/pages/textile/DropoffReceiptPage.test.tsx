import { describe, it, expect } from 'vitest';

// Phase 1 drop-off receipt page — blocked by D-01/D-02 (reservation vs walk-in, ack contents)
// Tests are marked todo until design decisions unblock the surface.
// This file intentionally contains no component import so it stays green before the page ships.

describe('DropoffReceiptPage (FE-R1)', () => {
  it.todo('FE-R1 [OPEN D-01] loading/empty/error states for counter desk receipt page');
  it.todo('FE-R1 [OPEN D-01] find-by-reference lookup');
  it.todo('FE-R1 [OPEN D-08] submit disabled without mandatory proof photo (when receipt_requires_photo=true)');
  it.todo('FE-E1 every new screen has explicit loading/empty/error states');
});

describe('TextileSchedulePage dropoff filtering (FE-R3)', () => {
  it.todo('FE-R3 [OPEN D-01] approved dropoff requests absent from trip candidate list');
});

describe('Citizen detail dropoff copy (FE-R2)', () => {
  it.todo('FE-R2 [OPEN D-02] dropoff shows centre/hours/reference, never "trip scheduled" copy');
});

describe('Trip manifest (FE-A1/A2)', () => {
  it.todo('FE-A1 [OPEN D-05] trip-manifest assign UI hidden without gate; driver sees own trips only');
  it.todo('FE-A2 [OPEN D-06] manifest reorder up/down commits, optimistic revert on 409');
});

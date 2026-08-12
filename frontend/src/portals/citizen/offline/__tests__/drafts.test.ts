import { beforeEach, describe, expect, it } from 'vitest';
import { clearDraft, loadDraft, saveDraft } from '../drafts';

describe('account-scoped citizen drafts', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('does not expose one account draft to another account', async () => {
    await saveDraft('citizen-a', {
      updated_at: Date.now(),
      type_id: 'roads',
      title: 'A private draft',
      description: 'Only citizen A should see this',
      location: null,
      address: '',
      current_step: 'Details',
      files: [],
    });

    expect(await loadDraft('citizen-b')).toBeNull();
    expect((await loadDraft('citizen-a'))?.title).toBe('A private draft');
  });

  it('clears only the account that logs out', async () => {
    await saveDraft('citizen-a', {
      updated_at: Date.now(),
      type_id: 'roads',
      title: 'A',
      description: '',
      location: null,
      address: '',
      current_step: 'Category',
      files: [],
    });
    await saveDraft('citizen-b', {
      updated_at: Date.now(),
      type_id: 'water',
      title: 'B',
      description: '',
      location: null,
      address: '',
      current_step: 'Category',
      files: [],
    });

    await clearDraft('citizen-a');
    expect(await loadDraft('citizen-a')).toBeNull();
    expect((await loadDraft('citizen-b'))?.title).toBe('B');
  });
});

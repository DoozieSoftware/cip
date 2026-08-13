import { describe, it, expect } from 'vitest';
import { en_IN } from '../en-IN';
import { kn_IN } from '../kn-IN';
import { translate, getCatalog } from '../index';
import type { MessageKey } from '../index';

describe('message catalog', () => {
  it('has matching keys in en-IN and kn-IN', () => {
    const enKeys = Object.keys(en_IN).sort();
    const knKeys = Object.keys(kn_IN).sort();
    expect(knKeys).toEqual(enKeys);
  });

  it('has no empty values in en-IN', () => {
    for (const [key, value] of Object.entries(en_IN)) {
      expect(value, `en-IN "${key}" should not be empty`).not.toBe('');
    }
  });

  it('has no empty values in kn-IN', () => {
    for (const [key, value] of Object.entries(kn_IN)) {
      expect(value, `kn-IN "${key}" should not be empty`).not.toBe('');
    }
  });

  it('interpolates params in en-IN', () => {
    expect(translate('en-IN', 'home.greeting', { name: 'Asha' })).toBe('Good morning, Asha.');
    expect(translate('en-IN', 'submit.stepCount', { current: 2, total: 5 })).toBe(
      'Step 2 of 5',
    );
  });

  it('interpolates params in kn-IN', () => {
    expect(translate('kn-IN', 'home.greeting', { name: 'ಆಶಾ' })).toContain('ಆಶಾ');
    expect(translate('kn-IN', 'submit.stepCount', { current: 2, total: 5 })).toBe(
      'ಹಂತ 2 / 5',
    );
  });

  it('falls back to key when message missing', () => {
    const unknownKey = 'nonexistent.key' as MessageKey;
    expect(translate('en-IN', unknownKey)).toBe('nonexistent.key');
  });

  it('falls back to en-IN catalog for unknown locale', () => {
    const catalog = getCatalog('fr-FR' as never);
    expect(catalog).toBe(en_IN);
  });

  it('leaves unmatched placeholders intact', () => {
    expect(translate('en-IN', 'home.greeting', {})).toBe('Good morning, {name}.');
  });
});

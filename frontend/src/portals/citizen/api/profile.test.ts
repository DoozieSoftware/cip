import { describe, it, expect, beforeEach } from 'vitest';
import {
  CITIZEN_DEFAULT_ADDRESS_KEY,
  isContactEmail,
  isContactPhone,
  readDefaultAddress,
  validateCitizenContact,
  writeDefaultAddress,
} from './profile';

beforeEach(() => {
  window.localStorage.removeItem(CITIZEN_DEFAULT_ADDRESS_KEY);
});

describe('citizen profile contact helpers', () => {
  it('round-trips the default address through localStorage', () => {
    expect(readDefaultAddress()).toBe('');
    writeDefaultAddress('12, MG Road, Bengaluru 560001');
    expect(readDefaultAddress()).toBe('12, MG Road, Bengaluru 560001');
    expect(window.localStorage.getItem(CITIZEN_DEFAULT_ADDRESS_KEY)).toBe(
      '12, MG Road, Bengaluru 560001',
    );
    writeDefaultAddress('  ');
    expect(readDefaultAddress()).toBe('');
    expect(window.localStorage.getItem(CITIZEN_DEFAULT_ADDRESS_KEY)).toBeNull();
  });

  it('validates email with the booking-form rule', () => {
    expect(isContactEmail('asha@example.com')).toBe(true);
    expect(isContactEmail('bad-email')).toBe(false);
    expect(isContactEmail('')).toBe(false);
  });

  it('validates phone with the booking-form pattern', () => {
    expect(isContactPhone('+91 98765 43210')).toBe(true);
    expect(isContactPhone('9876543210')).toBe(true);
    expect(isContactPhone('abc')).toBe(false);
    expect(isContactPhone('123')).toBe(false);
  });

  it('accepts a fully valid contact input', () => {
    expect(
      validateCitizenContact({
        fullName: 'Asha Rao',
        email: 'asha@example.com',
        phone: '+91 9876543210',
        defaultAddress: '12, MG Road, Bengaluru 560001',
      }),
    ).toEqual({});
  });

  it('allows empty optional fields but requires a phone', () => {
    expect(
      validateCitizenContact({ fullName: '', email: '', phone: '', defaultAddress: '' }),
    ).toEqual({ phone: 'Enter your phone number.' });
  });

  it('flags short names, bad emails/phones, and short addresses', () => {
    const errors = validateCitizenContact({
      fullName: 'A',
      email: 'bad-email',
      phone: 'abc',
      defaultAddress: 'short',
    });
    expect(errors.fullName).toContain('at least 2 characters');
    expect(errors.email).toContain('valid email');
    expect(errors.phone).toContain('valid phone');
    expect(errors.defaultAddress).toContain('at least 10 characters');
  });
});

import { useQuery } from '@tanstack/react-query';
import { apiRequest, type ApiEnvelope } from '../../../auth/api';

/**
 * Citizen contact profile shared by the profile page (#12) and the textile
 * booking form pre-fill (#12).
 *
 * The backend `/auth/me` payload carries name, email, and mobile today; the
 * default pickup address has no backend column yet, so it is mirrored in
 * localStorage as the frontend half of #12. If a future backend starts
 * returning `default_address`, the API value wins and localStorage is only
 * the fallback.
 */

export const CITIZEN_PROFILE_QUERY_KEY = ['me'] as const;

export const CITIZEN_DEFAULT_ADDRESS_KEY = 'cip.citizen.defaultAddress.v1';

interface CitizenMeResponse {
  id: string;
  name?: string | null;
  preferred_name?: string | null;
  mobile?: string | null;
  email?: string | null;
  default_address?: string | null;
}

export interface CitizenContactProfile {
  name: string;
  email: string;
  phone: string;
  defaultAddress: string;
}

export function readDefaultAddress(): string {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return '';
  try {
    return window.localStorage.getItem(CITIZEN_DEFAULT_ADDRESS_KEY) ?? '';
  } catch {
    return '';
  }
}

export function writeDefaultAddress(value: string): void {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return;
  try {
    if (value.trim().length === 0) {
      window.localStorage.removeItem(CITIZEN_DEFAULT_ADDRESS_KEY);
    } else {
      window.localStorage.setItem(CITIZEN_DEFAULT_ADDRESS_KEY, value);
    }
  } catch {
    // Address pre-fill is a convenience — never break the page on storage errors.
  }
}

/**
 * Contact-field validation shared by the profile page and the booking form
 * (#12 constraint: same rules in both places).
 */
export const CITIZEN_PHONE_PATTERN = /^[0-9+() -]{8,20}$/;

export function isContactEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isContactPhone(value: string): boolean {
  return CITIZEN_PHONE_PATTERN.test(value.trim());
}

export interface CitizenContactInput {
  fullName: string;
  email: string;
  phone: string;
  defaultAddress: string;
}

export type CitizenContactErrors = Partial<
  Record<'fullName' | 'email' | 'phone' | 'defaultAddress', string>
>;

export function validateCitizenContact(input: CitizenContactInput): CitizenContactErrors {
  const errors: CitizenContactErrors = {};
  if (input.fullName.trim() !== '' && input.fullName.trim().length < 2) {
    errors.fullName = 'Enter your full name (at least 2 characters).';
  }
  if (input.email.trim() !== '' && !isContactEmail(input.email)) {
    errors.email = 'Enter a valid email address.';
  }
  if (input.phone.trim() === '') {
    errors.phone = 'Enter your phone number.';
  } else if (!isContactPhone(input.phone)) {
    errors.phone = 'Enter a valid phone (8-20 digits, spaces allowed).';
  }
  if (input.defaultAddress.trim() !== '' && input.defaultAddress.trim().length < 10) {
    errors.defaultAddress = 'Enter your full default address (at least 10 characters).';
  }
  return errors;
}

function toContactProfile(me: CitizenMeResponse | null | undefined): CitizenContactProfile | null {
  if (me == null) return null;
  const apiAddress =
    typeof me.default_address === 'string' && me.default_address.trim().length > 0
      ? me.default_address
      : null;
  return {
    name: me.preferred_name ?? me.name ?? '',
    email: me.email ?? '',
    phone: me.mobile ?? '',
    defaultAddress: apiAddress ?? readDefaultAddress(),
  };
}

export function useCitizenContactProfile(): {
  data: CitizenContactProfile | null | undefined;
  isLoading: boolean;
  isError: boolean;
} {
  const query = useQuery({
    queryKey: [...CITIZEN_PROFILE_QUERY_KEY],
    queryFn: async () => {
      const res = await apiRequest<ApiEnvelope<CitizenMeResponse>>('/auth/me');
      return res.data;
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
  return {
    data: query.data === undefined ? undefined : toContactProfile(query.data),
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

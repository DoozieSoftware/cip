import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RequiredMark, Spinner, cx } from '../../../shared/ui';
import { forwardGeocode } from '../../../shared/geo/forwardGeocode';
import { nearestBy, type LatLng } from '../../../shared/geo/nearest';
import {
  useTextileServiceZones,
  type TextileCapacityMinimum,
  type TextileCollectionCategory,
  type TextileCollectionMethod,
  type TextileCollectionPayload,
  type TextileServiceZone,
} from '../api/textileZones';
import { useCitizenContactProfile } from '../api/profile';
import { isBelowMinimum } from './TextileMinimumNotice';
import { TextileCentreSelect } from './TextileCentreSelect';

const PHONE_PATTERN = '^[0-9+() -]{8,20}$';

export interface TextileDropoffView {
  name: string;
  address: string;
  center: { latitude: number; longitude: number } | null;
}

export interface TextileCollectionFieldsProps {
  category: TextileCollectionCategory;
  value: TextileCollectionPayload | null;
  onChange: (next: TextileCollectionPayload | null) => void;
  onValidityChange: (valid: boolean) => void;
  onDropoffChange?: (dropoff: TextileDropoffView | null) => void;
  onDraftChange?: (draft: TextileCollectionPayload) => void;
  minimum?: TextileCapacityMinimum | null;
}

type FieldKey =
  | 'service_zone_id'
  | 'requester_type'
  | 'requester_name'
  | 'rwa_name'
  | 'contact_email'
  | 'contact_phone'
  | 'pickup_address'
  | 'collection_method'
  | 'dropoff_centre_id'
  | 'estimated_bags'
  | 'estimated_weight_kg'
  | 'estimated_quantity';

type FieldErrors = Partial<Record<FieldKey, string>>;

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isPhone(value: string): boolean {
  return new RegExp(PHONE_PATTERN).test(value);
}

/**
 * The estimate fields are whole numbers only (#14). Rather than accept a
 * decimal and fail validation afterwards, reject any keystroke/paste that
 * contains a non-digit so '4.5', '-2', '1e3' can never be entered. Leading
 * zeros are trimmed and the value is capped to the field's digit limit.
 */
function cleanIntegerInput(raw: string, maxLength: number): string | null {
  if (!/^[0-9]*$/.test(raw)) return null;
  return raw.replace(/^0+(?=\d)/, '').slice(0, maxLength);
}

function validate(
  payload: TextileCollectionPayload | null,
  zone: TextileServiceZone | undefined,
): FieldErrors {
  const errors: FieldErrors = {};
  if (!payload) {
    return errors;
  }
  if (!payload.service_zone_id) {
    errors.service_zone_id = 'Pick a service zone.';
  }
  if (payload.requester_name.trim().length < 2) {
    errors.requester_name = 'Enter the full name on the request.';
  }
  if (
    payload.requester_type === 'rwa' &&
    (payload.rwa_name === null || payload.rwa_name.trim().length < 2)
  ) {
    errors.rwa_name = 'Enter the RWA / community name.';
  }
  if (!isEmail(payload.contact_email)) {
    errors.contact_email = 'Enter a valid email address.';
  }
  if (!isPhone(payload.contact_phone)) {
    errors.contact_phone = 'Enter a valid phone (8-20 digits, spaces allowed).';
  }
  const isDropoff = payload.collection_method === 'dropoff';
  // Drop-off needs no address (#16): the citizen walks into the centre, so no
  // personal address is collected or validated for drop-off bookings.
  if (!isDropoff && payload.pickup_address.trim().length < 10) {
    errors.pickup_address = 'Add a full pickup address.';
  }
  // Either estimate is enough — requesters often cannot weigh textiles. The
  // both-empty case is a group error rendered once below both inputs (not
  // under one field, where it reads as that field's own error).
  if (payload.estimated_bags === null && payload.estimated_weight_kg === null) {
    errors.estimated_quantity =
      'Tell us roughly how many bags, or the approximate weight in whole kg.';
  }
  // Weight-only whole-kg inputs (#14): digits only, no decimals, no negatives.
  if (
    payload.estimated_bags !== null &&
    (!Number.isInteger(payload.estimated_bags) ||
      payload.estimated_bags < 0 ||
      payload.estimated_bags > 999)
  ) {
    errors.estimated_bags = 'Bags must be a whole number between 0 and 999.';
  }
  if (payload.estimated_weight_kg !== null) {
    if (!Number.isInteger(payload.estimated_weight_kg)) {
      errors.estimated_weight_kg = 'Enter weight in whole kg (no decimals).';
    } else if (payload.estimated_weight_kg < 0 || payload.estimated_weight_kg > 99999) {
      errors.estimated_weight_kg = 'Weight must be between 0 and 99999 kg.';
    }
  }
  if (zone) {
    if (payload.collection_method === 'dropoff' && !zone.methods.includes('dropoff')) {
      errors.collection_method = 'Drop-off is not available in this zone.';
    }
    if (payload.collection_method === 'premises' && !zone.methods.includes('premises')) {
      errors.collection_method = 'Premises pickup is not available in this zone.';
    }
    const openCentres = (zone.centres ?? []).filter((c) => c.active && c.status === 'open');
    if (
      payload.collection_method === 'dropoff' &&
      openCentres.length > 0 &&
      !openCentres.some((c) => c.id === payload.dropoff_centre_id)
    ) {
      errors.dropoff_centre_id = 'Choose a drop-off centre.';
    }
  }
  return errors;
}

function buildInitial(
  zoneId?: string,
  category?: TextileCollectionCategory,
  zone?: TextileServiceZone,
): TextileCollectionPayload {
  const firstMethod = zone?.methods[0] ?? 'premises';
  const method = (['dropoff', 'premises'] as const).includes(firstMethod)
    ? firstMethod
    : 'premises';
  return {
    service_zone_id: zoneId ?? '',
    category: category ?? 'clothes_waste',
    requester_type: 'individual',
    requester_name: '',
    rwa_name: null,
    contact_email: '',
    contact_phone: '',
    pickup_address: '',
    collection_method: method,
    dropoff_centre_id: null,
    estimated_bags: null,
    estimated_weight_kg: null,
  };
}

export function TextileCollectionFields({
  category,
  value,
  onChange,
  onValidityChange,
  onDropoffChange,
  onDraftChange,
  minimum,
}: TextileCollectionFieldsProps): JSX.Element {
  const zonesQuery = useTextileServiceZones(category);

  return (
    <TextileCollectionFieldsInner
      category={category}
      zones={zonesQuery.data ?? []}
      zonesLoading={zonesQuery.isLoading}
      zonesError={zonesQuery.isError}
      onRetryZones={() => {
        void zonesQuery.refetch();
      }}
      value={value}
      onChange={onChange}
      onValidityChange={onValidityChange}
      onDropoffChange={onDropoffChange}
      onDraftChange={onDraftChange}
      minimum={minimum}
    />
  );
}

interface InnerProps {
  category: TextileCollectionCategory;
  zones: TextileServiceZone[];
  zonesLoading: boolean;
  zonesError: boolean;
  onRetryZones: () => void;
  value: TextileCollectionPayload | null;
  onChange: (next: TextileCollectionPayload | null) => void;
  onValidityChange: (valid: boolean) => void;
  onDropoffChange?: (dropoff: TextileDropoffView | null) => void;
  onDraftChange?: (draft: TextileCollectionPayload) => void;
  minimum?: TextileCapacityMinimum | null;
}

function TextileCollectionFieldsInner({
  category,
  zones,
  zonesLoading,
  zonesError,
  onRetryZones,
  value,
  onChange,
  onValidityChange,
  onDropoffChange,
  onDraftChange,
  minimum,
}: InnerProps): JSX.Element {
  const [draft, setDraft] = useState<TextileCollectionPayload>(
    () => value ?? buildInitial(zones[0]?.id, category, zones[0]),
  );
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const profile = useCitizenContactProfile();
  const prefilledFromProfile = useRef(false);
  // #30: nearest auto-select. zoneTouched/centreTouched record a manual pick;
  // auto-preselect only fills fields the citizen has not touched. The ranking
  // source is the profile default address, geocoded once per session.
  const [zoneTouched, setZoneTouched] = useState(false);
  const [centreTouched, setCentreTouched] = useState(false);

  // #12: pre-fill name/email/phone/address from the citizen profile once it
  // loads. Only fills fields the citizen has not already typed into, and only
  // while the parent has not supplied a value — never overwrites user input.
  // Runs once per mount: fields left blank (even if blurred) still pre-fill.
  useEffect(() => {
    const contact = profile.data;
    if (prefilledFromProfile.current || value !== null || !contact) return;
    prefilledFromProfile.current = true;
    setDraft((prev) => ({
      ...prev,
      requester_name: prev.requester_name !== '' ? prev.requester_name : (contact.name ?? ''),
      contact_email: prev.contact_email !== '' ? prev.contact_email : (contact.email ?? ''),
      contact_phone: prev.contact_phone !== '' ? prev.contact_phone : (contact.phone ?? ''),
      pickup_address:
        prev.pickup_address !== '' ? prev.pickup_address : (contact.defaultAddress ?? ''),
    }));
  }, [profile.data, value]);

  useEffect(() => {
    setDraft((prev) => (prev.category === category ? prev : { ...prev, category }));
  }, [category]);

  useEffect(() => {
    if (zones.length === 0) return;
    const currentZoneExists = zones.some((z) => z.id === draft.service_zone_id);
    if (!currentZoneExists) {
      const z = zones[0];
      setDraft((prev) => ({
        ...prev,
        service_zone_id: z.id,
        collection_method: z.methods.includes(prev.collection_method)
          ? prev.collection_method
          : (z.methods[0] ?? prev.collection_method),
      }));
    }
  }, [zones, draft.service_zone_id]);

  const selectedZone = useMemo(
    () => zones.find((z) => z.id === draft.service_zone_id),
    [zones, draft.service_zone_id],
  );

  // #30: ranking source is the profile default address, geocoded once per
  // session (cached, non-blocking). Any failure yields no source and the form
  // falls back to the manual dropdowns.
  const profileAddress = (profile.data?.defaultAddress ?? '').trim();
  const geoQuery = useQuery({
    queryKey: ['nearest-source', profileAddress],
    queryFn: () => forwardGeocode(profileAddress),
    enabled: value === null && profileAddress.length >= 10,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
  const source = useMemo<LatLng | null>(() => {
    if (value !== null) return null;
    const geo = geoQuery.data;
    if (
      geo?.geocoded === true &&
      typeof geo.latitude === 'number' &&
      typeof geo.longitude === 'number'
    ) {
      return { latitude: geo.latitude, longitude: geo.longitude };
    }
    return null;
  }, [value, geoQuery.data]);

  const nearestZoneId = useMemo(() => {
    if (!source) return null;
    return nearestBy(zones, source, (z) => z.center)?.id ?? null;
  }, [zones, source]);

  // #30: preselect the nearest zone until the citizen picks one manually.
  useEffect(() => {
    if (zoneTouched || !nearestZoneId) return;
    setDraft((prev) =>
      prev.service_zone_id === nearestZoneId ? prev : { ...prev, service_zone_id: nearestZoneId },
    );
  }, [nearestZoneId, zoneTouched]);

  const zoneAutoNote =
    !zoneTouched && source && nearestZoneId && draft.service_zone_id === nearestZoneId
      ? 'Auto-selected to nearest — change if needed.'
      : null;

  const openCentres = useMemo(
    () => (selectedZone?.centres ?? []).filter((c) => c.active && c.status === 'open'),
    [selectedZone],
  );

  // Centre choice follows the zone: drop a selection that belongs to another
  // zone, and preselect when the zone lists exactly one open centre. #30 adds
  // nearest-centre preselect (untouched only) ahead of the single-centre rule.
  useEffect(() => {
    const current = draft.dropoff_centre_id ?? null;
    if (current !== null && openCentres.some((c) => c.id === current)) return;
    if (!centreTouched && source && draft.collection_method === 'dropoff') {
      const nearest = nearestBy(openCentres, source, (c) =>
        c.latitude !== null && c.longitude !== null
          ? { latitude: c.latitude, longitude: c.longitude }
          : null,
      );
      if (nearest) {
        setDraft((prev) => ({ ...prev, dropoff_centre_id: nearest.id }));
        return;
      }
    }
    if (openCentres.length === 1 && openCentres[0] && draft.collection_method === 'dropoff') {
      const onlyId = openCentres[0].id;
      setDraft((prev) => ({ ...prev, dropoff_centre_id: onlyId }));
    } else if (current !== null) {
      setDraft((prev) => ({ ...prev, dropoff_centre_id: null }));
    }
  }, [openCentres, draft.dropoff_centre_id, draft.collection_method, centreTouched, source]);

  const centreAutoNote =
    !centreTouched &&
    source &&
    draft.collection_method === 'dropoff' &&
    draft.dropoff_centre_id !== null
      ? 'Auto-selected to nearest — change if needed.'
      : null;

  const dropoffView = useMemo<TextileDropoffView | null>(() => {
    if (draft.collection_method !== 'dropoff' || !selectedZone?.dropoff) {
      return null;
    }
    return {
      name: selectedZone.dropoff.name,
      address: selectedZone.dropoff.address,
      center: selectedZone.center,
    };
  }, [draft.collection_method, selectedZone]);

  useEffect(() => {
    onDropoffChange?.(dropoffView);
  }, [dropoffView, onDropoffChange]);

  // #16: drop-off collects no address — report an empty pickup_address upward
  // so no unnecessary personal data leaves the form. The draft keeps any typed
  // address in memory so switching back to premises restores it.
  const reported = useMemo<TextileCollectionPayload>(
    () => (draft.collection_method === 'dropoff' ? { ...draft, pickup_address: '' } : draft),
    [draft],
  );

  const errors = useMemo(() => validate(reported, selectedZone), [reported, selectedZone]);
  const isValid = Object.keys(errors).length === 0 && reported.service_zone_id !== '';

  useEffect(() => {
    onChange(isValid ? reported : null);
    onValidityChange(isValid);
    onDraftChange?.(reported);
  }, [isValid, reported, onChange, onValidityChange, onDraftChange]);

  function patch<K extends keyof TextileCollectionPayload>(
    key: K,
    next: TextileCollectionPayload[K],
  ): void {
    // #30: a manual pick opts out of auto-preselect for that field.
    if (key === 'service_zone_id') setZoneTouched(true);
    if (key === 'dropoff_centre_id') setCentreTouched(true);
    setDraft((prev) => ({ ...prev, [key]: next }));
  }

  const isBelowMin = isBelowMinimum(
    minimum,
    draft.estimated_bags,
    draft.estimated_weight_kg,
    draft.collection_method,
  );

  // Weight-only minimum (#14): only the kg threshold is shown and enforced.
  const minWeightKg = minimum?.min_weight_kg ?? null;
  const minText = minWeightKg !== null && minWeightKg !== undefined ? `${minWeightKg} kg` : '';
  const isDropoffMethod = draft.collection_method === 'dropoff';

  // Group-level quantity error: shown once below both inputs (not under one
  // field) after either field is touched.
  const quantityErrorVisible =
    Boolean(errors.estimated_quantity) &&
    (touched.has('estimated_bags') || touched.has('estimated_weight_kg'));

  return (
    <div className="space-y-5 rounded-2xl bg-white p-5 sm:p-6 shadow-sm ring-1 ring-black/5">
      <div>
        <h3 className="text-base font-semibold text-[var(--color-ink)]">Collection details</h3>
      </div>

      {zonesLoading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
          <Spinner className="h-4 w-4" /> Loading service zones…
        </div>
      ) : zonesError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <p>Could not load service zones.</p>
          <button
            type="button"
            onClick={onRetryZones}
            className="mt-2 rounded-md border border-red-300 px-3 py-1 text-xs font-medium text-red-800"
          >
            Retry
          </button>
        </div>
      ) : zones.length === 0 ? (
        <p className="rounded-lg bg-[var(--color-surface-alt)] p-3 text-sm text-[var(--color-text-secondary)]">
          No collection partner is serving your area yet for this material.
        </p>
      ) : (
        <div>
          <div className="flex items-baseline gap-0.5">
            <label
              htmlFor="textile-zone"
              className="block text-sm font-medium text-[var(--color-ink)]"
            >
              Service zone
            </label>
            <RequiredMark />
          </div>
          <select
            id="textile-zone"
            value={draft.service_zone_id}
            onChange={(e) => patch('service_zone_id', e.target.value)}
            className="mt-1 block w-full rounded-lg border border-[var(--color-border)] bg-white py-2.5 pl-3 pr-4 text-base focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
            aria-invalid={Boolean(errors.service_zone_id)}
            aria-required="true"
          >
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
          {zoneAutoNote ? (
            <p
              role="status"
              className="mt-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-900"
            >
              {zoneAutoNote}
            </p>
          ) : null}
          {errors.service_zone_id ? (
            <p className="mt-1 text-xs text-red-600">{errors.service_zone_id}</p>
          ) : null}
        </div>
      )}

      {selectedZone?.partner ? (
        <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-alt)] p-4 text-xs leading-5 text-[var(--color-text-secondary)]">
          <p className="font-semibold text-[var(--color-ink)]">
            Partner: {selectedZone.partner.name}
          </p>
          {selectedZone.readiness_instructions ? (
            <p className="mt-1 text-[var(--color-text-secondary)]">
              {selectedZone.readiness_instructions}
            </p>
          ) : null}
        </div>
      ) : null}

      <fieldset>
        <legend className="block text-sm font-medium text-[var(--color-ink)]">Requester</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(['individual', 'rwa'] as const).map((kind) => (
            <label
              key={kind}
              className={cx(
                'flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm',
                draft.requester_type === kind
                  ? 'border-[var(--color-ink)] bg-[var(--color-surface-alt)] font-medium'
                  : 'border-[var(--color-border)] bg-white',
              )}
            >
              <input
                type="radio"
                name="textile-requester-type"
                value={kind}
                checked={draft.requester_type === kind}
                onChange={() => patch('requester_type', kind)}
                className="sr-only"
              />
              {kind === 'individual' ? 'Individual' : 'RWA / Community'}
            </label>
          ))}
        </div>
      </fieldset>

      <Field
        id="textile-requester-name"
        label="Your name"
        required
        value={draft.requester_name}
        onChange={(v) => patch('requester_name', v)}
        error={errors.requester_name}
        fieldTouched={touched.has('requester_name')}
        onBlur={() => setTouched((prev) => new Set([...prev, 'requester_name']))}
        placeholder="Full name"
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          id="textile-email"
          label="Email (for receipt)"
          required
          type="email"
          value={draft.contact_email}
          onChange={(v) => patch('contact_email', v)}
          error={errors.contact_email}
          fieldTouched={touched.has('contact_email')}
          onBlur={() => setTouched((prev) => new Set([...prev, 'contact_email']))}
          placeholder="name@example.com"
        />
        <Field
          id="textile-phone"
          label="Phone (for pickup updates)"
          required
          type="tel"
          inputMode="tel"
          pattern={PHONE_PATTERN}
          value={draft.contact_phone}
          onChange={(v) => patch('contact_phone', v)}
          error={errors.contact_phone}
          fieldTouched={touched.has('contact_phone')}
          onBlur={() => setTouched((prev) => new Set([...prev, 'contact_phone']))}
          placeholder="e.g. +91 98765 43210"
        />
      </div>

      {draft.requester_type === 'rwa' ? (
        <Field
          id="textile-rwa-name"
          label="Apartment / community name"
          required
          value={draft.rwa_name ?? ''}
          onChange={(v) => patch('rwa_name', v || null)}
          error={errors.rwa_name}
          fieldTouched={touched.has('rwa_name')}
          onBlur={() => setTouched((prev) => new Set([...prev, 'rwa_name']))}
          placeholder="e.g. Green View Apartments"
        />
      ) : null}

      {isDropoffMethod ? null : (
        <div>
          <div className="flex items-baseline gap-0.5">
            <label
              htmlFor="textile-address"
              className="block text-sm font-medium text-[var(--color-ink)]"
            >
              Pickup address
            </label>
            <RequiredMark />
          </div>
          <textarea
            id="textile-address"
            rows={3}
            value={draft.pickup_address}
            onChange={(e) => patch('pickup_address', e.target.value)}
            placeholder="House/flat, street, landmark"
            aria-required="true"
            className="mt-1 block w-full rounded-lg border border-[var(--color-border)] bg-white p-3 text-base focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
            aria-invalid={touched.has('pickup_address') && Boolean(errors.pickup_address)}
            onBlur={() => setTouched((prev) => new Set([...prev, 'pickup_address']))}
          />
          {touched.has('pickup_address') && errors.pickup_address ? (
            <p className="mt-1 text-xs text-red-600">{errors.pickup_address}</p>
          ) : null}
        </div>
      )}

      <fieldset>
        <legend className="block text-sm font-medium text-[var(--color-ink)]">
          How will we collect?
        </legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <MethodToggle
            available={selectedZone?.methods.includes('dropoff') ?? false}
            value="dropoff"
            current={draft.collection_method}
            onSelect={(v) => patch('collection_method', v)}
            label="Drop at center"
            description="Drop off any amount — no minimum."
          />
          <MethodToggle
            available={selectedZone?.methods.includes('premises') ?? false}
            value="premises"
            current={draft.collection_method}
            onSelect={(v) => patch('collection_method', v)}
            label="Pick up from location"
            description="We come to your doorstep."
          />
        </div>

        {errors.collection_method ? (
          <p className="mt-1 text-xs text-red-600">{errors.collection_method}</p>
        ) : null}
      </fieldset>

      {isDropoffMethod ? (
        <section
          aria-labelledby="dropoff-location-title"
          className="space-y-2 rounded-xl border border-[var(--color-border-subtle)] bg-white p-4"
        >
          <h3 id="dropoff-location-title" className="text-sm font-semibold text-[var(--color-ink)]">
            Drop-off location
          </h3>
          <TextileCentreSelect
            centres={selectedZone?.centres}
            value={draft.dropoff_centre_id ?? ''}
            onChange={(id) => patch('dropoff_centre_id', id === '' ? null : id)}
            error={errors.dropoff_centre_id}
            hint={centreAutoNote}
          />
        </section>
      ) : null}

      <div>
        <div className="flex items-baseline gap-0.5">
          <p className="text-sm font-medium text-[var(--color-ink)]">How much do you have?</p>
          <RequiredMark />
        </div>
        <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
          Fill bags or weight in whole kg — either is enough.
        </p>
        <div className="mt-2.5 grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
          <Field
            id="textile-bags"
            label="How many bags?"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={draft.estimated_bags === null ? '' : String(draft.estimated_bags)}
            onChange={(v) => {
              const digits = cleanIntegerInput(v, 3);
              if (digits === null) return;
              patch('estimated_bags', digits === '' ? null : Number(digits));
              setTouched((prev) => new Set([...prev, 'estimated_bags']));
            }}
            error={errors.estimated_bags}
            warning={isBelowMin}
            fieldTouched={touched.has('estimated_bags')}
            onBlur={() => setTouched((prev) => new Set([...prev, 'estimated_bags']))}
            placeholder="e.g. 3"
            invalid={quantityErrorVisible}
            describedBy={quantityErrorVisible ? 'textile-quantity-err' : undefined}
          />
          <div className="hidden sm:flex flex-col items-center justify-center pb-3">
            <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-text-secondary)]">
              or
            </span>
          </div>
          <div className="flex sm:hidden items-center gap-2 py-1">
            <div className="h-px flex-1 bg-[var(--color-border-subtle)]" />
            <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-text-secondary)]">
              or
            </span>
            <div className="h-px flex-1 bg-[var(--color-border-subtle)]" />
          </div>
          <Field
            id="textile-weight"
            label="About how many kg?"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={draft.estimated_weight_kg === null ? '' : String(draft.estimated_weight_kg)}
            onChange={(v) => {
              const digits = cleanIntegerInput(v, 5);
              if (digits === null) return;
              patch('estimated_weight_kg', digits === '' ? null : Number(digits));
              setTouched((prev) => new Set([...prev, 'estimated_weight_kg']));
            }}
            error={errors.estimated_weight_kg}
            warning={isBelowMin}
            fieldTouched={touched.has('estimated_weight_kg')}
            onBlur={() => setTouched((prev) => new Set([...prev, 'estimated_weight_kg']))}
            placeholder="e.g. 8"
            invalid={quantityErrorVisible}
            describedBy={quantityErrorVisible ? 'textile-quantity-err' : undefined}
          />
        </div>
        {quantityErrorVisible ? (
          <p
            id="textile-quantity-err"
            role="alert"
            className="mt-2 text-xs font-medium text-red-600"
          >
            {errors.estimated_quantity}
          </p>
        ) : null}
        {isBelowMin ? (
          <div
            id="textile-quantity-warn"
            role="alert"
            aria-live="polite"
            className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs leading-5 text-amber-900"
          >
            <p className="font-semibold">
              Below the pickup minimum — Home pickup needs at least {minText}
            </p>
            <p className="mt-0.5 text-amber-800">
              Home pickup needs at least {minText} to dispatch a vehicle. Add more weight, or{' '}
              <button
                type="button"
                onClick={() => patch('collection_method', 'dropoff')}
                className="font-semibold underline hover:text-amber-950 cursor-pointer"
              >
                switch to centre drop-off
              </button>{' '}
              (any amount accepted).
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface FieldProps {
  id: string;
  label: string;
  required?: boolean;
  helper?: string;
  value: string;
  onChange: (next: string) => void;
  error?: string;
  warning?: boolean;
  type?: 'text' | 'email' | 'tel' | 'number';
  inputMode?: 'text' | 'tel' | 'numeric' | 'decimal';
  pattern?: string;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  fieldTouched?: boolean;
  onBlur?: () => void;
  /** Mark the input invalid without rendering a message (for group errors). */
  invalid?: boolean;
  /** Announced as the input's error when `invalid` is set. */
  describedBy?: string;
}

function Field({
  id,
  label,
  required = false,
  helper,
  value,
  onChange,
  error,
  warning,
  type = 'text',
  inputMode,
  pattern,
  min,
  max,
  step,
  placeholder,
  fieldTouched = true,
  onBlur,
  invalid = false,
  describedBy,
}: FieldProps): JSX.Element {
  const hasError = fieldTouched && Boolean(error);
  const hasWarning = !hasError && Boolean(warning);
  const inputInvalid = hasError || hasWarning || invalid;

  return (
    <div>
      <div className="flex items-baseline gap-0.5">
        <label htmlFor={id} className="block text-sm font-medium text-[var(--color-ink)]">
          {label}
        </label>
        {required ? <RequiredMark /> : null}
      </div>
      {helper ? (
        <p className="mt-0.5 text-[11px] leading-3 text-[var(--color-text-secondary)]">{helper}</p>
      ) : null}
      <input
        id={id}
        type={type}
        inputMode={inputMode}
        pattern={pattern}
        min={min}
        max={max}
        step={step}
        value={value}
        placeholder={placeholder}
        aria-required={required || undefined}
        onChange={(e) => onChange(e.target.value)}
        className={cx(
          'mt-1 block w-full rounded-lg border bg-white py-2.5 px-3 text-base focus:outline-none focus:ring-1',
          hasError
            ? 'border-red-500 text-red-950 focus:border-red-500 focus:ring-red-500'
            : hasWarning
              ? 'border-amber-400 text-amber-950 focus:border-amber-500 focus:ring-amber-500'
              : 'border-[var(--color-border)] focus:border-[var(--color-ink)] focus:ring-[var(--color-ink)]',
        )}
        aria-invalid={inputInvalid}
        aria-describedby={
          hasError ? `${id}-err` : hasWarning ? `${id}-warn` : helper ? `${id}-help` : describedBy
        }
        onBlur={onBlur}
      />
      {helper ? (
        <span id={`${id}-help`} className="sr-only">
          {helper}
        </span>
      ) : null}
      {hasError ? (
        <p id={`${id}-err`} role="alert" className="mt-1 text-xs font-medium text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface MethodToggleProps {
  available: boolean;
  value: TextileCollectionMethod;
  current: TextileCollectionMethod;
  onSelect: (next: TextileCollectionMethod) => void;
  label: string;
  description: string;
}

function MethodToggle({
  available,
  value,
  current,
  onSelect,
  label,
  description,
}: MethodToggleProps): JSX.Element {
  const selected = current === value;
  const id = `method-${value}`;
  return (
    <label
      htmlFor={id}
      className={cx(
        'flex cursor-pointer flex-col gap-1 rounded-lg border px-3 py-2.5 text-sm',
        !available && 'cursor-not-allowed opacity-50',
        selected
          ? 'border-[var(--color-ink)] bg-[var(--color-surface-alt)] font-medium'
          : 'border-[var(--color-border)] bg-white',
      )}
    >
      <input
        id={id}
        type="radio"
        name="textile-method"
        value={value}
        checked={selected}
        disabled={!available}
        aria-describedby={!available ? `${id}-desc` : undefined}
        onChange={() => onSelect(value)}
        className="sr-only"
      />
      <span className="text-[var(--color-ink)]">{label}</span>
      <span className="text-xs text-[var(--color-text-secondary)]">{description}</span>
      {!available ? (
        <span id={`${id}-desc`} className="sr-only">
          Not available in this zone
        </span>
      ) : null}
    </label>
  );
}

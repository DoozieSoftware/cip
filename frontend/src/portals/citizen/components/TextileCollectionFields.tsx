import { useEffect, useMemo, useState, type JSX } from 'react';
import { Spinner, cx } from '../../../shared/ui';
import {
  useTextileServiceZones,
  type TextileCollectionCategory,
  type TextileCollectionMethod,
  type TextileCollectionPayload,
  type TextileServiceZone,
} from '../api/textileZones';

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
  | 'estimated_bags'
  | 'estimated_weight_kg';

type FieldErrors = Partial<Record<FieldKey, string>>;

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isPhone(value: string): boolean {
  return new RegExp(PHONE_PATTERN).test(value);
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
  if (payload.pickup_address.trim().length < 10) {
    errors.pickup_address = isDropoff
      ? 'Add a full address for your receipt.'
      : 'Add a full pickup address.';
  }
  // Either estimate is enough — requesters often cannot weigh textiles.
  if (payload.estimated_bags === null && payload.estimated_weight_kg === null) {
    errors.estimated_bags = 'Tell us roughly how many bags, or the approximate weight.';
  }
  if (
    payload.estimated_bags !== null &&
    (payload.estimated_bags < 1 || payload.estimated_bags > 999)
  ) {
    errors.estimated_bags = 'Bags must be between 1 and 999.';
  }
  if (
    payload.estimated_weight_kg !== null &&
    (payload.estimated_weight_kg < 0.1 || payload.estimated_weight_kg > 99999.99)
  ) {
    errors.estimated_weight_kg = 'Weight must be between 0.1 and 99999.99 kg.';
  }
  if (zone) {
    if (payload.collection_method === 'dropoff' && !zone.methods.includes('dropoff')) {
      errors.collection_method = 'Drop-off is not available in this zone.';
    }
    if (payload.collection_method === 'premises' && !zone.methods.includes('premises')) {
      errors.collection_method = 'Premises pickup is not available in this zone.';
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
}: InnerProps): JSX.Element {
  const [draft, setDraft] = useState<TextileCollectionPayload>(
    () => value ?? buildInitial(zones[0]?.id, category, zones[0]),
  );
  const [touched, setTouched] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (value === null && draft.service_zone_id === '' && zones.length > 0) {
      const z = zones[0];
      setDraft((prev) => ({
        ...prev,
        service_zone_id: z.id,
        collection_method: z.methods[0] ?? prev.collection_method,
      }));
    }
  }, [zones, value, draft.service_zone_id]);

  const selectedZone = useMemo(
    () => zones.find((z) => z.id === draft.service_zone_id),
    [zones, draft.service_zone_id],
  );

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

  const errors = useMemo(() => validate(draft, selectedZone), [draft, selectedZone]);
  const isValid = Object.keys(errors).length === 0 && draft.service_zone_id !== '';

  useEffect(() => {
    onChange(isValid ? draft : null);
    onValidityChange(isValid);
  }, [isValid, draft, onChange, onValidityChange]);

  function patch<K extends keyof TextileCollectionPayload>(
    key: K,
    next: TextileCollectionPayload[K],
  ): void {
    setDraft((prev) => ({ ...prev, [key]: next }));
  }

  return (
    <div className="space-y-5 rounded-2xl bg-white p-5 sm:p-6 shadow-sm ring-1 ring-black/5">
      <div>
        <h3 className="text-base font-semibold text-[var(--color-ink)]">Collection details</h3>
        <p className="mt-1 text-sm leading-5 text-[var(--color-text-secondary)]">
          Fill bags or weight — either one is enough. We will send it to a local team after review.
        </p>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
          Every request is reviewed by a person. We never reject silently.
        </p>
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
          <label
            htmlFor="textile-zone"
            className="block text-sm font-medium text-[var(--color-ink)]"
          >
            Service zone
          </label>
          <select
            id="textile-zone"
            value={draft.service_zone_id}
            onChange={(e) => patch('service_zone_id', e.target.value)}
            className="mt-1 block w-full rounded-lg border border-[var(--color-border)] bg-white py-2.5 pl-3 pr-4 text-base focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
            aria-invalid={Boolean(errors.service_zone_id)}
          >
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
          {selectedZone?.readiness_instructions ? (
            <p className="mt-2 rounded-md bg-[var(--color-surface-alt)] p-2 text-xs text-[var(--color-text-secondary)]">
              {selectedZone.readiness_instructions}
            </p>
          ) : null}
          {selectedZone?.partner ? (
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
              Collected by {selectedZone.partner.name}
            </p>
          ) : null}
          {errors.service_zone_id ? (
            <p className="mt-1 text-xs text-red-600">{errors.service_zone_id}</p>
          ) : null}
        </div>
      )}

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

      {draft.requester_type === 'rwa' ? (
        <Field
          id="textile-rwa-name"
          label="Apartment / community name"
          helper="e.g. Green View Apartments, 4th Block"
          value={draft.rwa_name ?? ''}
          onChange={(v) => patch('rwa_name', v || null)}
          error={errors.rwa_name}
          fieldTouched={touched.has('rwa_name')}
          onBlur={() => setTouched((prev) => new Set([...prev, 'rwa_name']))}
          placeholder="e.g. Green View Apartments"
        />
      ) : null}

      <Field
        id="textile-requester-name"
        label="Your name"
        helper="As on your ID — for the receipt"
        value={draft.requester_name}
        onChange={(v) => patch('requester_name', v)}
        error={errors.requester_name}
        fieldTouched={touched.has('requester_name')}
        onBlur={() => setTouched((prev) => new Set([...prev, 'requester_name']))}
        placeholder="e.g. Ramesh Kumar"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="textile-email"
          label="Email (for receipt)"
          helper="We send updates here"
          type="email"
          value={draft.contact_email}
          onChange={(v) => patch('contact_email', v)}
          error={errors.contact_email}
          fieldTouched={touched.has('contact_email')}
          onBlur={() => setTouched((prev) => new Set([...prev, 'contact_email']))}
          placeholder="you@example.com"
        />
        <Field
          id="textile-phone"
          label="Phone (for pickup updates)"
          helper="We’ll call or SMS if needed"
          type="tel"
          inputMode="tel"
          pattern={PHONE_PATTERN}
          value={draft.contact_phone}
          onChange={(v) => patch('contact_phone', v)}
          error={errors.contact_phone}
          fieldTouched={touched.has('contact_phone')}
          onBlur={() => setTouched((prev) => new Set([...prev, 'contact_phone']))}
          placeholder="e.g. 98765 43210"
        />
      </div>

      <div>
        <label
          htmlFor="textile-address"
          className="block text-sm font-medium text-[var(--color-ink)]"
        >
          {draft.collection_method === 'dropoff'
            ? 'Your address (for contact & receipt)'
            : 'Pickup address'}
        </label>
        <p className="mt-1 text-xs leading-4 text-[var(--color-text-secondary)]">
          {draft.collection_method === 'dropoff'
            ? 'For your receipt only — we don’t send a truck here.'
            : 'House/flat, street, landmark — help the crew find you on first try.'}
        </p>
        <textarea
          id="textile-address"
          rows={3}
          value={draft.pickup_address}
          onChange={(e) => patch('pickup_address', e.target.value)}
          placeholder={
            draft.collection_method === 'dropoff'
              ? 'Your home address for the receipt'
              : 'e.g. #12, 3rd Cross, Near Hanuman Temple, Jayanagar'
          }
          className="mt-1 block w-full rounded-lg border border-[var(--color-border)] bg-white p-3 text-base focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
          aria-invalid={touched.has('pickup_address') && Boolean(errors.pickup_address)}
          aria-describedby="textile-address-help"
          onBlur={() => setTouched((prev) => new Set([...prev, 'pickup_address']))}
        />
        <p id="textile-address-help" className="sr-only">
          Enter your full address so the team can find you.
        </p>
        {touched.has('pickup_address') && errors.pickup_address ? (
          <p role="alert" className="mt-1 text-xs font-medium text-red-600">
            {errors.pickup_address}
          </p>
        ) : null}
      </div>

      <fieldset role="radiogroup" aria-label="How will we collect?">
        <legend className="block text-sm font-medium text-[var(--color-ink)]">
          How will we collect?
        </legend>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
          Pick one — you can change it before sending.
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <MethodToggle
            available={selectedZone?.methods.includes('dropoff') ?? false}
            value="dropoff"
            current={draft.collection_method}
            onSelect={(v) => patch('collection_method', v)}
            label="I’ll go to the centre"
            description="Drop off any amount — no minimum, no truck needed."
          />
          <MethodToggle
            available={selectedZone?.methods.includes('premises') ?? false}
            value="premises"
            current={draft.collection_method}
            onSelect={(v) => patch('collection_method', v)}
            label="Pick up from my home"
            description="We come to you — needs a few bags/kg."
          />
        </div>

        {errors.collection_method ? (
          <p className="mt-1 text-xs text-red-600">{errors.collection_method}</p>
        ) : null}
      </fieldset>

      <div>
        <p className="text-sm font-medium text-[var(--color-ink)]">How much do you have?</p>
        <p className="mt-1 text-xs leading-4 text-[var(--color-text-secondary)]">
          Fill <span className="font-semibold">bags OR weight</span> — you need only one. No
          weighing machine? Just count bags.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
          <Field
            id="textile-bags"
            label="How many bags?"
            helper="Any bag size is OK — one sack = 1 bag"
            type="number"
            min={1}
            max={999}
            value={draft.estimated_bags === null ? '' : String(draft.estimated_bags)}
            onChange={(v) => patch('estimated_bags', v === '' ? null : Number(v))}
            error={errors.estimated_bags}
            fieldTouched={touched.has('estimated_bags')}
            onBlur={() => setTouched((prev) => new Set([...prev, 'estimated_bags']))}
            placeholder="e.g. 3"
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
            helper="If you know — else leave blank"
            type="number"
            min={0.1}
            max={99999.99}
            step={0.1}
            value={draft.estimated_weight_kg === null ? '' : String(draft.estimated_weight_kg)}
            onChange={(v) => patch('estimated_weight_kg', v === '' ? null : Number(v))}
            error={errors.estimated_weight_kg}
            fieldTouched={touched.has('estimated_weight_kg')}
            onBlur={() => setTouched((prev) => new Set([...prev, 'estimated_weight_kg']))}
            placeholder="e.g. 8"
          />
        </div>
      </div>
    </div>
  );
}

interface FieldProps {
  id: string;
  label: string;
  helper?: string;
  value: string;
  onChange: (next: string) => void;
  error?: string;
  type?: 'text' | 'email' | 'tel' | 'number';
  inputMode?: 'text' | 'tel' | 'numeric' | 'decimal';
  pattern?: string;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  fieldTouched?: boolean;
  onBlur?: () => void;
}

function Field({
  id,
  label,
  helper,
  value,
  onChange,
  error,
  type = 'text',
  inputMode,
  pattern,
  min,
  max,
  step,
  placeholder,
  fieldTouched = true,
  onBlur,
}: FieldProps): JSX.Element {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-[var(--color-ink)]">
        {label}
      </label>
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
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-lg border border-[var(--color-border)] bg-white py-2.5 px-3 text-base focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
        aria-invalid={fieldTouched && Boolean(error)}
        aria-describedby={helper ? `${id}-help` : undefined}
        onBlur={onBlur}
      />
      {helper ? (
        <span id={`${id}-help`} className="sr-only">
          {helper}
        </span>
      ) : null}
      {error ? (
        <p role="alert" className="mt-1 text-xs font-medium text-red-600">
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

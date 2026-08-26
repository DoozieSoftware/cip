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

export interface TextileCollectionFieldsProps {
  category: TextileCollectionCategory;
  value: TextileCollectionPayload | null;
  onChange: (next: TextileCollectionPayload | null) => void;
  onValidityChange: (valid: boolean) => void;
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
  if (payload.pickup_address.trim().length < 10) {
    errors.pickup_address = 'Add a full pickup address.';
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
): TextileCollectionPayload {
  return {
    service_zone_id: zoneId ?? '',
    category: category ?? 'clothes_waste',
    requester_type: 'individual',
    requester_name: '',
    rwa_name: null,
    contact_email: '',
    contact_phone: '',
    pickup_address: '',
    collection_method: 'premises',
    estimated_bags: null,
    estimated_weight_kg: null,
  };
}

export function TextileCollectionFields({
  category,
  value,
  onChange,
  onValidityChange,
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
}: InnerProps): JSX.Element {
  const [draft, setDraft] = useState<TextileCollectionPayload>(
    () => value ?? buildInitial(zones[0]?.id, category),
  );

  useEffect(() => {
    if (value === null && draft.service_zone_id === '' && zones.length > 0) {
      setDraft((prev) => ({ ...prev, service_zone_id: zones[0]?.id ?? '' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zones]);

  const selectedZone = useMemo(
    () => zones.find((z) => z.id === draft.service_zone_id),
    [zones, draft.service_zone_id],
  );

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
    <div className="space-y-5 rounded-xl bg-white p-5 shadow-sm">
      <div>
        <h3 className="text-base font-semibold text-[var(--color-ink)]">Collection details</h3>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          We use this to schedule a pickup with your local collection partner once your request is
          reviewed.
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
            className="mt-1 block w-full rounded-lg border border-[#d8d6cf] bg-white py-2.5 pl-3 pr-4 text-base focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
            aria-invalid={Boolean(errors.service_zone_id)}
          >
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name} ({z.code})
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
                  : 'border-[#d8d6cf] bg-white',
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
          label="RWA / community name"
          value={draft.rwa_name ?? ''}
          onChange={(v) => patch('rwa_name', v || null)}
          error={errors.rwa_name}
        />
      ) : null}

      <Field
        id="textile-requester-name"
        label="Full name"
        value={draft.requester_name}
        onChange={(v) => patch('requester_name', v)}
        error={errors.requester_name}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="textile-email"
          label="Contact email"
          type="email"
          value={draft.contact_email}
          onChange={(v) => patch('contact_email', v)}
          error={errors.contact_email}
        />
        <Field
          id="textile-phone"
          label="Contact phone"
          type="tel"
          inputMode="tel"
          pattern={PHONE_PATTERN}
          value={draft.contact_phone}
          onChange={(v) => patch('contact_phone', v)}
          error={errors.contact_phone}
        />
      </div>

      <div>
        <label
          htmlFor="textile-address"
          className="block text-sm font-medium text-[var(--color-ink)]"
        >
          Pickup address
        </label>
        <textarea
          id="textile-address"
          rows={3}
          value={draft.pickup_address}
          onChange={(e) => patch('pickup_address', e.target.value)}
          className="mt-1 block w-full rounded-lg border border-[#d8d6cf] bg-white p-3 text-base focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
          aria-invalid={Boolean(errors.pickup_address)}
        />
        {errors.pickup_address ? (
          <p className="mt-1 text-xs text-red-600">{errors.pickup_address}</p>
        ) : null}
      </div>

      <fieldset>
        <legend className="block text-sm font-medium text-[var(--color-ink)]">
          Collection method
        </legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <MethodToggle
            available={selectedZone?.methods.includes('dropoff') ?? false}
            value="dropoff"
            current={draft.collection_method}
            onSelect={(v) => patch('collection_method', v)}
            label="Drop-off"
            description="Take items to a collection point."
          />
          <MethodToggle
            available={selectedZone?.methods.includes('premises') ?? false}
            value="premises"
            current={draft.collection_method}
            onSelect={(v) => patch('collection_method', v)}
            label="Premises pickup"
            description="A partner collects from your address."
          />
        </div>
        {draft.collection_method === 'dropoff' && selectedZone?.dropoff ? (
          <p className="mt-2 rounded-md bg-[var(--color-surface-alt)] p-2 text-xs text-[var(--color-text-secondary)]">
            Drop-off at: {selectedZone.dropoff.name}, {selectedZone.dropoff.address}
          </p>
        ) : null}
        {errors.collection_method ? (
          <p className="mt-1 text-xs text-red-600">{errors.collection_method}</p>
        ) : null}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="textile-bags"
          label="Estimated bags (optional)"
          type="number"
          min={1}
          max={999}
          value={draft.estimated_bags === null ? '' : String(draft.estimated_bags)}
          onChange={(v) => patch('estimated_bags', v === '' ? null : Number(v))}
          error={errors.estimated_bags}
          placeholder="e.g. 3"
        />
        <Field
          id="textile-weight"
          label="Estimated weight (optional)"
          type="number"
          min={0.1}
          max={99999.99}
          step={0.1}
          value={draft.estimated_weight_kg === null ? '' : String(draft.estimated_weight_kg)}
          onChange={(v) => patch('estimated_weight_kg', v === '' ? null : Number(v))}
          error={errors.estimated_weight_kg}
          placeholder="e.g. 8.5"
        />
      </div>
    </div>
  );
}

interface FieldProps {
  id: string;
  label: string;
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
}

function Field({
  id,
  label,
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
}: FieldProps): JSX.Element {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-[var(--color-ink)]">
        {label}
      </label>
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
        className="mt-1 block w-full rounded-lg border border-[#d8d6cf] bg-white py-2.5 px-3 text-base focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
        aria-invalid={Boolean(error)}
      />
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
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
  return (
    <label
      className={cx(
        'flex cursor-pointer flex-col gap-1 rounded-lg border px-3 py-2.5 text-sm',
        !available && 'cursor-not-allowed opacity-50',
        selected
          ? 'border-[var(--color-ink)] bg-[var(--color-surface-alt)] font-medium'
          : 'border-[#d8d6cf] bg-white',
      )}
    >
      <input
        type="radio"
        name="textile-method"
        value={value}
        checked={selected}
        disabled={!available}
        onChange={() => onSelect(value)}
        className="sr-only"
      />
      <span className="text-[var(--color-ink)]">{label}</span>
      <span className="text-xs text-[var(--color-text-secondary)]">{description}</span>
    </label>
  );
}

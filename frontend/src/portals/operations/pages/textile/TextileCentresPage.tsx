import { useEffect, useMemo, useState, type JSX } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  IconBuildingStore,
  IconCheck,
  IconCrosshair,
  IconMapPin,
  IconPencil,
  IconPhone,
  IconPlus,
  IconSearch,
  IconX,
} from '@tabler/icons-react';
import { cx } from '../../../../shared/ui';
import { forwardGeocode } from '../../../../shared/geo/forwardGeocode';
import { reverseGeocode } from '../../../../shared/geo/reverseGeocode';
import {
  createStaffTextileZone,
  createZoneCentre,
  fetchStaffTextileZones,
  updateStaffTextileZone,
  updateZoneCentre,
  type StaffTextileZone,
  type TextileDropoffCentre,
} from '../../api/textileApi';
import { DeskPage, DeskStates, useDesk } from './shared';

const ZONES_KEY = ['operations', 'textile', 'centre-zones'];

function useStaffZones(departmentId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [...ZONES_KEY, departmentId],
    queryFn: () => fetchStaffTextileZones(departmentId),
    enabled,
    staleTime: 60_000,
  });
}

function CentreStatusBadge({ centre }: { centre: TextileDropoffCentre }): JSX.Element {
  const closed = centre.status === 'temporarily_closed' || !centre.active;
  return (
    <span
      className={cx(
        'inline-flex h-6 shrink-0 items-center rounded-full border px-2 text-[11px] font-medium',
        closed
          ? 'border-amber-300 bg-amber-50 text-amber-800'
          : 'border-emerald-300 bg-emerald-50 text-emerald-800',
      )}
    >
      {closed ? 'Temporarily closed' : 'Open'}
    </span>
  );
}

interface CentreFormValue {
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  public_phone: string;
  status: 'open' | 'temporarily_closed';
  active: boolean;
}

const EMPTY_CENTRE_FORM: CentreFormValue = {
  name: '',
  address: '',
  latitude: '',
  longitude: '',
  public_phone: '',
  status: 'open',
  active: true,
};

const CENTRE_PIN = L.divIcon({
  className: 'cip-centre-pin-current',
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 28 38" aria-hidden="true"><path d="M14 0C6.27 0 0 6.27 0 14c0 9.5 14 24 14 24s14-14.5 14-24C28 6.27 21.73 0 14 0z" fill="#dc2626" stroke="#ffffff" stroke-width="2"/><circle cx="14" cy="14" r="5" fill="#ffffff"/></svg>`,
  iconSize: [36, 48],
  iconAnchor: [18, 48],
});

const EXISTING_CENTRE_PIN = L.divIcon({
  className: 'cip-centre-pin-existing',
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="43" viewBox="0 0 28 38" aria-hidden="true"><path d="M14 0C6.27 0 0 6.27 0 14c0 9.5 14 24 14 24s14-14.5 14-24C28 6.27 21.73 0 14 0z" fill="#15803d" stroke="#ffffff" stroke-width="2"/><circle cx="14" cy="14" r="5" fill="#ffffff"/></svg>`,
  iconSize: [32, 43],
  iconAnchor: [16, 43],
});

const FALLBACK_CENTER: [number, number] = [12.9716, 77.5946];

function parseCoordinate(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : NaN;
}

function roundedCoordinate(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

function MapInteraction({
  onPick,
}: {
  onPick: (latitude: number, longitude: number) => void;
}): null {
  useMapEvents({
    click(event) {
      onPick(roundedCoordinate(event.latlng.lat), roundedCoordinate(event.latlng.lng));
    },
    dblclick(event) {
      onPick(roundedCoordinate(event.latlng.lat), roundedCoordinate(event.latlng.lng));
    },
  });
  return null;
}

function RecenterMap({ latitude, longitude }: { latitude: number; longitude: number }): null {
  const map = useMap();
  useEffect(() => {
    map.setView([latitude, longitude], 16, { animate: true });
  }, [latitude, longitude, map]);
  return null;
}

function CentreForm({
  initial,
  existingCentres,
  editingCentreId,
  pending,
  error,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: CentreFormValue;
  existingCentres: TextileDropoffCentre[];
  editingCentreId?: string;
  pending: boolean;
  error: string | null;
  submitLabel: string;
  onSubmit: (value: CentreFormValue) => void;
  onCancel?: () => void;
}): JSX.Element {
  const [form, setForm] = useState<CentreFormValue>(initial);
  const [gpsMessage, setGpsMessage] = useState<string | null>(null);
  const [findingAddress, setFindingAddress] = useState(false);
  const [addressMessage, setAddressMessage] = useState<string | null>(null);
  const valid = form.name.trim().length >= 2;
  const latitude = parseCoordinate(form.latitude);
  const longitude = parseCoordinate(form.longitude);
  const locationError =
    latitude === null && longitude === null
      ? 'Place the centre pin on the map before saving.'
      : Number.isNaN(latitude) || Number.isNaN(longitude)
        ? 'Coordinates must be numbers (e.g. 12.9716, 77.5946).'
        : (latitude !== null && (latitude < -90 || latitude > 90)) ||
            (longitude !== null && (longitude < -180 || longitude > 180))
          ? 'Latitude must be −90…90 and longitude −180…180.'
          : (latitude === null) !== (longitude === null)
            ? 'Set both latitude and longitude, or leave both blank.'
            : null;
  const canSubmit = valid && !pending && locationError === null;
  const pin: [number, number] | null =
    latitude !== null && longitude !== null && !Number.isNaN(latitude) && !Number.isNaN(longitude)
      ? [latitude, longitude]
      : null;
  const firstExisting = existingCentres.find(
    (centre) =>
      centre.active &&
      centre.status === 'open' &&
      centre.latitude !== null &&
      centre.longitude !== null,
  );
  const initialMapCenter: [number, number] =
    pin ??
    (firstExisting
      ? [firstExisting.latitude as number, firstExisting.longitude as number]
      : FALLBACK_CENTER);
  const visibleExistingCentres = existingCentres.filter(
    (centre) =>
      centre.active &&
      centre.status === 'open' &&
      centre.latitude !== null &&
      centre.longitude !== null &&
      centre.id !== editingCentreId,
  );

  function pick(latitudeValue: number, longitudeValue: number): void {
    setForm((p) => ({ ...p, latitude: String(latitudeValue), longitude: String(longitudeValue) }));
  }

  async function pickAndResolveAddress(
    latitudeValue: number,
    longitudeValue: number,
  ): Promise<void> {
    pick(latitudeValue, longitudeValue);
    setAddressMessage('Checking the address at this pin…');
    const result = await reverseGeocode(latitudeValue, longitudeValue);
    if (result.geocoded && result.label !== '') {
      setForm((previous) => ({ ...previous, address: result.label }));
      setAddressMessage(`Pin address: ${result.label}`);
    } else {
      setAddressMessage('Pin placed. Check or complete the address before saving.');
    }
  }

  function useMyLocation(): void {
    if (!('geolocation' in navigator)) {
      setGpsMessage('GPS is unavailable. Tap the map or drag the pin instead.');
      return;
    }
    setGpsMessage('Getting your location…');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = roundedCoordinate(position.coords.latitude);
        const longitude = roundedCoordinate(position.coords.longitude);
        void pickAndResolveAddress(latitude, longitude);
        setGpsMessage('Pin moved to your current location. Its address is being checked.');
      },
      () => setGpsMessage('Could not use GPS. Tap the map or drag the pin instead.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function findAddressOnMap(): Promise<void> {
    const address = form.address.trim();
    if (address.length < 3 || findingAddress) return;

    setFindingAddress(true);
    setAddressMessage('Finding this address…');
    try {
      const result = await forwardGeocode(address);
      if (result.geocoded && result.latitude !== null && result.longitude !== null) {
        pick(roundedCoordinate(result.latitude), roundedCoordinate(result.longitude));
        setForm((previous) => ({ ...previous, address: result.label }));
        setAddressMessage(`Found: ${result.label}. Drag the red pin to refine it.`);
      } else {
        setAddressMessage(
          'Address not found. Add more detail, or tap the correct point on the map.',
        );
      }
    } catch {
      setAddressMessage('Could not search right now. Use GPS or tap the correct point on the map.');
    } finally {
      setFindingAddress(false);
    }
  }

  return (
    <form
      className="space-y-3 rounded-xl border border-[var(--color-border)] bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) onSubmit(form);
      }}
    >
      <div>
        <label htmlFor="centre-name" className="block text-sm font-medium text-[var(--color-ink)]">
          Centre name
        </label>
        <input
          id="centre-name"
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          placeholder="e.g. Jayanagar 4th Block centre"
          className="mt-1 block min-h-11 w-full rounded-lg border border-[var(--color-border)] px-3 text-base focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
        />
      </div>
      <div>
        <label
          htmlFor="centre-address"
          className="block text-sm font-medium text-[var(--color-ink)]"
        >
          Address
        </label>
        <textarea
          id="centre-address"
          value={form.address}
          onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
          rows={2}
          placeholder="Full street address citizens can navigate to"
          className="mt-1 block w-full rounded-lg border border-[var(--color-border)] p-3 text-base focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
        />
        <button
          type="button"
          disabled={form.address.trim().length < 3 || findingAddress}
          onClick={() => void findAddressOnMap()}
          className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--color-border)] px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-45"
        >
          <IconSearch className="h-4 w-4" stroke={1.8} />
          {findingAddress ? 'Finding…' : 'Find on map'}
        </button>
        {addressMessage ? (
          <p aria-live="polite" className="mt-1.5 text-xs text-[var(--color-text-secondary)]">
            {addressMessage}
          </p>
        ) : null}
      </div>
      <div>
        <span
          id="centre-location-label"
          className="block text-sm font-medium text-[var(--color-ink)]"
        >
          Map location{' '}
          <span className="font-normal text-[var(--color-text-secondary)]">
            (tap to place, drag the red pin, use GPS, or find the typed address)
          </span>
        </span>
        <div
          role="application"
          aria-labelledby="centre-location-label"
          className="mx-auto mt-1 aspect-square w-full max-w-[420px] overflow-hidden rounded-lg border border-[var(--color-border)]"
        >
          <MapContainer
            center={initialMapCenter}
            zoom={pin ? 15 : 11}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={false}
            dragging
            touchZoom
            doubleClickZoom={false}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapInteraction
              onPick={(lat, lng) => {
                void pickAndResolveAddress(lat, lng);
              }}
            />
            {pin ? <RecenterMap latitude={pin[0]} longitude={pin[1]} /> : null}
            {visibleExistingCentres.map((centre) => (
              <Marker
                key={centre.id}
                position={[centre.latitude as number, centre.longitude as number]}
                icon={EXISTING_CENTRE_PIN}
                interactive={false}
              />
            ))}
            {pin ? (
              <Marker
                position={pin}
                icon={CENTRE_PIN}
                draggable
                eventHandlers={{
                  dragend: (event) => {
                    const marker = event.target as L.Marker;
                    const pos = marker.getLatLng();
                    void pickAndResolveAddress(
                      roundedCoordinate(pos.lat),
                      roundedCoordinate(pos.lng),
                    );
                  },
                }}
              />
            ) : null}
          </MapContainer>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-text-secondary)]">
          <span className="inline-flex items-center gap-1.5">
            <IconMapPin className="h-4 w-4 text-green-700" fill="currentColor" stroke={2} />
            Existing open centre
          </span>
          <span className="inline-flex items-center gap-1.5">
            <IconMapPin className="h-4 w-4 text-red-600" fill="currentColor" stroke={2} />
            Centre being saved
          </span>
        </div>
        {locationError ? (
          <p role="alert" className="mt-1 text-xs font-medium text-[var(--color-danger)]">
            {locationError}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={useMyLocation}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--color-border)] px-4 text-sm font-medium"
          >
            <IconCrosshair className="h-4 w-4" stroke={1.8} />
            Use my location
          </button>
          {pin ? (
            <button
              type="button"
              onClick={() => setForm((p) => ({ ...p, latitude: '', longitude: '' }))}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--color-border)] px-4 text-sm font-medium"
            >
              <IconX className="h-4 w-4" stroke={2} />
              Clear pin
            </button>
          ) : null}
        </div>
        {gpsMessage ? (
          <p aria-live="polite" className="mt-1.5 text-xs text-[var(--color-text-secondary)]">
            {gpsMessage}
          </p>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor="centre-phone"
            className="block text-sm font-medium text-[var(--color-ink)]"
          >
            Public phone{' '}
            <span className="font-normal text-[var(--color-text-secondary)]">(optional)</span>
          </label>
          <input
            id="centre-phone"
            value={form.public_phone}
            onChange={(e) => setForm((p) => ({ ...p, public_phone: e.target.value }))}
            placeholder="e.g. +91 80 4111 2222"
            className="mt-1 block min-h-11 w-full rounded-lg border border-[var(--color-border)] px-3 text-base focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
          />
        </div>
        <div>
          <label
            htmlFor="centre-status"
            className="block text-sm font-medium text-[var(--color-ink)]"
          >
            Status
          </label>
          <select
            id="centre-status"
            value={form.status}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                status: e.target.value === 'temporarily_closed' ? 'temporarily_closed' : 'open',
              }))
            }
            className="mt-1 block min-h-11 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-base focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
          >
            <option value="open">Open</option>
            <option value="temporarily_closed">Temporarily closed</option>
          </select>
        </div>
      </div>
      <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.active}
          onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))}
          className="h-4 w-4 accent-[var(--color-ink)]"
        />
        Listed for citizens
      </label>
      {error ? (
        <p role="alert" className="text-xs font-medium text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--color-ink)] px-5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          <IconCheck className="h-4 w-4" stroke={2} />
          {pending ? 'Saving…' : submitLabel}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--color-border)] px-5 text-sm font-medium"
          >
            <IconX className="h-4 w-4" stroke={2} />
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}

export default function TextileCentresPage(): JSX.Element {
  const desk = useDesk();
  const queryClient = useQueryClient();
  const zonesQuery = useStaffZones(desk.departmentId, desk.ready && desk.isDrLinen);
  const zones: StaffTextileZone[] = useMemo(() => zonesQuery.data ?? [], [zonesQuery.data]);

  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [showZoneForm, setShowZoneForm] = useState(false);
  const [showCentreForm, setShowCentreForm] = useState(false);
  const [editingCentreId, setEditingCentreId] = useState<string | null>(null);
  const [zoneCode, setZoneCode] = useState('');
  const [zoneName, setZoneName] = useState('');
  const [zoneSearch, setZoneSearch] = useState('');

  const selectedZone = zones.find((z) => z.id === selectedZoneId) ?? zones[0] ?? null;
  const centres = selectedZone?.centres ?? [];
  const editingCentre = centres.find((c) => c.id === editingCentreId) ?? null;
  const zoneSearchLower = zoneSearch.trim().toLowerCase();
  const visibleZones =
    zoneSearchLower === ''
      ? zones
      : zones.filter(
          (z) =>
            z.name.toLowerCase().includes(zoneSearchLower) ||
            z.code.toLowerCase().includes(zoneSearchLower),
        );
  const pickerZones =
    selectedZone !== null && visibleZones.some((z) => z.id === selectedZone.id)
      ? visibleZones
      : selectedZone !== null
        ? [selectedZone, ...visibleZones]
        : visibleZones;
  const pinnedOpenCentres = centres.filter(
    (c) => c.active && c.status === 'open' && c.latitude !== null && c.longitude !== null,
  );
  const zoneMapCenter: [number, number] =
    pinnedOpenCentres[0] !== undefined
      ? [pinnedOpenCentres[0].latitude as number, pinnedOpenCentres[0].longitude as number]
      : FALLBACK_CENTER;

  useEffect(() => {
    if (selectedZoneId === '' && zones.length > 0 && zones[0]) {
      setSelectedZoneId(zones[0].id);
    }
  }, [zones, selectedZoneId]);

  function invalidate(): void {
    void queryClient.invalidateQueries({ queryKey: ZONES_KEY });
  }

  const createZone = useMutation({
    mutationFn: () =>
      createStaffTextileZone({ code: zoneCode.trim(), name: zoneName.trim() }, desk.departmentId),
    onSuccess: (zone) => {
      setZoneCode('');
      setZoneName('');
      setShowZoneForm(false);
      setSelectedZoneId(zone.id);
      invalidate();
    },
  });

  const createCentre = useMutation({
    mutationFn: (value: CentreFormValue) =>
      createZoneCentre(
        selectedZone?.id ?? '',
        {
          name: value.name.trim(),
          address: value.address.trim() === '' ? null : value.address.trim(),
          latitude: parseCoordinate(value.latitude) ?? null,
          longitude: parseCoordinate(value.longitude) ?? null,
          public_phone: value.public_phone.trim() === '' ? null : value.public_phone.trim(),
          status: value.status,
          active: value.active,
        },
        desk.departmentId,
      ),
    onSuccess: () => {
      setShowCentreForm(false);
      invalidate();
    },
  });

  const updateCentre = useMutation({
    mutationFn: ({ id, value }: { id: string; value: CentreFormValue }) =>
      updateZoneCentre(
        id,
        {
          name: value.name.trim(),
          address: value.address.trim() === '' ? null : value.address.trim(),
          latitude: parseCoordinate(value.latitude) ?? null,
          longitude: parseCoordinate(value.longitude) ?? null,
          public_phone: value.public_phone.trim() === '' ? null : value.public_phone.trim(),
          status: value.status,
          active: value.active,
        },
        desk.departmentId,
      ),
    onSuccess: () => {
      setEditingCentreId(null);
      invalidate();
    },
  });

  const toggleZoneActive = useMutation({
    mutationFn: (zone: StaffTextileZone) =>
      updateStaffTextileZone(zone.id, { active: !zone.active }, desk.departmentId),
    onSuccess: invalidate,
  });

  const zoneFormValid = zoneCode.trim().length >= 2 && zoneName.trim().length >= 2;

  return (
    <DeskPage
      desk={desk}
      title="Zones & drop-off centres"
      description="Manage the zones your partner serves and the drop-off centres inside each zone. Citizens pick a centre when booking a drop-off."
    >
      <DeskStates
        loading={zonesQuery.isLoading}
        error={zonesQuery.isError}
        onRetry={() => void zonesQuery.refetch()}
        hasRows={zones.length > 0}
        emptyTitle="No service zones yet"
        emptyBody="Create your first zone below, then add the drop-off centres citizens can book."
      >
        {selectedZone ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-[200px] flex-1 sm:max-w-xs">
                <label htmlFor="centre-zone-search" className="sr-only">
                  Search zones
                </label>
                <input
                  id="centre-zone-search"
                  type="search"
                  value={zoneSearch}
                  onChange={(e) => setZoneSearch(e.target.value)}
                  placeholder="Search zones…"
                  className="block min-h-11 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
                />
              </div>
              <div className="min-w-[200px] flex-1 sm:max-w-xs">
                <label htmlFor="centre-zone-picker" className="sr-only">
                  Service zone
                </label>
                <select
                  id="centre-zone-picker"
                  value={selectedZone.id}
                  onChange={(e) => {
                    setSelectedZoneId(e.target.value);
                    setEditingCentreId(null);
                    setShowCentreForm(false);
                  }}
                  className="block min-h-11 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm font-medium focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
                >
                  {pickerZones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name} ({z.code})
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => setShowZoneForm((v) => !v)}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--color-border)] bg-white px-4 text-sm font-medium"
              >
                <IconPlus className="h-4 w-4" stroke={2} />
                New zone
              </button>
            </div>

            <section
              aria-label={`Open centres map for ${selectedZone.name}`}
              className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-white"
            >
              <p className="flex items-center gap-2 px-4 pt-3 text-sm font-semibold text-[var(--color-ink)]">
                <IconMapPin className="h-4 w-4" stroke={1.8} />
                Open centres in {selectedZone.name}
                <span className="rounded-full bg-[var(--color-surface-alt)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]">
                  {pinnedOpenCentres.length} pinned
                </span>
              </p>
              {pinnedOpenCentres.length > 0 ? (
                <div
                  role="application"
                  aria-label={`Map of open centres in ${selectedZone.name}. Tap a pin to edit that centre.`}
                  className="m-3 overflow-hidden rounded-lg border border-[var(--color-border-subtle)]"
                  style={{ height: 220 }}
                >
                  <MapContainer
                    center={zoneMapCenter}
                    zoom={12}
                    style={{ height: '100%', width: '100%' }}
                    scrollWheelZoom={false}
                  >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    {pinnedOpenCentres.map((c) => (
                      <Marker
                        key={c.id}
                        position={[c.latitude as number, c.longitude as number]}
                        icon={EXISTING_CENTRE_PIN}
                        eventHandlers={{
                          click: () => {
                            setEditingCentreId(c.id);
                            setShowCentreForm(false);
                          },
                        }}
                      />
                    ))}
                  </MapContainer>
                </div>
              ) : (
                <p className="px-4 pb-4 pt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
                  No pinned centres yet — add a centre below and drop its pin on the map so citizens
                  can navigate to it.
                </p>
              )}
            </section>

            {showZoneForm ? (
              <form
                className="space-y-3 rounded-xl border border-[var(--color-border)] bg-white p-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (zoneFormValid && !createZone.isPending) createZone.mutate();
                }}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="new-zone-code"
                      className="block text-sm font-medium text-[var(--color-ink)]"
                    >
                      Zone code
                    </label>
                    <input
                      id="new-zone-code"
                      value={zoneCode}
                      onChange={(e) => setZoneCode(e.target.value)}
                      placeholder="e.g. JAYANAGAR"
                      className="mt-1 block min-h-11 w-full rounded-lg border border-[var(--color-border)] px-3 text-base focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="new-zone-name"
                      className="block text-sm font-medium text-[var(--color-ink)]"
                    >
                      Zone name
                    </label>
                    <input
                      id="new-zone-name"
                      value={zoneName}
                      onChange={(e) => setZoneName(e.target.value)}
                      placeholder="e.g. Jayanagar"
                      className="mt-1 block min-h-11 w-full rounded-lg border border-[var(--color-border)] px-3 text-base focus:border-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
                    />
                  </div>
                </div>
                {createZone.isError ? (
                  <p role="alert" className="text-xs font-medium text-[var(--color-danger)]">
                    Could not create the zone. The code may already exist.
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={!zoneFormValid || createZone.isPending}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--color-ink)] px-5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <IconCheck className="h-4 w-4" stroke={2} />
                  {createZone.isPending ? 'Creating…' : 'Create zone'}
                </button>
              </form>
            ) : null}

            <section aria-label={`Drop-off centres in ${selectedZone.name}`} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--color-ink)]">
                  <IconBuildingStore className="h-4 w-4" stroke={1.8} />
                  Centres in {selectedZone.name}
                  <span className="rounded-full bg-[var(--color-surface-alt)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]">
                    {centres.length}
                  </span>
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setShowCentreForm((v) => !v);
                    setEditingCentreId(null);
                  }}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--color-ink)] px-4 text-sm font-medium text-white"
                >
                  <IconPlus className="h-4 w-4" stroke={2} />
                  Add centre
                </button>
              </div>

              {showCentreForm ? (
                <CentreForm
                  initial={EMPTY_CENTRE_FORM}
                  existingCentres={centres}
                  pending={createCentre.isPending}
                  error={createCentre.isError ? 'Could not create the centre. Please retry.' : null}
                  submitLabel="Create centre"
                  onSubmit={(value) => createCentre.mutate(value)}
                  onCancel={() => setShowCentreForm(false)}
                />
              ) : null}

              {centres.length === 0 && !showCentreForm ? (
                <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-white p-6 text-center">
                  <p className="text-sm font-medium text-[var(--color-ink)]">
                    No centres in this zone yet
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
                    Add the first drop-off centre so citizens booking this zone can pick where to
                    go.
                  </p>
                </div>
              ) : (
                <ul className="grid gap-3 lg:grid-cols-2">
                  {centres.map((centre) =>
                    editingCentre?.id === centre.id ? (
                      <li key={centre.id}>
                        <CentreForm
                          initial={{
                            name: centre.name,
                            address: centre.address ?? '',
                            latitude: centre.latitude?.toString() ?? '',
                            longitude: centre.longitude?.toString() ?? '',
                            public_phone: centre.public_phone ?? '',
                            status: centre.status,
                            active: centre.active,
                          }}
                          existingCentres={centres}
                          editingCentreId={centre.id}
                          pending={updateCentre.isPending}
                          error={
                            updateCentre.isError ? 'Could not save the centre. Please retry.' : null
                          }
                          submitLabel="Save centre"
                          onSubmit={(value) => updateCentre.mutate({ id: centre.id, value })}
                          onCancel={() => setEditingCentreId(null)}
                        />
                      </li>
                    ) : (
                      <li
                        key={centre.id}
                        className="rounded-xl border border-[var(--color-border-subtle)] bg-white p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[var(--color-ink)]">
                              {centre.name}
                            </p>
                            {centre.address ? (
                              <p className="mt-1 flex items-start gap-1.5 text-xs leading-5 text-[var(--color-text-secondary)]">
                                <IconMapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" stroke={1.8} />
                                <span>{centre.address}</span>
                              </p>
                            ) : null}
                            {centre.public_phone ? (
                              <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
                                <IconPhone className="h-3.5 w-3.5 shrink-0" stroke={1.8} />
                                <span>{centre.public_phone}</span>
                              </p>
                            ) : null}
                            {centre.latitude !== null && centre.longitude !== null ? (
                              <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
                                <IconMapPin className="h-3.5 w-3.5 shrink-0" stroke={1.8} />
                                <span>
                                  {centre.latitude}, {centre.longitude} ·{' '}
                                  <a
                                    href={`https://www.google.com/maps/dir/?api=1&destination=${centre.latitude},${centre.longitude}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-medium underline"
                                  >
                                    Directions
                                  </a>
                                </span>
                              </p>
                            ) : (
                              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                No map pin yet — edit to pin this centre.
                              </p>
                            )}
                          </div>
                          <CentreStatusBadge centre={centre} />
                        </div>
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCentreId(centre.id);
                              setShowCentreForm(false);
                            }}
                            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--color-border)] px-4 text-sm font-medium"
                          >
                            <IconPencil className="h-4 w-4" stroke={1.8} />
                            Edit
                          </button>
                        </div>
                      </li>
                    ),
                  )}
                </ul>
              )}

              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-alt)] p-3 text-xs text-[var(--color-text-secondary)]">
                <span>
                  Drop-off {selectedZone.methods.includes('dropoff') ? 'enabled' : 'disabled'} ·
                  Pickup {selectedZone.methods.includes('premises') ? 'enabled' : 'disabled'}
                </span>
                <button
                  type="button"
                  disabled={toggleZoneActive.isPending}
                  onClick={() => toggleZoneActive.mutate(selectedZone)}
                  className="ml-auto inline-flex min-h-11 items-center rounded-full border border-[var(--color-border)] bg-white px-4 text-xs font-medium text-[var(--color-ink)] disabled:opacity-50"
                >
                  {selectedZone.active ? 'Deactivate zone' : 'Activate zone'}
                </button>
              </div>
              {toggleZoneActive.isError ? (
                <p role="alert" className="text-xs font-medium text-[var(--color-danger)]">
                  Could not update the zone. Please retry.
                </p>
              ) : null}
            </section>
          </div>
        ) : null}
      </DeskStates>
    </DeskPage>
  );
}

import { Card, CardBody, CardHeader, CardTitle, EmptyState } from '../../../shared/ui';
import { useReverseGeocode } from '../../../shared/geo/useReverseGeocode';

export interface DepartmentReportLocation {
  lat: number;
  lng: number;
  accuracy: number | null;
  address: string | null;
}

const MAPS_QUERY = (lat: number, lng: number) => `https://www.google.com/maps?q=${lat},${lng}`;
const MAPS_DIRECTIONS = (lat: number, lng: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

/** Heuristic: seeders sometimes store the lat/lng string as the address. */
function looksLikeCoords(address: string): boolean {
  return /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(address.trim());
}

/**
 * Field-work card: where the incident happened, plus one-tap links to
 * open the location in Google Maps and get directions to it.
 */
export function LocationCard({ location }: { location: DepartmentReportLocation | null }) {
  const address = location?.address && !looksLikeCoords(location.address) ? location.address : null;
  const resolvedAddress = useReverseGeocode(
    location?.lat ?? Number.NaN,
    location?.lng ?? Number.NaN,
    address,
  );
  const displayAddress = address ?? resolvedAddress;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Location</CardTitle>
      </CardHeader>
      <CardBody>
        {location === null ? (
          <EmptyState
            title="No location"
            description="The citizen did not share a location with this report."
          />
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium leading-6 text-slate-900">
              {displayAddress || 'Road address unavailable'}
            </p>
            <p className="text-xs text-slate-500">
              {displayAddress ? 'Readable road location' : 'Exact point is available on the map'}
              {location.accuracy != null && ` · GPS accuracy ±${location.accuracy}m`}
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href={MAPS_QUERY(location.lat, location.lng)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-md bg-white px-3.5 py-2 text-sm font-medium text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                Open in maps
              </a>
              <a
                href={MAPS_DIRECTIONS(location.lat, location.lng)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-md bg-white px-3.5 py-2 text-sm font-medium text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                Directions
              </a>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

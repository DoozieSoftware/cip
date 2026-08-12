import { type JSX } from 'react';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useMessages } from '../messages';
import type { CapturedLocation } from './GpsCapture';
import {
  issueLocationFromPin,
  issueLocationFromReporter,
  type IssueLocation,
} from './issueLocation';

const PIN = L.divIcon({
  className: 'cip-issue-pin',
  html: '<span aria-hidden="true" style="display:block;width:22px;height:22px;border-radius:50%;background:#b42318;border:3px solid #fff;box-shadow:0 1px 5px #0008"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

export type { IssueLocation } from './issueLocation';

interface IssueLocationPickerProps {
  reporterLocation: CapturedLocation;
  value: IssueLocation;
  onChange: (value: IssueLocation) => void;
}

function MapClickHandler({
  onPin,
}: {
  onPin: (latitude: number, longitude: number) => void;
}): null {
  useMapEvents({
    click(event) {
      onPin(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

/**
 * Lets a resident distinguish where they are from where the civic issue is.
 * GPS is the initial issue pin, while a map tap records an explicit manual
 * pin and intentionally omits reporter-device accuracy metadata at submit.
 */
export default function IssueLocationPicker({
  reporterLocation,
  value,
  onChange,
}: IssueLocationPickerProps): JSX.Element {
  const { t } = useMessages();
  const pin = (latitude: number, longitude: number): void =>
    onChange(issueLocationFromPin(latitude, longitude));

  return (
    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <h3 className="text-sm font-semibold text-amber-950">{t('submit.location.issueTitle')}</h3>
      <p className="mt-1 text-xs leading-5 text-amber-900">{t('submit.location.issueDetail')}</p>
      <div
        role="img"
        aria-label={t('submit.location.issueMapLabel')}
        className="mt-3 overflow-hidden rounded-lg border border-amber-200"
        style={{ height: 190 }}
      >
        <MapContainer
          center={[value.latitude, value.longitude]}
          zoom={16}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={false}
          attributionControl={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapClickHandler onPin={pin} />
          <Marker position={[value.latitude, value.longitude]} icon={PIN} />
        </MapContainer>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-950">
        <span>
          {value.source === 'manual_pin'
            ? t('submit.location.issueManual')
            : t('submit.location.issueFromGps')}
        </span>
        <button
          type="button"
          onClick={() => onChange(issueLocationFromReporter(reporterLocation))}
          className="min-h-10 rounded-full border border-amber-700/30 bg-white px-3 font-medium text-amber-950 hover:bg-amber-100"
        >
          {t('submit.location.useReporterLocation')}
        </button>
      </div>
    </div>
  );
}

import type { CapturedLocation } from './GpsCapture';

export interface IssueLocation {
  latitude: number;
  longitude: number;
  source: 'reporter_gps' | 'manual_pin';
}

export function issueLocationFromReporter(location: CapturedLocation): IssueLocation {
  return {
    latitude: location.latitude,
    longitude: location.longitude,
    source: 'reporter_gps',
  };
}

export function issueLocationFromPin(latitude: number, longitude: number): IssueLocation {
  return { latitude, longitude, source: 'manual_pin' };
}

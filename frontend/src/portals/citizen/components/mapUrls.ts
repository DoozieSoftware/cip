export function googleMapsUrl(info: {
  name: string;
  address: string;
  center: { latitude: number; longitude: number } | null;
}): string {
  if (info.center) {
    return `https://www.google.com/maps?q=${info.center.latitude}%2C${info.center.longitude}`;
  }
  return `https://www.google.com/maps?q=${encodeURIComponent(`${info.name} ${info.address}`)}`;
}

/** Great-circle distance used only to explain a far-away manual issue pin. */
export function issueReporterDistanceMeters(
  issueLatitude: number,
  issueLongitude: number,
  reporterLatitude: number,
  reporterLongitude: number,
): number {
  const radians = (value: number): number => (value * Math.PI) / 180;
  const dLat = radians(reporterLatitude - issueLatitude);
  const dLng = radians(reporterLongitude - issueLongitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(issueLatitude)) *
      Math.cos(radians(reporterLatitude)) *
      Math.sin(dLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

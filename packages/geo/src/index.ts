export type Position = readonly [number, number];
export interface DistrictBoundary {
  id: string;
  nameAr: string;
  nameEn: string;
  rings: readonly (readonly Position[])[];
}
/** Small synthetic fixtures, not official administrative boundaries. Coordinates are longitude first. */
export const demoBoundaries: DistrictBoundary[] = [
  {
    id: 'maadi',
    nameAr: 'المعادي',
    nameEn: 'Maadi',
    rings: [
      [
        [31.24, 29.94],
        [31.29, 29.94],
        [31.29, 29.99],
        [31.24, 29.99],
        [31.24, 29.94],
      ],
    ],
  },
  {
    id: 'nasr-city',
    nameAr: 'مدينة نصر',
    nameEn: 'Nasr City',
    rings: [
      [
        [31.32, 30.03],
        [31.38, 30.03],
        [31.38, 30.08],
        [31.32, 30.08],
        [31.32, 30.03],
      ],
    ],
  },
];
function onSegment(p: Position, a: Position, b: Position) {
  const cross = (p[1] - a[1]) * (b[0] - a[0]) - (p[0] - a[0]) * (b[1] - a[1]);
  return (
    Math.abs(cross) < 1e-10 &&
    p[0] >= Math.min(a[0], b[0]) &&
    p[0] <= Math.max(a[0], b[0]) &&
    p[1] >= Math.min(a[1], b[1]) &&
    p[1] <= Math.max(a[1], b[1])
  );
}
export function inRing(p: Position, ring: readonly Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    if (onSegment(p, a, b)) return true;
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}
export function contains(p: Position, d: DistrictBoundary) {
  const [outer, ...holes] = d.rings;
  return !!outer && inRing(p, outer) && !holes.some((h) => inRing(p, h));
}
export function resolveDistrict(latitude: number, longitude: number, boundaries = demoBoundaries) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const matches = boundaries.filter((d) => contains([longitude, latitude], d));
  return matches.length === 1 ? matches[0]! : null;
}
export function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const rad = (n: number) => (n * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude),
    dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
export function publicCoordinate(value: number) {
  return Math.round(value * 1000) / 1000;
}

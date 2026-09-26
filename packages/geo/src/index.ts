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

// Official Cairo districts (qism) from OCHA / HDX, CC BY-IGO. See data/README.md.
export { cairoDistrictNames } from './cairo-district-names';
export { cairoDistricts } from './cairo-district-shapes';
import { cairoDistricts } from './cairo-district-shapes';
/**
 * Official Cairo district containing the point, or null outside Cairo Governorate.
 * A point just outside every district (up to `edgeMeters`, from GPS error or the gaps
 * that boundary simplification leaves between neighbours) belongs to the nearest one.
 */
export function resolveCairoDistrict(latitude: number, longitude: number, edgeMeters = 150) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const point: Position = [longitude, latitude];
  // Districts made of several pieces appear once per piece, with the same id.
  const inside = cairoDistricts.find((d) => contains(point, d));
  if (inside) return inside;
  // Equirectangular metres are accurate enough over a few hundred metres.
  const mx = 111320 * Math.cos((latitude * Math.PI) / 180);
  const my = 110540;
  let nearest: DistrictBoundary | null = null;
  let best = edgeMeters;
  for (const district of cairoDistricts)
    for (const ring of district.rings)
      for (let i = 1; i < ring.length; i++) {
        const [ax, ay] = ring[i - 1]!;
        const [bx, by] = ring[i]!;
        const dx = (bx - ax) * mx;
        const dy = (by - ay) * my;
        const px = (longitude - ax) * mx;
        const py = (latitude - ay) * my;
        const t = Math.max(0, Math.min(1, (px * dx + py * dy) / (dx * dx + dy * dy || 1)));
        const distance = Math.hypot(px - t * dx, py - t * dy);
        if (distance < best) {
          best = distance;
          nearest = district;
        }
      }
  return nearest;
}

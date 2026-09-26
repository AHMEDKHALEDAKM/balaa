import { describe, expect, it } from 'vitest';
import {
  contains,
  demoBoundaries,
  distanceMeters,
  publicCoordinate,
  resolveDistrict,
} from '@balaa/geo';
import { canTransition, reportInputSchema } from '@balaa/types';
import { DemoModerationProvider, identityProvider, notificationProvider } from '@balaa/config';
describe('Geography', () => {
  it('routes synthetic fixtures with longitude-first polygons', () => {
    expect(resolveDistrict(29.96, 31.26)?.id).toBe('maadi');
    expect(resolveDistrict(30.055, 31.345)?.id).toBe('nasr-city');
  });
  it('rejects unsupported, invalid and ambiguous coordinates', () => {
    expect(resolveDistrict(31.2, 29.9)).toBeNull();
    expect(resolveDistrict(NaN, 31)).toBeNull();
    expect(resolveDistrict(29.96, 31.26, [...demoBoundaries, demoBoundaries[0]!])).toBeNull();
  });
  it('includes polygon boundaries, excludes holes', () => {
    expect(resolveDistrict(29.94, 31.24)?.id).toBe('maadi');
    expect(
      contains([1, 1], {
        id: 'x',
        nameAr: 'x',
        nameEn: 'x',
        rings: [
          [
            [0, 0],
            [4, 0],
            [4, 4],
            [0, 4],
            [0, 0],
          ],
          [
            [0.5, 0.5],
            [2, 0.5],
            [2, 2],
            [0.5, 2],
            [0.5, 0.5],
          ],
        ],
      }),
    ).toBe(false);
  });
  it('uses meters and approximates public points', () => {
    expect(
      distanceMeters({ latitude: 30, longitude: 31 }, { latitude: 30.0002, longitude: 31 }),
    ).toBeGreaterThan(22);
    expect(
      distanceMeters({ latitude: 30, longitude: 31 }, { latitude: 30.0002, longitude: 31 }),
    ).toBeLessThan(23);
    expect(publicCoordinate(29.960234)).toBe(29.96);
  });
});
describe('Provider safeguards', () => {
  it('does not pretend to implement authorized government identity', () => {
    expect(() => identityProvider('digital_egypt')).toThrow();
  });
  it('marks mock identity as demo', async () => {
    expect(await identityProvider().verify('sample')).toMatchObject({
      verificationMode: 'demo',
      provider: 'digital_egypt_mock',
      verified: true,
    });
  });
  it('routes even real-looking recipients exclusively to the inert test inbox', async () => {
    expect(
      await notificationProvider().send({
        to: 'real@example.gov.eg',
        reportId: 'x',
        subject: 'x',
        body: 'x',
      }),
    ).toEqual({ destination: 'preview@balaa.invalid', status: 'test_captured' });
  });
  it('fails closed when production transport or a real test inbox is requested', () => {
    expect(() => notificationProvider('production')).toThrow();
    expect(() => notificationProvider('test', 'real@example.gov.eg')).toThrow();
  });
  it('holds flagged content for review', async () => {
    expect(
      (await new DemoModerationProvider().review({ description: '[flag] sample', imageUrl: 'x' }))
        .state,
    ).toBe('flagged');
  });
});
describe('Domain validation', () => {
  it('does not resolve without the work transition', () => {
    expect(canTransition('submitted', 'resolved')).toBe(false);
    expect(canTransition('in_progress', 'resolved')).toBe(true);
    expect(canTransition('resolved', 'submitted')).toBe(false);
  });
  it('rejects account and authoritative-district injection', () => {
    expect(
      reportInputSchema.safeParse({
        categoryId: 'pothole',
        severity: 'normal',
        latitude: 29.96,
        longitude: 31.26,
        gpsAccuracy: 10,
        capturedAt: new Date().toISOString(),
        imageUrl: '/api/media/x',
        userId: 'someone-else',
        districtId: 'nasr-city',
      }).success,
    ).toBe(false);
  });
  it('rejects bad coordinates and excessive description', () => {
    expect(
      reportInputSchema.safeParse({
        categoryId: 'pothole',
        severity: 'normal',
        description: 'x'.repeat(501),
        latitude: 91,
        longitude: 31.26,
        gpsAccuracy: 10,
        capturedAt: new Date().toISOString(),
        imageUrl: '/api/media/x',
      }).success,
    ).toBe(false);
  });
});

describe('official Cairo districts', () => {
  it('names well-known places by their district and leaves Giza out', async () => {
    const { resolveCairoDistrict } = await import('@balaa/geo');
    const place = (lat: number, lng: number) => resolveCairoDistrict(lat, lng)?.nameAr ?? null;
    expect(place(29.9602, 31.2569)).toBe('المعادي');
    expect(place(30.0444, 31.2357)).toBe('قصر النيل');
    expect(place(30.0626, 31.2197)).toBe('الزمالك');
    expect(place(30.0731, 31.3456)).toBe('مدينة نصر أول');
    expect(place(30.0074, 31.4913)).toBe('القاهرة الجديدة أول');
    expect(place(29.8414, 31.3342)).toBe('حلوان');
    expect(place(29.9792, 31.1342)).toBeNull();
    expect(place(30.0385, 31.2123)).toBeNull();
    // 60 m beyond Maadi's western edge (GPS error, simplification gaps) goes to the nearest
    // district; 2 km out, across the Nile in Giza, is outside Cairo.
    expect(resolveCairoDistrict(29.96506, 31.2438)).not.toBeNull();
    expect(resolveCairoDistrict(29.96506, 31.22368)).toBeNull();
  });
});

import { readFileSync, readdirSync } from 'node:fs';
import { Parser } from '@pgsql/parser';
import { describe, expect, it } from 'vitest';
import { demoBoundaries } from '@balaa/geo';
const parser = new Parser({ version: 15 });
describe('PostgreSQL syntax and seed integrity', () => {
  for (const file of readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')))
    it(`parses migration ${file}`, async () => {
      const result = await parser.parse(readFileSync(`supabase/migrations/${file}`, 'utf8'));
      expect(result.stmts?.length).toBeGreaterThan(0);
    });
  it('parses generated seed SQL', async () => {
    expect(
      (await parser.parse(readFileSync('supabase/seed/seed.sql', 'utf8'))).stmts?.length,
    ).toBeGreaterThan(0);
  });
  it('keeps configured contacts inert', () => {
    const contacts = JSON.parse(readFileSync('data/cairo-district-contacts.json', 'utf8')) as {
      districts: { endpoints: { email: string }[] }[];
    };
    expect(contacts.districts.length).toBeGreaterThan(30);
    expect(
      contacts.districts.every((d) => d.endpoints.every((e) => e.email.endsWith('.invalid'))),
    ).toBe(true);
  });
  it('keeps local routing fixtures identical to GeoJSON seed geometry', () => {
    const data = JSON.parse(readFileSync('data/cairo-district-boundaries.geojson', 'utf8')) as {
      features: {
        properties: { districtSlug: string; isSynthetic: boolean };
        geometry: { coordinates: number[][][][] };
      }[];
    };
    for (const district of demoBoundaries) {
      const feature = data.features.find((f) => f.properties.districtSlug === district.id);
      expect(feature?.properties.isSynthetic).toBe(true);
      expect(feature?.geometry.coordinates[0]).toEqual(district.rings);
    }
  });
});

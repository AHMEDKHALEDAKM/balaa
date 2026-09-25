/** Produce reviewable SQL for a replacement GeoJSON dataset. Activation is always manual. */
import { readFile, writeFile } from 'node:fs/promises';
import { z } from 'zod';

const coordinate = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
const ring = z
  .array(coordinate)
  .min(4)
  .refine((r) => JSON.stringify(r[0]) === JSON.stringify(r.at(-1)), 'Unclosed ring');
const polygon = z.array(ring).min(1);
const schema = z.object({
  type: z.literal('FeatureCollection'),
  features: z
    .array(
      z.object({
        type: z.literal('Feature'),
        properties: z.object({
          districtSlug: z.string().regex(/^[a-z0-9-]+$/),
          version: z.string().min(1),
          isSynthetic: z.boolean(),
          sourceNote: z.string().min(1),
          sourceUrl: z.url().optional(),
          license: z.string().min(1),
        }),
        geometry: z.discriminatedUnion('type', [
          z.object({ type: z.literal('Polygon'), coordinates: polygon }),
          z.object({ type: z.literal('MultiPolygon'), coordinates: z.array(polygon).min(1) }),
        ]),
      }),
    )
    .min(1),
});
const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath)
  throw new Error('Usage: npx tsx supabase/seed/import-boundaries.ts input.geojson output.sql');
const collection = schema.parse(JSON.parse(await readFile(inputPath, 'utf8')));
const quote = (s: string) => "'" + s.replaceAll("'", "''") + "'";
const seen = new Set<string>();
const sql = [
  '-- Review source, license, topology, district correspondence and overlaps before activation.',
  'begin;',
];
for (const feature of collection.features) {
  const p = feature.properties;
  if (seen.has(p.districtSlug))
    throw new Error(`Multiple features for ${p.districtSlug}; combine them into one MultiPolygon`);
  seen.add(p.districtSlug);
  sql.push(`do $import$ begin
  if not exists(select 1 from public.districts where slug=${quote(p.districtSlug)}) then raise exception 'Unknown district'; end if;
end $import$;`);
  sql.push(`insert into public.district_boundaries(district_id,version,geom,source_url,source_note,license,is_synthetic,active)
select id,${quote(p.version)},extensions.st_multi(extensions.st_setsrid(extensions.st_geomfromgeojson(${quote(JSON.stringify(feature.geometry))}),4326)),${p.sourceUrl ? quote(p.sourceUrl) : 'null'},${quote(p.sourceNote)},${quote(p.license)},${p.isSynthetic},false
from public.districts where slug=${quote(p.districtSlug)};`);
}
sql.push('commit;');
await writeFile(outputPath, sql.join('\n') + '\n', 'utf8');
console.log(
  `Wrote ${collection.features.length} INACTIVE boundary versions. PostGIS validates topology at import. Existing boundaries remain active.`,
);

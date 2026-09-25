# Geographic and contact data

`cairo-districts.json` records Egypt, Cairo, four administrative areas and 38 reference districts, plus an explicitly synthetic `nasr-city` demo record. Names/groupings reference the [Cairo Governorate district directory](https://www.cairo.gov.eg/en/governorate-entities/areas/). This is a reference transcription, not an operationally vetted dataset or partnership.

`cairo-district-boundaries.geojson` contains only two hand-authored rectangular MultiPolygon fixtures for Maadi and a Nasr City demo area. **These are not district boundaries.** CC0-1.0 applies to these synthetic fixtures. The importer requires source/license metadata for replacements and inserts them inactive for review.

`cairo-district-contacts.json` is the external endpoint configuration. All addresses use reserved `.invalid` domains; only the demo primary endpoints are enabled. No real government addresses are provided. Area/escalation endpoint slots are data only, not automatic escalation logic.

Run `node supabase/seed/generate-seed.ts` after editing JSON. Never apply the resulting local demo seed to a shared or production environment. The seed enables synthetic routing and mock identity explicitly.

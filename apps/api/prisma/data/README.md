# Bangladesh location seed data

## File

`bangladesh-locations.json` — static Division → District → Upazila hierarchy used by Phase 20 shipping zones and public location APIs.

## Counts (Phase 20)

| Level | Count |
| --- | ---: |
| Divisions | 8 |
| Districts | 64 |
| Upazilas / thanas | ~550 |

## Source / version / date

| Field | Value |
| --- | --- |
| **SOURCE** | Compiled from Bangladesh Bureau of Statistics (BBS) administrative units and Wikipedia “Districts of Bangladesh” / “List of upazilas of Bangladesh” (cross-checked English names). Common BBS/LGED spellings used (e.g. Chattogram, Cumilla, Jashore). |
| **VERSION** | `2026.09.phase20` |
| **DATE** | 2026-09-26 |

Dhaka district includes city corporation thanas commonly used for e-commerce delivery plus rural upazilas. Other districts include official upazilas (and city thanas where useful for delivery).

## Seeding

Idempotent upsert by stable `code` (see `seed-bangladesh-locations.ts`). No external API at checkout — data is loaded into Postgres once and served from the DB.

## Codes

ASCII codes are deterministic (e.g. `DHAKA`, `DHAKA_DHAKA`, `DHAKA_DHAKA_TEJGAON`). UUIDs are assigned at seed time and remain stable across re-seeds via upsert-by-code.

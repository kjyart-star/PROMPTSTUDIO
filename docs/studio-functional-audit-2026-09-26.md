# Music studio functional audit — 2026-09-26

## Scope and fixes

- Based on production `077452c` (PROMPTSTUDIO, production branch `master`), isolated from unrelated work.
- Both studio download entry points now use `/music/api/download`, resolve private storage paths through the existing authorized signing endpoint, and show failures instead of saving error responses as MP3s.
- Status polling verifies history ownership and the stored provider task ID before provider requests or privileged storage access.
- Additional variations use deterministic IDs and conflict-safe inserts. The parent is only marked complete after all variations persist; a partial save failure remains retryable. Empty audio results cannot report completion.
- Concurrent client polls preserve newly submitted tasks; rapid repeated clicks are guarded. An uncertain network/server failure no longer deletes the history entry.
- Generation validates owned history before charging, returns an already-associated task without submitting it again, and checks that task association actually updated a row.
- Cover generation now allocates history before submission, associates the provider task, and uses the shared persistence/status flow. Saved covers and an outstanding task are restored when the cover tab opens. Playback IDs distinguish separate results.

## Verification

- `node scripts/studio-audit-check.mjs`: 18 offline contract/regression checks (mocked provider/storage/DB; no real generation).
- `npm run check:credits`: pass. `npm run check:lyrics-json`: 9 passed.
- `npx tsc --noEmit --incremental false`: pass.
- `npm run build -- --webpack`: pass. Existing middleware deprecation and convert-to-mp3 createRequire warnings remain.
- Local production server: studio, generation, library, cover and mastering tab navigation; existing song settings loaded (title, lyrics, style, excluded tags and V5).
- Existing track playback advanced past 11 seconds, media readyState 4, no audio error. Downloaded MP3 inspected with ffprobe: 101.999979 seconds, 48 kHz stereo, embedded MJPEG artwork, 2,416,283 bytes.
- Mastering Clean preset changes the EQ values; reset and empty-state export disabling work. At 800/1280/1600 px the mastering page document/body widths equal viewport widths. No console errors during these local checks.

## Boundaries and follow-up

- No paid prompt, music or cover generation was executed; no credits spent. Real provider output quality, source upload, mastering audio export, all model versions, and long-running lifecycle tests are not claimed verified.
- Historical covers which were never persisted by the old implementation cannot be recovered from this change alone.
- Provider acceptance and database association are not a distributed transaction. If association fails after acceptance, the API returns the task/history IDs for support; it does not falsely report successful persistence or automatically re-charge/re-generate.
- Existing storage archival fallback may retain the provider URL when copying fails. This is not a guarantee of permanent retention during storage outages.
- No database migration, infrastructure, pricing, other product deployment, or unrelated original-checkout changes are included.

## Reference

Supabase insert/upsert semantics checked against https://supabase.com/docs/reference/javascript/upsert and update returned-row checks against https://supabase.com/docs/reference/javascript/update on 2026-09-26.

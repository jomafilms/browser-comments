# Lane: widget-ux — make leaving feedback effortless

**TL;DR:** Fix submitter-name persistence (localStorage), audit the capture/annotate flow for friction, and apply small UX wins to public/widget.js. Widget stays a dependency-free vanilla IIFE; every change must work on the four live client installs unchanged (same script tag, same key).

**Depends on:** security lane merged (it adds esc() escaping to the same file — build on top, never around, the escaping).

## What exists / don't rebuild
- public/widget.js (~1,676 lines): floating button → screenshot capture (html2canvas-pro from CDN) → annotation canvas (draw/shapes/text/colors) → comment + name → POST /api/widget. Settings fetched from /api/settings with 24h localStorage cache. Recent mobile fixes (taps, pinch-zoom, wrapping toolbar) and imageTimeout=2s are deliberate — don't regress them.
- The security lane added esc() and rate limiting; respect both.

## The build
1. **Name persistence bug (reported by Annie):** name "doesn't always store consistently" in localStorage. Find the cause — likely: saved under a settings-cache key that gets evicted with the 24h cache, saved only on some submit paths, or cleared when the modal is dismissed. Fix: store `bc_submitter_name` as its OWN localStorage key (never bundled with the settings cache), write it on every successful submit, prefill the field on open. Also persist last-used annotation color.
2. **Friction audit, then implement the wins.** Walk the full flow on desktop + mobile (use app/test-widget/page.tsx via /dev). Implement what's clearly better; list anything taste-ambiguous in the lane file instead of guessing. Candidates spotted in review:
   - Prefilled name → submit should be 2 actions: annotate, send.
   - Show a subtle capture progress state (capture can take ~2s; users double-click).
   - Escape key / click-outside behavior consistent across modal states; don't lose a typed comment on accidental dismiss (keep draft in memory until submit or explicit close).
   - Success state: show the new ticket ref (API returns it after data-model lane; feature-detect the field).
   - Failure state: keep the annotated image + comment so a retry doesn't lose work; offline/network error message that isn't silent.
3. **Self-host html2canvas-pro** (review M3): copy the pinned version into public/vendor/, load from same origin instead of jsdelivr (removes third-party supply-chain risk AND an ad-blocker failure mode). Keep the CDN URL as fallback if the local file 404s (older self-hosted instances that only update widget.js).
4. **Split the file if reasonable:** a tiny esbuild bundle step (source in widget-src/, artifact stays public/widget.js, committed) is ALLOWED if it keeps `public/widget.js` byte-identical in behavior and self-hosters who don't run builds still get the committed artifact. If it turns into a yak-shave, skip and note it — not required.

## Guardrails
- Zero new runtime dependencies for embedders; one script tag, same attributes.
- Don't break the 4 live installs: no changes to the POST /api/widget payload shape beyond additive fields.
- Mobile behavior (recent fixes) must be re-verified after changes.
- localStorage may be unavailable (Safari private mode) — feature-detect, degrade gracefully.

## Acceptance
- Name survives: submit → close → reload page → reopen widget → name prefilled. Works when settings cache is cold.
- Full flow verified on test-widget page: desktop + narrow mobile viewport (devtools), including a simulated network failure on submit (comment not lost).
- `npm run build` clean; widget loads with zero console errors.
- Lane file lists any deferred taste calls.

## Open questions (take defaults, note in lane file)
- Draft persistence across page reloads → default: no (memory only) — avoids stale-screenshot confusion.
- Build step → default: attempt esbuild split; abandon after ~1 hour if messy.

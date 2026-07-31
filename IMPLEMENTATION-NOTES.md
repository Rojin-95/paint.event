# Paint Events Homepage â€” Implementation Notes

## Files changed

- `index.html` â€” complete semantic homepage
- `styles.css` â€” design system, responsive layouts, and interaction states
- `script.js` â€” navigation, sticky header, estimator, and progressive reveals
- `paint-events-booking-v2.html` â€” preserved local copy of the supplied booking flow
- `assets/images/` â€” verified Paint Events imagery, logo, and client logos
- `assets/icons/` â€” reserved for future approved icon assets

## Sections implemented

Sticky header, editorial hero, verified trust strip, asymmetric experience routing, immersive service details, booking estimator preview, dedicated corporate feature, real-events proof, Nasim/therapeutic-art-informed section, FAQ, final CTA, and footer.

## Asset and content status

- Event imagery and verified client logos were sourced from the existing Paint Events site and Nasim's published VoyageLA feature.
- The verified Paint Events testimonial from Ivan D. is used. No review count or aggregate rating is shown.
- No unsupported company logos, credentials, statistics, customer names, or medical claims were added.
- Cancellation, privacy, terms, and accessibility pages were not supplied. Footer references currently route to the FAQ until approved policy pages are available.

## Booking integration

The homepage estimator uses the verified rules in `paint-events-booking-v2.html`:

- 90 minutes: $50 per guest for 4â€“9 guests; $35 for 10â€“100
- 120 minutes: $65 per guest for 4â€“9 guests; $50 for 10â€“100
- 10% group discount at 60+ guests
- Travel within 30 miles is included; the full booking flow calculates $50 per additional 30-mile band

Estimator data is stored in `sessionStorage` and added as URL parameters before continuing to the full booking page. A focused prefill bridge was added so event type, guest count, date, and duration are restored without changing pricing or payment behavior.

## Responsive behavior

The layout adapts at desktop, tablet, and mobile breakpoints. Mobile includes an accessible navigation drawer, stacked estimator fields, full-width content cards, and a sticky booking CTA. Narrow-screen rules cover 320px without horizontal overflow.

## Accessibility

The page includes one H1, semantic landmarks, meaningful image alt text, visible focus styles, minimum touch targets, explicit form labels, live form feedback, keyboard-friendly native FAQ details, a skip link, and reduced-motion support.
## Temporary visual placeholders

The reference image now supplies three replaceable visual placeholders:

- placeholder-paint-palette.png — close-up palette used in the dark “We handle the details” section
- placeholder-hero-paint.png — yellow paint edge at the hero image
- placeholder-footer-paint.png — layered paint texture in the final CTA

Replace these files with generated images using the same filenames to update the page without changing its layout or CSS.
## Booking pattern gallery

- Imported all 100 Paint Events patterns from `Paint Events Patterns.pdf`.
- Full step-by-step artwork is stored in `assets/patterns/full/`.
- Completed-stage thumbnails are stored in `assets/patterns/thumbs/`.
- Step 2 retains the existing Popular, Landscape, Ocean & Beach, Floral, Animals, Cityscape, Seasonal, Abstract, and Whimsical filters.
- Clicking a thumbnail opens the complete step-by-step guide in an accessible dialog.
- “Choose this painting” selects the design for the booking summary and lets the user continue to step 3.
## Scroll-controlled Hero video

The hero video has gone through two implementations. The current one (continuous scroll-scrub) replaced the first (discrete step-per-scroll) after direct feedback that the stepped version felt unsmooth and that a single continuously-scrubbing clip was wanted instead, matching a supplied reference recording of a scroll-scrubbed 3D object.

### Background removal

- Source: `assets/video/hero-paint-sequence.mp4` (identical file to the supplied `Use_the_uploaded_panel_paint (2).mp4`, confirmed by checksum; 10.0s, 24fps, 240-frame, photographed against a light-gray studio backdrop with a soft vignette — not a green screen).
- True alpha-transparent WebM was attempted first (`libvpx-vp9`, `-pix_fmt yuva420p`) but this machine's ffmpeg build (8.1.2) silently drops the alpha channel on WebM mux — verified with an isolated synthetic red/blue alpha round-trip test that also came back fully opaque. This is an environment/build limitation, not a filter-graph mistake.
- Pivoted to the more robust approach: `ffmpeg colorkey=0xc0c0c2:0.06:0.08` keys out the gray backdrop, then the keyed footage is composited onto a solid `#fffdf8` background (the site's `--warm-white`) before final encode, so the output video is fully opaque but the seam disappears because its background pixel-matches the page. This works in every browser (no alpha-webm support needed) and is what actually ships.
- Similarity/blend values were tuned by testing against the lightest sand/foam/cloud highlights in the footage, which sit numerically close to the gray backdrop — too aggressive a threshold eats into those highlights (visible speckling); 0.06/0.08 was the highest setting that stayed clean across all tested frames. Blank/near-blank canvas frames key out almost entirely, which is intentional (nothing to show yet).
- Outputs: `assets/video/hero-paint-sequence.webm` (VP9, primary source) and `assets/video/hero-paint-sequence-clean.mp4` (H.264, fallback `<source>` for browsers without WebM support) — both carry the same background treatment. `-g 8` keeps keyframes frequent (~3/sec) for responsive scroll-seeking. The original untouched `hero-paint-sequence.mp4` is left in place but is no longer referenced by `index.html`.

### Continuous scroll-scrub interaction

- `.hero-scroll-shell` is now a tall (`260vh` desktop / `220vh` mobile) scroll runway; `.hero` stays `position: sticky` inside it, matching the old approach's pinning mechanism.
- `script.js`'s `initializeScrollVideo()` was rewritten from a discrete, wheel-hijacking step sequencer to a single continuous mapping: on every `requestAnimationFrame`, `getProgress()` reads how far scroll has moved through the shell's runway (via `getBoundingClientRect`, no scroll-event listener needed) and lerps `video.currentTime` toward `progress * duration`. `video.play()` is never called — only `currentTime` is written, and only while paused.
- No wheel/keyboard/touch handlers, thresholds, or cooldowns remain — native scrolling (mouse wheel, trackpad, touch swipe, keyboard, even a scrollbar drag) drives the video automatically in both directions since it's a pure function of scroll position, not a queued gesture.
- A safety clamp keeps the animated time at least 0.05s below `video.duration`; setting `currentTime` to exactly the reported duration was observed to throw in some cases, which (uncaught) would have silently killed the animation loop. The write is also wrapped in `try/catch` so a rejected seek drops one frame instead of stopping the loop permanently.
- `.hero-video-visual` now fills the entire right column of the hero at `height:100%` with `object-fit:cover`, so the painting fills that whole section edge-to-edge rather than sitting in a fixed 16:9 letterboxed box.
- The "Scroll to paint" cue fades out as soon as scroll progress passes ~0.05s; the old stage-count/dot indicators were removed since there's no discrete stage anymore.
- Reduced-motion users get the completed frame with no pinned scroll-jack, same as before.

### Testing notes

- Verified via a local static file server (`tmp/static-server.js`, `.claude/launch.json` → `static-preview`) that supports HTTP range requests, which Chromium requires for `<video>` seeking.
- The Browser-pane tab in this environment reports `document.hidden = true` even when "active," which suspends real `requestAnimationFrame` scheduling and (per observation) throttles `setTimeout` progressively the longer the tab stays backgrounded — standard Chrome background-tab behavior, not something a real user hits while actively scrolling a visible tab. Verification was done by injecting a deterministic fake animation-frame clock ahead of `script.js` and driving `getBoundingClientRect` to simulated scroll depths; the progress→time mapping converged exactly to the expected value at 0%, 50%, and 100% simulated scroll.

### Source video swap (`IMG_0999.MP4`)

- The scroll-scrub interaction above was confirmed working well and was explicitly left untouched. The footage itself was swapped for a more tightly-framed shot (`assets/video/IMG_0999.MP4`, 750×566, HEVC, 10s/24fps) supplied directly — the canvas fills essentially the entire frame in this source (checked corner and edge pixels across several frames), so unlike the original 16:9 clip there is no gray studio backdrop to key out; only the very first near-blank-canvas frames are gray, and that's the canvas primer itself, not a removable background.
- Re-encoded straight to `assets/video/hero-paint-sequence.webm` (VP9) and `hero-paint-sequence-clean.mp4` (H.264, fallback), same filenames the page already referenced, `-g 8` for scrub-friendly seeking, no colorkey/composite step needed this time.
- Fixed a real layout bug while wiring this up: `.hero-scroll-shell .hero-grid` inherited `align-items:center` from the base `.hero-grid` rule, so with no explicit `grid-template-rows` the row height (and therefore `.hero-video-visual`'s `height:100%`) was resolving against the *content-driven* auto row height, not the full sticky-pinned hero height. Added `align-items:stretch` on the scroll-shell-specific rule so the video column now measures exactly equal to `.hero`'s height (confirmed 814px/814px/814px/814px for hero/grid/visual/video in a 900px-tall viewport test) — this is what "hero height should equal video height" needed.
- The closer-to-square 750:566 source ratio also crops far less aggressively under `object-fit:cover` than the original 1280:720 clip did, which is the "ratio"/"premium" complaint from that feedback.

### Video sizing rework — no crop, natural ratio, right-aligned (`IMG_1005.MOV`)

`object-fit:cover` was still cropping the video to fill both dimensions of its box, which is exactly what the next round of feedback flagged. The interaction (`script.js`) was explicitly called out as correct and was not touched.

- Swapped the source again for `assets/video/IMG_1005.MOV` (2862×2160, H.264, 11.43s/30fps — same ~1.325:1 ratio family as the previous clip, also full-bleed with no background band to key out). Downscaled to 1400px wide (`scale=1400:-2`, ratio preserved exactly) and re-encoded to the same `hero-paint-sequence.webm` / `-clean.mp4` filenames, `-g 10` keyframes. `video.duration` is read dynamically by `script.js`, so the longer 11.43s runtime needed no script changes.
- `.hero-video-visual` is no longer a grid column: it's `position:absolute;top:0;right:0;bottom:0;height:100%;width:auto` against `.hero` (already `position:sticky`, which is a valid containing block), so it never gets forced into a box with both dimensions constrained. The `<video>` itself is `height:100%;width:auto;max-width:none;object-fit:contain;object-position:right center` — with only height constrained, a replaced element's width is derived from its own intrinsic ratio, so `object-fit` never has to crop anything; it's a no-op safety net here, not the mechanism doing the sizing.
- `.hero-scroll-shell .hero-grid` dropped its two-column split (`grid-template-columns:1fr`) since the video no longer participates in that grid.
- This is the part worth flagging: making `.hero-copy` the sole grid item let it silently stretch to the grid's full width (CSS Grid's default `justify-items:stretch`), so the headline/buttons were rendering on top of the now much-wider video — real overlap, not just an unused empty box, confirmed by comparing `h1`/`.button-row` right edges against the video's left edge. Fixed with `.hero-scroll-shell .hero-copy{max-width:340px}`, which keeps text clear of the video with a margin at the tightest viewport width tested (1440×900 → video left edge at 345.6px, text right edges at 330px). `.button-row`'s existing `flex-wrap:wrap` handles the narrower column by stacking the two buttons instead of overflowing.
- Mobile (≤820px) and reduced-motion both reset `.hero-video-visual` back to `position:static` with `object-fit:contain` (previously `cover`) — video returns to a normal-flow block below the copy, still uncropped, letterboxed instead of cropped if its ratio doesn't match the block.
- Verified via computed geometry (screenshots were unavailable this session — the capture tool timed out consistently, including on a fresh tab): at 1440×900, hero/visual/video all report height 814px and identical top/right/bottom coordinates; video width 1079.16px matches `814 × (1400/1056)` to within rounding; `.hero-copy`'s actual text content (not just its box) sits fully clear of the video's left edge. Mobile confirmed `position:static` + `object-fit:contain` via computed style.

### Source file replaced again + black line at the bottom edge

- `assets/video/IMG_1005.MOV` was swapped for a different export at the same filename (2796×2110, HEVC, same ~1.325:1 ratio family, still full-bleed with no background band). The previously-encoded `hero-paint-sequence.webm`/`-clean.mp4` were stale (built from the old file) and needed re-encoding regardless of the line issue below.
- Found the "black line" by extracting raw frames and sampling pixels directly rather than guessing: a solid black bar sits in the source's **bottom** ~6px (out of 2110px), present in every frame checked (start, mid, later) — a baked-in artifact of this export, not something introduced by our CSS/positioning. Top and side edges were checked and are clean.
- Fixed at the source: `crop=2796:2088:0:0` trims the bad bottom rows before scaling/encoding, so the shipped video never contains it, regardless of how it's later positioned. Re-ran the same `scale=1400:-2` → VP9/H.264 pipeline as before onto the same two filenames.
- Reduced `.hero-copy`'s `max-width` from 340px to 310px — this file's slightly wider ratio (1.34:1 vs. 1.33:1) pushed the video's left edge in a few pixels, which had shrunk the clearance margin from the previous swap down to ~5px; 310px restores a ~35px buffer.

### Full-bleed hero + reveal-on-complete copy (`IMG_1017.MOV`)

Source swapped again, and the layout goal changed from "right-aligned, natural ratio, text always visible beside it" to true full-screen: the video now fills the entire hero (edge-to-edge, header-bottom to viewport-bottom), and the headline/CTA are hidden until the scroll-scrub reaches the end.

- `assets/video/IMG_1017.MOV` (1428×804, ~16:9, HEVC, 17.53s/30fps) is a different kind of clip from the previous ones: it's the same painting-demo opening, but the finished painting transitions into real ocean/underwater video footage for its last several seconds — confirmed by sampling frames across the whole timeline, not just the ends. That closing shot is the "last scene" the request asked to keep high-quality.
- Encoded at **native resolution** (no downscale) with a low CRF (`libvpx-vp9 crf 22`, `libx264 crf 16`, both were 28-30/20 for earlier swaps) — since the video is now stretched to fill the entire viewport instead of a partial column, downscaling further would only have made the already-modest 804p source look softer. Files: 10.5MB webm / 15.3MB mp4 for 17.5s, same shipped filenames.
- Markup ([index.html](index.html)): `.hero-video-visual` moved to be the first child of `.hero`, before `.container.hero-grid`, so it can be a full-bleed background layer instead of a grid column. `.hero-copy` got `id="hero-copy"` for the JS hook.
- CSS: `.hero-video-visual` is now `position:absolute;inset:0;width:100%;height:100%` with the video `object-fit:cover` — genuinely full-bleed, no left-side gap. `.hero-copy` is an overlay (frosted card: `rgba(255,253,248,.92)` + `backdrop-filter:blur(16px)`, matching the existing pill/card look used elsewhere on the site) that starts `opacity:0;transform:translateY(-28px);pointer-events:none` and gets `.is-revealed` (`opacity:1;transform:translateY(0);pointer-events:auto`) added by script — the card exists mainly so the navy text stays legible over a bright, busy video background regardless of which frame is showing.
- `script.js`: `animateVideoTime()` now computes `progress` once per frame and reuses it both for the time-mapping (unchanged) and for a hysteresis-gated reveal — `is-revealed` added at `progress >= 0.99`, removed at `progress < 0.97`, so scrolling back up hides the copy again and there's no flicker right at the boundary. Reduced-motion still shows the copy immediately via a dedicated media-query override, independent of this JS.
- Testing note: confirmed the reveal *logic* is correct (progress computation, class add/remove at the right thresholds, selector `.hero-scroll-shell .hero-copy.is-revealed` matches and is present in the loaded stylesheet with correct specificity) but could not visually confirm the resulting opacity/transform on screen — in this session's Browser pane, `document.hidden` stays stuck `true` no matter what, and while hidden, `getComputedStyle` doesn't reflect *any* style mutation, not even an inline `!important` override set directly via JS. That's a rendering-pipeline suspension in this specific test harness, not a CSS cascade issue — but it means this reveal transition specifically wants a real look before calling it done.

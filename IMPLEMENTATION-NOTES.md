# Paint Events redesign — implementation notes

## Architecture

The project remains a dependency-free static site: semantic HTML, one shared CSS file, and vanilla JavaScript. `index.html` is the production homepage; `index-updated.html` is an identical compatibility copy. `paint-events-booking-v2.html` is the standalone four-step request experience.

## Homepage

- Manrope is applied globally to navigation, headings, body copy, buttons, forms, reviews, footer content, and dynamically generated UI.
- The primary navigation contains only Services, Gallery, About, and FAQ, plus a separate request CTA.
- The opening is a full-viewport, scroll-scrubbed video with two centered choices: Scroll to Paint and Enter Website. Native scrolling drives video time; reduced-motion users receive a non-scrubbed fallback.
- The main hero has a continuous green-to-blue headline treatment, two lower-left actions, and a dark readability overlay.
- Four equal-height service cards use CSS-only future-media areas, so no arbitrary photography has been assigned to those cards.
- Process, booking preview, gallery, corporate, Meet Nasim, Google reviews, FAQ, and footer sections use a consistent component system.
- `assets/images/meet-nasim.jpeg` is the supplied portrait, rendered with an intentional responsive crop and meaningful alt text.
- Review cards contain review text only. The review CTA goes to the Paint Events Google Maps listing; Yelp references and unsupported rating totals are absent.

## Booking request experience

- The flow is Event Details → Choose Painting → Your Info → Review & Request.
- The calendar distinguishes requestable, selected, unavailable, and locally pending dates and explicitly uses Pacific Time.
- Availability, travel, totals, and payment are described truthfully: the static project does not claim live availability, calculate a fictional distance, or simulate payment confirmation.
- The estimator retains the supplied guest and duration pricing rules while labeling its total as an estimate and deferring travel fees until location review.
- All 100 supplied paintings remain searchable, filterable, previewable in an accessible dialog, and selectable.
- Draft data is preserved in `sessionStorage`. The final action opens a prefilled email to `info@paint.events`; it does not transmit a request or payment silently.
- Form errors are associated with fields, surfaced through `aria-invalid`, and focus moves to the first invalid field.

## Responsive and accessible behavior

- Layouts were checked at 1440, 1200, 1024, 768, 480, and 375 pixels wide without horizontal page overflow.
- Service cards remain equal height within each layout; grids progressively collapse from four/two columns to one.
- Mobile navigation manages focus, updates `aria-expanded`, closes on Escape, and returns focus to its trigger.
- Touch targets, including both calendars at 375 pixels, are at least 44 CSS pixels.
- The site includes a skip link, semantic landmarks, one homepage H1, logical heading order, explicit labels, status/alert regions, visible focus styles, alt text, reduced-motion rules, and intrinsic image dimensions.

## Local commands

```sh
npm run build
npm test
npm run serve
```

`npm run serve` starts the range-aware local server used to validate video seeking.

## Integration boundaries

The project has no live calendar, CRM, distance, payment, or transactional email service. Connect those systems before presenting the request as a confirmed booking. The current email handoff depends on the visitor having a configured local mail application.

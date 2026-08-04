const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;
const PAID_EVENTS = new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded"]);
const HANDLED_EVENTS = new Set([
  ...PAID_EVENTS,
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
]);
const TRAVEL_NOTICE = "Travel fees, if applicable, will be confirmed separately.";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const quoteIdentifier = (value) => `"${value.replaceAll('"', '""')}"`;
const findColumn = (columns, candidates) => candidates.find((candidate) => columns.has(candidate));

async function tableColumns(db, tableName) {
  const result = await db.prepare(`PRAGMA table_info(${quoteIdentifier(tableName)})`).all();
  return new Set((result.results || []).map((column) => column.name));
}

function resolveBookingsSchema(columns) {
  const schema = {
    id: findColumn(columns, ["booking_id", "id"]),
    stripeSessionId: findColumn(columns, ["stripe_checkout_session_id", "stripe_session_id"]),
    stripePaymentIntentId: findColumn(columns, ["stripe_payment_intent_id", "payment_intent_id"]),
    status: findColumn(columns, ["status"]),
    paymentStatus: findColumn(columns, ["payment_status"]),
    confirmedAt: findColumn(columns, ["confirmed_at"]),
    updatedAt: findColumn(columns, ["updated_at"]),
    customerName: findColumn(columns, ["customer_name", "name"]),
    customerEmail: findColumn(columns, ["customer_email", "email"]),
    customerPhone: findColumn(columns, ["customer_phone", "phone"]),
    eventType: findColumn(columns, ["event_type"]),
    eventDate: findColumn(columns, ["event_date", "date"]),
    startTime: findColumn(columns, ["start_time", "event_time", "time"]),
    duration: findColumn(columns, ["duration_minutes", "duration"]),
    guestCount: findColumn(columns, ["guest_count", "guests"]),
    location: findColumn(columns, ["event_location", "location", "address"]),
    artworkTitle: findColumn(columns, ["artwork_title", "painting_title"]),
    artworkCategory: findColumn(columns, ["artwork_category", "painting_category"]),
    amountCents: findColumn(columns, ["amount_cents", "total_cents"]),
    company: findColumn(columns, ["company", "organization"]),
    notes: findColumn(columns, ["notes"]),
    customerEmailSentAt: findColumn(columns, ["customer_email_sent_at"]),
    ownerEmailSentAt: findColumn(columns, ["owner_email_sent_at"]),
    calendarEventId: findColumn(columns, ["calendar_event_id"]),
    timezone: findColumn(columns, ["timezone"]),
    endTime: findColumn(columns, ["end_time"]),
  };
  const required = [
    "id", "stripeSessionId", "stripePaymentIntentId", "status", "paymentStatus", "confirmedAt", "updatedAt",
    "customerName", "customerEmail", "eventType", "eventDate", "startTime", "duration", "guestCount",
    "location", "amountCents", "customerEmailSentAt", "ownerEmailSentAt", "calendarEventId",
  ];
  const missing = required.filter((key) => !schema[key]);
  if (missing.length) throw new Error(`The bookings table is missing webhook/email columns: ${missing.join(", ")}`);
  return schema;
}

function resolveProcessedEventsSchema(columns) {
  const schema = {
    eventId: findColumn(columns, ["event_id", "stripe_event_id", "id"]),
    eventType: findColumn(columns, ["event_type", "type"]),
    processedAt: findColumn(columns, ["processed_at", "created_at"]),
  };
  if (!schema.eventId || !schema.eventType) throw new Error("The processed_stripe_events table must contain event ID and event type columns.");
  return schema;
}

function parseStripeSignature(header) {
  if (!header) return null;
  const values = header.split(",").map((part) => part.trim().split("=", 2));
  const timestampValue = values.find(([key]) => key === "t")?.[1];
  const signatures = values.filter(([key, value]) => key === "v1" && value).map(([, value]) => value);
  if (!/^\d+$/.test(timestampValue || "") || signatures.length === 0) return null;
  return { timestamp: Number(timestampValue), signatures };
}

function hexToBytes(value) {
  if (!/^[a-f0-9]{64}$/i.test(value)) return null;
  const bytes = new Uint8Array(32);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  return bytes;
}

function constantTimeEqual(left, right) {
  if (!left || !right || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

async function verifyStripeSignature(rawBody, signatureHeader, secret) {
  const parsed = parseStripeSignature(signatureHeader);
  if (!parsed || !secret) return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(parsed.timestamp) || Math.abs(nowSeconds - parsed.timestamp) > SIGNATURE_TOLERANCE_SECONDS) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(`${parsed.timestamp}.${rawBody}`)));
  return parsed.signatures.some((signature) => constantTimeEqual(digest, hexToBytes(signature)));
}

function eventObject(event) {
  if (!event || typeof event !== "object" || typeof event.id !== "string" || typeof event.type !== "string") return null;
  if (!event.data || typeof event.data.object !== "object" || event.data.object === null) return null;
  return event.data.object;
}

async function alreadyProcessed(db, schema, eventId) {
  const column = quoteIdentifier(schema.eventId);
  return Boolean(await db.prepare(`SELECT ${column} FROM processed_stripe_events WHERE ${column} = ? LIMIT 1`).bind(eventId).first());
}

function processedEventInsert(db, schema, eventId, eventType, processedAt) {
  const columns = [schema.eventId, schema.eventType];
  const values = [eventId, eventType];
  if (schema.processedAt) {
    columns.push(schema.processedAt);
    values.push(processedAt);
  }
  const eventIdColumn = quoteIdentifier(schema.eventId);
  return db.prepare(
    `INSERT INTO processed_stripe_events (${columns.map(quoteIdentifier).join(", ")}) SELECT ${columns.map(() => "?").join(", ")} WHERE NOT EXISTS (SELECT 1 FROM processed_stripe_events WHERE ${eventIdColumn} = ?)`
  ).bind(...values, eventId);
}

async function markEventProcessed(db, schema, eventId, eventType, processedAt) {
  const result = await processedEventInsert(db, schema, eventId, eventType, processedAt).run();
  if (!result.success) throw new Error("Unable to mark the Stripe event as processed.");
}

function bookingSelect(schema) {
  const q = (key) => quoteIdentifier(schema[key]);
  const optional = (key, alias) => schema[key] ? `${q(key)} AS ${alias}` : `NULL AS ${alias}`;
  return [
    `${q("id")} AS bookingId`, `${q("stripeSessionId")} AS stripeSessionId`, `${q("stripePaymentIntentId")} AS stripePaymentIntentId`,
    `${q("status")} AS status`, `${q("paymentStatus")} AS paymentStatus`, `${q("customerName")} AS customerName`,
    `${q("customerEmail")} AS customerEmail`, optional("customerPhone", "customerPhone"), `${q("eventType")} AS eventType`,
    `${q("eventDate")} AS eventDate`, `${q("startTime")} AS startTime`, `${q("duration")} AS durationMinutes`,
    `${q("guestCount")} AS guestCount`, `${q("location")} AS eventLocation`, optional("artworkTitle", "artworkTitle"),
    `${q("amountCents")} AS amountCents`, optional("company", "company"), optional("notes", "notes"),
    `${q("customerEmailSentAt")} AS customerEmailSentAt`, `${q("ownerEmailSentAt")} AS ownerEmailSentAt`,
    `${q("calendarEventId")} AS calendarEventId`, optional("artworkCategory", "artworkCategory"),
    optional("timezone", "timezone"), optional("endTime", "endTime"),
  ].join(", ");
}

async function fetchBooking(db, schema, bookingId, sessionId) {
  const q = (key) => quoteIdentifier(schema[key]);
  return db.prepare(
    `SELECT ${bookingSelect(schema)} FROM bookings WHERE ${q("id")} = ? AND ${q("stripeSessionId")} = ? LIMIT 1`
  ).bind(bookingId, sessionId).first();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);
}

function safeSubjectValue(value) {
  return String(value ?? "").replace(/[\r\n]+/g, " ").trim();
}

function formatUsd(amountCents) {
  const cents = Number(amountCents);
  if (!Number.isInteger(cents) || cents < 0) throw new Error("Booking amount is invalid.");
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function detailRows(details) {
  return details
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== "")
    .map(([label, value]) => `<tr><th align="left" style="padding:6px 12px 6px 0;vertical-align:top">${escapeHtml(label)}</th><td style="padding:6px 0">${escapeHtml(value)}</td></tr>`)
    .join("");
}

function customerEmailHtml(booking) {
  const rows = detailRows([
    ["Customer name", booking.customerName], ["Booking ID", booking.bookingId], ["Event type", booking.eventType],
    ["Event date", booking.eventDate], ["Start time", booking.startTime], ["Duration", `${booking.durationMinutes} minutes`],
    ["Guest count", booking.guestCount], ["Event location", booking.eventLocation], ["Artwork", booking.artworkTitle],
    ["Amount paid", formatUsd(booking.amountCents)],
  ]);
  return `<div style="font-family:Arial,sans-serif;color:#071f4a;line-height:1.5"><h1>Your Paint Events booking is confirmed</h1><table>${rows}</table><p>${escapeHtml(TRAVEL_NOTICE)}</p></div>`;
}

function ownerEmailHtml(booking) {
  const rows = detailRows([
    ["Customer name", booking.customerName], ["Customer email", booking.customerEmail], ["Customer phone", booking.customerPhone],
    ["Company", booking.company], ["Booking ID", booking.bookingId], ["Event type", booking.eventType],
    ["Event date", booking.eventDate], ["Start time", booking.startTime], ["Duration", `${booking.durationMinutes} minutes`],
    ["Guest count", booking.guestCount], ["Event location", booking.eventLocation], ["Artwork", booking.artworkTitle],
    ["Notes", booking.notes], ["Stripe Checkout Session ID", booking.stripeSessionId],
    ["Stripe Payment Intent ID", booking.stripePaymentIntentId], ["Amount paid", formatUsd(booking.amountCents)],
  ]);
  return `<div style="font-family:Arial,sans-serif;color:#071f4a;line-height:1.5"><h1>New paid Paint Events booking</h1><table>${rows}</table><p>${escapeHtml(TRAVEL_NOTICE)}</p></div>`;
}

function requireEmailConfiguration(env) {
  const keys = ["RESEND_API_KEY", "OWNER_EMAIL", "RESEND_FROM_EMAIL", "RESEND_REPLY_TO"];
  const missing = keys.filter((key) => typeof env[key] !== "string" || !env[key].trim());
  if (missing.length) throw new Error(`Email bindings are missing: ${missing.join(", ")}`);
}

async function sendResendEmail(env, { to, subject, html, idempotencyKey }) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      from: env.RESEND_FROM_EMAIL,
      to: [to],
      subject,
      html,
      reply_to: env.RESEND_REPLY_TO,
    }),
  });
  let result;
  try {
    result = await response.json();
  } catch {
    result = null;
  }
  if (!response.ok || !result || typeof result.id !== "string" || !result.id) {
    throw new Error(`Resend delivery failed with HTTP ${response.status}.`);
  }
  return result.id;
}

async function markEmailSent(db, schema, booking, timestampKey, sentAt) {
  const q = (key) => quoteIdentifier(schema[key]);
  const result = await db.prepare(
    `UPDATE bookings SET ${q(timestampKey)} = ?, ${q("updatedAt")} = ? WHERE ${q("id")} = ? AND ${q("stripeSessionId")} = ? AND ${q(timestampKey)} IS NULL`
  ).bind(sentAt, sentAt, booking.bookingId, booking.stripeSessionId).run();
  if (!result.success) throw new Error(`Unable to save ${timestampKey}.`);
}

async function deliverMissingEmails(context, schema, booking) {
  if (booking.status !== "confirmed" || booking.paymentStatus !== "paid") throw new Error("Booking was not confirmed before email delivery.");
  if (booking.customerEmailSentAt && booking.ownerEmailSentAt) return booking;
  requireEmailConfiguration(context.env);

  if (!booking.customerEmailSentAt) {
    await sendResendEmail(context.env, {
      to: booking.customerEmail,
      subject: "Your Paint Events booking is confirmed",
      html: customerEmailHtml(booking),
      idempotencyKey: `paint-events-customer-${booking.bookingId}`,
    });
    const sentAt = new Date().toISOString();
    await markEmailSent(context.env.DB, schema, booking, "customerEmailSentAt", sentAt);
    booking.customerEmailSentAt = sentAt;
  }

  if (!booking.ownerEmailSentAt) {
    await sendResendEmail(context.env, {
      to: context.env.OWNER_EMAIL,
      subject: `New paid Paint Events booking â€” ${safeSubjectValue(booking.eventDate)}`,
      html: ownerEmailHtml(booking),
      idempotencyKey: `paint-events-owner-${booking.bookingId}`,
    });
    const sentAt = new Date().toISOString();
    await markEmailSent(context.env.DB, schema, booking, "ownerEmailSentAt", sentAt);
    booking.ownerEmailSentAt = sentAt;
  }
  return booking;
}

function requireCalendarConfiguration(env) {
  const keys = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN", "GOOGLE_CALENDAR_ID"];
  const missing = keys.filter((key) => typeof env[key] !== "string" || !env[key].trim());
  if (missing.length) throw new Error("Google Calendar configuration is incomplete.");
}

function parseLocalTime(value) {
  const normalized = String(value || "").trim();
  let match = normalized.match(/^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/);
  if (match) return Number(match[1]) * 60 + Number(match[2]);
  match = normalized.match(/^(0?[1-9]|1[0-2]):([0-5]\d)(?::[0-5]\d)?\s*(AM|PM)$/i);
  if (!match) return null;
  let hour = Number(match[1]) % 12;
  if (match[3].toUpperCase() === "PM") hour += 12;
  return hour * 60 + Number(match[2]);
}

function validEventDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (date.getUTCFullYear() !== parts.year || date.getUTCMonth() !== parts.month - 1 || date.getUTCDate() !== parts.day) return null;
  return date;
}

function localCalendarDateTime(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return date.getUTCFullYear() + "-" + pad(date.getUTCMonth() + 1) + "-" + pad(date.getUTCDate()) +
    "T" + pad(date.getUTCHours()) + ":" + pad(date.getUTCMinutes()) + ":00";
}

function calendarDateTimes(booking) {
  const date = validEventDate(booking.eventDate);
  const startMinutes = parseLocalTime(booking.startTime);
  if (!date || startMinutes === null) throw new Error("Booking date or start time is invalid for Calendar.");
  const timezone = String(booking.timezone || "America/Los_Angeles").trim();
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(date);
  } catch {
    throw new Error("Booking timezone is invalid for Calendar.");
  }

  const duration = Number(booking.durationMinutes);
  let elapsedMinutes;
  if (Number.isInteger(duration) && duration > 0) {
    elapsedMinutes = duration;
  } else {
    const endMinutes = parseLocalTime(booking.endTime);
    if (endMinutes === null) throw new Error("Booking has no valid duration or end time for Calendar.");
    elapsedMinutes = endMinutes - startMinutes;
    if (elapsedMinutes <= 0) elapsedMinutes += 24 * 60;
  }

  const start = new Date(date.getTime() + startMinutes * 60 * 1000);
  const end = new Date(start.getTime() + elapsedMinutes * 60 * 1000);
  return {
    start: { dateTime: localCalendarDateTime(start), timeZone: timezone },
    end: { dateTime: localCalendarDateTime(end), timeZone: timezone },
  };
}

async function deterministicCalendarEventId(bookingId) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(bookingId))));
  return "pe" + Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function calendarDescription(booking) {
  const details = [
    ["Booking ID", booking.bookingId],
    ["Customer name", booking.customerName],
    ["Customer email", booking.customerEmail],
    ["Customer phone", booking.customerPhone],
    ["Company", booking.company],
    ["Event type", booking.eventType],
    ["Artwork title", booking.artworkTitle],
    ["Artwork category", booking.artworkCategory],
    ["Guest count", booking.guestCount],
    ["Duration", booking.durationMinutes ? booking.durationMinutes + " minutes" : null],
    ["Amount paid", formatUsd(booking.amountCents)],
    ["Notes", booking.notes],
    ["Stripe Checkout Session ID", booking.stripeSessionId],
  ];
  return details
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== "")
    .map(([label, value]) => label + ": " + String(value))
    .join("\n");
}

async function googleAccessToken(env) {
  requireCalendarConfiguration(env);
  const body = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    refresh_token: env.GOOGLE_REFRESH_TOKEN,
    grant_type: "refresh_token",
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  let result;
  try {
    result = await response.json();
  } catch {
    result = null;
  }
  if (!response.ok || !result || typeof result.access_token !== "string" || !result.access_token) {
    throw new Error("Google access token request failed with HTTP " + response.status + ".");
  }
  return result.access_token;
}

async function createOrRecoverCalendarEvent(env, booking) {
  const accessToken = await googleAccessToken(env);
  const eventId = await deterministicCalendarEventId(booking.bookingId);
  const calendarId = encodeURIComponent(env.GOOGLE_CALENDAR_ID);
  const eventUrl = "https://www.googleapis.com/calendar/v3/calendars/" + calendarId + "/events";
  const dateTimes = calendarDateTimes(booking);
  const eventBody = {
    id: eventId,
    summary: "Paint Event — " + String(booking.customerName),
    location: booking.eventLocation || undefined,
    description: calendarDescription(booking),
    start: dateTimes.start,
    end: dateTimes.end,
    attendees: [{ email: booking.customerEmail, displayName: booking.customerName }],
  };
  const createResponse = await fetch(eventUrl + "?sendUpdates=all", {
    method: "POST",
    headers: { authorization: "Bearer " + accessToken, "content-type": "application/json" },
    body: JSON.stringify(eventBody),
  });

  if (createResponse.status === 409) {
    const recoveryResponse = await fetch(eventUrl + "/" + encodeURIComponent(eventId), {
      headers: { authorization: "Bearer " + accessToken },
    });
    let recovered;
    try {
      recovered = await recoveryResponse.json();
    } catch {
      recovered = null;
    }
    if (!recoveryResponse.ok || !recovered || typeof recovered.id !== "string" || !recovered.id) {
      throw new Error("Existing Google Calendar event could not be recovered.");
    }
    return recovered.id;
  }

  let created;
  try {
    created = await createResponse.json();
  } catch {
    created = null;
  }
  if (!createResponse.ok || !created || typeof created.id !== "string" || !created.id) {
    throw new Error("Google Calendar event creation failed with HTTP " + createResponse.status + ".");
  }
  return created.id;
}

async function saveCalendarEventId(db, schema, booking, calendarEventId) {
  const q = (key) => quoteIdentifier(schema[key]);
  const result = await db.prepare(
    "UPDATE bookings SET " + q("calendarEventId") + " = ?, " + q("updatedAt") + " = datetime('now') WHERE " +
      q("id") + " = ? AND " + q("calendarEventId") + " IS NULL"
  ).bind(calendarEventId, booking.bookingId).run();
  if (!result.success) throw new Error("Unable to save the Google Calendar event ID.");
  const refreshed = await fetchBooking(db, schema, booking.bookingId, booking.stripeSessionId);
  if (!refreshed || !refreshed.calendarEventId) throw new Error("Google Calendar event ID could not be verified in D1.");
  return refreshed;
}

async function ensureCalendarEvent(context, schema, booking) {
  if (booking.status !== "confirmed" || booking.paymentStatus !== "paid") {
    throw new Error("Booking was not confirmed before Calendar creation.");
  }
  if (booking.calendarEventId) return booking;
  const calendarEventId = await createOrRecoverCalendarEvent(context.env, booking);
  return saveCalendarEventId(context.env.DB, schema, booking, calendarEventId);
}

async function handlePaidEvent(context, event, session, bookingSchema, processedSchema, bookingId, sessionId) {
  const db = context.env.DB;
  const now = new Date().toISOString();
  const q = (key) => quoteIdentifier(bookingSchema[key]);
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;

  let booking = await fetchBooking(db, bookingSchema, bookingId, sessionId);
  if (!booking) throw new Error("No booking matches the Stripe Checkout Session.");

  if (session.payment_status !== "paid") {
    await markEventProcessed(db, processedSchema, event.id, event.type, now);
    return "processed-unpaid";
  }
  if (!paymentIntentId) throw Object.assign(new Error("Paid Checkout Session is missing a payment intent."), { payloadError: true });

  if (!(booking.status === "confirmed" && booking.paymentStatus === "paid")) {
    const confirmation = await db.prepare(
      `UPDATE bookings SET ${q("status")} = 'confirmed', ${q("paymentStatus")} = 'paid', ${q("stripePaymentIntentId")} = ?, ${q("confirmedAt")} = ?, ${q("updatedAt")} = ? WHERE ${q("id")} = ? AND ${q("stripeSessionId")} = ? AND NOT (${q("status")} = 'confirmed' AND ${q("paymentStatus")} = 'paid')`
    ).bind(paymentIntentId, now, now, bookingId, sessionId).run();
    if (!confirmation.success) throw new Error("Unable to confirm the paid booking.");
  }

  booking = await fetchBooking(db, bookingSchema, bookingId, sessionId);
  if (!booking || booking.status !== "confirmed" || booking.paymentStatus !== "paid") throw new Error("Paid booking confirmation could not be verified.");
  booking = await deliverMissingEmails(context, bookingSchema, booking);
  booking = await ensureCalendarEvent(context, bookingSchema, booking);
  await markEventProcessed(db, processedSchema, event.id, event.type, new Date().toISOString());
  return "processed-paid";
}

async function handleNonPaidEvent(context, event, session, bookingSchema, processedSchema, bookingId, sessionId) {
  const db = context.env.DB;
  if (await alreadyProcessed(db, processedSchema, event.id)) return "duplicate";
  const now = new Date().toISOString();
  const q = (key) => quoteIdentifier(bookingSchema[key]);
  const existing = await fetchBooking(db, bookingSchema, bookingId, sessionId);
  if (!existing) throw new Error("No booking matches the Stripe Checkout Session.");
  const statements = [];
  if (!(existing.status === "confirmed" && existing.paymentStatus === "paid")) {
    if (event.type === "checkout.session.async_payment_failed") {
      statements.push(db.prepare(
        `UPDATE bookings SET ${q("status")} = 'payment_failed', ${q("paymentStatus")} = 'failed', ${q("updatedAt")} = ? WHERE ${q("id")} = ? AND ${q("stripeSessionId")} = ? AND NOT (${q("status")} = 'confirmed' AND ${q("paymentStatus")} = 'paid')`
      ).bind(now, bookingId, sessionId));
    } else if (event.type === "checkout.session.expired") {
      statements.push(db.prepare(
        `UPDATE bookings SET ${q("status")} = 'expired', ${q("paymentStatus")} = 'unpaid', ${q("updatedAt")} = ? WHERE ${q("id")} = ? AND ${q("stripeSessionId")} = ? AND NOT (${q("status")} = 'confirmed' AND ${q("paymentStatus")} = 'paid')`
      ).bind(now, bookingId, sessionId));
    }
  }
  statements.push(processedEventInsert(db, processedSchema, event.id, event.type, now));
  await db.batch(statements);
  return "processed";
}

async function processEvent(context, event, session, bookingSchema, processedSchema) {
  if (!HANDLED_EVENTS.has(event.type)) {
    if (await alreadyProcessed(context.env.DB, processedSchema, event.id)) return "duplicate";
    await markEventProcessed(context.env.DB, processedSchema, event.id, event.type, new Date().toISOString());
    return "ignored";
  }
  const bookingId = typeof session.metadata?.booking_id === "string" ? session.metadata.booking_id.trim() : "";
  const sessionId = typeof session.id === "string" ? session.id.trim() : "";
  if (!bookingId || !sessionId) throw Object.assign(new Error("Stripe event is missing booking metadata."), { payloadError: true });
  if (PAID_EVENTS.has(event.type)) return handlePaidEvent(context, event, session, bookingSchema, processedSchema, bookingId, sessionId);
  return handleNonPaidEvent(context, event, session, bookingSchema, processedSchema, bookingId, sessionId);
}

export async function onRequest(context) {
  if (context.request.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: { allow: "POST" } });
  if (!context.env.DB || !context.env.STRIPE_WEBHOOK_SECRET) {
    console.error("Stripe webhook bindings are missing.");
    return json({ error: "Webhook is not configured." }, 500);
  }

  // Read and verify the exact raw body before JSON parsing.
  let rawBody;
  try {
    rawBody = await context.request.text();
  } catch {
    return json({ error: "Invalid webhook body." }, 400);
  }
  const signatureHeader = context.request.headers.get("Stripe-Signature");
  let verified = false;
  try {
    verified = await verifyStripeSignature(rawBody, signatureHeader, context.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    verified = false;
  }
  if (!verified) return json({ error: "Invalid Stripe signature." }, 400);

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid webhook payload." }, 400);
  }
  const session = eventObject(event);
  if (!session) return json({ error: "Invalid webhook payload." }, 400);

  try {
    const [bookingColumns, processedColumns] = await Promise.all([
      tableColumns(context.env.DB, "bookings"),
      tableColumns(context.env.DB, "processed_stripe_events"),
    ]);
    const result = await processEvent(context, event, session, resolveBookingsSchema(bookingColumns), resolveProcessedEventsSchema(processedColumns));
    return json({ received: true, duplicate: result === "duplicate" });
  } catch (error) {
    if (error?.payloadError) return json({ error: "Invalid webhook payload." }, 400);
    console.error("Stripe webhook processing failed", error);
    return json({ error: "Webhook processing failed." }, 500);
  }
}




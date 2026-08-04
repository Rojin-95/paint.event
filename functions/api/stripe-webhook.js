const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;
const HANDLED_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
]);

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
  };
  const missing = Object.entries(schema).filter(([, value]) => !value).map(([key]) => key);
  if (missing.length) throw new Error(`The bookings table is missing webhook columns: ${missing.join(", ")}`);
  return schema;
}

function resolveProcessedEventsSchema(columns) {
  const schema = {
    eventId: findColumn(columns, ["event_id", "stripe_event_id", "id"]),
    eventType: findColumn(columns, ["event_type", "type"]),
    processedAt: findColumn(columns, ["processed_at", "created_at"]),
  };
  if (!schema.eventId || !schema.eventType) {
    throw new Error("The processed_stripe_events table must contain event ID and event type columns.");
  }
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
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
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
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(`${parsed.timestamp}.${rawBody}`)));
  return parsed.signatures.some((signature) => constantTimeEqual(digest, hexToBytes(signature)));
}

function eventDetails(event) {
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

async function processEvent(context, event, session, bookingSchema, processedSchema) {
  const db = context.env.DB;
  const processedAt = new Date().toISOString();
  if (await alreadyProcessed(db, processedSchema, event.id)) return "duplicate";

  const statements = [];
  if (HANDLED_EVENTS.has(event.type)) {
    const bookingId = typeof session.metadata?.booking_id === "string" ? session.metadata.booking_id.trim() : "";
    const sessionId = typeof session.id === "string" ? session.id.trim() : "";
    if (!bookingId || !sessionId) throw Object.assign(new Error("Stripe event is missing booking metadata."), { payloadError: true });

    const q = (key) => quoteIdentifier(bookingSchema[key]);
    const processedEventIdColumn = quoteIdentifier(processedSchema.eventId);
    const notProcessedSql = ` AND NOT EXISTS (SELECT 1 FROM processed_stripe_events WHERE ${processedEventIdColumn} = ?)`;
    const existing = await db.prepare(
      `SELECT ${q("status")} AS status, ${q("paymentStatus")} AS paymentStatus FROM bookings WHERE ${q("id")} = ? AND ${q("stripeSessionId")} = ? LIMIT 1`
    ).bind(bookingId, sessionId).first();
    if (!existing) throw new Error("No booking matches the Stripe Checkout Session.");

    const alreadyConfirmedPaid = existing.status === "confirmed" && existing.paymentStatus === "paid";
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      if (session.payment_status === "paid" && !alreadyConfirmedPaid) {
        const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
        if (!paymentIntentId) throw Object.assign(new Error("Paid Checkout Session is missing a payment intent."), { payloadError: true });
        statements.push(db.prepare(
          `UPDATE bookings SET ${q("status")} = 'confirmed', ${q("paymentStatus")} = 'paid', ${q("stripePaymentIntentId")} = ?, ${q("confirmedAt")} = ?, ${q("updatedAt")} = ? WHERE ${q("id")} = ? AND ${q("stripeSessionId")} = ?${notProcessedSql}`
        ).bind(paymentIntentId, processedAt, processedAt, bookingId, sessionId, event.id));
      }
    } else if (event.type === "checkout.session.async_payment_failed") {
      if (!alreadyConfirmedPaid) {
        statements.push(db.prepare(
          `UPDATE bookings SET ${q("status")} = 'payment_failed', ${q("paymentStatus")} = 'failed', ${q("updatedAt")} = ? WHERE ${q("id")} = ? AND ${q("stripeSessionId")} = ? AND NOT (${q("status")} = 'confirmed' AND ${q("paymentStatus")} = 'paid')${notProcessedSql}`
        ).bind(processedAt, bookingId, sessionId, event.id));
      }
    } else if (event.type === "checkout.session.expired" && !alreadyConfirmedPaid) {
      statements.push(db.prepare(
        `UPDATE bookings SET ${q("status")} = 'expired', ${q("paymentStatus")} = 'unpaid', ${q("updatedAt")} = ? WHERE ${q("id")} = ? AND ${q("stripeSessionId")} = ? AND NOT (${q("status")} = 'confirmed' AND ${q("paymentStatus")} = 'paid')${notProcessedSql}`
      ).bind(processedAt, bookingId, sessionId, event.id));
    }
  }

  statements.push(processedEventInsert(db, processedSchema, event.id, event.type, processedAt));
  await db.batch(statements);
  return "processed";
}

export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: { allow: "POST" } });
  }
  if (!context.env.DB || !context.env.STRIPE_WEBHOOK_SECRET) {
    console.error("Stripe webhook bindings are missing.");
    return json({ error: "Webhook is not configured." }, 500);
  }

  // Stripe signatures cover the exact raw bytes represented by this text. Do not parse JSON first.
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
  const session = eventDetails(event);
  if (!session) return json({ error: "Invalid webhook payload." }, 400);

  try {
    const [bookingColumns, processedColumns] = await Promise.all([
      tableColumns(context.env.DB, "bookings"),
      tableColumns(context.env.DB, "processed_stripe_events"),
    ]);
    const result = await processEvent(
      context,
      event,
      session,
      resolveBookingsSchema(bookingColumns),
      resolveProcessedEventsSchema(processedColumns)
    );
    return json({ received: true, duplicate: result === "duplicate" });
  } catch (error) {
    if (error?.payloadError) return json({ error: "Invalid webhook payload." }, 400);
    // A concurrent duplicate may lose the unique insert race; treat it as delivered if it now exists.
    try {
      const processedSchema = resolveProcessedEventsSchema(await tableColumns(context.env.DB, "processed_stripe_events"));
      if (typeof event.id === "string" && await alreadyProcessed(context.env.DB, processedSchema, event.id)) {
        return json({ received: true, duplicate: true });
      }
    } catch {}
    console.error("Stripe webhook database processing failed", error);
    return json({ error: "Webhook processing failed." }, 500);
  }
}

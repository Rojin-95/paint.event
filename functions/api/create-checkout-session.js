const TIMEZONE = "America/Los_Angeles";
const CURRENCY = "usd";
const HOLD_MINUTES = 15;
const STRIPE_EXPIRATION_SECONDS = 30 * 60;
const TRAVEL_NOTICE = "Travel fees, if applicable, will be confirmed separately.";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const clean = (value, max = 500) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

function calculateAmountCents(guestCount, durationMinutes) {
  const rateDollars = durationMinutes === 90
    ? (guestCount <= 9 ? 50 : 35)
    : (guestCount <= 9 ? 65 : 50);
  const subtotalCents = guestCount * rateDollars * 100;
  return guestCount >= 60 ? Math.round(subtotalCents * 0.9) : subtotalCents;
}

function isValidCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function todayInLosAngeles() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function normalizeTime(value) {
  const input = clean(value, 20);
  const twentyFourHour = input.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  const twelveHour = input.match(/^(0?[1-9]|1[0-2]):([0-5]\d)\s*(AM|PM)$/i);
  let hour24;
  let minute;
  if (twentyFourHour) {
    hour24 = Number(twentyFourHour[1]);
    minute = Number(twentyFourHour[2]);
  } else if (twelveHour) {
    const hour12 = Number(twelveHour[1]);
    minute = Number(twelveHour[2]);
    hour24 = (hour12 % 12) + (twelveHour[3].toUpperCase() === "PM" ? 12 : 0);
  } else {
    return null;
  }
  if (hour24 < 8 || hour24 > 20 || (hour24 === 20 && minute !== 0)) return null;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return `${String(hour12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function timeToMinutes(normalizedTime) {
  const match = normalizedTime.match(/^(\d{2}):(\d{2}) (AM|PM)$/);
  const hour12 = Number(match[1]);
  return (hour12 % 12) * 60 + Number(match[2]) + (match[3] === "PM" ? 720 : 0);
}
function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

function findColumn(columns, candidates) {
  return candidates.find((candidate) => columns.has(candidate));
}

async function getBookingColumns(db) {
  const result = await db.prepare("PRAGMA table_info(bookings)").all();
  return new Set((result.results || []).map((column) => column.name));
}

function resolveSchema(columns) {
  const schema = {
    id: findColumn(columns, ["booking_id", "id"]),
    customerName: findColumn(columns, ["customer_name", "name"]),
    customerEmail: findColumn(columns, ["customer_email", "email"]),
    customerPhone: findColumn(columns, ["customer_phone", "phone"]),
    eventType: findColumn(columns, ["event_type"]),
    eventDate: findColumn(columns, ["event_date", "date"]),
    startTime: findColumn(columns, ["start_time", "event_time", "time"]),
    duration: findColumn(columns, ["duration_minutes", "duration"]),
    guestCount: findColumn(columns, ["guest_count", "guests"]),
    location: findColumn(columns, ["event_location", "location", "address"]),
    amountCents: findColumn(columns, ["amount_cents", "total_cents"]),
    stripeSessionId: findColumn(columns, ["stripe_checkout_session_id", "stripe_session_id"]),
    status: findColumn(columns, ["status"]),
    paymentStatus: findColumn(columns, ["payment_status"]),
    holdExpiresAt: findColumn(columns, ["hold_expires_at"]),
    timezone: findColumn(columns, ["timezone"]),
    currency: findColumn(columns, ["currency"]),
    createdAt: findColumn(columns, ["created_at"]),
    updatedAt: findColumn(columns, ["updated_at"]),
    company: findColumn(columns, ["company", "organization"]),
    notes: findColumn(columns, ["notes"]),
    artworkId: findColumn(columns, ["artwork_id", "painting_id"]),
    artworkTitle: findColumn(columns, ["artwork_title", "painting_title"]),
    artworkCategory: findColumn(columns, ["artwork_category", "painting_category"]),
  };
  const required = [
    "id", "customerName", "customerEmail", "eventType", "eventDate", "startTime",
    "duration", "guestCount", "location", "amountCents", "stripeSessionId", "status",
    "paymentStatus", "holdExpiresAt", "timezone", "currency", "createdAt",
  ];
  const missing = required.filter((key) => !schema[key]);
  if (missing.length) throw new Error(`The bookings table is missing required columns: ${missing.join(", ")}`);
  return schema;
}

async function handlePost(context) {
  if (!context.env.DB || !context.env.STRIPE_SECRET_KEY) {
    return json({ error: "Payment service is not configured." }, 503);
  }

  let input;
  try {
    input = await context.request.json();
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400);
  }

  const booking = {
    customerName: clean(input.customerName, 160),
    customerEmail: clean(input.customerEmail, 254).toLowerCase(),
    customerPhone: clean(input.customerPhone, 40),
    eventType: clean(input.eventType, 100),
    eventDate: clean(input.eventDate, 10),
    startTime: normalizeTime(input.startTime),
    durationMinutes: Number(input.durationMinutes),
    guestCount: Number(input.guestCount),
    eventLocation: clean(input.eventLocation, 500),
    company: clean(input.company, 160),
    notes: clean(input.notes, 2000),
    artworkId: Number.isInteger(Number(input.artworkId)) ? Number(input.artworkId) : null,
    artworkTitle: clean(input.artworkTitle, 160),
    artworkCategory: clean(input.artworkCategory, 100),
  };

  if (!booking.customerName || booking.customerName.length < 2) return json({ error: "Please enter your full name." }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(booking.customerEmail)) return json({ error: "Please enter a valid email address." }, 400);
  if (booking.customerPhone && !/^[+\d\s().-]{7,40}$/.test(booking.customerPhone)) return json({ error: "Please enter a valid phone number." }, 400);
  if (!booking.eventType) return json({ error: "Please select an event type." }, 400);
  if (!isValidCalendarDate(booking.eventDate) || booking.eventDate <= todayInLosAngeles()) return json({ error: "Please select a future event date." }, 400);
  if (!booking.startTime) return json({ error: "Please select a valid start time." }, 400);
  if (![90, 120].includes(booking.durationMinutes)) return json({ error: "Event duration must be 90 or 120 minutes." }, 400);
  if (!Number.isInteger(booking.guestCount) || booking.guestCount < 4 || booking.guestCount > 100) return json({ error: "Guest count must be between 4 and 100." }, 400);
  if (booking.eventLocation.length < 5) return json({ error: "Please enter the event location." }, 400);

  const amountCents = calculateAmountCents(booking.guestCount, booking.durationMinutes);
  if (!Number.isInteger(amountCents) || amountCents <= 0) return json({ error: "Unable to calculate the booking amount." }, 400);

  const now = new Date();
  const createdAt = now.toISOString();
  const holdExpiresAt = new Date(now.getTime() + HOLD_MINUTES * 60 * 1000).toISOString();
  const bookingId = `PE-${now.getUTCFullYear()}-${crypto.randomUUID()}`;

  let schema;
  try {
    schema = resolveSchema(await getBookingColumns(context.env.DB));
  } catch (error) {
    console.error("Bookings schema error", error);
    return json({ error: "Booking storage is not configured correctly." }, 503);
  }

  const q = (key) => quoteIdentifier(schema[key]);
  await context.env.DB.prepare(
    `UPDATE bookings SET ${q("status")} = 'expired' WHERE ${q("status")} = 'pending_payment' AND ${q("holdExpiresAt")} <= ?`
  ).bind(createdAt).run();

  const valuesByKey = {
    id: bookingId,
    customerName: booking.customerName,
    customerEmail: booking.customerEmail,
    customerPhone: booking.customerPhone || null,
    eventType: booking.eventType,
    eventDate: booking.eventDate,
    startTime: booking.startTime,
    duration: booking.durationMinutes,
    guestCount: booking.guestCount,
    location: booking.eventLocation,
    amountCents,
    stripeSessionId: null,
    status: "pending_payment",
    paymentStatus: "unpaid",
    holdExpiresAt,
    timezone: TIMEZONE,
    currency: CURRENCY,
    createdAt,
    updatedAt: createdAt,
    company: booking.company || null,
    notes: booking.notes || null,
    artworkId: booking.artworkId,
    artworkTitle: booking.artworkTitle || null,
    artworkCategory: booking.artworkCategory || null,
  };
  const insertKeys = Object.keys(valuesByKey).filter((key) => schema[key]);
  const insertColumns = insertKeys.map((key) => q(key)).join(", ");
  const placeholders = insertKeys.map(() => "?").join(", ");
  const insertValues = insertKeys.map((key) => valuesByKey[key]);
  const storedStartMinutes = `((CAST(substr(${q("startTime")}, 1, 2) AS INTEGER) % 12) * 60 + CAST(substr(${q("startTime")}, 4, 2) AS INTEGER) + CASE WHEN upper(substr(${q("startTime")}, 7, 2)) = 'PM' THEN 720 ELSE 0 END)`;
  const conflictSql = `NOT EXISTS (SELECT 1 FROM bookings WHERE ${q("eventDate")} = ? AND abs(${storedStartMinutes} - ?) < 240 AND (${q("status")} = 'confirmed' OR (${q("status")} = 'pending_payment' AND ${q("holdExpiresAt")} > ?)))`;
  const inserted = await context.env.DB.prepare(
    `INSERT INTO bookings (${insertColumns}) SELECT ${placeholders} WHERE ${conflictSql}`
  ).bind(...insertValues, booking.eventDate, timeToMinutes(booking.startTime), createdAt).run();

  if (!inserted.meta?.changes) {
    return json({ error: "That start time is within four hours of another booking. Please select an earlier or later time." }, 409);
  }

  const origin = new URL(context.request.url).origin;
  const stripeParams = new URLSearchParams();
  stripeParams.set("mode", "payment");
  stripeParams.set("customer_email", booking.customerEmail);
  stripeParams.set("success_url", `${origin}/booking-success.html?session_id={CHECKOUT_SESSION_ID}`);
  stripeParams.set("cancel_url", `${origin}/paint-events-booking-v2.html`);
  stripeParams.set("expires_at", String(Math.floor(Date.now() / 1000) + STRIPE_EXPIRATION_SECONDS));
  stripeParams.set("metadata[booking_id]", bookingId);
  stripeParams.set("payment_intent_data[metadata][booking_id]", bookingId);
  stripeParams.set("line_items[0][quantity]", "1");
  stripeParams.set("line_items[0][price_data][currency]", CURRENCY);
  stripeParams.set("line_items[0][price_data][unit_amount]", String(amountCents));
  stripeParams.set("line_items[0][price_data][product_data][name]", `${booking.durationMinutes}-minute Paint Events experience for ${booking.guestCount} guests`);
  stripeParams.set("line_items[0][price_data][product_data][description]", TRAVEL_NOTICE);

  let stripeSession;
  try {
    const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${context.env.STRIPE_SECRET_KEY}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: stripeParams,
    });
    stripeSession = await stripeResponse.json();
    if (!stripeResponse.ok || !stripeSession.id || !stripeSession.url) {
      throw new Error(stripeSession?.error?.message || "Stripe Checkout Session creation failed.");
    }
  } catch (error) {
    console.error("Stripe Checkout error", error);
    await context.env.DB.prepare(`DELETE FROM bookings WHERE ${q("id")} = ? AND ${q("status")} = 'pending_payment'`).bind(bookingId).run();
    return json({ error: "Checkout could not be created. Please try again." }, 502);
  }

  try {
    const updatedAtSql = schema.updatedAt ? `, ${q("updatedAt")} = ?` : "";
    const updateValues = schema.updatedAt ? [stripeSession.id, new Date().toISOString(), bookingId] : [stripeSession.id, bookingId];
    await context.env.DB.prepare(
      `UPDATE bookings SET ${q("stripeSessionId")} = ?${updatedAtSql} WHERE ${q("id")} = ?`
    ).bind(...updateValues).run();
  } catch (error) {
    console.error("Unable to save Stripe Checkout Session ID", error);
    await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(stripeSession.id)}/expire`, {
      method: "POST",
      headers: { authorization: `Bearer ${context.env.STRIPE_SECRET_KEY}` },
    }).catch(() => {});
    await context.env.DB.prepare(`DELETE FROM bookings WHERE ${q("id")} = ? AND ${q("status")} = 'pending_payment'`).bind(bookingId).run();
    return json({ error: "Checkout could not be finalized. Please try again." }, 500);
  }

  return json({ checkoutUrl: stripeSession.url, bookingId });
}

export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: { allow: "POST" } });
  }
  try {
    return await handlePost(context);
  } catch (error) {
    console.error("Unexpected checkout error", error);
    return json({ error: "Unable to start checkout. Please try again." }, 500);
  }
}

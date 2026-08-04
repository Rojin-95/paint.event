const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const quoteIdentifier = (value) => `"${value.replaceAll('"', '""')}"`;
const findColumn = (columns, candidates) => candidates.find((candidate) => columns.has(candidate));

async function resolveSchema(db) {
  const result = await db.prepare("PRAGMA table_info(bookings)").all();
  const columns = new Set((result.results || []).map((column) => column.name));
  const schema = {
    id: findColumn(columns, ["booking_id", "id"]),
    stripeSessionId: findColumn(columns, ["stripe_checkout_session_id", "stripe_session_id"]),
    status: findColumn(columns, ["status"]),
    paymentStatus: findColumn(columns, ["payment_status"]),
  };
  if (Object.values(schema).some((value) => !value)) throw new Error("The bookings table is missing status columns.");
  return schema;
}

export async function onRequest(context) {
  if (context.request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405, headers: { allow: "GET" } });
  }
  if (!context.env.DB) return json({ error: "Booking status is not configured." }, 500);

  const sessionId = new URL(context.request.url).searchParams.get("session_id")?.trim() || "";
  if (!/^cs_[A-Za-z0-9_]{8,250}$/.test(sessionId)) return json({ error: "Invalid session ID." }, 400);

  try {
    const schema = await resolveSchema(context.env.DB);
    const q = (key) => quoteIdentifier(schema[key]);
    const booking = await context.env.DB.prepare(
      `SELECT ${q("id")} AS bookingId, ${q("status")} AS status, ${q("paymentStatus")} AS paymentStatus FROM bookings WHERE ${q("stripeSessionId")} = ? LIMIT 1`
    ).bind(sessionId).first();
    if (!booking) return json({ error: "Booking not found." }, 404);
    return json({
      bookingId: booking.bookingId,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
    });
  } catch (error) {
    console.error("Booking status lookup failed", error);
    return json({ error: "Unable to verify booking status." }, 500);
  }
}

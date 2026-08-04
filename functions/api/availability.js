const TIMEZONE = "America/Los_Angeles";
const MINIMUM_SEPARATION_MINUTES = 4 * 60;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const quoteIdentifier = (value) => `"${value.replaceAll('"', '""')}"`;
const findColumn = (columns, candidates) => candidates.find((candidate) => columns.has(candidate));

function isValidCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

async function resolveSchema(db) {
  const result = await db.prepare("PRAGMA table_info(bookings)").all();
  const columns = new Set((result.results || []).map((column) => column.name));
  const schema = {
    eventDate: findColumn(columns, ["event_date", "date"]),
    startTime: findColumn(columns, ["start_time", "event_time", "time"]),
    status: findColumn(columns, ["status"]),
    holdExpiresAt: findColumn(columns, ["hold_expires_at"]),
  };
  if (Object.values(schema).some((value) => !value)) throw new Error("The bookings table is missing availability columns.");
  return schema;
}

export async function onRequest(context) {
  if (context.request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405, headers: { allow: "GET" } });
  }
  if (!context.env.DB) return json({ error: "Availability is not configured." }, 500);
  const date = new URL(context.request.url).searchParams.get("date")?.trim() || "";
  if (!isValidCalendarDate(date)) return json({ error: "Please provide a valid event date." }, 400);

  try {
    const schema = await resolveSchema(context.env.DB);
    const q = (key) => quoteIdentifier(schema[key]);
    const now = new Date().toISOString();
    const result = await context.env.DB.prepare(
      `SELECT ${q("startTime")} AS startTime FROM bookings WHERE ${q("eventDate")} = ? AND (${q("status")} = 'confirmed' OR (${q("status")} = 'pending_payment' AND ${q("holdExpiresAt")} > ?))`
    ).bind(date, now).all();
    return json({
      date,
      timezone: TIMEZONE,
      minimumSeparationMinutes: MINIMUM_SEPARATION_MINUTES,
      blockedStartTimes: (result.results || []).map((row) => row.startTime).filter((value) => typeof value === "string"),
    });
  } catch (error) {
    console.error("Availability lookup failed", error);
    return json({ error: "Unable to check availability." }, 500);
  }
}

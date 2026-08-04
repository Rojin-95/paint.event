const ORIGIN = { latitude: 33.9850, longitude: -118.4695 };

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
});

export async function onRequest(context) {
  if (context.request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  let body;
  try { body = await context.request.json(); }
  catch { return json({ error: 'Invalid request.' }, 400); }

  const address = String(body.address || '').trim();
  const postalCode = String(body.postalCode || '').trim();
  if (address.length < 8) return json({ error: 'Enter the complete event address.' }, 400);
  if (!/^\d{5}(?:-\d{4})?$/.test(postalCode)) return json({ error: 'Enter a valid ZIP Code.' }, 400);

  try {
    const query = `${address}, ${postalCode}, California, USA`;
    const geocodeUrl = new URL('https://nominatim.openstreetmap.org/search');
    geocodeUrl.search = new URLSearchParams({ q: query, format: 'jsonv2', limit: '1', countrycodes: 'us' });
    const geocode = await fetch(geocodeUrl, { headers: { 'User-Agent': 'Paint Events booking distance calculator' } });
    if (!geocode.ok) throw new Error('Geocoding failed');
    const places = await geocode.json();
    if (!Array.isArray(places) || !places[0]) return json({ error: 'We could not locate that address and ZIP Code. Please check both fields.' }, 422);

    const destination = { latitude: Number(places[0].lat), longitude: Number(places[0].lon) };
    const routeUrl = `https://router.project-osrm.org/route/v1/driving/${ORIGIN.longitude},${ORIGIN.latitude};${destination.longitude},${destination.latitude}?overview=false`;
    const route = await fetch(routeUrl, { headers: { 'User-Agent': 'Paint Events booking distance calculator' } });
    if (!route.ok) throw new Error('Routing failed');
    const routeData = await route.json();
    const meters = Number(routeData?.routes?.[0]?.distance);
    if (!Number.isFinite(meters) || meters <= 0) throw new Error('No route');

    const distanceMiles = Math.round((meters / 1609.344) * 10) / 10;
    const travelFeeEstimate = Math.ceil(Math.max(0, distanceMiles - 30) / 30) * 50;
    return json({ distanceMiles, travelFeeEstimate });
  } catch {
    return json({ error: 'Distance could not be calculated right now. Please try again.' }, 503);
  }
}



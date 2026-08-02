import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import vm from 'node:vm';

const root = resolve(import.meta.dirname, '..');
const requiredFiles = ['index.html', 'index-updated.html', 'styles.css', 'script.js', 'paint-events-booking-v2.html'];
const failures = [];

for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) failures.push(`Missing required file: ${file}`);
}

const index = readFileSync(join(root, 'index.html'), 'utf8');
const mirroredIndex = readFileSync(join(root, 'index-updated.html'), 'utf8');
const styles = readFileSync(join(root, 'styles.css'), 'utf8');
const script = readFileSync(join(root, 'script.js'), 'utf8');
const booking = readFileSync(join(root, 'paint-events-booking-v2.html'), 'utf8');

if (index !== mirroredIndex) failures.push('index-updated.html is not synchronized with index.html.');

for (const [name, content] of [['index.html', index], ['styles.css', styles], ['script.js', script], ['paint-events-booking-v2.html', booking]]) {
  if (/Yelp/i.test(content)) failures.push(`${name} still contains a Yelp reference.`);
  if (/DM Sans|Fraunces|Segoe UI/i.test(content)) failures.push(`${name} still contains an obsolete font declaration.`);
}

if (!index.includes('family=Manrope')) failures.push('Homepage Manrope font import is missing.');
if (!booking.includes('family=Manrope')) failures.push('Booking Manrope font import is missing.');
if (!index.includes('id="scroll-to-paint"') || !index.includes('id="enter-website"')) failures.push('Opening video choices are missing.');
if (!index.includes('id="home"')) failures.push('Main hero skip target is missing.');
if (!index.includes('assets/images/meet-nasim.jpeg')) failures.push('Supplied Meet Nasim portrait is not referenced.');
if (!index.includes('google.com/maps/search/?api=1')) failures.push('Google business profile destination is missing.');
if (/Stripe|submitPayment|payment received|simulateDist|Simulate availability/i.test(booking)) failures.push('Booking page still contains simulated availability, distance, or payment behavior.');
if (!booking.includes('id="booking-calendar"')) failures.push('Accessible request calendar is missing.');
if (!booking.includes('paintEventsRequestDraft')) failures.push('Booking draft preservation is missing.');

const navMatch = index.match(/<nav class="desktop-nav"[\s\S]*?<\/nav>/);
const navLabels = navMatch ? [...navMatch[0].matchAll(/<a[^>]*>([^<]+)/g)].map(match => match[1].trim()) : [];
if (JSON.stringify(navLabels) !== JSON.stringify(['Services', 'Gallery', 'About', 'FAQ'])) {
  failures.push(`Primary navigation is not the requested four-link set: ${navLabels.join(', ')}`);
}

function validateLocalReferences(filename, content) {
  const base = dirname(join(root, filename));
  const references = new Set();
  for (const match of content.matchAll(/(?:src|href)="([^"]*)"/g)) references.add(match[1]);
  for (const match of content.matchAll(/url\(["']?([^"')]+)["']?\)/g)) references.add(match[1]);
  for (const reference of references) {
    const clean = reference.split('#')[0].split('?')[0];
    if (!clean || clean.includes('${') || /^(?:https?:|mailto:|tel:|data:|javascript:)/i.test(clean) || clean.startsWith('#')) continue;
    if (!existsSync(resolve(base, decodeURIComponent(clean)))) failures.push(`${filename} references missing local file: ${clean}`);
  }
}

validateLocalReferences('index.html', index);
validateLocalReferences('styles.css', styles);
validateLocalReferences('paint-events-booking-v2.html', booking);

try {
  new vm.Script(script, { filename: 'script.js' });
} catch (error) {
  failures.push(`Homepage JavaScript syntax error: ${error.message}`);
}

const inlineScripts = [...booking.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
for (const [index, inlineScript] of inlineScripts.entries()) {
  if (!inlineScript.trim()) continue;
  try {
    new vm.Script(inlineScript, { filename: `paint-events-booking-v2.html:inline-${index + 1}` });
  } catch (error) {
    failures.push(`Booking JavaScript syntax error: ${error.message}`);
  }
}

const fullPatterns = readdirSync(join(root, 'assets/patterns/full')).filter(file => file.endsWith('.webp'));
const thumbnails = readdirSync(join(root, 'assets/patterns/thumbs')).filter(file => /\.png$/i.test(file));
if (fullPatterns.length !== 100) failures.push(`Expected 100 full painting patterns, found ${fullPatterns.length}.`);
if (thumbnails.length !== 100) failures.push(`Expected 100 painting thumbnails, found ${thumbnails.length}.`);

if (failures.length) {
  console.error(`Validation failed with ${failures.length} issue(s):`);
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Paint Events static build validation passed.');
console.log('Verified: required files, local assets, JavaScript syntax, Manrope, navigation, video choices, Google reviews, portrait, booking trust language, calendar, draft preservation, and 100 artwork patterns.');

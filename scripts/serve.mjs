import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const port = Number(process.env.PORT) || 4173;
const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webm': 'video/webm',
  '.webp': 'image/webp'
};

createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const file = normalize(join(root, relative));
  if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  const size = statSync(file).size;
  const contentType = types[extname(file).toLowerCase()] || 'application/octet-stream';
  const range = request.headers.range;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) {
      response.writeHead(416, { 'Content-Range': `bytes */${size}` });
      response.end();
      return;
    }
    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
    if (start > end || start >= size) {
      response.writeHead(416, { 'Content-Range': `bytes */${size}` });
      response.end();
      return;
    }
    response.writeHead(206, {
      'Accept-Ranges': 'bytes',
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': end - start + 1,
      'Content-Type': contentType,
      'Cache-Control': 'no-store'
    });
    createReadStream(file, { start, end }).pipe(response);
    return;
  }

  response.writeHead(200, {
    'Accept-Ranges': 'bytes',
    'Content-Length': size,
    'Content-Type': contentType,
    'Cache-Control': 'no-store'
  });
  createReadStream(file).pipe(response);
}).listen(port, '127.0.0.1', () => {
  console.log(`Paint Events preview: http://127.0.0.1:${port}/`);
});

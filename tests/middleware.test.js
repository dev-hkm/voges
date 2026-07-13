import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/_middleware.js';

test('middleware adds browser security headers without blocking same-origin microphone', async () => {
  const response = await onRequest({
    request: new Request('https://voges.pages.dev/'),
    next: async () => new Response('<!doctype html>', { headers: { 'Content-Type': 'text/html' } }),
  });

  assert.equal(response.headers.get('X-Frame-Options'), 'DENY');
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.match(response.headers.get('Permissions-Policy'), /microphone=\(self\)/);
  assert.equal(response.headers.get('Cache-Control'), 'no-cache, must-revalidate');
  assert.match(response.headers.get('Strict-Transport-Security'), /max-age=31536000/);
});

test('middleware does not mark API responses as browser documents', async () => {
  const response = await onRequest({
    request: new Request('http://localhost:5173/api/health'),
    next: async () => Response.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } }),
  });

  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('Strict-Transport-Security'), null);
});

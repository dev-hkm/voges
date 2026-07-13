// WebAuthn credentials are scoped to an exact relying-party ID. Although
// localhost and 127.0.0.1 point to the same machine, browsers correctly treat
// them as different sites. Keep the local demo on localhost so the RP config,
// registered passkey and visible browser origin can never drift apart.
export async function onRequest(context) {
  const url = new URL(context.request.url);
  // Redirect only document navigation. Redirecting a POST API request changes
  // its method in some browser paths and can interrupt a live voice session.
  if (context.request.method === 'GET' && !url.pathname.startsWith('/api/') && url.hostname === '127.0.0.1' && url.port === '5173') {
    url.hostname = 'localhost';
    return Response.redirect(url.toString(), 307);
  }
  const response = await context.next();
  const secured = new Response(response.body, response);
  secured.headers.set('X-Content-Type-Options', 'nosniff');
  secured.headers.set('Referrer-Policy', 'no-referrer');
  secured.headers.set('X-Frame-Options', 'DENY');
  secured.headers.set('Content-Security-Policy', "frame-ancestors 'none'");
  secured.headers.set('Permissions-Policy', 'microphone=(self), camera=(), geolocation=(), payment=()');

  if (context.request.method === 'GET' && !url.pathname.startsWith('/api/') && !url.pathname.includes('.')) {
    secured.headers.set('Cache-Control', 'no-cache, must-revalidate');
  }

  if (url.protocol === 'https:') {
    secured.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  return secured;
}

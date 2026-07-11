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
  return context.next();
}

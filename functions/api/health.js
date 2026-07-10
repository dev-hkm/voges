export function onRequestGet({ env }) {
  return Response.json({
    ok: true,
    service: 'voges-pages-functions',
    model: 'gpt-realtime-2.1',
    bindings: { openai: Boolean(env.OPENAI_API_KEY), d1: Boolean(env.DB), r2: Boolean(env.MEDIA_BUCKET), kv: Boolean(env.SESSIONS), queue: Boolean(env.EVENTS) },
  });
}

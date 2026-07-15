import { getRealtimeAccess, REALTIME_PREVIEW_SECONDS } from '../../_lib/realtime-access.js';

export async function onRequestGet({ request, env }) {
  if (!env.DB) {
    return Response.json({
      available: false,
      limit_seconds: REALTIME_PREVIEW_SECONDS,
      reason: 'Voice preview access is temporarily unavailable.',
    }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const { access } = await getRealtimeAccess(env.DB, request, env);
    return Response.json(access, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error(JSON.stringify({ event: 'realtime_access_check_failed', message: error?.message || 'unknown_error' }));
    return Response.json({
      available: false,
      limit_seconds: REALTIME_PREVIEW_SECONDS,
      reason: 'Voice preview access is temporarily unavailable.',
    }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}

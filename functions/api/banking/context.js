import { getCustomerContext } from '../../_lib/banking.js';

export async function onRequestGet({ env, request }) {
  if (!env.DB) return Response.json({ error: 'D1 binding DB is not configured.' }, { status: 503 });
  try {
    const requestedCustomerId = new URL(request.url).searchParams.get('customer_id');
    return Response.json({ data: await getCustomerContext(env.DB, requestedCustomerId) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error.message || 'Could not load banking context.' }, { status: 500 });
  }
}

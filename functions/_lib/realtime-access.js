import { id, now, sha256 } from './core.js';

export const REALTIME_PREVIEW_SECONDS = 90;
const RESERVATION_TTL_MS = 2 * 60 * 1000;

function clientAddress(request) {
  return request.headers.get('CF-Connecting-IP')
    || request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim()
    || 'local-development';
}

export async function realtimeIdentityHash(request, env) {
  const secret = env.REALTIME_GATE_SECRET || env.EXECUTION_TOKEN_SECRET;
  if (!secret) throw new Error('REALTIME_GATE_SECRET or EXECUTION_TOKEN_SECRET must be configured.');
  return sha256(`${secret}:${clientAddress(request)}`);
}

export function describeRealtimeAccess(row, currentTime = Date.now()) {
  if (!row) {
    return {
      available: true,
      limit_seconds: REALTIME_PREVIEW_SECONDS,
      reason: null,
    };
  }

  if (row.status === 'reserved') {
    const reservedAt = Date.parse(row.reserved_at || '');
    if (Number.isFinite(reservedAt) && currentTime - reservedAt > RESERVATION_TTL_MS) {
      return { available: true, limit_seconds: REALTIME_PREVIEW_SECONDS, reason: null };
    }
    return {
      available: false,
      limit_seconds: REALTIME_PREVIEW_SECONDS,
      reason: 'A voice preview is already being prepared for this network.',
    };
  }

  return {
    available: false,
    limit_seconds: REALTIME_PREVIEW_SECONDS,
    reason: 'The 90-second voice preview has already been used on this network.',
  };
}

export async function getRealtimeAccess(db, request, env) {
  const identityHash = await realtimeIdentityHash(request, env);
  const row = await db.prepare('SELECT status,reserved_at,token_issued_at,access_expires_at,blocked_at FROM realtime_access_limits WHERE identity_hash=?')
    .bind(identityHash)
    .first();
  return { identityHash, row, access: describeRealtimeAccess(row) };
}

export async function reserveRealtimeAccess(db, request, env) {
  const identityHash = await realtimeIdentityHash(request, env);
  const staleBefore = new Date(Date.now() - RESERVATION_TTL_MS).toISOString();
  await db.prepare("DELETE FROM realtime_access_limits WHERE identity_hash=? AND status='reserved' AND reserved_at<? AND token_issued_at IS NULL")
    .bind(identityHash, staleBefore)
    .run();

  const reservationId = id();
  const timestamp = now();
  const result = await db.prepare(`INSERT OR IGNORE INTO realtime_access_limits
    (identity_hash,reservation_id,status,reserved_at,last_seen_at,attempt_count)
    VALUES (?,?, 'reserved', ?, ?, 1)`)
    .bind(identityHash, reservationId, timestamp, timestamp)
    .run();

  if (!result.meta?.changes) {
    await db.prepare('UPDATE realtime_access_limits SET last_seen_at=?,attempt_count=attempt_count+1 WHERE identity_hash=?')
      .bind(timestamp, identityHash)
      .run();
    const row = await db.prepare('SELECT status,reserved_at,token_issued_at,access_expires_at,blocked_at FROM realtime_access_limits WHERE identity_hash=?')
      .bind(identityHash)
      .first();
    return { granted: false, identityHash, reservationId: null, access: describeRealtimeAccess(row) };
  }

  return {
    granted: true,
    identityHash,
    reservationId,
    access: { available: true, limit_seconds: REALTIME_PREVIEW_SECONDS, reason: null },
  };
}

export async function completeRealtimeAccess(db, identityHash, reservationId) {
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + REALTIME_PREVIEW_SECONDS * 1000);
  const result = await db.prepare(`UPDATE realtime_access_limits
    SET status='issued',token_issued_at=?,access_expires_at=?,blocked_at=?,last_seen_at=?
    WHERE identity_hash=? AND reservation_id=? AND status='reserved'`)
    .bind(issuedAt.toISOString(), expiresAt.toISOString(), expiresAt.toISOString(), issuedAt.toISOString(), identityHash, reservationId)
    .run();
  if (!result.meta?.changes) throw new Error('Realtime access reservation could not be finalized.');
  return expiresAt.toISOString();
}

export async function releaseRealtimeReservation(db, identityHash, reservationId) {
  if (!identityHash || !reservationId) return;
  await db.prepare("DELETE FROM realtime_access_limits WHERE identity_hash=? AND reservation_id=? AND status='reserved' AND token_issued_at IS NULL")
    .bind(identityHash, reservationId)
    .run();
}

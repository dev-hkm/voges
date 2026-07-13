import { demoCustomerId, json, now } from '../../_lib/core.js';

function rows(result) {
  return result?.results || [];
}

export async function onRequestGet({ env }) {
  try {
    const customerId = await demoCustomerId(env.DB);
    const [customer, accounts, cards, transactions, tickets, counts] = await Promise.all([
      env.DB.prepare('SELECT full_name,risk_level,kyc_status,account_status,created_at FROM customers WHERE id=?').bind(customerId).first(),
      env.DB.prepare('SELECT type,balance,available_balance,currency,status FROM accounts WHERE customer_id=? ORDER BY type').bind(customerId).all(),
      env.DB.prepare('SELECT type,tier,card_number_masked,status,online_payment_enabled,international_payment_enabled,contactless_enabled,daily_limit,monthly_limit FROM cards WHERE customer_id=? ORDER BY type').bind(customerId).all(),
      env.DB.prepare('SELECT merchant_name,amount,currency,status,decline_reason,created_at FROM transactions WHERE account_id IN (SELECT id FROM accounts WHERE customer_id=?) ORDER BY created_at DESC LIMIT 8').bind(customerId).all(),
      env.DB.prepare('SELECT subject,status,priority,created_at FROM support_tickets WHERE customer_id=? ORDER BY created_at DESC LIMIT 5').bind(customerId).all(),
      env.DB.prepare(`SELECT
        (SELECT COUNT(*) FROM transactions WHERE account_id IN (SELECT id FROM accounts WHERE customer_id=?)) AS transactions,
        (SELECT COUNT(*) FROM audit_logs WHERE customer_id=?) AS audit_events,
        (SELECT COUNT(*) FROM pending_actions WHERE customer_id=? AND status='completed') AS completed_actions`).bind(customerId, customerId, customerId).first(),
    ]);

    return json({ data: {
      generated_at: now(),
      provenance: {
        database: 'Cloudflare D1',
        dataset: 'Workspace sample banking dataset',
        freshness: 'Live query at request time',
        privacy: 'Sensitive card and identity fields are excluded or masked',
      },
      customer,
      accounts: rows(accounts),
      cards: rows(cards),
      transactions: rows(transactions),
      support_tickets: rows(tickets),
      counts: counts || { transactions: 0, audit_events: 0, completed_actions: 0 },
    } });
  } catch (error) {
    return json({ error: error.message }, 400);
  }
}

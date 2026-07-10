const DECLINE_EXPLANATIONS = {
  online_payment_disabled: 'Online payments are disabled for this card.',
  international_disabled: 'International payments are disabled for this card.',
  insufficient_funds: 'The available balance was not enough for this payment.',
  daily_limit: 'This payment would exceed the card daily limit.',
  monthly_limit: 'This payment would exceed the card monthly limit.',
  expired_card: 'The card has expired.',
  locked_card: 'The card is currently locked.',
  kyc_required: 'Additional KYC verification is required before this transaction.',
  suspicious_activity: 'The payment was paused for a security review.',
  fraud_detected: 'The payment was blocked by fraud monitoring.',
};

export const TOOL_DEFINITIONS = [
  { type: 'function', name: 'getCustomerProfile', description: 'Read the identified customer profile, accounts, KYC status, and account status.', parameters: { type: 'object', properties: {}, additionalProperties: false } },
  { type: 'function', name: 'getRecentTransactions', description: 'Read the customer\'s most recent transactions. Use merchant when the customer mentions a merchant such as Netflix.', parameters: { type: 'object', properties: { merchant: { type: 'string', description: 'Optional merchant name to match.' }, limit: { type: 'integer', minimum: 1, maximum: 10 } }, additionalProperties: false } },
  { type: 'function', name: 'getCardStatus', description: 'Read card status, payment toggles, and limits for the customer.', parameters: { type: 'object', properties: { card_id: { type: 'string', description: 'Optional card ID if known.' } }, additionalProperties: false } },
  { type: 'function', name: 'getKycStatus', description: 'Read the customer\'s KYC status and latest submitted document status.', parameters: { type: 'object', properties: {}, additionalProperties: false } },
  { type: 'function', name: 'explainDeclineReason', description: 'Explain the reason for a declined transaction. Use merchant or transaction_id when known.', parameters: { type: 'object', properties: { transaction_id: { type: 'string' }, merchant: { type: 'string' } }, additionalProperties: false } },
  { type: 'function', name: 'generateFundingInstruction', description: 'Read official funding instructions from bank product documents.', parameters: { type: 'object', properties: {}, additionalProperties: false } },
  { type: 'function', name: 'createSupportTicket', description: 'Propose a support ticket. This never creates or changes a ticket in V2.', parameters: { type: 'object', properties: { subject: { type: 'string' }, description: { type: 'string' } }, required: ['subject'], additionalProperties: false } },
];

function rows(result) {
  return result?.results || [];
}

function cardView(card) {
  if (!card) return null;
  return {
    id: card.id,
    type: card.type,
    tier: card.tier,
    masked_number: card.card_number_masked,
    status: card.status,
    online_payment_enabled: Boolean(card.online_payment_enabled),
    international_payment_enabled: Boolean(card.international_payment_enabled),
    contactless_enabled: Boolean(card.contactless_enabled),
    daily_limit: card.daily_limit,
    monthly_limit: card.monthly_limit,
  };
}

export async function resolveCustomerId(db, requestedCustomerId) {
  if (requestedCustomerId) {
    const customer = await db.prepare('SELECT id FROM customers WHERE id = ?').bind(requestedCustomerId).first();
    if (customer) return customer.id;
  }
  const defaultCustomer = await db.prepare('SELECT id FROM customers ORDER BY id ASC LIMIT 1').first();
  if (!defaultCustomer) throw new Error('No customer exists in the banking dataset.');
  return defaultCustomer.id;
}

export async function getCustomerContext(db, requestedCustomerId) {
  const customerId = await resolveCustomerId(db, requestedCustomerId);
  const customer = await db.prepare(`SELECT id, full_name, email, phone, risk_level, kyc_status, account_status FROM customers WHERE id = ?`).bind(customerId).first();
  const accounts = rows(await db.prepare(`SELECT id, type, balance, available_balance, currency, interest_rate, status FROM accounts WHERE customer_id = ? ORDER BY type`).bind(customerId).all());
  const cards = rows(await db.prepare(`SELECT id, type, tier, card_number_masked, status, online_payment_enabled, international_payment_enabled, contactless_enabled, daily_limit, monthly_limit FROM cards WHERE customer_id = ? ORDER BY type`).bind(customerId).all()).map(cardView);
  const kycDocument = await db.prepare(`SELECT document_type, status, rejection_reason, submitted_at FROM kyc_documents WHERE customer_id = ? ORDER BY submitted_at DESC LIMIT 1`).bind(customerId).first();
  return { customer, accounts, cards, kyc_document: kycDocument || null };
}

export async function executeBankingTool(db, name, args = {}, requestedCustomerId) {
  const customerId = await resolveCustomerId(db, requestedCustomerId);

  if (name === 'getCustomerProfile') return getCustomerContext(db, customerId);

  if (name === 'getRecentTransactions') {
    const limit = Math.min(Math.max(Number(args.limit) || 5, 1), 10);
    const merchant = args.merchant?.trim();
    const statement = merchant
      ? db.prepare(`SELECT t.id, t.type, t.category, t.amount, t.currency, t.merchant_name, t.status, t.decline_reason, t.created_at, c.card_number_masked FROM transactions t JOIN accounts a ON a.id = t.account_id LEFT JOIN cards c ON c.id = t.card_id WHERE a.customer_id = ? AND lower(t.merchant_name) LIKE lower(?) ORDER BY t.created_at DESC LIMIT ?`).bind(customerId, `%${merchant}%`, limit)
      : db.prepare(`SELECT t.id, t.type, t.category, t.amount, t.currency, t.merchant_name, t.status, t.decline_reason, t.created_at, c.card_number_masked FROM transactions t JOIN accounts a ON a.id = t.account_id LEFT JOIN cards c ON c.id = t.card_id WHERE a.customer_id = ? ORDER BY t.created_at DESC LIMIT ?`).bind(customerId, limit);
    return { customer_id: customerId, transactions: rows(await statement.all()) };
  }

  if (name === 'getCardStatus') {
    const statement = args.card_id
      ? db.prepare(`SELECT * FROM cards WHERE customer_id = ? AND id = ?`).bind(customerId, args.card_id)
      : db.prepare(`SELECT * FROM cards WHERE customer_id = ? ORDER BY type`).bind(customerId);
    const result = args.card_id ? [await statement.first()].filter(Boolean) : rows(await statement.all());
    return { customer_id: customerId, cards: result.map(cardView) };
  }

  if (name === 'getKycStatus') {
    const profile = await db.prepare(`SELECT kyc_status, account_status FROM customers WHERE id = ?`).bind(customerId).first();
    const document = await db.prepare(`SELECT document_type, status, rejection_reason, submitted_at FROM kyc_documents WHERE customer_id = ? ORDER BY submitted_at DESC LIMIT 1`).bind(customerId).first();
    return { customer_id: customerId, ...profile, latest_document: document || null };
  }

  if (name === 'explainDeclineReason') {
    const transaction = args.transaction_id
      ? await db.prepare(`SELECT t.id, t.merchant_name, t.amount, t.currency, t.status, t.decline_reason, t.created_at, c.card_number_masked, c.status AS card_status, c.online_payment_enabled, c.international_payment_enabled, c.daily_limit FROM transactions t JOIN accounts a ON a.id = t.account_id LEFT JOIN cards c ON c.id = t.card_id WHERE a.customer_id = ? AND t.id = ? AND t.status = 'declined'`).bind(customerId, args.transaction_id).first()
      : await db.prepare(`SELECT t.id, t.merchant_name, t.amount, t.currency, t.status, t.decline_reason, t.created_at, c.card_number_masked, c.status AS card_status, c.online_payment_enabled, c.international_payment_enabled, c.daily_limit FROM transactions t JOIN accounts a ON a.id = t.account_id LEFT JOIN cards c ON c.id = t.card_id WHERE a.customer_id = ? AND t.status = 'declined' AND (? IS NULL OR lower(t.merchant_name) LIKE lower(?)) ORDER BY t.created_at DESC LIMIT 1`).bind(customerId, args.merchant?.trim() || null, args.merchant ? `%${args.merchant.trim()}%` : null).first();
    if (!transaction) return { customer_id: customerId, found: false, message: 'No matching declined transaction was found.' };
    return { customer_id: customerId, found: true, transaction, plain_reason: DECLINE_EXPLANATIONS[transaction.decline_reason] || 'The payment was declined for a card or account restriction.' };
  }

  if (name === 'generateFundingInstruction') {
    const document = await db.prepare(`SELECT question, answer FROM product_documents WHERE category = 'FAQ' AND lower(question) LIKE '%fund%' ORDER BY id LIMIT 1`).first();
    return { customer_id: customerId, instruction: document || null };
  }

  if (name === 'createSupportTicket') {
    return {
      customer_id: customerId,
      status: 'Action Proposed',
      action: 'createSupportTicket',
      subject: args.subject,
      description: args.description || 'Customer requested support through Voges.',
      note: 'V2 does not execute writes. No support ticket was created.',
    };
  }

  throw new Error(`Unsupported banking tool: ${name}`);
}

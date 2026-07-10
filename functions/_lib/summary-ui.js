import { id, now } from './core.js';
import { validateSummaryCard, validateSummaryResponse } from '../../shared/ui-contracts.js';

function money(value) {
  return Number(value || 0);
}

function formatRelativeTimestamp(value) {
  if (!value) return 'Updated just now';
  return `Updated ${new Date(value).toLocaleString()}`;
}

function maskedLastFour(maskedNumber = '') {
  return String(maskedNumber).replace(/\D/g, '').slice(-4).padStart(4, '0');
}

function deriveTransactionDirection(transaction) {
  const amount = money(transaction.amount);
  if (transaction.status === 'refunded' || amount > 0) return 'in';
  return 'out';
}

function buildTransactionSummary(result) {
  const transactions = (result.transactions || []).map((transaction) => ({
    id: transaction.id,
    merchant: transaction.merchant_name || 'Unknown merchant',
    amount: money(transaction.amount),
    currency: transaction.currency || 'VND',
    status: transaction.status === 'completed' ? 'success' : transaction.status,
    created_at: transaction.created_at,
    category: transaction.category || null,
    direction: deriveTransactionDirection(transaction),
  }));

  const totalSpent = transactions
    .filter((transaction) => transaction.direction === 'out' && transaction.status !== 'refunded')
    .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);

  const totalReceived = transactions
    .filter((transaction) => transaction.direction === 'in')
    .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);

  const largest = [...transactions]
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))[0];

  return validateSummaryResponse({
    spoken_response: '',
    ui: {
      type: 'transaction_summary',
      title: 'Recent transactions',
      subtitle: 'Updated just now',
      data: {
        transactions,
        summary: {
          count: transactions.length,
          total_spent: totalSpent,
          total_received: totalReceived,
          largest_transaction: largest
            ? { merchant: largest.merchant, amount: Math.abs(largest.amount) }
            : null,
        },
      },
      actions: [
        { label: 'View all', action: 'history:transactions', variant: 'ghost' },
        { label: 'Explain a transaction', action: 'voice:explain_transaction', variant: 'ghost' },
      ],
      metadata: { source: 'getRecentTransactions' },
    },
  });
}

function buildCardStatus(result) {
  const cards = (result.cards || []).map((card) => ({
    id: card.id,
    last_four: maskedLastFour(card.masked_number),
    kind: card.type === 'virtual' || card.type === 'physical' ? card.type : 'unknown',
    status: card.status || 'unknown',
    online_payments: Boolean(card.online_payment_enabled),
    international_payments: Boolean(card.international_payment_enabled),
    contactless: Boolean(card.contactless_enabled),
    daily_limit: card.daily_limit ?? null,
    daily_spend: card.daily_spend ?? null,
    currency: card.currency || 'VND',
  }));

  return validateSummaryResponse({
    spoken_response: '',
    ui: {
      type: 'card_status',
      title: 'Card controls',
      subtitle: 'Current payment settings',
      data: { cards },
      actions: [],
      metadata: { source: 'getCardStatus' },
    },
  });
}

function buildKycStatus(result) {
  return validateSummaryResponse({
    spoken_response: '',
    ui: {
      type: 'kyc_status',
      title: 'KYC status',
      subtitle: result.latest_document?.submitted_at ? formatRelativeTimestamp(result.latest_document.submitted_at) : 'Current verification snapshot',
      data: {
        status: result.kyc_status || 'Unknown',
        tier: result.account_status === 'active' ? 'Standard' : 'Review',
        missing_documents: result.latest_document?.status === 'rejected'
          ? [result.latest_document.document_type || 'Identity document']
          : [],
        last_updated: result.latest_document?.submitted_at || 'Unknown',
        next_step: result.latest_document?.rejection_reason
          ? `Provide a new ${result.latest_document.document_type || 'document'}.`
          : (result.kyc_status === 'verified' ? 'No further action required.' : 'Review the latest KYC requirement.'),
      },
      actions: [],
      metadata: { source: 'getKycStatus' },
    },
  });
}

function buildAccountBalance(result) {
  const accounts = (result.accounts || []).map((account) => ({
    id: account.id,
    account_type: account.type,
    available_balance: money(account.available_balance),
    current_balance: money(account.balance),
    currency: account.currency || 'VND',
    status: account.status || 'active',
  }));

  return validateSummaryResponse({
    spoken_response: '',
    ui: {
      type: 'account_balance',
      title: 'Account balances',
      subtitle: 'Available and current balance',
      data: { accounts },
      actions: [],
      metadata: { source: 'getCustomerProfile' },
    },
  });
}

function buildDeclineReason(result) {
  const transaction = result.transaction || {};
  return validateSummaryResponse({
    spoken_response: '',
    ui: {
      type: 'decline_reason',
      title: 'Payment declined',
      subtitle: formatRelativeTimestamp(transaction.created_at),
      data: {
        merchant: transaction.merchant_name || 'Unknown merchant',
        amount: money(transaction.amount),
        currency: transaction.currency || 'VND',
        reason: result.plain_reason || 'The payment was declined.',
        card_ending: maskedLastFour(transaction.card_number_masked),
        recommended_action: transaction.online_payment_enabled === 0
          ? 'Enable online payments after device verification.'
          : 'Review the card controls before retrying.',
        risk_level: transaction.decline_reason === 'fraud_detected' ? 'high' : 'medium',
        created_at: transaction.created_at,
      },
      actions: [],
      metadata: { source: 'explainDeclineReason' },
    },
  });
}

function buildFundingInfo(result) {
  return validateSummaryResponse({
    spoken_response: '',
    ui: {
      type: 'generic_info',
      title: 'Funding instructions',
      subtitle: 'Official bank guidance',
      data: {
        items: [
          {
            label: result.instruction?.question || 'Funding',
            value: result.instruction?.answer || 'No funding instruction was found.',
            tone: 'neutral',
          },
        ],
      },
      actions: [],
      metadata: { source: 'generateFundingInstruction' },
    },
  });
}

export function buildSummaryForTool(name, result) {
  if (name === 'getRecentTransactions') return buildTransactionSummary(result);
  if (name === 'getCardStatus') return buildCardStatus(result);
  if (name === 'getKycStatus') return buildKycStatus(result);
  if (name === 'getCustomerProfile') return buildAccountBalance(result);
  if (name === 'explainDeclineReason') return buildDeclineReason(result);
  if (name === 'generateFundingInstruction') return buildFundingInfo(result);

  return validateSummaryResponse({
    spoken_response: '',
    ui: {
      type: 'generic_info',
      title: 'Information',
      subtitle: 'Latest banking result',
      data: {
        items: Object.entries(result || {}).slice(0, 4).map(([label, value]) => ({
          label,
          value: typeof value === 'object' ? JSON.stringify(value) : String(value),
          tone: 'neutral',
        })),
      },
      actions: [],
      metadata: { source: name },
    },
  });
}

export function buildPendingActionSummary(action) {
  const payload = action.payload || {};
  const currentState = payload.current_state || 'Current policy-approved state';
  const newState = payload.new_state || action.display_description || 'Requested change';
  return validateSummaryCard({
    type: 'pending_action',
    title: action.display_title,
    subtitle: 'Awaiting confirmation',
    data: {
      action_title: action.display_title,
      current_state: currentState,
      new_state: newState,
      affected_resource: action.affected_resource || 'Selected banking item',
      risk: action.risk_level,
      confirmation_requirement: action.requires_confirmation ? 'Customer confirmation required' : 'Confirmation not required',
      biometric_required: Boolean(action.requires_biometric),
      expires_at: action.expires_at,
    },
    actions: [],
    metadata: { pending_action_id: action.id },
  });
}

export function buildSupportTicketSummary(ticket) {
  return validateSummaryCard({
    type: 'support_ticket',
    title: 'Support ticket',
    subtitle: 'Created from an approved action',
    data: {
      ticket_id: ticket.id,
      subject: ticket.subject,
      status: ticket.status,
      priority: ticket.priority,
      created_at: ticket.created_at,
      note: 'Audit trail preserved.',
    },
    actions: [],
    metadata: { ticket_id: ticket.id },
  });
}

export function buildSecurityResultSummary({ action, result, auditReference }) {
  return validateSummaryCard({
    type: 'security_result',
    title: 'Security result',
    subtitle: 'Device verification completed',
    data: {
      verification_result: 'Verified',
      device_authentication_status: 'Passkey confirmed',
      action_result: result?.action || action?.tool_name || 'Completed',
      timestamp: now(),
      audit_reference: String(auditReference || id()).slice(0, 8),
    },
    actions: [],
    metadata: { action_id: action?.id || null },
  });
}

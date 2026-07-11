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
  const declinedTransaction = transactions.find((transaction) => transaction.status === 'declined');

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
        {
          label: declinedTransaction ? 'Explain declined payment' : 'Explain a transaction',
          action: 'tool:explain_decline_reason',
          variant: 'ghost',
          payload: declinedTransaction
            ? {
                transaction_id: declinedTransaction.id,
                merchant: declinedTransaction.merchant,
              }
            : {},
        },
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
  const after = result?.after || null;
  const completedTool = result?.action || action?.tool_name;
  const actionResult = ['freezeCard', 'unfreezeCard'].includes(completedTool) && after?.status
    ? `Card status is now ${after.status}`
    : ['enableOnlinePayments', 'disableOnlinePayments'].includes(completedTool) && typeof after?.online_payment_enabled === 'number'
      ? `Online payments are now ${after.online_payment_enabled ? 'enabled' : 'disabled'}`
    : ['enableInternationalPayments', 'disableInternationalPayments'].includes(completedTool) && typeof after?.international_payment_enabled === 'number'
      ? `International payments are now ${after.international_payment_enabled ? 'enabled' : 'disabled'}`
      : after?.status
      ? `Card status is now ${after.status}`
      : result?.action || action?.tool_name || 'Completed';
  return validateSummaryCard({
    type: 'security_result',
    title: 'Security result',
    subtitle: 'Device verification completed',
    data: {
      verification_result: 'Verified',
      device_authentication_status: 'Passkey confirmed',
      action_result: actionResult,
      timestamp: now(),
      audit_reference: String(auditReference || id()).slice(0, 8),
    },
    actions: [],
    metadata: { action_id: action?.id || null },
  });
}

export function buildResolutionPlanSummary(plan, pendingAction) {
  return validateSummaryCard({
    type: 'resolution_plan',
    title: 'Resolution Autopilot',
    subtitle: pendingAction ? 'A bounded plan is ready for your review' : 'Investigation complete',
    data: {
      plan_id: plan.id,
      problem: plan.problem,
      root_causes: plan.root_causes,
      steps: plan.steps.map((step) => ({ id: step.id, title: step.title, description: step.description, risk_level: step.risk_level, estimated_effect: step.estimated_effect, status: step.read_only ? 'verification' : 'planned' })),
      expected_result: plan.expected_result,
      readiness_status: plan.readiness_check.status,
      blockers: plan.readiness_check.blockers || [],
      requires_biometric: Boolean(pendingAction?.requires_biometric),
      estimated_risk: plan.estimated_risk,
    },
    actions: pendingAction ? [{ label: 'Review and approve plan', action: 'resolution:review', variant: 'primary', payload: { pending_action_id: pendingAction.id } }] : [],
    metadata: { plan_id: plan.id, pending_action_id: pendingAction?.id || null, plan_hash: plan.plan_hash },
  });
}

export function buildResolutionCompleteSummary(resolution) {
  const readiness = resolution.readiness_check || { status: 'blocked', blockers: ['Readiness check was unavailable.'] };
  return validateSummaryCard({
    type: 'resolution_complete',
    title: readiness.status === 'ready_after_plan' ? 'Resolution complete' : 'Resolution needs follow-up',
    subtitle: 'The approved plan has finished',
    data: {
      problem: resolution.problem || 'Payment issue',
      completed_steps: (resolution.steps || []).filter((step) => step.status === 'completed').map((step) => step.title),
      readiness_status: readiness.status,
      blockers: readiness.blockers || [],
      verification: 'Device authenticated and plan contract verified',
    },
    actions: [],
    metadata: { plan_id: resolution.id || null, plan_hash: resolution.plan_hash || null },
  });
}

export function buildScamRiskSummary(assessment) {
  return validateSummaryCard({
    type: 'scam_risk',
    title: 'Scam risk advisory',
    subtitle: 'High-risk signals detected — this is not a final conclusion',
    data: {
      risk_level: assessment.level,
      matched_patterns: assessment.matched_patterns.map((item) => ({ id: item.id, name: item.name, red_flags: item.red_flags || [] })),
      recommendation: assessment.recommendation,
      verification_questions: assessment.verification_questions || [],
    },
    actions: [],
    metadata: { source: 'sample_data/luadao.json.txt', advisory: true },
  });
}
